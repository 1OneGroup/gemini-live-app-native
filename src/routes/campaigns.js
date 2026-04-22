// src/routes/campaigns.js
// GET/POST   /api/campaigns
// GET/PATCH/DELETE /api/campaigns/:id
// POST /api/campaigns/:id/upload
// POST /api/campaigns/:id/start
// POST /api/campaigns/:id/pause
// POST /api/campaigns/:id/cancel
// GET  /api/campaigns/:id/callbacks
// POST /api/campaigns/:id/trigger-callbacks
// POST /api/campaigns/:id/auto-callback
// GET  /api/campaigns/:id/batches
// POST /api/campaigns/:id/batches/:n/approve
// GET  /api/campaigns/:id/batches/:n/analysis
// POST /api/campaigns/:id/batches/:n/rerun-analysis
// GET  /api/campaigns/:id/contacts
const { Router } = require('express');

module.exports = (deps) => {
  const { db, batchEngine, normalizePhone, safeJsonParse, makeCall } = deps;
  const router = Router();

  // List campaigns
  router.get('/', async (req, res) => {
    const rawCampaigns = await db.listCampaigns();
    const campaigns = [];
    for (const c of rawCampaigns) {
      campaigns.push({ ...c, stats: await db.getContactStats(c.id), isRunning: batchEngine.isRunning(c.id) });
    }
    res.json(campaigns);
  });

  // Create campaign
  router.post('/', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ error: 'name is required' });
      const campaign = await db.createCampaign({
        name: body.name,
        promptOverride: body.prompt_override,
        batchSize: body.batch_size || 100,
        maxConcurrent: body.max_concurrent || 1,
        whatsappMessageKey: body.whatsapp_message_key || null,
      });
      res.status(201).json(campaign);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Campaign detail
  router.get('/:id', async (req, res) => {
    const campaign = await db.getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    const stats = await db.getContactStats(campaign.id);
    const analyses = await db.listAnalyses(campaign.id);
    const maxBatch = await db.getMaxBatch(campaign.id);
    res.json({ ...campaign, stats, analyses, maxBatch, isRunning: batchEngine.isRunning(campaign.id), runner: batchEngine.getRunnerStatus(campaign.id) });
  });

  // Update campaign
  router.patch('/:id', async (req, res) => {
    try {
      const body = req.body || {};
      const campaign = await db.updateCampaign(req.params.id, {
        name: body.name, status: body.status, promptOverride: body.prompt_override,
        batchSize: body.batch_size, maxConcurrent: body.max_concurrent,
      });
      if (!campaign) return res.status(404).json({ error: 'Not found' });
      res.json(campaign);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete campaign
  router.delete('/:id', async (req, res) => {
    await db.deleteCampaign(req.params.id);
    res.json({ ok: true });
  });

  // CSV/JSON upload
  router.post('/:id/upload', async (req, res) => {
    const campaignId = req.params.id;
    const campaign = await db.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    try {
      // req.body is already parsed by express.json() if Content-Type is application/json.
      // For CSV (text/plain or text/csv), express does not parse the body — use raw body collection.
      const contentType = req.headers['content-type'] || '';
      let contacts;

      if (contentType.includes('application/json')) {
        const parsed = req.body;
        contacts = parsed.contacts || parsed;
      } else {
        // Collect raw body for CSV
        const rawBody = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', c => { data += c; if (data.length > 10e6) { req.destroy(); reject(new Error('Body too large')); } });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });

        const lines = rawBody.trim().split('\n');
        if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'mobile' || h === 'number' || h === 'phone_number');
        const nameIdx = headers.findIndex(h => h === 'name' || h === 'fullname' || h === 'customer_name' || h === 'contact_name');
        const empIdx = headers.findIndex(h => h === 'employeename' || h === 'employee_name' || h === 'employee' || h === 'agent');
        if (phoneIdx === -1) return res.status(400).json({ error: 'CSV must have a phone/mobile/number column' });

        contacts = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/['"]/g, ''));
          if (!cols[phoneIdx]) continue;
          const phone = normalizePhone(cols[phoneIdx]);
          const employeeName = empIdx >= 0 ? (cols[empIdx] || '').trim() || null : null;
          const metadata = {};
          headers.forEach((h, idx) => { if (idx !== phoneIdx && idx !== nameIdx && idx !== empIdx && cols[idx]) metadata[h] = cols[idx]; });
          contacts.push({ phone, name: nameIdx >= 0 ? cols[nameIdx] : null, employeeName, metadata: Object.keys(metadata).length > 0 ? metadata : null });
        }
      }

      if (!contacts || contacts.length === 0) return res.status(400).json({ error: 'No valid contacts found' });
      if (contacts.length > 10000) return res.status(400).json({ error: 'Maximum 10,000 contacts per campaign' });

      await db.insertContacts(campaignId, contacts, campaign.batch_size);
      const updated = await db.getCampaign(campaignId);
      res.json({ ok: true, totalContacts: updated.total_contacts, batches: await db.getMaxBatch(campaignId) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Start campaign
  router.post('/:id/start', async (req, res) => {
    const result = await batchEngine.startCampaign(req.params.id);
    res.status(result.error ? 400 : 200).json(result);
  });

  // Pause campaign
  router.post('/:id/pause', async (req, res) => {
    res.json(await batchEngine.pauseCampaign(req.params.id));
  });

  // Cancel campaign
  router.post('/:id/cancel', async (req, res) => {
    res.json(await batchEngine.cancelCampaign(req.params.id));
  });

  // Callback contacts for a campaign
  router.get('/:id/callbacks', async (req, res) => {
    res.json(await db.getCallbackContacts(req.params.id));
  });

  // Trigger due callbacks
  router.post('/:id/trigger-callbacks', async (req, res) => {
    const campaignId = req.params.id;
    const campaign = await db.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const callbacks = await db.getCallbackContacts(campaignId);
    const now = new Date();
    const due = callbacks.filter(c => c.callback_date && new Date(c.callback_date) <= now);
    if (due.length === 0) return res.json({ triggered: 0, message: 'No callbacks due' });

    const results = [];
    for (const contact of due) {
      try {
        const result = await makeCall(contact.phone, contact.name || 'Sir', campaign.prompt_override || null, campaign.whatsapp_message_key || null, null, { enableAMD: true });
        await db.updateContact(contact.id, { status: 'calling', callUuid: result.callUuid, outcome: null, callbackDate: null, callbackNote: null });
        results.push({ phone: contact.phone, name: contact.name, callUuid: result.callUuid, status: 'calling' });
      } catch (err) {
        results.push({ phone: contact.phone, name: contact.name, error: err.message });
      }
    }
    res.json({ triggered: results.length, results });
  });

  // Toggle auto-callback for a campaign
  router.post('/:id/auto-callback', async (req, res) => {
    try {
      const body = req.body || {};
      const enabled = body.enabled ? 1 : 0;
      await db.rawExecute('UPDATE campaigns SET auto_callback = $1 WHERE id = $2', [enabled, req.params.id]);
      const campaign = await db.getCampaign(req.params.id);
      res.json({ auto_callback: campaign?.auto_callback || 0 });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // List batches
  router.get('/:id/batches', async (req, res) => {
    const campaignId = req.params.id;
    const maxBatch = await db.getMaxBatch(campaignId);
    const batches = [];
    for (let i = 1; i <= maxBatch; i++) {
      const stats = await db.getBatchStats(campaignId, i);
      const analysis = await db.getAnalysis(campaignId, i);
      const prompt = analysis?.prompt_id ? await db.getPrompt(analysis.prompt_id) : null;
      batches.push({ batchNumber: i, stats, analysis: analysis ? { ...analysis, prompt_name: prompt?.name || null } : null });
    }
    res.json(batches);
  });

  // Approve batch
  router.post('/:id/batches/:n/approve', async (req, res) => {
    const campaignId = req.params.id;
    const batchNum = parseInt(req.params.n);
    try {
      const body = req.body || {};
      await db.approveAnalysis(campaignId, batchNum);
      if (body.prompt_override) await db.updateCampaign(campaignId, { promptOverride: body.prompt_override });
      if (body.batch_size) await db.updateCampaign(campaignId, { batchSize: body.batch_size });
      await db.updateCampaign(campaignId, { currentBatch: batchNum + 1 });
      const result = await batchEngine.startCampaign(campaignId);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Get batch analysis
  router.get('/:id/batches/:n/analysis', async (req, res) => {
    const analysis = await db.getAnalysis(req.params.id, parseInt(req.params.n));
    if (!analysis) return res.status(404).json({ error: 'No analysis found' });
    const prompt = analysis.prompt_id ? await db.getPrompt(analysis.prompt_id) : null;
    res.json({ ...analysis, stats: safeJsonParse(analysis.stats, null), prompt_name: prompt?.name || null });
  });

  // Re-run batch analysis
  router.post('/:id/batches/:n/rerun-analysis', async (req, res) => {
    const campaignId = req.params.id;
    const batchNum = parseInt(req.params.n);
    await db.deleteAnalysis(campaignId, batchNum);
    try {
      await batchEngine.runBatchAnalysis(campaignId, batchNum);
      const analysis = await db.getAnalysis(campaignId, batchNum);
      const prompt = analysis?.prompt_id ? await db.getPrompt(analysis.prompt_id) : null;
      res.json({ ok: true, analysis: analysis ? { ...analysis, prompt_name: prompt?.name || null } : null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List contacts
  router.get('/:id/contacts', async (req, res) => {
    const contacts = await db.getContacts(req.params.id, {
      batchNumber: req.query.batch ? parseInt(req.query.batch) : undefined,
      status: req.query.status,
      outcome: req.query.outcome || undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      offset: req.query.offset ? parseInt(req.query.offset) : 0,
    });
    res.json(contacts);
  });

  return router;
};
