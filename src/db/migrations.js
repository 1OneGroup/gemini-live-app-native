// One-time data migrations run at startup after schema bootstrap.
// Currently: migrate brochures.json → whatsapp_messages table.
const { execute, queryOne, uid } = require('./index');

// Migrate brochures.json → whatsapp_messages table (one-time, on first boot of new version)
async function migrateBrochuresJson() {
  const row = await queryOne('SELECT COUNT(*) as c FROM whatsapp_messages');
  if (Number(row.c) > 0) return;
  try {
    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(process.env.DATA_DIR || '/data', 'brochures.json');
    if (!fs.existsSync(jsonPath)) return;
    const entries = Object.entries(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
    if (entries.length === 0) return;
    let first = true;
    for (const [, b] of entries) {
      const id = uid();
      await execute(
        'INSERT INTO whatsapp_messages (id, name, body, attachment_url, is_active) VALUES ($1, $2, $3, $4, $5)',
        [id, b.name || 'Untitled', b.caption || '', b.url || null, first ? 1 : 0]
      );
      first = false;
    }
    console.log(`[DB] Migrated ${entries.length} brochure(s) from brochures.json to whatsapp_messages`);
  } catch (err) {
    console.error('[DB] Brochure migration failed:', err.message);
  }
}

module.exports = { migrateBrochuresJson };
