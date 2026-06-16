function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

function formatCombo(value) {
  return `${(Number(value) || 0).toFixed(1).replace(/\.0$/, "")}x`;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.round((Number(milliseconds) || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function humanizeKey(value) {
  const text = String(value || "unknown").replace(/[_-]+/g, " ").trim();
  if (!text) return "Unknown";
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const roomStatusLabels = {
  waiting_for_players: "Waiting for players",
  waiting_to_start: "Waiting to start",
  players_readying: "Players readying",
  starting: "Starting",
  in_game: "In game",
  game_over: "Game over",
  payment_pending: "Payment pending",
  reconnecting: "Reconnecting",
  ended: "Ended",
  expired: "Expired",
  lobby: "Waiting to start",
  preview: "In game",
  premium: "In game",
  active: "In game",
  loading: "Starting",
  paused: "Reconnecting",
  gameover: "Game over"
};

const roomEventLabels = {
  room_created: "Room created",
  room_joined: "Joined",
  room_left: "Left",
  room_started: "Started",
  room_ended: "Ended",
  room_expired: "Expired",
  room_deleted: "Deleted",
  host_changed: "Host changed",
  settings_changed: "Settings changed"
};

function formatStatusLabel(value) {
  return roomStatusLabels[String(value || "").toLowerCase()] || humanizeKey(value);
}

function formatEventLabel(value) {
  return roomEventLabels[String(value || "").toLowerCase()] || humanizeKey(value);
}

function formatPlayers(players = {}) {
  const current = Number(players.current) || 0;
  const connected = Number(players.connected) || 0;
  const max = Number(players.max) || 0;
  return max ? `${connected}/${current}/${max}` : `${connected}/${current}`;
}

function formatPing(pingMs) {
  const normalized = Number(pingMs);
  return Number.isFinite(normalized) ? `${Math.round(normalized)}ms` : "-";
}

function summarizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object") return "-";
  const importantEntries = Object.entries(metadata)
    .filter(([key]) => key !== "actorDisplayName")
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 3);
  if (!importantEntries.length) return "-";
  return importantEntries
    .map(([key, value]) => `${humanizeKey(key)}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join(", ");
}

export {
  formatCombo,
  formatDateTime,
  formatDuration,
  formatEventLabel,
  formatNumber,
  formatPing,
  formatPlayers,
  formatStatusLabel,
  humanizeKey,
  summarizeMetadata
};
