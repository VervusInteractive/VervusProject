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
  markPurchaseFailedByStripeSession,
  ensureRoomTrackingTables,
  logErrorEntry
} = require("./db");
const { hydrateStandardModeFromDb, hydrateHeatSurgeConfigsFromDb, hydrateModeCorruptionBandsFromDb } = require("./gameModes");
const { rooms, getRoomState } = require("./roomStore");

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

app.use(cors({
  origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
  methods: ["GET", "POST"],
  credentials: true
}));


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

app.get("/", (req, res) => {
  res.send("Milestone 1 server running");
});

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
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
    const timestamp = signatureParts.t;
    const stripeSignature = signatureParts.v1;
    const payload = req.body.toString("utf8");
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
      .update(signedPayload, "utf8")
      .digest("hex");

    const signatureMatches = typeof stripeSignature === "string"
      && /^[a-f0-9]{64}$/i.test(stripeSignature)
      && crypto.timingSafeEqual(Buffer.from(expectedSignature, "hex"), Buffer.from(stripeSignature, "hex"));

    if (!signatureMatches) {
      res.status(400).json({ error: "Invalid Stripe signature" });
      return;
    }

    const event = JSON.parse(payload);
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      const stripeCheckoutSessionId = session?.id;
      const stripePaymentIntentId = session?.payment_intent;
      await completePurchaseAndGrantEntitlementByStripeSession({ stripeCheckoutSessionId, stripePaymentIntentId });
    } else if (event.type === "checkout.session.expired") {
      const session = event.data?.object;
      await markPurchaseFailedByStripeSession({ stripeCheckoutSessionId: session?.id });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logErrorEntry({ source: "stripe:webhook", message: error.message || "Failed to process Stripe webhook", stackTrace: error.stack }).catch(() => {});
    res.status(500).json({ error: "Failed to process Stripe webhook" });
  }
});

app.use(express.json({ limit: "32kb" }));

app.post("/api/player-session", async (req, res) => {
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

app.post("/api/entitlement-transfer/claim", async (req, res) => {
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

app.post("/api/stripe/checkout-session", async (req, res) => {
  if (!STRIPE_SECRET_KEY) {
    res.status(500).json({ error: "STRIPE_SECRET_KEY is not configured" });
    return;
  }

  const { normalizeProductKey } = require("./validation");
  const productKey = normalizeProductKey(req.body?.productKey);
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
      success_url: `${CLIENT_URL}?purchase=success`,
      cancel_url: `${CLIENT_URL}?purchase=cancelled`,
      "line_items[0][price_data][currency]": product.currency_code.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(product.price_cents),
      "line_items[0][price_data][product_data][name]": product.product_name,
      "line_items[0][quantity]": "1",
      "metadata[profileId]": profileId,
      "metadata[purchaseId]": purchaseId,
      "metadata[productKey]": product.product_key
    });
    await attachStripeSessionToPurchase({ purchaseId, stripeCheckoutSessionId: session.id });

    res.status(200).json({ url: session.url });
  } catch (error) {
    logErrorEntry({ source: "stripe:checkout-session", playerId: profileId, message: error.message || "Failed to create checkout session", stackTrace: error.stack, context: { productKey } }).catch(() => {});
    res.status(500).json({ error: error.message || "Failed to create checkout session" });
  }
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
    methods: ["GET", "POST"],
    credentials: true
  }
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

const getProfileSocketRoom = (profileId) => `profile:${profileId}`;

registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;

testDbConnection()
  .then(async () => {
    console.log("PostgreSQL connected");
    await ensureRoomTrackingTables();

    try {
      const loaded = await hydrateStandardModeFromDb();
      console.log(loaded
        ? "Loaded standard GLiTCH! mode tuning from DB"
        : "Standard GLiTCH! mode tuning not found in DB, using defaults");
      await hydrateHeatSurgeConfigsFromDb();
      await hydrateModeCorruptionBandsFromDb();
    } catch (error) {
      console.warn("Failed to hydrate standard GLiTCH! mode tuning, using defaults", error.message);
    }

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to PostgreSQL", error);
    process.exit(1);
  });
