CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  profile_url TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT,
  source_text TEXT,
  consent_status TEXT NOT NULL,
  contacts JSONB NOT NULL DEFAULT '{}',
  raw_event JSONB NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  collected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, source_id)
);

CREATE INDEX IF NOT EXISTS leads_platform_user_idx ON leads(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS leads_collected_at_idx ON leads(collected_at DESC);
CREATE INDEX IF NOT EXISTS leads_contacts_gin_idx ON leads USING GIN(contacts);

CREATE TABLE IF NOT EXISTS lead_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  lead_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS lead_audit_lead_idx ON lead_audit(lead_id, changed_at DESC);

CREATE OR REPLACE FUNCTION record_lead_audit() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO lead_audit(lead_id, operation, snapshot) VALUES (NEW.id, TG_OP, to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_audit_trigger ON leads;
CREATE TRIGGER leads_audit_trigger AFTER INSERT OR UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION record_lead_audit();

CREATE TABLE IF NOT EXISTS crm_outbox (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lead_version TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','retry','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id, lead_version)
);

CREATE INDEX IF NOT EXISTS crm_outbox_ready_idx ON crm_outbox(status, available_at);

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  variants JSONB NOT NULL CHECK (jsonb_typeof(variants)='array' AND jsonb_array_length(variants) BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES message_templates(id),
  platforms JSONB NOT NULL,
  minimum_score INTEGER NOT NULL DEFAULT 0 CHECK (minimum_score BETWEEN 0 AND 100),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','running','completed','paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppression_list (
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(platform,platform_user_id)
);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  variant_index INTEGER NOT NULL,
  rendered_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','retry','failed','cancelled','manual_review')),
  attempts INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider_message_id TEXT,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id,lead_id)
);

CREATE INDEX IF NOT EXISTS outreach_messages_ready_idx ON outreach_messages(status,available_at,scheduled_at);
