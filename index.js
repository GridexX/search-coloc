const fs = require('fs').promises;

const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { firstBy } = require('thenby');
const { getAnnounce, getApartmentsFromListings, getInfoFromAnnounce, getFormattedDate } = require('./utils');
const { postAnnounce } = require('./notion');

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

function sortApartments(apartments) {

  const sortedApartments = apartments.toSorted(
    firstBy((a, b) => a.travelTimeBikeToComedie - b.travelTimeBikeToComedie)
      .thenBy((a, b) => a.rooms - b.rooms)
      .thenBy((a, b) => a.rent - b.rent)
  );

  return sortedApartments;

}

/**
 * This function filters the apartments based on the user's preferences.
 */
async function filterApartments(apartments) {

  const minSurface = 10; // 10 m2 for the room

  const maxTravelComedie = 12; // 12 minutes by bike to Comedie

  console.log("apartments");
  console.log(apartments);

  let filteredApartments = apartments.filter(apartment => apartment.roomSurface >= minSurface && (apartment.travelTimeBikeToComedie ?? 0) <= maxTravelComedie)

  // Query each apartment to get information
  const apartmentsInfos = await Promise.all(
    // Filter the response to get some information and add it to the apartment object
    filteredApartments.map(async (apartment) => {
      const announce = await getAnnounce(apartment.link.replace('https://lcrt.fr/', ''));
      const { travelTimeBikeToComedie, travelTimeBikeToPolytech, rooms } = apartment;
      return { roomsNumber: rooms, travelTimeBikeToComedie, travelTimeBikeToPolytech, ...announce }
    }))

  let finalA = apartmentsInfos.filter(apartment => apartment.published === true).map(apartment => getInfoFromAnnounce(apartment))

  const fileName = getFormattedDate(new Date()) + '_apartments_filtered.json';
  await fs.writeFile(path.join(process.cwd(), 'apartments', fileName), JSON.stringify(finalA, null, 2));

  const apartmentWithFilters = finalA.filter(apartment => apartment.only_women_allowed === false && apartment.housemates < 5 && apartment.furnished === true && apartment.unitedLease === false);

  return apartmentWithFilters

}

async function readListOfAppartments() {
  try {

    // Check if there is a file called YYYY-MM-DD_apartments.json

    const fileName = getFormattedDate(new Date()) + '_apartments.json';
    const buffer = await fs.readFile(path.join(process.cwd(), 'apartments', fileName));
    let apartments = JSON.parse(buffer);
    apartments = sortApartments(apartments);

    const apartmentsFiltered = await filterApartments(apartments);
    console.log(JSON.stringify(apartmentsFiltered, null, 2));

    return apartments;
  } catch (error) {
    console.error('No apartments found. Fetching from email.' + error);
    authorize().then(listMessages).catch(console.error);
    return [];
  }
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

        const apartments = await getApartmentsFromListings(listings);

        // Save the apartments to a file
        try {
          // TODO Save the file to a EXCEL file
          const apartmentsSorted = sortApartments(apartments);
          console.log(`${apartmentsSorted.length} new apartments found.`)
          const fileName = getFormattedDate(new Date()) + '_apartments.json';
          const fileNameFiltered = getFormattedDate(new Date()) + '_apartments_filtered.json';
          await fs.writeFile(path.join(process.cwd(), 'apartments', fileName), JSON.stringify(apartmentsSorted, null, 2));

          const apartmentsFiltered = await filterApartments(apartmentsSorted);
          if (apartmentsFiltered.length > 0) {
            await fs.writeFile(path.join(process.cwd(), 'apartments', fileNameFiltered), JSON.stringify(apartmentsFiltered, null, 2));
            console.log(`${apartmentsFiltered.length} Apartments filtered and saved`)
          } else {
            console.log('No apartments matching your criteria found 😥');
          }

          Promise.all(apartmentsFiltered.map(async apartment => {
            await postAnnounce(apartment);
          }))

        } catch (error) {
          console.error(error);
        }
      }

    });
  });
}


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
  const reminderIndex = records[0].indexOf('DATE_REMINDER');
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

      // TODO Add to the xls the Reminder date 

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

authorize().then(readListOfAppartments).catch(console.error);
