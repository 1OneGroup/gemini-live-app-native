// src/routes/prompts.js
// /api/prompt   — runtime (file-backed) single prompt (GET/POST/DELETE)
// /api/prompts  — DB-backed named prompt library (GET/POST)
// /api/prompts/:id  — individual prompt (GET/PATCH/DELETE)
// /api/prompts/:id/activate  — POST activate
// /api/prompts/active  — DELETE deactivate all
const { Router } = require('express');

module.exports = (deps) => {
  const { db, getSystemInstruction, saveSystemInstruction, isUsingOverride, DEFAULT_PROMPT } = deps;
  // resetToDefault is only available on the prompts module itself — import it from the original
  // prompts module since it wasn't included in the deps passed from server.js at Phase 3.
  // It was available at server.js top level though, so we require it directly here.
  const { resetToDefault } = require('../prompts/prompts');
  const router = Router();

  // --- Runtime (file-override) prompt ---
  router.get('/api/prompt', async (req, res) => {
    res.json({ prompt: await getSystemInstruction(), isOverride: isUsingOverride(), defaultPrompt: DEFAULT_PROMPT });
  });

  router.post('/api/prompt', (req, res) => {
    const body = req.body || {};
    const prompt = body.prompt;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt text is required' });
    }
    saveSystemInstruction(prompt.trim());
    console.log(`[Prompt] Saved custom prompt (${prompt.trim().length} chars)`);
    res.json({ ok: true, length: prompt.trim().length, isOverride: true });
  });

  router.delete('/api/prompt', (req, res) => {
    resetToDefault();
    console.log('[Prompt] Reset to default');
    res.json({ ok: true, isOverride: false });
  });

  // --- Named prompt library (DB-backed) ---
  router.get('/api/prompts', async (req, res) => {
    res.json(await db.listPrompts());
  });

  router.post('/api/prompts', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.name || !body.body) return res.status(400).json({ error: 'name and body required' });
      const prompt = await db.createPrompt({ name: body.name, body: body.body, isActive: !!body.is_active });
      res.status(201).json(prompt);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/prompts/active must come before /:id to avoid being shadowed
  router.delete('/api/prompts/active', async (req, res) => {
    await db.rawExecute('UPDATE prompts SET is_active = 0');
    res.json({ ok: true });
  });

  router.get('/api/prompts/:id', async (req, res) => {
    const prompt = await db.getPrompt(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Not found' });
    res.json(prompt);
  });

  router.patch('/api/prompts/:id', async (req, res) => {
    try {
      const body = req.body || {};
      const prompt = await db.updatePrompt(req.params.id, { name: body.name, body: body.body });
      if (!prompt) return res.status(404).json({ error: 'Not found' });
      res.json(prompt);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/api/prompts/:id', async (req, res) => {
    await db.deletePrompt(req.params.id);
    res.json({ ok: true });
  });

  router.post('/api/prompts/:id/activate', async (req, res) => {
    const prompt = await db.setActivePrompt(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Not found' });
    res.json(prompt);
  });

  return router;
};
