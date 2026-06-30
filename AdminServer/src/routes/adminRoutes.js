const express = require("express");
const { config } = require("../config");
const { requireAdmin } = require("../middleware/requireAdmin");
const { listAdminActivityLogs, writeAdminActivityLog } = require("../services/adminActivity");
const { getAdminAnalyticsSection } = require("../services/adminAnalytics");
const { listContactMessages } = require("../services/contactMessages");
const { getGameAnalytics } = require("../services/gameAnalytics");
const { getLiveRooms, getRoomHistory } = require("../services/liveRooms");
const { resolveErrorLogs } = require("../services/errorLogs");
const { listModeConfigurations, saveModeConfiguration } = require("../services/modeConfigurations");
const { listProducts, saveProduct } = require("../services/products");

const router = express.Router();

function buildOverviewPayload() {
  return {
    service: "vervus-admin-server",
    environment: config.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    checkedAt: new Date().toISOString(),
    notes: [
      "Admin server scaffold is running.",
      "Connect database-backed metrics and moderation tools here when ready."
    ]
  };
}

function summarizeModePayload(payload = {}) {
  return {
    displayName: payload.displayName,
    isEnabled: payload.isEnabled,
    hasLastChance: payload.hasLastChance,
    orientationLock: payload.orientationLock,
    difficultyBandCount: Array.isArray(payload.difficultyBands) ? payload.difficultyBands.length : undefined,
    corruptionBandCount: Array.isArray(payload.corruptionBands) ? payload.corruptionBands.length : undefined,
    heatSurgeConfigured: Boolean(payload.heatSurgeConfig)
  };
}

function summarizeProductPayload(payload = {}) {
  return {
    productName: payload.productName,
    priceCents: payload.priceCents,
    currencyCode: payload.currencyCode,
    validityDurationHours: payload.validityDurationHours,
    status: payload.status,
    displayOrder: payload.displayOrder,
    modeKeys: Array.isArray(payload.modeKeys) ? payload.modeKeys : []
  };
}

router.post("/login", requireAdmin, async (req, res, next) => {
  try {
    await writeAdminActivityLog(req, {
      actionType: "admin_login",
      targetType: "session",
      metadata: { environment: config.nodeEnv }
    });
    res.json(buildOverviewPayload());
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAdmin, async (req, res, next) => {
  try {
    await writeAdminActivityLog(req, {
      actionType: "admin_logout",
      targetType: "session",
      metadata: { environment: config.nodeEnv }
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/overview", requireAdmin, (req, res) => {
  res.json(buildOverviewPayload());
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

router.patch("/errors/resolve", requireAdmin, async (req, res, next) => {
  try {
    const result = await resolveErrorLogs(req.body?.ids);
    await writeAdminActivityLog(req, {
      actionType: "errors_resolved",
      targetType: "error_log",
      targetKey: result.resolvedIds[0] || null,
      metadata: {
        requestedCount: result.requestedCount,
        resolvedCount: result.resolvedCount,
        errorIds: result.resolvedIds
      }
    });
    res.json(result);
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

router.get("/contact-messages", requireAdmin, async (req, res, next) => {
  try {
    const messages = await listContactMessages({
      limit: req.query.limit,
      search: req.query.search,
      unreadOnly: req.query.unreadOnly
    });
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

router.get("/admin-activity", requireAdmin, async (req, res, next) => {
  try {
    const activity = await listAdminActivityLogs({
      limit: req.query.limit,
      actionType: req.query.actionType,
      targetType: req.query.targetType,
      targetKey: req.query.targetKey
    });
    res.json(activity);
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
    await writeAdminActivityLog(req, {
      actionType: "game_mode_updated",
      targetType: "game_mode",
      targetKey: req.params.modeKey,
      metadata: summarizeModePayload({ ...req.body, modeKey: req.params.modeKey })
    });
    res.json({ modes });
  } catch (error) {
    next(error);
  }
});

router.post("/game-modes", requireAdmin, async (req, res, next) => {
  try {
    const modes = await saveModeConfiguration(req.body);
    await writeAdminActivityLog(req, {
      actionType: "game_mode_created",
      targetType: "game_mode",
      targetKey: req.body?.modeKey,
      metadata: summarizeModePayload(req.body)
    });
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
    const products = await saveProduct({ ...req.body, productKey: req.params.productKey });
    await writeAdminActivityLog(req, {
      actionType: "product_updated",
      targetType: "product",
      targetKey: req.params.productKey,
      metadata: summarizeProductPayload({ ...req.body, productKey: req.params.productKey })
    });
    res.json(products);
  } catch (error) {
    next(error);
  }
});

router.post("/products", requireAdmin, async (req, res, next) => {
  try {
    const products = await saveProduct(req.body);
    await writeAdminActivityLog(req, {
      actionType: "product_created",
      targetType: "product",
      targetKey: req.body?.productKey,
      metadata: summarizeProductPayload(req.body)
    });
    res.status(201).json(products);
  } catch (error) {
    next(error);
  }
});

module.exports = { adminRoutes: router };
