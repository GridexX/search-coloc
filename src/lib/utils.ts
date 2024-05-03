import {readFile} from 'fs/promises';
import {Mode} from './types';
import path = require('path');

const {default: axios} = require('axios');

export async function calculateBikeTravelTime(street: string) {
  const comedieAdress = 'Place de la Comedie, Montpellier, France';
  const polytechAdress = 'Place Eugene Bataillon, Montpellier, France';
  const destination = `${street}, Montpellier, France`;
  const mode: Mode = 'bicycling';

  const travelTimeBikeToComedie = await calculateTravelTime(
    comedieAdress,
    destination,
    mode
  );
  const travelTimeBikeToPolytech = await calculateTravelTime(
    polytechAdress,
    destination,
    mode
  );

  return {travelTimeBikeToComedie, travelTimeBikeToPolytech};
}

export async function calculateTravelTime(
  origin: string,
  destination: string,
  mode: Mode
) {
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

export function getFormattedDate(date: Date) {
  return date
    .toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/\//g, '-');
}
