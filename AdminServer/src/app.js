const express = require("express");
const cors = require("cors");
const { config } = require("./config");
const { adminRoutes } = require("./routes/adminRoutes");

function createApp() {
  const app = express();
  const allowedOrigins = config.clientOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : config.nodeEnv !== "production",
    credentials: true
  }));

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  app.get("/healthz", (req, res) => {
    res.json({ ok: true, service: "vervus-admin-server" });
  });

  app.use("/api/admin", adminRoutes);

  app.use((error, req, res, next) => {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || "Admin server error" });
  });

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}

module.exports = { createApp };
