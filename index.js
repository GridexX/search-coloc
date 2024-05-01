const fs = require('fs').promises;
const cheerio = require('cheerio');
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const axios = require('axios');
const { firstBy } = require('thenby');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

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

function sortApartments(apartments) {

  const sortedApartments = apartments.toSorted(
    firstBy((a, b) => (a.travelTimeBikeToPolytech + a.travelTimeBikeToComedie) - (b.travelTimeBikeToPolytech + b.travelTimeBikeToComedie))
      .thenBy((a, b) => a.rent - b.rent)
  );

  // const sortedApartments = apartments.toSorted((a, b) => {
  //   // aTravelTime is the sum of the travel time to Polytech and Comedie or undifined if the travel time couldn't be calculated
  //   const aTravelTime = a.travelTimeBikeToPolytech + a.travelTimeBikeToComedie || 0;
  //   const bTravelTime = b.travelTimeBikeToPolytech + b.travelTimeBikeToComedie || 0;
  //   return aTravelTime - bTravelTime;
  // });


  return sortedApartments;

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

async function getApartments(listings) {

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
            apartment.title = $(h3).text();

            // Extract the number of rooms from the title
            const roomMatch = $(h3).text().match(/.*(\d+) pièces.*/);
            if (roomMatch) {
              apartment.rooms = parseInt(roomMatch[1]);
            }
          }

          console.log(`H3: ${$(h3).text()}`);
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
        for (const h4 of h4s) {
          console.log(`H4: ${$(h4).text()}`);
        }
      }

      // Get the href from the a element inside the td
      const a = $(td).find('a');
      const href = a.attr('href');
      const text = $(td).text().trim().replace(/\s+/g, ' ');
      if (!isTitle && href && href.length > 0) {
        console.log("p: " + href);
        apartment.link = getShortenedUrl(href);
      } else if (!isTitle && text && text.length > 0) {
        apartment.description = text;
      }
    }
    apartments.push(apartment);
    console.log();
  }
  console.log(apartments);

  return apartments;
}

/**
 * This function filters the apartments based on the user's preferences.
 */
function filterApartments(apartments) {

  const maxRooms = 5; // 4 roommates and the living room
  const minSurface = 10; // 10 m2 for the room

  const maxTravelComedie = 12; // 12 minutes by bike to Comedie
  const maxTravelPolytech = 18; // 18 minutes by bike to Polytech

  return apartments.filter(apartment => {
    return apartment.rooms <= maxRooms &&
      apartment.roomSurface >= minSurface &&
      apartment.travelTimeBikeToComedie <= maxTravelComedie &&
      apartment.travelTimeBikeToPolytech <= maxTravelPolytech;
  })

}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listMessages(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:notification@lacartedescolocs.fr',
    maxResults: 1,
    // TODO add a filter to only get the latest email from the sender
  });
  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    console.log('No messages found.');
    return;
  }
  // console.log('Message:');
  messages.forEach((message) => {
    //console.log(`- ${JSON.stringify(message)}`);
    gmail.users.messages.get({
      userId: 'me',
      id: message.id,
      format: 'full',
    }).then(async (message) => {
      const body = message.data.payload.body;
      if (body && body.data) {
        const html = Buffer.from(body.data, 'base64url').toString('utf-8');
        // console.log(decodedData);
        const listingRegex = /<!-- BEGIN LISTING \/\/ -->(.*?)<!-- \/\/ END LISTING -->/gs;

        const listings = html.match(listingRegex);
        if (!listings) {
          console.log('No listings found.');
          return [];
        }

        const apartments = await getApartments(listings);

        // Save the apartments to a file
        try {
          // TODO Save the file to a EXCEL file
          const apartmentsSorted = sortApartments(apartments);
          const fileName = getFormattedDate(new Date()) + '_apartments.json';
          await fs.writeFile(path.join(process.cwd(), 'apartments', fileName), JSON.stringify(apartmentsSorted, null, 2));

          const apartmentsFiltered = filterApartments(apartmentsSorted);

          // Append to the global.xls file the new apartments
          const csvfileName = 'global.csv';
          // Write each keys of the object to the file
          for (const apartment of apartmentsFiltered) {
            const { title, rent, rooms, roomSurface, street, travelTimeBikeToComedie, travelTimeBikeToPolytech, link, description } = apartment;
            const line = `${link}\t${title}\t${rent}\t${rooms}\t${roomSurface}\t${street}\t${travelTimeBikeToComedie}\t${travelTimeBikeToPolytech}\t${description}\n`
            await fs.appendFile(path.join(process.cwd(), 'apartments', csvfileName), line);
          }

          console.log('Apartments saved to file.')
          console.log(`${apartmentsFiltered.length} interesting / ${apartments.length} apartments.`)

        } catch (error) {
          console.error(error);
        }
      }

    });
  });
}

function getFormattedDate(date) {
  return date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

}

async function readListOfAppartments() {
  try {

    // Check if there is a file called YYYY-MM-DD_apartments.json

    const fileName = getFormattedDate(new Date()) + '_apartments.json';
    const buffer = await fs.readFile(path.join(process.cwd(), 'apartments', fileName));
    let apartments = JSON.parse(buffer);
    apartments = sortApartments(apartments);

    const apartmentsFiltered = filterApartments(apartments);
    console.log(apartmentsFiltered);

    return apartments;
  } catch (error) {
    console.error('No apartments found. Fetching from email.' + error);
    authorize().then(listMessages).catch(console.error);
    return [];
  }
}

// readListOfAppartments().then(console.log).catch(console.error);


async function createReminder(auth) {
  // This function creates a reminder in the Google Calendar to remind the user to call the landlord after 2 days after the first message
  // If a visit is scheduled, the reminder is set with the visit date and the number of the landlord

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('No Google API key provided');
    return -1;
  }

  const { parse } = require('csv-parse/sync');

  const filePath = path.join(process.cwd(), 'apartments', 'global.csv');
  const content = await fs.readFile(filePath);

  const records = parse(content, {
    delimiter: '\t',
    skip_records_with_empty_values: true,
    skip_records_with_error: true

  });


  console.log(records);

  const visitIndex = records[0].indexOf('DATE_VISIT');
  const messageIndex = records[0].indexOf('DATE_MESSAGE');
  const rentIndex = records[0].indexOf('RENT');
  const addressIndex = records[0].indexOf('STREET');
  const descriptionIndex = records[0].indexOf('DESCRIPTION');
  const noMessageDate = records.filter(record => record[messageIndex] === '');

  const scaningRecords = records.filter(record => record[messageIndex] !== '' && record[visitIndex] === '')

  console.log("Envoyer un message pour les annonces suivantes: " + noMessageDate.map(record => JSON.stringify(({ link: record[0], title: record[1], rent: record[4] }))).join(', '));

  const visitRecords = records.filter(record => record[visitIndex] !== '');

  // Check the announce without a visit date and a message date 2 days before to create a reminder

  // The date is in format mm-dd-yyyy
  // Use the Google Calendar API to create a reminder

  scaningRecords.forEach(async record => {
    const date = record[messageIndex].split('-');
    const messageDate = new Date(date[2], date[0] - 1, date[1]);
    console.log(messageDate.toLocaleDateString())
    // const twoDaysBefore = new Date(messageDate);
    const dateNow = new Date();
    // If the message is above 1 day in the past, we create a reminder
    if (messageDate < dateNow) {
      const twoDaysBefore = new Date(messageDate);
      twoDaysBefore.setDate(twoDaysBefore.getDate() + 2);
      const title = `Appeler l'annonce: ${record[1]}`;
      console.log(`Appeler l'annonce: ${record[1]} le ${twoDaysBefore.toLocaleDateString()}`);

      const calendar = google.calendar({ version: 'v3', auth });
      const event = {
        summary: title,
        location: record[addressIndex],
        description: `Lien: ${record[0]}\nLoyer: ${record[rentIndex]}\n\n${record[descriptionIndex]}`,
        start: {
          // TODO Add the time where to call the landlord
          dateTime: twoDaysBefore.toISOString(),
          timeZone: 'Europe/Paris',
        },
        end: {
          dateTime: twoDaysBefore.toISOString(),
          timeZone: 'Europe/Paris',
        },
      };

      calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        console.log('Reminder created: %s', res.data.htmlLink);
      });

      // TODO Add the time reminder date to the excel file

    }
  })


  const calendar = google.calendar({ version: 'v3', auth });
  calendar.events.list({
    calendarId: 'primary',
    maxResults: 10,
    q: 'Visite',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    // console.log(res.data);
  });

}

authorize().then(createReminder).catch(console.error);