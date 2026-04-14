#!/bin/sh
set -e

echo "[Docker] Starting automation-engine (Python/FastAPI) on port 5001..."
cd /app/automation-engine
python3 -m uvicorn main:app --host 0.0.0.0 --port 5001 &
PYTHON_PID=$!

echo "[Docker] Starting gemini-live bridge (Node.js) on port 8100..."
cd /app
node server.js &
NODE_PID=$!

# Wait for either process to exit
wait -n 2>/dev/null || wait

echo "[Docker] A process exited. Shutting down..."
kill $PYTHON_PID $NODE_PID 2>/dev/null
