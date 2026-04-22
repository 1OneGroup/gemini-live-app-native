// src/routes/whatsapp-messages.js
// GET    /api/whatsapp-messages           — list
// POST   /api/whatsapp-messages           — create
// POST   /api/whatsapp-messages/improve   — AI-improve draft message
// DELETE /api/whatsapp-messages/active    — deactivate all
// GET/PATCH/DELETE /api/whatsapp-messages/:id
// POST   /api/whatsapp-messages/:id/activate
const { Router } = require('express');

module.exports = (deps) => {
  const { db } = deps;
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await db.listWhatsappMessages());
  });

  router.post('/', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.name || !body.body) return res.status(400).json({ error: 'name and body required' });
      const msg = await db.createWhatsappMessage({
        name: body.name,
        body: body.body,
        attachmentUrl: body.attachment_url || null,
        isActive: !!body.is_active,
      });
      res.status(201).json(msg);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // /improve must come before /:id
  router.post('/improve', async (req, res) => {
    try {
      const body = req.body || {};
      const draft = (body.body || '').trim();
      const context = (body.context || '').trim();
      if (!draft) return res.status(400).json({ error: 'body required' });
      if (!process.env.OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

      const systemPrompt = `You are a copywriter for a real-estate sales team in India. You refine short WhatsApp broadcast messages sent to leads after phone calls.

Rewrite the DRAFT so it is:
- Warm, professional, concise (2-5 short lines)
- Natural for WhatsApp (plain text, light punctuation)
- In the same language and register the user wrote in (English / Hindi / Hinglish)
- One-shot: the reader should NOT need to reply for the message to be useful

Rules:
- Preserve any URLs exactly
- Do NOT invent prices, dates, unit sizes, or names not present in the draft
- Do NOT add preamble like "Here's the improved version:" — return ONLY the rewritten message text`;

      const userPrompt = context ? `Context: ${context}\n\nDRAFT:\n${draft}` : `DRAFT:\n${draft}`;

      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://gemini-live.tech.onegroup.co.in',
          'X-Title': 'gemini-live-app-native',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-v3.2',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.6,
          max_tokens: 400,
        }),
      });
      if (!orRes.ok) {
        const errText = await orRes.text().catch(() => '');
        return res.status(502).json({ error: `OpenRouter ${orRes.status}: ${errText.slice(0, 200)}` });
      }
      const data = await orRes.json();
      const improved = (data.choices?.[0]?.message?.content || '').trim();
      if (!improved) return res.status(502).json({ error: 'Empty response from model' });
      res.json({ body: improved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // /active must come before /:id
  router.delete('/active', async (req, res) => {
    await db.rawExecute('UPDATE whatsapp_messages SET is_active = 0');
    res.json({ ok: true });
  });

  router.get('/:id', async (req, res) => {
    const msg = await db.getWhatsappMessage(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    res.json(msg);
  });

  router.patch('/:id', async (req, res) => {
    try {
      const body = req.body || {};
      const msg = await db.updateWhatsappMessage(req.params.id, {
        name: body.name,
        body: body.body,
        attachmentUrl: body.attachment_url,
      });
      if (!msg) return res.status(404).json({ error: 'Not found' });
      res.json(msg);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    await db.deleteWhatsappMessage(req.params.id);
    res.json({ ok: true });
  });

  router.post('/:id/activate', async (req, res) => {
    const msg = await db.setActiveWhatsappMessage(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    res.json(msg);
  });

  return router;
};
