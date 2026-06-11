const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3002;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "";
const NODE_ENV = process.env.NODE_ENV || "development";
const DATABASE_URL = process.env.DATABASE_URL || "";

const pool = DATABASE_URL
  ? new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
  })
  : null;

const allowedOrigins = CLIENT_ORIGIN
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : NODE_ENV !== "production",
  credentials: true
}));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});


function assertDatabaseConfigured() {
  if (!pool) {
    const error = new Error("DATABASE_URL is required for database-backed admin tools");
    error.statusCode = 503;
    throw error;
  }
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return Boolean(value);
}

function normalizeInteger(value, fallback, { min = 0, max = 60000 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function normalizeModeKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeOrientationLock(value = "both") {
  const normalized = String(value || "both").trim().toLowerCase();
  return ["portrait", "landscape", "both"].includes(normalized) ? normalized : "both";
}

function normalizeTextArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizePercent(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, numeric));
}

function normalizeConfigRows(value) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : [];
}

async function ensureModeConfigTables() {
  assertDatabaseConfigured();
  await pool.query(`CREATE SCHEMA IF NOT EXISTS vervus_data;`);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.game_modes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.mode_configs (
    mode_id UUID PRIMARY KEY REFERENCES vervus_data.game_modes(id) ON DELETE CASCADE,
    has_last_chance BOOLEAN NOT NULL DEFAULT true,
    result_lock_ms INTEGER NOT NULL DEFAULT 500,
    transition_beat_ms INTEGER NOT NULL DEFAULT 300,
    good_run_round INTEGER NOT NULL DEFAULT 50,
    orientation_lock TEXT NOT NULL DEFAULT 'both',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`ALTER TABLE vervus_data.mode_configs ADD COLUMN IF NOT EXISTS orientation_lock TEXT;`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.mode_difficulty_bands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode_id UUID NOT NULL REFERENCES vervus_data.game_modes(id) ON DELETE CASCADE,
    combo_min INTEGER NOT NULL DEFAULT 0,
    decision_time_ms INTEGER NOT NULL DEFAULT 5000,
    glitch_chance_percent NUMERIC NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.mode_deviation_mix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    difficulty_band_id UUID NOT NULL REFERENCES vervus_data.mode_difficulty_bands(id) ON DELETE CASCADE,
    deviation_type TEXT NOT NULL,
    weight_percent NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (difficulty_band_id, deviation_type)
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.mode_false_twin_mix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    difficulty_band_id UUID NOT NULL REFERENCES vervus_data.mode_difficulty_bands(id) ON DELETE CASCADE,
    false_twin_type TEXT NOT NULL,
    weight_percent NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (difficulty_band_id, false_twin_type)
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.mode_heat_surge_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode_id UUID NOT NULL UNIQUE REFERENCES vervus_data.game_modes(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    minimum_correct_rounds INTEGER NOT NULL DEFAULT 0,
    activation_chance_percent NUMERIC NOT NULL DEFAULT 0,
    duration_rounds INTEGER NOT NULL DEFAULT 0,
    cooldown_rounds INTEGER NOT NULL DEFAULT 0,
    timer_reduction_ms INTEGER NOT NULL DEFAULT 0,
    intensity_bonus_levels INTEGER NOT NULL DEFAULT 0,
    transition_warning_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.mode_corruption_bands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode_id UUID NOT NULL REFERENCES vervus_data.game_modes(id) ON DELETE CASCADE,
    combo_min INTEGER NOT NULL DEFAULT 0,
    visual_effects TEXT[] NOT NULL DEFAULT '{}',
    audio_effects TEXT[] NOT NULL DEFAULT '{}',
    intensity_level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`INSERT INTO vervus_data.game_modes (mode_key, display_name, is_enabled)
    VALUES ('standard', 'GLiTCH!', true),
           ('blitz', 'GLiTCH! Blitz', true),
           ('chaos', 'GLiTCH! Chaos', true)
    ON CONFLICT (mode_key) DO NOTHING;`);
  await pool.query(`INSERT INTO vervus_data.mode_configs (mode_id, has_last_chance, result_lock_ms, transition_beat_ms, good_run_round, orientation_lock)
    SELECT id, mode_key <> 'blitz', CASE WHEN mode_key = 'blitz' THEN 400 ELSE 500 END, CASE WHEN mode_key = 'blitz' THEN 350 ELSE 300 END, 50, 'both'
    FROM vervus_data.game_modes
    ON CONFLICT (mode_id) DO NOTHING;`);
}

async function listModeConfigurations() {
  await ensureModeConfigTables();
  const { rows } = await pool.query(`SELECT gm.id, gm.mode_key, gm.display_name, gm.is_enabled,
            mc.has_last_chance, mc.result_lock_ms, mc.transition_beat_ms, mc.good_run_round, mc.orientation_lock,
            GREATEST(gm.updated_at, COALESCE(mc.updated_at, gm.updated_at)) AS updated_at
     FROM vervus_data.game_modes gm
     LEFT JOIN vervus_data.mode_configs mc ON mc.mode_id = gm.id
     ORDER BY gm.display_name ASC`);
  const modeIds = rows.map((row) => row.id);
  const [bandsResult, deviationResult, falseTwinResult, heatSurgeResult, corruptionResult] = modeIds.length
    ? await Promise.all([
      pool.query(`SELECT id, mode_id, combo_min, decision_time_ms, glitch_chance_percent, sort_order
         FROM vervus_data.mode_difficulty_bands
         WHERE mode_id = ANY($1::uuid[])
         ORDER BY mode_id ASC, sort_order ASC, combo_min ASC`, [modeIds]),
      pool.query(`SELECT dm.difficulty_band_id, dm.deviation_type, dm.weight_percent
         FROM vervus_data.mode_deviation_mix dm
         JOIN vervus_data.mode_difficulty_bands db ON db.id = dm.difficulty_band_id
         WHERE db.mode_id = ANY($1::uuid[])
         ORDER BY dm.deviation_type ASC`, [modeIds]),
      pool.query(`SELECT ft.difficulty_band_id, ft.false_twin_type, ft.weight_percent
         FROM vervus_data.mode_false_twin_mix ft
         JOIN vervus_data.mode_difficulty_bands db ON db.id = ft.difficulty_band_id
         WHERE db.mode_id = ANY($1::uuid[])
         ORDER BY ft.false_twin_type ASC`, [modeIds]),
      pool.query(`SELECT mode_id, is_enabled, minimum_correct_rounds, activation_chance_percent, duration_rounds, cooldown_rounds, timer_reduction_ms, intensity_bonus_levels, transition_warning_ms
         FROM vervus_data.mode_heat_surge_configs
         WHERE mode_id = ANY($1::uuid[])`, [modeIds]),
      pool.query(`SELECT mode_id, combo_min, visual_effects, audio_effects, intensity_level
         FROM vervus_data.mode_corruption_bands
         WHERE mode_id = ANY($1::uuid[])
         ORDER BY mode_id ASC, combo_min ASC`, [modeIds])
    ])
    : [{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }];

  const deviationByBandId = new Map();
  for (const row of deviationResult.rows) {
    const list = deviationByBandId.get(row.difficulty_band_id) || [];
    list.push({ deviationType: row.deviation_type, weightPercent: Number(row.weight_percent) || 0 });
    deviationByBandId.set(row.difficulty_band_id, list);
  }

  const falseTwinByBandId = new Map();
  for (const row of falseTwinResult.rows) {
    const list = falseTwinByBandId.get(row.difficulty_band_id) || [];
    list.push({ falseTwinType: row.false_twin_type, weightPercent: Number(row.weight_percent) || 0 });
    falseTwinByBandId.set(row.difficulty_band_id, list);
  }

  const bandsByModeId = new Map();
  for (const row of bandsResult.rows) {
    const list = bandsByModeId.get(row.mode_id) || [];
    list.push({
      comboMin: Number(row.combo_min) || 0,
      decisionTimeMs: Number(row.decision_time_ms) || 0,
      glitchChancePercent: Number(row.glitch_chance_percent) || 0,
      sortOrder: Number(row.sort_order) || 0,
      deviationMix: deviationByBandId.get(row.id) || [],
      falseTwinMix: falseTwinByBandId.get(row.id) || []
    });
    bandsByModeId.set(row.mode_id, list);
  }

  const heatSurgeByModeId = new Map(heatSurgeResult.rows.map((row) => [row.mode_id, {
    isEnabled: Boolean(row.is_enabled),
    minimumCorrectRounds: Number(row.minimum_correct_rounds) || 0,
    activationChancePercent: Number(row.activation_chance_percent) || 0,
    durationRounds: Number(row.duration_rounds) || 0,
    cooldownRounds: Number(row.cooldown_rounds) || 0,
    timerReductionMs: Number(row.timer_reduction_ms) || 0,
    intensityBonusLevels: Number(row.intensity_bonus_levels) || 0,
    transitionWarningMs: Number(row.transition_warning_ms) || 0
  }]));

  const corruptionByModeId = new Map();
  for (const row of corruptionResult.rows) {
    const list = corruptionByModeId.get(row.mode_id) || [];
    list.push({
      comboMin: Number(row.combo_min) || 0,
      visualEffects: normalizeTextArray(row.visual_effects),
      audioEffects: normalizeTextArray(row.audio_effects),
      intensityLevel: Number(row.intensity_level) || 1
    });
    corruptionByModeId.set(row.mode_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    modeKey: row.mode_key,
    displayName: row.display_name,
    isEnabled: Boolean(row.is_enabled),
    hasLastChance: row.has_last_chance ?? true,
    resultLockMs: Number(row.result_lock_ms) || 500,
    transitionBeatMs: Number(row.transition_beat_ms) || 300,
    goodRunRound: Number(row.good_run_round) || 50,
    orientationLock: normalizeOrientationLock(row.orientation_lock),
    difficultyBands: bandsByModeId.get(row.id) || [],
    heatSurgeConfig: heatSurgeByModeId.get(row.id) || null,
    corruptionBands: corruptionByModeId.get(row.id) || [],
    updatedAt: row.updated_at
  }));
}

async function saveModeConfiguration(payload = {}) {
  await ensureModeConfigTables();
  const modeKey = normalizeModeKey(payload.modeKey);
  if (!modeKey) {
    const error = new Error("modeKey is required");
    error.statusCode = 400;
    throw error;
  }

  const displayName = String(payload.displayName || modeKey).trim().slice(0, 120);
  const isEnabled = normalizeBoolean(payload.isEnabled);
  const hasLastChance = normalizeBoolean(payload.hasLastChance);
  const resultLockMs = normalizeInteger(payload.resultLockMs, 500, { min: 0, max: 10000 });
  const transitionBeatMs = normalizeInteger(payload.transitionBeatMs, 300, { min: 0, max: 10000 });
  const goodRunRound = normalizeInteger(payload.goodRunRound, 50, { min: 1, max: 1000 });
  const orientationLock = normalizeOrientationLock(payload.orientationLock);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO vervus_data.game_modes (mode_key, display_name, is_enabled, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (mode_key) DO UPDATE
       SET display_name = EXCLUDED.display_name, is_enabled = EXCLUDED.is_enabled, updated_at = now()
       RETURNING id`,
      [modeKey, displayName, isEnabled]
    );
    const modeId = rows[0].id;
    await client.query(
      `INSERT INTO vervus_data.mode_configs (mode_id, has_last_chance, result_lock_ms, transition_beat_ms, good_run_round, orientation_lock, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, now())
       ON CONFLICT (mode_id) DO UPDATE
       SET has_last_chance = EXCLUDED.has_last_chance,
           result_lock_ms = EXCLUDED.result_lock_ms,
           transition_beat_ms = EXCLUDED.transition_beat_ms,
           good_run_round = EXCLUDED.good_run_round,
           orientation_lock = EXCLUDED.orientation_lock,
           updated_at = now()`,
      [modeId, hasLastChance, resultLockMs, transitionBeatMs, goodRunRound, orientationLock]
    );

    if (Array.isArray(payload.difficultyBands)) {
      await client.query(`DELETE FROM vervus_data.mode_difficulty_bands WHERE mode_id = $1::uuid`, [modeId]);
      for (const [index, band] of normalizeConfigRows(payload.difficultyBands).entries()) {
        const bandResult = await client.query(
          `INSERT INTO vervus_data.mode_difficulty_bands (mode_id, combo_min, decision_time_ms, glitch_chance_percent, sort_order)
           VALUES ($1::uuid, $2, $3, $4, $5)
           RETURNING id`,
          [modeId, normalizeInteger(band.comboMin, 0, { min: 0, max: 100000 }), normalizeInteger(band.decisionTimeMs, 5000, { min: 1, max: 60000 }), normalizePercent(band.glitchChancePercent), normalizeInteger(band.sortOrder, index, { min: 0, max: 100000 })]
        );
        const bandId = bandResult.rows[0].id;
        for (const mix of normalizeConfigRows(band.deviationMix)) {
          const deviationType = String(mix.deviationType || mix.deviation_type || "").trim();
          if (!deviationType) continue;
          await client.query(
            `INSERT INTO vervus_data.mode_deviation_mix (difficulty_band_id, deviation_type, weight_percent)
             VALUES ($1::uuid, $2, $3)`,
            [bandId, deviationType, normalizePercent(mix.weightPercent ?? mix.weight_percent)]
          );
        }
        for (const mix of normalizeConfigRows(band.falseTwinMix)) {
          const falseTwinType = String(mix.falseTwinType || mix.false_twin_type || "").trim();
          if (!falseTwinType) continue;
          await client.query(
            `INSERT INTO vervus_data.mode_false_twin_mix (difficulty_band_id, false_twin_type, weight_percent)
             VALUES ($1::uuid, $2, $3)`,
            [bandId, falseTwinType, normalizePercent(mix.weightPercent ?? mix.weight_percent)]
          );
        }
      }
    }

    if (payload.heatSurgeConfig && typeof payload.heatSurgeConfig === "object") {
      const heat = payload.heatSurgeConfig;
      await client.query(
        `INSERT INTO vervus_data.mode_heat_surge_configs (mode_id, is_enabled, minimum_correct_rounds, activation_chance_percent, duration_rounds, cooldown_rounds, timer_reduction_ms, intensity_bonus_levels, transition_warning_ms)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (mode_id) DO UPDATE
         SET is_enabled = EXCLUDED.is_enabled,
             minimum_correct_rounds = EXCLUDED.minimum_correct_rounds,
             activation_chance_percent = EXCLUDED.activation_chance_percent,
             duration_rounds = EXCLUDED.duration_rounds,
             cooldown_rounds = EXCLUDED.cooldown_rounds,
             timer_reduction_ms = EXCLUDED.timer_reduction_ms,
             intensity_bonus_levels = EXCLUDED.intensity_bonus_levels,
             transition_warning_ms = EXCLUDED.transition_warning_ms`,
        [modeId, normalizeBoolean(heat.isEnabled), normalizeInteger(heat.minimumCorrectRounds, 0, { min: 0, max: 100000 }), normalizePercent(heat.activationChancePercent), normalizeInteger(heat.durationRounds, 0, { min: 0, max: 100000 }), normalizeInteger(heat.cooldownRounds, 0, { min: 0, max: 100000 }), normalizeInteger(heat.timerReductionMs, 0, { min: 0, max: 60000 }), normalizeInteger(heat.intensityBonusLevels, 0, { min: 0, max: 1000 }), normalizeInteger(heat.transitionWarningMs, 0, { min: 0, max: 60000 })]
      );
    }

    if (Array.isArray(payload.corruptionBands)) {
      await client.query(`DELETE FROM vervus_data.mode_corruption_bands WHERE mode_id = $1::uuid`, [modeId]);
      for (const band of normalizeConfigRows(payload.corruptionBands)) {
        await client.query(
          `INSERT INTO vervus_data.mode_corruption_bands (mode_id, combo_min, visual_effects, audio_effects, intensity_level)
           VALUES ($1::uuid, $2, $3::text[], $4::text[], $5)`,
          [modeId, normalizeInteger(band.comboMin, 0, { min: 0, max: 100000 }), normalizeTextArray(band.visualEffects), normalizeTextArray(band.audioEffects), normalizeInteger(band.intensityLevel, 1, { min: 1, max: 1000 })]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listModeConfigurations();
}


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

function normalizeAnalyticsWindowDays(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 30;
  return Math.max(1, Math.min(365, Math.round(numeric)));
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

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN && NODE_ENV === "production") {
    return res.status(503).json({ error: "ADMIN_TOKEN is required in production" });
  }

  const suppliedToken = String(req.headers["x-admin-token"] || "");
  if (ADMIN_TOKEN && suppliedToken !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

app.get("/healthz", (req, res) => {
  res.json({ ok: true, service: "vervus-admin-server" });
});

app.get("/api/admin/overview", requireAdmin, (req, res) => {
  res.json({
    service: "vervus-admin-server",
    environment: NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    checkedAt: new Date().toISOString(),
    notes: [
      "Admin server scaffold is running.",
      "Connect database-backed metrics and moderation tools here when ready."
    ]
  });
});



app.get("/api/admin/game-analytics", requireAdmin, async (req, res, next) => {
  try {
    const analytics = await getGameAnalytics({ days: req.query.days });
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/game-modes", requireAdmin, async (req, res, next) => {
  try {
    const modes = await listModeConfigurations();
    res.json({ modes });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/game-modes/:modeKey", requireAdmin, async (req, res, next) => {
  try {
    const modes = await saveModeConfiguration({ ...req.body, modeKey: req.params.modeKey });
    res.json({ modes });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/game-modes", requireAdmin, async (req, res, next) => {
  try {
    const modes = await saveModeConfiguration(req.body);
    res.status(201).json({ modes });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ error: error.message || "Admin server error" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Admin server listening on port ${PORT}`);
});
