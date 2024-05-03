import {Client} from '@notionhq/client';
import {Apartment, NotionAnnounce} from './types';
import {calculateBikeTravelTime, getFormattedDate} from './utils';
import {NOTION_DATABASE_ID} from '../constants';
import {readFile} from 'fs/promises';
import path = require('path');
import {firstBy} from 'thenby';
import {authorize} from './auth';
import {google} from 'googleapis';
import {OAuth2Client} from 'google-auth-library';

export async function postAnnounce(announce: NotionAnnounce) {
  const notion = new Client({
    auth: process.env.NOTION_TOKEN,
  });

  const {travelTimeBikeToComedie, travelTimeBikeToPolytech} =
    await calculateBikeTravelTime(announce.address);

  notion.pages
    .create({
      icon: {
        type: 'emoji',
        emoji: '📍',
      },
      parent: {
        type: 'database_id',
        database_id: NOTION_DATABASE_ID,
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: announce.address,
              },
            },
          ],
        },
        Link: {
          url: announce.url,
        },
        Chambre: {
          number: announce.roomSurface,
        },
        Surface: {
          number: announce.surface,
        },
        Colocs: {
          number: announce.rooms,
        },
        Popo: {
          number: travelTimeBikeToPolytech,
        },
        Com: {
          number: travelTimeBikeToComedie,
        },
        Notes: {
          rich_text: [
            {
              text: {
                content: announce.notes,
              },
            },
          ],
        },
        Loyer: {
          number: announce.rent,
        },
        Caution: {
          number: announce.caution,
        },
        Frais: {
          number: announce.fees,
        },
        Terrasse: {
          checkbox: announce.terrace,
        },
        Salon: {
          checkbox: announce.living,
        },
        'Local/Garage': {
          checkbox: announce.local,
        },
      },
    })
    .then(response => {
      console.log(response);
    })
    .catch(error => {
      console.error(error);
    });
}

export async function extractAnnounces() {
  try {
    // Check if there is a file called YYYY-MM-DD_apartments.json

    const fileName = getFormattedDate(new Date()) + '_apartments.json';
    const buffer = await readFile(
      path.join(process.cwd(), 'apartments', fileName)
    );
    let apartments = JSON.parse(buffer.toString());
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

async function listMessages(auth: OAuth2Client) {
  const gmail = google.gmail({version: 'v1', auth});
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
  messages.forEach(message => {
    //console.log(`- ${JSON.stringify(message)}`);
    gmail.users.messages
      .get({
        userId: 'me',
        id: message.id,
        format: 'full',
      })
      .then(async message => {
        const body = message.data.payload.body;
        if (body && body.data) {
          const html = Buffer.from(body.data, 'base64url').toString('utf-8');
          // console.log(decodedData);
          const listingRegex =
            /<!-- BEGIN LISTING \/\/ -->(.*?)<!-- \/\/ END LISTING -->/gs;

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
            await fs.writeFile(
              path.join(process.cwd(), 'apartments', fileName),
              JSON.stringify(apartmentsSorted, null, 2)
            );

            const apartmentsFiltered = filterApartments(apartmentsSorted);

            // Append to the global.xls file the new apartments
            const csvfileName = 'global.csv';
            // Write each keys of the object to the file
            for (const apartment of apartmentsFiltered) {
              const {
                surface,
                rent,
                rooms,
                roomSurface,
                street,
                travelTimeBikeToComedie,
                travelTimeBikeToPolytech,
                link,
                description,
              } = apartment;
              const line = `${link}\t${surface}\t${rent}\t${rooms}\t${roomSurface}\t${street}\t${travelTimeBikeToComedie}\t${travelTimeBikeToPolytech}\t${description}\t\t\t\n`;
              await fs.appendFile(
                path.join(process.cwd(), 'apartments', csvfileName),
                line
              );
            }

            console.log('Apartments saved to file.');
            console.log(
              `${apartmentsFiltered.length} interesting / ${apartments.length} apartments.`
            );
          } catch (error) {
            console.error(error);
          }
        }
      });
  });
}

function sortApartments(apartments: Array<Apartment>) {
  const sortedApartments = apartments.toSorted(
    firstBy(
      (a: Apartment, b: Apartment) =>
        a.travelTimeBikeToPolytech +
        a.travelTimeBikeToComedie -
        (b.travelTimeBikeToPolytech + b.travelTimeBikeToComedie)
    ).thenBy((a: Apartment, b: Apartment) => a.rent - b.rent)
  );

  return sortedApartments;
}

function filterApartments(apartments: Array<Apartment>) {
  const maxRooms = 5; // 4 roommates and the living room
  const minSurface = 10; // 10 m2 for the room

  const maxTravelComedie = 12; // 12 minutes by bike to Comedie
  const maxTravelPolytech = 20; // 20 minutes by bike to Polytech

  return apartments.filter(apartment => {
    return (
      apartment.rooms <= maxRooms &&
      apartment.roomSurface >= minSurface &&
      apartment.travelTimeBikeToComedie <= maxTravelComedie &&
      apartment.travelTimeBikeToPolytech <= maxTravelPolytech
    );
  });
}
