// src/routes/brochures.js
// GET    /api/brochures         — list all brochures
// POST   /api/brochures         — create/update a brochure
// DELETE /api/brochures/:key    — remove a brochure
const { Router } = require('express');

module.exports = (deps) => {
  const { whatsapp } = deps;
  const router = Router();

  router.get('/', (req, res) => {
    res.json(whatsapp.getBrochures());
  });

  router.post('/', (req, res) => {
    const body = req.body || {};
    if (!body.key || !body.name || !body.url) {
      return res.status(400).json({ error: 'key, name, url required' });
    }
    res.json(whatsapp.setBrochure(body.key, { name: body.name, url: body.url, caption: body.caption || '' }));
  });

  router.delete('/:key', (req, res) => {
    res.json(whatsapp.deleteBrochure(req.params.key));
  });

  return router;
};
