#!/bin/bash
cd "$(dirname "$0")"
uvicorn main:app --host 0.0.0.0 --port 5001 --reload
