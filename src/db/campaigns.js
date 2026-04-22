// CRUD for gemini_live.campaigns
const { execute, queryOne, queryAll, uid } = require('./index');

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

module.exports = { createCampaign, getCampaign, listCampaigns, updateCampaign, deleteCampaign };
