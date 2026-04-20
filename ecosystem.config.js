module.exports = {
  apps: [{
    name: 'gemini-classifier',
    script: 'server.js',
    watch: true,
    ignore_watch: ['data', 'node_modules', '*.log', 'logs', '*.backup.*'],
    env: { NODE_ENV: 'production' }
  }]
};
