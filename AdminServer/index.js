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
  return ["portrait", "landscape", "both"].includes(value) ? value : "both";
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
  return rows.map((row) => ({
    id: row.id,
    modeKey: row.mode_key,
    displayName: row.display_name,
    isEnabled: Boolean(row.is_enabled),
    hasLastChance: Boolean(row.has_last_chance),
    resultLockMs: Number(row.result_lock_ms) || 500,
    transitionBeatMs: Number(row.transition_beat_ms) || 300,
    goodRunRound: Number(row.good_run_round) || 50,
    orientationLock: row.orientation_lock || "both",
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
      [rows[0].id, hasLastChance, resultLockMs, transitionBeatMs, goodRunRound, orientationLock]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listModeConfigurations();
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
