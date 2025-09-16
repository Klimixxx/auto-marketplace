// backend/src/services/parserClient.js
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.PARSER_BASE_URL,
  timeout: Number(process.env.PARSER_API_TIMEOUT || 30000),
});

async function parseFedresursTrades({ search_string = 'vin', start_date, end_date, limit = 15, offset = 0 }) {
  const params = { search_string, start_date, end_date, limit, offset };
  const { data } = await client.get('/parse-fedresurs-trades', { params });
  return data; // предполагается массив объектов с parsed_data/fedresurs_data
}

module.exports = { parseFedresursTrades };
