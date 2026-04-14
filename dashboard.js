function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Gemini Live — Telecalling Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
  <style>
    :root {
      --bg: #f5f3ed; --bg-secondary: #eceae3;
      --surface: #ffffff; --surface-hover: #faf9f6; --surface-raised: #f0eee6;
      --border: #e8e6dc; --border-subtle: #f0eee6;
      --text: #141413; --text-secondary: #4d4c48; --text-muted: #5e5d59; --text-dim: #87867f;
      --accent: #762224; --accent-hover: #c45a5c; --accent-bg: rgba(118,34,36,0.07); --accent-border: rgba(118,34,36,0.18);
      --green: #16a34a; --green-bg: rgba(22,163,74,0.08); --green-border: rgba(22,163,74,0.2);
      --amber: #d97706; --amber-bg: rgba(217,119,6,0.08); --amber-border: rgba(217,119,6,0.2);
      --red: #dc2626; --red-bg: rgba(220,38,38,0.08); --red-border: rgba(220,38,38,0.2);
      --blue: #2563eb; --blue-bg: rgba(37,99,235,0.08); --blue-border: rgba(37,99,235,0.2);
      --radius: 12px; --radius-sm: 8px; --radius-xs: 6px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); --shadow-md: 0 4px 16px rgba(0,0,0,0.08); --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
      --sidebar-width: 240px;
      --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; overflow-x: hidden; }

    /* === LAYOUT === */
    .app { display: flex; min-height: 100vh; }

    /* Sidebar */
    .sidebar { width: var(--sidebar-width); background: var(--bg-secondary); border-right: 1px solid var(--border-subtle); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; height: 100vh; z-index: 40; transition: transform var(--transition); }
    .sidebar-header { padding: 20px 16px 16px; border-bottom: 1px solid var(--border-subtle); }
    .sidebar-logo { display: flex; align-items: center; gap: 10px; }
    .sidebar-logo .icon { width: 32px; height: 32px; background: var(--accent); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fffcf8; font-size: 14px; font-family: 'Playfair Display', serif; }
    .sidebar-logo .title { font-size: 15px; font-weight: 500; color: var(--text); font-family: 'Playfair Display', Georgia, serif; }
    .sidebar-status { margin-top: 12px; display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .status-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); }
    .status-dot.offline { background: var(--red); }
    .status-text { font-size: 12px; color: var(--text-muted); }

    .sidebar-nav { flex: 1; padding: 12px 8px; overflow-y: auto; scrollbar-width: thin; display: flex; flex-direction: column; justify-content: flex-start; }
    .nav-section { margin-bottom: 16px; }
    .nav-label { font-size: 11px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 12px 8px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; font-size: 14px; color: var(--text-secondary); transition: all var(--transition); margin-bottom: 2px; }
    .nav-item:hover { background: var(--surface); color: var(--text); }
    .nav-item.active { background: var(--accent-bg); color: var(--accent-hover); border: 1px solid var(--accent-border); }
    .nav-item svg { width: 18px; height: 18px; flex-shrink: 0; }
    .nav-item .badge { margin-left: auto; background: var(--accent); color: #fff; font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 10px; min-width: 20px; text-align: center; }

    .sidebar-footer { padding: 12px 16px; border-top: 1px solid var(--border-subtle); }
    .sidebar-footer .btn { width: 100%; justify-content: center; }

    /* Main content */
    .main { flex: 1; margin-left: var(--sidebar-width); min-height: 100vh; overflow-x: hidden; min-width: 0; }

    /* Top bar */
    .topbar { padding: 16px 28px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 30; background: rgba(245,243,237,0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .topbar-title { font-size: 18px; font-weight: 500; font-family: 'Playfair Display', Georgia, serif; color: var(--text); }
    .topbar-actions { display: flex; gap: 8px; align-items: center; }
    .mobile-menu-btn { display: none; background: none; border: none; color: var(--text); cursor: pointer; padding: 8px; border-radius: var(--radius-xs); }
    .mobile-menu-btn:hover { background: var(--surface); }
    .mobile-menu-btn svg { width: 22px; height: 22px; }

    /* Content area */
    .content { padding: 24px 28px; max-width: 100%; overflow-x: hidden; box-sizing: border-box; }

    /* === COMPONENTS === */

    /* Buttons */
    .btn { border: none; padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; cursor: pointer; min-height: 36px; display: inline-flex; align-items: center; gap: 6px; transition: all var(--transition); font-family: inherit; }
    .btn svg { width: 16px; height: 16px; }
    .btn-primary { background: var(--accent); color: #fffcf8; }
    .btn-primary:hover { background: var(--accent-hover); box-shadow: var(--shadow-sm); }
    .btn-secondary { background: var(--surface); border: 1px solid var(--border); color: var(--text-secondary); }
    .btn-secondary:hover { background: var(--surface-hover); color: var(--text); }
    .btn-success { background: var(--green-bg); border: 1px solid var(--green-border); color: var(--green); }
    .btn-success:hover { background: rgba(34,197,94,0.2); }
    .btn-danger { background: var(--red-bg); border: 1px solid var(--red-border); color: var(--red); }
    .btn-danger:hover { background: rgba(239,68,68,0.2); }
    .btn-amber { background: var(--amber-bg); border: 1px solid var(--amber-border); color: var(--amber); }
    .btn-ghost { background: transparent; color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--surface); color: var(--text); }
    .btn-lg { padding: 10px 20px; font-size: 14px; min-height: 40px; }
    .btn-sm { padding: 5px 10px; font-size: 12px; min-height: 28px; }
    .btn-icon { padding: 8px; min-height: unset; }

    /* Stats cards */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; transition: all var(--transition); }
    .stat-card:hover { border-color: var(--accent-border); }
    .stat-card .stat-label { font-size: 12px; font-weight: 500; color: var(--text-muted); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
    .stat-card .stat-label svg { width: 14px; height: 14px; opacity: 0.5; }
    .stat-card .stat-value { font-size: 26px; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
    .stat-card .stat-sub { font-size: 11px; color: var(--text-dim); margin-top: 4px; }
    .stat-card.accent { border-color: var(--accent-border); background: linear-gradient(135deg, var(--accent-bg), var(--surface)); }
    .stat-card.green { border-color: var(--green-border); }
    .stat-card.amber { border-color: var(--amber-border); }

    /* Cards */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); transition: all var(--transition); }
    .card:hover { border-color: var(--accent-border); box-shadow: var(--shadow-sm); }
    .card-body { padding: 16px 18px; }
    .card-list { display: flex; flex-direction: column; gap: 6px; }

    /* Campaign card */
    .campaign-card { cursor: pointer; }
    .campaign-card .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .campaign-card .card-name { font-size: 14px; font-weight: 600; color: var(--text); }
    .campaign-card .card-meta { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .campaign-card .progress-bar { background: var(--surface-raised); border-radius: 3px; height: 4px; margin-top: 12px; overflow: hidden; }
    .campaign-card .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
    .campaign-card .progress-fill.green { background: var(--green); }
    .campaign-card .progress-fill.amber { background: var(--amber); }
    .campaign-card .progress-fill.accent { background: var(--accent); }

    /* Status badges */
    .badge-status { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.01em; }
    .badge-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .badge-draft { background: var(--surface-raised); color: var(--text-muted); }
    .badge-draft .badge-dot { background: var(--text-muted); }
    .badge-running { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
    .badge-running .badge-dot { background: var(--green); animation: pulse 2s infinite; }
    .badge-paused { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
    .badge-paused .badge-dot { background: var(--amber); }
    .badge-awaiting_approval { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
    .badge-awaiting_approval .badge-dot { background: var(--amber); animation: pulse 2s infinite; }
    .badge-completed { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
    .badge-completed .badge-dot { background: var(--green); }
    .badge-cancelled { background: var(--red-bg); color: var(--red); border: 1px solid var(--red-border); }
    .badge-cancelled .badge-dot { background: var(--red); }
    .badge-site_visit_confirmed { background: #2d1b69; color: #a78bfa; border: 1px solid #4c1d95; }
    .badge-site_visit_confirmed .badge-dot { background: #a78bfa; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    /* Call card */
    .call-card { cursor: pointer; }
    .call-card .card-top { display: flex; justify-content: space-between; align-items: center; }
    .call-card .card-name { font-size: 14px; font-weight: 600; color: var(--text); }
    .call-card .card-phone { font-size: 12px; color: var(--text-muted); margin-left: 8px; }
    .call-card .card-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
    .call-card .card-meta { font-size: 12px; color: var(--text-dim); }

    /* Filters */
    .filter-bar { display: flex; gap: 4px; margin-bottom: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px; flex-wrap: wrap; }
    .filter-item { padding: 6px 14px; border-radius: var(--radius-xs); font-size: 13px; color: var(--text-muted); cursor: pointer; font-weight: 500; transition: all var(--transition); white-space: nowrap; }
    .filter-item:hover { color: var(--text-secondary); }
    .filter-item.active { background: var(--accent); color: #fff; box-shadow: var(--shadow-sm); }

    /* Detail panel / slide-over */
    .slide-over-bg { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
    .slide-over-bg.open { display: block; }
    .slide-over { position: fixed; top: 0; right: 0; width: 520px; max-width: 100vw; height: 100vh; background: var(--surface); border-left: 1px solid var(--border); overflow-y: auto; z-index: 101; transform: translateX(100%); transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); box-shadow: var(--shadow-lg); }
    .slide-over.open { transform: translateX(0); }
    .slide-over-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: var(--surface); z-index: 1; }
    .slide-over-header h2 { font-size: 15px; font-weight: 600; }
    .slide-over-body { padding: 20px; }
    .slide-over-section { margin-bottom: 24px; }
    .slide-over-section h3 { font-size: 11px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .detail-item .detail-label { font-size: 11px; color: var(--text-dim); }
    .detail-item .detail-value { font-size: 14px; color: var(--text); margin-top: 2px; }

    /* Transcript */
    .transcript { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 16px; max-height: 400px; overflow-y: auto; }
    .transcript-turn { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle); }
    .transcript-turn:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .transcript-speaker { font-size: 11px; font-weight: 600; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; }
    .transcript-speaker.agent { color: var(--accent-hover); }
    .transcript-speaker.user { color: var(--green); }
    .transcript-speaker.system { color: var(--amber); }
    .transcript-speaker::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .transcript-text { font-size: 13px; line-height: 1.6; color: var(--text-secondary); }
    .transcript-time { font-size: 10px; color: var(--text-dim); margin-top: 3px; }

    /* Recording */
    .recording-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--accent-bg); border: 1px solid var(--accent-border); color: var(--accent-hover); padding: 8px 14px; border-radius: var(--radius-sm); text-decoration: none; font-size: 13px; font-weight: 500; transition: all var(--transition); }
    .recording-btn:hover { background: rgba(99,102,241,0.2); }

    /* Prompt editor */
    .prompt-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .prompt-toolbar { padding: 10px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .prompt-textarea { width: 100%; min-height: 480px; background: transparent; border: none; padding: 16px; color: var(--text-secondary); font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; line-height: 1.7; resize: vertical; }
    .prompt-textarea:focus { outline: none; color: var(--text); }
    .prompt-status { font-size: 12px; color: var(--text-dim); }
    .prompt-status.saved { color: var(--green); }
    .prompt-status.error { color: var(--red); }
    .badge-custom { background: var(--amber-bg); border: 1px solid var(--amber-border); color: var(--amber); font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 600; }
    .badge-default { background: var(--accent-bg); border: 1px solid var(--accent-border); color: var(--accent-hover); font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 600; }

    /* Modal */
    .modal-backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 16px; }
    .modal-backdrop.open { display: flex; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 0; width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
    .modal-header { padding: 20px 24px 0; }
    .modal-header h2 { font-size: 16px; font-weight: 600; }
    .modal-header p { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .modal-body { padding: 16px 24px; }
    .modal-footer { padding: 16px 24px; border-top: 1px solid var(--border-subtle); display: flex; gap: 8px; justify-content: flex-end; }
    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
    .form-input, .form-select { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 12px; color: var(--text); font-size: 14px; font-family: inherit; transition: border-color var(--transition); }
    .form-input:focus, .form-select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
    .form-input::placeholder { color: var(--text-dim); }
    .form-textarea { min-height: 100px; resize: vertical; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; }

    /* Campaign detail */
    .back-link { display: inline-flex; align-items: center; gap: 4px; color: var(--text-muted); font-size: 13px; cursor: pointer; margin-bottom: 16px; transition: color var(--transition); }
    .back-link:hover { color: var(--text); }
    .back-link svg { width: 16px; height: 16px; }
    .campaign-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
    .campaign-title { font-size: 22px; font-weight: 500; letter-spacing: -0.01em; font-family: 'Playfair Display', Georgia, serif; }

    /* Batch timeline */
    .batch-timeline { display: flex; gap: 6px; margin: 16px 0; overflow-x: auto; padding: 4px 0; }
    .batch-timeline::-webkit-scrollbar { height: 4px; }
    .batch-timeline::-webkit-scrollbar-track { background: var(--border-subtle); border-radius: 2px; }
    .batch-timeline::-webkit-scrollbar-thumb { background: var(--text-dim); border-radius: 2px; }
    .batch-pill { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; border: 1px solid transparent; transition: all var(--transition); }
    .batch-pill.completed { background: var(--green-bg); color: var(--green); border-color: var(--green-border); }
    .batch-pill.in-progress { background: var(--blue-bg); color: var(--blue); border-color: var(--blue-border); }
    .batch-pill.awaiting { background: var(--amber-bg); color: var(--amber); border-color: var(--amber-border); }
    .batch-pill.pending { background: var(--surface); color: var(--text-dim); border-color: var(--border); }
    .batch-pill.selected { box-shadow: 0 0 0 2px var(--accent); }

    /* Analysis card */
    .analysis-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin: 16px 0; }
    .analysis-header { padding: 14px 18px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; }
    .analysis-header h4 { font-size: 14px; font-weight: 600; }
    .analysis-body { padding: 18px; }
    .analysis-section { margin-bottom: 14px; }
    .analysis-section:last-child { margin-bottom: 0; }
    .analysis-section-title { font-size: 11px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .analysis-text { font-size: 14px; line-height: 1.6; color: var(--text-secondary); }

    /* Charts */
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
    .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; }
    .chart-card h4 { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 14px; }

    /* Table */
    .table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .table-header { padding: 12px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .table-header h3 { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
    table.data-table { width: 100%; border-collapse: collapse; }
    .data-table th { text-align: left; padding: 10px 18px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); background: var(--bg-secondary); }
    .data-table td { padding: 10px 18px; font-size: 13px; border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); }
    .data-table tr { transition: background var(--transition); }
    .data-table tr:hover { background: var(--surface-hover); }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table .clickable { cursor: pointer; }

    /* CSV upload */
    .upload-zone { border: 2px dashed var(--border); border-radius: var(--radius); padding: 40px 20px; text-align: center; cursor: pointer; transition: all var(--transition); }
    .upload-zone:hover { border-color: var(--accent); background: var(--accent-bg); }
    .upload-zone.dragover { border-color: var(--green); background: var(--green-bg); }
    .upload-zone svg { width: 40px; height: 40px; color: var(--text-dim); margin-bottom: 12px; }
    .upload-zone p { color: var(--text-muted); font-size: 14px; }
    .upload-zone .hint { font-size: 12px; color: var(--text-dim); margin-top: 4px; }
    .upload-zone input { display: none; }
    .csv-preview { margin-top: 16px; }
    .csv-preview table { width: 100%; font-size: 12px; border-collapse: collapse; background: var(--surface); border-radius: var(--radius-sm); overflow: hidden; }
    .csv-preview th, .csv-preview td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--border-subtle); }
    .csv-preview th { color: var(--text-dim); font-weight: 600; background: var(--bg-secondary); }
    .csv-preview .count { font-size: 12px; color: var(--text-muted); margin-top: 8px; }

    /* Empty states */
    .empty-state { text-align: center; padding: 60px 20px; }
    .empty-state svg { width: 48px; height: 48px; color: var(--text-dim); margin-bottom: 12px; }
    .empty-state h3 { font-size: 15px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; }
    .empty-state p { font-size: 13px; color: var(--text-dim); }

    /* Section visibility */
    .hidden { display: none !important; }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: var(--border-subtle); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-dim); }

    /* === RESPONSIVE === */
    @media (max-width: 768px) {
      :root { --sidebar-width: 0px; }
      .sidebar { transform: translateX(-100%); width: 280px; }
      .sidebar.open { transform: translateX(0); }
      .mobile-menu-btn { display: flex; }
      .main { margin-left: 0; }
      .topbar { padding: 12px 16px; }
      .content { padding: 16px; }
      .stats-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
      .stat-card { padding: 12px 14px; }
      .stat-card .stat-value { font-size: 22px; }
      .charts-grid { grid-template-columns: 1fr; }
      .slide-over { width: 100%; }
      .detail-grid { grid-template-columns: 1fr; }
      .campaign-header { flex-direction: column; }
      .campaign-title { font-size: 18px; }
      .data-table th, .data-table td { padding: 8px 12px; }
      .filter-bar { gap: 2px; }
      .filter-item { padding: 6px 10px; font-size: 12px; }
      .modal { border-radius: 12px; }
    }
    @media (max-width: 480px) {
      .stats-grid { gap: 6px; }
      .stat-card .stat-value { font-size: 20px; }
      .topbar-title { font-size: 15px; }
      .batch-pill { padding: 5px 10px; font-size: 11px; }
    }

    /* Mobile FAB */
    .fab { display: none; position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; background: var(--accent); color: #fffcf8; border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(118,34,36,0.35); z-index: 35; align-items: center; justify-content: center; transition: all var(--transition); }
    .fab:hover { background: var(--accent-hover); transform: scale(1.05); }
    .fab:active { transform: scale(0.95); }
    @media (max-width: 768px) {
      .fab { display: flex; }
    }

    /* Mobile sidebar overlay */
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 39; }
    .sidebar-overlay.open { display: block; }

    /* Excel-like sheet view */
    .xl-sheet { border: 1px solid #c6c6c6; border-radius: 4px; overflow: auto; max-height: 420px; background: #fff; font-family: 'Segoe UI', Arial, sans-serif; }
    .xl-sheet table { border-collapse: collapse; width: max-content; min-width: 100%; }
    .xl-sheet th.xl-corner { background: #e7e9ed; border: 1px solid #c6c6c6; width: 42px; min-width: 42px; height: 22px; position: sticky; top: 0; left: 0; z-index: 3; }
    .xl-sheet th.xl-col { background: #f3f4f6; border: 1px solid #c6c6c6; color: #444; font-size: 11px; font-weight: 500; padding: 3px 8px; text-align: center; min-width: 130px; height: 22px; position: sticky; top: 0; z-index: 2; }
    .xl-sheet th.xl-col.xl-mapped { background: #dbeafe; color: #1e40af; font-weight: 600; }
    .xl-sheet td.xl-row-num { background: #f3f4f6; border: 1px solid #c6c6c6; color: #444; font-size: 11px; font-weight: 500; text-align: center; padding: 3px 8px; min-width: 42px; position: sticky; left: 0; z-index: 1; }
    .xl-sheet td.xl-cell { border: 1px solid #d8dadc; padding: 4px 8px; font-size: 12px; color: #222; background: #fff; white-space: nowrap; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
    .xl-sheet td.xl-cell.xl-mapped { background: #eff6ff; }
    .xl-sheet tr.xl-header-row th.xl-col-data { background: #f9fafb; color: #111; font-weight: 700; padding: 6px 10px; border: 1px solid #c6c6c6; font-size: 12px; text-align: left; min-width: 130px; position: sticky; top: 22px; z-index: 2; }
    .xl-sheet tr.xl-header-row th.xl-col-data.xl-mapped { background: #bfdbfe; color: #1e3a8a; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
</head>
<body>
  <div class="app">
    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="icon">GL</div>
          <span class="title">Gemini Live</span>
        </div>
        <div class="sidebar-status">
          <span class="status-dot" id="status-dot"></span>
          <span class="status-text" id="status-text">Connecting...</span>
        </div>
        <div id="model-badge" style="margin-top:8px;font-size:11px;color:var(--text-dim)"></div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-label">Overview</div>
          <div class="nav-item active" onclick="navigate('campaigns', this)" id="nav-campaigns">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Campaigns
            <span class="badge" id="campaign-count">0</span>
          </div>
          <div class="nav-item" onclick="navigate('calls', this)" id="nav-calls">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
            Calls
          </div>
          <div class="nav-item" onclick="navigate('analytics', this)" id="nav-analytics">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Analytics
          </div>
        </div>
        <div class="nav-section">
          <div class="nav-label">Settings</div>
          <div class="nav-item" onclick="navigate('prompts', this)" id="nav-prompts">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Prompt Library
          </div>
          <div class="nav-item" onclick="navigate('settings', this)" id="nav-settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            Settings
          </div>
        </div>
        <div class="nav-section">
          <div class="nav-label">WhatsApp</div>
          <div class="nav-item" onclick="navigate('whatsapp', this)" id="nav-whatsapp">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
            Send Message
            <span id="wa-status-dot" style="margin-left:auto;width:7px;height:7px;border-radius:50%;background:#25d366;box-shadow:0 0 5px #25d366;flex-shrink:0"></span>
          </div>
          <div class="nav-item" onclick="navigate('brochures', this)" id="nav-brochures">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Messages Config
          </div>
          <div class="nav-item" onclick="navigate('wa-settings', this)" id="nav-wa-settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            WA Settings
          </div>
          <div class="nav-item" onclick="navigate('devices', this)" id="nav-devices">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
            Devices
          </div>
          <div class="nav-item" onclick="navigate('website', this)" id="nav-website">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            Website Leads
          </div>
          <div class="nav-item" onclick="navigate('automation', this)" id="nav-automation">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M5 9v3a2 2 0 002 2h10a2 2 0 002-2V9"/><line x1="12" y1="12" x2="12" y2="15"/></svg>
            Automation
          </div>
        </div>
      </nav>
      <div class="sidebar-footer">
        <button class="btn btn-primary btn-lg" onclick="openCreateCampaignModal()" style="width:100%">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Campaign
        </button>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>

    <!-- Mobile FAB -->
    <button class="fab" id="mobile-fab" onclick="openCreateCampaignModal()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>

    <!-- Main -->
    <div class="main">
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="mobile-menu-btn" onclick="toggleSidebar()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h1 class="topbar-title" id="page-title">Campaigns</h1>
        </div>
        <div class="topbar-actions">
          <button class="btn btn-secondary" onclick="openCallModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            Quick Call
          </button>
        </div>
      </div>

      <div class="content">
        <!-- Campaigns Page -->
        <div id="page-campaigns">
          <div id="campaign-list-view">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
              <h2 style="font-size:16px;font-weight:600;color:var(--text)">Your Campaigns</h2>
              <button class="btn btn-primary" onclick="openCreateCampaignModal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Campaign
              </button>
            </div>
            <div class="stats-grid" id="campaign-stats"></div>
            <div class="card-list" id="campaign-list"></div>
          </div>
          <div id="campaign-detail-view" class="hidden">
            <div class="back-link" onclick="showCampaignList()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Campaigns
            </div>
            <div id="campaign-detail-content"></div>
          </div>
        </div>

        <!-- Calls Page -->
        <div id="page-calls" class="hidden">
          <div class="stats-grid" id="call-stats"></div>
          <div class="filter-bar" id="call-filters">
            <div class="filter-item active" onclick="filterCalls('all', this)">All Calls</div>
            <div class="filter-item" onclick="filterCalls('completed', this)">Completed</div>
            <div class="filter-item" onclick="filterCalls('busy', this)">Busy / Failed</div>
          </div>
          <div class="card-list" id="call-list"></div>
        </div>

        <!-- Analytics Page -->
        <div id="page-analytics" class="hidden">
          <div id="analytics-content"></div>
        </div>

        <!-- Prompts Library Page -->
        <div id="page-prompts" class="hidden">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px">
            <div>
              <h2 style="font-size:18px;font-weight:700;">Prompt Library</h2>
              <p style="font-size:13px;color:var(--text-muted);margin-top:4px">Create and manage named prompts. The active prompt is used for all new calls.</p>
            </div>
            <button class="btn btn-primary" onclick="openPromptEditor()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Prompt
            </button>
          </div>
          <div id="prompts-list"></div>
        </div>

        <!-- WhatsApp Dashboard Page -->
        <div id="page-whatsapp" class="hidden">
          <div id="whatsapp-content"></div>
        </div>

        <!-- WhatsApp Settings Page -->
        <div id="page-wa-settings" class="hidden">
          <div id="wa-settings-content"></div>
        </div>

        <!-- Devices Page -->
        <div id="page-devices" class="hidden">
          <div id="devices-content"></div>
        </div>

        <!-- Website Page -->
        <div id="page-website" class="hidden">
          <div id="website-content"></div>
        </div>

        <!-- Brochures Page -->
        <div id="page-brochures" class="hidden">
          <div id="brochures-content"></div>
        </div>

        <!-- Settings Page -->
        <div id="page-settings" class="hidden">
          <div id="settings-content"></div>
        </div>

        <!-- Automation Page -->
        <div id="page-automation" class="hidden">
          <div id="automation-content"></div>
        </div>

        <!-- Vendor Follow-up Page -->
        <div id="page-vendor" class="hidden">
          <div id="vendor-content"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Slide-over (call detail) -->
  <div class="slide-over-bg" id="slide-over-bg" onclick="closeDetail()"></div>
  <div class="slide-over" id="slide-over">
    <div class="slide-over-header">
      <h2 id="detail-title">Call Details</h2>
      <button class="btn btn-ghost btn-icon" onclick="closeDetail()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="slide-over-body" id="detail-body"></div>
  </div>

  <!-- New Call Modal -->
  <div class="modal-backdrop" id="call-modal">
    <div class="modal">
      <div class="modal-header">
        <h2>New Outbound Call</h2>
        <p>Place a single outbound call via Plivo + Gemini Live</p>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input class="form-input" id="call-to" type="tel" value="+919899050706" placeholder="+91..." />
        </div>
        <div class="form-group">
          <label class="form-label">Customer Name</label>
          <input class="form-input" id="call-name" type="text" value="Apoorv" placeholder="Name" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeCallModal()">Cancel</button>
        <button class="btn btn-primary" onclick="placeCall()">Place Call</button>
      </div>
    </div>
  </div>

  <!-- Create Campaign Modal -->
  <div class="modal-backdrop" id="create-campaign-modal">
    <div class="modal">
      <div class="modal-header">
        <h2>Create Campaign</h2>
        <p>Set up a new bulk calling campaign</p>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Campaign Name</label>
          <input class="form-input" id="cmp-name" type="text" placeholder="e.g. Clermont Cold Calls - April" />
        </div>
        <div class="form-group">
          <label class="form-label">Batch Size (auto-stop & analyze every N calls)</label>
          <input class="form-input" id="cmp-batch-size" type="number" value="100" min="10" max="500" />
        </div>
        <div class="form-group">
          <label class="form-label">Max Concurrent Calls</label>
          <select class="form-select" id="cmp-concurrent">
            <option value="1" selected>1 — Sequential</option>
            <option value="2">2 — Parallel</option>
            <option value="3">3 — Parallel</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">WhatsApp Message</label>
          <select class="form-select" id="cmp-whatsapp-msg">
            <option value="">— None (no WhatsApp message) —</option>
          </select>
          <p style="font-size:11px;color:var(--text-dim);margin-top:4px">Select which WhatsApp message to send when the AI offers to share details. Configure messages in the WhatsApp page.</p>
        </div>
        <div class="form-group">
          <label class="form-label">Custom Prompt (optional)</label>
          <textarea class="form-input form-textarea" id="cmp-prompt" placeholder="Leave empty to use the global system prompt..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeCreateCampaignModal()">Cancel</button>
        <button class="btn btn-primary" onclick="createCampaign()">Create Campaign</button>
      </div>
    </div>
  </div>

  <!-- CSV Upload Modal -->
  <div class="modal-backdrop" id="csv-upload-modal">
    <div class="modal" style="max-width:560px">
      <div class="modal-header">
        <h2>Upload Contacts</h2>
        <p>Import a CSV file with phone numbers and names</p>
      </div>
      <div class="modal-body">
        <div class="upload-zone" id="upload-area" onclick="document.getElementById('csv-file').click()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p>Click to select or drag & drop CSV file</p>
          <p class="hint">Required column: phone. Optional: name, plus any extra columns.</p>
          <input type="file" id="csv-file" accept=".csv,.txt" />
        </div>
        <div class="csv-preview" id="csv-preview"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeCsvModal()">Cancel</button>
        <button class="btn btn-primary" id="csv-upload-btn" onclick="uploadCsv()" disabled>Upload Contacts</button>
      </div>
    </div>
  </div>

  <!-- Prompt Editor Modal -->
  <div class="modal-backdrop" id="prompt-editor-modal">
    <div class="modal" style="max-width:640px">
      <div class="modal-header">
        <h2 id="prompt-editor-title">New Prompt</h2>
        <p>Create a named system instruction for your telecalling agent</p>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Prompt Name</label>
          <input class="form-input" id="pe-name" type="text" placeholder="e.g. Clermont v2 - Aggressive Close" />
        </div>
        <div class="form-group">
          <label class="form-label">System Instruction</label>
          <textarea class="form-input" id="pe-body" style="min-height:300px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6" placeholder="Enter the full system prompt..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closePromptEditor()">Cancel</button>
        <button class="btn btn-primary" onclick="savePromptEntry()">Save Prompt</button>
      </div>
    </div>
  </div>

  <!-- WhatsApp Message Editor Modal -->
  <div class="modal-backdrop" id="brochure-editor-modal">
    <div class="modal">
      <div class="modal-header">
        <h2 id="be-title">Add WhatsApp Message</h2>
        <p>Configure a message to send via WhatsApp during calls</p>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Message Key (used to link to campaigns)</label>
          <input class="form-input" id="be-key" type="text" placeholder="e.g. clermont" />
        </div>
        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input class="form-input" id="be-name" type="text" placeholder="e.g. The Clermont" />
        </div>
        <div class="form-group">
          <label class="form-label">Media URL (PDF, image, or video)</label>
          <input class="form-input" id="be-url" type="url" placeholder="https://example.com/brochure.pdf or video link" />
        </div>
        <div class="form-group">
          <label class="form-label">WhatsApp Caption</label>
          <textarea class="form-input" id="be-caption" rows="3" placeholder="Message to send with the media..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeBrochureEditor()">Cancel</button>
        <button class="btn btn-primary" onclick="saveBrochureEntry()">Save</button>
      </div>
    </div>
  </div>

  <script>
    // ─── State ──────────────────────────────
    let allCalls = [];
    let allCampaigns = [];
    let currentFilter = 'all';
    let currentCampaignId = null;
    let currentOutcomeFilter = null;
    let csvData = null;
    let activeCampaignForUpload = null;
    let outcomeChart = null;
    let batchChart = null;
    let currentPage = 'campaigns';

    // ─── Navigation ─────────────────────────
    function navigate(page, el) {
      currentPage = page;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      // Prefer the actual nav item; fall back to el only if it IS a nav item
      var navEl = document.getElementById('nav-' + page);
      if (navEl) navEl.classList.add('active');
      else if (el && el.classList && el.classList.contains('nav-item')) el.classList.add('active');
      const pages = ['campaigns','calls','analytics','prompts','whatsapp','brochures','settings','wa-settings','devices','website','automation','vendor'];
      pages.forEach(p => document.getElementById('page-' + p)?.classList.toggle('hidden', p !== page));
      const titles = { campaigns: 'Campaigns', calls: 'Call History', analytics: 'Analytics', prompts: 'Prompt Library', brochures: 'WhatsApp Messages', settings: 'Settings', whatsapp: 'Send Message', 'wa-settings': 'WhatsApp Settings', devices: 'Devices', website: 'Website', automation: 'Automation', vendor: 'Vendor Follow-up' };
      document.getElementById('page-title').textContent = titles[page] || page;
      if (page === 'campaigns') loadCampaigns();
      if (page === 'calls') loadCalls();
      if (page === 'analytics') loadAnalytics();
      if (page === 'prompts') loadPromptLibrary();
      if (page === 'whatsapp') loadWhatsappDashboard();
      if (page === 'wa-settings') loadWaSettings();
      if (page === 'devices') loadDevices();
      if (page === 'website') loadWebsite();
      if (page === 'brochures') loadBrochures();
      if (page === 'settings') loadSettings();
      if (page === 'automation') loadAutomation();
      if (page === 'vendor') loadVendorFollowups();
      closeSidebar();
    }

    function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('open'); }
    function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); }

    // ─── Campaigns ──────────────────────────
    async function loadCampaigns() {
      try {
        const res = await fetch('/api/campaigns');
        allCampaigns = await res.json();
        document.getElementById('campaign-count').textContent = allCampaigns.length;
        renderCampaignList();
      } catch (e) { console.error('Failed to load campaigns:', e); }
    }

    function renderCampaignList() {
      const list = document.getElementById('campaign-list');
      const stats = document.getElementById('campaign-stats');

      const total = allCampaigns.length;
      const running = allCampaigns.filter(c => c.status === 'running').length;
      const totalContacts = allCampaigns.reduce((s, c) => s + (c.total_contacts || 0), 0);
      const awaiting = allCampaigns.filter(c => c.status === 'awaiting_approval').length;

      stats.innerHTML = \`
        <div class="stat-card accent"><div class="stat-label">Total Campaigns</div><div class="stat-value">\${total}</div></div>
        <div class="stat-card \${running > 0 ? 'green' : ''}"><div class="stat-label">Active</div><div class="stat-value">\${running}</div></div>
        <div class="stat-card"><div class="stat-label">Total Contacts</div><div class="stat-value">\${totalContacts.toLocaleString()}</div></div>
        <div class="stat-card \${awaiting > 0 ? 'amber' : ''}"><div class="stat-label">Awaiting Review</div><div class="stat-value">\${awaiting}</div></div>
      \`;

      if (allCampaigns.length === 0) {
        list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><h3>No campaigns yet</h3><p>Create your first bulk calling campaign to get started</p></div>';
        return;
      }

      list.innerHTML = allCampaigns.map(c => {
        const s = c.stats || {};
        const processed = (s.completed||0) + (s.failed||0);
        const pct = c.total_contacts > 0 ? Math.round(processed / c.total_contacts * 100) : 0;
        const fillCls = c.status === 'running' ? 'accent' : c.status === 'completed' ? 'green' : 'amber';
        return \`<div class="card campaign-card" onclick="openCampaignDetail('\${c.id}')">
          <div class="card-body">
            <div class="card-top">
              <div>
                <div class="card-name">\${esc(c.name)}</div>
                <div class="card-meta">\${c.total_contacts.toLocaleString()} contacts &middot; Batch \${c.current_batch || 0}/\${Math.ceil(c.total_contacts / c.batch_size) || 0} &middot; \${new Date(c.created_at).toLocaleDateString()}</div>
              </div>
              <span class="badge-status badge-\${c.status}"><span class="badge-dot"></span>\${c.status.replace('_', ' ')}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill \${fillCls}" style="width:\${pct}%"></div></div>
          </div>
        </div>\`;
      }).join('');
    }

    function showCampaignList() {
      currentCampaignId = null;
      document.getElementById('campaign-list-view').classList.remove('hidden');
      document.getElementById('campaign-detail-view').classList.add('hidden');
      loadCampaigns();
    }

    async function openCampaignDetail(id) {
      currentCampaignId = id;
      document.getElementById('campaign-list-view').classList.add('hidden');
      document.getElementById('campaign-detail-view').classList.remove('hidden');
      const [campRes, batchRes] = await Promise.all([fetch('/api/campaigns/' + id), fetch('/api/campaigns/' + id + '/batches')]);
      const campaign = await campRes.json();
      const batches = await batchRes.json();
      renderCampaignDetail(campaign, batches);
    }

    function renderCampaignDetail(c, batches) {
      const el = document.getElementById('campaign-detail-content');
      const s = c.stats || {};
      const totalProcessed = (s.completed||0) + (s.failed||0);
      const connRate = totalProcessed > 0 ? Math.round((s.completed||0) / totalProcessed * 100) : 0;
      const intRate = (s.completed||0) > 0 ? Math.round((s.interested||0) / s.completed * 100) : 0;

      let actions = '';
      if (c.status === 'draft') {
        actions = \`<button class="btn btn-secondary" onclick="openCsvUpload('\${c.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload CSV</button>\`;
        if (c.total_contacts > 0) actions += \` <button class="btn btn-success" onclick="startCampaign('\${c.id}')">Start Campaign</button>\`;
        actions += \` <button class="btn btn-danger btn-sm" onclick="deleteCampaign('\${c.id}')">Delete</button>\`;
      } else if (c.status === 'running') {
        actions = \`<button class="btn btn-amber" onclick="pauseCampaign('\${c.id}')">Pause</button>\`;
      } else if (c.status === 'paused') {
        actions = \`<button class="btn btn-success" onclick="startCampaign('\${c.id}')">Resume</button> <button class="btn btn-danger" onclick="cancelCampaign('\${c.id}')">Cancel</button> <button class="btn btn-danger btn-sm" onclick="deleteCampaign('\${c.id}')">Delete</button>\`;
      } else if (c.status === 'awaiting_approval') {
        actions = \`<button class="btn btn-success" onclick="resumeCampaign('\${c.id}', \${c.current_batch || 1})">Resume</button> <button class="btn btn-danger" onclick="cancelCampaign('\${c.id}')">Cancel</button>\`;
      } else if (c.status === 'cancelled' || c.status === 'completed') {
        actions = \`<button class="btn btn-danger btn-sm" onclick="deleteCampaign('\${c.id}')">Delete</button>\`;
      }

      let batchHtml = '';
      if (batches.length > 0) {
        batchHtml = '<div class="batch-timeline">' + batches.map(b => {
          const bs = b.stats || {};
          const done = (bs.completed||0) + (bs.failed||0);
          const total = bs.total || 0;
          let cls = 'pending';
          if (b.analysis && b.analysis.approved === 1) cls = 'completed';
          else if (b.analysis && b.analysis.approved === 0 && done >= total) cls = 'awaiting';
          else if (done > 0 && done < total) cls = 'in-progress';
          else if (done >= total && total > 0) cls = b.analysis ? 'completed' : 'completed';
          return \`<div class="batch-pill \${cls}" onclick="selectBatch('\${c.id}', \${b.batchNumber}, event)">Batch \${b.batchNumber}</div>\`;
        }).join('') + '</div>';
      }

      el.innerHTML = \`
        <div class="campaign-header">
          <div>
            <h2 class="campaign-title">\${esc(c.name)}</h2>
            <div style="margin-top:6px"><span class="badge-status badge-\${c.status}"><span class="badge-dot"></span>\${c.status.replace('_',' ')}</span>\${c.whatsapp_message_key ? ' <span style="font-size:12px;color:var(--text-dim);margin-left:8px">WhatsApp: <strong>' + esc(c.whatsapp_message_key) + '</strong></span>' : ''}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">\${actions}</div>
        </div>

        <div class="stats-grid">
          <div class="stat-card"><div class="stat-label">Connection Rate</div><div class="stat-value">\${connRate}%</div><div class="stat-sub">\${s.completed||0} / \${totalProcessed} connected</div></div>
          <div class="stat-card"><div class="stat-label">Interest Rate</div><div class="stat-value">\${intRate}%</div><div class="stat-sub">\${s.interested||0} interested</div></div>
          <div class="stat-card"><div class="stat-label">Brochures Sent</div><div class="stat-value">\${s.brochure_sent||0}</div><div class="stat-sub">via WhatsApp</div></div>
          <div class="stat-card"><div class="stat-label">Voicemail</div><div class="stat-value">\${s.voicemail||0}</div><div class="stat-sub">machine detected</div></div>
          <div class="stat-card"><div class="stat-label">Progress</div><div class="stat-value">\${totalProcessed} / \${c.total_contacts}</div><div class="stat-sub">\${c.total_contacts > 0 ? Math.round(totalProcessed/c.total_contacts*100) : 0}% complete</div></div>
        </div>

        \${batchHtml}

        <div class="charts-grid">
          <div class="chart-card"><h4>Outcome Distribution</h4><canvas id="outcome-chart"></canvas></div>
          <div class="chart-card"><h4>Batch Performance</h4><canvas id="batch-chart"></canvas></div>
        </div>

        <div id="batch-analysis-section"></div>

        <div class="table-wrap" style="margin-top:16px">
          <div class="table-header">
            <h3>Contacts</h3>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <div class="filter-bar" style="margin:0;background:transparent;border:none;padding:0">
                <div class="filter-item active" onclick="loadContacts('\${c.id}',null,this)">All</div>
                <div class="filter-item" onclick="loadContacts('\${c.id}','completed',this)">Done</div>
                <div class="filter-item" onclick="loadContacts('\${c.id}','pending',this)">Pending</div>
                <div class="filter-item" onclick="loadContacts('\${c.id}','failed',this)">Failed</div>
              </div>
              <select id="outcome-filter" onchange="filterByOutcome('\${c.id}', this.value)" style="padding:6px 10px;border-radius:var(--radius-xs);border:1px solid var(--border);background:var(--surface);color:var(--text-primary);font-size:13px;cursor:pointer">
                <option value="">All Outcomes</option>
                <option value="interested">Interested</option>
                <option value="not_interested">Not Interested</option>
                <option value="callback">Callback</option>
                <option value="no_answer">No Answer</option>
                <option value="busy">Busy</option>
                <option value="brochure_sent">Brochure Sent</option>
                <option value="voicemail">Voicemail</option>
              </select>
            </div>
          </div>
          <div id="contacts-table-wrap"></div>
        </div>

        <div class="table-wrap" style="margin-top:16px" id="callbacks-section">
          <div class="table-header">
            <div>
              <h3>Callback Requests</h3>
              <p style="font-size:12px;color:var(--text-muted);margin:0">People who asked to be called back</p>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-muted)" title="Auto-call due callbacks daily at 11:00 AM">
                <input type="checkbox" id="auto-callback-toggle" \${c.auto_callback ? 'checked' : ''} onchange="toggleAutoCallback('\${c.id}', this.checked)" style="width:16px;height:16px;accent-color:var(--accent)">
                Auto (11 AM daily)
              </label>
              <button class="btn btn-primary btn-sm" onclick="triggerDueCallbacks('\${c.id}')">Call Due Callbacks</button>
            </div>
          </div>
          <div id="callbacks-table-wrap"></div>
        </div>
      \`;

      renderOutcomeChart(s);
      renderBatchChart(batches);
      loadContacts(c.id, null);
      loadCallbacks(c.id);

      if (c.status === 'awaiting_approval' && batches.length > 0) {
        const last = batches[batches.length - 1];
        if (last.analysis) renderBatchAnalysis(c.id, last);
      }
    }

    function renderOutcomeChart(s) {
      const ctx = document.getElementById('outcome-chart');
      if (!ctx) return;
      if (outcomeChart) outcomeChart.destroy();
      const data = [s.interested||0, s.not_interested||0, s.callback||0, s.no_answer||0, s.busy||0, s.brochure_sent||0, s.voicemail||0];
      if (data.every(v => v === 0)) { ctx.parentElement.innerHTML += '<div class="empty-state" style="padding:20px"><p>No data yet</p></div>'; return; }
      outcomeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Interested','Not Interested','Callback','No Answer','Busy','Brochure Sent','Voicemail'],
          datasets: [{ data, backgroundColor: ['#22c55e','#ef4444','#f59e0b','#52525b','#fb923c','#6366f1','#a1a1aa'], borderWidth: 0, borderRadius: 3 }]
        },
        options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#71717a', font: { size: 11, family: 'Inter' }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } } } }
      });
    }

    function renderBatchChart(batches) {
      const ctx = document.getElementById('batch-chart');
      if (!ctx) return;
      if (batchChart) batchChart.destroy();
      if (batches.length === 0) { ctx.parentElement.innerHTML += '<div class="empty-state" style="padding:20px"><p>No batches yet</p></div>'; return; }
      const labels = batches.map(b => 'B' + b.batchNumber);
      batchChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Interest %', data: batches.map(b => { const s=b.stats||{}; return s.completed>0 ? Math.round((s.interested||0)/s.completed*100) : 0; }), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#22c55e' },
            { label: 'Connection %', data: batches.map(b => { const s=b.stats||{}; const p=(s.completed||0)+(s.failed||0); return p>0 ? Math.round((s.completed||0)/p*100) : 0; }), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#6366f1' },
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true, max: 100, ticks: { color: '#52525b', font: { size: 11 } }, grid: { color: '#1f1f23' }, border: { color: '#27272a' } },
            x: { ticks: { color: '#52525b', font: { size: 11 } }, grid: { color: '#1f1f23' }, border: { color: '#27272a' } }
          },
          plugins: { legend: { labels: { color: '#71717a', font: { size: 11, family: 'Inter' }, usePointStyle: true, pointStyleWidth: 8 } } }
        }
      });
    }

    function renderBatchAnalysis(campaignId, batch) {
      const el = document.getElementById('batch-analysis-section');
      const a = batch.analysis;
      if (!a) { el.innerHTML = ''; return; }
      const isPending = a.approved === 0;
      const statusHtml = a.approved === 1 ? '<span class="badge-status badge-completed"><span class="badge-dot"></span>Approved</span>' : isPending ? '<span class="badge-status badge-awaiting_approval"><span class="badge-dot"></span>Pending Approval</span>' : '<span class="badge-status badge-cancelled"><span class="badge-dot"></span>Rejected</span>';

      el.innerHTML = \`
        <div class="analysis-card">
          <div class="analysis-header">
            <h4>Batch \${batch.batchNumber} — AI Analysis</h4>
            \${statusHtml}
          </div>
          <div class="analysis-body">
            <div class="analysis-section"><div class="analysis-section-title">Summary</div><p class="analysis-text">\${esc(a.summary || 'No summary')}</p></div>
            <div class="analysis-section"><div class="analysis-section-title">Recommendations</div><p class="analysis-text">\${esc(a.recommendations || 'None')}</p></div>
            \${a.prompt_adjustments ? '<div class="analysis-section"><div class="analysis-section-title">Suggested Prompt Changes</div><p class="analysis-text">' + esc(a.prompt_adjustments) + '</p></div>' : ''}
            \${isPending ? '<div style="margin-top:16px;display:flex;gap:8px"><button class="btn btn-success btn-lg" onclick="approveBatch(\\'' + campaignId + '\\',' + batch.batchNumber + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg> Approve &amp; Continue</button><button class="btn btn-danger" onclick="rejectBatch(\\'' + campaignId + '\\',' + batch.batchNumber + ')">Pause Campaign</button></div>' : ''}
          </div>
        </div>
      \`;
    }

    async function selectBatch(campaignId, batchNumber, event) {
      document.querySelectorAll('.batch-pill').forEach(p => p.classList.remove('selected'));
      event.target.classList.add('selected');
      const res = await fetch(\`/api/campaigns/\${campaignId}/batches/\${batchNumber}/analysis\`);
      if (res.ok) {
        const analysis = await res.json();
        renderBatchAnalysis(campaignId, { batchNumber, analysis });
      }
      loadContacts(campaignId, null, null, batchNumber);
    }

    function filterByOutcome(campaignId, outcome) {
      currentOutcomeFilter = outcome || null;
      loadContacts(campaignId, null, null, null, currentOutcomeFilter);
    }

    async function loadContacts(campaignId, status, tabEl, batch, outcome) {
      if (tabEl) {
        tabEl.closest('.filter-bar').querySelectorAll('.filter-item').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
        currentOutcomeFilter = null;
        const sel = document.getElementById('outcome-filter');
        if (sel) sel.value = '';
      }
      if (outcome === undefined) outcome = currentOutcomeFilter;
      let u = \`/api/campaigns/\${campaignId}/contacts?limit=200\`;
      if (status) u += \`&status=\${status}\`;
      if (batch) u += \`&batch=\${batch}\`;
      if (outcome) u += \`&outcome=\${outcome}\`;
      const res = await fetch(u);
      const contacts = await res.json();
      const wrap = document.getElementById('contacts-table-wrap');
      if (contacts.length === 0) { wrap.innerHTML = '<div class="empty-state" style="padding:24px"><p>No contacts found</p></div>'; return; }
      wrap.innerHTML = \`<table class="data-table">
        <thead><tr><th>Name</th><th>Phone</th><th>Batch</th><th>Status</th><th>Outcome</th></tr></thead>
        <tbody>\${contacts.map(c => \`<tr class="\${c.call_uuid ? 'clickable' : ''}" \${c.call_uuid ? 'onclick="openDetail(\\'' + c.call_uuid + '\\')"' : ''}>
          <td>\${esc(c.name||'—')}</td><td style="font-family:monospace">\${esc(c.phone)}</td><td>\${c.batch_number}</td>
          <td><span class="badge-status badge-\${c.status==='completed'?'completed':c.status==='failed'?'cancelled':c.status==='calling'?'running':'draft'}"><span class="badge-dot"></span>\${c.status}</span></td>
          <td>\${c.outcome ? esc(c.outcome.replace(/_/g,' ')) : '—'}</td>
        </tr>\`).join('')}</tbody></table>\`;
    }

    async function loadCallbacks(campaignId) {
      const res = await fetch('/api/campaigns/' + campaignId + '/callbacks');
      const callbacks = await res.json();
      const wrap = document.getElementById('callbacks-table-wrap');
      const section = document.getElementById('callbacks-section');
      if (callbacks.length === 0) {
        section.style.display = 'none';
        return;
      }
      section.style.display = '';
      wrap.innerHTML = \`<table class="data-table">
        <thead><tr><th>Name</th><th>Phone</th><th>Employee</th><th>Outcome</th><th>Callback Timing</th><th>Callback Date</th></tr></thead>
        <tbody>\${callbacks.map(c => {
          const cbDate = c.callback_date ? new Date(c.callback_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
          const isOverdue = c.callback_date && new Date(c.callback_date) < new Date();
          return \`<tr \${c.call_uuid ? 'class="clickable" onclick="openDetail(\\'' + c.call_uuid + '\\')"' : ''}>
            <td>\${esc(c.name||'—')}</td>
            <td style="font-family:monospace">\${esc(c.phone)}</td>
            <td>\${esc(c.employee_name||'—')}</td>
            <td>\${c.outcome ? esc(c.outcome.replace(/_/g,' ')) : '—'}</td>
            <td>\${esc(c.callback_note||'—')}</td>
            <td style="\${isOverdue ? 'color:var(--danger);font-weight:600' : ''}">\${cbDate}</td>
          </tr>\`;
        }).join('')}</tbody></table>\`;
    }

    async function toggleAutoCallback(campaignId, enabled) {
      try {
        await fetch('/api/campaigns/' + campaignId + '/auto-callback', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
      } catch (err) { alert('Error: ' + err.message); }
    }

    async function triggerDueCallbacks(campaignId) {
      if (!confirm('This will call all contacts whose callback date has arrived. Continue?')) return;
      try {
        const res = await fetch('/api/campaigns/' + campaignId + '/trigger-callbacks', { method: 'POST' });
        const data = await res.json();
        alert('Triggered ' + data.triggered + ' callback call(s).');
        openCampaignDetail(campaignId);
      } catch (err) { alert('Error: ' + err.message); }
    }

    // ─── Campaign Actions ───────────────────
    async function openCreateCampaignModal() {
      document.getElementById('create-campaign-modal').classList.add('open');
      // Populate WhatsApp message dropdown
      try {
        const r = await fetch('/api/brochures');
        const data = await r.json();
        const sel = document.getElementById('cmp-whatsapp-msg');
        sel.innerHTML = '<option value="">— None (no WhatsApp message) —</option>';
        for (const [k, v] of Object.entries(data)) {
          sel.innerHTML += '<option value="' + k + '">' + (v.name || k) + '</option>';
        }
      } catch {}
    }
    function closeCreateCampaignModal() { document.getElementById('create-campaign-modal').classList.remove('open'); }

    async function createCampaign() {
      const name = document.getElementById('cmp-name').value.trim();
      if (!name) return;
      const whatsappKey = document.getElementById('cmp-whatsapp-msg').value || undefined;
      const res = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, batch_size: parseInt(document.getElementById('cmp-batch-size').value)||100, max_concurrent: parseInt(document.getElementById('cmp-concurrent').value)||1, prompt_override: document.getElementById('cmp-prompt').value.trim() || undefined, whatsapp_message_key: whatsappKey }) });
      const data = await res.json();
      closeCreateCampaignModal();
      document.getElementById('cmp-name').value = '';
      document.getElementById('cmp-prompt').value = '';
      if (data.id) openCampaignDetail(data.id); else loadCampaigns();
    }
    async function startCampaign(id) { await fetch('/api/campaigns/'+id+'/start',{method:'POST'}); openCampaignDetail(id); }
    async function pauseCampaign(id) { await fetch('/api/campaigns/'+id+'/pause',{method:'POST'}); openCampaignDetail(id); }
    async function cancelCampaign(id) { if(!confirm('Cancel this campaign?'))return; await fetch('/api/campaigns/'+id+'/cancel',{method:'POST'}); openCampaignDetail(id); }
    async function deleteCampaign(id) { if(!confirm('Delete this campaign and all contacts?'))return; await fetch('/api/campaigns/'+id,{method:'DELETE'}); showCampaignList(); }
    async function approveBatch(cid,bn) { await fetch(\`/api/campaigns/\${cid}/batches/\${bn}/approve\`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); openCampaignDetail(cid); }
    async function resumeCampaign(cid,bn) { await fetch(\`/api/campaigns/\${cid}/batches/\${bn}/approve\`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); openCampaignDetail(cid); }
    async function rejectBatch(cid,bn) { await fetch('/api/campaigns/'+cid+'/pause',{method:'POST'}); openCampaignDetail(cid); }

    // ─── CSV Upload ─────────────────────────
    function openCsvUpload(campaignId) { activeCampaignForUpload=campaignId; csvData=null; document.getElementById('csv-preview').innerHTML=''; document.getElementById('csv-upload-btn').disabled=true; document.getElementById('csv-file').value=''; document.getElementById('csv-upload-modal').classList.add('open'); }
    function closeCsvModal() { document.getElementById('csv-upload-modal').classList.remove('open'); }

    const uploadArea = document.getElementById('upload-area');
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', e => { e.preventDefault(); uploadArea.classList.remove('dragover'); if(e.dataTransfer.files[0]) handleCsvFile(e.dataTransfer.files[0]); });
    document.getElementById('csv-file').addEventListener('change', e => { if(e.target.files[0]) handleCsvFile(e.target.files[0]); });

    function handleCsvFile(file) {
      const reader = new FileReader();
      reader.onload = e => {
        csvData = e.target.result;
        const lines = csvData.trim().split('\\n');
        const rows = lines.slice(0,6).map(l => l.split(',').map(c => c.trim().replace(/['"]/g,'')));
        const preview = document.getElementById('csv-preview');
        preview.innerHTML = \`<table><thead><tr>\${rows[0].map(h=>'<th>'+esc(h)+'</th>').join('')}</tr></thead><tbody>\${rows.slice(1).map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')}</tbody></table><p class="count">\${lines.length-1} contacts found</p>\`;
        document.getElementById('csv-upload-btn').disabled = false;
      };
      reader.readAsText(file);
    }

    async function uploadCsv() {
      if(!csvData||!activeCampaignForUpload)return;
      document.getElementById('csv-upload-btn').disabled = true;
      const res = await fetch(\`/api/campaigns/\${activeCampaignForUpload}/upload\`,{method:'POST',headers:{'Content-Type':'text/csv'},body:csvData});
      const data = await res.json();
      closeCsvModal();
      if(data.ok) openCampaignDetail(activeCampaignForUpload);
      else alert('Error: '+(data.error||'Unknown'));
    }

    // ─── Calls ──────────────────────────────
    async function loadCalls() {
      const res = await fetch('/api/calls');
      allCalls = await res.json();
      renderCallStats();
      renderCalls();
    }

    function renderCallStats() {
      const total = allCalls.length;
      const completed = allCalls.filter(c => c.status === 'completed').length;
      const dur = allCalls.reduce((s,c) => s+(c.duration||0), 0);
      const avg = completed > 0 ? Math.round(dur/completed) : 0;
      const withTx = allCalls.filter(c => c.transcriptLines > 0).length;
      document.getElementById('call-stats').innerHTML = \`
        <div class="stat-card"><div class="stat-label">Total Calls</div><div class="stat-value">\${total}</div></div>
        <div class="stat-card green"><div class="stat-label">Completed</div><div class="stat-value">\${completed}</div></div>
        <div class="stat-card"><div class="stat-label">Avg Duration</div><div class="stat-value">\${avg}s</div></div>
        <div class="stat-card"><div class="stat-label">With Transcripts</div><div class="stat-value">\${withTx}</div></div>
      \`;
    }

    function renderCalls() {
      const list = document.getElementById('call-list');
      let filtered = allCalls;
      if(currentFilter==='completed') filtered = allCalls.filter(c=>c.status==='completed');
      if(currentFilter==='busy') filtered = allCalls.filter(c=>c.status!=='completed'&&c.status!=='connected'&&c.status!=='initiated');
      if(filtered.length===0){list.innerHTML='<div class="empty-state"><p>No calls found</p></div>';return;}
      list.innerHTML = filtered.map(c => {
        const statusCls = c.status==='completed'?'completed':c.hangupCause==='Rejected'?'cancelled':'draft';
        return \`<div class="card call-card" onclick="openDetail('\${c.callUuid}')"><div class="card-body">
          <div class="card-top">
            <div><span class="card-name">\${esc(c.customerName||'Unknown')}</span><span class="card-phone">\${c.to}</span></div>
            <span class="badge-status badge-\${statusCls}"><span class="badge-dot"></span>\${c.status}</span>
          </div>
          <div class="card-bottom">
            <span class="card-meta">\${new Date(c.startedAt).toLocaleString()}\${c.outcome ? ' &middot; <span class="badge-status badge-'+(c.outcome==='site_visit_confirmed'?'site_visit_confirmed':c.outcome==='interested'?'completed':c.outcome==='not_interested'?'cancelled':'draft')+'\" style="font-size:10px;padding:1px 6px"><span class="badge-dot"></span>'+c.outcome.replace(/_/g,' ')+'</span>' : ''}</span>
            <span class="card-meta">\${c.duration?c.duration+'s':'—'} &middot; \${c.geminiTurns} turns</span>
          </div>
        </div></div>\`;
      }).join('');
    }

    function filterCalls(f, el) {
      currentFilter = f;
      el.closest('.filter-bar').querySelectorAll('.filter-item').forEach(t=>t.classList.remove('active'));
      el.classList.add('active');
      renderCalls();
    }

    // ─── Call Detail ─────────────────────────
    async function openDetail(callUuid) {
      const res = await fetch('/api/calls/'+callUuid);
      const call = await res.json();
      document.getElementById('detail-title').textContent = (call.customerName||'Call') + ' — ' + call.to;
      const body = document.getElementById('detail-body');

      let txHtml = '<div class="empty-state" style="padding:16px"><p>No transcript</p></div>';
      if(call.transcript?.length > 0) {
        txHtml = call.transcript.map(t => \`<div class="transcript-turn"><div class="transcript-speaker \${t.role}">\${t.role==='agent'?'Ritu (Agent)':t.role==='system'?'System':'Customer'}</div><div class="transcript-text">\${esc(t.text)}</div><div class="transcript-time">\${new Date(t.timestamp).toLocaleTimeString()}</div></div>\`).join('');
      }

      let recHtml = '<span style="color:var(--text-dim)">No recording available</span>';
      if(call.recordingUrl) recHtml = \`<a class="recording-btn" href="\${call.recordingUrl}" target="_blank"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play Recording</a>\`;

      const ci = call.costINR || {};
      const tk = call.tokens || {};

      body.innerHTML = \`
        <div class="slide-over-section"><h3>Call Info</h3>
          <div class="detail-grid">
            <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">\${call.status}</div></div>
            <div class="detail-item"><div class="detail-label">Duration</div><div class="detail-value">\${call.duration||0}s</div></div>
            <div class="detail-item"><div class="detail-label">Started</div><div class="detail-value">\${call.startedAt?new Date(call.startedAt).toLocaleString():'—'}</div></div>
            <div class="detail-item"><div class="detail-label">Ended</div><div class="detail-value">\${call.endedAt?new Date(call.endedAt).toLocaleString():'—'}</div></div>
            <div class="detail-item"><div class="detail-label">Outcome</div><div class="detail-value">\${call.outcome ? '<span class="badge-status badge-' + (call.outcome==='site_visit_confirmed'?'site_visit_confirmed':call.outcome==='interested'?'completed':call.outcome==='not_interested'?'cancelled':'draft') + '"><span class="badge-dot"></span>' + call.outcome.replace(/_/g,' ') + '</span>' : '—'}</div></div>
            <div class="detail-item"><div class="detail-label">Hangup</div><div class="detail-value">\${call.hangupCause||'—'}</div></div>
          </div>
        </div>
        <div class="slide-over-section"><h3>Cost (₹)</h3>
          <div class="detail-grid">
            <div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="color:var(--amber);font-weight:600">\${rupee(ci.total)}</div></div>
            <div class="detail-item"><div class="detail-label">Plivo</div><div class="detail-value">\${rupee(ci.plivo)}</div></div>
            <div class="detail-item"><div class="detail-label">Gemini</div><div class="detail-value">\${rupee(ci.gemini)}</div></div>
            <div class="detail-item"><div class="detail-label">Model</div><div class="detail-value" style="font-size:12px">\${esc(ci.modelName || '—')}</div></div>
            <div class="detail-item" style="grid-column:1/-1"><div class="detail-label">Tokens</div><div class="detail-value" style="font-size:12px">Input: \${(tk.inputTokens||0).toLocaleString()} &middot; Output: \${(tk.outputTokens||0).toLocaleString()} &middot; Total: \${(tk.totalTokens||0).toLocaleString()}</div></div>
          </div>
        </div>
        <div class="slide-over-section"><h3>Recording</h3>\${recHtml}</div>
        <div class="slide-over-section"><h3>Transcript (\${call.transcript?call.transcript.length:0})</h3><div class="transcript">\${txHtml}</div></div>
      \`;
      document.getElementById('slide-over-bg').classList.add('open');
      document.getElementById('slide-over').classList.add('open');
    }

    function closeDetail() { document.getElementById('slide-over-bg').classList.remove('open'); document.getElementById('slide-over').classList.remove('open'); }

    // ─── Call Modal ──────────────────────────
    function openCallModal() { document.getElementById('call-modal').classList.add('open'); }
    function closeCallModal() { document.getElementById('call-modal').classList.remove('open'); }
    async function placeCall() {
      const to=document.getElementById('call-to').value, name=document.getElementById('call-name').value;
      closeCallModal();
      try { const r=await fetch('/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,customer_name:name})}); const d=await r.json(); alert('Call queued: '+d.callUuid); setTimeout(()=>{if(currentPage==='calls')loadCalls();},2000); } catch(e){ alert('Error: '+e.message); }
    }

    // ─── Prompt Library ─────────────────────
    let editingPromptId = null;

    async function loadPromptLibrary() {
      const r = await fetch('/api/prompts');
      const prompts = await r.json();
      const el = document.getElementById('prompts-list');
      if (prompts.length === 0) {
        el.innerHTML = '<div class="empty-state" style="padding:60px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><h3>No prompts yet</h3><p>Create your first named prompt to get started</p></div>';
        return;
      }
      el.innerHTML = '<div class="card-list">' + prompts.map(p => \`
        <div class="card" style="cursor:default">
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
              <div style="flex:1;min-width:200px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:15px;font-weight:600;color:var(--text)">\${esc(p.name)}</span>
                  \${p.is_active ? '<span class="badge-status badge-running"><span class="badge-dot"></span>Active</span>' : ''}
                </div>
                <div style="font-size:12px;color:var(--text-dim);margin-top:4px">\${p.body.length.toLocaleString()} chars &middot; Updated \${new Date(p.updated_at).toLocaleDateString()}</div>
                <pre style="margin-top:10px;font-size:12px;color:var(--text-muted);line-height:1.5;white-space:pre-wrap;max-height:80px;overflow:hidden;font-family:'JetBrains Mono',monospace">\${esc(p.body.substring(0, 300))}\${p.body.length > 300 ? '...' : ''}</pre>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                \${!p.is_active ? '<button class="btn btn-success btn-sm" onclick="activatePrompt(\\'' + p.id + '\\')">Set Active</button>' : '<button class="btn btn-amber btn-sm" onclick="deactivatePrompts()">Deactivate</button>'}
                <button class="btn btn-secondary btn-sm" onclick="editPromptEntry(\\'\${p.id}\\')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deletePromptEntry(\\'\${p.id}\\')">Delete</button>
              </div>
            </div>
          </div>
        </div>
      \`).join('') + '</div>';
    }

    function openPromptEditor(id) {
      editingPromptId = id || null;
      document.getElementById('prompt-editor-title').textContent = id ? 'Edit Prompt' : 'New Prompt';
      document.getElementById('pe-name').value = '';
      document.getElementById('pe-body').value = '';
      if (id) {
        fetch('/api/prompts/' + id).then(r => r.json()).then(p => {
          document.getElementById('pe-name').value = p.name;
          document.getElementById('pe-body').value = p.body;
        });
      }
      document.getElementById('prompt-editor-modal').classList.add('open');
    }

    function closePromptEditor() { document.getElementById('prompt-editor-modal').classList.remove('open'); editingPromptId = null; }

    async function savePromptEntry() {
      const name = document.getElementById('pe-name').value.trim();
      const body = document.getElementById('pe-body').value.trim();
      if (!name || !body) { alert('Name and body are required'); return; }
      if (editingPromptId) {
        await fetch('/api/prompts/' + editingPromptId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, body }) });
      } else {
        await fetch('/api/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, body }) });
      }
      closePromptEditor();
      loadPromptLibrary();
    }

    async function editPromptEntry(id) { openPromptEditor(id); }

    async function deletePromptEntry(id) {
      if (!confirm('Delete this prompt?')) return;
      await fetch('/api/prompts/' + id, { method: 'DELETE' });
      loadPromptLibrary();
    }

    async function activatePrompt(id) {
      await fetch('/api/prompts/' + id + '/activate', { method: 'POST' });
      loadPromptLibrary();
    }

    async function deactivatePrompts() {
      await fetch('/api/prompts/active', { method: 'DELETE' });
      loadPromptLibrary();
    }

    // ─── Analytics ──────────────────────────
    let analyticsOutcomeChart = null;
    let analyticsDailyChart = null;
    let analyticsCampaignChart = null;

    async function loadAnalytics() {
      const r = await fetch('/api/analytics');
      const data = await r.json();
      const el = document.getElementById('analytics-content');
      const s = data.summary;
      const cost = data.cost || {};
      const rates = cost.rates || {};

      el.innerHTML = \`
        <div class="stats-grid">
          <div class="stat-card accent"><div class="stat-label">Total Campaigns</div><div class="stat-value">\${s.totalCampaigns}</div></div>
          <div class="stat-card green"><div class="stat-label">Completed Calls</div><div class="stat-value">\${s.completedCalls}</div></div>
          <div class="stat-card"><div class="stat-label">Total Minutes</div><div class="stat-value">\${s.totalMinutes || 0}</div><div class="stat-sub">across all calls</div></div>
          <div class="stat-card"><div class="stat-label">Avg Duration</div><div class="stat-value">\${s.avgDuration}s</div></div>
          <div class="stat-card"><div class="stat-label">Connection Rate</div><div class="stat-value">\${s.overallConnRate}%</div></div>
          <div class="stat-card green"><div class="stat-label">Interest Rate</div><div class="stat-value">\${s.overallIntRate}%</div></div>
          <div class="stat-card"><div class="stat-label">Interested</div><div class="stat-value">\${s.totalInterested}</div></div>
          <div class="stat-card"><div class="stat-label">Brochures Sent</div><div class="stat-value">\${s.totalBrochures}</div></div>
        </div>

        <!-- Cost Tracker -->
        <div style="margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <h3 style="font-size:14px;font-weight:600;color:var(--text-secondary)">Cost Tracker (₹)</h3>
            <span class="badge-status badge-\${cost.geminiMethod === 'tokens' ? 'completed' : 'draft'}"><span class="badge-dot"></span>\${cost.geminiMethod === 'tokens' ? 'Token-based' : 'Time-based estimate'}</span>
          </div>
          <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
            <div class="stat-card" style="border-color:var(--amber-border);background:linear-gradient(135deg,var(--amber-bg),var(--surface))">
              <div class="stat-label">Total Spend</div>
              <div class="stat-value" style="color:var(--amber)">\${rupee(cost.total)}</div>
              <div class="stat-sub">Plivo \${rupee(cost.plivo)} + Gemini \${rupee(cost.gemini)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Cost per Call</div>
              <div class="stat-value">\${rupee(cost.perCall)}</div>
              <div class="stat-sub">avg across \${s.completedCalls} calls</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Cost per Interested Lead</div>
              <div class="stat-value">\${rupee(cost.perInterested)}</div>
              <div class="stat-sub">\${s.totalInterested} leads acquired</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Gemini Tokens Used</div>
              <div class="stat-value" style="font-size:16px">\${(cost.tokens?.total || 0).toLocaleString()}</div>
              <div class="stat-sub">In: \${(cost.tokens?.input || 0).toLocaleString()} &middot; Out: \${(cost.tokens?.output || 0).toLocaleString()}</div>
            </div>
          </div>
          <div style="margin-top:8px;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12px;color:var(--text-muted)">
            <strong style="color:var(--text-secondary)">Active model:</strong> \${esc(cost.activeModelName)} &middot;
            Plivo \${rupee(rates.plivo)}/min &middot; Gemini \${rupee(rates.geminiPerMin)}/min &middot;
            USD/INR: \${rates.usdToInr}
            \${cost.geminiMethod === 'tokens' ? ' &middot; <span style="color:var(--green)">Using actual token counts</span>' : ' &middot; <span style="color:var(--amber)">Time-based estimate (tokens tracked on new calls)</span>'}
          </div>
        </div>

        <div class="charts-grid">
          <div class="chart-card"><h4>Outcome Distribution</h4><canvas id="analytics-outcome-chart"></canvas></div>
          <div class="chart-card"><h4>Daily Calls & Spend</h4><canvas id="analytics-daily-chart"></canvas></div>
        </div>

        <div class="chart-card" style="margin-top:12px"><h4>Campaign Comparison</h4><canvas id="analytics-campaign-chart" style="max-height:300px"></canvas></div>

        \${data.campaignPerformance.length > 0 ? \`
          <div class="table-wrap" style="margin-top:16px">
            <div class="table-header"><h3>Campaign Performance</h3></div>
            <table class="data-table">
              <thead><tr><th>Campaign</th><th>Status</th><th>Contacts</th><th>Completed</th><th>Interested</th><th>Conn %</th><th>Int %</th></tr></thead>
              <tbody>\${data.campaignPerformance.map(c => \`<tr>
                <td style="font-weight:600">\${esc(c.name)}</td>
                <td><span class="badge-status badge-\${c.status}"><span class="badge-dot"></span>\${c.status.replace(/_/g,' ')}</span></td>
                <td>\${c.total}</td><td>\${c.completed}</td><td>\${c.interested}</td>
                <td>\${c.connRate}%</td><td>\${c.intRate}%</td>
              </tr>\`).join('')}</tbody>
            </table>
          </div>
        \` : ''}
      \`;

      // Outcome chart
      const oc = document.getElementById('analytics-outcome-chart');
      if (oc) {
        if (analyticsOutcomeChart) analyticsOutcomeChart.destroy();
        const o = data.outcomes;
        analyticsOutcomeChart = new Chart(oc, {
          type: 'doughnut',
          data: {
            labels: ['Interested','Not Interested','Callback','No Answer','Busy','Brochure Sent','Voicemail'],
            datasets: [{ data: [o.interested,o.not_interested,o.callback,o.no_answer,o.busy,o.brochure_sent,o.voicemail||0], backgroundColor: ['#22c55e','#ef4444','#f59e0b','#52525b','#fb923c','#6366f1','#a1a1aa'], borderWidth: 0, borderRadius: 3 }]
          },
          options: { responsive: true, cutout: '65%', plugins: { legend: { position:'bottom', labels: { color:'#71717a', font:{size:11,family:'Inter'}, padding:12, usePointStyle:true, pointStyleWidth:8 } } } }
        });
      }

      // Daily chart with cost overlay
      const dc = document.getElementById('analytics-daily-chart');
      if (dc) {
        if (analyticsDailyChart) analyticsDailyChart.destroy();
        const days = Object.keys(data.callsByDay).sort().slice(-30);
        const cbd = data.costByDay || {};
        analyticsDailyChart = new Chart(dc, {
          type: 'bar',
          data: {
            labels: days.map(d => d.substring(5)),
            datasets: [
              { label: 'Calls', data: days.map(d => data.callsByDay[d]), backgroundColor: 'rgba(99,102,241,0.5)', borderColor: '#6366f1', borderWidth: 1, borderRadius: 4, yAxisID: 'y' },
              { label: 'Spend (₹)', data: days.map(d => cbd[d] || 0), type: 'line', borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: '#f59e0b', yAxisID: 'y1' },
            ]
          },
          options: {
            responsive: true,
            scales: {
              y: { beginAtZero:true, position:'left', ticks:{color:'#52525b',font:{size:11}}, grid:{color:'#1f1f23'}, border:{color:'#27272a'}, title:{display:true,text:'Calls',color:'#52525b',font:{size:11}} },
              y1: { beginAtZero:true, position:'right', ticks:{color:'#f59e0b',font:{size:11},callback:v=>'₹'+v}, grid:{display:false}, border:{color:'#27272a'}, title:{display:true,text:'Spend (₹)',color:'#f59e0b',font:{size:11}} },
              x: { ticks:{color:'#52525b',font:{size:11}}, grid:{display:false}, border:{color:'#27272a'} }
            },
            plugins: { legend: { labels:{color:'#71717a',font:{size:11,family:'Inter'},usePointStyle:true,pointStyleWidth:8} } }
          }
        });
      }

      // Campaign comparison chart
      const cc = document.getElementById('analytics-campaign-chart');
      if (cc && data.campaignPerformance.length > 0) {
        if (analyticsCampaignChart) analyticsCampaignChart.destroy();
        const cp = data.campaignPerformance;
        analyticsCampaignChart = new Chart(cc, {
          type: 'bar',
          data: {
            labels: cp.map(c => c.name.length > 20 ? c.name.substring(0,20)+'...' : c.name),
            datasets: [
              { label: 'Connection %', data: cp.map(c => c.connRate), backgroundColor: 'rgba(99,102,241,0.5)', borderColor: '#6366f1', borderWidth: 1, borderRadius: 4 },
              { label: 'Interest %', data: cp.map(c => c.intRate), backgroundColor: 'rgba(34,197,94,0.5)', borderColor: '#22c55e', borderWidth: 1, borderRadius: 4 },
            ]
          },
          options: {
            responsive: true, indexAxis: 'y',
            scales: { x: { beginAtZero:true, max:100, ticks:{color:'#52525b'}, grid:{color:'#1f1f23'}, border:{color:'#27272a'} }, y: { ticks:{color:'#a1a1aa',font:{size:12}}, grid:{display:false}, border:{color:'#27272a'} } },
            plugins: { legend: { labels:{color:'#71717a',font:{size:11,family:'Inter'},usePointStyle:true,pointStyleWidth:8} } }
          }
        });
      }
    }

    // ─── Brochures ──────────────────────────
    // ─── WhatsApp Dashboard ─────────────────────────────
    async function loadWhatsappDashboard() {
      const el = document.getElementById('whatsapp-content');
      el.innerHTML = '<div style="color:var(--text-muted);padding:24px">Loading...</div>';
      let status = { connected: false, name: '', number: '', instance: '' };
      let evoInstances = [];
      let evoConfig = { url: 'http://localhost:5000', instance: '' };
      try {
        const r = await fetch('/api/whatsapp/status');
        if (r.ok) status = await r.json();
      } catch {}
      try {
        const r = await fetch('/api/evolution/instances');
        if (r.ok) evoInstances = await r.json();
      } catch {}
      try {
        const r = await fetch('/api/evo/config');
        if (r.ok) evoConfig = await r.json();
      } catch {}

      el.innerHTML = \`
        <div style="margin-bottom:24px">
          <h2 style="font-size:18px;font-weight:700;margin-bottom:4px">WhatsApp Dashboard</h2>
          <p style="font-size:13px;color:var(--text-muted)">Send messages and manage your WhatsApp connection.</p>
        </div>

        <!-- Status Card -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-body">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
              <div style="display:flex;align-items:center;gap:14px">
                <div style="width:48px;height:48px;border-radius:50%;background:\${status.connected ? 'var(--green-bg)' : 'var(--red-bg)'};border:1px solid \${status.connected ? 'var(--green-border)' : 'var(--red-border)'};display:flex;align-items:center;justify-content:center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="\${status.connected ? 'var(--green)' : 'var(--red)'}" stroke-width="2" width="22" height="22"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                </div>
                <div>
                  <div style="font-size:15px;font-weight:600;color:var(--text)">\${status.connected ? 'Connected' : 'Disconnected'}</div>
                  <div style="font-size:13px;color:var(--text-muted);margin-top:2px">
                    \${status.connected ? \`<strong>\${esc(status.name || 'WhatsApp')}</strong> &nbsp;·&nbsp; +\${esc(status.number || '')}\` : 'Not connected to WhatsApp'}
                  </div>
                  <div style="font-size:11px;color:var(--text-dim);margin-top:2px">Instance: <code style="background:var(--surface-raised);padding:1px 5px;border-radius:3px">\${esc(status.instance || '-')}</code></div>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="loadWhatsappDashboard()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        <!-- Send Message -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-body">
            <h3 style="font-size:14px;font-weight:600;margin-bottom:16px;color:var(--text)">Send Message</h3>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div>
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:6px">Phone Number</label>
                <input class="form-input" id="wa-phone" placeholder="919876543210 (with country code)" style="width:100%">
              </div>
              <div>
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:6px">Message</label>
                <textarea class="form-input" id="wa-msg" placeholder="Type your message..." rows="4" style="width:100%;resize:vertical"></textarea>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <button class="btn btn-primary" onclick="sendWhatsappMessage()" id="wa-send-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Send Message
                </button>
                <span id="wa-send-status" style="font-size:13px"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Templates -->
        <div class="card">
          <div class="card-body">
            <h3 style="font-size:14px;font-weight:600;margin-bottom:16px;color:var(--text)">Quick Templates</h3>
            <div style="display:flex;flex-direction:column;gap:8px">
              \${[
                { label: 'Follow-up', text: 'Hi, thank you for your time on the call! We would love to share more details about our project. Please let us know a convenient time.' },
                { label: 'Brochure', text: 'Hi, as discussed on our call, please find the project brochure here: https://onegroup.co.in — feel free to reach out for any questions!' },
                { label: 'Site Visit', text: 'Hi! Your site visit has been confirmed. Our team will be ready to welcome you. For any questions, feel free to message here.' },
              ].map(t => \`
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);gap:10px">
                  <span style="font-size:13px;color:var(--text-secondary);flex:1">\${esc(t.text.substring(0,80))}...</span>
                  <button class="btn btn-secondary btn-sm" style="flex-shrink:0" onclick="useTemplate(\${JSON.stringify(t.text).replace(/'/g,'&apos;')})">Use</button>
                </div>
              \`).join('')}
            </div>
          </div>
        </div>

        <!-- Evolution API Connection Settings -->
        <div class="card" style="margin-top:20px;border:1px solid var(--border)">
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="18" height="18"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
              <h3 style="font-size:14px;font-weight:600;color:var(--text)">Evolution API Settings</h3>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div>
                <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:5px">Evolution API URL</label>
                <input class="form-input" id="evo-url" value="\${esc(evoConfig.url)}" placeholder="http://localhost:5000" style="width:100%;font-family:monospace;font-size:13px">
              </div>
              <div>
                <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:5px">API Key / Instance Token</label>
                <input class="form-input" id="evo-apikey" type="password" placeholder="Enter token" style="width:100%;font-family:monospace;font-size:13px">
              </div>
              <div>
                <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:5px">Instance Name</label>
                \${evoInstances.length > 0 ? \`
                  <select class="form-input" id="evo-instance" style="width:100%;font-family:monospace;font-size:13px">
                    \${evoInstances.map(i => \`<option value="\${esc(i.name)}" \${i.name === (status.instance || '') ? 'selected' : ''}>\${esc(i.name)}\${i.connected ? ' ✓ Connected' : ' ○ Disconnected'}</option>\`).join('')}
                  </select>
                \` : \`
                  <input class="form-input" id="evo-instance" value="\${esc(status.instance || '')}" placeholder="test-instance" style="width:100%;font-family:monospace;font-size:13px">
                \`}
              </div>
              <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
                <button class="btn btn-primary btn-sm" onclick="testEvoConnection()">Test Connection</button>
                <span id="evo-test-result" style="font-size:13px"></span>
              </div>
            </div>
          </div>
        </div>
      \`;
    }

    async function loadDevices() {
      const el = document.getElementById('devices-content');
      el.innerHTML = '<div style="color:var(--text-muted);padding:24px">Loading...</div>';
      try {
        const res = await fetch('/api/evolution/instances');
        const instances = res.ok ? await res.json() : [];

        el.innerHTML = \`
          <div style="padding:20px;max-width:900px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
              <div>
                <h2 style="font-size:18px;font-weight:700;margin-bottom:4px">Devices</h2>
                <p style="font-size:13px;color:var(--text-muted)">Manage WhatsApp devices connected via Evolution GO.</p>
              </div>
              <button class="btn btn-primary btn-sm" onclick="openAddDeviceModal()">+ Add Device</button>
            </div>

            \${instances.length === 0 ? \`
              <div class="card"><div class="card-body" style="text-align:center;padding:40px;color:var(--text-muted)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" style="margin-bottom:12px;opacity:0.4"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                <div style="font-size:14px;margin-bottom:16px">No WhatsApp instances found in Evolution GO</div>
                <button class="btn btn-primary btn-sm" onclick="openAddDeviceModal()">+ Add First Device</button>
              </div></div>
            \` : instances.map((inst, idx) => {
              const isConn = inst.connectionStatus === 'open';
              const isConn2 = inst.connectionStatus === 'connected';
              const connected = isConn || isConn2;
              const isWaiting = inst.connectionStatus === 'connecting' || inst.connectionStatus === 'qrReadSuccess';
              const statusColor = connected ? '#25d366' : (isWaiting ? '#f59e0b' : '#dc2626');
              const statusBg = connected ? 'rgba(37,211,102,0.12)' : (isWaiting ? 'rgba(245,158,11,0.12)' : 'rgba(220,38,38,0.1)');
              const statusLabel = connected ? 'Connected' : (isWaiting ? (inst.connectionStatus || 'Connecting') : 'Disconnected');
              return \`
                <div class="card" style="margin-bottom:16px;border:1px solid \${connected ? 'rgba(37,211,102,0.3)' : 'var(--border)'}">
                  <div class="card-body">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                      <div style="display:flex;align-items:center;gap:12px">
                        <div style="width:44px;height:44px;border-radius:50%;background:\${connected ? 'rgba(37,211,102,0.12)' : 'var(--surface-raised)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="\${connected ? '#25d366' : 'var(--text-muted)'}" stroke-width="2" width="22" height="22"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                        </div>
                        <div>
                          <div style="font-size:15px;font-weight:600;color:var(--text)">\${esc(inst.name)}</div>
                          <div style="font-size:12px;color:var(--text-muted)">\${inst.phone ? '+' + esc(inst.phone) : (inst.profileName ? esc(inst.profileName) : (connected ? 'Connected' : 'Not connected'))}</div>
                        </div>
                      </div>
                      <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600;background:\${statusBg};color:\${statusColor}">
                        <span style="width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block"></span>
                        \${statusLabel}
                      </span>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                      \${connected ? \`
                        <button id="test-btn-\${idx}" class="btn btn-primary btn-sm" onclick="testDeviceConn('\${esc(inst.name)}', \${idx})">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
                          Test Connection
                        </button>
                      \` : \`
                        <button class="btn btn-primary btn-sm" onclick="showDeviceQR('\${esc(inst.name)}', \${inst.qrcode ? '1' : '0'})">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
                          Connect (Scan QR)
                        </button>
                      \`}
                      <button onclick="deleteDeviceInst('\${esc(inst.name)}')" class="btn btn-sm" style="background:rgba(220,38,38,0.08);color:#dc2626;border:1px solid rgba(220,38,38,0.2)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        Delete
                      </button>
                    </div>
                    <div id="test-result-\${idx}" style="margin-top:8px;font-size:12px;color:var(--text-muted)"></div>
                  </div>
                </div>
              \`;
            }).join('')}
          </div>

          <!-- Add Device Modal -->
          <div id="add-device-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center">
            <div style="background:var(--surface);border-radius:14px;padding:28px;width:380px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
              <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Add New Device</h3>
              <p style="font-size:12px;color:var(--text-muted);margin-bottom:20px">Creates a new WhatsApp instance in Evolution GO. A QR code will appear to link your phone.</p>
              <div style="display:flex;flex-direction:column;gap:14px">
                <div>
                  <label style="font-size:12px;font-weight:600;color:var(--text-dim);display:block;margin-bottom:5px">Instance Name</label>
                  <input class="form-input" id="new-device-name" placeholder="e.g. sales-team or rahul-wa" style="width:100%;font-family:monospace">
                  <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Lowercase, numbers and hyphens only</div>
                </div>
              </div>
              <div style="display:flex;gap:10px;margin-top:20px">
                <button class="btn btn-primary" style="flex:1" id="add-device-btn" onclick="saveNewDevice()">Create & Get QR</button>
                <button class="btn" style="flex:1" onclick="document.getElementById('add-device-modal').style.display='none'">Cancel</button>
              </div>
            </div>
          </div>
        \`;
      } catch (e) {
        el.innerHTML = '<div style="color:var(--red);padding:24px">Error loading devices: ' + e.message + '</div>';
      }
    }

    function openAddDeviceModal() {
      const modal = document.getElementById('add-device-modal');
      if (modal) {
        document.getElementById('new-device-name').value = '';
        modal.style.display = 'flex';
      }
    }

    async function saveNewDevice() {
      const raw = document.getElementById('new-device-name').value.trim();
      const instanceName = raw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
      if (!instanceName) { alert('Instance name required'); return; }
      const btn = document.getElementById('add-device-btn');
      btn.textContent = 'Creating...'; btn.disabled = true;
      try {
        const r = await fetch('/api/evolution/create-instance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instance_name: instanceName }) });
        const d = await r.json();
        document.getElementById('add-device-modal').style.display = 'none';
        await loadDevices();
        // Show QR if returned immediately
        const qrBase64 = d.qrcode?.base64 || d.base64 || null;
        if (qrBase64) {
          _openQRWindow(instanceName, qrBase64);
        } else {
          // fetch QR separately
          showDeviceQR(instanceName);
        }
      } catch (e) { alert('Error creating device: ' + e.message); }
      finally { btn.textContent = 'Create & Get QR'; btn.disabled = false; }
    }

    function _openQRWindow(instanceName, base64) {
      const w = window.open('', 'QR_' + instanceName, 'width=420,height=480');
      w.document.write('<html><body style="background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif"><h3 style="color:#fff;margin-bottom:16px">Scan QR — ' + instanceName + '</h3><img src="' + base64 + '" style="width:300px;height:300px;border-radius:12px"/><p style="color:#888;margin-top:12px;font-size:13px">WhatsApp &gt; Linked Devices &gt; Link a Device</p></body></html>');
    }

    async function showDeviceQR(instanceName) {
      try {
        // Evolution GO stores QR inside /instance/all — fetch fresh data
        const r = await fetch('/api/evolution/instances');
        const instances = await r.json();
        const inst = instances.find(i => i.name === instanceName);
        if (!inst) { alert('Instance not found. Refresh and try again.'); return; }
        if (inst.connected) { alert(instanceName + ' is already connected!\\nNo QR needed.'); return; }
        if (inst.qrcode) {
          _openQRWindow(instanceName, inst.qrcode);
        } else {
          alert('QR code not available yet.\\n\\nEvolution GO generates QR automatically when disconnected. Try:\\n1. Wait a few seconds and try again\\n2. Or delete and re-add this device');
        }
      } catch (e) { alert('Error: ' + e.message); }
    }

    async function testDeviceConn(instanceName, idx) {
      const btn = document.getElementById('test-btn-' + idx);
      const resultEl = document.getElementById('test-result-' + idx);
      if (btn) { btn.disabled = true; btn.textContent = 'Testing...'; }
      try {
        const r = await fetch('/api/evolution/instance/connectionState/' + instanceName);
        const d = await r.json();
        const state = d.instance?.state || d.state || 'unknown';
        const phone = d.instance?.wuid ? d.instance.wuid.split('@')[0] : '';
        if (state === 'open') {
          if (resultEl) { resultEl.textContent = 'Connected' + (phone ? ' — +' + phone : ''); resultEl.style.color = '#25d366'; }
          if (btn) { btn.textContent = 'Connected ✓'; btn.style.background = '#25d366'; }
        } else {
          if (resultEl) { resultEl.textContent = 'State: ' + state; resultEl.style.color = 'var(--red)'; }
          if (btn) { btn.textContent = 'Test Connection'; }
        }
        setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = 'Test Connection'; btn.style.background = ''; } }, 4000);
      } catch (e) {
        if (resultEl) resultEl.textContent = 'Error: ' + e.message;
        if (btn) { btn.disabled = false; btn.textContent = 'Test Connection'; }
      }
    }

    async function deleteDeviceInst(instanceName) {
      if (!confirm('Delete "' + instanceName + '" from Evolution GO?\\n\\nThis will permanently disconnect and remove this WhatsApp instance.')) return;
      try {
        await fetch('/api/evolution/delete-instance/' + instanceName, { method: 'DELETE' });
        loadDevices();
      } catch (e) { alert('Error deleting: ' + e.message); }
    }

    async function loadWaSettings() {
      const el = document.getElementById('wa-settings-content');
      el.innerHTML = '<div style="color:var(--text-muted);padding:24px">Loading...</div>';
      let status = { connected: false, name: '', number: '', instance: '' };
      let config = { url: 'http://localhost:5000', instance: '', waWebhookOutUrl: '' };
      let evoInstances = [];
      try { const r = await fetch('/api/whatsapp/status'); status = await r.json(); } catch {}
      try { const r = await fetch('/api/evo/config'); config = await r.json(); } catch {}
      try { const r = await fetch('/api/evolution/instances'); evoInstances = await r.json(); } catch {}
      try { const r = await fetch('/api/website-leads'); const d = await r.json(); config.waWebhookOutUrl = d.settings?.waWebhookOutUrl || ''; } catch {}
      el.innerHTML = \`
        <div style="margin-bottom:24px">
          <h2 style="font-size:18px;font-weight:700;margin-bottom:4px">WhatsApp Settings</h2>
          <p style="font-size:13px;color:var(--text-muted)">Configure your Evolution API connection.</p>
        </div>

        <!-- Connection Status -->
        <div class="card" style="margin-bottom:16px;border:1px solid \${status.connected ? 'rgba(37,211,102,0.3)' : 'rgba(239,68,68,0.3)'}">
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:14px">
              <div style="width:44px;height:44px;border-radius:50%;background:\${status.connected ? 'rgba(37,211,102,0.12)' : 'rgba(239,68,68,0.12)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg viewBox="0 0 24 24" fill="none" stroke="\${status.connected ? '#25d366' : 'var(--red)'}" stroke-width="2" width="22" height="22"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
              </div>
              <div>
                <div style="font-size:15px;font-weight:600;color:\${status.connected ? '#25d366' : 'var(--red)'}">\${status.connected ? 'Connected' : 'Disconnected'}</div>
                <div style="font-size:13px;color:var(--text-muted);margin-top:2px">\${status.connected ? '+' + esc(status.number) + ' &nbsp;·&nbsp; ' + esc(status.name) : 'WhatsApp se connected nahi hai'}</div>
                <div style="font-size:11px;color:var(--text-dim);margin-top:2px">Instance: <code style="background:var(--surface-raised);padding:1px 5px;border-radius:3px">\${esc(status.instance || '-')}</code></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Webhook IN -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" width="18" height="18"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
              <h3 style="font-size:15px;font-weight:600;color:var(--text);margin:0">Webhook IN</h3>
              <span style="font-size:11px;background:rgba(99,102,241,0.15);color:#818cf8;border-radius:10px;padding:2px 8px">Incoming</span>
            </div>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">Configure this URL in Evolution GO — whenever a WhatsApp message arrives, Evolution GO will POST to this URL.</p>
            <div style="display:flex;gap:8px;align-items:center">
              <div style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-family:monospace;font-size:12px;color:var(--text);word-break:break-all">
                POST \${location.origin}/api/wa-webhook
              </div>
              <button onclick="navigator.clipboard.writeText(location.origin+'/api/wa-webhook').then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)})" style="padding:8px 14px;background:var(--accent);color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12px;white-space:nowrap">Copy</button>
            </div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:8px">Evolution GO → Instance Settings → Webhook → paste this URL</div>
          </div>
        </div>

        <!-- Webhook OUT -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" width="18" height="18"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
              <h3 style="font-size:15px;font-weight:600;color:var(--text);margin:0">Webhook OUT</h3>
              <span style="font-size:11px;background:rgba(16,185,129,0.15);color:#34d399;border-radius:10px;padding:2px 8px">Outgoing</span>
            </div>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">Whenever data arrives on Webhook IN, it will be forwarded to this URL instantly (real-time).</p>
            <div style="display:flex;gap:8px;align-items:flex-end">
              <div style="flex:1">
                <label style="font-size:12px;font-weight:600;color:var(--text-dim);display:block;margin-bottom:6px">Forward to URL</label>
                <input class="form-input" id="wa-webhook-out-url" type="url" placeholder="https://your-server.com/incoming-wa" value="\${esc(config.waWebhookOutUrl||'')}" style="width:100%;font-size:13px">
              </div>
              <button onclick="saveWaWebhookOut()" style="padding:9px 18px;background:#10b981;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap">Save</button>
            </div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:8px">Data will be forwarded directly to your server/CRM</div>
          </div>
        </div>

        <!-- Evolution API Config -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-body">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <h3 style="font-size:15px;font-weight:600;color:var(--text)">Evolution API Connection</h3>
              <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background:\${status.connected ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)'};color:\${status.connected ? '#16a34a' : '#dc2626'};border:1px solid \${status.connected ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}">
                <span style="width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block"></span>
                \${status.connected ? 'Connected — +' + esc(status.number) : 'Disconnected'}
              </span>
            </div>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Update these values if you migrate to a VPS and click Test Connection.</p>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div>
                <label style="font-size:12px;font-weight:600;color:var(--text-dim);display:block;margin-bottom:6px">Evolution API URL</label>
                <input class="form-input" id="evo-url" value="\${esc(config.url)}" placeholder="http://localhost:5000" style="width:100%;font-family:monospace;font-size:13px">
                <div style="font-size:11px;color:var(--text-dim);margin-top:4px">Local: http://localhost:5000 &nbsp;|&nbsp; VPS: http://VPS_IP:5000</div>
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;color:var(--text-dim);display:block;margin-bottom:6px">API Key / Instance Token</label>
                <input class="form-input" id="evo-apikey" type="password" placeholder="Instance token or global API key" style="width:100%;font-family:monospace;font-size:13px">
                <div style="font-size:11px;color:var(--text-dim);margin-top:4px">Copy the instance token from Evolution GO manager</div>
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;color:var(--text-dim);display:block;margin-bottom:6px">Instance Name</label>
                \${evoInstances.length > 0 ? \`
                  <select class="form-input" id="evo-instance" style="width:100%;font-family:monospace;font-size:13px">
                    \${evoInstances.map(i => \`<option value="\${esc(i.name)}" \${i.name === (config.instance || status.instance) ? 'selected' : ''}>\${esc(i.name)}\${i.connected ? ' ✓ Connected' : ' ○ Disconnected'}</option>\`).join('')}
                  </select>
                  <div style="font-size:11px;color:var(--text-dim);margin-top:4px">Select the WhatsApp instance to use as default</div>
                \` : \`
                  <input class="form-input" id="evo-instance" value="\${esc(config.instance || status.instance || '')}" placeholder="test-instance" style="width:100%;font-family:monospace;font-size:13px">
                  <div style="font-size:11px;color:var(--text-dim);margin-top:4px">No instances found — go to Devices page to add one</div>
                \`}
              </div>
              <div style="display:flex;gap:10px;align-items:center;padding-top:4px">
                <button class="btn btn-primary" onclick="testEvoConnection()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                  Test Connection
                </button>
                <span id="evo-test-result" style="font-size:13px"></span>
              </div>
            </div>
          </div>
        </div>
      \`;
    }

    function useTemplate(text) {
      document.getElementById('wa-msg').value = text;
    }

    async function sendWhatsappMessage() {
      const phone = document.getElementById('wa-phone').value.trim();
      const text = document.getElementById('wa-msg').value.trim();
      const statusEl = document.getElementById('wa-send-status');
      const btn = document.getElementById('wa-send-btn');
      if (!phone || !text) { statusEl.style.color = 'var(--red)'; statusEl.textContent = 'Phone and message required'; return; }
      btn.disabled = true;
      statusEl.style.color = 'var(--text-muted)';
      statusEl.textContent = 'Sending...';
      try {
        const r = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: phone, text }) });
        const d = await r.json();
        if (r.ok && !d.error) {
          statusEl.style.color = 'var(--green)';
          statusEl.textContent = 'Message sent!';
          document.getElementById('wa-msg').value = '';
        } else {
          statusEl.style.color = 'var(--red)';
          statusEl.textContent = d.error || 'Failed to send';
        }
      } catch (err) {
        statusEl.style.color = 'var(--red)';
        statusEl.textContent = err.message;
      }
      btn.disabled = false;
    }

    async function loadWebsite() {
      const el = document.getElementById('website-content');
      el.innerHTML = '<div style="color:var(--text-muted);padding:24px">Loading...</div>';
      try {
        const [leadsRes, instRes] = await Promise.all([
          fetch('/api/website-leads'),
          fetch('/api/evolution/instances'),
        ]);
        const data = await leadsRes.json();
        const evoInstances = instRes.ok ? await instRes.json() : [];
        const { leads = [], stats = {}, settings = {} } = data;
        _autoWaEnabled = settings.autoWaEnabled || false;
        el.innerHTML = \`
          <div style="padding:20px;max-width:1200px">
            <!-- Stats Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
              \${[
                { label:'All Leads', val: stats.total||0, color:'#ef4444', icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
                { label:'New', val: stats.new||0, color:'#3b82f6', icon:'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
                { label:'Contacted', val: stats.contacted||0, color:'#8b5cf6', icon:'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
                { label:'Converted', val: stats.converted||0, color:'#10b981', icon:'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3' },
                { label:'Ignored', val: stats.ignored||0, color:'#6b7280', icon:'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
              ].map(s => \`
                <div style="background:var(--surface-raised);border:1px solid var(--border);border-radius:10px;padding:16px;cursor:pointer;transition:border-color .2s" onclick="filterWebsiteLeads('\${s.label.toLowerCase().replace(' ','-')}')">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="\${s.color}" stroke-width="2" width="18" height="18"><path d="\${s.icon}"/></svg>
                    <span style="font-size:12px;color:var(--text-muted)">\${s.label}</span>
                  </div>
                  <div style="font-size:28px;font-weight:700;color:\${s.color}">\${s.val}</div>
                </div>
              \`).join('')}
            </div>

            <!-- Auto-Send on New Lead -->
            <div style="background:var(--surface-raised);border:1px solid var(--border);border-radius:10px;margin-bottom:20px;overflow:hidden">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border)">
                <span style="font-weight:600;font-size:15px">Auto-Send on New Lead</span>
                <span id="auto-send-status" style="font-size:13px;color:\${settings.autoWaEnabled ? '#10b981' : '#ef4444'};font-weight:500">\${settings.autoWaEnabled ? 'Turn Off' : 'Turn On'}</span>
              </div>
              <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0">
                <!-- WA Auto-Send -->
                <div style="padding:20px;border-right:1px solid var(--border);min-width:0;overflow:hidden">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#25d366" stroke-width="2" width="18" height="18"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                      <span style="font-weight:600;font-size:14px">Send Message</span>
                    </div>
                    <div id="auto-wa-toggle-ui" onclick="toggleAutoWa()" style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer">
                      <div id="auto-wa-track" style="position:absolute;top:0;left:0;right:0;bottom:0;background:\${settings.autoWaEnabled ? '#25d366' : '#d1d5db'};border-radius:24px;transition:.3s"></div>
                      <div id="auto-wa-knob" style="position:absolute;height:18px;width:18px;left:\${settings.autoWaEnabled ? '23px' : '3px'};bottom:3px;background:#fff;border-radius:50%;transition:.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>
                    </div>
                  </div>
                  <div style="margin-bottom:10px">
                    <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;font-weight:600">Send From (Instance)</label>
                    \${evoInstances.length > 0 ? \`
                      <select id="auto-wa-instance" style="width:100%;padding:7px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;font-family:monospace">
                        \${evoInstances.map(i => \`<option value="\${esc(i.name)}" \${i.name === (settings.autoWaInstance || '') ? 'selected' : ''}>\${esc(i.name)}\${i.connected ? ' ✓' : ' ○'} \${i.phone ? '+'+esc(i.phone) : ''}</option>\`).join('')}
                      </select>
                    \` : \`<div style="font-size:12px;color:var(--text-muted);padding:6px 0">No instances — add from Devices page</div>\`}
                  </div>
                  <textarea id="auto-wa-template" rows="5" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:13px;resize:vertical;box-sizing:border-box">\${settings.autoWaTemplate||''}</textarea>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Variables: {{name}} {{phone}} {{email}} {{source}} {{message}} {{greeting}}</div>
                  <button onclick="saveWebsiteSettings()" style="margin-top:10px;padding:7px 16px;background:#25d366;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">Save Message</button>
                </div>
                <!-- Webhook URL -->
                <div style="padding:20px;min-width:0;overflow:hidden">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" width="18" height="18"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                    <span style="font-weight:600;font-size:14px">Webhook URL</span>
                    <span style="font-size:11px;background:rgba(16,185,129,0.15);color:#34d399;border-radius:10px;padding:2px 8px">\${settings.tunnelUrl ? 'Live' : 'Local Only'}</span>
                  </div>

                  <!-- Public Webhook URL -->
                  <div style="margin-bottom:4px;font-size:11px;font-weight:600;color:var(--text-dim)">Add this to your website .env (EVOGO_WEBHOOK_URL)</div>
                  <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px">
                    <div id="public-webhook-display" style="flex:1;background:var(--surface);border:1px solid \${settings.tunnelUrl ? 'rgba(16,185,129,0.4)' : 'var(--border)'};border-radius:8px;padding:8px 10px;font-size:11px;font-family:monospace;color:var(--text);word-break:break-all">
                      \${settings.tunnelUrl ? settings.tunnelUrl + '/api/website-leads' : location.origin + '/api/website-leads'}
                    </div>
                    <button onclick="copyWebhookUrl()" style="padding:7px 12px;background:var(--accent);color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12px;white-space:nowrap" id="copy-webhook-btn">Copy</button>
                  </div>

                  <!-- Tunnel URL update -->
                  <div style="margin-bottom:14px">
                    <div style="font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:5px">Tunnel URL (ngrok/serveo — if running)</div>
                    <div style="display:flex;gap:6px">
                      <input id="tunnel-url-input" type="url" placeholder="https://xyz.serveousercontent.com" value="\${settings.tunnelUrl||''}" style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px" />
                      <button onclick="saveTunnelUrl()" style="padding:7px 12px;background:var(--surface);border:1px solid var(--border);border-radius:7px;cursor:pointer;font-size:12px;color:var(--text)">Save</button>
                    </div>
                  </div>

                  <button onclick="addTestLead()" style="padding:7px 14px;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;color:var(--text)">+ Test Lead</button>
                </div>
              </div>
            </div>

            <!-- Contacts Table -->
            <div style="background:var(--surface-raised);border:1px solid var(--border);border-radius:10px;overflow:hidden">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border)">
                <span style="font-weight:600;font-size:15px">Contacts</span>
                <div style="display:flex;gap:8px">
                  <button onclick="exportWebsiteLeads()" style="padding:6px 14px;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;color:var(--text)">Export</button>
                  <button onclick="loadWebsite()" style="padding:6px 14px;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;color:var(--text)">Refresh</button>
                </div>
              </div>
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                  <thead>
                    <tr style="background:var(--surface);border-bottom:1px solid var(--border)">
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">#</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">Name</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">Phone</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">Email</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">Source</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">Message</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">Page URL</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">IP Address</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">Status</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">Date</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">WA</th>
                      <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:500">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="website-leads-tbody">
                    \${leads.length === 0 ? \`<tr><td colspan="12" style="padding:40px;text-align:center;color:var(--text-muted)">No leads yet. Add your webhook URL to your website to start receiving leads.</td></tr>\` :
                      leads.map((l, i) => \`
                        <tr style="border-bottom:1px solid var(--border);transition:background .15s" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background=''">
                          <td style="padding:10px 12px;color:var(--text-muted)">\${i+1}</td>
                          <td style="padding:10px 12px;font-weight:500;color:var(--text)">\${l.name||'-'}</td>
                          <td style="padding:10px 12px;color:var(--text-secondary)">\${l.phone||'-'}</td>
                          <td style="padding:10px 12px;color:var(--text-secondary);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${l.email||'-'}</td>
                          <td style="padding:10px 12px"><span style="background:var(--accent-bg);color:var(--accent-hover);border:1px solid var(--accent-border);border-radius:12px;padding:2px 8px;font-size:11px;white-space:nowrap">\${l.source||'-'}</span></td>
                          <td style="padding:10px 12px;color:var(--text-secondary);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="\${(l.message||'').replace(/"/g,'&quot;')}">\${l.message||'-'}</td>
                          <td style="padding:10px 12px;color:var(--text-secondary);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="\${l.pageUrl||''}">\${l.pageUrl ? l.pageUrl.replace(/^https?:\\/\\/[^/]+/,'') || '/' : '-'}</td>
                          <td style="padding:10px 12px;color:var(--text-muted);font-size:11px">\${l.ipAddress||'-'}</td>
                          <td style="padding:10px 12px">
                            <select onchange="updateLeadStatus('\${l.id}', this.value)" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:3px 6px;font-size:12px;color:var(--text);cursor:pointer">
                              \${['new','contacted','converted','ignored'].map(s => \`<option value="\${s}" \${l.status===s?'selected':''}>\${s.charAt(0).toUpperCase()+s.slice(1)}</option>\`).join('')}
                            </select>
                          </td>
                          <td style="padding:10px 12px;color:var(--text-muted);font-size:11px;white-space:nowrap">\${l.createdAt||'-'}</td>
                          <td style="padding:10px 12px">
                            \${l.waMessageSent ? '<span style="color:#25d366;font-size:11px">✓ Sent</span>' : '<span style="color:var(--text-muted);font-size:11px">Not sent</span>'}
                          </td>
                          <td style="padding:10px 12px">
                            <div style="display:flex;gap:6px;align-items:center">
                              <button onclick="sendWaToLead('\${l.id}')" title="Send WhatsApp" style="background:none;border:1px solid var(--border);border-radius:5px;padding:4px 7px;cursor:pointer;color:#25d366">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                              </button>
                              <button onclick="deleteWebsiteLead('\${l.id}')" title="Delete" style="background:none;border:1px solid var(--border);border-radius:5px;padding:4px 7px;cursor:pointer;color:#ef4444">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      \`).join('')
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        \`;
      } catch(e) {
        el.innerHTML = \`<div style="padding:24px;color:#ef4444">Error: \${e.message}</div>\`;
      }
    }

    let _autoWaEnabled = false;
    async function toggleAutoWa() {
      _autoWaEnabled = !_autoWaEnabled;
      await fetch('/api/website-settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ autoWaEnabled: _autoWaEnabled }) });
      const track = document.getElementById('auto-wa-track');
      const knob = document.getElementById('auto-wa-knob');
      const dot = document.getElementById('auto-send-status');
      if (track) track.style.background = _autoWaEnabled ? '#25d366' : '#d1d5db';
      if (knob) knob.style.left = _autoWaEnabled ? '23px' : '3px';
      if (dot) { dot.textContent = _autoWaEnabled ? 'Turn Off' : 'Turn On'; dot.style.color = _autoWaEnabled ? '#10b981' : '#ef4444'; }
    }

    async function saveWebsiteSettings() {
      const tmpl = document.getElementById('auto-wa-template')?.value || '';
      const instEl = document.getElementById('auto-wa-instance');
      const autoWaInstance = instEl ? instEl.value : '';
      await fetch('/api/website-settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ autoWaTemplate: tmpl, autoWaInstance }) });
      alert('Saved!');
    }

    async function saveWebhookSettings() {
      const customWebhookUrl = document.getElementById('custom-webhook-url')?.value?.trim() || '';
      const b2bForwardEnabled = document.getElementById('b2b-forward-toggle')?.checked || false;
      const b2bForwardUrl = document.getElementById('b2b-forward-url')?.value?.trim() || '';
      await fetch('/api/website-settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ customWebhookUrl, b2bForwardEnabled, b2bForwardUrl }) });
      alert('Webhook settings saved!');
    }

    async function saveTunnelUrl() {
      const tunnelUrl = (document.getElementById('tunnel-url-input')?.value?.trim() || '').replace(/[/]$/, '');
      await fetch('/api/website-settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tunnelUrl }) });
      const full = tunnelUrl ? tunnelUrl + '/api/website-leads' : location.origin + '/api/website-leads';
      const display = document.getElementById('public-webhook-display');
      if (display) display.textContent = full;
      alert('Tunnel URL saved!');
    }

    function copyWebhookUrl() {
      const text = document.getElementById('public-webhook-display')?.textContent?.trim() || '';
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copy-webhook-btn');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); }
      });
    }

    async function saveWaWebhookOut() {
      const waWebhookOutUrl = document.getElementById('wa-webhook-out-url')?.value?.trim() || '';
      await fetch('/api/website-settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ waWebhookOutUrl }) });
      alert('Webhook OUT saved!');
    }

    async function updateLeadStatus(id, status) {
      await fetch(\`/api/website-leads/\${id}\`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) });
    }

    async function sendWaToLead(id) {
      const r = await fetch(\`/api/website-leads/\${id}/send-wa\`, { method:'POST', headers:{'Content-Type':'application/json'}, body: '{}' });
      const d = await r.json();
      if (d.ok) { alert('WhatsApp message sent!'); loadWebsite(); }
      else alert('Error: ' + (d.error || 'Failed'));
    }

    async function deleteWebsiteLead(id) {
      if (!confirm('Delete this lead?')) return;
      await fetch(\`/api/website-leads/\${id}\`, { method:'DELETE' });
      loadWebsite();
    }

    async function addTestLead() {
      await fetch('/api/website-leads', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:'Test User', phone:'919999999999', email:'test@example.com', source:'contact - Test', message:'I am interested in your property', pageUrl:'https://www.example.com/contact', ipAddress:'127.0.0.1' }) });
      loadWebsite();
    }

    function exportWebsiteLeads() {
      window.open('/api/website-leads', '_blank');
    }

    function filterWebsiteLeads(filter) { /* future: filter table rows */ }

    async function loadBrochures() {
      const r = await fetch('/api/brochures');
      const data = await r.json();
      const el = document.getElementById('brochures-content');
      const entries = Object.entries(data);

      el.innerHTML = \`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <div>
            <h2 style="font-size:16px;font-weight:600;color:var(--text)">WhatsApp Messages</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-top:4px">Configure messages sent via WhatsApp when the AI agent offers to send details. Link a message to each campaign.</p>
          </div>
          <button class="btn btn-primary" onclick="openBrochureEditor()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Message
          </button>
        </div>
        \${entries.length === 0 ? '<div class="empty-state" style="padding:48px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><h3>No WhatsApp messages configured</h3><p>Add a message to enable WhatsApp sending during calls</p></div>' :
        '<div class="card-list">' + entries.map(([k, v]) => \`
          <div class="card" style="cursor:default">
            <div class="card-body">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
                <div style="flex:1;min-width:200px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:15px;font-weight:600;color:var(--text)">\${esc(v.name)}</span>
                    <span style="font-size:11px;color:var(--text-dim);background:var(--surface-raised);padding:2px 8px;border-radius:4px;font-family:monospace">\${esc(k)}</span>
                  </div>
                  <div style="margin-top:8px;font-size:13px">
                    <div style="color:var(--text-muted);margin-bottom:4px">
                      <span style="color:var(--text-dim)">URL:</span>
                      <a href="\${esc(v.url)}" target="_blank" style="color:var(--accent-hover);word-break:break-all">\${esc(v.url)}</a>
                    </div>
                    <div style="color:var(--text-muted)">
                      <span style="color:var(--text-dim)">Caption:</span> \${esc(v.caption || '(none)')}
                    </div>
                  </div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                  <button class="btn btn-secondary btn-sm" onclick="openBrochureEditor('\${esc(k)}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteBrochureEntry('\${esc(k)}')">Delete</button>
                </div>
              </div>
            </div>
          </div>
        \`).join('') + '</div>'}
      \`;
    }

    let editingBrochureKey = null;

    function openBrochureEditor(key) {
      editingBrochureKey = key || null;
      const modal = document.getElementById('brochure-editor-modal');
      document.getElementById('be-title').textContent = key ? 'Edit WhatsApp Message' : 'Add WhatsApp Message';
      document.getElementById('be-key').value = key || '';
      document.getElementById('be-key').disabled = !!key;
      document.getElementById('be-name').value = '';
      document.getElementById('be-url').value = '';
      document.getElementById('be-caption').value = '';
      if (key) {
        fetch('/api/brochures').then(r=>r.json()).then(data => {
          const b = data[key];
          if (b) {
            document.getElementById('be-name').value = b.name || '';
            document.getElementById('be-url').value = b.url || '';
            document.getElementById('be-caption').value = b.caption || '';
          }
        });
      }
      modal.classList.add('open');
    }

    function closeBrochureEditor() { document.getElementById('brochure-editor-modal').classList.remove('open'); editingBrochureKey = null; }

    async function saveBrochureEntry() {
      const key = editingBrochureKey || document.getElementById('be-key').value.trim();
      const name = document.getElementById('be-name').value.trim();
      const url = document.getElementById('be-url').value.trim();
      const caption = document.getElementById('be-caption').value.trim();
      if (!key || !name || !url) { alert('Key, name, and URL are required'); return; }
      await fetch('/api/brochures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, name, url, caption }) });
      closeBrochureEditor();
      loadBrochures();
    }

    async function deleteBrochureEntry(key) {
      if (!confirm('Delete brochure "' + key + '"?')) return;
      await fetch('/api/brochures/' + encodeURIComponent(key), { method: 'DELETE' });
      loadBrochures();
    }

    // ─── Health ─────────────────────────────
    async function checkHealth() {
      try {
        const r=await fetch('/health'); const d=await r.json();
        document.getElementById('status-dot').className = 'status-dot online';
        document.getElementById('status-text').textContent = \`Online — \${d.sessions} active\`;
      } catch {
        document.getElementById('status-dot').className = 'status-dot offline';
        document.getElementById('status-text').textContent = 'Offline';
      }
      // Update WhatsApp sidebar card
      try {
        const wr = await fetch('/api/whatsapp/status');
        const wd = await wr.json();
        const dot = document.getElementById('wa-status-dot');
        const nameEl = document.getElementById('wa-sidebar-name');
        const numEl = document.getElementById('wa-sidebar-number');
        const card = document.getElementById('wa-sidebar-card');
        if (dot) {
          if (wd.connected) {
            dot.style.background = '#25d366';
            dot.style.boxShadow = '0 0 5px #25d366';
            if (card) { card.style.background = 'rgba(37,211,102,0.07)'; card.style.borderColor = 'rgba(37,211,102,0.2)'; }
            if (nameEl) nameEl.textContent = wd.name || 'Connected';
            if (numEl) numEl.textContent = wd.number ? '+' + wd.number : '';
          } else {
            dot.style.background = 'var(--red)';
            dot.style.boxShadow = 'none';
            if (card) { card.style.background = 'rgba(239,68,68,0.07)'; card.style.borderColor = 'rgba(239,68,68,0.2)'; }
            if (nameEl) { nameEl.style.color = 'var(--red)'; nameEl.textContent = 'Disconnected'; }
            if (numEl) numEl.textContent = 'Not connected';
          }
        }
      } catch {}
    }

    // ─── Model Selection & Settings ─────────
    async function loadModel() {
      try {
        const r = await fetch('/api/model');
        const d = await r.json();
        const badge = document.getElementById('model-badge');
        if (badge) badge.textContent = d.models[d.active]?.shortName || d.active;
        const sel = document.getElementById('settings-model-select');
        if (sel) sel.value = d.active;
      } catch {}
    }

    async function switchModel(model) {
      await fetch('/api/model', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
      loadModel();
    }

    let _evoInstances = []; // cached for dropdown use

    var AUTOMATION_API = 'http://localhost:5001';
    var automationSubPage = null;
    var automationItems = [];
    var _abEditId = null;

    function loadAutomationsList() {
      return fetch(AUTOMATION_API + '/api/automations')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          automationItems = data.map(function(a) { return { id: a.id, label: a.name, raw: a }; });
          return automationItems;
        })
        .catch(function() { return []; });
    }

    var _autoViewMode = 'card'; // 'card' or 'list'

    function loadAutomation(sub) {
      if (sub) automationSubPage = sub;
      var el = document.getElementById('automation-content');
      if (!el) return;
      loadAutomationsList().then(function(items) {
        if (automationSubPage === '__settings__') {
          _renderAutomationPage(items);
          _renderPlatformSettings();
        } else if (automationSubPage) {
          _renderAutomationPage(items);
          _renderAutomationDetail(automationSubPage);
        } else {
          automationSubPage = null;
          _renderAutomationPage(items);
          _renderAutomationOverview(items);
        }
      });
    }

    function _renderAutomationPage(items) {
      var el = document.getElementById('automation-content');
      if (!el) return;
      el.innerHTML = '<div style="width:100%;min-height:100%;box-sizing:border-box"><div id="automation-main" style="width:100%;min-width:0;overflow-x:hidden"></div></div>';
    }

    var _currentAutoObj = null;

    function _renderAutomationOverview(items) {
      var main = document.getElementById('automation-main');
      if (!main) return;

      var topbar = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">'
        + '<div style="font-size:18px;font-weight:700;color:var(--text);font-family:Playfair Display,Georgia,serif">Automations</div>'
        + '<div style="display:flex;gap:8px;align-items:center">'
        + '<div style="display:flex;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden">'
        + '<button onclick="_autoSetView(\\'card\\')" id="view-card-btn" style="padding:5px 11px;border:none;cursor:pointer;font-size:12px;background:' + (_autoViewMode==='card'?'var(--accent)':'var(--surface)') + ';color:' + (_autoViewMode==='card'?'#fff':'var(--text-secondary)') + '" title="Card View"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="13" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg></button>'
        + '<button onclick="_autoSetView(\\'list\\')" id="view-list-btn" style="padding:5px 11px;border:none;cursor:pointer;font-size:12px;background:' + (_autoViewMode==='list'?'var(--accent)':'var(--surface)') + ';color:' + (_autoViewMode==='list'?'#fff':'var(--text-secondary)') + '" title="List View"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>'
        + '</div>'
        + '<button onclick="automationBuilderOpen(null)" style="padding:7px 16px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-weight:700">+ New Automation</button>'
        + '<button onclick="loadAutomation(\\'__settings__\\')" style="padding:7px 14px;background:var(--surface);color:var(--text-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:13px">&#9881; Settings</button>'
        + '</div></div>';

      if (!items || items.length === 0) {
        main.innerHTML = '<div style="padding:28px">' + topbar
          + '<div style="text-align:center;padding:60px 20px;border:2px dashed var(--border);border-radius:var(--radius);color:var(--text-muted)">'
          + '<div style="font-size:32px;margin-bottom:12px">🤖</div>'
          + '<div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text)">No automations yet</div>'
          + '<div style="font-size:13px;margin-bottom:20px">Create your first automation to start sending WhatsApp messages automatically.</div>'
          + '<button onclick="automationBuilderOpen(null)" style="padding:9px 22px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:14px;font-weight:700">+ New Automation</button>'
          + '</div></div>';
        return;
      }

      var content = '';
      if (_autoViewMode === 'card') {
        content = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">';
        for (var i = 0; i < items.length; i++) {
          var a = items[i].raw;
          var aid = a.id;
          var isOn = a.enabled;
          content += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;display:flex;flex-direction:column;gap:10px;transition:box-shadow .15s,border-color .15s;cursor:default">'
            + '<div style="display:flex;align-items:flex-start;gap:8px">'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">' + esc(a.name) + '</div>'
            + '<div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(a.description || 'No description') + '</div>'
            + '</div>'
            + '<span style="flex-shrink:0;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700;background:' + (isOn ? '#dcfce7' : 'var(--bg-secondary)') + ';color:' + (isOn ? '#16a34a' : 'var(--text-muted)') + '">' + (isOn ? 'ON' : 'OFF') + '</span>'
            + '</div>'
            + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
            + '<span style="font-size:11px;padding:3px 8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:12px;color:var(--text-muted)">📋 ' + esc((a.data_source||{}).type||'manual') + '</span>'
            + '<span style="font-size:11px;padding:3px 8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:12px;color:var(--text-muted)">⏰ ' + esc(((a.schedule||{}).time)||'09:00') + '</span>'
            + '<span style="font-size:11px;padding:3px 8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:12px;color:var(--text-muted)">📱 ' + esc(a.whatsapp_instance||'—') + '</span>'
            + '</div>'
            + '<div style="display:flex;gap:6px;border-top:1px solid var(--border-subtle);padding-top:10px;flex-wrap:wrap">'
            + '<button onclick="automationSubPage=\\'' + aid + '\\';loadAutomation(\\'' + aid + '\\')" style="flex:1;padding:6px 10px;font-size:12px;font-weight:600;background:var(--accent-bg);color:var(--accent-hover);border:1px solid var(--accent-border);border-radius:var(--radius-sm);cursor:pointer">Open →</button>'
            + '<button onclick="automationRunNow(\\'' + aid + '\\')" style="padding:6px 10px;font-size:12px;background:var(--surface);color:var(--text-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer">▶ Run</button>'
            + '<button onclick="automationToggleEnabled(\\'' + aid + '\\',' + (!isOn) + ')" style="padding:6px 10px;font-size:12px;background:var(--surface);color:var(--text-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer">' + (isOn ? 'Disable' : 'Enable') + '</button>'
            + '</div></div>';
        }
        // Vendor Follow-up special card (card view)
        content += '<div style="background:var(--surface);border:2px solid #e0d4f7;border-radius:var(--radius);padding:18px 20px;display:flex;flex-direction:column;gap:10px">'
          + '<div style="display:flex;align-items:flex-start;gap:8px">'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px">Vendor Follow-up</div>'
          + '<div style="font-size:11px;color:var(--text-muted)">Track &amp; send follow-ups to vendors for bills, quotations &amp; more</div>'
          + '</div>'
          + '<span style="flex-shrink:0;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700;background:#f3e8ff;color:#7c3aed">MODULE</span>'
          + '</div>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
          + '<span style="font-size:11px;padding:3px 8px;background:#f3e8ff;border:1px solid #e0d4f7;border-radius:12px;color:#7c3aed">🤝 Bill / Quotation</span>'
          + '<span style="font-size:11px;padding:3px 8px;background:#f3e8ff;border:1px solid #e0d4f7;border-radius:12px;color:#7c3aed">🤖 AI Messages</span>'
          + '<span style="font-size:11px;padding:3px 8px;background:#f3e8ff;border:1px solid #e0d4f7;border-radius:12px;color:#7c3aed">📱 WhatsApp</span>'
          + '</div>'
          + '<div style="display:flex;gap:6px;border-top:1px solid var(--border-subtle);padding-top:10px">'
          + '<button onclick="navigate(\\'vendor\\',this)" style="flex:1;padding:6px 10px;font-size:12px;font-weight:600;background:#f3e8ff;color:#7c3aed;border:1px solid #e0d4f7;border-radius:var(--radius-sm);cursor:pointer">Open →</button>'
          + '</div></div>';
        content += '</div>';
      } else {
        // List view
        content = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">'
          + '<table style="width:100%;border-collapse:collapse">'
          + '<thead><tr style="background:var(--bg-secondary);border-bottom:1px solid var(--border)">'
          + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase">Name</th>'
          + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase">Status</th>'
          + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase">Source</th>'
          + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase">Schedule</th>'
          + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase">Instance</th>'
          + '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase">Actions</th>'
          + '</tr></thead><tbody>';
        for (var j = 0; j < items.length; j++) {
          var b = items[j].raw;
          var bid = b.id;
          var bon = b.enabled;
          content += '<tr style="border-bottom:1px solid var(--border-subtle)">'
            + '<td style="padding:12px 14px">'
            + '<div style="font-size:13px;font-weight:600;color:var(--text)">' + esc(b.name) + '</div>'
            + '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + esc(b.description||'') + '</div>'
            + '</td>'
            + '<td style="padding:12px 14px"><span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700;background:' + (bon?'#dcfce7':'var(--bg-secondary)') + ';color:' + (bon?'#16a34a':'var(--text-muted)') + '">' + (bon?'ON':'OFF') + '</span></td>'
            + '<td style="padding:12px 14px;font-size:12px;color:var(--text-muted)">' + esc((b.data_source||{}).type||'manual') + '</td>'
            + '<td style="padding:12px 14px;font-size:12px;color:var(--text-muted)">' + esc(((b.schedule||{}).time)||'09:00') + '</td>'
            + '<td style="padding:12px 14px;font-size:12px;color:var(--text-muted)">' + esc(b.whatsapp_instance||'—') + '</td>'
            + '<td style="padding:12px 14px;text-align:right">'
            + '<div style="display:flex;gap:6px;justify-content:flex-end">'
            + '<button onclick="automationSubPage=\\'' + bid + '\\';loadAutomation(\\'' + bid + '\\')" style="padding:5px 10px;font-size:11px;font-weight:600;background:var(--accent-bg);color:var(--accent-hover);border:1px solid var(--accent-border);border-radius:var(--radius-sm);cursor:pointer">Open</button>'
            + '<button onclick="automationRunNow(\\'' + bid + '\\')" style="padding:5px 10px;font-size:11px;background:var(--surface);color:var(--text-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer">Run</button>'
            + '<button onclick="automationToggleEnabled(\\'' + bid + '\\',' + (!bon) + ')" style="padding:5px 10px;font-size:11px;background:var(--surface);color:var(--text-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer">' + (bon?'Disable':'Enable') + '</button>'
            + '</div></td></tr>';
        }
        // Vendor Follow-up special row (list view)
        content += '<tr style="border-bottom:1px solid var(--border-subtle);background:#fdf8ff">'
          + '<td style="padding:12px 14px">'
          + '<div style="font-size:13px;font-weight:600;color:#7c3aed">Vendor Follow-up</div>'
          + '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">Track &amp; send follow-ups for bills, quotations &amp; more</div>'
          + '</td>'
          + '<td style="padding:12px 14px"><span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700;background:#f3e8ff;color:#7c3aed">MODULE</span></td>'
          + '<td style="padding:12px 14px;font-size:12px;color:var(--text-muted)">manual</td>'
          + '<td style="padding:12px 14px;font-size:12px;color:var(--text-muted)">on-demand</td>'
          + '<td style="padding:12px 14px;font-size:12px;color:var(--text-muted)">WhatsApp</td>'
          + '<td style="padding:12px 14px;text-align:right">'
          + '<button onclick="navigate(\\'vendor\\',this)" style="padding:5px 10px;font-size:11px;font-weight:600;background:#f3e8ff;color:#7c3aed;border:1px solid #e0d4f7;border-radius:var(--radius-sm);cursor:pointer">Open</button>'
          + '</td></tr>';
        content += '</tbody></table></div>';
      }

      main.innerHTML = '<div style="padding:0;max-width:100%;box-sizing:border-box">' + topbar + content + '</div>';
    }

    function _autoSetView(mode) {
      _autoViewMode = mode;
      _renderAutomationOverview(automationItems);
    }

    function _renderAutomationDetail(aid) {
      var main = document.getElementById('automation-main');
      if (!main) return;
      main.innerHTML = '<div style="padding:24px;color:var(--text-muted);font-size:13px">Loading...</div>';
      var auto = null;
      for (var i = 0; i < automationItems.length; i++) {
        if (automationItems[i].id === aid) { auto = automationItems[i].raw; break; }
      }
      if (!auto) return;
      _currentAutoObj = auto;
      var enabledBadge = auto.enabled
        ? '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#dcfce7;color:#16a34a;font-weight:600">ON</span>'
        : '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--bg-secondary);color:var(--text-muted);font-weight:600">OFF</span>';
      var html = '<div style="padding:0;max-width:100%;box-sizing:border-box">'
        + '<div style="margin-bottom:14px">'
        + '<button onclick="automationSubPage=null;loadAutomation(null)" style="padding:5px 12px;font-size:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--text-secondary)">← Back to Automations</button>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">'
        + '<h2 style="font-size:16px;font-weight:700;color:var(--text);margin:0">' + esc(auto.name) + '</h2>'
        + enabledBadge
        + '<div style="flex:1"></div>'
        + '<button onclick="automationBuilderOpen(_currentAutoObj)" style="padding:5px 10px;font-size:11px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);cursor:pointer">Edit</button>'
        + '<button onclick="automationToggleEnabled(\\'' + aid + '\\',' + (!auto.enabled) + ')" style="padding:5px 10px;font-size:11px;border:1px solid var(--accent-border);border-radius:var(--radius-sm);background:var(--accent-bg);color:var(--accent-hover);cursor:pointer">' + (auto.enabled ? 'Disable' : 'Enable') + '</button>'
        + '<button onclick="automationRunNow(\\'' + aid + '\\')" style="padding:5px 10px;font-size:11px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-weight:600">Run Now</button>'
        + '<button onclick="automationDelete(\\'' + aid + '\\')" style="padding:5px 10px;font-size:11px;border:1px solid #fecaca;border-radius:var(--radius-sm);background:#fef2f2;color:#dc2626;cursor:pointer">Delete</button>'
        + '</div>'
        + '<p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">' + esc(auto.description || '') + '</p>'
        + '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">'
        + _infoPill('Match', (auto.match_rule || {}).type || '—')
        + _infoPill('Source', (auto.data_source || {}).type || 'manual')
        + _infoPill('Schedule', ((auto.schedule || {}).time) || '09:00')
        + _infoPill('Instance', auto.whatsapp_instance || '—')
        + '</div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">'
        + '<div style="font-size:13px;font-weight:600;color:var(--text)">Data Rows</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
        + '<button onclick="automationAddRowOpen(\\'' + aid + '\\')" style="padding:4px 12px;font-size:11px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-weight:600">+ Add Row</button>'
        + '<label style="padding:4px 12px;font-size:11px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer"><input type="file" accept=".csv,.xlsx,.xls" style="display:none" onchange="automationUploadCsv(\\'' + aid + '\\',this)">Upload CSV</label>'
        + '</div>'
        + '</div>'
        + '<div id="auto-data-table" style="width:100%;overflow-x:auto;margin-bottom:4px">Loading rows...</div>'
        + '<div style="font-size:13px;font-weight:600;color:var(--text);margin:16px 0 8px">Recent Activity</div>'
        + '<div id="auto-activity-log" style="width:100%;overflow-x:auto">Loading...</div>'
        + '</div>';
      main.innerHTML = html;
      _loadDataTable(aid);
      _loadActivityLog(aid);
    }

    function _infoPill(label, val) {
      return '<div style="padding:6px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:20px;font-size:12px;color:var(--text-muted)">'
        + '<span style="font-weight:600;color:var(--text)">' + esc(label) + ':</span> ' + esc(val) + '</div>';
    }

    function _loadDataTable(aid) {
      fetch(AUTOMATION_API + '/api/automations/' + aid + '/data')
        .then(function(r) { return r.json(); })
        .then(function(rows) {
          var wrap = document.getElementById('auto-data-table');
          if (!wrap) return;
          if (!rows || rows.length === 0) {
            wrap.innerHTML = '<div style="padding:20px;border:1px solid var(--border);border-radius:8px;text-align:center;color:var(--text-muted);font-size:13px">No data rows yet. Click "+ Add Row" or upload a CSV.</div>';
            return;
          }
          // Collect all unique keys from ALL rows (CSV may have different columns)
          var keySet = {};
          for (var ri = 0; ri < rows.length; ri++) {
            var rd = rows[ri].data || rows[ri];
            Object.keys(rd).forEach(function(k) { if (k !== '_id' && k !== '_last_processed') keySet[k] = 1; });
          }
          var keys = Object.keys(keySet);
          var html = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:auto">'
            + '<table style="width:100%;border-collapse:collapse;min-width:400px">'
            + '<thead><tr style="border-bottom:1px solid var(--border)">';
          for (var k = 0; k < keys.length; k++) {
            html += '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;white-space:nowrap">' + esc(keys[k]) + '</th>';
          }
          html += '<th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase">Actions</th></tr></thead><tbody>';
          for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var data = row.data || row;
            var rowId = row.id || '';
            html += '<tr style="border-bottom:1px solid var(--border-subtle)">';
            for (var k2 = 0; k2 < keys.length; k2++) {
              var cellVal = data[keys[k2]];
              html += '<td style="padding:8px 12px;font-size:13px;color:var(--text);white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis" title="' + esc(cellVal != null ? String(cellVal) : '') + '">' + esc(cellVal != null ? String(cellVal) : '') + '</td>';
            }
            html += '<td style="padding:8px 12px;text-align:right">'
              + '<button onclick="automationDeleteRow(\\'' + rowId + '\\',\\'' + aid + '\\')" style="padding:3px 10px;font-size:11px;border:1px solid #fecaca;border-radius:var(--radius-sm);background:#fef2f2;color:#dc2626;cursor:pointer">Delete</button>'
              + '</td></tr>';
          }
          html += '</tbody></table></div>';
          wrap.innerHTML = html;
        });
    }

    function _loadActivityLog(aid) {
      fetch(AUTOMATION_API + '/api/activity-log')
        .then(function(r) { return r.json(); })
        .then(function(logs) {
          var wrap = document.getElementById('auto-activity-log');
          if (!wrap) return;
          var filtered = logs.filter(function(l) { return l.automation_id === aid; }).slice(0, 20);
          if (!filtered.length) {
            wrap.innerHTML = '<div style="padding:16px;border:1px solid var(--border);border-radius:8px;text-align:center;color:var(--text-muted);font-size:13px">No activity yet.</div>';
            return;
          }
          var html = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:auto">'
            + '<table style="width:100%;border-collapse:collapse">'
            + '<thead><tr style="border-bottom:1px solid var(--border)">'
            + '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim)">Time</th>'
            + '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim)">Recipient</th>'
            + '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim)">Phone</th>'
            + '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim)">Status</th>'
            + '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim)">Message</th>'
            + '</tr></thead><tbody>';
          for (var i = 0; i < filtered.length; i++) {
            var l = filtered[i];
            var statusColor = l.status === 'sent' ? '#16a34a' : '#dc2626';
            var statusBg = l.status === 'sent' ? '#dcfce7' : '#fef2f2';
            html += '<tr style="border-bottom:1px solid var(--border-subtle)">'
              + '<td style="padding:8px 12px;font-size:12px;color:var(--text-muted)">' + esc((l.sent_at || '').replace('T', ' ').slice(0, 16)) + '</td>'
              + '<td style="padding:8px 12px;font-size:13px;color:var(--text)">' + esc(l.recipient_name || '') + '</td>'
              + '<td style="padding:8px 12px;font-size:12px;color:var(--text-muted)">' + esc(l.recipient_phone || '') + '</td>'
              + '<td style="padding:8px 12px"><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:' + statusBg + ';color:' + statusColor + ';font-weight:600">' + esc(l.status || '') + '</span></td>'
              + '<td style="padding:8px 12px;font-size:12px;color:var(--text-muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(l.message_sent || '') + '</td>'
              + '</tr>';
          }
          html += '</tbody></table></div>';
          wrap.innerHTML = html;
        });
    }

    function _renderPlatformSettings() {
      var main = document.getElementById('automation-main');
      if (!main) return;
      main.innerHTML = '<div style="padding:0;max-width:100%;box-sizing:border-box">'
        + '<div style="margin-bottom:14px"><button onclick="automationSubPage=null;loadAutomation(null)" style="padding:5px 12px;font-size:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--text-secondary)">← Back to Automations</button></div>'
        + '<h2 style="font-size:16px;font-weight:700;margin-bottom:4px;color:var(--text)">Platform Settings</h2>'
        + '<p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Configure API keys used by all automations.</p>'
        + '<div id="plat-settings-form"><div style="color:var(--text-muted);font-size:13px">Loading...</div></div>'
        + '</div>';
      fetch(AUTOMATION_API + '/api/settings')
        .then(function(r) { return r.json(); })
        .then(function(s) {
          var inputStyle = 'width:100%;max-width:480px;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px';
          var labelStyle = 'font-size:11px;font-weight:600;color:var(--text-dim);display:block;margin-bottom:4px;margin-top:14px';
          var sectionHdr = 'display:block;font-size:12px;font-weight:700;color:var(--text);margin:20px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border-subtle);text-transform:uppercase;letter-spacing:.06em';
          var html = '<div style="' + sectionHdr + '">WhatsApp / Evolution API</div>'
            + '<label style="' + labelStyle + '">Evolution API URL</label>'
            + '<input id="ps-evo-url" type="text" value="' + esc(s.evolution_api_url || '') + '" style="' + inputStyle + '">'
            + '<label style="' + labelStyle + '">Evolution API Key</label>'
            + '<input id="ps-evo-key" type="password" value="' + esc(s.evolution_api_key || '') + '" style="' + inputStyle + '">'
            + '<div style="' + sectionHdr + '">AI</div>'
            + '<label style="' + labelStyle + '">Gemini API Key</label>'
            + '<input id="ps-gemini-key" type="password" value="' + esc(s.gemini_api_key || '') + '" style="' + inputStyle + '">'
            + '<div style="' + sectionHdr + '">N8N Workflow Integration</div>'
            + '<label style="' + labelStyle + '">N8N Vendor Follow-up Webhook URL</label>'
            + '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Paste the n8n webhook URL here — vendor form submissions will be sent automatically to n8n which handles AI email + WhatsApp sending.</div>'
            + '<input id="ps-n8n-url" type="text" placeholder="http://your-n8n-host:5678/webhook/934c6e26-..." value="' + esc(s.n8n_webhook_url || '') + '" style="' + inputStyle + '">'
            + '<label style="' + labelStyle + '">WhatsApp Sending API URL (n8n)</label>'
            + '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">The URL your n8n workflow uses to send WhatsApp messages.</div>'
            + '<input id="ps-wa-api-url" type="text" placeholder="http://72.61.170.222:3008/send" value="' + esc(s.whatsapp_api_url || 'http://72.61.170.222:3008/send') + '" style="' + inputStyle + '">'
            + '<div style="margin-top:18px">'
            + '<button onclick="platformSettingsSave()" style="padding:8px 20px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-weight:600">Save Settings</button>'
            + '<span id="ps-status" style="margin-left:12px;font-size:13px;color:var(--text-muted)"></span>'
            + '</div>';
          document.getElementById('plat-settings-form').innerHTML = html;
        });
    }

    function platformSettingsSave() {
      var payload = {
        evolution_api_url: document.getElementById('ps-evo-url').value,
        evolution_api_key:  document.getElementById('ps-evo-key').value,
        gemini_api_key:     document.getElementById('ps-gemini-key').value,
        n8n_webhook_url:    document.getElementById('ps-n8n-url').value,
        whatsapp_api_url:   document.getElementById('ps-wa-api-url').value,
      };
      fetch(AUTOMATION_API + '/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function(r) { return r.json(); })
        .then(function() { document.getElementById('ps-status').textContent = 'Saved!'; setTimeout(function() { document.getElementById('ps-status').textContent = ''; }, 2000); });
    }

    function automationToggleEnabled(aid, enabled) {
      var auto = null;
      for (var i = 0; i < automationItems.length; i++) { if (automationItems[i].id === aid) { auto = automationItems[i].raw; break; } }
      if (!auto) return;
      var payload = Object.assign({}, auto, { enabled: enabled });
      fetch(AUTOMATION_API + '/api/automations/' + aid, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function() {
          // If we're in detail view, reload detail; if in overview, reload overview
          if (automationSubPage === aid) { loadAutomation(aid); } else { loadAutomation(null); }
        });
    }

    function automationRunNow(aid) {
      var btn = event && event.target;
      if (btn) { btn.textContent = 'Running...'; btn.disabled = true; }
      fetch(AUTOMATION_API + '/api/automations/' + aid + '/run', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(res) {
          if (btn) { btn.textContent = 'Run Now'; btn.disabled = false; }
          alert('Done: sent=' + (res.sent || 0) + ', failed=' + (res.failed || 0) + ', skipped=' + (res.skipped || 0));
          _loadActivityLog(aid);
        });
    }

    function automationDelete(aid) {
      if (!confirm('Delete this automation and all its data?')) return;
      fetch(AUTOMATION_API + '/api/automations/' + aid, { method: 'DELETE' })
        .then(function() { automationSubPage = null; loadAutomation(null); });
    }

    function automationRunNowOverview(aid) {
      fetch(AUTOMATION_API + '/api/automations/' + aid + '/run', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(res) {
          alert('Done: sent=' + (res.sent || 0) + ', failed=' + (res.failed || 0) + ', skipped=' + (res.skipped || 0));
        });
    }

    function automationDeleteRow(rowId, aid) {
      fetch(AUTOMATION_API + '/api/data/' + rowId, { method: 'DELETE' })
        .then(function() { _loadDataTable(aid); });
    }

    function automationUploadCsv(aid, input) {
      var file = input && input.files && input.files[0];
      if (!file) return;
      var fd = new FormData();
      fd.append('file', file);
      fetch(AUTOMATION_API + '/api/automations/' + aid + '/upload', { method: 'POST', body: fd })
        .then(function(r) { return r.json(); })
        .then(function(res) {
          alert('Imported ' + (res.imported || 0) + ' rows.');
          _loadDataTable(aid);
          input.value = '';
        });
    }

    function automationAddRowOpen(aid) {
      var main = document.getElementById('automation-main');
      if (!main) return;
      var existing = document.getElementById('add-row-modal');
      if (existing) { existing.remove(); return; }
      var div = document.createElement('div');
      div.id = 'add-row-modal';
      div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9000';
      div.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:24px;width:440px;max-width:90vw">'
        + '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px">Add Row</div>'
        + '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Enter a JSON object with the row fields, e.g. <code>{"name":"Rahul","phone":"9876543210","birthday":"04-14"}</code></div>'
        + '<textarea id="add-row-json" rows="5" style="width:100%;box-sizing:border-box;font-size:12px;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-family:monospace"></textarea>'
        + '<div id="add-row-err" style="color:#dc2626;font-size:12px;margin-top:6px"></div>'
        + '<div style="display:flex;gap:8px;margin-top:14px">'
        + '<button onclick="automationAddRowSave(\\'' + aid + '\\')" style="padding:7px 18px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-weight:600">Save</button>'
        + '<button onclick="document.getElementById(\\'add-row-modal\\').remove()" style="padding:7px 14px;background:var(--surface);color:var(--text-muted);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:13px">Cancel</button>'
        + '</div></div>';
      document.body.appendChild(div);
    }

    function automationAddRowSave(aid) {
      var txt = document.getElementById('add-row-json').value.trim();
      var data;
      try { data = JSON.parse(txt); } catch(e) { document.getElementById('add-row-err').textContent = 'Invalid JSON: ' + e.message; return; }
      fetch(AUTOMATION_API + '/api/automations/' + aid + '/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: data }) })
        .then(function(r) { return r.json(); })
        .then(function() {
          document.getElementById('add-row-modal').remove();
          _loadDataTable(aid);
        });
    }

    // ── Automation Builder Modal ──────────────────────────────────────────────
    function automationBuilderOpen(rawJson) {
      var existing = document.getElementById('automation-builder-modal');
      if (existing) existing.remove();
      var existing2 = automationItems;
      // Fetch instances fresh each time the builder opens
      fetch('/api/evolution/instances')
        .then(function(r) { return r.json(); })
        .then(function(insts) {
          if (Array.isArray(insts)) _evoInstances = insts;
          _automationBuilderRender(rawJson);
        })
        .catch(function() { _automationBuilderRender(rawJson); });
    }

    function _automationBuilderRender(rawJson) {
      var evoOpts = '<option value="">— select instance —</option>';
      for (var k = 0; k < _evoInstances.length; k++) {
        evoOpts += '<option value="' + esc(_evoInstances[k].name) + '">' + esc(_evoInstances[k].name) + ((_evoInstances[k].connected) ? ' ✓' : '') + '</option>';
      }
      var modal = document.createElement('div');
      modal.id = 'automation-builder-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-start;justify-content:center;z-index:9000;overflow-y:auto;padding:32px 24px';
      var inputStyle = 'width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px';
      var labelStyle = 'font-size:11px;font-weight:600;color:var(--text-dim);display:block;margin-bottom:4px;margin-top:12px';
      var sectionStyle = 'background:var(--bg-secondary);border-radius:8px;padding:14px 16px;margin-top:14px;border:1px solid var(--border-subtle)';
      modal.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:28px;width:560px;max-width:96vw">'
        + '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:18px" id="ab-title">New Automation</div>'
        + '<input type="hidden" id="ab-edit-id" value="">'
        + '<label style="' + labelStyle + '">Name *</label><input id="ab-name" type="text" placeholder="e.g. Employee Birthday Wish" style="' + inputStyle + '">'
        + '<label style="' + labelStyle + '">Description</label><input id="ab-desc" type="text" placeholder="Optional description" style="' + inputStyle + '">'
        + '<label style="' + labelStyle + '" for="ab-enabled">Enabled</label><input type="checkbox" id="ab-enabled" style="width:16px;height:16px">'

        + '<div style="' + sectionStyle + '"><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Data Source</div>'
        + '<label style="' + labelStyle + '">Type</label>'
        + '<select id="ab-source-type" style="' + inputStyle + '">'
        + '<option value="manual">Manual Entry</option>'
        + '<option value="supabase_table">Supabase Table</option>'
        + '<option value="google_sheets">Google Sheets</option>'
        + '</select></div>'

        + '<div style="' + sectionStyle + '"><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Match Rule</div>'
        + '<label style="' + labelStyle + '">Type</label>'
        + '<select id="ab-rule-type" style="' + inputStyle + '">'
        + '<option value="today_field">Today\\'s Date Match (e.g. birthday)</option>'
        + '<option value="days_before">Days Before Date (e.g. payment due)</option>'
        + '<option value="interval">Interval Followup (e.g. vendor)</option>'
        + '</select>'
        + '<label style="' + labelStyle + '">Field Name (in data row)</label><input id="ab-rule-field" type="text" placeholder="e.g. birthday" style="' + inputStyle + '">'
        + '<label style="' + labelStyle + '">Format / Days</label><input id="ab-rule-format" type="text" placeholder="MM-DD  or  7,3,1  or  7" style="' + inputStyle + '">'
        + '</div>'

        + '<div style="' + sectionStyle + '"><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Message</div>'
        + '<label style="' + labelStyle + '">Template (use {field} for variables)</label>'
        + '<textarea id="ab-template" rows="3" placeholder="Happy Birthday {name}! 🎂" style="' + inputStyle + '"></textarea>'
        + '<label style="' + labelStyle + '">Use Image Personalization</label><input type="checkbox" id="ab-use-image" style="width:16px;height:16px">'
        + '<label style="' + labelStyle + '">Image Template URL</label><input id="ab-image-url" type="text" placeholder="https://..." style="' + inputStyle + '">'
        + '<label style="' + labelStyle + '">Image Prompt (use {field} for variables)</label>'
        + '<textarea id="ab-image-prompt" rows="2" placeholder="Replace name at bottom with: {name}" style="' + inputStyle + '"></textarea>'
        + '</div>'

        + '<div style="' + sectionStyle + '"><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Delivery</div>'
        + '<label style="' + labelStyle + '">WhatsApp Instance</label>'
        + '<select id="ab-instance" style="' + inputStyle + '">' + evoOpts + '</select>'
        + '</div>'

        + '<div style="' + sectionStyle + '"><div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Schedule</div>'
        + '<label style="' + labelStyle + '">Type</label>'
        + '<select id="ab-sched-type" style="' + inputStyle + '"><option value="daily">Daily</option><option value="manual">Manual Only</option></select>'
        + '<label style="' + labelStyle + '">Time (24h)</label><input id="ab-sched-time" type="time" value="09:00" style="' + inputStyle + '">'
        + '</div>'

        + '<div id="ab-err" style="color:#dc2626;font-size:12px;margin-top:10px"></div>'
        + '<div style="display:flex;gap:8px;margin-top:20px">'
        + '<button onclick="automationBuilderSave()" style="padding:8px 22px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-weight:700">Save</button>'
        + '<button onclick="document.getElementById(\\'automation-builder-modal\\').remove()" style="padding:8px 14px;background:var(--surface);color:var(--text-muted);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:13px">Cancel</button>'
        + '</div></div>';
      document.body.appendChild(modal);

      // Populate if editing
      if (rawJson) {
        var a = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        document.getElementById('ab-title').textContent = 'Edit Automation';
        document.getElementById('ab-edit-id').value = a.id || '';
        document.getElementById('ab-name').value = a.name || '';
        document.getElementById('ab-desc').value = a.description || '';
        document.getElementById('ab-enabled').checked = !!a.enabled;
        var src = a.data_source || {};
        document.getElementById('ab-source-type').value = src.type || 'manual';
        var rule = a.match_rule || {};
        document.getElementById('ab-rule-type').value = rule.type || 'today_field';
        document.getElementById('ab-rule-field').value = rule.field || '';
        var fmtOrDays = rule.format || (Array.isArray(rule.days) ? rule.days.join(',') : (rule.days || ''));
        document.getElementById('ab-rule-format').value = fmtOrDays;
        document.getElementById('ab-template').value = a.message_template || '';
        document.getElementById('ab-use-image').checked = !!a.use_image;
        document.getElementById('ab-image-url').value = a.image_template_url || '';
        document.getElementById('ab-image-prompt').value = a.image_prompt || '';
        document.getElementById('ab-instance').value = a.whatsapp_instance || '';
        var sched = a.schedule || {};
        document.getElementById('ab-sched-type').value = sched.type || 'daily';
        document.getElementById('ab-sched-time').value = sched.time || '09:00';
      }
    }

    function automationBuilderSave() {
      var name = document.getElementById('ab-name').value.trim();
      if (!name) { document.getElementById('ab-err').textContent = 'Name is required.'; return; }
      var ruleType = document.getElementById('ab-rule-type').value;
      var fmtVal = document.getElementById('ab-rule-format').value.trim();
      var matchRule = { type: ruleType, field: document.getElementById('ab-rule-field').value.trim() };
      if (ruleType === 'today_field') matchRule.format = fmtVal || 'MM-DD';
      else if (ruleType === 'days_before') matchRule.days = fmtVal.split(',').map(function(x) { return parseInt(x.trim(), 10); }).filter(function(x) { return !isNaN(x); });
      else if (ruleType === 'interval') matchRule.days = parseInt(fmtVal, 10) || 7;
      var payload = {
        name: name,
        description: document.getElementById('ab-desc').value,
        enabled: document.getElementById('ab-enabled').checked,
        data_source: { type: document.getElementById('ab-source-type').value },
        match_rule: matchRule,
        message_template: document.getElementById('ab-template').value,
        use_image: document.getElementById('ab-use-image').checked,
        image_template_url: document.getElementById('ab-image-url').value,
        image_prompt: document.getElementById('ab-image-prompt').value,
        whatsapp_instance: document.getElementById('ab-instance').value,
        schedule: { type: document.getElementById('ab-sched-type').value, time: document.getElementById('ab-sched-time').value || '09:00' },
      };
      var editId = document.getElementById('ab-edit-id').value;
      var url = editId ? AUTOMATION_API + '/api/automations/' + editId : AUTOMATION_API + '/api/automations';
      var method = editId ? 'PUT' : 'POST';
      fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function(r) { return r.json(); })
        .then(function(res) {
          document.getElementById('automation-builder-modal').remove();
          loadAutomation(res.id || editId);
        })
        .catch(function(e) { document.getElementById('ab-err').textContent = 'Error: ' + e.message; });
    }

    // ─── Birthday Automation Functions (legacy helpers kept, not called by new platform) ─

    function birthdayLoadList() {
      var wrap = document.getElementById('birthday-list-wrap');
      if (!wrap) return;
      birthdayPopulateInstDropdown('bday-global-inst', '');
      fetch(AUTOMATION_API + '/api/automation/birthday').then(function(r) { return r.json(); }).then(function(employees) {
        if (!employees || employees.length === 0) {
          wrap.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:24px;text-align:center;color:var(--text-muted);font-size:13px">No employees added yet. Click "+ Add Employee" to get started.</div>';
          return;
        }
        var html = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">'
          + '<table style="width:100%;border-collapse:collapse">'
          + '<thead><tr style="border-bottom:1px solid var(--border)">'
          + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Name</th>'
          + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Phone</th>'
          + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Birthday</th>'
          + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Instance</th>'
          + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Status</th>'
          + '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Actions</th>'
          + '</tr></thead><tbody>';
        for (var i = 0; i < employees.length; i++) {
          var e = employees[i];
          var rowBg = i % 2 === 1 ? 'background:var(--bg-secondary)' : '';
          var statusBadge = e.enabled
            ? '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#dcfce7;color:#16a34a;font-weight:600">Active</span>'
            : '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--bg-secondary);color:var(--text-muted);font-weight:600">Disabled</span>';
          var safeId = JSON.stringify(e.id);
          var safeName = JSON.stringify(e.name);
          var safePhone = JSON.stringify(e.phone);
          var safeBday = JSON.stringify(e.birthday);
          var safeInst = JSON.stringify(e.whatsapp_instance);
          var safeMsg = JSON.stringify(e.message_template);
          var safeEnabled = e.enabled ? 'true' : 'false';
          html += '<tr style="border-bottom:1px solid var(--border-subtle);' + rowBg + '">'
            + '<td style="padding:10px 14px;font-size:13px;color:var(--text);font-weight:500">' + esc(e.name) + '</td>'
            + '<td style="padding:10px 14px;font-size:13px;color:var(--text-muted)">' + esc(e.phone) + '</td>'
            + '<td style="padding:10px 14px;font-size:13px;color:var(--text-muted)">' + esc(e.birthday) + '</td>'
            + '<td style="padding:10px 14px;font-size:13px;color:var(--text-muted)">' + (e.whatsapp_instance ? esc(e.whatsapp_instance) : '<em style="color:var(--text-dim)">default</em>') + '</td>'
            + '<td style="padding:10px 14px">' + statusBadge + '</td>'
            + '<td style="padding:10px 14px;text-align:right;white-space:nowrap">'
            + '<button onclick="birthdayEdit(' + safeId + ',' + safeName + ',' + safePhone + ',' + safeBday + ',' + safeInst + ',' + safeMsg + ',' + safeEnabled + ')" style="padding:4px 10px;font-size:11px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);cursor:pointer;margin-right:4px">Edit</button>'
            + '<button onclick="birthdayTest(' + safeId + ')" style="padding:4px 10px;font-size:11px;border:1px solid var(--accent-border);border-radius:var(--radius-sm);background:var(--accent-bg);color:var(--accent-hover);cursor:pointer;margin-right:4px">Test</button>'
            + '<button onclick="birthdayDelete(' + safeId + ')" style="padding:4px 10px;font-size:11px;border:1px solid #fecaca;border-radius:var(--radius-sm);background:#fef2f2;color:#dc2626;cursor:pointer">Delete</button>'
            + '</td></tr>';
        }
        html += '</tbody></table></div>';
        wrap.innerHTML = html;
      }).catch(function(err) {
        wrap.innerHTML = '<div style="color:#dc2626;font-size:13px;padding:16px">Error loading employees: ' + esc(err.message) + '</div>';
      });
    }

    function birthdayShowAdd() {
      var form = document.getElementById('birthday-add-form');
      var title = document.getElementById('birthday-form-title');
      if (!form) return;
      document.getElementById('bday-edit-id').value = '';
      document.getElementById('bday-name').value = '';
      document.getElementById('bday-phone').value = '';
      document.getElementById('bday-bday').value = '';
      birthdayPopulateInstDropdown('bday-inst', '');
      if (title) title.textContent = 'Add Employee';
      form.style.display = 'block';
      document.getElementById('bday-name').focus();
    }

    function birthdayHideForm() {
      var form = document.getElementById('birthday-add-form');
      if (form) form.style.display = 'none';
    }

    function birthdayEdit(id, name, phone, bday, inst, msg, enabled) {
      var form = document.getElementById('birthday-add-form');
      var title = document.getElementById('birthday-form-title');
      if (!form) return;
      document.getElementById('bday-edit-id').value = id;
      document.getElementById('bday-name').value = name;
      document.getElementById('bday-phone').value = phone;
      document.getElementById('bday-bday').value = bday;
      birthdayPopulateInstDropdown('bday-inst', inst);
      if (title) title.textContent = 'Edit Employee';
      form.style.display = 'block';
      document.getElementById('bday-name').focus();
    }

    function birthdaySave() {
      var id = document.getElementById('bday-edit-id').value;
      var name = document.getElementById('bday-name').value.trim();
      var phone = document.getElementById('bday-phone').value.trim();
      var bday = document.getElementById('bday-bday').value.trim();
      var inst = document.getElementById('bday-inst').value.trim();
      if (!name || !phone || !bday) {
        alert('Name, Phone, and Birthday are required.');
        return;
      }
      if (!/^\\d{2}-\\d{2}$/.test(bday)) {
        alert('Birthday must be in MM-DD format (e.g. 04-15).');
        return;
      }

      if (id) {
        var payload = JSON.stringify({ name: name, phone: phone, birthday: bday, instance: inst, enabled: true });
        fetch(AUTOMATION_API + '/api/automation/birthday/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: payload })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            birthdayHideForm();
            loadAutomation('birthday');
          })
          .catch(function(err) { alert('Error: ' + err.message); });
        return;
      }

      if (!_bdaySheetData) {
        _bdaySheetData = {
          rows: [['Name', 'Phone', 'Birthday']],
          mapping: { name: 0, phone: 1, bday: 2 },
          skipped: 0
        };
        _bdaySheetHeaders = ['Name', 'Phone', 'Birthday'];
        for (var vi = 0; vi < _bdayVariables.length; vi++) {
          var bv = _bdayVariables[vi];
          if (bv.col < 0) {
            if (bv.key === 'name') bv.col = 0;
            else if (bv.key === 'phone') bv.col = 1;
            else if (bv.key === 'birthday') bv.col = 2;
          }
        }
        birthdayRenderVariables();
      }

      var m = _bdaySheetData.mapping;
      var numCols = 0;
      for (var r = 0; r < _bdaySheetData.rows.length; r++) {
        if (_bdaySheetData.rows[r] && _bdaySheetData.rows[r].length > numCols) numCols = _bdaySheetData.rows[r].length;
      }
      if (numCols < 3) numCols = 3;
      var newRow = [];
      for (var c = 0; c < numCols; c++) newRow.push('');
      var nameCol = m.name >= 0 ? m.name : 0;
      var phoneCol = m.phone >= 0 ? m.phone : 1;
      var bdayCol = m.bday >= 0 ? m.bday : 2;
      newRow[nameCol] = name;
      newRow[phoneCol] = phone;
      newRow[bdayCol] = bday;
      _bdaySheetData.rows.push(newRow);
      birthdayExtractAndStore();
      birthdayRenderSheet();
      birthdayHideForm();
      document.getElementById('bday-name').value = '';
      document.getElementById('bday-phone').value = '';
      document.getElementById('bday-bday').value = '';
    }

    function birthdayDelete(id) {
      if (!confirm('Delete this employee from birthday automation?')) return;
      fetch(AUTOMATION_API + '/api/automation/birthday/' + id, { method: 'DELETE' })
        .then(function() { loadAutomation('birthday'); })
        .catch(function(err) { alert('Error: ' + err.message); });
    }

    function birthdayTest(id) {
      if (!confirm('Send a test birthday message to this employee now?')) return;
      fetch(AUTOMATION_API + '/api/automation/birthday/test/' + id, { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.error) { alert('Error sending test: ' + data.error); return; }
          alert('Test message sent successfully!');
        })
        .catch(function(err) { alert('Error: ' + err.message); });
    }

    function birthdaySaveTmpl() {
      var tmpl = document.getElementById('birthday-tmpl');
      if (!tmpl) return;
      var val = tmpl.value.trim();
      if (!val) { alert('Template cannot be empty.'); return; }
      alert('Default template saved. Individual employees without a custom message will use this template.');
    }

    function birthdayToggleAuto(chk) {
      if (chk.checked) {
        alert('Auto Send enabled. Birthday messages will be sent automatically at midnight IST.');
      } else {
        alert('Auto Send disabled. Birthday messages will not be sent automatically.');
      }
    }

    function birthdayPopulateInstDropdown(selectId, selectedVal) {
      var sel = document.getElementById(selectId);
      if (!sel) return;
      fetch('/api/evolution/instances').then(function(r) { return r.json(); }).then(function(instances) {
        var opts = '<option value="">-- Select Instance --</option>';
        for (var i = 0; i < instances.length; i++) {
          var inst = instances[i];
          var dot = inst.connectionStatus === 'open' ? '● ' : '○ ';
          var label = inst.profileName ? inst.name + ' (' + inst.profileName + ')' : inst.name;
          var isSelected = inst.name === selectedVal ? ' selected' : '';
          opts += '<option value="' + esc(inst.name) + '"' + isSelected + '>' + dot + esc(label) + '</option>';
        }
        sel.innerHTML = opts;
      }).catch(function() {
        sel.innerHTML = '<option value="">No instances found</option>';
      });
    }

    function birthdayCsvClick() {
      var f = document.getElementById('bday-csv-file');
      if (f) f.click();
    }

    var _bdayPendingRows = null;
    var _bdaySheetData = null;
    var _bdaySheetHeaders = [];
    var _bdayVariables = [];

    function birthdayAddVariable() {
      _bdayVariables.push({ key: '', col: -1 });
      birthdayRenderVariables();
    }

    function birthdayRemoveVariable(idx) {
      _bdayVariables.splice(idx, 1);
      birthdayRenderVariables();
    }

    function birthdayUpdateVarKey(idx, val) {
      if (!_bdayVariables[idx]) return;
      _bdayVariables[idx].key = String(val || '').replace(/[^a-zA-Z0-9_]/g, '');
      birthdayRenderVarChips();
    }

    function birthdayUpdateVarCol(idx, val) {
      if (!_bdayVariables[idx]) return;
      _bdayVariables[idx].col = parseInt(val, 10);
      if (isNaN(_bdayVariables[idx].col)) _bdayVariables[idx].col = -1;
    }

    function birthdayRenderVariables() {
      var wrap = document.getElementById('bday-vars-list');
      if (!wrap) return;
      var headers = _bdaySheetHeaders || [];
      var html = '';
      if (_bdayVariables.length === 0) {
        html = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:12px;font-style:italic;background:var(--bg-secondary);border-radius:6px">No variables defined yet. Click "+ Add Variable" to create one.</div>';
      } else {
        html = '<div style="display:grid;grid-template-columns:1fr 1.6fr 40px;gap:10px;margin-bottom:6px;padding:0 2px">'
          + '<div style="font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Placeholder Name</div>'
          + '<div style="font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Map to Sheet Column</div>'
          + '<div></div>'
          + '</div>';
        for (var i = 0; i < _bdayVariables.length; i++) {
          var v = _bdayVariables[i];
          html += '<div style="display:grid;grid-template-columns:1fr 1.6fr 40px;gap:10px;align-items:center;margin-bottom:8px">';
          html += '<div style="position:relative">';
          html += '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-dim);font-family:monospace;font-size:13px;pointer-events:none">&#123;</span>';
          html += '<input type="text" value="' + esc(v.key) + '" placeholder="name" oninput="birthdayUpdateVarKey(' + i + ', this.value)" style="width:100%;box-sizing:border-box;padding:7px 20px 7px 22px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px;font-family:monospace">';
          html += '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-dim);font-family:monospace;font-size:13px;pointer-events:none">&#125;</span>';
          html += '</div>';
          html += '<div>';
          if (headers.length > 0) {
            html += '<select onchange="birthdayUpdateVarCol(' + i + ', this.value)" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px">';
            html += '<option value="-1">-- Select column --</option>';
            for (var c = 0; c < headers.length; c++) {
              var selAttr = c === v.col ? ' selected' : '';
              var headerLabel = String(headers[c] || '(empty)');
              html += '<option value="' + c + '"' + selAttr + '>' + birthdayColLetter(c) + ' &middot; ' + esc(headerLabel) + '</option>';
            }
            html += '</select>';
          } else {
            html += '<div style="padding:7px 10px;border:1px dashed var(--border);border-radius:var(--radius-sm);color:var(--text-dim);font-size:12px;font-style:italic;background:var(--bg-secondary)">Upload a sheet first to map columns</div>';
          }
          html += '</div>';
          html += '<button onclick="birthdayRemoveVariable(' + i + ')" title="Remove variable" style="padding:7px 0;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:var(--radius-sm);cursor:pointer;font-size:16px;font-weight:600;line-height:1">&times;</button>';
          html += '</div>';
        }
      }
      wrap.innerHTML = html;
      birthdayRenderVarChips();
    }

    function birthdayRenderVarChips() {
      var chips = document.getElementById('bday-var-chips');
      if (!chips) return;
      var any = false;
      var html = '';
      for (var i = 0; i < _bdayVariables.length; i++) {
        var v = _bdayVariables[i];
        if (!v.key) continue;
        any = true;
        html += '<span onclick="birthdayInsertByIdx(' + i + ')" style="display:inline-block;padding:4px 12px;background:var(--accent-bg);color:var(--accent-hover);border:1px solid var(--accent-border);border-radius:12px;font-size:11px;font-family:monospace;cursor:pointer;margin:2px 4px 2px 0;user-select:none" title="Click to insert">&#123;' + esc(v.key) + '&#125;</span>';
      }
      if (!any) html = '<span style="color:var(--text-dim);font-size:11px;font-style:italic">No variables defined. Add variables above to see chips here.</span>';
      chips.innerHTML = html;
    }

    function birthdayInsertByIdx(idx) {
      var v = _bdayVariables[idx];
      if (!v || !v.key) return;
      var tmpl = document.getElementById('birthday-tmpl');
      if (!tmpl) return;
      var pos = (tmpl.selectionStart != null) ? tmpl.selectionStart : tmpl.value.length;
      var text = tmpl.value;
      var insert = '{' + v.key + '}';
      tmpl.value = text.substring(0, pos) + insert + text.substring(pos);
      tmpl.focus();
      var newPos = pos + insert.length;
      try { tmpl.selectionStart = tmpl.selectionEnd = newPos; } catch (e) {}
    }

    function birthdayImportFile(input) {
      var file = input.files && input.files[0];
      if (!file) return;
      var status = document.getElementById('bday-import-status');
      if (status) status.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px">Reading file...</div>';
      var name = (file.name || '').toLowerCase();
      var isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
      var reader = new FileReader();
      reader.onload = function(e) {
        var sheet2D = null;
        try {
          if (isExcel) {
            if (typeof XLSX === 'undefined') {
              status.innerHTML = '<div style="color:#dc2626;font-size:13px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px">Excel library not loaded. Please check your internet connection and reload the page.</div>';
              return;
            }
            var wb = XLSX.read(e.target.result, { type: 'array' });
            var wsName = wb.SheetNames[0];
            var ws = wb.Sheets[wsName];
            sheet2D = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
          } else {
            var text = e.target.result;
            if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
            sheet2D = birthdayParseCsvTo2D(text);
          }
        } catch (err) {
          status.innerHTML = '<div style="color:#dc2626;font-size:13px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px">Failed to parse file: ' + esc(err.message || String(err)) + '</div>';
          return;
        }
        input.value = '';
        if (!sheet2D || sheet2D.length < 2) {
          status.innerHTML = '<div style="color:#dc2626;font-size:13px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px">File is empty or has no data rows.</div>';
          return;
        }
        var detected = birthdayDetectColumns(sheet2D[0]);
        _bdaySheetData = { rows: sheet2D, mapping: detected };
        _bdaySheetHeaders = sheet2D[0] || [];
        // Auto-map existing variables to detected columns if still unmapped
        for (var vi = 0; vi < _bdayVariables.length; vi++) {
          var bv = _bdayVariables[vi];
          if (bv.col < 0) {
            if (bv.key === 'name' && detected.name >= 0) bv.col = detected.name;
            else if (bv.key === 'phone' && detected.phone >= 0) bv.col = detected.phone;
            else if (bv.key === 'birthday' && detected.bday >= 0) bv.col = detected.bday;
          }
        }
        birthdayRenderVariables();
        birthdayExtractAndStore();
        birthdayRenderSheet();
      };
      if (isExcel) reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
    }

    function birthdayParseCsvTo2D(text) {
      var lines = text.split(/\\r?\\n/);
      var out = [];
      var firstLine = lines[0] || '';
      var delim = ',';
      if (firstLine.indexOf(';') >= 0 && firstLine.split(';').length > firstLine.split(',').length) delim = ';';
      else if (firstLine.indexOf('\\t') >= 0 && firstLine.indexOf(',') < 0) delim = '\\t';
      for (var i = 0; i < lines.length; i++) {
        if (!lines[i] && i === lines.length - 1) continue;
        var cols = lines[i].split(delim).map(function(c) { return c.trim().replace(/^["']|["']$/g, ''); });
        out.push(cols);
      }
      return out;
    }

    function birthdayDetectColumns(headerRow) {
      var headers = headerRow.map(function(h) { return String(h || '').trim().toLowerCase().replace(/[^a-z]/g, ''); });
      function findIdx(patterns) {
        for (var p = 0; p < patterns.length; p++) {
          for (var i = 0; i < headers.length; i++) {
            if (headers[i] === patterns[p]) return i;
          }
        }
        for (var p2 = 0; p2 < patterns.length; p2++) {
          for (var j = 0; j < headers.length; j++) {
            if (headers[j].indexOf(patterns[p2]) >= 0) return j;
          }
        }
        return -1;
      }
      return {
        name:  findIdx(['name', 'employeename', 'fullname', 'employee', 'empname']),
        phone: findIdx(['phone', 'mobile', 'contact', 'whatsapp', 'number', 'mobilenumber', 'phonenumber']),
        bday:  findIdx(['birthday', 'dob', 'birthdate', 'bday', 'birth'])
      };
    }

    function birthdayExtractAndStore() {
      if (!_bdaySheetData) { _bdayPendingRows = null; return; }
      var m = _bdaySheetData.mapping;
      var data = _bdaySheetData.rows;
      if (m.name < 0 || m.phone < 0 || m.bday < 0) { _bdayPendingRows = null; return; }
      var valid = [];
      var skipped = 0;
      for (var i = 1; i < data.length; i++) {
        var row = data[i] || [];
        var nm = String(row[m.name] || '').trim();
        var ph = String(row[m.phone] || '').trim().replace(/\\s/g, '');
        var bd = String(row[m.bday] || '').trim().replace(/\\//g, '-');
        if (!nm || !ph || !bd) { skipped++; continue; }
        var mt = bd.match(/^(\\d{1,2})-(\\d{1,2})$/);
        if (!mt) { skipped++; continue; }
        var mm = mt[1].length === 1 ? '0' + mt[1] : mt[1];
        var dd = mt[2].length === 1 ? '0' + mt[2] : mt[2];
        valid.push({ name: nm, phone: ph, birthday: mm + '-' + dd, _row: row });
      }
      _bdayPendingRows = valid;
      _bdaySheetData.skipped = skipped;
    }

    function birthdayBuildVarsForRow(rawRow) {
      var obj = {};
      if (!rawRow) return obj;
      for (var j = 0; j < _bdayVariables.length; j++) {
        var v = _bdayVariables[j];
        if (v.key && v.col >= 0) {
          obj[v.key] = String(rawRow[v.col] || '').trim();
        }
      }
      return obj;
    }

    function birthdayColLetter(idx) {
      var s = '';
      idx = idx + 1;
      while (idx > 0) {
        var r = (idx - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        idx = Math.floor((idx - 1) / 26);
      }
      return s;
    }

    function birthdayRenderSheet() {
      var status = document.getElementById('bday-import-status');
      if (!status || !_bdaySheetData) return;
      var data = _bdaySheetData.rows;
      var mapping = _bdaySheetData.mapping;
      var numCols = 0;
      for (var r = 0; r < data.length; r++) {
        if (data[r] && data[r].length > numCols) numCols = data[r].length;
      }
      var mappedCols = {};
      mappedCols[mapping.name] = 'Name';
      mappedCols[mapping.phone] = 'Phone';
      mappedCols[mapping.bday] = 'Birthday';

      var html = '<div style="margin-top:10px">';

      // Summary bar
      var validCount = _bdayPendingRows ? _bdayPendingRows.length : 0;
      var skipped = _bdaySheetData.skipped || 0;
      var dataRows = data.length - 1;
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-bottom:none;border-radius:6px 6px 0 0;flex-wrap:wrap;gap:10px">';
      html += '<div style="font-size:12px;color:var(--text)">';
      html += '<b style="font-size:13px">Sheet1</b> &nbsp;&middot;&nbsp; ' + dataRows + ' data rows &nbsp;&middot;&nbsp; ' + numCols + ' columns';
      if (validCount > 0) html += ' &nbsp;&middot;&nbsp; <span style="color:#16a34a;font-weight:600">' + validCount + ' valid</span>';
      if (skipped > 0) html += ' &nbsp;&middot;&nbsp; <span style="color:#d97706;font-weight:600">' + skipped + ' skipped</span>';
      html += '</div>';
      html += '<div style="font-size:11px;color:var(--text-muted)">Blue columns are auto-mapped for import</div>';
      html += '</div>';

      // Mapping error
      if (mapping.name < 0 || mapping.phone < 0 || mapping.bday < 0) {
        html += '<div style="padding:10px 14px;background:#fef3c7;border:1px solid #fcd34d;border-top:none;color:#92400e;font-size:12px">';
        html += 'Could not auto-detect required columns. Need: <b>Name</b>, <b>Phone</b>, <b>Birthday</b>. Found headers: ';
        for (var h = 0; h < data[0].length; h++) {
          html += (h > 0 ? ', ' : '') + '<b>' + esc(String(data[0][h] || '(empty)')) + '</b>';
        }
        html += '</div>';
      }

      // Excel-like sheet
      html += '<div class="xl-sheet" style="border-radius:0">';
      html += '<table>';

      // Column letter row (A, B, C...)
      html += '<thead><tr>';
      html += '<th class="xl-corner"></th>';
      for (var c = 0; c < numCols; c++) {
        var cls = mappedCols[c] !== undefined ? 'xl-col xl-mapped' : 'xl-col';
        var title = mappedCols[c] !== undefined ? ' title="Mapped to: ' + mappedCols[c] + '"' : '';
        html += '<th class="' + cls + '"' + title + '>' + birthdayColLetter(c) + '</th>';
      }
      html += '</tr>';

      // Header row (row 1 from file)
      var headerRow = data[0] || [];
      html += '<tr class="xl-header-row">';
      html += '<td class="xl-row-num">1</td>';
      for (var c2 = 0; c2 < numCols; c2++) {
        var cls2 = mappedCols[c2] !== undefined ? 'xl-col-data xl-mapped' : 'xl-col-data';
        html += '<th class="' + cls2 + '">' + esc(String(headerRow[c2] || '')) + '</th>';
      }
      html += '</tr></thead>';

      // Data rows
      html += '<tbody>';
      for (var ri = 1; ri < data.length; ri++) {
        var row = data[ri] || [];
        html += '<tr>';
        html += '<td class="xl-row-num">' + (ri + 1) + '</td>';
        for (var ci = 0; ci < numCols; ci++) {
          var cellCls = mappedCols[ci] !== undefined ? 'xl-cell xl-mapped' : 'xl-cell';
          html += '<td class="' + cellCls + '">' + esc(String(row[ci] || '')) + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';

      // Action bar
      html += '<div style="padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-top:none;border-radius:0 0 6px 6px;display:flex;gap:8px;justify-content:flex-end;align-items:center">';
      html += '<button onclick="birthdayCancelImport()" style="padding:7px 16px;background:var(--surface);color:var(--text-muted);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:12px">Cancel</button>';
      if (validCount > 0) {
        html += '<button onclick="birthdayConfirmImport()" style="padding:7px 18px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:12px;font-weight:600">Import ' + validCount + ' Employee' + (validCount !== 1 ? 's' : '') + '</button>';
      } else {
        html += '<button disabled style="padding:7px 18px;background:#e5e7eb;color:#9ca3af;border:none;border-radius:var(--radius-sm);cursor:not-allowed;font-size:12px;font-weight:600">No valid rows to import</button>';
      }
      html += '</div>';

      html += '</div>';
      status.innerHTML = html;
    }

    function birthdayCancelImport() {
      _bdayPendingRows = null;
      _bdaySheetData = null;
      var status = document.getElementById('bday-import-status');
      if (status) status.innerHTML = '';
    }

    function birthdayConfirmImport() {
      var rows = _bdayPendingRows;
      if (!rows || !rows.length) return;
      var status = document.getElementById('bday-import-status');
      var globalInst = '';
      var gsel = document.getElementById('bday-global-inst');
      if (gsel) globalInst = gsel.value;
      if (status) status.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px">Importing ' + rows.length + ' employees...</div>';
      var tmplEl = document.getElementById('birthday-tmpl');
      var tmplVal = tmplEl ? tmplEl.value : '';
      var imported = 0, errors = 0;
      var promises = [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var varsObj = birthdayBuildVarsForRow(row._row);
        var payload = JSON.stringify({ name: row.name, phone: row.phone, birthday: row.birthday, instance: globalInst, message: tmplVal, enabled: true, variables: varsObj });
        promises.push(
          fetch(AUTOMATION_API + '/api/automation/birthday', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
            .then(function(r) { return r.json(); })
            .then(function(d) { if (d.error) errors++; else imported++; })
            .catch(function() { errors++; })
        );
      }
      Promise.all(promises).then(function() {
        var color = errors > 0 ? '#d97706' : '#16a34a';
        var bg = errors > 0 ? '#fef3c7' : '#dcfce7';
        var border = errors > 0 ? '#fcd34d' : '#86efac';
        var msg = '&#10003; Imported ' + imported + ' employee' + (imported !== 1 ? 's' : '') + '.';
        if (errors > 0) msg += ' ' + errors + ' failed.';
        if (status) status.innerHTML = '<div style="color:' + color + ';font-size:13px;font-weight:600;padding:10px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:6px">' + msg + '</div>';
        _bdayPendingRows = null;
        _bdaySheetData = null;
        birthdayLoadList();
        setTimeout(function() {
          var wrap = document.getElementById('birthday-list-wrap');
          if (wrap && wrap.scrollIntoView) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      });
    }

    async function loadSettings() {
      const [modelRes, autoRes, evoRes] = await Promise.all([
        fetch('/api/model'),
        fetch('/api/employee-instances/auto-detect'),
        fetch('/api/evolution/instances'),
      ]);
      const modelData = await modelRes.json();
      const employees = await autoRes.json();
      _evoInstances = await evoRes.json();
      const el = document.getElementById('settings-content');
      const models = modelData.models || {};
      const active = modelData.active;

      function instanceDropdown(emp) {
        const current = emp.instance_name || '';
        let opts = '<option value="">— Select instance —</option>';
        for (const inst of _evoInstances) {
          const sel = inst.name === current ? 'selected' : '';
          const statusDot = inst.connectionStatus === 'open' ? '\\u25CF' : '\\u25CB';
          const label = inst.profileName ? inst.name + ' (' + esc(inst.profileName) + ')' : inst.name;
          opts += '<option value="' + esc(inst.name) + '" ' + sel + '>' + statusDot + ' ' + esc(label) + '</option>';
        }
        opts += '<option value="__create__">+ Create New Instance</option>';
        return '<select style="font-size:13px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);min-width:180px" onchange="handleInstanceSelect(this,\\'' + esc(emp.employee_name) + '\\',\\'' + esc(emp.id || '') + '\\')">' + opts + '</select>';
      }

      function statusBadge(emp) {
        if (!emp.mapped) return '<span style="font-size:12px;color:var(--text-dim)">Not mapped</span>';
        // Find evo instance status
        const evo = _evoInstances.find(i => i.name === emp.instance_name);
        const connected = evo?.connectionStatus === 'open';
        const cls = connected ? 'running' : 'draft';
        const label = connected ? 'Connected' : (emp.status || 'Pending');
        return '<span class="badge-status badge-' + cls + '"><span class="badge-dot"></span>' + label + '</span>';
      }

      el.innerHTML = \`
        <div style="max-width:780px">

          <!-- WhatsApp Employee Routing -->
          <div class="card" style="cursor:default;margin-bottom:12px">
            <div class="card-body">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
                <div>
                  <h3 style="font-size:15px;font-weight:600;color:var(--text)">WhatsApp Employee Routing</h3>
                  <p style="font-size:13px;color:var(--text-muted);margin-top:2px">Salespersons auto-detected from campaigns. Map each to a WhatsApp instance in Evolution API.</p>
                </div>
                <button class="btn btn-primary btn-sm" onclick="addEmployeeInstance()">+ Add Manual</button>
              </div>
              \${employees.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:13px">No salespersons found in campaigns. Upload contacts with an EmployeeName column.</div>' :
              '<div style="display:flex;flex-direction:column;gap:6px">' +
              '<div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:8px;padding:6px 14px;font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px"><span>Salesperson</span><span>Evolution API Instance</span><span>Status</span><span></span></div>' +
              employees.map(e => \`
                <div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:8px;align-items:center;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm)">
                  <div>
                    <div style="font-size:14px;font-weight:600;color:var(--text)">\${esc(e.employee_name)}</div>
                  </div>
                  <div>\${instanceDropdown(e)}</div>
                  <div>\${statusBadge(e)}</div>
                  <div style="display:flex;gap:4px">
                    \${e.mapped ? '<button class="btn btn-ghost btn-sm" onclick="checkInstanceStatus(\\'' + esc(e.id) + '\\',\\'' + esc(e.instance_name) + '\\')">Check</button><button class="btn btn-danger btn-sm" onclick="unlinkEmployee(\\'' + esc(e.id) + '\\')">Unlink</button>' : ''}
                  </div>
                </div>
              \`).join('') + '</div>'}
            </div>
          </div>

          <!-- AI Model -->
          <div class="card" style="cursor:default;margin-bottom:12px">
            <div class="card-body">
              <h3 style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px">AI Model</h3>
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Select which Gemini model to use for new calls.</p>
              <div style="display:flex;flex-direction:column;gap:8px">
                \${Object.entries(models).map(([id, m]) => \`
                  <label style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:\${id===active?'var(--accent-bg)':'var(--surface)'};border:1px solid \${id===active?'var(--accent-border)':'var(--border)'};border-radius:var(--radius-sm);cursor:pointer;transition:all var(--transition)" onclick="switchModel('\${id}');setTimeout(loadSettings,300)">
                    <input type="radio" name="model" value="\${id}" \${id===active?'checked':''} style="margin-top:2px;accent-color:var(--accent)">
                    <div>
                      <div style="font-size:14px;font-weight:600;color:var(--text)">\${esc(m.name)}</div>
                      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">\${id}</div>
                      <div style="margin-top:8px;display:grid;grid-template-columns:repeat(2,1fr);gap:4px 16px;font-size:12px;color:var(--text-dim)">
                        <span>Text in: $\${m.pricing.textInput}/1M</span><span>Audio in: $\${m.pricing.audioInput}/1M</span>
                        <span>Text out: $\${m.pricing.textOutput}/1M</span><span>Audio out: $\${m.pricing.audioOutput}/1M</span>
                      </div>
                    </div>
                  </label>
                \`).join('')}
              </div>
            </div>
          </div>

          <!-- Cost Rates -->
          <div class="card" style="cursor:default;margin-bottom:12px">
            <div class="card-body">
              <h3 style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px">Cost Rates</h3>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;margin-top:8px">
                <div style="padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm)">
                  <div style="color:var(--text-dim);font-size:11px">Plivo Rate</div><div style="color:var(--text);font-weight:600;margin-top:2px">₹0.74/min</div>
                </div>
                <div style="padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm)">
                  <div style="color:var(--text-dim);font-size:11px">USD/INR</div><div style="color:var(--text);font-weight:600;margin-top:2px">₹84</div>
                </div>
              </div>
              <p style="font-size:12px;color:var(--text-dim);margin-top:8px">Gemini pricing: <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" style="color:var(--accent-hover)">ai.google.dev/gemini-api/docs/pricing</a></p>
            </div>
          </div>
        </div>
      \`;
    }

    async function testEvoConnection() {
      const url = document.getElementById('evo-url').value.trim();
      const apiKey = document.getElementById('evo-apikey').value.trim();
      const instance = document.getElementById('evo-instance').value.trim();
      const resultEl = document.getElementById('evo-test-result');
      if (!url) { resultEl.style.color = 'var(--red)'; resultEl.textContent = 'URL required'; return; }
      resultEl.style.color = 'var(--text-muted)'; resultEl.textContent = 'Testing...';
      try {
        const r = await fetch('/api/evo/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, apiKey, instance })
        });
        const d = await r.json();
        if (d.connected) {
          resultEl.style.color = '#25d366';
          resultEl.textContent = '✓ Connected — +' + d.number + ' (' + d.name + ')';
        } else {
          resultEl.style.color = 'var(--red)';
          resultEl.textContent = '✗ ' + (d.error || 'Not connected');
        }
      } catch (err) {
        resultEl.style.color = 'var(--red)';
        resultEl.textContent = '✗ ' + err.message;
      }
    }

    async function handleInstanceSelect(selectEl, employeeName, existingId) {
      const value = selectEl.value;
      if (!value) return;

      if (value === '__create__') {
        const instanceName = 'wa-' + employeeName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        // Create in Evolution API
        await fetch('/api/evolution/create-instance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instance_name: instanceName }) });
        // Create mapping in DB
        await fetch('/api/employee-instances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_name: employeeName, instance_name: instanceName, status: 'pending' }) });
        loadSettings();
        return;
      }

      // Map to existing instance
      if (existingId) {
        await fetch('/api/employee-instances/' + existingId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instance_name: value }) });
      } else {
        await fetch('/api/employee-instances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_name: employeeName, instance_name: value, status: 'pending' }) });
      }
      loadSettings();
    }

    async function addEmployeeInstance() {
      const name = prompt('Employee name (must match CSV EmployeeName column):');
      if (!name) return;
      const instanceName = 'wa-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      await fetch('/api/employee-instances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_name: name, instance_name: instanceName, status: 'pending' }) });
      await fetch('/api/evolution/create-instance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instance_name: instanceName }) });
      loadSettings();
    }

    async function checkInstanceStatus(id, instanceName) {
      try {
        const r = await fetch('/api/evolution/instance/connectionState/' + instanceName);
        const d = await r.json();
        const state = d.instance?.state || 'unknown';
        await fetch('/api/employee-instances/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: state === 'open' ? 'connected' : state }) });
        if (state === 'open') {
          alert('Connected! WhatsApp is paired for ' + instanceName);
        } else {
          const qrRes = await fetch('/api/evolution/instance/connect/' + instanceName);
          const qrData = await qrRes.json();
          if (qrData.base64) {
            const w = window.open('', 'QR Code', 'width=400,height=450');
            w.document.write('<html><body style="background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0"><h3 style="color:#fff;font-family:sans-serif;margin-bottom:16px">Scan QR for ' + instanceName + '</h3><img src="' + qrData.base64 + '" style="width:300px;height:300px;border-radius:12px"/><p style="color:#888;font-family:sans-serif;margin-top:12px;font-size:13px">Open WhatsApp > Linked Devices > Link a Device</p></body></html>');
          } else {
            alert('Status: ' + state + '. Instance may need to be recreated.');
          }
        }
        loadSettings();
      } catch (err) { alert('Error checking status: ' + err.message); }
    }

    async function unlinkEmployee(id) {
      if (!confirm('Remove this employee-to-WhatsApp mapping?')) return;
      await fetch('/api/employee-instances/' + id, { method: 'DELETE' });
      loadSettings();
    }

    async function removeEmployeeInstance(id) {
      if (!confirm('Remove this employee instance mapping?')) return;
      await fetch('/api/employee-instances/' + id, { method: 'DELETE' });
      loadSettings();
    }

    // ─── Vendor Follow-ups ──────────────────
    let _vendorList = [];

    async function loadVendorFollowups() {
      const el = document.getElementById('vendor-content');
      if (!el) return;
      el.innerHTML = '<p style="color:var(--text-muted);padding:20px">Loading...</p>';
      try {
        // Load instances if not already loaded
        if (_evoInstances.length === 0) {
          try {
            const inst = await fetch('/api/evolution/instances').then(r => r.json());
            if (Array.isArray(inst)) _evoInstances = inst;
          } catch {}
        }
        _vendorList = await fetch(AUTOMATION_API + '/api/vendor-followups').then(r => r.json());
        _renderVendorPage(_vendorList);
      } catch(e) {
        el.innerHTML = '<p style="color:var(--red);padding:20px">Failed to load: ' + esc(String(e)) + '</p>';
      }
    }

    function _renderVendorPage(vendors) {
      const el = document.getElementById('vendor-content');
      const statusBadge = {
        draft:          '<span style="background:#f1f5f9;color:#64748b;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600">Draft</span>',
        awaiting_reply: '<span style="background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600">Awaiting Reply</span>',
        done:           '<span style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600">Done</span>',
        rescheduled:    '<span style="background:var(--accent-bg);color:var(--accent-hover);border:1px solid var(--accent-border);padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600">Rescheduled</span>'
      };
      const urgencyMap = { high: {dot:'🔴',label:'High',color:'#dc2626',bg:'#fef2f2',border:'#fecaca'},
                           medium:{dot:'🟡',label:'Medium',color:'#d97706',bg:'#fffbeb',border:'#fde68a'},
                           low:   {dot:'🟢',label:'Low',color:'#16a34a',bg:'#f0fdf4',border:'#bbf7d0'} };

      const listHtml = vendors.length === 0
        ? '<div style="text-align:center;padding:40px 20px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:8px">📋</div><div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">No follow-ups yet</div><div style="font-size:13px">Submit the form to add your first vendor follow-up.</div></div>'
        : vendors.map(function(v) {
            var urg = urgencyMap[v.urgency] || urgencyMap.medium;
            var badge = statusBadge[v.status] || statusBadge.draft;
            var fid = esc(v.id);
            return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:10px">'
              + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap">'
              + '<div style="flex:1;min-width:0">'
              + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
              + '<span style="font-size:14px;font-weight:700;color:var(--text)">' + esc(v.vendor_name) + '</span>'
              + '<span style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700;background:' + urg.bg + ';color:' + urg.color + ';border:1px solid ' + urg.border + '">' + urg.dot + ' ' + urg.label + '</span>'
              + badge
              + '</div>'
              + (v.email ? '<div style="font-size:12px;color:var(--text-muted)">📧 ' + esc(v.email) + '</div>' : '')
              + (v.phone ? '<div style="font-size:12px;color:var(--text-muted)">📱 ' + esc(v.phone) + '</div>' : '')
              + '<div style="font-size:12px;color:var(--text-dim);margin-top:4px">' + esc(v.reason || '') + '</div>'
              + (v.next_followup_date ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Next follow-up: ' + esc(v.next_followup_date) + '</div>' : '')
              + '</div>'
              + '<div style="display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0">'
              + (v.status !== 'done' ? '<button onclick="vendorUpdateStatus(\\'' + fid + '\\',\\'done\\')" style="padding:4px 10px;font-size:11px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:6px;cursor:pointer;font-weight:600">Mark Done</button>' : '')
              + '<button onclick="vendorUpdateStatus(\\'' + fid + '\\',\\'rescheduled\\')" style="padding:4px 10px;font-size:11px;background:var(--amber-bg);color:var(--amber);border:1px solid var(--amber-border);border-radius:6px;cursor:pointer">Reschedule</button>'
              + '<button onclick="vendorDelete(\\'' + fid + '\\')" style="padding:4px 10px;font-size:11px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;cursor:pointer">Delete</button>'
              + '</div></div></div>';
          }).join('');

      el.innerHTML = '<div style="display:grid;grid-template-columns:360px 1fr;gap:24px;align-items:flex-start">'

        // LEFT: Form
        + '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;position:sticky;top:24px">'
        + '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px">New Vendor Follow-up</div>'
        + '<div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">Fill details — message will be sent directly via Evolution GO WhatsApp.</div>'

        + '<div style="margin-bottom:14px">'
        + '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">WhatsApp Instance <span style="color:var(--red)">*</span></label>'
        + (function(){
            var opts = '<option value="">— select instance —</option>';
            for (var i = 0; i < _evoInstances.length; i++) {
              var inst = _evoInstances[i];
              opts += '<option value="' + esc(inst.name||inst) + '">' + esc(inst.name||inst) + (inst.connected ? ' ✓' : '') + '</option>';
            }
            return '<select id="vf-instance" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px;box-sizing:border-box">' + opts + '</select>';
          })()
        + '</div>'

        + '<div style="margin-bottom:14px">'
        + '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">Vendor Name <span style="color:var(--red)">*</span></label>'
        + '<input id="vf-name" type="text" placeholder="e.g. Raj Suppliers Pvt Ltd" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px;box-sizing:border-box">'
        + '</div>'

        + '<div style="margin-bottom:14px">'
        + '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">Phone Number <span style="color:var(--red)">*</span></label>'
        + '<input id="vf-phone" type="tel" placeholder="+91 9876543210" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px;box-sizing:border-box">'
        + '</div>'

        + '<div style="margin-bottom:14px">'
        + '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">Follow-up Reason <span style="color:var(--red)">*</span></label>'
        + '<textarea id="vf-reason" rows="3" placeholder="e.g. Pending bill for March order, quotation required" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px;box-sizing:border-box;resize:vertical" oninput="vfPreviewMessage()"></textarea>'
        + '</div>'

        + '<div style="margin-bottom:14px">'
        + '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">Urgency <span style="color:var(--red)">*</span></label>'
        + '<div style="display:flex;gap:8px">'
        + '<label style="flex:1;cursor:pointer"><input type="radio" name="vf-urgency" value="High" style="display:none" id="vf-urg-high"><div id="vf-urg-high-btn" onclick="vfSetUrgency(\\'High\\')" style="text-align:center;padding:8px 6px;border:2px solid #fecaca;border-radius:8px;background:#fef2f2;font-size:12px;font-weight:700;color:#dc2626;cursor:pointer">🔴 High</div></label>'
        + '<label style="flex:1;cursor:pointer"><input type="radio" name="vf-urgency" value="Medium" checked style="display:none" id="vf-urg-medium"><div id="vf-urg-medium-btn" onclick="vfSetUrgency(\\'Medium\\')" style="text-align:center;padding:8px 6px;border:2px solid var(--amber-border);border-radius:8px;background:var(--amber-bg);font-size:12px;font-weight:700;color:var(--amber);cursor:pointer;box-shadow:0 0 0 2px var(--amber)">🟡 Medium</div></label>'
        + '<label style="flex:1;cursor:pointer"><input type="radio" name="vf-urgency" value="Low" style="display:none" id="vf-urg-low"><div id="vf-urg-low-btn" onclick="vfSetUrgency(\\'Low\\')" style="text-align:center;padding:8px 6px;border:2px solid #bbf7d0;border-radius:8px;background:#f0fdf4;font-size:12px;font-weight:700;color:#16a34a;cursor:pointer">🟢 Low</div></label>'
        + '</div>'
        + '</div>'

        + '<div style="margin-bottom:14px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">'
        + '<label style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.04em">WhatsApp Message</label>'
        + '<button onclick="vfPreviewMessage()" style="font-size:11px;padding:2px 8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--text-secondary)">↺ Refresh</button>'
        + '</div>'
        + '<textarea id="vf-wa-preview" rows="5" placeholder="Message will appear here..." style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box;resize:vertical;font-family:monospace"></textarea>'
        + '</div>'

        + '<div id="vf-submit-status" style="font-size:12px;margin-bottom:10px;min-height:18px"></div>'
        + '<button id="vf-submit-btn" onclick="vendorSubmitDirect()" style="width:100%;padding:10px;background:#16a34a;color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:14px;font-weight:700">📱 Send via WhatsApp</button>'
        + '<div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px">Sends directly via Evolution GO — no N8N required</div>'
        + '</div>'

        // RIGHT: List
        + '<div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
        + '<div style="font-size:15px;font-weight:700;color:var(--text)">Follow-up History</div>'
        + '<div style="display:flex;gap:8px">'
        + '<span style="font-size:12px;padding:3px 10px;background:var(--amber-bg);color:var(--amber);border-radius:10px;font-weight:600">' + vendors.filter(function(v){return v.status==='awaiting_reply';}).length + ' Pending</span>'
        + '<span style="font-size:12px;padding:3px 10px;background:#f0fdf4;color:#16a34a;border-radius:10px;font-weight:600">' + vendors.filter(function(v){return v.status==='done';}).length + ' Done</span>'
        + '</div></div>'
        + listHtml
        + '</div>'
        + '</div>';

      // Set default urgency selection visually + populate message preview
      vfSetUrgency('Medium');
      setTimeout(vfPreviewMessage, 50);
    }

    var _vfCurrentUrgency = 'Medium';
    function vfSetUrgency(val) {
      _vfCurrentUrgency = val;
      var btns = { High:'vf-urg-high-btn', Medium:'vf-urg-medium-btn', Low:'vf-urg-low-btn' };
      var styles = {
        High:   {border:'#fecaca',bg:'#fef2f2',color:'#dc2626',shadow:'#dc2626'},
        Medium: {border:'var(--amber-border)',bg:'var(--amber-bg)',color:'var(--amber)',shadow:'var(--amber)'},
        Low:    {border:'#bbf7d0',bg:'#f0fdf4',color:'#16a34a',shadow:'#16a34a'}
      };
      Object.keys(btns).forEach(function(k) {
        var el = document.getElementById(btns[k]);
        if (!el) return;
        var s = styles[k];
        if (k === val) {
          el.style.border = '2px solid ' + s.color;
          el.style.background = s.bg;
          el.style.color = s.color;
          el.style.boxShadow = '0 0 0 2px ' + s.shadow;
        } else {
          el.style.border = '2px solid ' + s.border;
          el.style.background = s.bg;
          el.style.color = s.color;
          el.style.boxShadow = 'none';
        }
      });
      vfPreviewMessage();
    }

    async function vendorSubmit() {
      var name   = (document.getElementById('vf-name').value || '').trim();
      var email  = (document.getElementById('vf-email').value || '').trim();
      var phone  = (document.getElementById('vf-phone').value || '').trim();
      var reason = (document.getElementById('vf-reason').value || '').trim();
      if (!name || !email || !phone || !reason) {
        var st = document.getElementById('vf-submit-status');
        st.textContent = 'Please fill all required fields.';
        st.style.color = 'var(--red)';
        return;
      }
      var btn = document.getElementById('vf-submit-btn');
      var st  = document.getElementById('vf-submit-status');
      btn.disabled = true;
      btn.textContent = 'Sending...';
      st.textContent = '';
      try {
        var res = await fetch(AUTOMATION_API + '/api/vendor-followups/submit-n8n', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ vendor_name:name, email:email, phone:phone, reason:reason, urgency:_vfCurrentUrgency, notes:'' })
        });
        var data = await res.json();
        if (data.n8n_triggered) {
          st.textContent = 'Sent! N8N is generating AI email + WhatsApp message.';
          st.style.color = 'var(--green)';
          // Clear form
          ['vf-name','vf-email','vf-phone','vf-reason'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
          vfSetUrgency('Medium');
        } else {
          st.textContent = 'Saved locally. Set N8N Webhook URL in Automation > Settings to enable auto-sending.';
          st.style.color = 'var(--amber)';
        }
        // Reload list
        _vendorList = await fetch(AUTOMATION_API + '/api/vendor-followups').then(function(r){return r.json();});
        document.getElementById('vf-list') && (_renderVendorPage(_vendorList));
        loadVendorFollowups();
      } catch(e) {
        st.textContent = 'Error: ' + e.message;
        st.style.color = 'var(--red)';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send Follow-up via N8N';
      }
    }

    function vfPreviewMessage() {
      var name   = (document.getElementById('vf-name') && document.getElementById('vf-name').value.trim()) || 'Vendor';
      var reason = (document.getElementById('vf-reason') && document.getElementById('vf-reason').value.trim()) || '';
      var urgencyEmoji = { High:'🔴', Medium:'🟡', Low:'🟢' }[_vfCurrentUrgency] || '🟡';
      var msg = 'Hello ' + name + ',\\n\\n' + (reason || 'We need to follow up with you.') + '\\n\\nUrgency: ' + urgencyEmoji + ' ' + _vfCurrentUrgency + '\\n\\nPlease respond at your earliest convenience.\\n\\nRegards';
      var el = document.getElementById('vf-wa-preview');
      if (el && !el._userEdited) el.value = msg;
    }

    async function vendorSubmitDirect() {
      var instance = (document.getElementById('vf-instance') && document.getElementById('vf-instance').value) || '';
      var name     = (document.getElementById('vf-name').value || '').trim();
      var phone    = (document.getElementById('vf-phone').value || '').trim();
      var reason   = (document.getElementById('vf-reason').value || '').trim();
      var message  = (document.getElementById('vf-wa-preview') && document.getElementById('vf-wa-preview').value.trim()) || '';
      if (!instance) { var s=document.getElementById('vf-submit-status'); s.textContent='Please select a WhatsApp instance.'; s.style.color='var(--red)'; return; }
      if (!name || !phone || !reason) { var s=document.getElementById('vf-submit-status'); s.textContent='Please fill Vendor Name, Phone and Reason.'; s.style.color='var(--red)'; return; }
      var btn = document.getElementById('vf-submit-btn');
      var st  = document.getElementById('vf-submit-status');
      btn.disabled = true; btn.textContent = 'Sending...'; st.textContent = '';
      try {
        var res = await fetch(AUTOMATION_API + '/api/vendor-followups/send-direct', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ vendor_name:name, phone:phone, reason:reason, urgency:_vfCurrentUrgency, whatsapp_instance:instance, message:message })
        });
        var data = await res.json();
        if (data.ok) {
          st.textContent = '✅ Message sent successfully!';
          st.style.color = 'var(--green)';
          ['vf-name','vf-phone','vf-reason'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
          var prev = document.getElementById('vf-wa-preview'); if(prev) { prev.value=''; prev._userEdited=false; }
          vfSetUrgency('Medium');
          loadVendorFollowups();
        } else {
          st.textContent = '❌ Failed: ' + (data.error || 'Check Evolution GO instance & connection.');
          st.style.color = 'var(--red)';
        }
      } catch(e) {
        st.textContent = '❌ Error: ' + e.message;
        st.style.color = 'var(--red)';
      } finally {
        btn.disabled = false; btn.textContent = '📱 Send via WhatsApp';
      }
    }

    // Keep old function stubs so existing buttons don't break
    function vendorModalClose() {}
    function vendorNewOpen(fid) { loadVendorFollowups(); }
    async function vendorGenerate() {
      const name = document.getElementById('vf-name') && document.getElementById('vf-name').value.trim();
      if (!name) { alert('Please enter a vendor name first.'); return; }
      const btn = document.getElementById('vf-gen-btn');
      const status = document.getElementById('vf-gen-status');
      if(btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
      if(status) status.textContent = '';
      try {
        const res = await fetch(AUTOMATION_API + '/api/vendor-followups/generate-messages', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            vendor_name: name,
            company: document.getElementById('vf-company') ? document.getElementById('vf-company').value.trim() : '',
            reason: document.getElementById('vf-reason').value,
            urgency: document.getElementById('vf-urgency').value,
            notes: document.getElementById('vf-notes').value.trim()
          })
        });
        const data = await res.json();
        if (data.whatsapp) document.getElementById('vf-wa-msg').value = data.whatsapp;
        if (data.email_body) document.getElementById('vf-email-msg').value = (data.email_subject ? 'Subject: ' + data.email_subject + '\\n\\n' : '') + data.email_body;
        status.textContent = 'Messages generated!';
        status.style.color = 'var(--green)';
      } catch(e) {
        status.textContent = 'Generation failed: ' + String(e);
        status.style.color = 'var(--red)';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Generate with AI';
      }
    }

    async function vendorSave(fid) {
      const name = document.getElementById('vf-name').value.trim();
      if (!name) { alert('Vendor name is required.'); return; }
      const payload = {
        vendor_name: name,
        company: document.getElementById('vf-company').value.trim(),
        phone: document.getElementById('vf-phone').value.trim(),
        email: document.getElementById('vf-email').value.trim(),
        reason: document.getElementById('vf-reason').value,
        urgency: document.getElementById('vf-urgency').value,
        notes: document.getElementById('vf-notes').value.trim(),
        whatsapp_instance: document.getElementById('vf-instance') ? document.getElementById('vf-instance').value : '',
        whatsapp_message: document.getElementById('vf-wa-msg') ? document.getElementById('vf-wa-msg').value.trim() : '',
        email_message: document.getElementById('vf-email-msg') ? document.getElementById('vf-email-msg').value.trim() : '',
        status: 'draft',
        next_followup_date: ''
      };
      try {
        // If new follow-up (not editing), submit to n8n workflow which handles AI + email + WhatsApp
        if (!fid) {
          const n8nPayload = {
            vendor_name: payload.vendor_name,
            email: payload.email,
            phone: payload.phone,
            reason: payload.reason,
            urgency: payload.urgency.charAt(0).toUpperCase() + payload.urgency.slice(1),
            notes: payload.notes
          };
          const n8nRes = await fetch(AUTOMATION_API + '/api/vendor-followups/submit-n8n', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(n8nPayload)
          });
          const n8nData = await n8nRes.json();
          vendorModalClose();
          loadVendorFollowups();
          if (n8nData.n8n_triggered) {
            setTimeout(function() { alert('Follow-up submitted! N8N is processing: AI email + WhatsApp message will be sent automatically.'); }, 300);
          } else {
            setTimeout(function() { alert('Saved locally. N8N not triggered — check n8n Webhook URL in Platform Settings > N8N Integration.'); }, 300);
          }
          return;
        }
        // Editing existing
        const url = AUTOMATION_API + '/api/vendor-followups/' + fid;
        const res = await fetch(url, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('Save failed: ' + res.status);
        vendorModalClose();
        loadVendorFollowups();
      } catch(e) {
        alert('Error saving: ' + e.message);
      }
    }

    function vendorSendConfirm(fid, instance, phone, message) {
      if (!instance || !phone) { alert('Instance and phone number are required to send.'); return; }
      if (!confirm('Send WhatsApp message to ' + phone + '?')) return;
      vendorSend(fid, instance, phone, message);
    }

    async function vendorSend(fid, instance, phone, message) {
      try {
        const res = await fetch('/api/vendor-followups/' + fid + '/send', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ instance, phone, message })
        });
        const data = await res.json();
        if (data.ok || data.key) {
          alert('Message sent successfully!');
        } else {
          alert('Send result: ' + JSON.stringify(data));
        }
        loadVendorFollowups();
      } catch(e) {
        alert('Send error: ' + e.message);
      }
    }

    async function vendorUpdateStatus(fid, status) {
      const labels = { done: 'Mark as Done', rescheduled: 'Reschedule' };
      if (!confirm(labels[status] + '?')) return;
      try {
        await fetch(AUTOMATION_API + '/api/vendor-followups/' + fid + '/status', {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ status: status })
        });
        loadVendorFollowups();
      } catch(e) {
        alert('Error updating status: ' + e.message);
      }
    }

    async function vendorDelete(fid) {
      if (!confirm('Delete this vendor follow-up?')) return;
      try {
        await fetch(AUTOMATION_API + '/api/vendor-followups/' + fid, { method: 'DELETE' });
        loadVendorFollowups();
      } catch(e) {
        alert('Error deleting: ' + e.message);
      }
    }

    // ─── Utils ──────────────────────────────
    function esc(s) { if(!s)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function rupee(v) { if(v==null||v===undefined)return'₹0'; return '₹' + Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }

    // ─── Init ───────────────────────────────
    loadCampaigns();
    checkHealth();
    loadModel();
    // Auto-refresh removed — was causing disruptive page reloads every 10s
    setInterval(checkHealth, 15000);
  <\/script>
</body>
</html>`;
}

module.exports = { getDashboardHtml };
