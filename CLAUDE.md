# Project: Gemini Lead Classifier

## Deployment
- This app runs via pm2, NOT Docker.
- pm2 auto-restarts on any file save (watch mode).
- Do NOT suggest docker compose commands. Docker is not used here.
- To restart manually: pm2 restart gemini-classifier
- To check status: pm2 status
- To view logs: pm2 logs gemini-classifier

## Public URL
https://classifier.dev.onegroup.co.in/

## Port
App runs on PORT=3000 (set in .env)

## Data
Lead data is stored in /root/gemini-classifier/data/leads.json
