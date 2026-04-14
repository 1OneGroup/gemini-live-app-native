-- Run this SQL in Supabase SQL Editor: https://supabase.com → Project → SQL Editor

-- automations: each row is one configurable automation
create table automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  enabled boolean default false,
  data_source jsonb not null default '{}'::jsonb,
  match_rule jsonb not null default '{}'::jsonb,
  use_image boolean default false,
  image_template_url text default '',
  image_prompt text default '',
  message_template text not null default '',
  whatsapp_instance text default '',
  schedule jsonb not null default '{"type":"daily","time":"09:00"}'::jsonb,
  created_at timestamp with time zone default now()
);

-- automation_data: rows of data for each automation (flexible JSONB)
create table automation_data (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  last_processed text default '',
  created_at timestamp with time zone default now()
);
create index automation_data_automation_id_idx on automation_data(automation_id);

-- activity_log: every send attempt
create table activity_log (
  id bigserial primary key,
  automation_id uuid references automations(id) on delete set null,
  automation_name text,
  recipient_name text,
  recipient_phone text,
  message_sent text,
  image_sent boolean default false,
  status text,
  error text default '',
  sent_at timestamp with time zone default now()
);
create index activity_log_sent_at_idx on activity_log(sent_at desc);

-- settings: global API keys and config
create table settings (
  key text primary key,
  value text not null default ''
);

insert into settings (key, value) values
  ('evolution_api_url', 'http://localhost:4000'),
  ('evolution_api_key', ''),
  ('gemini_api_key', '')
on conflict (key) do nothing;
