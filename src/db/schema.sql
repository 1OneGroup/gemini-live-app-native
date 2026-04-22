-- Bootstrap DDL for gemini_live schema
-- Extracted verbatim from ensureSchema() in db.js
-- This file is run once on startup via src/db/schema.js

CREATE SCHEMA IF NOT EXISTS gemini_live;

CREATE TABLE IF NOT EXISTS gemini_live.campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  prompt_override TEXT,
  batch_size INTEGER DEFAULT 100,
  max_concurrent INTEGER DEFAULT 1,
  total_contacts INTEGER DEFAULT 0,
  completed_contacts INTEGER DEFAULT 0,
  current_batch INTEGER DEFAULT 0,
  whatsapp_message_key TEXT,
  auto_callback INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gemini_live.contacts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES gemini_live.campaigns(id),
  phone TEXT NOT NULL,
  name TEXT,
  metadata TEXT,
  batch_number INTEGER,
  status TEXT DEFAULT 'pending',
  call_uuid TEXT,
  outcome TEXT,
  employee_name TEXT,
  callback_date TEXT,
  callback_note TEXT,
  intent TEXT,
  interest_score INTEGER,
  objections TEXT,
  one_line_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS intent TEXT;
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS interest_score INTEGER;
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS objections TEXT;
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS one_line_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_gl_contacts_campaign ON gemini_live.contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_gl_contacts_batch ON gemini_live.contacts(campaign_id, batch_number);
CREATE INDEX IF NOT EXISTS idx_gl_contacts_status ON gemini_live.contacts(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_gl_contacts_call_uuid ON gemini_live.contacts(call_uuid);

CREATE TABLE IF NOT EXISTS gemini_live.batch_analyses (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES gemini_live.campaigns(id),
  batch_number INTEGER NOT NULL,
  summary TEXT,
  recommendations TEXT,
  prompt_adjustments TEXT,
  stats TEXT,
  prompt_id TEXT,
  approved INTEGER DEFAULT 0,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gl_batch_campaign ON gemini_live.batch_analyses(campaign_id, batch_number);

CREATE TABLE IF NOT EXISTS gemini_live.employee_instances (
  id TEXT PRIMARY KEY,
  employee_name TEXT NOT NULL UNIQUE,
  instance_name TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gemini_live.prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gemini_live.whatsapp_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_url TEXT,
  is_active INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
