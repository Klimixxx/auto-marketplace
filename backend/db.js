import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // для Neon/Render
});

export async function query(text, params) {
  return pool.query(text, params);
}

