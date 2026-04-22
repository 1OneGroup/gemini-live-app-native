// CRUD for gemini_live.whatsapp_messages
const { execute, queryOne, queryAll, uid } = require('./index');

async function createWhatsappMessage({ name, body, attachmentUrl, isActive = false }) {
  const id = uid();
  if (isActive) await execute('UPDATE whatsapp_messages SET is_active = 0');
  await execute(
    'INSERT INTO whatsapp_messages (id, name, body, attachment_url, is_active) VALUES ($1, $2, $3, $4, $5)',
    [id, name, body, attachmentUrl || null, isActive ? 1 : 0]
  );
  return queryOne('SELECT * FROM whatsapp_messages WHERE id = $1', [id]);
}

async function listWhatsappMessages() {
  return queryAll('SELECT * FROM whatsapp_messages ORDER BY is_active DESC, updated_at DESC');
}

async function getWhatsappMessage(id) {
  return queryOne('SELECT * FROM whatsapp_messages WHERE id = $1', [id]);
}

async function updateWhatsappMessage(id, { name, body, attachmentUrl }) {
  await execute(
    `UPDATE whatsapp_messages SET
       name = COALESCE($1, name),
       body = COALESCE($2, body),
       attachment_url = $3,
       updated_at = now()
     WHERE id = $4`,
    [name || null, body || null, attachmentUrl ?? null, id]
  );
  return queryOne('SELECT * FROM whatsapp_messages WHERE id = $1', [id]);
}

async function deleteWhatsappMessage(id) {
  await execute('DELETE FROM whatsapp_messages WHERE id = $1', [id]);
}

async function setActiveWhatsappMessage(id) {
  await execute('UPDATE whatsapp_messages SET is_active = 0');
  await execute('UPDATE whatsapp_messages SET is_active = 1, updated_at = now() WHERE id = $1', [id]);
  return queryOne('SELECT * FROM whatsapp_messages WHERE id = $1', [id]);
}

async function getActiveWhatsappMessage() {
  return queryOne('SELECT * FROM whatsapp_messages WHERE is_active = 1 LIMIT 1');
}

module.exports = {
  createWhatsappMessage, listWhatsappMessages, getWhatsappMessage, updateWhatsappMessage,
  deleteWhatsappMessage, setActiveWhatsappMessage, getActiveWhatsappMessage,
};
