// SQLite database layer for campaigns, contacts, and batch analyses
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(process.env.DATA_DIR || '/data', 'campaigns.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    prompt_override TEXT,
    batch_size INTEGER DEFAULT 100,
    max_concurrent INTEGER DEFAULT 1,
    total_contacts INTEGER DEFAULT 0,
    completed_contacts INTEGER DEFAULT 0,
    current_batch INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    phone TEXT NOT NULL,
    name TEXT,
    metadata TEXT,
    batch_number INTEGER,
    status TEXT DEFAULT 'pending',
    call_uuid TEXT,
    outcome TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_contacts_campaign ON contacts(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_contacts_batch ON contacts(campaign_id, batch_number);
  CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(campaign_id, status);

  CREATE TABLE IF NOT EXISTS batch_analyses (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    batch_number INTEGER NOT NULL,
    summary TEXT,
    recommendations TEXT,
    prompt_adjustments TEXT,
    stats TEXT,
    approved INTEGER DEFAULT 0,
    approved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_batch_campaign ON batch_analyses(campaign_id, batch_number);

  CREATE TABLE IF NOT EXISTS employee_instances (
    id TEXT PRIMARY KEY,
    employee_name TEXT NOT NULL UNIQUE,
    instance_name TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migration: add employee_name to contacts if missing
try {
  db.exec('ALTER TABLE contacts ADD COLUMN employee_name TEXT');
} catch (e) { /* column already exists */ }

// Migration: add callback tracking columns
try {
  db.exec('ALTER TABLE contacts ADD COLUMN callback_date TEXT');
} catch (e) { /* column already exists */ }
try {
  db.exec('ALTER TABLE contacts ADD COLUMN callback_note TEXT');
} catch (e) { /* column already exists */ }

// Migration: add whatsapp_message_key to campaigns
try {
  db.exec('ALTER TABLE campaigns ADD COLUMN whatsapp_message_key TEXT');
} catch (e) { /* column already exists */ }

// Migration: add auto_callback flag to campaigns
try {
  db.exec('ALTER TABLE campaigns ADD COLUMN auto_callback INTEGER DEFAULT 0');
} catch (e) { /* column already exists */ }

// Migration: add prompt_id to batch_analyses for per-batch prompt tracking
try {
  db.exec('ALTER TABLE batch_analyses ADD COLUMN prompt_id TEXT');
} catch (e) { /* column already exists */ }

// Migration: add AI classification fields to contacts
try {
  db.exec('ALTER TABLE contacts ADD COLUMN lead_temperature TEXT');
} catch (e) { /* column already exists */ }
try {
  db.exec('ALTER TABLE contacts ADD COLUMN follow_up_action TEXT');
} catch (e) { /* column already exists */ }
try {
  db.exec('ALTER TABLE contacts ADD COLUMN conversation_summary TEXT');
} catch (e) { /* column already exists */ }
try {
  db.exec('ALTER TABLE contacts ADD COLUMN whatsapp_followup_sent INTEGER DEFAULT 0');
} catch (e) { /* column already exists */ }
try {
  db.exec('ALTER TABLE contacts ADD COLUMN classification_confidence REAL');
} catch (e) { /* column already exists */ }

function uid() { return crypto.randomUUID(); }

// --- Campaigns ---
const stmts = {
  createCampaign: db.prepare(`
    INSERT INTO campaigns (id, name, status, prompt_override, batch_size, max_concurrent, whatsapp_message_key)
    VALUES (?, ?, 'draft', ?, ?, ?, ?)
  `),
  getCampaign: db.prepare('SELECT * FROM campaigns WHERE id = ?'),
  listCampaigns: db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC'),
  updateCampaign: db.prepare(`
    UPDATE campaigns SET name = COALESCE(?, name), status = COALESCE(?, status),
    prompt_override = COALESCE(?, prompt_override), batch_size = COALESCE(?, batch_size),
    max_concurrent = COALESCE(?, max_concurrent), total_contacts = COALESCE(?, total_contacts),
    completed_contacts = COALESCE(?, completed_contacts), current_batch = COALESCE(?, current_batch),
    updated_at = datetime('now') WHERE id = ?
  `),
  deleteCampaign: db.prepare('DELETE FROM campaigns WHERE id = ?'),

  // Contacts
  insertContact: db.prepare(`
    INSERT INTO contacts (id, campaign_id, phone, name, metadata, batch_number, employee_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getContactsByCampaign: db.prepare('SELECT * FROM contacts WHERE campaign_id = ? ORDER BY batch_number, rowid'),
  getContactsByBatch: db.prepare('SELECT * FROM contacts WHERE campaign_id = ? AND batch_number = ? ORDER BY rowid'),
  getContactStats: db.prepare(`
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
    FROM contacts WHERE campaign_id = ?
  `),
  getBatchStats: db.prepare(`
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
    FROM contacts WHERE campaign_id = ? AND batch_number = ?
  `),
  updateContact: db.prepare(`
    UPDATE contacts SET status = COALESCE(?, status), call_uuid = COALESCE(?, call_uuid),
    outcome = COALESCE(?, outcome), callback_date = COALESCE(?, callback_date),
    callback_note = COALESCE(?, callback_note) WHERE id = ?
  `),
  getNextPendingContact: db.prepare(`
    SELECT * FROM contacts WHERE campaign_id = ? AND batch_number = ? AND status = 'pending'
    ORDER BY rowid LIMIT 1
  `),
  countBatches: db.prepare('SELECT MAX(batch_number) as max_batch FROM contacts WHERE campaign_id = ?'),
  deleteContactsByCampaign: db.prepare('DELETE FROM contacts WHERE campaign_id = ?'),

  // Batch analyses
  createAnalysis: db.prepare(`
    INSERT INTO batch_analyses (id, campaign_id, batch_number, summary, recommendations, prompt_adjustments, stats, prompt_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getAnalysis: db.prepare('SELECT * FROM batch_analyses WHERE campaign_id = ? AND batch_number = ?'),
  listAnalyses: db.prepare('SELECT * FROM batch_analyses WHERE campaign_id = ? ORDER BY batch_number'),
  approveAnalysis: db.prepare(`
    UPDATE batch_analyses SET approved = 1, approved_at = datetime('now')
    WHERE campaign_id = ? AND batch_number = ?
  `),
  rejectAnalysis: db.prepare(`
    UPDATE batch_analyses SET approved = 2, approved_at = datetime('now')
    WHERE campaign_id = ? AND batch_number = ?
  `),
};

// --- Public API ---

function createCampaign({ name, promptOverride, batchSize = 100, maxConcurrent = 1, whatsappMessageKey = null }) {
  const id = uid();
  stmts.createCampaign.run(id, name, promptOverride || null, batchSize, maxConcurrent, whatsappMessageKey || null);
  return stmts.getCampaign.get(id);
}

function getCampaign(id) {
  return stmts.getCampaign.get(id);
}

function listCampaigns() {
  return stmts.listCampaigns.all();
}

function updateCampaign(id, updates) {
  stmts.updateCampaign.run(
    updates.name || null, updates.status || null, updates.promptOverride || null,
    updates.batchSize || null, updates.maxConcurrent || null,
    updates.totalContacts ?? null, updates.completedContacts ?? null,
    updates.currentBatch ?? null, id
  );
  return stmts.getCampaign.get(id);
}

function deleteCampaign(id) {
  db.prepare('DELETE FROM batch_analyses WHERE campaign_id = ?').run(id);
  stmts.deleteContactsByCampaign.run(id);
  stmts.deleteCampaign.run(id);
}

// Bulk insert contacts from parsed CSV, auto-assign batch numbers
const insertContacts = db.transaction((campaignId, contacts, batchSize) => {
  let batchNum = 1;
  for (let i = 0; i < contacts.length; i++) {
    if (i > 0 && i % batchSize === 0) batchNum++;
    const c = contacts[i];
    stmts.insertContact.run(uid(), campaignId, c.phone, c.name || null, c.metadata ? JSON.stringify(c.metadata) : null, batchNum, c.employeeName || null);
  }
  stmts.updateCampaign.run(null, null, null, null, null, contacts.length, null, null, campaignId);
});

function getContacts(campaignId, { batchNumber, status, outcome, limit = 100, offset = 0 } = {}) {
  let query = 'SELECT * FROM contacts WHERE campaign_id = ?';
  const params = [campaignId];
  if (batchNumber) { query += ' AND batch_number = ?'; params.push(batchNumber); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (outcome) { query += ' AND outcome = ?'; params.push(outcome); }
  query += ' ORDER BY batch_number, rowid LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return db.prepare(query).all(...params);
}

function getContactStats(campaignId) {
  return stmts.getContactStats.get(campaignId);
}

function getBatchStats(campaignId, batchNumber) {
  return stmts.getBatchStats.get(campaignId, batchNumber);
}

function updateContact(id, { status, callUuid, outcome, callbackDate, callbackNote }) {
  stmts.updateContact.run(status || null, callUuid || null, outcome || null, callbackDate || null, callbackNote || null, id);
}

function updateContactClassification(id, classification) {
  db.prepare(`
    UPDATE contacts SET
      outcome = ?, lead_temperature = ?, follow_up_action = ?,
      conversation_summary = ?, classification_confidence = ?
    WHERE id = ?
  `).run(
    classification.outcome || null,
    classification.lead_temperature || null,
    classification.follow_up_action || null,
    classification.conversation_summary || null,
    classification.confidence || null,
    id
  );
}

function markWhatsappFollowupSent(id) {
  db.prepare('UPDATE contacts SET whatsapp_followup_sent = 1 WHERE id = ?').run(id);
}

function getContactsByFollowUpAction(action, onlySent = false) {
  const sentClause = onlySent ? 'AND whatsapp_followup_sent = 1' : 'AND whatsapp_followup_sent = 0';
  return db.prepare(`SELECT * FROM contacts WHERE follow_up_action = ? ${sentClause} ORDER BY created_at DESC`).all(action);
}

function getHotWarmLeadsForWhatsapp() {
  return db.prepare(`
    SELECT c.*, cam.whatsapp_message_key FROM contacts c
    JOIN campaigns cam ON c.campaign_id = cam.id
    WHERE c.whatsapp_followup_sent = 0
    AND c.lead_temperature IN ('hot', 'warm')
    AND c.follow_up_action IN ('assign_sales_team', 'send_whatsapp_brochure', 'send_whatsapp_followup', 'schedule_callback')
    AND c.call_uuid IS NOT NULL
    ORDER BY
      CASE c.lead_temperature WHEN 'hot' THEN 1 WHEN 'warm' THEN 2 ELSE 3 END,
      c.created_at DESC
  `).all();
}

function deleteAnalysis(campaignId, batchNumber) {
  db.prepare('DELETE FROM batch_analyses WHERE campaign_id = ? AND batch_number = ?').run(campaignId, batchNumber);
}

function getCallbackContacts(campaignId) {
  let query = 'SELECT * FROM contacts WHERE outcome LIKE \'%callback%\'';
  const params = [];
  if (campaignId) { query += ' AND campaign_id = ?'; params.push(campaignId); }
  query += ' ORDER BY callback_date ASC, created_at DESC';
  return db.prepare(query).all(...params);
}

function getNextPendingContact(campaignId, batchNumber) {
  return stmts.getNextPendingContact.get(campaignId, batchNumber);
}

function getMaxBatch(campaignId) {
  const row = stmts.countBatches.get(campaignId);
  return row?.max_batch || 0;
}

function createAnalysis(campaignId, batchNumber, { summary, recommendations, promptAdjustments, stats, promptId }) {
  const id = uid();
  stmts.createAnalysis.run(id, campaignId, batchNumber, summary, recommendations, promptAdjustments, JSON.stringify(stats), promptId || null);
  return stmts.getAnalysis.get(campaignId, batchNumber);
}

function getAnalysis(campaignId, batchNumber) {
  return stmts.getAnalysis.get(campaignId, batchNumber);
}

function listAnalyses(campaignId) {
  return stmts.listAnalyses.all(campaignId);
}

function approveAnalysis(campaignId, batchNumber) {
  stmts.approveAnalysis.run(campaignId, batchNumber);
  return stmts.getAnalysis.get(campaignId, batchNumber);
}

function rejectAnalysis(campaignId, batchNumber) {
  stmts.rejectAnalysis.run(campaignId, batchNumber);
  return stmts.getAnalysis.get(campaignId, batchNumber);
}

// --- Named Prompts ---
const promptStmts = {
  create: db.prepare('INSERT INTO prompts (id, name, body, is_active) VALUES (?, ?, ?, ?)'),
  get: db.prepare('SELECT * FROM prompts WHERE id = ?'),
  list: db.prepare('SELECT * FROM prompts ORDER BY is_active DESC, updated_at DESC'),
  update: db.prepare('UPDATE prompts SET name = COALESCE(?, name), body = COALESCE(?, body), updated_at = datetime(\'now\') WHERE id = ?'),
  delete: db.prepare('DELETE FROM prompts WHERE id = ?'),
  clearActive: db.prepare('UPDATE prompts SET is_active = 0'),
  setActive: db.prepare('UPDATE prompts SET is_active = 1, updated_at = datetime(\'now\') WHERE id = ?'),
  getActive: db.prepare('SELECT * FROM prompts WHERE is_active = 1 LIMIT 1'),
};

function createPrompt({ name, body, isActive = false }) {
  const id = uid();
  if (isActive) promptStmts.clearActive.run();
  promptStmts.create.run(id, name, body, isActive ? 1 : 0);
  return promptStmts.get.get(id);
}

function listPrompts() { return promptStmts.list.all(); }
function getPrompt(id) { return promptStmts.get.get(id); }

function updatePrompt(id, { name, body }) {
  promptStmts.update.run(name || null, body || null, id);
  return promptStmts.get.get(id);
}

function deletePrompt(id) { promptStmts.delete.run(id); }

function setActivePrompt(id) {
  promptStmts.clearActive.run();
  promptStmts.setActive.run(id);
  return promptStmts.get.get(id);
}

function getActivePrompt() { return promptStmts.getActive.get(); }

// --- Employee WhatsApp Instances ---
const empStmts = {
  create: db.prepare('INSERT OR REPLACE INTO employee_instances (id, employee_name, instance_name, phone, status) VALUES (?, ?, ?, ?, ?)'),
  get: db.prepare('SELECT * FROM employee_instances WHERE id = ?'),
  getByName: db.prepare('SELECT * FROM employee_instances WHERE employee_name = ? COLLATE NOCASE'),
  getByInstance: db.prepare('SELECT * FROM employee_instances WHERE instance_name = ?'),
  list: db.prepare('SELECT * FROM employee_instances ORDER BY employee_name'),
  update: db.prepare('UPDATE employee_instances SET employee_name = COALESCE(?, employee_name), instance_name = COALESCE(?, instance_name), phone = COALESCE(?, phone), status = COALESCE(?, status), updated_at = datetime(\'now\') WHERE id = ?'),
  delete: db.prepare('DELETE FROM employee_instances WHERE id = ?'),
};

function createEmployeeInstance({ employeeName, instanceName, phone, status }) {
  const existing = empStmts.getByName.get(employeeName);
  const id = existing?.id || uid();
  empStmts.create.run(id, employeeName, instanceName, phone || null, status || 'pending');
  return empStmts.get.get(id);
}

function listEmployeeInstances() { return empStmts.list.all(); }
function getEmployeeInstance(id) { return empStmts.get.get(id); }
function getEmployeeByName(name) { return empStmts.getByName.get(name); }

function updateEmployeeInstance(id, { employeeName, instanceName, phone, status }) {
  empStmts.update.run(employeeName || null, instanceName || null, phone || null, status || null, id);
  return empStmts.get.get(id);
}

function deleteEmployeeInstance(id) { empStmts.delete.run(id); }

// Get unique employee names across all campaign contacts
function getUniqueEmployeeNames() {
  return db.prepare(`
    SELECT DISTINCT employee_name FROM contacts
    WHERE employee_name IS NOT NULL AND employee_name != ''
    ORDER BY employee_name
  `).all().map(r => r.employee_name);
}

// Seed default prompt if table is empty
function seedDefaultPrompt() {
  const count = db.prepare('SELECT COUNT(*) as c FROM prompts').get().c;
  if (count === 0) {
    try {
      const { DEFAULT_PROMPT } = require('./prompts');
      if (DEFAULT_PROMPT) {
        const id = uid();
        promptStmts.create.run(id, 'Clermont Cold Call — Standard', DEFAULT_PROMPT, 1);
        console.log('[DB] Seeded default Clermont prompt as active');
      }
    } catch (err) {
      console.error('[DB] Failed to seed default prompt:', err.message);
    }
  }
}
seedDefaultPrompt();

module.exports = {
  createCampaign, getCampaign, listCampaigns, updateCampaign, deleteCampaign,
  insertContacts, getContacts, getContactStats, getBatchStats, updateContact,
  updateContactClassification, markWhatsappFollowupSent, getContactsByFollowUpAction, getHotWarmLeadsForWhatsapp,
  getNextPendingContact, getMaxBatch, getCallbackContacts,
  createAnalysis, getAnalysis, listAnalyses, approveAnalysis, rejectAnalysis, deleteAnalysis,
  createPrompt, listPrompts, getPrompt, updatePrompt, deletePrompt, setActivePrompt, getActivePrompt,
  createEmployeeInstance, listEmployeeInstances, getEmployeeInstance, getEmployeeByName, updateEmployeeInstance, deleteEmployeeInstance, getUniqueEmployeeNames,
  db,
};
