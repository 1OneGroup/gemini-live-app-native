@echo off
cd /d "%~dp0"
set GEMINI_API_KEY=AIzaSyBfDeIdjdGvbsQoUUdYrqAHUBNXuRpo_MI
set PLIVO_AUTH_ID=dummy_plivo_id
set PLIVO_AUTH_TOKEN=dummy_plivo_token
set PLIVO_FROM_NUMBER=+1234567890
set PUBLIC_URL=http://localhost:8100
set PORT=8100
set DATA_DIR=./data
set EVOLUTION_API_URL=http://localhost:5000
set EVOLUTION_API_KEY=sua-chave-api-segura-aqui
set EVOLUTION_INSTANCE=enjoy
echo Starting Python automation engine on port 5001...
start "Automation Engine" cmd /k "cd /d "%~dp0automation-engine" && python -m uvicorn main:app --host 0.0.0.0 --port 5001"
timeout /t 3 /nobreak > nul
echo Starting Node dashboard on port 8100...
node server.js
