const fs = require('fs').promises;
const cheerio = require('cheerio');
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const axios = require('axios');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
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

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

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
          return;
        }
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
              apartment.link = href;
            } else if (!isTitle && text && text.length > 0) {
              apartment.description = text;
            }
          }
          apartments.push(apartment);
          console.log();
        }
        console.log(apartments);

        // Save the apartments to a file
        try {
          // TODO Save the file to a EXCEL file
          await fs.writeFile(path.join(process.cwd(), 'apartments.json'), JSON.stringify(apartments, null, 2));
        } catch (error) {
          console.error(error);
        }
      }

    });
  });
}

async function readListOfAppartments() {
  try {
    const apartments = await fs.readFile(path.join(process.cwd(), 'apartments.json'));
    return JSON.parse(apartments);
  } catch (_error) {
    authorize().then(listMessages).catch(console.error);
    return [];
  }
}

readListOfAppartments().then(console.log).catch(console.error);


