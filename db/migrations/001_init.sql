-- Skema inti E-Ticket War Tiket.
-- Aturan bisnis kritis dijaga oleh constraint di sini, bukan hanya di kode aplikasi.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Akun
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL,
  password_hash     text,
  full_name         text NOT NULL,
  id_type           text CHECK (id_type IN ('KTP', 'SIM', 'PASPOR')),
  identity_hash     text,
  id_last4          text CHECK (id_last4 ~ '^[0-9A-Z]{1,4}$'),
  email_verified_at timestamptz,
  role              text NOT NULL DEFAULT 'ATTENDEE'
                    CHECK (role IN ('ATTENDEE', 'GATE_STAFF', 'EVENT_ADMIN', 'SUPER_ADMIN')),
  terms_accepted_at timestamptz,
  disabled_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  ip          text,
  user_agent  text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD', 'LOGIN_2FA')),
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Hanya 1 OTP aktif per user per purpose.
CREATE UNIQUE INDEX otp_active_uq ON otp_codes (user_id, purpose) WHERE consumed_at IS NULL;

CREATE TABLE blocked_email_domains (
  domain     text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Event & kategori
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL,
  name                  text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  event_type            text NOT NULL DEFAULT 'Lainnya',
  organizer             text NOT NULL DEFAULT '',
  description           text NOT NULL DEFAULT '',
  terms                 text NOT NULL DEFAULT '',
  banner_url            text,
  thumb_url             text,
  gallery               jsonb NOT NULL DEFAULT '[]'::jsonb,
  venue                 text NOT NULL DEFAULT '',
  address               text NOT NULL DEFAULT '',
  city                  text NOT NULL DEFAULT '',
  lat                   double precision,
  lng                   double precision,
  timezone              text NOT NULL DEFAULT 'Asia/Jakarta'
                        CHECK (timezone IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')),
  start_at              timestamptz NOT NULL,
  end_at                timestamptz NOT NULL,
  gate_open_at          timestamptz,
  gates                 text[] NOT NULL DEFAULT ARRAY['Gate A']::text[],
  status                text NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED')),
  cancel_deadline_hours int NOT NULL DEFAULT 72 CHECK (cancel_deadline_hours >= 0),
  require_id_match      boolean NOT NULL DEFAULT true,
  email_text            text NOT NULL DEFAULT '',
  published_at          timestamptz,
  cancelled_at          timestamptz,
  version               int NOT NULL DEFAULT 1,
  created_by            uuid REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_slug_uq UNIQUE (slug),
  CONSTRAINT events_time_ck CHECK (end_at > start_at)
);

CREATE TABLE ticket_categories (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name               text NOT NULL,
  description        text NOT NULL DEFAULT '',
  quota              int NOT NULL CHECK (quota >= 1),
  claimed            int NOT NULL DEFAULT 0,
  open_at            timestamptz NOT NULL,
  close_at           timestamptz NOT NULL,
  is_closed          boolean NOT NULL DEFAULT false,
  sort_order         int NOT NULL DEFAULT 0,
  color              text NOT NULL DEFAULT '#1B3A6F',
  admit_batch        int NOT NULL DEFAULT 50 CHECK (admit_batch >= 1),
  admit_interval_sec int NOT NULL DEFAULT 5 CHECK (admit_interval_sec >= 1),
  version            int NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- Jaring pengaman terakhir dari overbooking.
  CONSTRAINT categories_claimed_ck CHECK (claimed >= 0 AND claimed <= quota),
  CONSTRAINT categories_time_ck CHECK (close_at > open_at)
);
CREATE INDEX categories_event_idx ON ticket_categories (event_id, sort_order);

-- ---------------------------------------------------------------------------
-- Tiket
-- ---------------------------------------------------------------------------
CREATE TABLE tickets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES events(id),
  category_id      uuid NOT NULL REFERENCES ticket_categories(id),
  user_id          uuid NOT NULL REFERENCES users(id),
  identity_hash    text NOT NULL,
  holder_name      text NOT NULL,
  id_type          text NOT NULL,
  id_last4         text,
  status           text NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE', 'CHECKED_IN', 'CANCELLED', 'REVOKED')),
  version          int NOT NULL DEFAULT 1,
  idempotency_key  text NOT NULL,
  email_status     text NOT NULL DEFAULT 'PENDING' CHECK (email_status IN ('PENDING', 'SENT', 'FAILED')),
  issued_at        timestamptz NOT NULL DEFAULT now(),
  cancelled_at     timestamptz,
  cancel_reason    text,
  checked_in_at    timestamptz,
  checked_in_gate  text,
  checked_in_by    uuid REFERENCES users(id),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tickets_idem_uq UNIQUE (idempotency_key)
);
-- Satu akun satu tiket aktif per event (CHECKED_IN ikut dihitung).
CREATE UNIQUE INDEX tickets_event_user_uq ON tickets (event_id, user_id)
  WHERE status IN ('ACTIVE', 'CHECKED_IN');
-- Satu identitas satu tiket aktif per event.
CREATE UNIQUE INDEX tickets_event_identity_uq ON tickets (event_id, identity_hash)
  WHERE status IN ('ACTIVE', 'CHECKED_IN');
CREATE INDEX tickets_user_idx ON tickets (user_id);
CREATE INDEX tickets_category_idx ON tickets (category_id, status);
CREATE INDEX tickets_event_updated_idx ON tickets (event_id, updated_at);

-- ---------------------------------------------------------------------------
-- Gate
-- ---------------------------------------------------------------------------
CREATE TABLE gate_staff (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gates       text[] NOT NULL DEFAULT ARRAY[]::text[],
  valid_until timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gate_staff_uq UNIQUE (event_id, user_id)
);

CREATE TABLE checkins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   text UNIQUE,
  ticket_id   uuid REFERENCES tickets(id),
  event_id    uuid NOT NULL REFERENCES events(id),
  device_id   text,
  gate        text,
  staff_id    uuid REFERENCES users(id),
  method      text NOT NULL DEFAULT 'QR' CHECK (method IN ('QR', 'MANUAL')),
  result      text NOT NULL CHECK (result IN ('ADMITTED', 'REJECTED', 'CONFLICT')),
  reason      text,
  offline     boolean NOT NULL DEFAULT false,
  scanned_at  timestamptz NOT NULL,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id)
);
CREATE INDEX checkins_event_idx ON checkins (event_id, scanned_at DESC);
CREATE INDEX checkins_ticket_idx ON checkins (ticket_id);

-- ---------------------------------------------------------------------------
-- Outbox (email, alert) & audit
-- ---------------------------------------------------------------------------
CREATE TABLE outbox (
  id          bigserial PRIMARY KEY,
  type        text NOT NULL,
  payload     jsonb NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  next_try_at timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  failed_at   timestamptz,
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending_idx ON outbox (next_try_at) WHERE sent_at IS NULL AND failed_at IS NULL;

CREATE TABLE audit_log (
  id        bigserial PRIMARY KEY,
  actor_id  uuid REFERENCES users(id),
  action    text NOT NULL,
  entity    text NOT NULL,
  entity_id text,
  before    jsonb,
  after     jsonb,
  ip        text,
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity, entity_id);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);

-- Audit log append-only: tolak UPDATE/DELETE di level DB.
CREATE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- checkins juga append-only, kecuali penandaan resolved & CONFLICT oleh sistem.
CREATE FUNCTION checkins_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'checkins is append-only';
  END IF;
  IF NEW.ticket_id IS DISTINCT FROM OLD.ticket_id OR NEW.scanned_at <> OLD.scanned_at
     OR NEW.staff_id IS DISTINCT FROM OLD.staff_id OR NEW.gate IS DISTINCT FROM OLD.gate THEN
    RAISE EXCEPTION 'checkins core fields are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER checkins_guard BEFORE UPDATE OR DELETE ON checkins
  FOR EACH ROW EXECUTE FUNCTION checkins_guard();

-- updated_at otomatis.
CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER events_touch BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER categories_touch BEFORE UPDATE ON ticket_categories FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tickets_touch BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
