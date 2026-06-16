const env = process.env;

const config = {
  port: env.PORT || 3002,
  adminToken: env.ADMIN_TOKEN || "",
  clientOrigin: env.CLIENT_ORIGIN || "",
  nodeEnv: env.NODE_ENV || "development",
  databaseUrl: env.DATABASE_URL || "",
  pgSslMode: env.PGSSLMODE || "",
  gameServerAdminUrl: env.GAME_SERVER_ADMIN_URL || "",
  gameServerAdminToken: env.GAME_SERVER_ADMIN_TOKEN || env.ADMIN_TOKEN || ""
};

module.exports = { config };
