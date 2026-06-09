const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3002;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "";
const NODE_ENV = process.env.NODE_ENV || "development";

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

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Admin server listening on port ${PORT}`);
});
