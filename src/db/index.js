// PostgreSQL pool, query helpers, and DB init orchestration.
// All other src/db/* modules import pool and helpers from here.
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Set search_path on every new client so all queries target gemini_live schema
pool.on('connect', (client) => {
  client.query('SET search_path TO gemini_live, public');
});

function uid() { return crypto.randomUUID(); }

// --- Helper: single-row query ---
async function queryOne(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

// --- Helper: multi-row query ---
async function queryAll(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

// --- Helper: execute (no return) ---
async function execute(sql, params = []) {
  await pool.query(sql, params);
}

// --- Raw query helper (replaces db.db.prepare().all/run) ---
async function rawQuery(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function rawExecute(sql, params = []) {
  await pool.query(sql, params);
}

// Initialize: ensure schema + seed default prompt + migrate brochures.json
// Order preserved from original db.js: ensureSchema → seedDefaultPrompt → migrateBrochuresJson
async function init() {
  const schema = require('./schema');
  const migrations = require('./migrations');
  const prompts = require('./prompts');
  await schema.ensureSchema();
  await prompts.seedDefaultPrompt();
  await migrations.migrateBrochuresJson();
  console.log('[DB] PostgreSQL initialized (gemini_live schema)');
}

module.exports = { pool, init, uid, queryOne, queryAll, execute, rawQuery, rawExecute };

// Barrel: merge CRUD surface from sibling modules so `require('../db')`
// gives callers the same flat namespace that the old root-level db.js
// facade exposed. Loaded lazily after module.exports is populated so that
// siblings' `require('./index')` resolves to the already-assigned pool/helpers.
Object.assign(
  module.exports,
  require('./campaigns'),
  require('./contacts'),
  require('./analyses'),
  require('./prompts'),
  require('./whatsapp-messages'),
  require('./employees'),
);
