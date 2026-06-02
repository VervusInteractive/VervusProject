export const CONNECTION_STATES = Object.freeze({
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  DEGRADED: "degraded",
  DISCONNECTED: "disconnected"
});

export const CONNECTION_STATE_LABELS = Object.freeze({
  [CONNECTION_STATES.CONNECTING]: "Connecting",
  [CONNECTION_STATES.CONNECTED]: "Connected",
  [CONNECTION_STATES.RECONNECTING]: "Reconnecting",
  [CONNECTION_STATES.DEGRADED]: "Degraded",
  [CONNECTION_STATES.DISCONNECTED]: "Disconnected"
});

export const DEGRADED_PING_THRESHOLD_MS = 100;

export function getConnectionStateLabel(state) {
  return CONNECTION_STATE_LABELS[state] || CONNECTION_STATE_LABELS[CONNECTION_STATES.DISCONNECTED];
}

export function deriveSocketConnectionState({ socketConnected, isReconnecting, pingMs }) {
  if (isReconnecting) return CONNECTION_STATES.RECONNECTING;
  if (!socketConnected) return CONNECTION_STATES.DISCONNECTED;
  if (typeof pingMs === "number" && pingMs >= DEGRADED_PING_THRESHOLD_MS) return CONNECTION_STATES.DEGRADED;
  return CONNECTION_STATES.CONNECTED;
}
