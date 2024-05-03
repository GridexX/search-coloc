const puppeteer = require('puppeteer');
const url = "https://wk0s85mn.r.eu-west-1.awstrack.me/L0/https:%2F%2Fwww.lacartedescolocs.fr%2Fcolocations%2Ffr%2Foccitanie%2Fmontpellier%2Fa%2Faikjmx/1/0102018f288aa6c2-1b16a968-95d5-46ab-8be8-1df26babeab1-000000/RS1o0sUi7zH52fjd0n-5nAuJKPA=371"
if (!url) {
  throw "Please provide URL as a first argument";
}
async function run() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.screenshot({ path: 'screenshot.png' });
  browser.close();
}
run();