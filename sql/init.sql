create table if not exists clients (
  id text primary key,
  business_name text not null,
  owner text not null default '',
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  site_platform text not null default 'custom',
  category text not null default 'General Business',
  goal text not null default '',
  notes text not null default '',
  plan text not null default 'Starter',
  business_size text not null default 'small-team',
  lead_volume text not null default 'steady',
  sales_motion text not null default 'mixed',
  preferred_channel text not null default 'email',
  social_stack text not null default '',
  instagram text not null default '',
  facebook text not null default '',
  main_services text not null default '',
  booking_system text not null default '',
  call_logs jsonb not null default '[]'::jsonb,
  scan_consent boolean not null default false,
  publish_consent boolean not null default false,
  legal_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists audit_jobs (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  status text not null,
  progress_label text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text not null default '',
  source text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists audit_pages (
  id text primary key,
  audit_job_id text not null references audit_jobs(id) on delete cascade,
  url text not null,
  page_type text not null default 'general',
  title text not null default '',
  meta_description text not null default '',
  h1 text not null default '',
  text_excerpt text not null default '',
  cta_text text not null default '',
  raw_html_excerpt text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists audit_results (
  id text primary key,
  audit_job_id text not null unique references audit_jobs(id) on delete cascade,
  overall_score integer,
  summary text not null default '',
  trust_score integer,
  clarity_score integer,
  cta_score integer,
  booking_score integer,
  seo_score integer,
  mobile_score integer,
  quick_wins_json jsonb not null default '[]'::jsonb,
  issues_json jsonb not null default '[]'::jsonb,
  rewritten_hero_json jsonb not null default '{}'::jsonb,
  structured_output_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audit_jobs_client_id_idx on audit_jobs (client_id);
create index if not exists audit_pages_audit_job_id_idx on audit_pages (audit_job_id);
