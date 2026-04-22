// Runs the bootstrap DDL from schema.sql against the pool.
// Called by init() in src/db/index.js on every startup (all statements are idempotent).
const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO gemini_live, public');
    await client.query(schemaSql);
    console.log('[DB] Schema ensured (gemini_live)');
  } finally {
    client.release();
  }
}

module.exports = { ensureSchema };
