// In-memory SQLite replacement (no native compilation needed)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

// Persistence setup
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');

function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return raw;
    }
  } catch (e) { console.error('[DB] Failed to load db.json:', e.message); }
  return {};
}

let _saveTimer = null;
function scheduleSave() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      const data = {
        campaigns: [...campaigns.entries()],
        contacts: [...contacts.entries()],
        batchAnalyses: [...batchAnalyses.entries()],
        employeeInstances: [...employeeInstances.entries()],
        prompts: [...prompts.entries()],
        websiteLeadsArr: [...websiteLeads.entries()],
        websiteSettingsObj: websiteSettings,
        waIncomingMessagesArr: waIncomingMessages,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data), 'utf8');
    } catch (e) { console.error('[DB] Failed to save db.json:', e.message); }
  }, 500);
}

// In-memory stores
const campaigns = new Map();
const contacts = new Map();
const batchAnalyses = new Map();
const employeeInstances = new Map();
const prompts = new Map();

// --- Campaigns ---
function createCampaign({ name, promptOverride, batchSize = 100, maxConcurrent = 1, whatsappMessageKey = null }) {
  const id = uid();
  const c = { id, name, status: 'draft', prompt_override: promptOverride || null, batch_size: batchSize, max_concurrent: maxConcurrent, total_contacts: 0, completed_contacts: 0, current_batch: 0, whatsapp_message_key: whatsappMessageKey || null, created_at: now(), updated_at: now() };
  campaigns.set(id, c);
  scheduleSave();
  return { ...c };
}
function getCampaign(id) { return campaigns.has(id) ? { ...campaigns.get(id) } : null; }
function listCampaigns() { return [...campaigns.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)); }
function updateCampaign(id, updates) {
  const c = campaigns.get(id);
  if (!c) return null;
  if (updates.name != null) c.name = updates.name;
  if (updates.status != null) c.status = updates.status;
  if (updates.promptOverride != null) c.prompt_override = updates.promptOverride;
  if (updates.batchSize != null) c.batch_size = updates.batchSize;
  if (updates.maxConcurrent != null) c.max_concurrent = updates.maxConcurrent;
  if (updates.totalContacts != null) c.total_contacts = updates.totalContacts;
  if (updates.completedContacts != null) c.completed_contacts = updates.completedContacts;
  if (updates.currentBatch != null) c.current_batch = updates.currentBatch;
  c.updated_at = now();
  scheduleSave();
  return { ...c };
}
function deleteCampaign(id) {
  for (const [k, v] of contacts) { if (v.campaign_id === id) contacts.delete(k); }
  for (const [k, v] of batchAnalyses) { if (v.campaign_id === id) batchAnalyses.delete(k); }
  campaigns.delete(id);
  scheduleSave();
}

// --- Contacts ---
function insertContacts(campaignId, contactsList, batchSize) {
  let batchNum = 1;
  for (let i = 0; i < contactsList.length; i++) {
    if (i > 0 && i % batchSize === 0) batchNum++;
    const c = contactsList[i];
    const id = uid();
    contacts.set(id, { id, campaign_id: campaignId, phone: c.phone, name: c.name || null, metadata: c.metadata ? JSON.stringify(c.metadata) : null, batch_number: batchNum, employee_name: c.employeeName || null, status: 'pending', call_uuid: null, outcome: null, callback_date: null, callback_note: null, lead_temperature: null, follow_up_action: null, conversation_summary: null, whatsapp_followup_sent: 0, classification_confidence: null, created_at: now() });
  }
  updateCampaign(campaignId, { totalContacts: contactsList.length });
  scheduleSave();
}

function getContacts(campaignId, { batchNumber, status, outcome, limit = 100, offset = 0 } = {}) {
  let list = [...contacts.values()].filter(c => c.campaign_id === campaignId);
  if (batchNumber) list = list.filter(c => c.batch_number === batchNumber);
  if (status) list = list.filter(c => c.status === status);
  if (outcome) list = list.filter(c => c.outcome === outcome);
  return list.slice(offset, offset + limit).map(c => ({ ...c }));
}

function getContactStats(campaignId) {
  const list = [...contacts.values()].filter(c => c.campaign_id === campaignId);
  return {
    total: list.length,
    completed: list.filter(c => c.status === 'completed').length,
    failed: list.filter(c => c.status === 'failed').length,
    pending: list.filter(c => c.status === 'pending').length,
    calling: list.filter(c => c.status === 'calling').length,
    interested: list.filter(c => c.outcome && c.outcome.includes('interested') && !c.outcome.includes('not_interested')).length,
    not_interested: list.filter(c => c.outcome && c.outcome.includes('not_interested')).length,
    callback: list.filter(c => c.outcome && c.outcome.includes('callback')).length,
    no_answer: list.filter(c => c.outcome && c.outcome.includes('no_answer')).length,
    busy: list.filter(c => c.outcome && c.outcome.includes('busy')).length,
    brochure_sent: list.filter(c => c.outcome && c.outcome.includes('brochure_sent')).length,
    voicemail: list.filter(c => c.outcome && c.outcome.includes('voicemail')).length,
  };
}

function getBatchStats(campaignId, batchNumber) {
  const list = [...contacts.values()].filter(c => c.campaign_id === campaignId && c.batch_number === batchNumber);
  return {
    total: list.length,
    completed: list.filter(c => c.status === 'completed').length,
    failed: list.filter(c => c.status === 'failed').length,
    interested: list.filter(c => c.outcome && c.outcome.includes('interested') && !c.outcome.includes('not_interested')).length,
    not_interested: list.filter(c => c.outcome && c.outcome.includes('not_interested')).length,
    callback: list.filter(c => c.outcome && c.outcome.includes('callback')).length,
    no_answer: list.filter(c => c.outcome && c.outcome.includes('no_answer')).length,
    busy: list.filter(c => c.outcome && c.outcome.includes('busy')).length,
    brochure_sent: list.filter(c => c.outcome && c.outcome.includes('brochure_sent')).length,
    voicemail: list.filter(c => c.outcome && c.outcome.includes('voicemail')).length,
  };
}

function updateContact(id, { status, callUuid, outcome, callbackDate, callbackNote }) {
  const c = contacts.get(id);
  if (!c) return;
  if (status != null) c.status = status;
  if (callUuid != null) c.call_uuid = callUuid;
  if (outcome != null) c.outcome = outcome;
  if (callbackDate != null) c.callback_date = callbackDate;
  if (callbackNote != null) c.callback_note = callbackNote;
  scheduleSave();
}

function updateContactClassification(id, classification) {
  const c = contacts.get(id);
  if (!c) return;
  if (classification.outcome) c.outcome = classification.outcome;
  if (classification.lead_temperature) c.lead_temperature = classification.lead_temperature;
  if (classification.follow_up_action) c.follow_up_action = classification.follow_up_action;
  if (classification.conversation_summary) c.conversation_summary = classification.conversation_summary;
  if (classification.confidence) c.classification_confidence = classification.confidence;
  scheduleSave();
}

function markWhatsappFollowupSent(id) {
  const c = contacts.get(id);
  if (c) { c.whatsapp_followup_sent = 1; scheduleSave(); }
}

function getContactsByFollowUpAction(action, onlySent = false) {
  return [...contacts.values()].filter(c => c.follow_up_action === action && (onlySent ? c.whatsapp_followup_sent === 1 : c.whatsapp_followup_sent === 0));
}

function getHotWarmLeadsForWhatsapp() {
  return [...contacts.values()].filter(c =>
    c.whatsapp_followup_sent === 0 &&
    ['hot', 'warm'].includes(c.lead_temperature) &&
    ['assign_sales_team', 'send_whatsapp_brochure', 'send_whatsapp_followup', 'schedule_callback'].includes(c.follow_up_action) &&
    c.call_uuid != null
  );
}

function getNextPendingContact(campaignId, batchNumber) {
  return [...contacts.values()].find(c => c.campaign_id === campaignId && c.batch_number === batchNumber && c.status === 'pending') || null;
}

function getMaxBatch(campaignId) {
  const list = [...contacts.values()].filter(c => c.campaign_id === campaignId);
  return list.reduce((max, c) => Math.max(max, c.batch_number || 0), 0);
}

function getCallbackContacts(campaignId) {
  let list = [...contacts.values()].filter(c => c.outcome && c.outcome.includes('callback'));
  if (campaignId) list = list.filter(c => c.campaign_id === campaignId);
  return list;
}

// --- Batch Analyses ---
function createAnalysis(campaignId, batchNumber, { summary, recommendations, promptAdjustments, stats, promptId }) {
  const id = uid();
  const a = { id, campaign_id: campaignId, batch_number: batchNumber, summary, recommendations, prompt_adjustments: promptAdjustments, stats: JSON.stringify(stats), prompt_id: promptId || null, approved: 0, approved_at: null, created_at: now() };
  batchAnalyses.set(`${campaignId}:${batchNumber}`, a);
  scheduleSave();
  return { ...a };
}
function getAnalysis(campaignId, batchNumber) {
  const a = batchAnalyses.get(`${campaignId}:${batchNumber}`);
  return a ? { ...a } : null;
}
function listAnalyses(campaignId) {
  return [...batchAnalyses.values()].filter(a => a.campaign_id === campaignId).sort((a, b) => a.batch_number - b.batch_number);
}
function approveAnalysis(campaignId, batchNumber) {
  const a = batchAnalyses.get(`${campaignId}:${batchNumber}`);
  if (a) { a.approved = 1; a.approved_at = now(); }
  return getAnalysis(campaignId, batchNumber);
}
function rejectAnalysis(campaignId, batchNumber) {
  const a = batchAnalyses.get(`${campaignId}:${batchNumber}`);
  if (a) { a.approved = 2; a.approved_at = now(); }
  return getAnalysis(campaignId, batchNumber);
}
function deleteAnalysis(campaignId, batchNumber) {
  batchAnalyses.delete(`${campaignId}:${batchNumber}`);
}

// --- Prompts ---
function createPrompt({ name, body, isActive = false }) {
  const id = uid();
  if (isActive) for (const p of prompts.values()) p.is_active = 0;
  const p = { id, name, body, is_active: isActive ? 1 : 0, created_at: now(), updated_at: now() };
  prompts.set(id, p);
  scheduleSave();
  return { ...p };
}
function listPrompts() { return [...prompts.values()].sort((a, b) => b.is_active - a.is_active || b.updated_at.localeCompare(a.updated_at)); }
function getPrompt(id) { return prompts.has(id) ? { ...prompts.get(id) } : null; }
function updatePrompt(id, { name, body }) {
  const p = prompts.get(id);
  if (!p) return null;
  if (name) p.name = name;
  if (body) p.body = body;
  p.updated_at = now();
  scheduleSave();
  return { ...p };
}
function deletePrompt(id) { prompts.delete(id); scheduleSave(); }
function setActivePrompt(id) {
  for (const p of prompts.values()) p.is_active = 0;
  const p = prompts.get(id);
  if (p) { p.is_active = 1; p.updated_at = now(); scheduleSave(); }
  return p ? { ...p } : null;
}
function getActivePrompt() {
  return [...prompts.values()].find(p => p.is_active === 1) || null;
}

// --- Employee Instances ---
function createEmployeeInstance({ employeeName, instanceName, phone, status }) {
  const existing = [...employeeInstances.values()].find(e => e.employee_name.toLowerCase() === employeeName.toLowerCase());
  const id = existing?.id || uid();
  const e = { id, employee_name: employeeName, instance_name: instanceName, phone: phone || null, status: status || 'pending', created_at: now(), updated_at: now() };
  employeeInstances.set(id, e);
  scheduleSave();
  return { ...e };
}
function listEmployeeInstances() { return [...employeeInstances.values()].sort((a, b) => a.employee_name.localeCompare(b.employee_name)); }
function getEmployeeInstance(id) { return employeeInstances.has(id) ? { ...employeeInstances.get(id) } : null; }
function getEmployeeByName(name) { return [...employeeInstances.values()].find(e => e.employee_name.toLowerCase() === name.toLowerCase()) || null; }
function updateEmployeeInstance(id, { employeeName, instanceName, phone, status }) {
  const e = employeeInstances.get(id);
  if (!e) return null;
  if (employeeName) e.employee_name = employeeName;
  if (instanceName) e.instance_name = instanceName;
  if (phone) e.phone = phone;
  if (status) e.status = status;
  e.updated_at = now();
  scheduleSave();
  return { ...e };
}
function deleteEmployeeInstance(id) { employeeInstances.delete(id); scheduleSave(); }
function getUniqueEmployeeNames() {
  const names = new Set([...contacts.values()].filter(c => c.employee_name).map(c => c.employee_name));
  return [...names].sort();
}

// Seed default prompt
try {
  const { DEFAULT_PROMPT } = require('./prompts');
  if (DEFAULT_PROMPT) {
    createPrompt({ name: 'Clermont Cold Call — Standard', body: DEFAULT_PROMPT, isActive: true });
    console.log('[DB] Seeded default prompt (in-memory)');
  }
} catch (err) {
  console.error('[DB] Failed to seed default prompt:', err.message);
}

// --- Website Leads ---
const websiteLeads = new Map();
const websiteSettings = { autoWaEnabled: false, autoWaTemplate: '{{greeting}} Sir/Madam!\n\nThank you for contacting us. Our team will reach out to you shortly.\n\n- ONE Group', autoEmailEnabled: false, autoEmailSubject: 'Thank you for your interest', autoEmailBody: 'Dear {{name}},\n\nThank you for contacting us. We will get back to you soon.', customWebhookUrl: '', b2bForwardEnabled: false, b2bForwardUrl: '', waWebhookOutUrl: '', tunnelUrl: 'https://870f5ea76b53c024-157-49-26-8.serveousercontent.com', autoWaInstance: '' };
const waIncomingMessages = [];

// --- Load persisted data ---
(function loadPersistedData() {
  const saved = loadData();
  if (saved.campaigns) for (const [k, v] of saved.campaigns) campaigns.set(k, v);
  if (saved.contacts) for (const [k, v] of saved.contacts) contacts.set(k, v);
  if (saved.batchAnalyses) for (const [k, v] of saved.batchAnalyses) batchAnalyses.set(k, v);
  if (saved.employeeInstances) for (const [k, v] of saved.employeeInstances) employeeInstances.set(k, v);
  if (saved.prompts) for (const [k, v] of saved.prompts) prompts.set(k, v);
  if (saved.websiteLeadsArr) for (const [k, v] of saved.websiteLeadsArr) websiteLeads.set(k, v);
  if (saved.websiteSettingsObj) Object.assign(websiteSettings, saved.websiteSettingsObj);
  if (saved.waIncomingMessagesArr) waIncomingMessages.push(...saved.waIncomingMessagesArr);
  if (saved.campaigns || saved.websiteLeadsArr) console.log('[DB] Loaded persisted data from db.json');
})();

function addWaIncomingMessage(data) { waIncomingMessages.unshift({ ...data, receivedAt: new Date().toISOString() }); if (waIncomingMessages.length > 200) waIncomingMessages.pop(); scheduleSave(); }
function getWaIncomingMessages() { return [...waIncomingMessages]; }

function createWebsiteLead({ name, phone, email, source, message, pageUrl, ipAddress }) {
  const id = uid();
  const lead = { id, name: name || '', phone: phone || '', email: email || '', source: source || '', message: message || '', pageUrl: pageUrl || '', ipAddress: ipAddress || '', status: 'new', waMessageSent: false, emailSent: false, createdAt: now() };
  websiteLeads.set(id, lead);
  scheduleSave();
  return { ...lead };
}
function listWebsiteLeads() { return [...websiteLeads.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
function updateWebsiteLead(id, updates) {
  const l = websiteLeads.get(id);
  if (!l) return null;
  Object.assign(l, updates);
  scheduleSave();
  return { ...l };
}
function deleteWebsiteLead(id) { websiteLeads.delete(id); scheduleSave(); }
function getWebsiteLeadStats() {
  const all = [...websiteLeads.values()];
  return { total: all.length, new: all.filter(l => l.status === 'new').length, contacted: all.filter(l => l.status === 'contacted').length, converted: all.filter(l => l.status === 'converted').length, ignored: all.filter(l => l.status === 'ignored').length };
}
function getWebsiteSettings() { return { ...websiteSettings }; }
function updateWebsiteSettings(updates) { Object.assign(websiteSettings, updates); scheduleSave(); return { ...websiteSettings }; }

// Stub db object for compatibility
const db = { prepare: () => ({ run: () => {}, get: () => null, all: () => [] }) };

module.exports = {
  createWebsiteLead, listWebsiteLeads, updateWebsiteLead, deleteWebsiteLead, getWebsiteLeadStats, getWebsiteSettings, updateWebsiteSettings, addWaIncomingMessage, getWaIncomingMessages,
  createCampaign, getCampaign, listCampaigns, updateCampaign, deleteCampaign,
  insertContacts, getContacts, getContactStats, getBatchStats, updateContact,
  updateContactClassification, markWhatsappFollowupSent, getContactsByFollowUpAction, getHotWarmLeadsForWhatsapp,
  getNextPendingContact, getMaxBatch, getCallbackContacts,
  createAnalysis, getAnalysis, listAnalyses, approveAnalysis, rejectAnalysis, deleteAnalysis,
  createPrompt, listPrompts, getPrompt, updatePrompt, deletePrompt, setActivePrompt, getActivePrompt,
  createEmployeeInstance, listEmployeeInstances, getEmployeeInstance, getEmployeeByName, updateEmployeeInstance, deleteEmployeeInstance, getUniqueEmployeeNames,
  db,
};
