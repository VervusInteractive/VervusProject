const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 1000;
const DEFAULT_MAX_RETRY_AFTER_MS = 60 * 60 * 1000;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getClientIp(reqOrSocket) {
  const headers = reqOrSocket?.headers || reqOrSocket?.handshake?.headers || {};
  const forwardedFor = String(headers["x-forwarded-for"] || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)[0];
  return forwardedFor || reqOrSocket?.ip || reqOrSocket?.handshake?.address || reqOrSocket?.conn?.remoteAddress || "unknown";
}

function createFixedWindowRateLimiter({
  windowMs,
  max,
  keyPrefix = "limit",
  cleanupIntervalMs = DEFAULT_CLEANUP_INTERVAL_MS,
  now = () => Date.now()
}) {
  const buckets = new Map();
  const effectiveWindowMs = parsePositiveInt(windowMs, 60 * 1000);
  const effectiveMax = parsePositiveInt(max, 60);

  const cleanup = () => {
    const currentTime = now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAtMs <= currentTime) {
        buckets.delete(key);
      }
    }
  };

  const cleanupTimer = setInterval(cleanup, cleanupIntervalMs);
  cleanupTimer.unref?.();

  const check = (keyParts = []) => {
    const currentTime = now();
    const key = [keyPrefix, ...keyParts]
      .map((part) => String(part || "unknown"))
      .join(":");
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAtMs <= currentTime) {
      bucket = { count: 0, resetAtMs: currentTime + effectiveWindowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, effectiveMax - bucket.count);
    const retryAfterMs = Math.min(Math.max(0, bucket.resetAtMs - currentTime), DEFAULT_MAX_RETRY_AFTER_MS);
    return {
      allowed: bucket.count <= effectiveMax,
      limit: effectiveMax,
      remaining,
      retryAfterMs,
      resetAtMs: bucket.resetAtMs
    };
  };

  const stop = () => clearInterval(cleanupTimer);

  return { check, stop, buckets };
}

function createHttpRateLimitMiddleware({
  windowMs,
  max,
  keyPrefix,
  keyGenerator = (req) => getClientIp(req),
  message = "Too many requests"
}) {
  const limiter = createFixedWindowRateLimiter({ windowMs, max, keyPrefix });

  const middleware = (req, res, next) => {
    const result = limiter.check([keyGenerator(req)]);
    res.setHeader("RateLimit-Limit", String(result.limit));
    res.setHeader("RateLimit-Remaining", String(result.remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(result.resetAtMs / 1000)));

    if (!result.allowed) {
      res.setHeader("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
      res.status(429).json({ error: message, code: "RATE_LIMITED", retryAfterMs: result.retryAfterMs });
      return;
    }

    next();
  };

  middleware.limiter = limiter;
  return middleware;
}

function createSocketRateLimitGuard({ windowMs, max, keyPrefix, keyGenerator }) {
  const limiter = createFixedWindowRateLimiter({ windowMs, max, keyPrefix });

  const guard = (...args) => limiter.check([keyGenerator(...args)]);
  guard.limiter = limiter;
  return guard;
}

module.exports = {
  createFixedWindowRateLimiter,
  createHttpRateLimitMiddleware,
  createSocketRateLimitGuard,
  getClientIp,
  parsePositiveInt
};
