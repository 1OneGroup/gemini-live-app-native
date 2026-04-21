// WhatsApp brochure integration via Evolution API
const fs = require('fs');
const path = require('path');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://evolution-api-fgxi-api-1:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'onegroup';
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

// Resolve which Evolution API instance to use for an employee
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
  // Try exact match first, then check if any key is contained in the normalized name
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

  // Route to employee's WhatsApp instance if available
  const instance = await resolveInstance(employeeName);
  console.log(`[WhatsApp] Using instance: ${instance} (employee: ${employeeName || 'default'})`);

  try {
    const mediaUrl = brochure.url || '';
    const caption = brochure.caption || `Here is the ${brochure.name} details.`;
    const isLink = /youtube\.com|youtu\.be|vimeo\.com/i.test(mediaUrl) || !/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|png|jpg|jpeg|gif|webp|mp4|mov|avi)(\?|$)/i.test(mediaUrl);
    const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(mediaUrl);
    const isVideo = /\.(mp4|mov|avi)(\?|$)/i.test(mediaUrl);
    const isPdf = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)(\?|$)/i.test(mediaUrl);

    let response;
    if (isPdf) {
      // Send as document attachment
      console.log(`[WhatsApp] Sending document to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify({
          number, mediatype: 'document', media: mediaUrl,
          caption, fileName: `${brochure.name.replace(/\s+/g, '-')}.pdf`,
        }),
      });
    } else if (isImage) {
      // Send as image
      console.log(`[WhatsApp] Sending image to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify({ number, mediatype: 'image', media: mediaUrl, caption }),
      });
    } else if (isVideo && !isLink) {
      // Send as video attachment
      console.log(`[WhatsApp] Sending video to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify({ number, mediatype: 'video', media: mediaUrl, caption }),
      });
    } else {
      // YouTube links or other URLs — send as text message with link
      const textBody = caption + '\n\n' + mediaUrl;
      console.log(`[WhatsApp] Sending text message with link to ${number}`);
      response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify({ number, text: textBody }),
      });
    }

    const data = await response.json();
    console.log(`[WhatsApp] Message sent to ${number} via ${instance}: ${JSON.stringify(data).substring(0, 200)}`);
    return { success: true, data, instance };
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
