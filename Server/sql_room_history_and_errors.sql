-- Tables for room lifecycle history and runtime error tracking.
-- Target DB: PostgreSQL (schema: vervus_data)

CREATE SCHEMA IF NOT EXISTS vervus_data;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS vervus_data.player_profiles (
  id UUID PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'vervus_data'
      AND c.relname = 'rooms'
  ) THEN
    ALTER TABLE vervus_data.rooms
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END
$$;


-- Room lifecycle architecture values used by vervus_data.rooms.status.
-- Existing deployments may use either an enum or a VARCHAR column.
DO $$
DECLARE
  room_status_schema text;
  room_status_name text;
  room_status_kind "char";
BEGIN
  SELECT tn.nspname, t.typname, t.typtype
    INTO room_status_schema, room_status_name, room_status_kind
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace cn ON cn.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_namespace tn ON tn.oid = t.typnamespace
  WHERE cn.nspname = 'vervus_data'
    AND c.relname = 'rooms'
    AND a.attname = 'status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF room_status_kind = 'e' THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', room_status_schema, room_status_name, 'preview');
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', room_status_schema, room_status_name, 'payment_pending');
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', room_status_schema, room_status_name, 'premium');
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', room_status_schema, room_status_name, 'reconnecting');
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', room_status_schema, room_status_name, 'expired');
  END IF;
END
$$;


-- Game-mode deviation compatibility: Partial Break is a first-class deviation
-- configured through vervus_data.mode_deviation_mix.deviation_type.
DO $$
DECLARE
  deviation_type_schema text;
  deviation_type_name text;
  deviation_type_kind "char";
  constraint_record record;
BEGIN
  SELECT tn.nspname, t.typname, t.typtype
    INTO deviation_type_schema, deviation_type_name, deviation_type_kind
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace cn ON cn.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_namespace tn ON tn.oid = t.typnamespace
  WHERE cn.nspname = 'vervus_data'
    AND c.relname = 'mode_deviation_mix'
    AND a.attname = 'deviation_type'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF deviation_type_kind = 'e' THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', deviation_type_schema, deviation_type_name, 'partial_break');
  ELSIF deviation_type_kind IS NOT NULL THEN
    FOR constraint_record IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'vervus_data'
        AND c.relname = 'mode_deviation_mix'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%deviation_type%'
        AND pg_get_constraintdef(con.oid) ILIKE '%shape_swap%'
        AND pg_get_constraintdef(con.oid) ILIKE '%false_twin%'
    LOOP
      EXECUTE format('ALTER TABLE vervus_data.mode_deviation_mix DROP CONSTRAINT %I', constraint_record.conname);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'vervus_data'
        AND c.relname = 'mode_deviation_mix'
        AND con.conname = 'mode_deviation_mix_deviation_type_chk'
    ) THEN
      ALTER TABLE vervus_data.mode_deviation_mix
        ADD CONSTRAINT mode_deviation_mix_deviation_type_chk
        CHECK (deviation_type IN ('shape_swap', 'false_twin', 'partial_break'));
    END IF;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS vervus_data.room_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NULL REFERENCES vervus_data.rooms(id) ON DELETE SET NULL,
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
      'room_expired',
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'vervus_data'
      AND table_name = 'room_history'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'vervus_data'
        AND c.relname = 'room_history'
        AND a.attname = 'room_id'
        AND a.attnotnull
    ) THEN
      ALTER TABLE vervus_data.room_history
        ALTER COLUMN room_id DROP NOT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'vervus_data'
        AND c.relname = 'room_history'
        AND con.conname = 'room_history_room_id_fkey'
        AND con.confdeltype = 'n'
    ) THEN
      ALTER TABLE vervus_data.room_history
        DROP CONSTRAINT IF EXISTS room_history_room_id_fkey;

      ALTER TABLE vervus_data.room_history
        ADD CONSTRAINT room_history_room_id_fkey
        FOREIGN KEY (room_id)
        REFERENCES vervus_data.rooms(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END
$$;



CREATE TABLE IF NOT EXISTS vervus_data.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NULL REFERENCES vervus_data.rooms(id) ON DELETE SET NULL,
  room_code TEXT NOT NULL,
  mode_key TEXT NOT NULL DEFAULT 'standard',
  is_preview BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NULL,
  duration_ms INTEGER NULL,
  final_combo INTEGER NOT NULL DEFAULT 0,
  highest_combo INTEGER NOT NULL DEFAULT 0,
  player_count INTEGER NOT NULL DEFAULT 0,
  end_reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at
  ON vervus_data.game_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_sessions_mode_started_at
  ON vervus_data.game_sessions(mode_key, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_sessions_room_code_started_at
  ON vervus_data.game_sessions(room_code, started_at DESC);

CREATE TABLE IF NOT EXISTS vervus_data.stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  error_message TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at
  ON vervus_data.stripe_webhook_events(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_type_received_at
  ON vervus_data.stripe_webhook_events(event_type, received_at DESC);

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'vervus_data'
      AND c.relname = 'room_history'
  ) THEN
    ALTER TABLE vervus_data.room_history
      DROP CONSTRAINT IF EXISTS room_history_event_type_chk;
    ALTER TABLE vervus_data.room_history
      ADD CONSTRAINT room_history_event_type_chk CHECK (
        event_type IN (
          'room_created',
          'room_joined',
          'room_left',
          'room_started',
          'room_ended',
          'room_expired',
          'room_deleted',
          'host_changed',
          'settings_changed'
        )
      );
  END IF;
END
$$;
