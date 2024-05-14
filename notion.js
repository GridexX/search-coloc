const { Client } = require("@notionhq/client")
const { Command } = require('commander');
const { calculateTravelTime } = require("./utils");

function main() {
  const notion = new Client({
    auth: process.env.NOTION_TOKEN,
  })

  const pageId = "0d639abd-7bb7-4320-b584-4fb20795e895"

  notion.pages.retrieve({ page_id: pageId })
    .then(response => {
      console.log(JSON.stringify(response, null, 2))
    })
    .catch(error => {
      console.error(error)
    })

  // notion.databases.retrieve({
  //   database_id: process.env.NOTION_DATABASE_ID,
  // })

}

// main()


async function postAnnounce(announce) {

  const notion = new Client({
    auth: process.env.NOTION_TOKEN,
  })

  // notion.databases.retrieve({
  //   database_id: process.env.NOTION_DATABASE_ID,
  // }).then(response => {
  //   console.log(JSON.stringify(response))
  // })
  //   .catch(error => {
  //     console.error(error)
  //   })

  const comedieAdress = 'Place de la Comedie, Montpellier, France';
  const polytechAdress = 'Place Eugene Bataillon, Montpellier, France';
  const destination = `${announce.street}, Montpellier, France`;
  const mode = 'bicycling';

  const travelTimeBikeToComedie = announce.travelTimeBikeToComedie ?? await calculateTravelTime(comedieAdress, destination, mode);
  const travelTimeBikeToPolytech = announce.travelTimeBikeToPolytech ?? await calculateTravelTime(polytechAdress, destination, mode);

  let additionalNotes = '';
  if (announce.rooms) {
    if (announce.rooms.length > 1) {
      additionalNotes = `Chambre de ${announce.rooms[1].surface}m2 à ${announce.rooms[1].rent}€ dispo au ${announce.rooms[1].availability}\n`
    }
  }
  additionalNotes += announce.notes;

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
              "content": announce.street ?? "No Address"
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
        "number": announce.roomNumber ?? announce.housemates,
      },
      "Popo": {
        "number": travelTimeBikeToPolytech ?? -1
      },
      "Com": {
        "number": travelTimeBikeToComedie ?? -1
      },
      "Notes": {
        "rich_text": [
          {
            "text": {
              "content": additionalNotes
            }
          }
        ]
      },
      "Date": {
        "date": {
          "start": new Date(announce.availability)
        }
      },
      // "Lit": {
      //   "select": {
      //     "name": announce.bedType
      //   }
      // },
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
      "Garage": {
        "checkbox": announce.garage
      },
      "Traversant": {
        "checkbox": announce.traversant
      },
      "Bryan": {
        "checkbox": announce.bryan
      },
      "Equipements": {
        "rich_text": [
          {
            "text": {
              "content": announce.equipment
            }
          }
        ]
      },
    }
  }).then(response => {
    console.log(response.url)
  }).catch(error => {
    console.error(error)
    console.log("Error while posting the announce to Notion:")
    console.log(JSON.stringify(announce, null, 2))
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
  .option('-g, --garage', 'If there is a local or a garage for the bike')
  .option('-l, --living', 'There is a living room')
  .option('-t, --terrace', 'If there is a terrace or a balcon')
  .option('-tv, --traversal', 'If the apartment is traversal')
  .option('-e, --equipment <equipment>', 'Equipment in the apartment', '')
  .option('-n, --notes <notes>', 'Notes about the apartment', '')
  .option('-b, --bed <bed>', "Bed Type 'simple' or 'double'", 'double')
  .action((options) => {
    let { url, notes, address, rent, surface, roomSurface, rooms, caution, fees, local, living, terrace, equipment, traversal } = options
    rent = parseInt(rent)
    surface = parseInt(surface)
    roomSurface = parseInt(roomSurface)
    rooms = parseInt(rooms)
    caution = parseInt(caution)
    fees = parseInt(fees)
    terrace = terrace ?? false;
    garage = local ?? false;
    living = living ?? false;
    traversant = traversal ?? false;
    postAnnounce({
      url,
      fees,
      notes,
      street: address,
      rent,
      surface,
      roomSurface,
      roomNumber: rooms,
      caution,
      garage,
      living,
      terrace,
      equipment,
      traversant,
      bedType: bed,
      bryan: false
    })
  })

// program.parse();

module.exports = {
  postAnnounce,
}