function normalizeLimit(value, fallback = 50, max = 200) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.round(numeric)));
}

function normalizeOptionalText(value, maxLength = 100) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, maxLength) : "";
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return Boolean(value);
}

function normalizeInteger(value, fallback, { min = 0, max = 60000 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function normalizeModeKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeOrientationLock(value = "both") {
  const normalized = String(value || "both").trim().toLowerCase();
  return ["portrait", "landscape", "both"].includes(normalized) ? normalized : "both";
}

function normalizeTextArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizePercent(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, numeric));
}

function normalizeConfigRows(value) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : [];
}

function normalizeProductKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeCurrencyCode(value = "USD") {
  const normalized = String(value || "USD").trim().toUpperCase().replace(/[^A-Z]/g, "");
  return normalized.length === 3 ? normalized : "USD";
}

function normalizeProductStatus(value = "active") {
  const normalized = String(value || "active").trim().toLowerCase();
  return ["active", "inactive", "archived"].includes(normalized) ? normalized : "active";
}

function normalizeAnalyticsWindowDays(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 30;
  return Math.max(1, Math.min(365, Math.round(numeric)));
}

module.exports = {
  normalizeLimit,
  normalizeOptionalText,
  normalizeBoolean,
  normalizeInteger,
  normalizeModeKey,
  normalizeOrientationLock,
  normalizeTextArray,
  normalizePercent,
  normalizeConfigRows,
  normalizeProductKey,
  normalizeCurrencyCode,
  normalizeProductStatus,
  normalizeAnalyticsWindowDays
};
