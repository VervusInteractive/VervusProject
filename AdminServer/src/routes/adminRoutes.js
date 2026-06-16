const express = require("express");
const { config } = require("../config");
const { requireAdmin } = require("../middleware/requireAdmin");
const { getAdminAnalyticsSection } = require("../services/adminAnalytics");
const { getGameAnalytics } = require("../services/gameAnalytics");
const { getLiveRooms, getRoomHistory } = require("../services/liveRooms");
const { listModeConfigurations, saveModeConfiguration } = require("../services/modeConfigurations");
const { listProducts, saveProduct } = require("../services/products");

const router = express.Router();

router.get("/overview", requireAdmin, (req, res) => {
  res.json({
    service: "vervus-admin-server",
    environment: config.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    checkedAt: new Date().toISOString(),
    notes: [
      "Admin server scaffold is running.",
      "Connect database-backed metrics and moderation tools here when ready."
    ]
  });
});

router.get("/game-analytics", requireAdmin, async (req, res, next) => {
  try {
    const analytics = await getGameAnalytics({ days: req.query.days });
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/:sectionId", requireAdmin, async (req, res, next) => {
  try {
    const analytics = await getAdminAnalyticsSection(req.params.sectionId, req.query);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

router.get("/live-rooms", requireAdmin, async (req, res, next) => {
  try {
    const liveRooms = await getLiveRooms();
    res.json(liveRooms);
  } catch (error) {
    next(error);
  }
});

router.get("/room-history", requireAdmin, async (req, res, next) => {
  try {
    const history = await getRoomHistory({
      limit: req.query.limit,
      roomCode: req.query.roomCode,
      eventType: req.query.eventType
    });
    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.get("/game-modes", requireAdmin, async (req, res, next) => {
  try {
    const modes = await listModeConfigurations();
    res.json({ modes });
  } catch (error) {
    next(error);
  }
});

router.put("/game-modes/:modeKey", requireAdmin, async (req, res, next) => {
  try {
    const modes = await saveModeConfiguration({ ...req.body, modeKey: req.params.modeKey });
    res.json({ modes });
  } catch (error) {
    next(error);
  }
});

router.post("/game-modes", requireAdmin, async (req, res, next) => {
  try {
    const modes = await saveModeConfiguration(req.body);
    res.status(201).json({ modes });
  } catch (error) {
    next(error);
  }
});

router.get("/products", requireAdmin, async (req, res, next) => {
  try {
    res.json(await listProducts());
  } catch (error) {
    next(error);
  }
});

router.put("/products/:productKey", requireAdmin, async (req, res, next) => {
  try {
    res.json(await saveProduct({ ...req.body, productKey: req.params.productKey }));
  } catch (error) {
    next(error);
  }
});

router.post("/products", requireAdmin, async (req, res, next) => {
  try {
    const products = await saveProduct(req.body);
    res.status(201).json(products);
  } catch (error) {
    next(error);
  }
});

module.exports = { adminRoutes: router };
