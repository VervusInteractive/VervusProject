const { config } = require("../config");
const { getAdminActor, getTokenFingerprint } = require("../services/adminActivity");

function requireAdmin(req, res, next) {
  if (!config.adminToken && config.nodeEnv === "production") {
    return res.status(503).json({ error: "ADMIN_TOKEN is required in production" });
  }

  const suppliedToken = String(req.headers["x-admin-token"] || "");
  if (config.adminToken && suppliedToken !== config.adminToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.adminContext = {
    actor: getAdminActor(req),
    tokenFingerprint: getTokenFingerprint(req)
  };

  return next();
}

module.exports = { requireAdmin };
