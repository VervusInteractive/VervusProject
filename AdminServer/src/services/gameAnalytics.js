const { pool, assertDatabaseConfigured } = require("../db");
const { ensureModeConfigTables } = require("./modeConfigurations");
const { normalizeAnalyticsWindowDays } = require("../utils/normalizers");

async function ensureGameAnalyticsTables() {
  assertDatabaseConfigured();
  await pool.query(`CREATE SCHEMA IF NOT EXISTS vervus_data;`);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.game_sessions (
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
  );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at ON vervus_data.game_sessions(started_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_game_sessions_mode_started_at ON vervus_data.game_sessions(mode_key, started_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_game_sessions_room_code_started_at ON vervus_data.game_sessions(room_code, started_at DESC);`);
}



async function getGameAnalytics({ days = 30 } = {}) {
  await ensureGameAnalyticsTables();
  await ensureModeConfigTables();
  const windowDays = normalizeAnalyticsWindowDays(days);
  const params = [windowDays];

  const [summaryResult, gamesResult, recentResult] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS sessions,
                       COALESCE(AVG(final_combo) FILTER (WHERE ended_at IS NOT NULL), 0)::float AS avg_combo,
                       COALESCE(MAX(highest_combo), 0)::int AS highest_combo,
                       COALESCE(AVG(duration_ms) FILTER (WHERE ended_at IS NOT NULL AND duration_ms IS NOT NULL), 0)::float AS avg_duration_ms
                FROM vervus_data.game_sessions
                WHERE started_at >= now() - ($1::int * interval '1 day')`, params),
    pool.query(`SELECT COALESCE(gm.display_name, initcap(replace(gs.mode_key, '_', ' '))) AS game_name,
                       gs.mode_key,
                       COUNT(*)::int AS sessions,
                       COALESCE(AVG(gs.final_combo) FILTER (WHERE gs.ended_at IS NOT NULL), 0)::float AS avg_combo,
                       COALESCE(MAX(gs.highest_combo), 0)::int AS highest_combo,
                       COALESCE(AVG(gs.duration_ms) FILTER (WHERE gs.ended_at IS NOT NULL AND gs.duration_ms IS NOT NULL), 0)::float AS avg_duration_ms
                FROM vervus_data.game_sessions gs
                LEFT JOIN vervus_data.game_modes gm ON gm.mode_key::text = gs.mode_key
                WHERE gs.started_at >= now() - ($1::int * interval '1 day')
                GROUP BY gs.mode_key, gm.display_name
                ORDER BY sessions DESC, game_name ASC`, params),
    pool.query(`SELECT room_code, mode_key, is_preview, started_at, ended_at, duration_ms, final_combo, highest_combo, player_count, end_reason
                FROM vervus_data.game_sessions
                WHERE started_at >= now() - ($1::int * interval '1 day')
                ORDER BY started_at DESC
                LIMIT 10`, params)
  ]);

  const summary = summaryResult.rows[0] || {};
  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    summary: {
      sessions: Number(summary.sessions) || 0,
      avgCombo: Number(summary.avg_combo) || 0,
      highestCombo: Number(summary.highest_combo) || 0,
      avgDurationMs: Number(summary.avg_duration_ms) || 0
    },
    games: gamesResult.rows.map((row) => ({
      gameName: row.game_name,
      modeKey: row.mode_key,
      sessions: Number(row.sessions) || 0,
      avgCombo: Number(row.avg_combo) || 0,
      highestCombo: Number(row.highest_combo) || 0,
      avgDurationMs: Number(row.avg_duration_ms) || 0
    })),
    recentSessions: recentResult.rows.map((row) => ({
      roomCode: row.room_code,
      modeKey: row.mode_key,
      isPreview: Boolean(row.is_preview),
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationMs: Number(row.duration_ms) || 0,
      finalCombo: Number(row.final_combo) || 0,
      highestCombo: Number(row.highest_combo) || 0,
      playerCount: Number(row.player_count) || 0,
      endReason: row.end_reason
    }))
  };
}

module.exports = { ensureGameAnalyticsTables, getGameAnalytics };
