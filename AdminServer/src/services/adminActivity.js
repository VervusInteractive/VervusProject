const crypto = require("crypto");
const { pool, assertDatabaseConfigured } = require("../db");

function normalizeText(value, fallback = "") {
  return String(value || fallback).trim().slice(0, 255);
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 500);
}

function getTokenFingerprint(req) {
  const token = String(req.headers["x-admin-token"] || "");
  if (!token) return null;
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 24);
}

function getRequestIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwardedFor || req.ip || req.socket?.remoteAddress || null;
}

function getAdminActor(req) {
  const suppliedActor = normalizeText(req.headers["x-admin-actor"], "");
  return suppliedActor || "admin";
}

async function ensureAdminActivityLogTable() {
  assertDatabaseConfigured();
  await pool.query(`CREATE SCHEMA IF NOT EXISTS vervus_data;`);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,
    action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    outcome TEXT NOT NULL DEFAULT 'success',
    admin_actor TEXT NOT NULL DEFAULT 'admin',
    token_fingerprint TEXT NULL,
    ip_address TEXT NULL,
    user_agent TEXT NULL,
    method TEXT NULL,
    path TEXT NULL,
    target_type TEXT NULL,
    target_key TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action_at
    ON vervus_data.admin_activity_logs(action_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action_type_at
    ON vervus_data.admin_activity_logs(action_type, action_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_target_at
    ON vervus_data.admin_activity_logs(target_type, target_key, action_at DESC);`);
}

async function writeAdminActivityLog(req, {
  actionType,
  outcome = "success",
  targetType = null,
  targetKey = null,
  metadata = {}
}) {
  await ensureAdminActivityLogTable();
  const adminContext = req.adminContext || {};
  const normalizedActionType = normalizeText(actionType);
  if (!normalizedActionType) return null;

  const { rows } = await pool.query(
    `INSERT INTO vervus_data.admin_activity_logs (
       action_type, outcome, admin_actor, token_fingerprint, ip_address, user_agent,
       method, path, target_type, target_key, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     RETURNING id`,
    [
      normalizedActionType,
      normalizeText(outcome, "success") || "success",
      adminContext.actor || getAdminActor(req),
      adminContext.tokenFingerprint || getTokenFingerprint(req),
      getRequestIp(req),
      normalizeText(req.headers["user-agent"], "") || null,
      req.method,
      req.originalUrl || req.url,
      normalizeText(targetType, "") || null,
      normalizeText(targetKey, "") || null,
      JSON.stringify(metadata && typeof metadata === "object" ? metadata : {})
    ]
  );
  return rows[0]?.id || null;
}

async function listAdminActivityLogs({ limit, actionType, targetType, targetKey } = {}) {
  await ensureAdminActivityLogTable();
  const values = [];
  const clauses = [];

  if (actionType) {
    values.push(normalizeText(actionType));
    clauses.push(`action_type = $${values.length}`);
  }

  if (targetType) {
    values.push(normalizeText(targetType));
    clauses.push(`target_type = $${values.length}`);
  }

  if (targetKey) {
    values.push(`%${normalizeText(targetKey)}%`);
    clauses.push(`target_key ILIKE $${values.length}`);
  }

  values.push(normalizeLimit(limit));
  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT id, action_type, action_at, outcome, admin_actor, token_fingerprint,
            ip_address, user_agent, method, path, target_type, target_key, metadata
     FROM vervus_data.admin_activity_logs
     ${whereClause}
     ORDER BY action_at DESC
     LIMIT $${values.length}`,
    values
  );

  return {
    activity: rows.map((row) => ({
      id: row.id,
      actionType: row.action_type,
      actionAt: row.action_at,
      outcome: row.outcome,
      adminActor: row.admin_actor,
      tokenFingerprint: row.token_fingerprint,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      method: row.method,
      path: row.path,
      targetType: row.target_type,
      targetKey: row.target_key,
      metadata: row.metadata || {}
    }))
  };
}

module.exports = {
  ensureAdminActivityLogTable,
  getAdminActor,
  getTokenFingerprint,
  listAdminActivityLogs,
  writeAdminActivityLog
};
