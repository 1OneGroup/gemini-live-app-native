// WhatsApp brochure integration via Evo Go API
const fs = require('fs');
const path = require('path');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evo-go.tech.onegroup.co.in';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'office_bot';
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

// Cache for instance credentials to avoid fetching on every send
let instanceCache = null;
let instanceCacheTime = 0;
const INSTANCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchInstances() {
  if (instanceCache && Date.now() - instanceCacheTime < INSTANCE_CACHE_TTL) {
    return instanceCache;
  }
  const res = await fetch(`${EVOLUTION_API_URL}/instance/all`, {
    headers: { 'apikey': EVOLUTION_API_KEY },
  });
  const data = await res.json();
  instanceCache = data.data || [];
  instanceCacheTime = Date.now();
  return instanceCache;
}

// Returns { id, token } for a given instance name
async function getInstanceCredentials(instanceName) {
  try {
    const instances = await fetchInstances();
    const match = instances.find(i => i.name === instanceName);
    if (match) return { id: match.id, token: match.token };
    // Fall back to first connected instance
    const connected = instances.find(i => i.connected);
    if (connected) {
      console.warn(`[WhatsApp] Instance "${instanceName}" not found, using "${connected.name}"`);
      return { id: connected.id, token: connected.token };
    }
  } catch (err) {
    console.error('[WhatsApp] Failed to fetch instances:', err.message);
  }
  return null;
}

// Resolve which instance name to use for an employee
async function resolveInstance(employeeName) {
  if (!employeeName) return EVOLUTION_INSTANCE;
  try {
    const db = require('./db');
    const emp = await db.getEmployeeByName(employeeName);
    if (emp?.instance_name) return emp.instance_name;
  } catch {}
  return EVOLUTION_INSTANCE;
}

async function sendBrochure(phoneNumber, projectName, employeeName) {
  const brochures = loadBrochures();
  const key = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
  let brochure = brochures[key];
  if (!brochure) {
    for (const [k, v] of Object.entries(brochures)) {
      if (key.includes(k) || k.includes(key)) { brochure = v; break; }
    }
  }

  if (!brochure) {
    console.error(`[WhatsApp] No brochure found for project: ${projectName} (normalized: ${key})`);
    return { success: false, error: `No brochure configured for "${projectName}"` };
  }

  // Normalize phone number (remove + prefix, ensure country code)
  let number = phoneNumber.replace(/[^0-9]/g, '');
  if (number.startsWith('0')) number = '91' + number.substring(1);
  if (!number.startsWith('91') && number.length === 10) number = '91' + number;

  const instanceName = await resolveInstance(employeeName);
  console.log(`[WhatsApp] Using instance: ${instanceName} (employee: ${employeeName || 'default'})`);

  const creds = await getInstanceCredentials(instanceName);
  if (!creds) {
    console.error('[WhatsApp] No connected WhatsApp instance found');
    return { success: false, error: 'No connected WhatsApp instance found' };
  }

  const headers = { 'Content-Type': 'application/json', 'apikey': creds.token };

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
          id: creds.id, number, type: 'document', url: mediaUrl,
          caption, filename: `${brochure.name.replace(/\s+/g, '-')}.pdf`,
        }),
      });
    } else if (isImage) {
      console.log(`[WhatsApp] Sending image to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/send/media`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: creds.id, number, type: 'image', url: mediaUrl, caption }),
      });
    } else if (isVideo && !isLink) {
      console.log(`[WhatsApp] Sending video to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/send/media`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: creds.id, number, type: 'video', url: mediaUrl, caption }),
      });
    } else {
      const textBody = caption + '\n\n' + mediaUrl;
      console.log(`[WhatsApp] Sending text message with link to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/send/text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: creds.id, number, text: textBody }),
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
