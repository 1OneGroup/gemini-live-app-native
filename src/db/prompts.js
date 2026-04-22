// CRUD for gemini_live.prompts + seed helper
const { execute, queryOne, queryAll, uid } = require('./index');

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

// Seed default prompt if table is empty
async function seedDefaultPrompt() {
  const row = await queryOne('SELECT COUNT(*) as c FROM prompts');
  if (Number(row.c) === 0) {
    try {
      const { DEFAULT_PROMPT } = require('../../prompts');
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

module.exports = {
  createPrompt, listPrompts, getPrompt, updatePrompt, deletePrompt,
  setActivePrompt, getActivePrompt, seedDefaultPrompt,
};
