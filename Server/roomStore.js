const rooms = new Map();
const CREATOR_RECONNECT_GRACE_MS = 3 * 60 * 1000;
const CREATOR_UNLOCK_RECONNECT_GRACE_MS = 10 * 60 * 1000;
const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
const { getModeDebugConfig } = require("./gameModes");
const { CONNECTION_STATE_LABELS, getRoomConnectionState, normalizeConnectionState } = require("./connectionState");
const CREATOR_TIMEOUT_NOTICE_TTL_MS = 10 * 60 * 1000;
const creatorTimeoutNotices = new Map();

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
    previewEndsAtMs: game.previewEndsAtMs ?? null
  };
}

function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  return {
    roomId: room.id,
    phase: room.phase,
    connectionState: getRoomConnectionState(room.players),
    connectionStateLabel: CONNECTION_STATE_LABELS[getRoomConnectionState(room.players)],
    hostUnlockingPending: Boolean(room.hostUnlockingPending),
    unlockingProductName: room.unlockingProductName || null,
    game: room.game
      ? {
        isPreview: Boolean(room.game.isPreview),
        previewEndsAtMs: room.game.previewEndsAtMs ?? null,
        status: room.game.status,
        modeId: room.game.modeId
      }
      : null,
    selectedModeId: room.selectedModeId || "standard",
    availableModes: room.availableModes || [],
    modeDebugConfigs: (room.availableModes || []).map((mode) => getModeDebugConfig(mode.id)),
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

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

const crypto = require("crypto");

function createRandomId() {
  return crypto.randomUUID();
}

function createSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

module.exports = {
  rooms,
  CREATOR_RECONNECT_GRACE_MS,
  CREATOR_UNLOCK_RECONNECT_GRACE_MS,
  PLAYER_COLORS,
  markCreatorTimedOut,
  consumeCreatorTimeoutNotice,
  getAvailableColor,
  getSpawnPosition,
  getRoomState,
  generateRoomCode,
  createRandomId,
  createSessionToken
};
