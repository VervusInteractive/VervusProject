const { config } = require("../config");

function requireAdmin(req, res, next) {
  if (!config.adminToken && config.nodeEnv === "production") {
    return res.status(503).json({ error: "ADMIN_TOKEN is required in production" });
  }

  const suppliedToken = String(req.headers["x-admin-token"] || "");
  if (config.adminToken && suppliedToken !== config.adminToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

module.exports = { requireAdmin };
