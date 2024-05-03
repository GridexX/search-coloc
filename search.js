const url = 'https://wk0s85mn.r.eu-west-1.awstrack.me/L0/https:%2F%2Fwww.lacartedescolocs.fr%2Flogements%2Ffr%2Foccitanie%2Fmontpellier%2Fa%2Ffdh1zj/1/0102018f288aa6c2-1b16a968-95d5-46ab-8be8-1df26babeab1-000000/8YBisMrNqHUTdcR0_i6CE7FZ_ec=371';

// Parse the URL
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

const shortendUrl = `https://lcrt.fr/${apartmentNumberMatch[0]}`

console.log(shortendUrl);
