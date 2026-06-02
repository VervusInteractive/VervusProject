-- Tables for room lifecycle history and runtime error tracking.
-- Target DB: PostgreSQL (schema: vervus_data)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Connection-state architecture values used by vervus_data.players.connection_status.
-- Render databases may have this column as VARCHAR instead of an enum; only enum
-- columns can be altered with ALTER TYPE ... ADD VALUE.
DO $$
DECLARE
  connection_status_schema text;
  connection_status_name text;
  connection_status_kind "char";
BEGIN
  SELECT tn.nspname, t.typname, t.typtype
    INTO connection_status_schema, connection_status_name, connection_status_kind
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace cn ON cn.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_namespace tn ON tn.oid = t.typnamespace
  WHERE cn.nspname = 'vervus_data'
    AND c.relname = 'players'
    AND a.attname = 'connection_status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF connection_status_kind = 'e' THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', connection_status_schema, connection_status_name, 'connecting');
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', connection_status_schema, connection_status_name, 'reconnecting');
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', connection_status_schema, connection_status_name, 'degraded');
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'vervus_data'
      AND c.relname = 'players'
  ) THEN
    ALTER TABLE vervus_data.players
      ADD COLUMN IF NOT EXISTS connection_state_changed_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS reconnecting_started_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS vervus_data.room_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES vervus_data.rooms(id) ON DELETE CASCADE,
  room_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_player_id UUID NULL REFERENCES vervus_data.players(id) ON DELETE SET NULL,
  from_status vervus_data.room_status NULL,
  to_status vervus_data.room_status NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT room_history_event_type_chk CHECK (
    event_type IN (
      'room_created',
      'room_joined',
      'room_left',
      'room_started',
      'room_ended',
      'room_deleted',
      'host_changed',
      'settings_changed'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_room_history_room_id_event_at
  ON vervus_data.room_history(room_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_history_event_type_event_at
  ON vervus_data.room_history(event_type, event_at DESC);

CREATE TABLE IF NOT EXISTS vervus_data.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NULL REFERENCES vervus_data.rooms(id) ON DELETE SET NULL,
  room_code TEXT NULL,
  player_id UUID NULL REFERENCES vervus_data.players(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  error_code TEXT NULL,
  severity TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack_trace TEXT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  CONSTRAINT error_logs_severity_chk CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at
  ON vervus_data.error_logs(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_room_id_occurred_at
  ON vervus_data.error_logs(room_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_severity_occurred_at
  ON vervus_data.error_logs(severity, occurred_at DESC);

-- Optional helper to mark fixes
CREATE OR REPLACE FUNCTION vervus_data.resolve_error_log(error_log_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE vervus_data.error_logs
  SET resolved_at = now()
  WHERE id = error_log_id;
END;
$$;
