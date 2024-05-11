const { default: axios } = require("axios");
const cheerio = require('cheerio');

async function calculateTravelTime(origin, destination, mode) {

  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error('No Google Maps API key provided');
    return -1;
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${mode}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    const data = response.data;
    if (data.status === 'OK') {
      const travelTime = data.routes[0].legs[0].duration.text;
      const travelTimeMatch = travelTime.match(/(\d+) min/);
      if (travelTimeMatch) {
        return parseInt(travelTimeMatch[1]);
      }
    } else {
      console.error(`Error calculating travel time: ${data.status}`);
    }
  } catch (error) {
    console.error(error);
  }
  return -1;

}


async function getAnnounce(annonceId) {

  const cf_clearance = process.env.CF_CLEARANCE;

  try {

    const response = await axios({
      method: 'get',
      url: `https://www.lacartedescolocs.fr/listings/show_listing?url_token=${annonceId}&locale=fr`,
      headers: {
        'Cookie': `cf_clearance=${cf_clearance}`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'TE': 'trailers',
        'Referer': 'https://www.lacartedescolocs.fr/logements/fr/occitanie/montpellier',
        "X-Requested-With": "XMLHttpRequest",
        "DNT": "1",
        "Host": "www.lacartedescolocs.fr",
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate,br',
        'Accept': '*/*',
        "Connection": "keep-alive",
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
      }
    })
    if (response.status !== 200) {
      console.error('Announce not found');
      return undefined;
    }
    return response.data;

  } catch (error) {
    console.error("Error getting announce", annonceId);
    return undefined;
  }
}

function getShortenedUrl(url) {
  const parsedUrl = new URL(url);

  // Extract the pathname component
  const pathname = parsedUrl.pathname;

  // Retrieve the second link
  const encodedLink = pathname.split('L0/')[1];

  // Decode the URL-encoded string
  const decodedLink = decodeURIComponent(encodedLink);
  const reduceLink = decodedLink.split('/a/')[1].split('/1/')[0];

  const apartmentNumberMatch = reduceLink.match(/[a-zA-Z0-9]{6}/)

  if (!apartmentNumberMatch) {
    throw new Error('The reduce link does not match the expected format.');
  }

  const shortenedUrl = `https://lcrt.fr/${apartmentNumberMatch[0]}`

  return shortenedUrl;
}


async function getApartmentsFromListings(listings) {

  // Loop through the matched listings and extract the information from the td elements
  const apartments = [];
  for (const listing of listings) {
    const $ = cheerio.load(listing);
    const tds = $('td');

    const apartment = {};

    // Do something with the tds, for example print the text content to the console
    for (const td of tds) {
      // Find all h3 elements
      let isTitle = false;
      const h3s = $(td).find('h3');
      const h4s = $(td).find('h4');
      if (h3s.length && h3s.length > 0) {
        isTitle = true;
        for (const h3 of h3s) {


          // If the H3 Match number, we extract and assign it as the rent
          const rentMatch = $(h3).text().match(/^(\d+)$/);
          if (rentMatch) {
            apartment.rent = parseInt(rentMatch[1]);
          } else {
            // If the H3 doesn't match a number, we assume it's the title

            //Extract the surface from the title
            const surfaceMatch = $(h3).text().match(/.*de\ (\d+) m.*/);
            if (surfaceMatch) {
              apartment.surface = parseInt(surfaceMatch[1]);
            }
            apartment.title = $(h3).text();

            // Extract the number of rooms from the title
            const roomMatch = $(h3).text().match(/.*(\d+) pièces.*/);
            if (roomMatch) {
              apartment.rooms = parseInt(roomMatch[1]);
            }
          }

        }
      }
      if (h4s.length && h4s.length > 0) {
        isTitle = true;
        for (let index = 0; index < h4s.length; index++) {
          const h4 = h4s[index];
          const roomMatch = $(h4).text().match(/.*chambre de (\d+).*/);
          if (roomMatch) {
            // Convert the room surface to a number
            apartment.roomSurface = parseInt(roomMatch[1]);
          } else if (index === 1) {

            const streetMatch = $(h4).text().match(/.*, (.*)/);
            if (streetMatch) {
              apartment.street = streetMatch[1];

              // If the street is specified, calculate the travel time by bike
              // TODO Add severall adresses to calculate the travel time to
              // With a JSON file containing the adresses
              const comedieAdress = 'Place de la Comedie, Montpellier, France';
              const polytechAdress = 'Place Eugene Bataillon, Montpellier, France';
              const destination = `${apartment.street}, Montpellier, France`;
              const mode = 'bicycling';

              const travelTimeBikeToComedie = await calculateTravelTime(comedieAdress, destination, mode);
              const travelTimeBikeToPolytech = await calculateTravelTime(polytechAdress, destination, mode);

              apartment.travelTimeBikeToComedie = travelTimeBikeToComedie;
              apartment.travelTimeBikeToPolytech = travelTimeBikeToPolytech;
            }
          }
        }

      }

      // Get the href from the a element inside the td
      const a = $(td).find('a');
      const href = a.attr('href');
      const text = $(td).text().trim().replace(/\s+/g, ' ');
      if (!isTitle && href && href.length > 0) {
        apartment.link = getShortenedUrl(href);
      } else if (!isTitle && text && text.length > 0) {
        apartment.description = text;
      }
    }
    apartments.push(apartment);
  }

  return apartments;
}

function getFormattedDate(date) {
  return date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

}

function getInfoFromAnnounce(apartment) {
  const {
    housemates, room_surface, lodging_surface, url_shortened,
    cost_total_rent, cost_caution, cost_fees, address_street,
    dishwasher, balcony, terrace,
    roomsNumber, only_women_allowed
  } = apartment;
  const garage = apartment.garage ?? false;
  const air_conditioning = apartment.air_conditioning ?? false;
  const elevator = apartment.elevator ?? false;
  const furnished = apartment.rooms[0].furnished && (apartment.furnished ?? false);
  const { bed_type, availability } = apartment.rooms[0];
  let bedType = "Double";
  if (bed_type === "simple") {
    bedType = "Simple";
  }
  const living = roomsNumber > housemates + apartment.rooms.length;
  const rooms = apartment.rooms.map(room => {
    const { bed_type, availability, surface, cost_total_rent: rent } = room
    return {
      bed_type,
      availability,
      surface,
      rent,
    }
  })

  // Build the equipment sentence string with the equipment
  let equipment = [];
  if (dishwasher) {
    equipment.push('lave-vaisselle');
  }
  if (elevator) {
    equipment.push('ascenseur');
  }
  if (air_conditioning) {
    equipment.push('climatisation');
  }

  equipment = equipment.join(', ');
  const unitedLease = (apartment.description.toLowerCase().match(/bail\ solidaire/i)) ? true : false;

  return {
    unitedLease,
    housemates,
    rooms_available: rooms.length,
    rent: cost_total_rent,
    caution: cost_caution,
    surface: lodging_surface,
    roomSurface: room_surface,
    bedType,
    availability,
    fees: cost_fees ?? 0,
    street: address_street,
    terrace: (balcony || terrace) ?? false,
    traversant: false,
    equipment,
    garage,
    rooms,
    bryan: rooms.length > 1,
    url: url_shortened,
    living,
    only_women_allowed,
    furnished,
    notes: ""
  }
}


module.exports = {
  calculateTravelTime,
  getAnnounce,
  getApartmentsFromListings,
  getInfoFromAnnounce,
  getFormattedDate,
};