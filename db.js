// PostgreSQL database layer for campaigns, contacts, and batch analyses
// Connects to Supabase PostgreSQL using the gemini_live schema
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

// --- Schema bootstrap (idempotent) ---
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO gemini_live, public');
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS gemini_live;

      CREATE TABLE IF NOT EXISTS gemini_live.campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        prompt_override TEXT,
        batch_size INTEGER DEFAULT 100,
        max_concurrent INTEGER DEFAULT 1,
        total_contacts INTEGER DEFAULT 0,
        completed_contacts INTEGER DEFAULT 0,
        current_batch INTEGER DEFAULT 0,
        whatsapp_message_key TEXT,
        auto_callback INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS gemini_live.contacts (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES gemini_live.campaigns(id),
        phone TEXT NOT NULL,
        name TEXT,
        metadata TEXT,
        batch_number INTEGER,
        status TEXT DEFAULT 'pending',
        call_uuid TEXT,
        outcome TEXT,
        employee_name TEXT,
        callback_date TEXT,
        callback_note TEXT,
        intent TEXT,
        interest_score INTEGER,
        objections TEXT,
        one_line_summary TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS intent TEXT;
      ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS interest_score INTEGER;
      ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS objections TEXT;
      ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS one_line_summary TEXT;

      CREATE INDEX IF NOT EXISTS idx_gl_contacts_campaign ON gemini_live.contacts(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_gl_contacts_batch ON gemini_live.contacts(campaign_id, batch_number);
      CREATE INDEX IF NOT EXISTS idx_gl_contacts_status ON gemini_live.contacts(campaign_id, status);
      CREATE INDEX IF NOT EXISTS idx_gl_contacts_call_uuid ON gemini_live.contacts(call_uuid);

      CREATE TABLE IF NOT EXISTS gemini_live.batch_analyses (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES gemini_live.campaigns(id),
        batch_number INTEGER NOT NULL,
        summary TEXT,
        recommendations TEXT,
        prompt_adjustments TEXT,
        stats TEXT,
        prompt_id TEXT,
        approved INTEGER DEFAULT 0,
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_gl_batch_campaign ON gemini_live.batch_analyses(campaign_id, batch_number);

      CREATE TABLE IF NOT EXISTS gemini_live.employee_instances (
        id TEXT PRIMARY KEY,
        employee_name TEXT NOT NULL UNIQUE,
        instance_name TEXT NOT NULL,
        phone TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS gemini_live.prompts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('[DB] Schema ensured (gemini_live)');
  } finally {
    client.release();
  }
}

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

// --- Campaigns ---

async function createCampaign({ name, promptOverride, batchSize = 100, maxConcurrent = 1, whatsappMessageKey = null }) {
  const id = uid();
  await execute(
    `INSERT INTO campaigns (id, name, status, prompt_override, batch_size, max_concurrent, whatsapp_message_key)
     VALUES ($1, $2, 'draft', $3, $4, $5, $6)`,
    [id, name, promptOverride || null, batchSize, maxConcurrent, whatsappMessageKey || null]
  );
  return queryOne('SELECT * FROM campaigns WHERE id = $1', [id]);
}

async function getCampaign(id) {
  return queryOne('SELECT * FROM campaigns WHERE id = $1', [id]);
}

async function listCampaigns() {
  return queryAll('SELECT * FROM campaigns ORDER BY created_at DESC');
}

async function updateCampaign(id, updates) {
  await execute(
    `UPDATE campaigns SET
      name = COALESCE($1, name), status = COALESCE($2, status),
      prompt_override = COALESCE($3, prompt_override), batch_size = COALESCE($4, batch_size),
      max_concurrent = COALESCE($5, max_concurrent), total_contacts = COALESCE($6, total_contacts),
      completed_contacts = COALESCE($7, completed_contacts), current_batch = COALESCE($8, current_batch),
      updated_at = now() WHERE id = $9`,
    [
      updates.name || null, updates.status || null, updates.promptOverride || null,
      updates.batchSize || null, updates.maxConcurrent || null,
      updates.totalContacts ?? null, updates.completedContacts ?? null,
      updates.currentBatch ?? null, id
    ]
  );
  return queryOne('SELECT * FROM campaigns WHERE id = $1', [id]);
}

async function deleteCampaign(id) {
  await execute('DELETE FROM batch_analyses WHERE campaign_id = $1', [id]);
  await execute('DELETE FROM contacts WHERE campaign_id = $1', [id]);
  await execute('DELETE FROM campaigns WHERE id = $1', [id]);
}

// Bulk insert contacts from parsed CSV, auto-assign batch numbers
async function insertContacts(campaignId, contacts, batchSize) {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO gemini_live, public');
    await client.query('BEGIN');
    let batchNum = 1;
    for (let i = 0; i < contacts.length; i++) {
      if (i > 0 && i % batchSize === 0) batchNum++;
      const c = contacts[i];
      await client.query(
        `INSERT INTO contacts (id, campaign_id, phone, name, metadata, batch_number, employee_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uid(), campaignId, c.phone, c.name || null, c.metadata ? JSON.stringify(c.metadata) : null, batchNum, c.employeeName || null]
      );
    }
    await client.query(
      `UPDATE campaigns SET total_contacts = COALESCE($1, total_contacts), updated_at = now() WHERE id = $2`,
      [contacts.length, campaignId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getContacts(campaignId, { batchNumber, status, outcome, limit = 100, offset = 0 } = {}) {
  let query = 'SELECT * FROM contacts WHERE campaign_id = $1';
  const params = [campaignId];
  let paramIdx = 2;
  if (batchNumber) { query += ` AND batch_number = $${paramIdx++}`; params.push(batchNumber); }
  if (status) { query += ` AND status = $${paramIdx++}`; params.push(status); }
  if (outcome) { query += ` AND outcome = $${paramIdx++}`; params.push(outcome); }
  query += ` ORDER BY batch_number, created_at LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(limit, offset);
  return queryAll(query, params);
}

async function getContactStats(campaignId) {
  const row = await queryOne(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'calling' THEN 1 ELSE 0 END) as calling,
      SUM(CASE WHEN outcome LIKE '%interested%' AND outcome NOT LIKE '%not_interested%' THEN 1 ELSE 0 END) as interested,
      SUM(CASE WHEN outcome LIKE '%not_interested%' THEN 1 ELSE 0 END) as not_interested,
      SUM(CASE WHEN outcome LIKE '%callback%' THEN 1 ELSE 0 END) as callback,
      SUM(CASE WHEN outcome LIKE '%no_answer%' THEN 1 ELSE 0 END) as no_answer,
      SUM(CASE WHEN outcome LIKE '%busy%' THEN 1 ELSE 0 END) as busy,
      SUM(CASE WHEN outcome LIKE '%brochure_sent%' THEN 1 ELSE 0 END) as brochure_sent,
      SUM(CASE WHEN outcome LIKE '%voicemail%' THEN 1 ELSE 0 END) as voicemail
    FROM contacts WHERE campaign_id = $1
  `, [campaignId]);
  // Convert bigint strings to numbers
  if (row) {
    for (const key of Object.keys(row)) {
      row[key] = Number(row[key]) || 0;
    }
  }
  return row || { total: 0, completed: 0, failed: 0, pending: 0, calling: 0, interested: 0, not_interested: 0, callback: 0, no_answer: 0, busy: 0, brochure_sent: 0, voicemail: 0 };
}

async function getBatchStats(campaignId, batchNumber) {
  const row = await queryOne(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN outcome LIKE '%interested%' AND outcome NOT LIKE '%not_interested%' THEN 1 ELSE 0 END) as interested,
      SUM(CASE WHEN outcome LIKE '%not_interested%' THEN 1 ELSE 0 END) as not_interested,
      SUM(CASE WHEN outcome LIKE '%callback%' THEN 1 ELSE 0 END) as callback,
      SUM(CASE WHEN outcome LIKE '%no_answer%' THEN 1 ELSE 0 END) as no_answer,
      SUM(CASE WHEN outcome LIKE '%busy%' THEN 1 ELSE 0 END) as busy,
      SUM(CASE WHEN outcome LIKE '%brochure_sent%' THEN 1 ELSE 0 END) as brochure_sent,
      SUM(CASE WHEN outcome LIKE '%voicemail%' THEN 1 ELSE 0 END) as voicemail
    FROM contacts WHERE campaign_id = $1 AND batch_number = $2
  `, [campaignId, batchNumber]);
  if (row) {
    for (const key of Object.keys(row)) {
      row[key] = Number(row[key]) || 0;
    }
  }
  return row || { total: 0, completed: 0, failed: 0, interested: 0, not_interested: 0, callback: 0, no_answer: 0, busy: 0, brochure_sent: 0, voicemail: 0 };
}

async function updateContact(id, { status, callUuid, outcome, callbackDate, callbackNote, intent, interestScore, objections, oneLineSummary }) {
  await execute(
    `UPDATE contacts SET
      status = COALESCE($1, status), call_uuid = COALESCE($2, call_uuid),
      outcome = COALESCE($3, outcome), callback_date = COALESCE($4, callback_date),
      callback_note = COALESCE($5, callback_note),
      intent = COALESCE($6, intent), interest_score = COALESCE($7, interest_score),
      objections = COALESCE($8, objections), one_line_summary = COALESCE($9, one_line_summary)
     WHERE id = $10`,
    [status || null, callUuid || null, outcome || null, callbackDate || null, callbackNote || null,
     intent || null, interestScore ?? null, objections || null, oneLineSummary || null, id]
  );
}

async function getCallbackContacts(campaignId) {
  let query = "SELECT * FROM contacts WHERE outcome LIKE '%callback%'";
  const params = [];
  if (campaignId) { query += ' AND campaign_id = $1'; params.push(campaignId); }
  query += ' ORDER BY callback_date ASC, created_at DESC';
  return queryAll(query, params);
}

async function getNextPendingContact(campaignId, batchNumber) {
  return queryOne(
    `SELECT * FROM contacts WHERE campaign_id = $1 AND batch_number = $2 AND status = 'pending'
     ORDER BY created_at LIMIT 1`,
    [campaignId, batchNumber]
  );
}

async function getMaxBatch(campaignId) {
  const row = await queryOne('SELECT MAX(batch_number) as max_batch FROM contacts WHERE campaign_id = $1', [campaignId]);
  return row?.max_batch || 0;
}

// --- Batch Analyses ---

async function createAnalysis(campaignId, batchNumber, { summary, recommendations, promptAdjustments, stats, promptId }) {
  const id = uid();
  await execute(
    `INSERT INTO batch_analyses (id, campaign_id, batch_number, summary, recommendations, prompt_adjustments, stats, prompt_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, campaignId, batchNumber, summary, recommendations, promptAdjustments, JSON.stringify(stats), promptId || null]
  );
  return queryOne('SELECT * FROM batch_analyses WHERE campaign_id = $1 AND batch_number = $2', [campaignId, batchNumber]);
}

async function getAnalysis(campaignId, batchNumber) {
  return queryOne('SELECT * FROM batch_analyses WHERE campaign_id = $1 AND batch_number = $2', [campaignId, batchNumber]);
}

async function listAnalyses(campaignId) {
  return queryAll('SELECT * FROM batch_analyses WHERE campaign_id = $1 ORDER BY batch_number', [campaignId]);
}

async function approveAnalysis(campaignId, batchNumber) {
  await execute(
    `UPDATE batch_analyses SET approved = 1, approved_at = now()
     WHERE campaign_id = $1 AND batch_number = $2`,
    [campaignId, batchNumber]
  );
  return queryOne('SELECT * FROM batch_analyses WHERE campaign_id = $1 AND batch_number = $2', [campaignId, batchNumber]);
}

async function rejectAnalysis(campaignId, batchNumber) {
  await execute(
    `UPDATE batch_analyses SET approved = 2, approved_at = now()
     WHERE campaign_id = $1 AND batch_number = $2`,
    [campaignId, batchNumber]
  );
  return queryOne('SELECT * FROM batch_analyses WHERE campaign_id = $1 AND batch_number = $2', [campaignId, batchNumber]);
}

async function deleteAnalysis(campaignId, batchNumber) {
  await execute('DELETE FROM batch_analyses WHERE campaign_id = $1 AND batch_number = $2', [campaignId, batchNumber]);
}

// --- Named Prompts ---

async function createPrompt({ name, body, isActive = false }) {
  const id = uid();
  if (isActive) await execute('UPDATE prompts SET is_active = 0');
  await execute(
    'INSERT INTO prompts (id, name, body, is_active) VALUES ($1, $2, $3, $4)',
    [id, name, body, isActive ? 1 : 0]
  );
  return queryOne('SELECT * FROM prompts WHERE id = $1', [id]);
}

async function listPrompts() {
  return queryAll('SELECT * FROM prompts ORDER BY is_active DESC, updated_at DESC');
}

async function getPrompt(id) {
  return queryOne('SELECT * FROM prompts WHERE id = $1', [id]);
}

async function updatePrompt(id, { name, body }) {
  await execute(
    "UPDATE prompts SET name = COALESCE($1, name), body = COALESCE($2, body), updated_at = now() WHERE id = $3",
    [name || null, body || null, id]
  );
  return queryOne('SELECT * FROM prompts WHERE id = $1', [id]);
}

async function deletePrompt(id) {
  await execute('DELETE FROM prompts WHERE id = $1', [id]);
}

async function setActivePrompt(id) {
  await execute('UPDATE prompts SET is_active = 0');
  await execute("UPDATE prompts SET is_active = 1, updated_at = now() WHERE id = $1", [id]);
  return queryOne('SELECT * FROM prompts WHERE id = $1', [id]);
}

async function getActivePrompt() {
  return queryOne('SELECT * FROM prompts WHERE is_active = 1 LIMIT 1');
}

// --- Employee WhatsApp Instances ---

async function createEmployeeInstance({ employeeName, instanceName, phone, status }) {
  const existing = await queryOne('SELECT * FROM employee_instances WHERE employee_name = $1', [employeeName]);
  const id = existing?.id || uid();
  await execute(
    `INSERT INTO employee_instances (id, employee_name, instance_name, phone, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET employee_name = $2, instance_name = $3, phone = $4, status = $5, updated_at = now()`,
    [id, employeeName, instanceName, phone || null, status || 'pending']
  );
  return queryOne('SELECT * FROM employee_instances WHERE id = $1', [id]);
}

async function listEmployeeInstances() {
  return queryAll('SELECT * FROM employee_instances ORDER BY employee_name');
}

async function getEmployeeInstance(id) {
  return queryOne('SELECT * FROM employee_instances WHERE id = $1', [id]);
}

async function getEmployeeByName(name) {
  return queryOne('SELECT * FROM employee_instances WHERE employee_name = $1', [name]);
}

async function updateEmployeeInstance(id, { employeeName, instanceName, phone, status }) {
  await execute(
    `UPDATE employee_instances SET
      employee_name = COALESCE($1, employee_name), instance_name = COALESCE($2, instance_name),
      phone = COALESCE($3, phone), status = COALESCE($4, status), updated_at = now()
     WHERE id = $5`,
    [employeeName || null, instanceName || null, phone || null, status || null, id]
  );
  return queryOne('SELECT * FROM employee_instances WHERE id = $1', [id]);
}

async function deleteEmployeeInstance(id) {
  await execute('DELETE FROM employee_instances WHERE id = $1', [id]);
}

async function getUniqueEmployeeNames() {
  const rows = await queryAll(`
    SELECT DISTINCT employee_name FROM contacts
    WHERE employee_name IS NOT NULL AND employee_name != ''
    ORDER BY employee_name
  `);
  return rows.map(r => r.employee_name);
}

// Seed default prompt if table is empty
async function seedDefaultPrompt() {
  const row = await queryOne('SELECT COUNT(*) as c FROM prompts');
  if (Number(row.c) === 0) {
    try {
      const { DEFAULT_PROMPT } = require('./prompts');
      if (DEFAULT_PROMPT) {
        const id = uid();
        await execute(
          'INSERT INTO prompts (id, name, body, is_active) VALUES ($1, $2, $3, 1)',
          [id, 'Clermont Cold Call — Standard', DEFAULT_PROMPT]
        );
        console.log('[DB] Seeded default Clermont prompt as active');
      }
    } catch (err) {
      console.error('[DB] Failed to seed default prompt:', err.message);
    }
  }
}

// Initialize: ensure schema + seed
async function init() {
  await ensureSchema();
  await seedDefaultPrompt();
  console.log('[DB] PostgreSQL initialized (gemini_live schema)');
}

module.exports = {
  init, pool,
  rawQuery, rawExecute,
  createCampaign, getCampaign, listCampaigns, updateCampaign, deleteCampaign,
  insertContacts, getContacts, getContactStats, getBatchStats, updateContact,
  getNextPendingContact, getMaxBatch, getCallbackContacts,
  createAnalysis, getAnalysis, listAnalyses, approveAnalysis, rejectAnalysis, deleteAnalysis,
  createPrompt, listPrompts, getPrompt, updatePrompt, deletePrompt, setActivePrompt, getActivePrompt,
  createEmployeeInstance, listEmployeeInstances, getEmployeeInstance, getEmployeeByName, updateEmployeeInstance, deleteEmployeeInstance, getUniqueEmployeeNames,
};
