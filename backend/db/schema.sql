-- Project Management Suite - Postgres Schema
-- Run: psql -d pm_suite -f db/schema.sql

CREATE TABLE IF NOT EXISTS aws_accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  account_label VARCHAR(50) NOT NULL,
  region VARCHAR(30) NOT NULL,
  environment VARCHAR(30) DEFAULT 'Production',
  monthly_budget NUMERIC(10, 2) DEFAULT 0,
  -- Each account has its own IAM credentials. access_key_id is stored in the
  -- clear (it's not secret on its own), secret_access_key_encrypted is
  -- AES-256-GCM encrypted using ENCRYPTION_KEY from .env - see services/crypto.js.
  access_key_id VARCHAR(128),
  secret_access_key_encrypted TEXT,
  credentials_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  client VARCHAR(150),
  type VARCHAR(30) DEFAULT 'Web',
  aws_account_id INTEGER REFERENCES aws_accounts(id) ON DELETE SET NULL,
  hosting_provider VARCHAR(50) DEFAULT 'AWS',
  instance_id VARCHAR(50),
  region VARCHAR(30),
  db_type VARCHAR(30),
  db_host VARCHAR(255),
  url VARCHAR(255),
  repo_url VARCHAR(255),
  monthly_cost NUMERIC(10, 2) DEFAULT 0,
  is_static BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'stopped',
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_history (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  aws_account_id INTEGER REFERENCES aws_accounts(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  hosting NUMERIC(10, 2) DEFAULT 0,
  database NUMERIC(10, 2) DEFAULT 0,
  storage NUMERIC(10, 2) DEFAULT 0,
  other NUMERIC(10, 2) DEFAULT 0,
  source VARCHAR(20) DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_aws_account ON projects(aws_account_id);
CREATE INDEX IF NOT EXISTS idx_billing_project ON billing_history(project_id);
CREATE INDEX IF NOT EXISTS idx_billing_account_month ON billing_history(aws_account_id, month);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_logs(project_id);

-- Added after initial release: stores the instance's current public IP so
-- it can be shown in the UI without a live AWS call every time, and lets
-- the "status" column temporarily hold AWS's own transitional state names
-- (pending, stopping, shutting-down) instead of just running/stopped -
-- this is what allows the UI to mirror the AWS Console's own loading state
-- instead of flipping instantly. Safe to re-run: ADD COLUMN IF NOT EXISTS
-- is a no-op if the column is already there.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS public_ip VARCHAR(45);
