const { Client } = require("@notionhq/client")
const { Command } = require('commander');
const { calculateTravelTime } = require("./utils");

// Initializing a client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

function main() {

  notion.databases.retrieve({
    database_id: process.env.NOTION_DATABASE_ID,
  }).then(response => {
    console.log(response)
  })
    .catch(error => {
      console.error(error)
    })
}


async function postAnnounce(announce) {

  const comedieAdress = 'Place de la Comedie, Montpellier, France';
  const polytechAdress = 'Place Eugene Bataillon, Montpellier, France';
  const destination = `${announce.address}, Montpellier, France`;
  const mode = 'bicycling';

  const travelTimeBikeToComedie = await calculateTravelTime(comedieAdress, destination, mode);
  const travelTimeBikeToPolytech = await calculateTravelTime(polytechAdress, destination, mode);

  notion.pages.create({
    "icon": {
      "type": "emoji",
      "emoji": "📍"
    },
    "parent": {
      "type": "database_id",
      "database_id": process.env.NOTION_DATABASE_ID
    },
    "properties": {
      "Name": {
        "title": [
          {
            "text": {
              "content": announce.address
            }
          }
        ]
      },
      "Link": {
        "url": announce.url
      },
      "Chambre": {
        "number": announce.roomSurface
      },
      "Surface": {
        "number": announce.surface
      },
      "Colocs": {
        "number": announce.rooms
      },
      "Popo": {
        "number": travelTimeBikeToPolytech
      },
      "Com": {
        "number": travelTimeBikeToComedie
      },
      "Notes": {
        "rich_text": [
          {
            "text": {
              "content": announce.notes
            }
          }
        ]
      },
      "Loyer": {
        "number": announce.rent
      },
      "Caution": {
        "number": announce.caution
      },
      "Frais": {
        "number": announce.fees
      },
      "Terrasse": {
        "checkbox": announce.terrace
      },
      "Salon": {
        "checkbox": announce.living
      },
      "Local/Garage": {
        "checkbox": announce.local
      }
    },
  }).then(response => {
    console.log(response)
  }).catch(error => {
    console.error(error)
  })

}

// Retrieve arguments from the command line
const program = new Command();

program
  .name('Annonce to Notion')
  .description('CLI to Insert the announce to Notion.')
  .version('0.1.0')

program.command('post')
  .description('Post the Apartment\'s announce to Notion')
  .requiredOption('-u, --url <link>', 'The link of the announce')
  .requiredOption('-a, --address <address>', 'The address of the apartment')
  .requiredOption('-re, --rent <rent>', 'The rent in € of the apartment')
  .requiredOption('-s, --surface <surface>', 'The surface of the apartment')
  .requiredOption('-rs, --roomSurface <roomSurface>', 'The room\'s surface')
  .requiredOption('-ro, --rooms <rooms>', 'The number of rooms in the apartment')
  .option('-c, --caution <caution>', 'The caution in €', '0')
  .option('-f, --fees <fees>', 'Additional fees in €', '0')
  .option('-g, --local <local>', 'If there is a local or a garage', 'false')
  .option('-l, --living <living>', 'If there is a living room', 'false')
  .option('-t, --terrace <terrace>', 'If there is a terrace or a balcon', 'false')
  .option('-n, --notes <notes>', 'Notes about the apartment')
  .action((options) => {
    let { url, notes, address, rent, surface, roomSurface, rooms, caution, fees, local, living, terrace } = options
    rent = parseInt(rent)
    surface = parseInt(surface)
    roomSurface = parseInt(roomSurface)
    rooms = parseInt(rooms)
    caution = parseInt(caution)
    fees = parseInt(fees)
    local = local === 'true'
    living = living === 'true'
    terrace = terrace === 'true'
    postAnnounce({
      url,
      fees,
      notes,
      address,
      rent,
      surface,
      roomSurface,
      rooms,
      caution,
      local,
      living,
      terrace
    })
  })

program.parse();