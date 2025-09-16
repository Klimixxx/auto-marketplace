// backend/src/db.js
// Подключение к PostgreSQL (Neon/Render)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // для Neon/Render
});

// Универсальный helper для запросов
async function query(text, params) {
  return pool.query(text, params);
}

// Аккуратное завершение соединений при стопе процесса (опционально)
process.on('SIGTERM', async () => {
  try {
    await pool.end();
    // eslint-disable-next-line no-console
    console.log('PG pool closed gracefully');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Error closing PG pool', e);
  } finally {
    process.exit(0);
  }
});

module.exports = { pool, query };
