// This function retrieve the link and add the announce to notion


const { postAnnounce } = require("./notion");
const { getAnnounce, getInfoFromAnnounce, calculateTravelTime } = require("./utils")

async function main() {
  const link = process.argv[2].replace('https://lcrt.fr/', '');
  const announce = await getAnnounce(link);
  // Get the travel time to the Comedie and Polytech
  const comedieAdress = 'Place de la Comedie, Montpellier, France';
  const polytechAdress = 'Place Eugene Bataillon, Montpellier, France';
  const destination = `${announce.street}, Montpellier, France`;
  const mode = 'bicycling';

  const travelTimeBikeToComedie = await calculateTravelTime(comedieAdress, destination, mode);
  const travelTimeBikeToPolytech = await calculateTravelTime(polytechAdress, destination, mode);

  announce.travelTimeBikeToComedie = travelTimeBikeToComedie;
  announce.travelTimeBikeToPolytech = travelTimeBikeToPolytech;
  const apartmentInfo = getInfoFromAnnounce(announce);
  postAnnounce(apartmentInfo)
  console.log(apartmentInfo)

}

main()