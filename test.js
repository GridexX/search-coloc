const { type } = require("os");
const { getAnnounce, getInfoFromAnnounce, getFormattedDate } = require("./utils")
const fs = require('fs').promises
const path = require('path')
// const apartments = [{
//   link: "https://lcrt.fr/vrs308"
// }]

async function main() {

  const fileName = getFormattedDate(new Date()) + '_apartments.json';
  const buffer = await fs.readFile(path.join(process.cwd(), 'apartments', fileName));
  let apartments = JSON.parse(buffer);
  // apartments = sortApartments(apartments);

  const apartmentsInfos = await Promise.all(
    // Filter the response to get some information and add it to the apartment object
    apartments.map(async (apartment) => {
      const announce = await getAnnounce(apartment.link.replace('https://lcrt.fr/', ''));
      const apartmentInfo = getInfoFromAnnounce(announce);
      console.log(apartmentInfo)
      return apartmentInfo;
    }))

  fs.writeFile('tmp.json', JSON.stringify(apartmentsInfos, null, 2))

  const finalA = apartmentsInfos.filter(apartment => apartment.only_women_allowed === false && apartment.housemates < 5 && apartment.furnished === true && apartment.unitedLease === false);
  fs.writeFile('filtered.json', JSON.stringify(finalA, null, 2))
}

main()