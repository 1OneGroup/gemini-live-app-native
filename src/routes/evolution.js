// src/routes/evolution.js
// GET  /api/evolution/instances        — list all Evolution API instances
// GET  /api/evolution/:path            — proxy GET to Evolution API
// POST /api/evolution/create-instance  — create a new Evolution instance
const { Router } = require('express');

module.exports = (deps) => {
  const router = Router();
  const EVO_URL = () => process.env.EVOLUTION_API_URL || 'https://evo-go.tech.onegroup.co.in';
  const EVO_KEY = () => process.env.EVOLUTION_API_KEY || '';

  // List all instances — maps to /instance/all on Evolution API
  router.get('/instances', async (req, res) => {
    try {
      const evoRes = await fetch(`${EVO_URL()}/instance/all`, {
        headers: { 'apikey': EVO_KEY() },
      });
      const evoData = await evoRes.json();
      const instances = (Array.isArray(evoData.data) ? evoData.data : []).map(i => ({
        name: i.name,
        connectionStatus: i.connected ? 'open' : 'close',
        profileName: i.jid || null,
      }));
      res.json(instances);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new instance
  router.post('/create-instance', async (req, res) => {
    try {
      const body = req.body || {};
      const evoRes = await fetch(`${EVO_URL()}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY() },
        body: JSON.stringify({ name: body.instance_name }),
      });
      const evoData = await evoRes.json();
      res.json(evoData);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Generic proxy — must be last (catches /api/evolution/:path)
  router.get('/:path(*)', async (req, res) => {
    try {
      const evoRes = await fetch(`${EVO_URL()}/${req.params.path}`, {
        headers: { 'apikey': EVO_KEY() },
      });
      const evoData = await evoRes.json();
      res.json(evoData);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
