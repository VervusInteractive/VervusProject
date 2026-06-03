const ROOM_CODE_PATTERN = /^[A-Z2-9]{4,8}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_KEY_PATTERN = /^[a-z0-9_:-]{1,64}$/;
const ANSWERS = new Set(["sync", "glitch"]);
const PLAYER_NAME_MAX_LENGTH = 24;

function normalizeRoomCode(value) {
  return String(value || "").trim().toUpperCase();
}

function isValidRoomCode(value) {
  return ROOM_CODE_PATTERN.test(normalizeRoomCode(value));
}

function normalizePlayerName(value, fallback = "Player") {
  const normalized = String(value || "").trim().replace(/\s+/g, " ").slice(0, PLAYER_NAME_MAX_LENGTH);
  return normalized || fallback;
}

function isValidUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function normalizeUuid(value) {
  return isValidUuid(value) ? value : null;
}

function normalizeProductKey(value, fallback = "glitch_party_pack") {
  const normalized = String(value || fallback).trim().toLowerCase();
  return PRODUCT_KEY_PATTERN.test(normalized) ? normalized : null;
}

function normalizeAnswer(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ANSWERS.has(normalized) ? normalized : null;
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizePingMs(value) {
  const normalizedPingMs = Math.round(Number(value));
  if (!Number.isFinite(normalizedPingMs) || normalizedPingMs < 0 || normalizedPingMs > 60000) return null;
  return normalizedPingMs;
}

module.exports = {
  normalizeAnswer,
  normalizeBoolean,
  normalizePlayerName,
  normalizeProductKey,
  normalizePingMs,
  normalizeRoomCode,
  normalizeUuid,
  isValidRoomCode,
  isValidUuid
};
