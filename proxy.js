const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const express = require('express');


const app = express();
const port = 3000;
app.use(cors({ origin: true }));
app.use(express.json());



app.use(cors());
app.use(
  '/',
  createProxyMiddleware({
    target: 'https://www.lacartedescolocs.fr/logements/fr/occitanie/montpellier/a/fdh1zj',
    logLevel: 'debug',
    changeOrigin: true,
  }),
);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});