const CONNECTION_STATES = Object.freeze({
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  DEGRADED: "degraded",
  DISCONNECTED: "disconnected"
});

const CONNECTION_STATE_LABELS = Object.freeze({
  [CONNECTION_STATES.CONNECTING]: "Connecting",
  [CONNECTION_STATES.CONNECTED]: "Connected",
  [CONNECTION_STATES.RECONNECTING]: "Reconnecting",
  [CONNECTION_STATES.DEGRADED]: "Degraded",
  [CONNECTION_STATES.DISCONNECTED]: "Disconnected"
});

function parsePositiveIntEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const PLAYER_RECONNECT_GRACE_MS = parsePositiveIntEnv("PLAYER_RECONNECT_GRACE_MS", 60 * 1000);
const DEGRADED_PING_THRESHOLD_MS = parsePositiveIntEnv("DEGRADED_PING_THRESHOLD_MS", 150);

function isValidConnectionState(state) {
  return Object.values(CONNECTION_STATES).includes(state);
}

function normalizeConnectionState(state, fallback = CONNECTION_STATES.DISCONNECTED) {
  return isValidConnectionState(state) ? state : fallback;
}

function isSocketUsableConnectionState(state) {
  return state === CONNECTION_STATES.CONNECTED || state === CONNECTION_STATES.DEGRADED;
}

function applyPlayerConnectionState(player, nextState, metadata = {}) {
  if (!player) return null;

  const connectionState = normalizeConnectionState(nextState);
  const nowMs = metadata.nowMs ?? Date.now();
  const previousState = normalizeConnectionState(
    player.connectionState,
    player.connected ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.DISCONNECTED
  );

  player.connectionState = connectionState;
  player.connected = isSocketUsableConnectionState(connectionState);
  player.connectionStateChangedAtMs = nowMs;

  if (metadata.socketId !== undefined) {
    player.socketId = metadata.socketId;
  }

  if (connectionState === CONNECTION_STATES.DISCONNECTED) {
    player.disconnectedAtMs = player.disconnectedAtMs ?? nowMs;
  } else if (connectionState === CONNECTION_STATES.RECONNECTING) {
    player.reconnectingStartedAtMs = nowMs;
    player.disconnectedAtMs = nowMs;
  } else {
    player.reconnectingStartedAtMs = null;
    player.disconnectedAtMs = null;
  }

  return { previousState, connectionState };
}

function updatePlayerLatencyState(player, pingMs) {
  if (!player) return null;
  if (![CONNECTION_STATES.CONNECTED, CONNECTION_STATES.DEGRADED].includes(player.connectionState)) {
    return null;
  }

  const nextState = pingMs >= DEGRADED_PING_THRESHOLD_MS
    ? CONNECTION_STATES.DEGRADED
    : CONNECTION_STATES.CONNECTED;

  if (player.connectionState === nextState) {
    return null;
  }

  return applyPlayerConnectionState(player, nextState);
}

function getRoomConnectionState(players) {
  const playerList = Array.from(players?.values?.() ?? players ?? []);
  if (!playerList.length) return CONNECTION_STATES.DISCONNECTED;

  const states = playerList.map((player) => normalizeConnectionState(
    player.connectionState,
    player.connected ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.DISCONNECTED
  ));

  if (states.some((state) => state === CONNECTION_STATES.CONNECTING)) {
    return CONNECTION_STATES.CONNECTING;
  }
  if (states.some((state) => state === CONNECTION_STATES.RECONNECTING)) {
    return CONNECTION_STATES.RECONNECTING;
  }
  if (states.some((state) => state === CONNECTION_STATES.DISCONNECTED)) {
    return CONNECTION_STATES.DISCONNECTED;
  }
  if (states.some((state) => state === CONNECTION_STATES.DEGRADED)) {
    return CONNECTION_STATES.DEGRADED;
  }
  return CONNECTION_STATES.CONNECTED;
}

module.exports = {
  CONNECTION_STATES,
  CONNECTION_STATE_LABELS,
  PLAYER_RECONNECT_GRACE_MS,
  DEGRADED_PING_THRESHOLD_MS,
  applyPlayerConnectionState,
  getRoomConnectionState,
  isSocketUsableConnectionState,
  normalizeConnectionState,
  updatePlayerLatencyState
};
