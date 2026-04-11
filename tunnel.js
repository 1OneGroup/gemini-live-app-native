const { spawn } = require('child_process');
const http = require('http');

let currentUrl = null;
let retryCount = 0;

function startTunnel() {
  console.log(`[Tunnel] Starting serveo... (attempt ${++retryCount})`);

  const proc = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-R', '80:localhost:8100',
    'serveo.net'
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9\-]+\.serveousercontent\.com/);
    if (match) {
      currentUrl = match[0];
      console.log(`[Tunnel] URL: ${currentUrl}`);
      retryCount = 0;
      // Update tunnel URL in dashboard server
      updateServerTunnelUrl(currentUrl);
    }
  });

  proc.stderr.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9\-]+\.serveousercontent\.com/);
    if (match) {
      currentUrl = match[0];
      console.log(`[Tunnel] URL: ${currentUrl}`);
      retryCount = 0;
      updateServerTunnelUrl(currentUrl);
    }
  });

  proc.on('close', (code) => {
    console.log(`[Tunnel] Disconnected (code ${code}). Reconnecting in 5s...`);
    setTimeout(startTunnel, 5000);
  });
}

function updateServerTunnelUrl(url) {
  const body = JSON.stringify({ tunnelUrl: url });
  const req = http.request({
    hostname: 'localhost',
    port: 8100,
    path: '/api/website-settings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, (res) => {
    console.log(`[Tunnel] Updated dashboard tunnel URL: ${url}/api/website-leads`);
  });
  req.on('error', () => {});
  req.write(body);
  req.end();
}

startTunnel();
