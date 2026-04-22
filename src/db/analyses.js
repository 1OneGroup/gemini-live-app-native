// CRUD for gemini_live.batch_analyses
const { execute, queryOne, queryAll, uid } = require('./index');

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

module.exports = { createAnalysis, getAnalysis, listAnalyses, approveAnalysis, rejectAnalysis, deleteAnalysis };
