// app.js — Frontend JavaScript for Gemini Live Lead Classifier Dashboard
// Vanilla JS, no frameworks. Communicates with the Express backend via fetch API.

// ── State ─────────────────────────────────────────────────────────────────────

let allLeads = [];
let currentFilter = 'all';
let searchQuery = '';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadLeads();
  loadWebhookInfo();
  bindGlobalEvents();
});

// ── Event Bindings ────────────────────────────────────────────────────────────

function bindGlobalEvents() {
  // Fetch Calls button
  document.getElementById('fetchCallsBtn').addEventListener('click', fetchCalls);

  // Process All button
  document.getElementById('processAllBtn').addEventListener('click', processAll);

  // Search input — debounced for performance
  const searchInput = document.getElementById('searchInput');
  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = e.target.value.trim();
      renderLeads(filterLeads(allLeads));
    }, 200);
  });
}

// ── Webhook Info ──────────────────────────────────────────────────────────────

/**
 * Fetches the webhook URL from the backend and displays it in the banner.
 */
async function loadWebhookInfo() {
  try {
    const info = await apiGet('/api/webhook-info');
    const urlEl = document.getElementById('webhookUrl');
    if (urlEl) urlEl.textContent = info.webhookUrl;
  } catch {
    // Non-critical — silently ignore if this fails
  }
}

/**
 * Copies the webhook URL to clipboard.
 */
async function copyWebhookUrl() {
  const urlEl = document.getElementById('webhookUrl');
  if (!urlEl) return;
  try {
    await navigator.clipboard.writeText(urlEl.textContent);
    showToast('Webhook URL copied to clipboard!', 'success');
  } catch {
    showToast('Copy failed — please copy manually.', 'warning');
  }
}

// ── Data Loading ──────────────────────────────────────────────────────────────

/**
 * Loads all leads from the backend and refreshes the UI.
 */
async function loadLeads() {
  try {
    allLeads = await apiGet('/api/leads');
    renderStats(allLeads);
    renderLeads(filterLeads(allLeads));
  } catch (err) {
    showToast('Failed to load leads: ' + err.message, 'error');
  }
}

// ── Filtering ─────────────────────────────────────────────────────────────────

/**
 * Sets the active filter and re-renders the leads grid.
 * Called from onclick attributes on stat cards and filter buttons.
 * @param {string} filter
 */
function setFilter(filter) {
  currentFilter = filter;

  // Update filter button active state
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  // Update stat card active state
  document.querySelectorAll('.stat-card').forEach(card => {
    card.classList.toggle('active', card.dataset.filter === filter);
  });

  renderLeads(filterLeads(allLeads));
}

/**
 * Filters leads by current filter and search query.
 * @param {Array} leads
 * @returns {Array}
 */
function filterLeads(leads) {
  return leads.filter(lead => {
    // Filter by classification/status tab
    let passesFilter = true;
    if (currentFilter === 'all') {
      passesFilter = true;
    } else if (currentFilter === 'review') {
      passesFilter = lead.needsManualReview === true;
    } else if (currentFilter === 'unprocessed') {
      passesFilter = !lead.classification;
    } else {
      passesFilter = lead.classification === currentFilter;
    }

    // Filter by search query (phone number or reason text)
    let passesSearch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const phoneMatch = lead.phone && lead.phone.toLowerCase().includes(q);
      const reasonMatch = lead.reason && lead.reason.toLowerCase().includes(q);
      const transcriptMatch = lead.transcript && lead.transcript.toLowerCase().includes(q);
      passesSearch = phoneMatch || reasonMatch || transcriptMatch;
    }

    return passesFilter && passesSearch;
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Updates the stats row with current counts.
 * @param {Array} leads
 */
function renderStats(leads) {
  document.getElementById('statTotal').textContent = leads.length;
  document.getElementById('statInterested').textContent =
    leads.filter(l => l.classification === 'INTERESTED').length;
  document.getElementById('statNotInterested').textContent =
    leads.filter(l => l.classification === 'NOT_INTERESTED').length;
  document.getElementById('statFollowUp').textContent =
    leads.filter(l => l.classification === 'FOLLOW_UP_LATER').length;
  document.getElementById('statReview').textContent =
    leads.filter(l => l.needsManualReview).length;
}

/**
 * Renders the lead cards grid.
 * @param {Array} leads - Filtered leads to display
 */
function renderLeads(leads) {
  const grid = document.getElementById('leadsGrid');

  if (leads.length === 0) {
    const message = searchQuery
      ? `No leads match "<strong>${escapeHtml(searchQuery)}</strong>".`
      : currentFilter === 'all'
        ? 'No leads yet. Click <strong>Fetch New Calls</strong> to get started.'
        : 'No leads in this category.';

    grid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
        </svg>
        <p>${message}</p>
      </div>`;
    return;
  }

  grid.innerHTML = leads.map(renderLeadCard).join('');
}

/**
 * Renders a single lead card HTML string.
 * @param {Object} lead
 * @returns {string} HTML string
 */
function renderLeadCard(lead) {
  const classKey = classificationKey(lead.classification);

  // Classification badge
  const badgeLabel = lead.classification
    ? lead.classification.replace(/_/g, ' ')
    : 'UNPROCESSED';
  const badgeClass = lead.classification
    ? classKey
    : 'unprocessed';

  // Review badge
  const reviewBadge = lead.needsManualReview
    ? `<span class="badge review">NEEDS REVIEW</span>`
    : '';

  // Override badge
  const overrideBadge = lead.manuallyOverridden
    ? `<span class="badge override">OVERRIDDEN</span>`
    : '';

  // Source badge — show "Gemini Live" if came via webhook
  const sourceBadge = lead.source === 'gemini-live-webhook'
    ? `<span class="badge source-gemini">Gemini Live</span>`
    : '';

  // Confidence bar
  const confidenceHtml = lead.confidence != null ? (() => {
    const c = lead.confidence;
    const fillClass = c >= 75 ? 'high' : c >= 50 ? 'medium' : 'low';
    return `
      <div class="confidence-wrap">
        <div class="confidence-bar">
          <div class="fill ${fillClass}" style="width: ${c}%"></div>
        </div>
        <span class="confidence-text">${c}% confidence</span>
      </div>`;
  })() : '';

  // Reason
  const reasonHtml = lead.reason
    ? `<p class="card-reason">"${escapeHtml(lead.reason)}"</p>`
    : '';

  // Key signal tags
  const signalsHtml = (lead.keySignals && lead.keySignals.length > 0)
    ? `<div class="signals">${lead.keySignals.map(s => `<span class="signal-tag">${escapeHtml(s)}</span>`).join('')}</div>`
    : '';

  // Action buttons based on lead status
  const transcribeBtn = (!lead.transcript && lead.recordingUrl && lead.status !== 'transcription_failed')
    ? `<button class="btn btn-sm btn-secondary" onclick="transcribeOne('${lead.id}')">Transcribe</button>`
    : '';

  const retryTranscribeBtn = (lead.status === 'transcription_failed')
    ? `<button class="btn btn-sm btn-secondary" onclick="transcribeOne('${lead.id}')">Retry Transcribe</button>`
    : '';

  const viewTranscriptBtn = lead.transcript
    ? `<button class="btn btn-sm btn-secondary" onclick="viewTranscript('${lead.id}')">View Transcript</button>`
    : '';

  const reclassifyBtn = (lead.transcript && lead.classification)
    ? `<button class="btn btn-sm btn-secondary" onclick="reclassifyOne('${lead.id}')">Re-classify</button>`
    : '';

  const classifyBtn = (lead.transcript && !lead.classification && lead.status !== 'classification_failed')
    ? `<button class="btn btn-sm btn-secondary" onclick="classifyOne('${lead.id}')">Classify</button>`
    : '';

  const retryClassifyBtn = (lead.status === 'classification_failed')
    ? `<button class="btn btn-sm btn-secondary" onclick="classifyOne('${lead.id}')">Retry Classify</button>`
    : '';

  // Status indicator for failed states
  const failedStatus = (lead.status === 'transcription_failed' || lead.status === 'classification_failed')
    ? `<span class="card-status failed">${lead.status === 'transcription_failed' ? 'Transcription Failed' : 'Classification Failed'}</span>`
    : '';

  return `
    <div class="lead-card ${classKey}" data-id="${lead.id}">
      <div class="card-header">
        <span class="phone">${lead.customerName ? escapeHtml(lead.customerName) + ' · ' : ''}${escapeHtml(lead.phone || 'Unknown')}</span>
        <div class="badges">
          <span class="badge ${badgeClass}">${badgeLabel}</span>
          ${reviewBadge}
          ${overrideBadge}
          ${sourceBadge}
        </div>
      </div>

      <div class="card-meta">
        <span>
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${formatDate(lead.callDate)}
        </span>
        <span>
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${formatDuration(lead.callDuration)}
        </span>
        ${lead.direction ? `<span>${lead.direction}</span>` : ''}
      </div>

      ${confidenceHtml}
      ${reasonHtml}
      ${signalsHtml}
      ${failedStatus}

      <div class="card-actions">
        ${transcribeBtn}
        ${retryTranscribeBtn}
        ${viewTranscriptBtn}
        ${reclassifyBtn}
        ${classifyBtn}
        ${retryClassifyBtn}
        <select class="override-select" onchange="manualOverride('${lead.id}', this.value); this.value='';">
          <option value="">Override...</option>
          <option value="INTERESTED">INTERESTED</option>
          <option value="NOT_INTERESTED">NOT INTERESTED</option>
          <option value="FOLLOW_UP_LATER">FOLLOW UP LATER</option>
        </select>
        <button class="btn btn-sm btn-danger" onclick="deleteLead('${lead.id}')">Delete</button>
      </div>
    </div>`;
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
/**
 * Fetches new calls from Plivo via the backend.
 */
async function fetchCalls() {
  const btn = document.getElementById('fetchCallsBtn');
  btn.disabled = true;

  try {
    showToast('Fetching calls from Plivo...', 'info');
    const result = await apiPost('/api/fetch-calls');
    showToast(`${result.message || 'Fetch complete.'}`, 'success');
    await loadLeads();
  } catch (err) {
    showToast('Fetch failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

/**
 * Runs the full process pipeline (fetch → transcribe → classify) with live SSE progress.
 */
async function processAll() {
  const btn = document.getElementById('processAllBtn');
  const fetchBtn = document.getElementById('fetchCallsBtn');
  btn.disabled = true;
  fetchBtn.disabled = true;

  showProgressBanner('Starting full pipeline...');

  let totalSteps = 0;
  let completedSteps = 0;

  try {
    const response = await fetch('/api/process-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.status === 409) {
      showToast('Processing is already running. Please wait.', 'warning');
      hideProgressBanner();
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Process All failed');
    }

    // Read the SSE stream from the POST response body
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process all complete SSE messages in the buffer
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        let event;
        try {
          event = JSON.parse(line.slice(6));
        } catch {
          continue;
        }

        // Handle each SSE step event
        switch (event.step) {
          case 'fetch':
            updateProgress('Fetching calls from Plivo...', 5, 'Fetch');
            break;

          case 'fetch_error':
            addProgressLog(`Warning: ${event.message}`);
            break;

          case 'transcribe_start':
            totalSteps = (event.total || 0) * 2; // transcribe + classify
            updateProgress(`Transcribing ${event.total} lead(s)...`, 15, 'Transcribing');
            break;

          case 'transcribing':
            if (event.total > 0) {
              const pct = 15 + ((event.current / event.total) * 35);
              updateProgress(`Transcribing ${event.phone}...`, pct, `${event.current}/${event.total}`);
            }
            break;

          case 'transcribed':
            addProgressLog(`Transcribed: ${event.phone}`);
            break;

          case 'transcribe_failed':
            addProgressLog(`Failed transcription: ${event.phone}`);
            break;

          case 'classify_start':
            updateProgress(`Classifying ${event.total} lead(s)...`, 55, 'Classifying');
            break;

          case 'classifying':
            if (event.total > 0) {
              const pct = 55 + ((event.current / event.total) * 40);
              updateProgress(`Classifying ${event.phone}...`, pct, `${event.current}/${event.total}`);
            }
            break;

          case 'classified':
            addProgressLog(`Classified ${event.phone}: ${event.classification} (${event.confidence}%)`);
            break;

          case 'classify_failed':
            addProgressLog(`Failed classification: ${event.phone}`);
            break;

          case 'done':
            updateProgress('All processing complete!', 100, 'Done');
            showToast(
              `Done! Fetched: ${event.newCallsFetched}, Transcribed: ${event.transcribed}, Classified: ${event.classified}`,
              'success'
            );
            await loadLeads();
            setTimeout(hideProgressBanner, 2500);
            break;

          case 'error':
            showToast('Error: ' + event.message, 'error');
            addProgressLog(`Error: ${event.message}`);
            hideProgressBanner();
            break;
        }
      }
    }

  } catch (err) {
    showToast('Process All failed: ' + err.message, 'error');
    hideProgressBanner();
  } finally {
    btn.disabled = false;
    fetchBtn.disabled = false;
  }
}

/**
 * Transcribes a single lead's audio.
 * @param {string} leadId
 */
async function transcribeOne(leadId) {
  const card = document.querySelector(`[data-id="${leadId}"]`);
  if (card) card.style.opacity = '0.6';

  try {
    showToast('Transcribing audio...', 'info');
    const lead = await apiPost(`/api/transcribe/${leadId}`);
    updateLeadInState(lead);
    showToast('Transcription complete.', 'success');
    renderLeads(filterLeads(allLeads));
  } catch (err) {
    showToast('Transcription failed: ' + err.message, 'error');
    // Reload to get updated status (it will show as failed)
    await loadLeads();
  } finally {
    if (card) card.style.opacity = '1';
  }
}

/**
 * Classifies a single lead's transcript.
 * @param {string} leadId
 */
async function classifyOne(leadId) {
  const card = document.querySelector(`[data-id="${leadId}"]`);
  if (card) card.style.opacity = '0.6';

  try {
    showToast('Classifying transcript...', 'info');
    const lead = await apiPost(`/api/classify/${leadId}`);
    updateLeadInState(lead);
    renderStats(allLeads);
    renderLeads(filterLeads(allLeads));
    showToast(`Classified as ${lead.classification}`, 'success');
  } catch (err) {
    showToast('Classification failed: ' + err.message, 'error');
    await loadLeads();
  } finally {
    if (card) card.style.opacity = '1';
  }
}

/**
 * Re-classifies a lead (same as classify but always re-runs).
 * @param {string} leadId
 */
async function reclassifyOne(leadId) {
  await classifyOne(leadId);
}

/**
 * Opens the transcript modal for a lead.
 * @param {string} leadId
 */
function viewTranscript(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead || !lead.transcript) return;

  document.getElementById('modalPhone').textContent = lead.phone || 'Unknown';
  document.getElementById('modalMeta').textContent =
    `${formatDate(lead.callDate)} · ${formatDuration(lead.callDuration)} · ${lead.classification || 'Unclassified'}`;
  document.getElementById('modalTranscript').textContent = lead.transcript;

  document.getElementById('transcriptModal').classList.remove('hidden');
}

/**
 * Closes the transcript modal when clicking the backdrop.
 * @param {Event} e
 */
function closeModal(e) {
  if (e.target === document.getElementById('transcriptModal')) {
    closeModalDirect();
  }
}

/**
 * Closes the transcript modal directly.
 */
function closeModalDirect() {
  document.getElementById('transcriptModal').classList.add('hidden');
}

/**
 * Manually overrides a lead's classification.
 * @param {string} leadId
 * @param {string} classification
 */
async function manualOverride(leadId, classification) {
  if (!classification) return;

  try {
    const lead = await apiPatch(`/api/leads/${leadId}`, { classification });
    updateLeadInState(lead);
    renderStats(allLeads);
    renderLeads(filterLeads(allLeads));
    showToast(`Classification overridden to ${classification}`, 'success');
  } catch (err) {
    showToast('Override failed: ' + err.message, 'error');
  }
}

/**
 * Deletes a lead after confirmation.
 * @param {string} leadId
 */
async function deleteLead(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!confirm(`Delete lead ${lead ? lead.phone : leadId}? This cannot be undone.`)) return;

  try {
    await apiDelete(`/api/leads/${leadId}`);
    allLeads = allLeads.filter(l => l.id !== leadId);
    renderStats(allLeads);
    renderLeads(filterLeads(allLeads));
    showToast('Lead deleted.', 'info');
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// ── State Helpers ─────────────────────────────────────────────────────────────

/**
 * Updates a single lead in the allLeads array with fresh data from the server.
 * @param {Object} updatedLead
 */
function updateLeadInState(updatedLead) {
  const idx = allLeads.findIndex(l => l.id === updatedLead.id);
  if (idx !== -1) {
    allLeads[idx] = updatedLead;
  } else {
    allLeads.unshift(updatedLead);
  }
}

// ── Progress Banner ───────────────────────────────────────────────────────────

function showProgressBanner(message) {
  const banner = document.getElementById('progressBanner');
  banner.classList.remove('hidden');
  document.getElementById('progressTitle').textContent = message;
  document.getElementById('progressStep').textContent = '';
  document.getElementById('progressLog').innerHTML = '';
  const fill = document.getElementById('progressFill');
  fill.style.width = '0%';
  fill.classList.add('indeterminate');
}

function updateProgress(message, pct, stepLabel) {
  document.getElementById('progressTitle').textContent = message;
  document.getElementById('progressStep').textContent = stepLabel || '';
  const fill = document.getElementById('progressFill');
  fill.classList.remove('indeterminate');
  fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function addProgressLog(message) {
  const log = document.getElementById('progressLog');
  const line = document.createElement('span');
  line.textContent = message;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function hideProgressBanner() {
  document.getElementById('progressBanner').classList.add('hidden');
}

// ── Toast Notifications ───────────────────────────────────────────────────────

/**
 * Shows a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Auto-remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ── API Helpers ───────────────────────────────────────────────────────────────

async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function apiPost(url, body = null) {
  const opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function apiPatch(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Formatting Utilities ──────────────────────────────────────────────────────

/**
 * Returns a CSS class key from a classification string.
 * Maps "NOT_INTERESTED" → "not-interested", etc.
 * @param {string|null} classification
 * @returns {string}
 */
function classificationKey(classification) {
  if (!classification) return 'unprocessed';
  return classification.toLowerCase().replace(/_/g, '-');
}

/**
 * Formats an ISO date string for Indian locale display.
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return iso;
  }
}

/**
 * Formats a duration in seconds to "Xm Ys" format.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
