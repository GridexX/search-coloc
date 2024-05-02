const { default: axios } = require("axios");

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

module.exports = {
  calculateTravelTime
};