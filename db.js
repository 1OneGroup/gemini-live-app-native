// Facade — preserves existing import path ./db for callers in server.js,
// batch-engine.js, call-store.js, etc. Delete when all callers rewired (Phase 8).
module.exports = {
  ...require('./src/db/index'),
  ...require('./src/db/campaigns'),
  ...require('./src/db/contacts'),
  ...require('./src/db/analyses'),
  ...require('./src/db/prompts'),
  ...require('./src/db/whatsapp-messages'),
  ...require('./src/db/employees'),
};
