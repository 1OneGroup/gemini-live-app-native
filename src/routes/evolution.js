// src/routes/evolution.js
// GET  /api/evolution/instances        — list all Evolution API instances
// GET  /api/evolution/:path            — proxy GET to Evolution API
// POST /api/evolution/create-instance  — create a new Evolution instance
const { Router } = require('express');
const evo = require('../integrations/evolution');

module.exports = (deps) => {
  const router = Router();

  // List all instances — maps to /instance/all on Evolution API
  router.get('/instances', async (req, res) => {
    try {
      const instances = await evo.listInstances();
      res.json(instances);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new instance
  router.post('/create-instance', async (req, res) => {
    try {
      const body = req.body || {};
      const data = await evo.createInstance(body.instance_name);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Generic proxy — must be last (catches /api/evolution/:path)
  router.get('/:path(*)', async (req, res) => {
    try {
      const data = await evo.proxyGet(req.params.path);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
