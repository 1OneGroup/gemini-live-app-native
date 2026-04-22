// src/integrations/evolution.js
// Single source of truth for the Evolution / Evo-Go WhatsApp API configuration
// and shared low-level helpers (fetchInstances, getInstanceCredentials).
//
// Both src/integrations/whatsapp.js and src/routes/evolution.js import from here
// so the base URL / key never diverges between callers.

// ---- Config ----------------------------------------------------------------
function getEvoUrl() {
  return process.env.EVOLUTION_API_URL || 'https://evo-go.tech.onegroup.co.in';
}

function getEvoKey() {
  return process.env.EVOLUTION_API_KEY || '';
}

function getDefaultInstance() {
  return process.env.EVOLUTION_INSTANCE || 'office_bot';
}

// ---- Instance cache --------------------------------------------------------
let instanceCache = null;
let instanceCacheTime = 0;
const INSTANCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetches all instances from the Evolution API (cached for 5 minutes).
async function fetchInstances() {
  if (instanceCache && Date.now() - instanceCacheTime < INSTANCE_CACHE_TTL) {
    return instanceCache;
  }
  const res = await fetch(`${getEvoUrl()}/instance/all`, {
    headers: { 'apikey': getEvoKey() },
  });
  const data = await res.json();
  instanceCache = data.data || [];
  instanceCacheTime = Date.now();
  return instanceCache;
}

// Invalidate the instance cache (call after create/delete).
function clearInstanceCache() {
  instanceCache = null;
  instanceCacheTime = 0;
}

// Returns { id, token } for instanceName, falling back to the first connected
// instance if not found. Returns null if nothing is connected.
async function getInstanceCredentials(instanceName) {
  try {
    const instances = await fetchInstances();
    const match = instances.find(i => i.name === instanceName);
    if (match) return { id: match.id, token: match.token };
    const connected = instances.find(i => i.connected);
    if (connected) {
      console.warn(`[Evolution] Instance "${instanceName}" not found, using "${connected.name}"`);
      return { id: connected.id, token: connected.token };
    }
  } catch (err) {
    console.error('[Evolution] Failed to fetch instances:', err.message);
  }
  return null;
}

// Returns the formatted instance list as expected by the dashboard
// (maps Evo-Go schema to { name, connectionStatus, profileName }).
async function listInstances() {
  const res = await fetch(`${getEvoUrl()}/instance/all`, {
    headers: { 'apikey': getEvoKey() },
  });
  const data = await res.json();
  return (Array.isArray(data.data) ? data.data : []).map(i => ({
    name: i.name,
    connectionStatus: i.connected ? 'open' : 'close',
    profileName: i.jid || null,
  }));
}

// Creates a new Evolution instance.
async function createInstance(instanceName) {
  const res = await fetch(`${getEvoUrl()}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': getEvoKey() },
    body: JSON.stringify({ name: instanceName }),
  });
  return res.json();
}

// Generic GET proxy — passes the request path through to Evolution API.
async function proxyGet(apiPath) {
  const res = await fetch(`${getEvoUrl()}/${apiPath}`, {
    headers: { 'apikey': getEvoKey() },
  });
  return res.json();
}

module.exports = {
  getEvoUrl, getEvoKey, getDefaultInstance,
  fetchInstances, clearInstanceCache, getInstanceCredentials,
  listInstances, createInstance, proxyGet,
};
