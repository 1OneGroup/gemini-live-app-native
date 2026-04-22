// src/routes/model.js
// GET /api/model  — return active model + registry
// POST /api/model — switch active model
const { Router } = require('express');

module.exports = (deps) => {
  const { GEMINI_MODELS, getActiveModel, setActiveModel } = deps;
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ active: getActiveModel(), models: GEMINI_MODELS });
  });

  router.post('/', (req, res) => {
    const body = req.body || {};
    if (!body.model || !GEMINI_MODELS[body.model]) {
      return res.status(400).json({ error: 'Invalid model. Available: ' + Object.keys(GEMINI_MODELS).join(', ') });
    }
    setActiveModel(body.model);
    console.log(`[Model] Switched to ${body.model}`);
    res.json({ active: body.model, name: GEMINI_MODELS[body.model].name });
  });

  return router;
};
