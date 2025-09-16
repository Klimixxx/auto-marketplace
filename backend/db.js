// backend/db.js
// ESM-версия подключения к PostgreSQL (Neon/Render)
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // нужно для Neon/Render
});

export async function query(text, params) {
  return pool.query(text, params);
}

// Аккуратное закрытие пула при завершении процесса (опционально)
process.on('SIGTERM', async () => {
  try {
    await pool.end();
    console.log('PG pool closed gracefully');
  } catch (e) {
    console.error('Error closing PG pool', e);
  } finally {
    process.exit(0);
  }
});
