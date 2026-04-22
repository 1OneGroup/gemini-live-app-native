// WhatsApp brochure integration via Evo Go API
const fs = require('fs');
const path = require('path');
const { normalizePhone } = require('../lib/phone');
const { getEvoUrl, getDefaultInstance, getInstanceCredentials } = require('./evolution');

const BROCHURES_PATH = path.join(process.env.DATA_DIR || '/data', 'brochures.json');

// Default brochure mapping
const DEFAULT_BROCHURES = {
  "clermont": {
    "name": "The Clermont",
    "url": "https://onegroup.co.in/brochures/clermont.pdf",
    "caption": "Here is The Clermont brochure — premium 3BHK independent floors in Sector 98, Mohali."
  }
};

function loadBrochures() {
  try {
    if (fs.existsSync(BROCHURES_PATH)) {
      return JSON.parse(fs.readFileSync(BROCHURES_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('[WhatsApp] Error loading brochures:', err.message);
  }
  return DEFAULT_BROCHURES;
}

function saveBrochures(brochures) {
  const dir = path.dirname(BROCHURES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BROCHURES_PATH, JSON.stringify(brochures, null, 2));
}

function getBrochures() {
  return loadBrochures();
}

function setBrochure(projectKey, { name, url, caption }) {
  const brochures = loadBrochures();
  brochures[projectKey.toLowerCase()] = { name, url, caption };
  saveBrochures(brochures);
  return brochures;
}

// Resolve which instance name to use for an employee
async function resolveInstance(employeeName) {
  if (!employeeName) return getDefaultInstance();
  try {
    const db = require('../db');
    const emp = await db.getEmployeeByName(employeeName);
    if (emp?.instance_name) return emp.instance_name;
  } catch {}
  return getDefaultInstance();
}

// Resolve the message template to send. Order of precedence:
//   1. Explicit ref that matches a DB message id (e.g. campaign-linked UUID)
//   2. Active WhatsApp message from DB (the template the user marked Active)
//   3. Legacy brochure in brochures.json matched by projectName (backward compat)
function wamToBrochure(m) {
  return { name: m.name, caption: m.body, url: m.attachment_url || '' };
}

async function resolveMessage(ref) {
  const db = (() => { try { return require('../db'); } catch { return null; } })();

  if (db && ref) {
    try {
      const byId = await db.getWhatsappMessage(ref);
      if (byId) return wamToBrochure(byId);
    } catch {}
  }

  if (db) {
    try {
      const active = await db.getActiveWhatsappMessage();
      if (active) return wamToBrochure(active);
    } catch {}
  }

  if (!ref) return null;
  const brochures = loadBrochures();
  const key = ref.toLowerCase().replace(/[^a-z0-9]/g, '');
  let brochure = brochures[key];
  if (!brochure) {
    for (const [k, v] of Object.entries(brochures)) {
      if (key.includes(k) || k.includes(key)) { brochure = v; break; }
    }
  }
  return brochure || null;
}

async function sendBrochure(phoneNumber, projectName, employeeName) {
  const brochure = await resolveMessage(projectName);
  if (!brochure) {
    console.error(`[WhatsApp] No active WhatsApp message and no brochure for "${projectName}"`);
    return { success: false, error: 'No active WhatsApp message configured' };
  }

  // Normalize phone number to digits-only format required by Evo Go API
  // normalizePhone returns E.164 (+91...), then we strip the '+' for the API.
  let number = normalizePhone(phoneNumber).replace(/^\+/, '');

  const instanceName = await resolveInstance(employeeName);
  console.log(`[WhatsApp] Using instance: ${instanceName} (employee: ${employeeName || 'default'})`);

  const creds = await getInstanceCredentials(instanceName);
  if (!creds) {
    console.error('[WhatsApp] No connected WhatsApp instance found');
    return { success: false, error: 'No connected WhatsApp instance found' };
  }

  const headers = { 'Content-Type': 'application/json', 'apikey': creds.token };
  // Unique per-message stanza ID (Evo Go echoes this as Info.ID; reused IDs get
  // dropped by WhatsApp as duplicates).
  const msgId = `glb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const EVOLUTION_API_URL = getEvoUrl();

  try {
    const mediaUrl = brochure.url || '';
    const caption = brochure.caption || `Here is the ${brochure.name} details.`;
    const isLink = /youtube\.com|youtu\.be|vimeo\.com/i.test(mediaUrl) || !/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|png|jpg|jpeg|gif|webp|mp4|mov|avi)(\?|$)/i.test(mediaUrl);
    const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(mediaUrl);
    const isVideo = /\.(mp4|mov|avi)(\?|$)/i.test(mediaUrl);
    const isPdf = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)(\?|$)/i.test(mediaUrl);

    let response;
    if (isPdf) {
      console.log(`[WhatsApp] Sending document to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/send/media`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: msgId, number, type: 'document', url: mediaUrl,
          caption, filename: `${brochure.name.replace(/\s+/g, '-')}.pdf`,
        }),
      });
    } else if (isImage) {
      console.log(`[WhatsApp] Sending image to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/send/media`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: msgId, number, type: 'image', url: mediaUrl, caption }),
      });
    } else if (isVideo && !isLink) {
      console.log(`[WhatsApp] Sending video to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/send/media`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: msgId, number, type: 'video', url: mediaUrl, caption }),
      });
    } else {
      // Text/link path: include the URL only if the body doesn't already contain it
      const bodyHasUrl = mediaUrl && caption.includes(mediaUrl);
      const textBody = mediaUrl && !bodyHasUrl ? `${caption}\n\n${mediaUrl}` : caption;
      console.log(`[WhatsApp] Sending text message to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/send/text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: msgId, number, text: textBody }),
      });
    }

    const data = await response.json();
    console.log(`[WhatsApp] Message sent to ${number} via ${instanceName}: ${JSON.stringify(data).substring(0, 200)}`);
    return { success: true, data, instance: instanceName };
  } catch (err) {
    console.error(`[WhatsApp] Failed to send message to ${number}:`, err.message);
    return { success: false, error: err.message };
  }
}

function deleteBrochure(projectKey) {
  const brochures = loadBrochures();
  delete brochures[projectKey.toLowerCase()];
  saveBrochures(brochures);
  return brochures;
}

module.exports = { sendBrochure, getBrochures, setBrochure, deleteBrochure };
