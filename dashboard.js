function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Gemini Live — Telecalling Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
  <link rel="stylesheet" href="https://cdn.datatables.net/2.0.8/css/dataTables.dataTables.min.css">
  <link rel="stylesheet" href="https://cdn.datatables.net/responsive/3.0.2/css/responsive.dataTables.min.css">
  <script src="https://cdn.datatables.net/2.0.8/js/dataTables.min.js"><\/script>
  <script src="https://cdn.datatables.net/responsive/3.0.2/js/dataTables.responsive.min.js"><\/script>
  <style>
    :root {
      --bg: #09090b; --bg-secondary: #0c0c0f;
      --surface: #18181b; --surface-hover: #1f1f23; --surface-raised: #27272a;
      --border: #27272a; --border-subtle: #1f1f23;
      --text: #fafafa; --text-secondary: #a1a1aa; --text-muted: #71717a; --text-dim: #52525b;
      --accent: #6366f1; --accent-hover: #818cf8; --accent-bg: rgba(99,102,241,0.12); --accent-border: rgba(99,102,241,0.25);
      --green: #22c55e; --green-bg: rgba(34,197,94,0.12); --green-border: rgba(34,197,94,0.25);
      --amber: #f59e0b; --amber-bg: rgba(245,158,11,0.12); --amber-border: rgba(245,158,11,0.25);
      --red: #ef4444; --red-bg: rgba(239,68,68,0.12); --red-border: rgba(239,68,68,0.25);
      --blue: #3b82f6; --blue-bg: rgba(59,130,246,0.12); --blue-border: rgba(59,130,246,0.25);
      --radius: 12px; --radius-sm: 8px; --radius-xs: 6px;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.3); --shadow-md: 0 4px 12px rgba(0,0,0,0.4); --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
      --sidebar-width: 240px;
      --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; }

    /* === LAYOUT === */
    .app { display: flex; min-height: 100vh; }

    /* Sidebar */
    .sidebar { width: var(--sidebar-width); background: var(--bg-secondary); border-right: 1px solid var(--border-subtle); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; height: 100vh; z-index: 40; transition: transform var(--transition); }
    .sidebar-header { padding: 20px 16px 16px; border-bottom: 1px solid var(--border-subtle); }
    .sidebar-logo { display: flex; align-items: center; gap: 10px; }
    .sidebar-logo .icon { width: 32px; height: 32px; background: var(--accent); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; font-size: 14px; }
    .sidebar-logo .title { font-size: 15px; font-weight: 600; color: var(--text); }
    .sidebar-status { margin-top: 12px; display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .status-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); }
    .status-dot.offline { background: var(--red); }
    .status-text { font-size: 12px; color: var(--text-muted); }

    .sidebar-nav { flex: 1; padding: 12px 8px; overflow-y: auto; }
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
    .main { flex: 1; margin-left: var(--sidebar-width); min-height: 100vh; }

    /* Top bar */
    .topbar { padding: 16px 28px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 30; background: rgba(9,9,11,0.8); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .topbar-title { font-size: 18px; font-weight: 600; }
    .topbar-actions { display: flex; gap: 8px; align-items: center; }
    .mobile-menu-btn { display: none; background: none; border: none; color: var(--text); cursor: pointer; padding: 8px; border-radius: var(--radius-xs); }
    .mobile-menu-btn:hover { background: var(--surface); }
    .mobile-menu-btn svg { width: 22px; height: 22px; }

    /* Content area */
    .content { padding: 24px 28px; max-width: 1200px; }

    /* === COMPONENTS === */

    /* Buttons */
    .btn { border: none; padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; cursor: pointer; min-height: 36px; display: inline-flex; align-items: center; gap: 6px; transition: all var(--transition); font-family: inherit; }
    .btn svg { width: 16px; height: 16px; }
    .btn-primary { background: var(--accent); color: #fff; }
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
    .slide-over { position: fixed; top: 0; right: 0; width: 520px; max-width: 100vw; height: 100vh; background: var(--bg); border-left: 1px solid var(--border); overflow-y: auto; z-index: 101; transform: translateX(100%); transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); box-shadow: var(--shadow-lg); }
    .slide-over.open { transform: translateX(0); }
    .slide-over-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: var(--bg); z-index: 1; }
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
    .modal { background: var(--bg); border: 1px solid var(--border); border-radius: 16px; padding: 0; width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
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
    .campaign-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }

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
    .analysis-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: visible; margin: 16px 0; }
    .analysis-header { padding: 14px 18px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; }
    .analysis-header h4 { font-size: 14px; font-weight: 600; }
    .analysis-body { padding: 18px; }
    .analysis-section { margin-bottom: 14px; }
    .analysis-section:last-child { margin-bottom: 0; }
    .analysis-section-title { font-size: 11px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .analysis-text { font-size: 14px; line-height: 1.6; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word; }

    /* Charts */
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
    .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; }
    .chart-card h4 { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 14px; }

    /* Table */
    .table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .table-header { padding: 12px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .table-header h3 { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
    table.data-table { width: 100%; border-collapse: collapse; }
    .data-table th { text-align: left; padding: 10px 18px; font-size: 11px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); background: var(--bg-secondary); }
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
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--text-dim); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

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
    .fab { display: none; position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; background: var(--accent); color: #fff; border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(99,102,241,0.4); z-index: 35; align-items: center; justify-content: center; transition: all var(--transition); }
    .fab:hover { background: var(--accent-hover); transform: scale(1.05); }
    .fab:active { transform: scale(0.95); }
    @media (max-width: 768px) {
      .fab { display: flex; }
    }

    /* Mobile sidebar overlay */
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 39; }
    .sidebar-overlay.open { display: block; }

    /* === DATATABLES RESPONSIVE DARK THEME === */
    div.dt-container { font-family: inherit !important; }
    table.dataTable.dtr-inline.collapsed > tbody > tr > td:first-child,
    table.dataTable.dtr-inline.collapsed > tbody > tr > th:first-child { cursor: pointer; }
    table.dataTable.dtr-inline.collapsed > tbody > tr > td:first-child::before,
    table.dataTable.dtr-inline.collapsed > tbody > tr > th:first-child::before {
      background-color: var(--accent) !important; border: none !important;
      box-shadow: none !important; color: #fff !important; line-height: 16px !important;
    }
    table.dataTable.dtr-inline.collapsed > tbody > tr.parent > td:first-child::before,
    table.dataTable.dtr-inline.collapsed > tbody > tr.parent > th:first-child::before {
      background-color: var(--red) !important;
    }
    tr.child { background: var(--bg-secondary) !important; }
    tr.child td.child { background: var(--bg-secondary) !important; padding: 8px 12px 8px 32px !important; border-bottom: 1px solid var(--border) !important; }
    tr.child ul.dtr-details { margin: 0 !important; }
    tr.child ul.dtr-details li { border-bottom: 1px solid var(--border-subtle) !important; padding: 5px 0 !important; }
    tr.child ul.dtr-details li:last-child { border-bottom: none !important; }
    tr.child ul.dtr-details span.dtr-title { color: var(--text-dim) !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: 0.04em !important; min-width: 90px !important; display: inline-block !important; }
    tr.child ul.dtr-details span.dtr-data { color: var(--text-secondary) !important; font-size: 13px !important; }
  </style>
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
          <div class="nav-item" onclick="navigate('brochures', this)" id="nav-brochures">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            WhatsApp
          </div>
          <div class="nav-item" onclick="navigate('settings', this)" id="nav-settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            Settings
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

        <!-- Brochures Page -->
        <div id="page-brochures" class="hidden">
          <div id="brochures-content"></div>
        </div>

        <!-- Settings Page -->
        <div id="page-settings" class="hidden">
          <div id="settings-content"></div>
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
    let dtContacts = null;
    let dtCallbacks = null;
    let currentPage = 'campaigns';

    // ─── Navigation ─────────────────────────
    function navigate(page, el) {
      currentPage = page;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      if (el) el.classList.add('active');
      const pages = ['campaigns','calls','analytics','prompts','brochures','settings'];
      pages.forEach(p => document.getElementById('page-' + p)?.classList.toggle('hidden', p !== page));
      const titles = { campaigns: 'Campaigns', calls: 'Call History', analytics: 'Analytics', prompts: 'Prompt Library', brochures: 'WhatsApp Messages', settings: 'Settings' };
      document.getElementById('page-title').textContent = titles[page] || page;
      if (page === 'campaigns') loadCampaigns();
      if (page === 'calls') loadCalls();
      if (page === 'analytics') loadAnalytics();
      if (page === 'prompts') loadPromptLibrary();
      if (page === 'brochures') loadBrochures();
      if (page === 'settings') loadSettings();
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
        actions = '<span class="badge-status badge-awaiting_approval"><span class="badge-dot"></span>Review batch analysis below</span>';
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

      if (batches.length > 0) {
        const lastWithAnalysis = [...batches].reverse().find(b => b.analysis);
        if (lastWithAnalysis) renderBatchAnalysis(c.id, lastWithAnalysis);
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

      const promptTag = a.prompt_name ? '<span style="margin-left:12px;font-size:12px;color:var(--text-muted);font-weight:400">Prompt: <span style="color:var(--accent-hover)">' + esc(a.prompt_name) + '</span></span>' : '';
      el.innerHTML = \`
        <div class="analysis-card">
          <div class="analysis-header">
            <h4>Batch \${batch.batchNumber} — AI Analysis\${promptTag}</h4>
            <div style="display:flex;align-items:center;gap:8px">
              \${statusHtml}
              <button class="btn" style="font-size:12px;padding:4px 10px" onclick="rerunAnalysis('\${campaignId}', \${batch.batchNumber})" title="Regenerate analysis">Re-run</button>
            </div>
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

    async function rerunAnalysis(campaignId, batchNumber) {
      if (!confirm('Re-run AI analysis for batch ' + batchNumber + '? This will replace the current analysis.')) return;
      const el = document.getElementById('batch-analysis-section');
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">Re-running AI analysis...</div>';
      const res = await fetch(`/api/campaigns/${campaignId}/batches/${batchNumber}/rerun-analysis`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) renderBatchAnalysis(campaignId, { batchNumber, analysis: data.analysis });
        else el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">Analysis regenerated. Refresh to see results.</div>';
      } else {
        el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--error)">Failed to re-run analysis. Please try again.</div>';
      }
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
      wrap.innerHTML = \`<table class="data-table" id="contacts-dt">
        <thead><tr><th>Name</th><th>Phone</th><th>Batch</th><th>Status</th><th>Outcome</th></tr></thead>
        <tbody>\${contacts.map(c => \`<tr class="\${c.call_uuid ? 'clickable' : ''}" \${c.call_uuid ? 'onclick="openDetail(\\'' + c.call_uuid + '\\')"' : ''}>
          <td>\${esc(c.name||'—')}</td><td style="font-family:monospace">\${esc(c.phone)}</td><td>\${c.batch_number}</td>
          <td><span class="badge-status badge-\${c.status==='completed'?'completed':c.status==='failed'?'cancelled':c.status==='calling'?'running':'draft'}"><span class="badge-dot"></span>\${c.status}</span></td>
          <td>\${c.outcome ? esc(c.outcome.replace(/_/g,' ')) : '—'}</td>
        </tr>\`).join('')}</tbody></table>\`;
      try { if (dtContacts) { dtContacts.destroy(); dtContacts = null; } } catch(e) { dtContacts = null; }
      dtContacts = new DataTable('#contacts-dt', { responsive: true, paging: false, searching: false, info: false, ordering: false });
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
      wrap.innerHTML = \`<table class="data-table" id="callbacks-dt">
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
      try { if (dtCallbacks) { dtCallbacks.destroy(); dtCallbacks = null; } } catch(e) { dtCallbacks = null; }
      dtCallbacks = new DataTable('#callbacks-dt', { responsive: true, paging: false, searching: false, info: false, ordering: false });
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
            <span class="card-meta">\${new Date(c.startedAt).toLocaleString()}\${c.outcome ? ' &middot; <span class="badge-status badge-'+(c.outcome==='interested'?'completed':c.outcome==='not_interested'?'cancelled':'draft')+'\" style="font-size:10px;padding:1px 6px"><span class="badge-dot"></span>'+c.outcome.replace(/_/g,' ')+'</span>' : ''}</span>
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
            <div class="detail-item"><div class="detail-label">Outcome</div><div class="detail-value">\${call.outcome ? '<span class="badge-status badge-' + (call.outcome==='interested'?'completed':call.outcome==='not_interested'?'cancelled':'draft') + '"><span class="badge-dot"></span>' + call.outcome.replace(/_/g,' ') + '</span>' : '—'}</div></div>
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
