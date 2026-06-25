CREATE TABLE IF NOT EXISTS crm_studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID REFERENCES crm_studios(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  birthday DATE,
  referral_code TEXT UNIQUE,
  referred_by_client_id UUID REFERENCES crm_clients(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID REFERENCES crm_studios(id),
  client_id UUID REFERENCES crm_clients(id),
  service_type TEXT CHECK (service_type IN ('30min','60min','90min')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','checked_in','completed','no_show','cancelled')),
  square_payment_id TEXT,
  amount_paid DECIMAL(10,2),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_consent_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES crm_appointments(id),
  client_id UUID REFERENCES crm_clients(id),
  quiz_responses JSONB,
  recommended_treatment TEXT,
  signature_data_url TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES crm_appointments(id),
  client_id UUID REFERENCES crm_clients(id),
  photo_type TEXT CHECK (photo_type IN ('before','after','composite')),
  storage_path TEXT,
  storage_url TEXT,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_client_id UUID REFERENCES crm_clients(id),
  referred_client_id UUID REFERENCES crm_clients(id),
  code_used TEXT,
  discount_applied DECIMAL(10,2),
  credit_issued DECIMAL(10,2),
  cash_payout_amount DECIMAL(10,2),
  payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending','paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_automations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES crm_clients(id),
  appointment_id UUID REFERENCES crm_appointments(id),
  automation_type TEXT,
  channel TEXT CHECK (channel IN ('email','sms')),
  status TEXT CHECK (status IN ('sent','failed','pending')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
