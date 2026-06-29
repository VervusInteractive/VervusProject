const crypto = require("crypto");

const rooms = new Map();
const CREATOR_RECONNECT_GRACE_MS = 3 * 60 * 1000;
const CREATOR_UNLOCK_RECONNECT_GRACE_MS = 10 * 60 * 1000;
const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
const MIN_PLAYERS_PER_ROOM = 2;
const MAX_PLAYERS_PER_ROOM = 4;
const { getModeDebugConfig } = require("./gameModes");
const { CONNECTION_STATE_LABELS, getRoomConnectionState, normalizeConnectionState } = require("./connectionState");
const CREATOR_TIMEOUT_NOTICE_TTL_MS = 10 * 60 * 1000;
const creatorTimeoutNotices = new Map();
const ROOM_EXPIRED_NOTICE_TTL_MS = 10 * 60 * 1000;
const expiredRoomNotices = new Map();
const MODE_DEBUG_ENABLED = process.env.MODE_DEBUG_ENABLED === "true";

function markCreatorTimedOut(sessionToken) {
  if (!sessionToken) return;

  creatorTimeoutNotices.set(sessionToken, Date.now() + CREATOR_TIMEOUT_NOTICE_TTL_MS);
}

function consumeCreatorTimeoutNotice(sessionToken) {
  if (!sessionToken) return false;

  const expiresAt = creatorTimeoutNotices.get(sessionToken);
  if (!expiresAt) return false;

  creatorTimeoutNotices.delete(sessionToken);
  return expiresAt > Date.now();
}

function markRoomExpired(roomId) {
  if (!roomId) return;

  expiredRoomNotices.set(String(roomId).toUpperCase(), Date.now() + ROOM_EXPIRED_NOTICE_TTL_MS);
}

function hasExpiredRoomNotice(roomId) {
  if (!roomId) return false;

  const normalizedRoomId = String(roomId).toUpperCase();
  const expiresAt = expiredRoomNotices.get(normalizedRoomId);
  if (!expiresAt) return false;

  if (expiresAt <= Date.now()) {
    expiredRoomNotices.delete(normalizedRoomId);
    return false;
  }

  return true;
}

function getAvailableColor(room) {
  const usedColors = new Set(
    Array.from(room.players.values())
      .map((player) => player.color)
      .filter(Boolean)
  );

  return PLAYER_COLORS.find((color) => !usedColors.has(color)) ?? PLAYER_COLORS[0];
}

function getSpawnPosition(index) {
  const presets = [
    { x: 20, y: 20 },
    { x: 80, y: 20 },
    { x: 20, y: 80 },
    { x: 80, y: 80 }
  ];

  return presets[index] ?? { x: 50, y: 50 };
}

function getSafeGameState(room, viewerPlayerId) {
  const game = room.game;
  if (!game) return null;

  const currentRound = game.currentRound
    ? {
      id: game.currentRound.id,
      roundNumber: game.currentRound.roundNumber,
      timerMs: game.currentRound.timerMs,
      startedAtMs: game.currentRound.startedAtMs,
      decisionDeadlineMs: game.currentRound.decisionDeadlineMs,
      expectedAnswer: game.status === "gameover" ? game.currentRound.expectedAnswer : null,
      deviationLabel: game.status === "gameover" ? game.currentRound.deviationLabel : null,
      yourStimulus: game.currentRound.playerStimuli[viewerPlayerId] ?? null,
      answersLocked: Object.keys(game.currentRound.playerAnswers).length,
      answeredPlayerIds: Object.keys(game.currentRound.playerAnswers),
      isLastChanceReplay: game.currentRound.isLastChanceReplay,
      heatSurgeActive: Boolean(game.currentRound.heatSurgeActive),
      heatSurgeIntensityBonusLevels: game.currentRound.heatSurgeIntensityBonusLevels ?? 0,
      heatSurgeTransitionWarningMs: game.currentRound.heatSurgeTransitionWarningMs ?? 0,
      corruptionEffects: game.currentRound.corruptionEffects ?? null
    }
    : null;

  return {
    modeId: game.modeId,
    status: game.status,
    combo: game.combo,
    score: game.score,
    roundNumber: game.roundNumber,
    usedLastChance: game.usedLastChance,
    currentRound,
    lastRoundResult: game.lastRoundResult,
    killScreen: game.killScreen,
    startedAtMs: game.startedAtMs,
    reconnectCountdownStartedAtMs: game.reconnectCountdownStartedAtMs ?? null,
    isPreview: Boolean(game.isPreview),
    previewEndsAtMs: game.previewEndsAtMs ?? null,
    previewComboLimit: game.previewComboLimit ?? null
  };
}

function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  return {
    roomId: room.id,
    phase: room.phase,
    status: room.status || room.phase,
    statusChangedAtMs: room.statusChangedAtMs ?? null,
    lastActivityAtMs: room.lastActivityAtMs ?? null,
    expiresAtMs: room.expiresAtMs ?? null,
    minPlayers: MIN_PLAYERS_PER_ROOM,
    maxPlayers: MAX_PLAYERS_PER_ROOM,
    currentPlayerCount: room.players.size,
    connectionState: getRoomConnectionState(room.players),
    connectionStateLabel: CONNECTION_STATE_LABELS[getRoomConnectionState(room.players)],
    hostUnlockingPending: Boolean(room.hostUnlockingPending),
    unlockingProductName: room.unlockingProductName || null,
    game: room.game
      ? {
        isPreview: Boolean(room.game.isPreview),
        previewEndsAtMs: room.game.previewEndsAtMs ?? null,
        previewComboLimit: room.game.previewComboLimit ?? null,
        status: room.game.status,
        modeId: room.game.modeId
      }
      : null,
    selectedModeId: room.selectedModeId || "standard",
    availableModes: room.availableModes || [],
    modeDebugConfigs: MODE_DEBUG_ENABLED
      ? (room.availableModes || []).map((mode) => getModeDebugConfig(mode.id))
      : [],
    players: Array.from(room.players.values()).map((player) => ({
      playerId: player.playerId,
      name: player.name,
      connected: player.connected,
      connectionState: normalizeConnectionState(player.connectionState, player.connected ? "connected" : "disconnected"),
      connectionStateLabel: CONNECTION_STATE_LABELS[normalizeConnectionState(player.connectionState, player.connected ? "connected" : "disconnected")],
      connectionStateChangedAtMs: player.connectionStateChangedAtMs ?? null,
      reconnectingStartedAtMs: player.reconnectingStartedAtMs ?? null,
      disconnectedAtMs: player.disconnectedAtMs ?? null,
      pingMs: player.pingMs ?? null,
      clockOffsetMs: player.clockOffsetMs ?? null,
      timeSyncJitterMs: player.timeSyncJitterMs ?? null,
      timeSyncQuality: player.timeSyncQuality || "syncing",
      lastTimeSyncAtMs: player.lastTimeSyncAtMs ?? null,
      color: player.color,
      ready: player.ready,
      waitingForNextGame: Boolean(player.waitingForNextGame),
      currentGameParticipant: Boolean(player.currentGameParticipant),
      assetsLoaded: Boolean(player.assetsLoaded),
      isHost: room.creatorPlayerId === player.playerId,
      unlockingInProgress: room.creatorPlayerId === player.playerId && Boolean(room.hostUnlockingPending),
      position: player.position,
      hasEntitlement: Boolean((player.entitledModeKeys || []).length),
      entitlementExpiresAtMs: player.entitlementExpiresAtMs ?? null,
      entitledModeKeys: player.entitledModeKeys || [],
      entitledModeExpiriesMs: player.entitledModeExpiriesMs || {},
      game: getSafeGameState(room, player.playerId)
    }))
  };
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

function secureRandomString(alphabet, length) {
  const chars = [];
  for (let i = 0; i < length; i += 1) {
    chars.push(alphabet[crypto.randomInt(0, alphabet.length)]);
  }
  return chars.join("");
}

function generateRoomCode() {
  return secureRandomString(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);
}

function generateUniqueRoomCode(maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const roomCode = generateRoomCode();
    if (!rooms.has(roomCode)) return roomCode;
  }
  throw new Error("Failed to allocate a unique room code");
}

function createRandomId() {
  return crypto.randomUUID();
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

module.exports = {
  rooms,
  CREATOR_RECONNECT_GRACE_MS,
  CREATOR_UNLOCK_RECONNECT_GRACE_MS,
  MIN_PLAYERS_PER_ROOM,
  MAX_PLAYERS_PER_ROOM,
  PLAYER_COLORS,
  markCreatorTimedOut,
  consumeCreatorTimeoutNotice,
  markRoomExpired,
  hasExpiredRoomNotice,
  getAvailableColor,
  getSpawnPosition,
  getRoomState,
  generateRoomCode,
  generateUniqueRoomCode,
  createRandomId,
  createSessionToken
};
