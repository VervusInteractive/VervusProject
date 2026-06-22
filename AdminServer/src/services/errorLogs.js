const { pool } = require("../db");
const { ensureOperationalTables } = require("./adminSchema");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeErrorIds(ids) {
  if (!Array.isArray(ids)) {
    const error = new Error("ids must be an array of error log IDs");
    error.statusCode = 400;
    throw error;
  }

  const normalizedIds = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!normalizedIds.length) {
    const error = new Error("Select at least one error to resolve");
    error.statusCode = 400;
    throw error;
  }
  if (normalizedIds.length > 500) {
    const error = new Error("A maximum of 500 errors can be resolved at once");
    error.statusCode = 400;
    throw error;
  }
  if (normalizedIds.some((id) => !UUID_PATTERN.test(id))) {
    const error = new Error("One or more error log IDs are invalid");
    error.statusCode = 400;
    throw error;
  }

  return normalizedIds;
}

async function resolveErrorLogs(ids) {
  await ensureOperationalTables();
  const normalizedIds = normalizeErrorIds(ids);
  const { rows } = await pool.query(
    `UPDATE vervus_data.error_logs
     SET resolved_at = now()
     WHERE id = ANY($1::uuid[])
       AND resolved_at IS NULL
     RETURNING id, resolved_at`,
    [normalizedIds]
  );

  return {
    requestedCount: normalizedIds.length,
    resolvedCount: rows.length,
    resolvedIds: rows.map((row) => row.id),
    resolvedAt: rows[0]?.resolved_at || null
  };
}

module.exports = { normalizeErrorIds, resolveErrorLogs };
