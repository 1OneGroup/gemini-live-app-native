// app.js — Frontend JavaScript for Gemini Live Lead Classifier Dashboard
// Vanilla JS, no frameworks. Communicates with the Express backend via fetch API.

// ── State ─────────────────────────────────────────────────────────────────────

let allLeads = [];
let currentFilter = 'all';
let searchQuery = '';
let currentSort = 'date-desc';
let advancedFilter = 'all';

// One Group chart palette (Part 3.1 chart-1..5)
const CHART_SEGMENTS = [
  { key: 'INTERESTED',      label: 'Interested',      color: '#762224' },
  { key: 'NOT_INTERESTED',  label: 'Not Interested',  color: '#d4453a' },
  { key: 'FOLLOW_UP_LATER', label: 'Follow Up Later', color: '#c45a5c' },
  { key: 'review',          label: 'Needs Review',    color: '#5e5d59' },
  { key: 'unprocessed',     label: 'Unprocessed',     color: '#e8e6dc' },
];

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

  // Re-classify Interested button
  document.getElementById('reclassifyInterestedBtn').addEventListener('click', reclassifyInterested);

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

  // Sort dropdown
  const sortSel = document.getElementById('sortSelect');
  if (sortSel) sortSel.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderLeads(filterLeads(allLeads));
  });

  // Advanced filter dropdown
  const advSel = document.getElementById('advancedFilter');
  if (advSel) advSel.addEventListener('change', (e) => {
    advancedFilter = e.target.value;
    renderLeads(filterLeads(allLeads));
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
    renderStats(allLeads); renderChart(allLeads);
    renderChart(allLeads);
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
  const filtered = leads.filter(lead => {
    // Filter by classification/status tab
    let passesFilter = true;
    if (currentFilter === 'all') {
      passesFilter = true;
    } else if (currentFilter === 'review') {
      passesFilter = lead.needsManualReview === true;
    } else if (currentFilter === 'VISITING') {
      passesFilter = lead.classification === 'INTERESTED' && lead.subClassification === 'VISITING';
    } else if (currentFilter === 'NOT_VISITING') {
      passesFilter = lead.classification === 'INTERESTED' && lead.subClassification === 'NOT_VISITING';
    } else if (currentFilter === 'unprocessed') {
      passesFilter = !lead.classification;
    } else {
      passesFilter = lead.classification === currentFilter;
    }

    // Filter by search query across every user-visible text field on a lead
    let passesSearch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = [
        lead.phone,
        lead.customerName,
        lead.reason,
        lead.transcript,
        lead.subClassification,
        lead.classification,
        lead.hangupCause,
        Array.isArray(lead.keySignals) ? lead.keySignals.join(' ') : ''
      ].filter(Boolean).join(' ').toLowerCase();
      passesSearch = haystack.includes(q);
    }

    // Advanced filter
    let passesAdvanced = true;
    switch (advancedFilter) {
      case 'dir:inbound':
        passesAdvanced = (lead.direction || '').toLowerCase() === 'inbound'; break;
      case 'dir:outbound':
        passesAdvanced = (lead.direction || '').toLowerCase() === 'outbound'; break;
      case 'overridden':
        passesAdvanced = lead.manuallyOverridden === true; break;
      case 'not-overridden':
        passesAdvanced = !lead.manuallyOverridden; break;
      case 'has-recording':
        passesAdvanced = !!lead.recordingUrl; break;
      case 'no-transcript':
        passesAdvanced = !lead.transcript; break;
      case 'failed':
        passesAdvanced = lead.status === 'transcription_failed' || lead.status === 'classification_failed'; break;
    }

    return passesFilter && passesSearch && passesAdvanced;
  });

  // Sort
  const sorted = [...filtered];
  const cmpDate = (a, b) => new Date(a.callDate || 0) - new Date(b.callDate || 0);
  const cmpDur = (a, b) => (a.callDuration || 0) - (b.callDuration || 0);
  const cmpConf = (a, b) => (a.confidence ?? -1) - (b.confidence ?? -1);
  switch (currentSort) {
    case 'date-asc':       sorted.sort(cmpDate); break;
    case 'date-desc':      sorted.sort((a, b) => cmpDate(b, a)); break;
    case 'duration-asc':   sorted.sort(cmpDur); break;
    case 'duration-desc':  sorted.sort((a, b) => cmpDur(b, a)); break;
    case 'confidence-asc': sorted.sort(cmpConf); break;
    case 'confidence-desc':sorted.sort((a, b) => cmpConf(b, a)); break;
  }
  return sorted;
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
  document.getElementById('statVisiting').textContent =
    leads.filter(l => l.classification === 'INTERESTED' && l.subClassification === 'VISITING').length;
  document.getElementById('statNotVisiting').textContent =
    leads.filter(l => l.classification === 'INTERESTED' && l.subClassification === 'NOT_VISITING').length;
  document.getElementById('statReview').textContent =
    leads.filter(l => l.needsManualReview).length;
}

/**
 * Renders the donut chart of classification breakdown.
 * @param {Array} leads
 */
function renderChart(leads) {
  const segmentsEl = document.getElementById('donutSegments');
  const legendEl = document.getElementById('chartLegend');
  const centerNum = document.getElementById('donutCenterNum');
  const centerLabel = document.getElementById('donutCenterLabel');
  const totalLabel = document.getElementById('chartTotalLabel');
  if (!segmentsEl || !legendEl) return;

  const counts = {
    INTERESTED:      leads.filter(l => l.classification === 'INTERESTED').length,
    NOT_INTERESTED:  leads.filter(l => l.classification === 'NOT_INTERESTED').length,
    FOLLOW_UP_LATER: leads.filter(l => l.classification === 'FOLLOW_UP_LATER').length,
    review:          leads.filter(l => l.needsManualReview && l.classification).length,
    unprocessed:     leads.filter(l => !l.classification).length,
  };
  // Avoid double-counting: review subtracts from its primary classification visually,
  // but we only show it as a distinct slice. To keep totals correct, exclude review
  // from primary slices.
  const reviewIds = new Set(leads.filter(l => l.needsManualReview && l.classification).map(l => l.id));
  counts.INTERESTED      = leads.filter(l => l.classification === 'INTERESTED' && !reviewIds.has(l.id)).length;
  counts.NOT_INTERESTED  = leads.filter(l => l.classification === 'NOT_INTERESTED' && !reviewIds.has(l.id)).length;
  counts.FOLLOW_UP_LATER = leads.filter(l => l.classification === 'FOLLOW_UP_LATER' && !reviewIds.has(l.id)).length;

  const total = leads.length;
  const sumSlices = CHART_SEGMENTS.reduce((s, seg) => s + counts[seg.key], 0) || 1;

  // Donut geometry: r=48, circumference ≈ 301.59
  const r = 48;
  const C = 2 * Math.PI * r;
  let offset = 0;
  let svg = '';
  for (const seg of CHART_SEGMENTS) {
    const value = counts[seg.key];
    if (value === 0) continue;
    const portion = value / sumSlices;
    const dash = portion * C;
    svg += `<circle cx="60" cy="60" r="${r}" fill="none"
      stroke="${seg.color}" stroke-width="14"
      stroke-dasharray="${dash.toFixed(3)} ${(C - dash).toFixed(3)}"
      stroke-dashoffset="${(-offset).toFixed(3)}">
      <title>${seg.label}: ${value}</title>
    </circle>`;
    offset += dash;
  }
  segmentsEl.innerHTML = svg;

  centerNum.textContent = String(total);
  centerLabel.textContent = total === 1 ? 'lead' : 'leads';
  totalLabel.textContent = `${total} ${total === 1 ? 'lead' : 'leads'}`;

  // Legend
  legendEl.innerHTML = CHART_SEGMENTS.map(seg => {
    const value = counts[seg.key];
    const pct = total ? Math.round((value / sumSlices) * 100) : 0;
    const filterAttr = seg.key === 'unprocessed' ? 'unprocessed'
                     : seg.key === 'review' ? 'review'
                     : seg.key;
    return `
      <li class="legend-item" data-filter="${filterAttr}" onclick="setFilter('${filterAttr}')">
        <span class="legend-dot" style="background:${seg.color}"></span>
        <span class="legend-label">${seg.label}</span>
        <span class="legend-value">${value}<span class="legend-pct"> · ${pct}%</span></span>
      </li>`;
  }).join('');
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

  const header = `
    <div class="lead-row lead-row-header" aria-hidden="true">
      <div class="row-identity">Lead</div>
      <div class="row-badges">Classification</div>
      <div class="row-meta row-conf">Conf.</div>
      <div class="row-meta row-dir">Direction</div>
      <div class="row-meta row-dur">Duration</div>
      <div class="row-meta row-date">Call date</div>
    </div>`;
  grid.innerHTML = header + leads.map(renderLeadCard).join('');
}

/**
 * Renders a compact lead card (name, phone, badge only).
 * Clicking the card opens the detail modal.
 * @param {Object} lead
 * @returns {string} HTML string
 */
function renderLeadCard(lead) {
  const classKey = classificationKey(lead.classification);

  const badgeLabel = lead.classification
    ? lead.classification.replace(/_/g, ' ')
    : 'UNPROCESSED';
  const badgeClass = lead.classification
    ? classKey
    : 'unprocessed';

  const name = lead.customerName ? escapeHtml(lead.customerName) : '';
  const phone = escapeHtml(lead.phone || 'Unknown');

  const subBadgeHtml = (lead.classification === 'INTERESTED' && lead.subClassification)
    ? `<span class="badge ${lead.subClassification === 'VISITING' ? 'visiting' : 'not-visiting'}">${lead.subClassification.replace(/_/g, ' ')}</span>`
    : '';

  const reviewBadge = lead.needsManualReview ? `<span class="badge review">REVIEW</span>` : '';
  const overrideBadge = lead.manuallyOverridden ? `<span class="badge override">OVERRIDDEN</span>` : '';

  const conf = (lead.confidence != null) ? `${lead.confidence}%` : '—';
  const dateStr = lead.callDate ? escapeHtml(formatDate(lead.callDate)) : '—';
  const durStr = escapeHtml(formatDuration(lead.callDuration));
  const dirStr = lead.direction ? escapeHtml(lead.direction) : '—';

  return `
    <div class="lead-row ${classKey}" data-id="${lead.id}" onclick="viewLeadDetail('${lead.id}')" role="button" tabindex="0">
      <div class="row-identity">
        ${name
          ? `<div class="row-name">${name}</div><div class="row-phone">${phone}</div>`
          : `<div class="row-name">${phone}</div>`}
      </div>
      <div class="row-badges">
        <span class="badge ${badgeClass}">${badgeLabel}</span>
        ${subBadgeHtml}${reviewBadge}${overrideBadge}
      </div>
      <div class="row-meta row-conf" title="Confidence">${conf}</div>
      <div class="row-meta row-dir">${dirStr}</div>
      <div class="row-meta row-dur">${durStr}</div>
      <div class="row-meta row-date">${dateStr}</div>
    </div>`;
}

/**
 * Opens the lead detail modal with full information and actions.
 * @param {string} leadId
 */
function viewLeadDetail(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead) return;

  const classKey = classificationKey(lead.classification);
  const badgeLabel = lead.classification ? lead.classification.replace(/_/g, ' ') : 'UNPROCESSED';
  const badgeClass = lead.classification ? classKey : 'unprocessed';

  // Header
  const name = lead.customerName ? escapeHtml(lead.customerName) + ' · ' : '';
  document.getElementById('detailPhone').textContent = name + (lead.phone || 'Unknown');
  document.getElementById('detailMeta').textContent =
    `${formatDate(lead.callDate)} · ${formatDuration(lead.callDuration)}${lead.direction ? ' · ' + lead.direction : ''}`;

  // Build body content
  let html = '';

  // Badges row
  const subBadge = (lead.classification === 'INTERESTED' && lead.subClassification)
    ? `<span class="badge ${lead.subClassification === 'VISITING' ? 'visiting' : 'not-visiting'}">${lead.subClassification.replace(/_/g, ' ')}</span>`
    : '';
  const reviewBadge = lead.needsManualReview ? `<span class="badge review">NEEDS REVIEW</span>` : '';
  const overrideBadge = lead.manuallyOverridden ? `<span class="badge override">OVERRIDDEN</span>` : '';
  const sourceBadge = lead.source === 'gemini-live-webhook' ? `<span class="badge source-gemini">Gemini Live</span>` : '';
  html += `<div class="badges detail-badges"><span class="badge ${badgeClass}">${badgeLabel}</span>${subBadge}${reviewBadge}${overrideBadge}${sourceBadge}</div>`;

  // Confidence bar
  if (lead.confidence != null) {
    const c = lead.confidence;
    const fillClass = c >= 75 ? 'high' : c >= 50 ? 'medium' : 'low';
    html += `
      <div class="detail-section">
        <span class="detail-label">Confidence</span>
        <div class="confidence-wrap">
          <div class="confidence-bar"><div class="fill ${fillClass}" style="width: ${c}%"></div></div>
          <span class="confidence-text">${c}%</span>
        </div>
      </div>`;
  }

  // Reason
  if (lead.reason) {
    html += `
      <div class="detail-section">
        <span class="detail-label">Reason</span>
        <p class="card-reason">"${escapeHtml(lead.reason)}"</p>
      </div>`;
  }

  // Recording audio player
  if (lead.recordingUrl) {
    html += `
      <div class="detail-section audio-section">
        <span class="detail-label">Recording</span>
        <audio id="audio-${lead.id}" controls preload="metadata" class="audio-player" src="/api/leads/${lead.id}/recording"></audio>
        <div class="speed-controls" role="group" aria-label="Playback speed">
          ${[0.75, 1, 1.25, 1.5, 2].map(s => `
            <button type="button" class="speed-btn${s === 1 ? ' active' : ''}" data-speed="${s}" onclick="setPlaybackSpeed('${lead.id}', ${s}, this)">${s}x</button>
          `).join('')}
        </div>
      </div>`;
  }

  // Key signals
  if (lead.keySignals && lead.keySignals.length > 0) {
    html += `
      <div class="detail-section">
        <span class="detail-label">Key Signals</span>
        <div class="signals">${lead.keySignals.map(s => `<span class="signal-tag">${escapeHtml(s)}</span>`).join('')}</div>
      </div>`;
  }

  // Failed status
  if (lead.status === 'transcription_failed' || lead.status === 'classification_failed') {
    html += `<span class="card-status failed">${lead.status === 'transcription_failed' ? 'Transcription Failed' : 'Classification Failed'}</span>`;
  }

  // Actions
  const actions = [];
  if (!lead.transcript && lead.recordingUrl && lead.status !== 'transcription_failed')
    actions.push(`<button class="btn btn-sm btn-secondary" onclick="transcribeOne('${lead.id}')">Transcribe</button>`);
  if (lead.status === 'transcription_failed')
    actions.push(`<button class="btn btn-sm btn-secondary" onclick="transcribeOne('${lead.id}')">Retry Transcribe</button>`);
  if (lead.transcript)
    actions.push(`<button class="btn btn-sm btn-secondary" onclick="viewTranscript('${lead.id}')">View Transcript</button>`);
  if (lead.transcript && lead.classification)
    actions.push(`<button class="btn btn-sm btn-secondary" onclick="reclassifyOne('${lead.id}')">Re-classify</button>`);
  if (lead.transcript && !lead.classification && lead.status !== 'classification_failed')
    actions.push(`<button class="btn btn-sm btn-secondary" onclick="classifyOne('${lead.id}')">Classify</button>`);
  if (lead.status === 'classification_failed')
    actions.push(`<button class="btn btn-sm btn-secondary" onclick="classifyOne('${lead.id}')">Retry Classify</button>`);

  actions.push(`
    <select class="override-select" onchange="manualOverride('${lead.id}', this.value); this.value='';">
      <option value="">Override...</option>
      <option value="INTERESTED">INTERESTED</option>
      <option value="NOT_INTERESTED">NOT INTERESTED</option>
      <option value="FOLLOW_UP_LATER">FOLLOW UP LATER</option>
    </select>`);

  if (lead.classification === 'INTERESTED') {
    actions.push(`
      <select class="override-select" onchange="subClassificationOverride('${lead.id}', this.value); this.value='';">
        <option value="">Site Visit...</option>
        <option value="VISITING">VISITING</option>
        <option value="NOT_VISITING">NOT VISITING</option>
      </select>`);
  }

  actions.push(`<button class="btn btn-sm btn-danger" onclick="deleteLead('${lead.id}')">Delete</button>`);

  html += `<div class="card-actions">${actions.join('')}</div>`;

  document.getElementById('detailBody').innerHTML = html;
  document.getElementById('detailModal').classList.remove('hidden');
}

/**
 * Closes the detail modal when clicking the backdrop.
 */
function setPlaybackSpeed(leadId, speed, btn) {
  const audio = document.getElementById(`audio-${leadId}`);
  if (audio) audio.playbackRate = speed;
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
}

function closeDetailModal(e) {
  if (e.target === document.getElementById('detailModal')) {
    closeDetailModalDirect();
  }
}

/**
 * Closes the detail modal directly.
 */
function closeDetailModalDirect() {
  document.getElementById('detailModal').classList.add('hidden');
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
            const subLabel = event.subClassification ? ` [${event.subClassification}]` : '';
            addProgressLog(`Classified ${event.phone}: ${event.classification}${subLabel} (${event.confidence}%)`);
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
 * Re-classifies all INTERESTED leads that don't have a sub-classification yet.
 * Shows progress via SSE stream.
 */
async function reclassifyInterested() {
  const btn = document.getElementById('reclassifyInterestedBtn');
  btn.disabled = true;

  const interestedCount = allLeads.filter(l => l.classification === 'INTERESTED' && !l.subClassification && !l.manuallyOverridden).length;
  if (interestedCount === 0) {
    showToast('No interested leads need sub-classification.', 'info');
    btn.disabled = false;
    return;
  }

  showProgressBanner(`Sub-classifying ${interestedCount} interested lead(s)...`);

  try {
    const response = await fetch('/api/reclassify-interested', {
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
      throw new Error(err.error || 'Re-classification failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let event;
        try { event = JSON.parse(line.slice(6)); } catch { continue; }

        switch (event.step) {
          case 'reclassify_start':
            updateProgress(event.message, 10, `0/${event.total}`);
            break;
          case 'reclassifying':
            if (event.total > 0) {
              const pct = 10 + ((event.current / event.total) * 85);
              updateProgress(`Sub-classifying ${event.phone}...`, pct, `${event.current}/${event.total}`);
            }
            break;
          case 'reclassified':
            addProgressLog(`${event.phone}: ${event.classification} → ${event.subClassification || '—'} (${event.confidence}%)`);
            break;
          case 'reclassify_failed':
            addProgressLog(`Failed: ${event.phone}`);
            break;
          case 'done':
            updateProgress('Sub-classification complete!', 100, 'Done');
            showToast(`Done! Re-classified: ${event.reclassified}, Failed: ${event.failed}`, 'success');
            await loadLeads();
            setTimeout(hideProgressBanner, 2500);
            break;
          case 'error':
            showToast('Error: ' + event.message, 'error');
            hideProgressBanner();
            break;
        }
      }
    }
  } catch (err) {
    showToast('Re-classification failed: ' + err.message, 'error');
    hideProgressBanner();
  } finally {
    btn.disabled = false;
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
    renderStats(allLeads); renderChart(allLeads);
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
    const body = { classification };
    // Clear sub-classification when overriding to non-INTERESTED
    if (classification !== 'INTERESTED') {
      body.subClassification = null;
    }
    const lead = await apiPatch(`/api/leads/${leadId}`, body);
    updateLeadInState(lead);
    renderStats(allLeads); renderChart(allLeads);
    renderLeads(filterLeads(allLeads));
    showToast(`Classification overridden to ${classification}`, 'success');
  } catch (err) {
    showToast('Override failed: ' + err.message, 'error');
  }
}

/**
 * Manually overrides a lead's sub-classification (visiting/not visiting).
 * @param {string} leadId
 * @param {string} subClassification
 */
async function subClassificationOverride(leadId, subClassification) {
  if (!subClassification) return;

  try {
    const lead = await apiPatch(`/api/leads/${leadId}`, { subClassification });
    updateLeadInState(lead);
    renderStats(allLeads); renderChart(allLeads);
    renderLeads(filterLeads(allLeads));
    viewLeadDetail(leadId);
    showToast(`Sub-classification set to ${subClassification.replace(/_/g, ' ')}`, 'success');
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
    renderStats(allLeads); renderChart(allLeads);
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
