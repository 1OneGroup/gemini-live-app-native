// src/app.js
// Express app factory. Accepts a deps object from server.js.
// server.js still handles: WS upgrade, Gemini sessions, outbound call, jobs.
const express = require('express');

module.exports = function createApp(deps) {
  const app = express();

  // Body parsing — replaces all raw req.on('data') blocks
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Dashboard routes — inline; getDashboardHtml is CPU-bound (no async needed)
  app.get('/', (req, res) => {
    res.type('html').set('Cache-Control', 'no-cache, no-store, must-revalidate').send(deps.getDashboardHtml());
  });
  app.get('/dashboard', (req, res) => {
    res.type('html').set('Cache-Control', 'no-cache, no-store, must-revalidate').send(deps.getDashboardHtml());
  });

  // Feature routers
  app.use('/health',                 require('./routes/health')(deps));
  app.use('/api/calls',              require('./routes/calls')(deps));
  app.use('/api/campaigns',          require('./routes/campaigns')(deps));
  app.use('/api/brochures',          require('./routes/brochures')(deps));
  app.use('/api/model',              require('./routes/model')(deps));
  app.use('/api/analytics',          require('./routes/analytics')(deps));
  app.use('/api/whatsapp-messages',  require('./routes/whatsapp-messages')(deps));

  // Routers mounted at root because their paths vary
  app.use('/',                       require('./routes/prompts')(deps));      // /api/prompt, /api/prompts, /api/prompts/*
  app.use('/',                       require('./routes/employees')(deps));    // /api/employee-instances/*
  app.use('/api/evolution',          require('./routes/evolution')(deps));    // /api/evolution/*
  app.use('/',                       require('./routes/plivo')(deps));        // /answer /hangup /stream-status /recording-* /machine-detection /call

  // 404 fallback
  app.use((req, res) => {
    res.status(404).send('Not found');
  });

  return app;
};
