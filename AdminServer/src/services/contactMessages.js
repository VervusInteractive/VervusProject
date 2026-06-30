const { pool } = require("../db");
const { normalizeBoolean, normalizeLimit, normalizeOptionalText } = require("../utils/normalizers");
const { ensureContactMessageTables } = require("./adminSchema");

async function listContactMessages({ limit = 50, search = "", unreadOnly = false } = {}) {
  await ensureContactMessageTables();

  const safeLimit = normalizeLimit(limit, 50, 200);
  const normalizedSearch = normalizeOptionalText(search, 160);
  const onlyUnread = normalizeBoolean(unreadOnly);
  const params = [];
  const filters = [];

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    filters.push(`(email ILIKE $${params.length} OR subject ILIKE $${params.length} OR message ILIKE $${params.length})`);
  }

  if (onlyUnread) {
    filters.push("read_at IS NULL");
  }

  params.push(safeLimit);
  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT id,
            email,
            subject,
            message,
            source,
            user_agent,
            ip_address,
            metadata,
            created_at,
            read_at
     FROM vervus_data.contact_messages
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );

  return {
    generatedAt: new Date().toISOString(),
    messages: rows.map((row) => ({
      id: row.id,
      email: row.email,
      subject: row.subject,
      message: row.message,
      source: row.source,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      readAt: row.read_at
    }))
  };
}

module.exports = { listContactMessages };
