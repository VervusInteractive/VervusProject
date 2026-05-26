const express = require("express");
const http = require("http");
const cors = require("cors");
const crypto = require("crypto");
const { Server } = require("socket.io");
const { registerSocketHandlers } = require("./socketHandlers");
const {
  testDbConnection,
  grantPlayerProfileEntitlement,
  upsertPlayerProfile,
  getProductByKey,
  createPendingPurchase,
  attachStripeSessionToPurchase,
  completePurchaseByStripeSession,
  markPurchaseFailedByStripeSession,
  getProductById
} = require("./db");
const { hydrateStandardModeFromDb, hydrateHeatSurgeConfigsFromDb, hydrateModeCorruptionBandsFromDb } = require("./gameModes");

const app = express();
app.use(cors());

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

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

    const [timestampPart, signaturePart] = signatureHeader.split(",");
    const timestamp = timestampPart?.split("=")[1];
    const stripeSignature = signaturePart?.split("=")[1];
    const payload = req.body.toString("utf8");
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
      .update(signedPayload, "utf8")
      .digest("hex");

    if (expectedSignature !== stripeSignature) {
      res.status(400).json({ error: "Invalid Stripe signature" });
      return;
    }

    const event = JSON.parse(payload);
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      const stripeCheckoutSessionId = session?.id;
      const stripePaymentIntentId = session?.payment_intent;
      const purchase = await completePurchaseByStripeSession({ stripeCheckoutSessionId, stripePaymentIntentId });

      if (purchase?.player_id && purchase?.product_id) {
        const product = await getProductById(purchase.product_id);
        await upsertPlayerProfile({ profileId: purchase.player_id, displayName: null });
        await grantPlayerProfileEntitlement({
          profileId: purchase.player_id,
          productKey: product?.product_key || "glitch_party_pack",
          hours: product?.validity_duration_hours || 24
        });
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data?.object;
      await markPurchaseFailedByStripeSession({ stripeCheckoutSessionId: session?.id });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to process Stripe webhook" });
  }
});

app.use(express.json());

app.post("/api/stripe/checkout-session", async (req, res) => {
  if (!STRIPE_SECRET_KEY) {
    res.status(500).json({ error: "STRIPE_SECRET_KEY is not configured" });
    return;
  }

  const { profileId, productKey = "glitch_party_pack" } = req.body ?? {};
  if (!profileId || !productKey) {
    res.status(400).json({ error: "Missing profileId or productKey" });
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
    res.status(500).json({ error: error.message || "Failed to create checkout session" });
  }
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;

testDbConnection()
  .then(async () => {
    console.log("PostgreSQL connected");

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
