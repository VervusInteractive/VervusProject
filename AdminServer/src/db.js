const { Pool } = require("pg");
const { config } = require("./config");

const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl: config.pgSslMode === "disable" ? false : { rejectUnauthorized: false }
    })
  : null;

function assertDatabaseConfigured() {
  if (!pool) {
    const error = new Error("DATABASE_URL is required for database-backed admin tools");
    error.statusCode = 503;
    throw error;
  }
}

async function tableExists(schemaName, tableName) {
  assertDatabaseConfigured();
  const { rows } = await pool.query("SELECT to_regclass($1) AS table_name", [`${schemaName}.${tableName}`]);
  return Boolean(rows[0]?.table_name);
}

async function columnExists(schemaName, tableName, columnName) {
  assertDatabaseConfigured();
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2
       AND column_name = $3
     LIMIT 1`,
    [schemaName, tableName, columnName]
  );
  return rows.length > 0;
}

module.exports = { pool, assertDatabaseConfigured, tableExists, columnExists };
