const express = require("express");
const http = require("http");
const cors = require("cors");
const crypto = require("crypto");
const { Server } = require("socket.io");
const { registerSocketHandlers } = require("./socketHandlers");
const {
  testDbConnection,
  upsertPlayerProfile,
  getActivePlayerProfileEntitlement,
  getActiveEntitledModeKeys,
  getActiveEntitlementExpiriesByMode,
  createPlayerProfileSession,
  getPlayerProfileIdBySessionToken,
  consumeEntitlementTransferToken,
  getProductByKey,
  createPendingPurchase,
  attachStripeSessionToPurchase,
  completePurchaseAndGrantEntitlementByStripeSession,
  recordStripeWebhookEvent,
  markStripeWebhookEventProcessed,
  markStripeWebhookEventFailed,
  getPurchaseStatusByStripeSession,
  getRecentErrorLogs,
  getRecentRoomHistory,
  getRecentStripeWebhookEvents,
  markPurchaseFailedByStripeSession,
  ensureRoomTrackingTables,
  logErrorEntry
} = require("./db");
const {
  hydrateGameModesFromDb,
  hydrateHeatSurgeConfigsFromDb,
  hydrateModeCorruptionBandsFromDb,
  getGameModesFromDb,
  getGameModesFallback
} = require("./gameModes");
const { ROOM_STATUSES, transitionRoomStatus } = require("./roomLifecycle");
const { rooms, getRoomState } = require("./roomStore");
const { createHttpRateLimitMiddleware, createSocketRateLimitGuard, getClientIp, parsePositiveInt } = require("./rateLimit");

const app = express();
const PROFILE_SESSION_COOKIE_NAME = "vervus_profile_session";
const PROFILE_SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const CLIENT_URL = process.env.CLIENT_URL;
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const HTTP_RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.HTTP_RATE_LIMIT_WINDOW_MS, 60 * 1000);
const HTTP_RATE_LIMIT_MAX = parsePositiveInt(process.env.HTTP_RATE_LIMIT_MAX, 240);
const HTTP_STRICT_RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.HTTP_STRICT_RATE_LIMIT_WINDOW_MS, 60 * 1000);
const HTTP_STRICT_RATE_LIMIT_MAX = parsePositiveInt(process.env.HTTP_STRICT_RATE_LIMIT_MAX, 30);
const STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_MS, 60 * 1000);
const STRIPE_WEBHOOK_RATE_LIMIT_MAX = parsePositiveInt(process.env.STRIPE_WEBHOOK_RATE_LIMIT_MAX, 120);
const SOCKET_CONNECTION_RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.SOCKET_CONNECTION_RATE_LIMIT_WINDOW_MS, 60 * 1000);
const SOCKET_CONNECTION_RATE_LIMIT_MAX = parsePositiveInt(process.env.SOCKET_CONNECTION_RATE_LIMIT_MAX, 30);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function createSecurityHeadersMiddleware({ allowedOrigins = [] } = {}) {
  const connectSources = ["'self'", ...allowedOrigins];
  const cspDirectives = [
    "default-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com",
    `connect-src ${connectSources.join(" ")}`
  ];

  if (IS_PRODUCTION) {
    cspDirectives.push("upgrade-insecure-requests");
  }

  const cspHeader = cspDirectives.join("; ");

  return (req, res, next) => {
    res.setHeader("Content-Security-Policy", cspHeader);
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

    if (IS_PRODUCTION) {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }

    next();
  };
}

function validateStartupEnvironment() {
  const required = ["DATABASE_URL", "CLIENT_URL"];
  const paymentConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  if (process.env.PAYMENTS_REQUIRED !== "false") {
    required.push("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET");
  }

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  if (process.env.NODE_ENV === "production" && CLIENT_URL.startsWith("http://localhost")) {
    throw new Error("CLIENT_URL must not point at localhost in production");
  }

  if (!paymentConfigured) {
    console.warn("Stripe payments are disabled because PAYMENTS_REQUIRED=false or Stripe configuration is incomplete.");
  }
}

validateStartupEnvironment();

app.disable("x-powered-by");
app.use(createSecurityHeadersMiddleware({ allowedOrigins: ALLOWED_ORIGINS }));

app.use(cors({
  origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
  methods: ["GET", "POST"],
  credentials: true
}));

const publicEndpointLimiter = createHttpRateLimitMiddleware({
  windowMs: HTTP_RATE_LIMIT_WINDOW_MS,
  max: HTTP_RATE_LIMIT_MAX,
  keyPrefix: "http:public",
  keyGenerator: (req) => `${getClientIp(req)}:${req.path}`,
  message: "Too many requests to this endpoint"
});

const strictPublicEndpointLimiter = createHttpRateLimitMiddleware({
  windowMs: HTTP_STRICT_RATE_LIMIT_WINDOW_MS,
  max: HTTP_STRICT_RATE_LIMIT_MAX,
  keyPrefix: "http:strict",
  keyGenerator: (req) => `${getClientIp(req)}:${req.path}`,
  message: "Too many requests to this endpoint"
});

const stripeWebhookLimiter = createHttpRateLimitMiddleware({
  windowMs: STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_MS,
  max: STRIPE_WEBHOOK_RATE_LIMIT_MAX,
  keyPrefix: "http:stripe-webhook",
  keyGenerator: getClientIp,
  message: "Too many Stripe webhook requests"
});


function parseCookies(cookieHeader = "") {
  return Object.fromEntries(String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...valueParts] = part.split("=");
      return [name, decodeURIComponent(valueParts.join("="))];
    }));
}

function buildProfileSessionCookie(token) {
  const attrs = [
    `${PROFILE_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${PROFILE_SESSION_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=None"
  ];
  if (process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE !== "false") {
    attrs.push("Secure");
  }
  return attrs.join("; ");
}

function getSessionTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const cookieToken = cookies[PROFILE_SESSION_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const authHeader = String(req.headers.authorization || "");
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) return bearerMatch[1].trim();

  const headerToken = String(req.headers["x-vervus-profile-session"] || "").trim();
  return headerToken || null;
}

async function getProfileIdFromRequest(req) {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  return getPlayerProfileIdBySessionToken({ token });
}

async function createSessionResponse({ res, profileId, displayName }) {
  await upsertPlayerProfile({ profileId, displayName });
  const session = await createPlayerProfileSession({ profileId });
  res.setHeader("Set-Cookie", buildProfileSessionCookie(session.token));
  const entitlementExpiry = await getActivePlayerProfileEntitlement({ profileId });
  const entitledModeKeys = await getActiveEntitledModeKeys({ profileId });
  const entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId });
  return {
    profileId,
    profileSessionToken: session.token,
    entitlementExpiresAtMs: entitlementExpiry ? new Date(entitlementExpiry).getTime() : null,
    entitledModeKeys,
    entitledModeExpiriesMs
  };
}

function getProfileSocketRoom(profileId) {
  return `profile:${profileId}`;
}

async function refreshPlayerEntitlementsInActiveRooms(profileId) {
  const entitlementExpiry = await getActivePlayerProfileEntitlement({ profileId });
  const entitledModeKeys = await getActiveEntitledModeKeys({ profileId });
  const entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId });
  const entitlementExpiresAtMs = entitlementExpiry ? new Date(entitlementExpiry).getTime() : null;

  for (const [roomId, room] of rooms.entries()) {
    const player = room.players.get(profileId);
    if (!player) continue;

    player.entitlementExpiresAtMs = entitlementExpiresAtMs;
    player.entitledModeKeys = entitledModeKeys;
    player.entitledModeExpiriesMs = entitledModeExpiriesMs;

    if (room.creatorPlayerId === profileId) {
      const selectedModeId = room.selectedModeId || "standard";
      room.expiresAtMs = entitledModeExpiriesMs[selectedModeId] || entitlementExpiresAtMs || room.expiresAtMs || null;
      if (room.hostUnlockingPending) {
        room.hostUnlockingPending = false;
        room.unlockingStartedAtMs = null;
        room.unlockingPreviousHasEntitlement = null;
        room.unlockingProductName = null;
      }
      if (room.game?.isPreview && entitlementExpiresAtMs) {
        room.game.isPreview = false;
        room.game.previewComboLimit = null;
        room.game.previewEndsAtMs = null;
        if (room.previewTimer) {
          clearTimeout(room.previewTimer);
          room.previewTimer = null;
        }
        room.expiresAtMs = entitledModeExpiriesMs[room.game.modeId] || entitlementExpiresAtMs;
      }
      if (entitlementExpiresAtMs && [ROOM_STATUSES.PAYMENT_PENDING, ROOM_STATUSES.PREVIEW].includes(room.status)) {
        transitionRoomStatus(room, roomId, ROOM_STATUSES.PREMIUM, {
          eventType: "settings_changed",
          metadata: { reason: "stripe_webhook_entitlement_granted" }
        });
      }
    }

    io.to(roomId).emit("room:state", getRoomState(roomId));
  }

  io.to(getProfileSocketRoom(profileId)).emit("entitlement:refresh", {
    entitlementExpiresAtMs,
    entitledModeKeys,
    entitledModeExpiriesMs
  });
}

function getRuntimeRoomSummary() {
  const statusCounts = {};
  let playerCount = 0;
  let connectedPlayerCount = 0;
  for (const room of rooms.values()) {
    const status = room.status || room.phase || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    for (const player of room.players.values()) {
      playerCount += 1;
      if (player.connected) connectedPlayerCount += 1;
    }
  }
  return {
    roomCount: rooms.size,
    playerCount,
    connectedPlayerCount,
    statusCounts
  };
}

function requireAdmin(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN || "";
  if (!adminToken && process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  const suppliedToken = String(req.headers["x-admin-token"] || "");
  if (adminToken && suppliedToken === adminToken) {
    next();
    return;
  }

  res.status(adminToken ? 401 : 503).json({ error: adminToken ? "Unauthorized" : "ADMIN_TOKEN is required in production" });
}

const stripeApiRequest = async (path, body) => {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(body)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Stripe request failed");
  }

  return data;
};

app.get("/", publicEndpointLimiter, (req, res) => {
  res.send("Vervus server running");
});

app.get("/healthz", publicEndpointLimiter, async (req, res) => {
  const startedAt = Date.now();
  try {
    await testDbConnection();
    res.status(200).json({
      ok: true,
      service: "vervus-server",
      uptimeSeconds: Math.round(process.uptime()),
      database: "ok",
      paymentsConfigured: Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET),
      runtime: getRuntimeRoomSummary(),
      checkedAtMs: Date.now(),
      latencyMs: Date.now() - startedAt
    });
  } catch (error) {
    logErrorEntry({ source: "healthz", message: error.message || "Health check failed", stackTrace: error.stack }).catch(() => {});
    res.status(503).json({ ok: false, database: "error", error: error.message || "Health check failed" });
  }
});

app.get("/api/admin/runtime", requireAdmin, async (req, res) => {
  res.status(200).json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    memory: process.memoryUsage(),
    runtime: getRuntimeRoomSummary(),
    rooms: Array.from(rooms.keys()).map((roomId) => getRoomState(roomId)).filter(Boolean)
  });
});

app.get("/api/admin/errors", requireAdmin, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 25;
    res.status(200).json({ ok: true, errors: await getRecentErrorLogs({ limit }) });
  } catch (error) {
    logErrorEntry({ source: "admin:errors", message: error.message || "Failed to read error logs", stackTrace: error.stack }).catch(() => {});
    res.status(500).json({ error: "Failed to read error logs" });
  }
});

app.get("/api/admin/room-history", requireAdmin, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    res.status(200).json({ ok: true, history: await getRecentRoomHistory({ limit }) });
  } catch (error) {
    logErrorEntry({ source: "admin:room-history", message: error.message || "Failed to read room history", stackTrace: error.stack }).catch(() => {});
    res.status(500).json({ error: "Failed to read room history" });
  }
});

app.get("/api/admin/stripe-webhooks", requireAdmin, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 25;
    res.status(200).json({ ok: true, webhooks: await getRecentStripeWebhookEvents({ limit }) });
  } catch (error) {
    logErrorEntry({ source: "admin:stripe-webhooks", message: error.message || "Failed to read Stripe webhook events", stackTrace: error.stack }).catch(() => {});
    res.status(500).json({ error: "Failed to read Stripe webhook events" });
  }
});

app.post("/api/stripe/webhook", stripeWebhookLimiter, express.raw({ type: "application/json" }), async (req, res) => {
  let eventId = null;
  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET is not configured" });
      return;
    }

    const signatureHeader = req.headers["stripe-signature"];
    if (!signatureHeader || typeof signatureHeader !== "string") {
      res.status(400).json({ error: "Missing Stripe signature" });
      return;
    }

    const signatureParts = Object.fromEntries(signatureHeader.split(",").map((part) => part.split("=", 2)));
    const timestamp = Number(signatureParts.t);
    const stripeSignature = signatureParts.v1;
    const payload = req.body.toString("utf8");
    const signedPayload = `${signatureParts.t}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
      .update(signedPayload, "utf8")
      .digest("hex");

    const timestampAgeSeconds = Number.isFinite(timestamp) ? Math.abs(Math.floor(Date.now() / 1000) - timestamp) : Infinity;
    const signatureMatches = timestampAgeSeconds <= 300
      && typeof stripeSignature === "string"
      && /^[a-f0-9]{64}$/i.test(stripeSignature)
      && crypto.timingSafeEqual(Buffer.from(expectedSignature, "hex"), Buffer.from(stripeSignature, "hex"));

    if (!signatureMatches) {
      res.status(400).json({ error: "Invalid Stripe signature" });
      return;
    }

    const event = JSON.parse(payload);
    eventId = typeof event.id === "string" ? event.id : null;
    if (!eventId) {
      res.status(400).json({ error: "Missing Stripe event id" });
      return;
    }

    const shouldProcess = await recordStripeWebhookEvent({ eventId, eventType: event.type || "unknown", payload: event });
    if (!shouldProcess) {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      const stripeCheckoutSessionId = session?.id;
      const stripePaymentIntentId = session?.payment_intent;
      const purchase = await completePurchaseAndGrantEntitlementByStripeSession({ stripeCheckoutSessionId, stripePaymentIntentId });
      if (purchase?.player_id) {
        await refreshPlayerEntitlementsInActiveRooms(purchase.player_id);
      }
    } else if (["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type)) {
      const session = event.data?.object;
      await markPurchaseFailedByStripeSession({ stripeCheckoutSessionId: session?.id });
    }

    await markStripeWebhookEventProcessed({ eventId });
    res.status(200).json({ received: true });
  } catch (error) {
    if (eventId) {
      markStripeWebhookEventFailed({ eventId, errorMessage: error.message }).catch(() => {});
    }
    logErrorEntry({ source: "stripe:webhook", message: error.message || "Failed to process Stripe webhook", stackTrace: error.stack }).catch(() => {});
    res.status(500).json({ error: "Failed to process Stripe webhook" });
  }
});

app.use(express.json({ limit: "32kb" }));

app.get("/api/game-modes", publicEndpointLimiter, async (req, res) => {
  try {
    const modes = await getGameModesFromDb();
    res.status(200).json({ modes });
  } catch (error) {
    logErrorEntry({ source: "game-modes:list", message: error.message || "Failed to load game modes", stackTrace: error.stack }).catch(() => {});
    res.status(500).json({ error: "Failed to load game modes", modes: getGameModesFallback() });
  }
});

app.post("/api/player-session", strictPublicEndpointLimiter, async (req, res) => {
  const { normalizePlayerName } = require("./validation");
  const displayName = normalizePlayerName(req.body?.name, "Player");
  try {
    const cookieProfileId = await getProfileIdFromRequest(req);
    const profileId = cookieProfileId || crypto.randomUUID();
    const payload = await createSessionResponse({ res, profileId, displayName });
    res.status(200).json(payload);
  } catch (error) {
    logErrorEntry({ source: "player-session", message: error.message || "Failed to establish player session", stackTrace: error.stack }).catch(() => {});
    res.status(500).json({ error: "Failed to establish player session" });
  }
});

app.post("/api/entitlement-transfer/claim", strictPublicEndpointLimiter, async (req, res) => {
  const { normalizePlayerName } = require("./validation");
  const token = String(req.body?.token || "").trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    res.status(400).json({ error: "Invalid or expired entitlement transfer link" });
    return;
  }

  const displayName = normalizePlayerName(req.body?.name, "Player");
  try {
    const cookieProfileId = await getProfileIdFromRequest(req);
    const targetProfileId = cookieProfileId || crypto.randomUUID();
    const claimed = await consumeEntitlementTransferToken({ token, targetProfileId, displayName });
    if (!claimed) {
      res.status(400).json({ error: "Invalid, expired, or already-used entitlement transfer link" });
      return;
    }

    io.to(getProfileSocketRoom(claimed.sourceProfileId)).emit("entitlement:transfer:completed", {
      message: "Your entitlement was transferred to another device. Refreshing entitlements…"
    });

    for (const [candidateRoomId, candidateRoom] of rooms.entries()) {
      const sourcePlayer = candidateRoom.players.get(claimed.sourceProfileId);
      if (!sourcePlayer) continue;
      sourcePlayer.entitlementExpiresAtMs = null;
      sourcePlayer.entitledModeKeys = [];
      sourcePlayer.entitledModeExpiriesMs = {};
      if (candidateRoom.creatorPlayerId === claimed.sourceProfileId && candidateRoom.phase === "lobby") {
        candidateRoom.selectedModeId = "standard";
      }
      io.to(candidateRoomId).emit("room:state", getRoomState(candidateRoomId));
    }

    const payload = await createSessionResponse({ res, profileId: targetProfileId, displayName });
    res.status(200).json(payload);
  } catch (error) {
    logErrorEntry({ source: "entitlement-transfer:claim", message: error.message || "Failed to claim entitlement transfer", stackTrace: error.stack }).catch(() => {});
    res.status(500).json({ error: "Failed to claim entitlement transfer link" });
  }
});

app.post("/api/stripe/checkout-session", strictPublicEndpointLimiter, async (req, res) => {
  if (!STRIPE_SECRET_KEY) {
    res.status(500).json({ error: "STRIPE_SECRET_KEY is not configured" });
    return;
  }

  const { normalizeProductKey, normalizeRoomCode } = require("./validation");
  const productKey = normalizeProductKey(req.body?.productKey);
  const roomId = normalizeRoomCode(req.body?.roomId);
  const profileId = await getProfileIdFromRequest(req);
  if (!profileId || !productKey) {
    res.status(400).json({ error: "Missing session or productKey" });
    return;
  }

  try {
    const product = await getProductByKey(productKey);
    if (!product) {
      res.status(404).json({ error: "Product not found or inactive" });
      return;
    }

    const purchaseId = await createPendingPurchase({
      playerId: profileId,
      productId: product.id,
      amountCents: product.price_cents,
      currencyCode: product.currency_code
    });

    const session = await stripeApiRequest("/v1/checkout/sessions", {
      mode: "payment",
      success_url: `${CLIENT_URL}?purchase=success&purchaseSessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}?purchase=cancelled&purchaseSessionId={CHECKOUT_SESSION_ID}`,
      "line_items[0][price_data][currency]": product.currency_code.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(product.price_cents),
      "line_items[0][price_data][product_data][name]": product.product_name,
      "line_items[0][quantity]": "1",
      "metadata[profileId]": profileId,
      "metadata[purchaseId]": purchaseId,
      "metadata[productKey]": product.product_key,
      "metadata[roomId]": roomId || ""
    });
    await attachStripeSessionToPurchase({ purchaseId, stripeCheckoutSessionId: session.id });

    res.status(200).json({ url: session.url, stripeCheckoutSessionId: session.id, purchaseId });
  } catch (error) {
    logErrorEntry({ source: "stripe:checkout-session", playerId: profileId, message: error.message || "Failed to create checkout session", stackTrace: error.stack, context: { productKey } }).catch(() => {});
    res.status(500).json({ error: error.message || "Failed to create checkout session" });
  }
});

app.get("/api/stripe/purchase-status", strictPublicEndpointLimiter, async (req, res) => {
  const stripeCheckoutSessionId = String(req.query.sessionId || "").trim();
  const profileId = await getProfileIdFromRequest(req);
  if (!profileId || !/^cs_(test|live)_[A-Za-z0-9_]+$/.test(stripeCheckoutSessionId)) {
    res.status(400).json({ error: "Missing session or invalid checkout session id" });
    return;
  }

  try {
    const purchase = await getPurchaseStatusByStripeSession({ stripeCheckoutSessionId, playerId: profileId });
    if (!purchase) {
      res.status(404).json({ error: "Purchase not found" });
      return;
    }

    const entitlementExpiry = await getActivePlayerProfileEntitlement({ profileId });
    const entitledModeKeys = await getActiveEntitledModeKeys({ profileId });
    const entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId });
    res.status(200).json({
      ok: true,
      paymentStatus: purchase.payment_status,
      productKey: purchase.product_key,
      productName: purchase.product_name,
      paidAtMs: purchase.paid_at ? new Date(purchase.paid_at).getTime() : null,
      failedAtMs: purchase.failed_at ? new Date(purchase.failed_at).getTime() : null,
      entitlementGrantedAtMs: purchase.entitlement_granted_at ? new Date(purchase.entitlement_granted_at).getTime() : null,
      entitlementExpiresAtMs: entitlementExpiry ? new Date(entitlementExpiry).getTime() : null,
      entitledModeKeys,
      entitledModeExpiriesMs
    });
  } catch (error) {
    logErrorEntry({ source: "stripe:purchase-status", playerId: profileId, message: error.message || "Failed to read purchase status", stackTrace: error.stack, context: { stripeCheckoutSessionId } }).catch(() => {});
    res.status(500).json({ error: "Failed to read purchase status" });
  }
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
    methods: ["GET", "POST"],
    credentials: true
  },
  pingInterval: Number(process.env.SOCKET_PING_INTERVAL_MS) || 25000,
  pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT_MS) || 30000,
  connectionStateRecovery: {
    maxDisconnectionDuration: Number(process.env.SOCKET_STATE_RECOVERY_MS) || 120000,
    skipMiddlewares: false
  }
});


const socketConnectionLimiter = createSocketRateLimitGuard({
  windowMs: SOCKET_CONNECTION_RATE_LIMIT_WINDOW_MS,
  max: SOCKET_CONNECTION_RATE_LIMIT_MAX,
  keyPrefix: "socket:connection",
  keyGenerator: (socket) => getClientIp(socket)
});

io.use((socket, next) => {
  const limit = socketConnectionLimiter(socket);
  if (!limit.allowed) {
    const error = new Error("Too many socket connection attempts");
    error.data = { code: "RATE_LIMITED", retryAfterMs: limit.retryAfterMs };
    next(error);
    return;
  }
  next();
});

io.use(async (socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie || "");
    const cookieToken = cookies[PROFILE_SESSION_COOKIE_NAME];
    const authToken = typeof socket.handshake.auth?.profileSessionToken === "string" ? socket.handshake.auth.profileSessionToken.trim() : "";
    const token = cookieToken || authToken;
    socket.data.profileId = token ? await getPlayerProfileIdBySessionToken({ token }) : null;
    next();
  } catch (error) {
    next(error);
  }
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;

testDbConnection()
  .then(async () => {
    console.log("PostgreSQL connected");
    await ensureRoomTrackingTables();

    try {
      const loaded = await hydrateGameModesFromDb();
      console.log(loaded
        ? "Loaded GLiTCH! mode tuning from DB"
        : "GLiTCH! mode tuning not found in DB, using defaults");
      await hydrateHeatSurgeConfigsFromDb();
      await hydrateModeCorruptionBandsFromDb();
    } catch (error) {
      console.warn("Failed to hydrate GLiTCH! mode tuning, using defaults", error.message);
    }

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to PostgreSQL", error);
    process.exit(1);
  });
