module.exports = {
  apps: [{
    name: 'gemini-live',
    script: 'server.js',
    env: {
      GEMINI_API_KEY: 'dummy_key_for_local_test',
      PLIVO_AUTH_ID: 'dummy_plivo_id',
      PLIVO_AUTH_TOKEN: 'dummy_plivo_token',
      PLIVO_FROM_NUMBER: '+1234567890',
      PUBLIC_URL: 'http://localhost:8100',
      PORT: '8100',
      DATA_DIR: './data',
      EVOLUTION_API_URL: 'http://localhost:4000',
      EVOLUTION_API_KEY: 'sua-chave-api-segura-aqui',
      EVOLUTION_INSTANCE: 'test-instance',
    },
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 2000,
  }]
};
