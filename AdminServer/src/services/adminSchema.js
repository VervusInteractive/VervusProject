const { pool, assertDatabaseConfigured } = require("../db");

async function ensureRoomCoreTables() {
  assertDatabaseConfigured();
  await pool.query(`CREATE SCHEMA IF NOT EXISTS vervus_data;`);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await pool.query(`DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'vervus_data'
        AND t.typname = 'room_status'
    ) THEN
      CREATE TYPE vervus_data.room_status AS ENUM ('lobby', 'preview', 'payment_pending', 'premium', 'reconnecting', 'ended', 'expired');
    END IF;
  END
  $$;`);
  await pool.query(`ALTER TYPE vervus_data.room_status ADD VALUE IF NOT EXISTS 'lobby';`);
  await pool.query(`ALTER TYPE vervus_data.room_status ADD VALUE IF NOT EXISTS 'preview';`);
  await pool.query(`ALTER TYPE vervus_data.room_status ADD VALUE IF NOT EXISTS 'payment_pending';`);
  await pool.query(`ALTER TYPE vervus_data.room_status ADD VALUE IF NOT EXISTS 'premium';`);
  await pool.query(`ALTER TYPE vervus_data.room_status ADD VALUE IF NOT EXISTS 'reconnecting';`);
  await pool.query(`ALTER TYPE vervus_data.room_status ADD VALUE IF NOT EXISTS 'ended';`);
  await pool.query(`ALTER TYPE vervus_data.room_status ADD VALUE IF NOT EXISTS 'expired';`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.player_profiles (
    id UUID PRIMARY KEY,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT NOT NULL UNIQUE,
    status vervus_data.room_status NOT NULL DEFAULT 'lobby',
    host_player_id UUID NULL,
    max_players INTEGER NOT NULL DEFAULT 4,
    started_at TIMESTAMPTZ NULL,
    ended_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  );`);
  await pool.query(`ALTER TABLE vervus_data.rooms
    ADD COLUMN IF NOT EXISTS host_player_id UUID NULL,
    ADD COLUMN IF NOT EXISTS max_players INTEGER NOT NULL DEFAULT 4,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.players (
    id UUID PRIMARY KEY,
    room_id UUID NULL REFERENCES vervus_data.rooms(id) ON DELETE CASCADE,
    display_name TEXT,
    is_host BOOLEAN NOT NULL DEFAULT false,
    connection_status TEXT NOT NULL DEFAULT 'connected',
    is_ready BOOLEAN NOT NULL DEFAULT false,
    player_slot INTEGER NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ NULL,
    connection_state_changed_at TIMESTAMPTZ NULL,
    reconnecting_started_at TIMESTAMPTZ NULL,
    disconnected_at TIMESTAMPTZ NULL
  );`);
  await pool.query(`ALTER TABLE vervus_data.players
    ADD COLUMN IF NOT EXISTS room_id UUID NULL REFERENCES vervus_data.rooms(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS display_name TEXT,
    ADD COLUMN IF NOT EXISTS is_host BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'connected',
    ADD COLUMN IF NOT EXISTS is_ready BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS player_slot INTEGER NULL,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS connection_state_changed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS reconnecting_started_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ NULL;`);
}

async function ensureAnalyticsEventTables() {
  await ensureRoomCoreTables();
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    profile_id UUID NULL,
    room_code TEXT NULL,
    product_key TEXT NULL,
    mode_key TEXT NULL,
    source TEXT NULL,
    referrer TEXT NULL,
    session_id TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_event_at
    ON vervus_data.analytics_events(event_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_name_event_at
    ON vervus_data.analytics_events(event_name, event_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_profile_event_at
    ON vervus_data.analytics_events(profile_id, event_at DESC);`);
}

async function ensureOperationalTables() {
  await ensureAnalyticsEventTables();
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.room_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NULL REFERENCES vervus_data.rooms(id) ON DELETE SET NULL,
    room_code TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_player_id UUID NULL,
    actor_profile_id UUID NULL,
    from_status vervus_data.room_status NULL,
    to_status vervus_data.room_status NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`ALTER TABLE vervus_data.room_history
    ADD COLUMN IF NOT EXISTS actor_profile_id UUID NULL;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_room_history_event_type_event_at
    ON vervus_data.room_history(event_type, event_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_room_history_room_code_event_at
    ON vervus_data.room_history(room_code, event_at DESC);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NULL REFERENCES vervus_data.rooms(id) ON DELETE SET NULL,
    room_code TEXT NULL,
    player_id UUID NULL,
    source TEXT NOT NULL,
    error_code TEXT NULL,
    severity TEXT NOT NULL DEFAULT 'error',
    message TEXT NOT NULL,
    stack_trace TEXT NULL,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ NULL
  );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at
    ON vervus_data.error_logs(occurred_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_error_logs_severity_occurred_at
    ON vervus_data.error_logs(severity, occurred_at DESC);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.stripe_webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ NULL,
    failed_at TIMESTAMPTZ NULL,
    error_message TEXT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
  );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at
    ON vervus_data.stripe_webhook_events(received_at DESC);`);
}

async function ensureContactMessageTables() {
  await ensureRoomCoreTables();
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'contact_page',
    user_agent TEXT NULL,
    ip_address TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ NULL
  );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
    ON vervus_data.contact_messages(created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_messages_read_created_at
    ON vervus_data.contact_messages(read_at, created_at DESC);`);
}

async function ensureCommerceTables() {
  await ensureOperationalTables();
  await pool.query(`DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'vervus_data'
        AND t.typname = 'payment_status'
    ) THEN
      CREATE TYPE vervus_data.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'cancelled');
    END IF;
  END
  $$;`);
  await pool.query(`ALTER TYPE vervus_data.payment_status ADD VALUE IF NOT EXISTS 'pending';`);
  await pool.query(`ALTER TYPE vervus_data.payment_status ADD VALUE IF NOT EXISTS 'paid';`);
  await pool.query(`ALTER TYPE vervus_data.payment_status ADD VALUE IF NOT EXISTS 'failed';`);
  await pool.query(`ALTER TYPE vervus_data.payment_status ADD VALUE IF NOT EXISTS 'refunded';`);
  await pool.query(`ALTER TYPE vervus_data.payment_status ADD VALUE IF NOT EXISTS 'cancelled';`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NULL,
    product_id UUID NULL REFERENCES vervus_data.products(id) ON DELETE SET NULL,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    payment_status vervus_data.payment_status NOT NULL DEFAULT 'pending',
    stripe_checkout_session_id TEXT NULL,
    stripe_payment_intent_id TEXT NULL,
    paid_at TIMESTAMPTZ NULL,
    failed_at TIMESTAMPTZ NULL,
    entitlement_granted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`ALTER TABLE vervus_data.purchases
    ADD COLUMN IF NOT EXISTS player_id UUID NULL,
    ADD COLUMN IF NOT EXISTS product_id UUID NULL REFERENCES vervus_data.products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS amount_cents INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS payment_status vervus_data.payment_status NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS entitlement_granted_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_stripe_checkout_session_unique
    ON vervus_data.purchases(stripe_checkout_session_id)
    WHERE stripe_checkout_session_id IS NOT NULL;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_purchases_status_created_at
    ON vervus_data.purchases(payment_status, created_at DESC);`);
}

module.exports = {
  ensureAnalyticsEventTables,
  ensureContactMessageTables,
  ensureCommerceTables,
  ensureOperationalTables,
  ensureRoomCoreTables
};
