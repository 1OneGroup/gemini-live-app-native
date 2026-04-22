// CRUD for gemini_live.contacts
const { pool, execute, queryOne, queryAll, uid } = require('./index');

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

async function getContactByCallUuid(callUuid) {
  return queryOne('SELECT * FROM contacts WHERE call_uuid = $1', [callUuid]);
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

module.exports = {
  insertContacts, getContacts, getContactStats, getBatchStats, getContactByCallUuid,
  updateContact, getCallbackContacts, getNextPendingContact, getMaxBatch,
};
