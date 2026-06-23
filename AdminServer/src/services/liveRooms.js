const { config } = require("../config");
const { pool, assertDatabaseConfigured, tableExists, columnExists } = require("../db");
const { normalizeLimit, normalizeOptionalText } = require("../utils/normalizers");

const CONNECTED_CONNECTION_STATES = new Set(["connected", "degraded"]);

function toNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function formatConnectionStateLabel(value) {
  return String(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toIsoTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isConnectedPlayer(player = {}) {
  const connectionState = String(player.connectionState || player.connection_status || "").toLowerCase();
  return CONNECTED_CONNECTION_STATES.has(connectionState) || player.connected === true;
}

function getConnectedPlayerCount(players = []) {
  return players.filter((player) => isConnectedPlayer(player)).length;
}

function getAveragePingMs(players = []) {
  const pings = players
    .map((player) => Number(player?.pingMs))
    .filter((pingMs) => Number.isFinite(pingMs) && pingMs >= 0);
  if (!pings.length) return null;
  return Math.round(pings.reduce((sum, pingMs) => sum + pingMs, 0) / pings.length);
}

function normalizeRuntimePlayer(player = {}, index = 0) {
  const connectionState = String(player.connectionState || (player.connected ? "connected" : "disconnected")).toLowerCase();
  const pingMs = toNonNegativeNumber(player.pingMs);
  return {
    playerId: player.playerId || player.id || null,
    name: player.name || player.displayName || `Player ${index + 1}`,
    connected: isConnectedPlayer({ ...player, connectionState }),
    connectionState,
    connectionStateLabel: player.connectionStateLabel || formatConnectionStateLabel(connectionState),
    ready: Boolean(player.ready ?? player.isReady),
    isHost: Boolean(player.isHost),
    pingMs,
    color: player.color || null,
    currentGameParticipant: Boolean(player.currentGameParticipant),
    waitingForNextGame: Boolean(player.waitingForNextGame),
    assetsLoaded: Boolean(player.assetsLoaded),
    timeSyncQuality: player.timeSyncQuality || null,
    connectionStateChangedAt: toIsoTimestamp(player.connectionStateChangedAt || player.connectionStateChangedAtMs),
    reconnectingStartedAt: toIsoTimestamp(player.reconnectingStartedAt || player.reconnectingStartedAtMs),
    disconnectedAt: toIsoTimestamp(player.disconnectedAt || player.disconnectedAtMs)
  };
}

function normalizeDatabasePlayer(player = {}, index = 0) {
  const connectionState = String(player.connectionState || "disconnected").toLowerCase();
  const slot = toNonNegativeNumber(player.slot);
  return {
    playerId: player.playerId || player.id || null,
    name: player.name || player.displayName || `Player ${index + 1}`,
    connected: isConnectedPlayer({ ...player, connectionState }),
    connectionState,
    connectionStateLabel: player.connectionStateLabel || formatConnectionStateLabel(connectionState),
    ready: Boolean(player.ready ?? player.isReady),
    isHost: Boolean(player.isHost),
    slot,
    pingMs: null,
    color: null,
    currentGameParticipant: null,
    waitingForNextGame: null,
    assetsLoaded: null,
    timeSyncQuality: null,
    lastSeenAt: toIsoTimestamp(player.lastSeenAt),
    connectionStateChangedAt: toIsoTimestamp(player.connectionStateChangedAt),
    reconnectingStartedAt: toIsoTimestamp(player.reconnectingStartedAt),
    disconnectedAt: toIsoTimestamp(player.disconnectedAt)
  };
}

function getRuntimeMode(room = {}) {
  const modeKey = room.game?.modeId || room.game?.modeKey || room.selectedModeId || room.metadata?.selectedModeId || "standard";
  const mode = (Array.isArray(room.availableModes) ? room.availableModes : []).find((candidate) => candidate?.id === modeKey);
  return {
    modeKey,
    modeLabel: mode?.title || mode?.displayName || modeKey
  };
}

function getRuntimeStatus(room = {}) {
  const players = Array.isArray(room.players) ? room.players : [];
  const connectedPlayers = getConnectedPlayerCount(players);
  const readyPlayers = players.filter((player) => player?.ready && player?.connected).length;
  const rawStatus = room.status || room.phase || "unknown";
  const gameStatus = room.game?.status || "";

  if (room.hostUnlockingPending || rawStatus === "payment_pending") return "payment_pending";
  if (rawStatus === "reconnecting" || gameStatus === "paused") return "reconnecting";
  if (room.phase === "play") {
    if (gameStatus === "loading") return "starting";
    if (gameStatus === "active") return "in_game";
    if (gameStatus === "gameover") return "game_over";
    if (gameStatus) return gameStatus;
    return "in_game";
  }
  if (rawStatus === "preview" || rawStatus === "premium") return "in_game";
  if (rawStatus === "ended" || rawStatus === "expired") return rawStatus;
  if (connectedPlayers < 2) return "waiting_for_players";
  if (readyPlayers > 0 && readyPlayers < connectedPlayers) return "players_readying";
  return "waiting_to_start";
}

function getDatabaseRoomStatus(row = {}) {
  if (["payment_pending", "reconnecting", "ended", "expired"].includes(row.status)) return row.status;
  if (row.status === "preview" || row.status === "premium" || (row.latest_session_mode_key && row.latest_session_ended_at === null)) {
    return "in_game";
  }
  if ((Number(row.connected_player_count) || 0) < 2) return "waiting_for_players";
  return "waiting_to_start";
}

function normalizeRuntimeRoom(room = {}) {
  const players = (Array.isArray(room.players) ? room.players : []).map(normalizeRuntimePlayer);
  const currentPlayerCount = Math.max(toNonNegativeNumber(room.currentPlayerCount) ?? 0, players.length);
  const connectedPlayerCount = getConnectedPlayerCount(players);
  const mode = getRuntimeMode(room);
  return {
    roomCode: room.roomId || room.roomCode || "",
    players: {
      current: Math.max(currentPlayerCount, connectedPlayerCount),
      connected: connectedPlayerCount,
      max: toNonNegativeNumber(room.maxPlayers) ?? 0
    },
    playerList: players,
    mode: mode.modeKey,
    modeLabel: mode.modeLabel,
    status: getRuntimeStatus(room),
    rawStatus: room.status || room.phase || "unknown",
    gameStatus: room.game?.status || null,
    pingMs: getAveragePingMs(players),
    phase: room.phase || null,
    hostPlayerId: players.find((player) => player?.isHost)?.playerId || null,
    updatedAt: new Date().toISOString()
  };
}

async function fetchGameServerAdmin(path) {
  if (!config.gameServerAdminUrl) return null;

  const response = await fetch(`${config.gameServerAdminUrl.replace(/\/+$/, "")}${path}`, {
    headers: config.gameServerAdminToken ? { "X-Admin-Token": config.gameServerAdminToken } : {}
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Game server admin request failed with ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function getLiveRoomsFromGameServer() {
  const payload = await fetchGameServerAdmin("/api/admin/runtime");
  if (!payload) return null;
  const rooms = (Array.isArray(payload.rooms) ? payload.rooms : []).map(normalizeRuntimeRoom);
  const statusCounts = rooms.reduce((counts, room) => {
    counts[room.status] = (counts[room.status] || 0) + 1;
    return counts;
  }, {});

  return {
    source: "runtime",
    generatedAt: new Date().toISOString(),
    summary: {
      roomCount: rooms.length,
      playerCount: rooms.reduce((sum, room) => sum + (Number(room.players?.current) || 0), 0),
      connectedPlayerCount: rooms.reduce((sum, room) => sum + (Number(room.players?.connected) || 0), 0),
      statusCounts
    },
    rooms
  };
}

async function getLiveRoomsFromDatabase() {
  assertDatabaseConfigured();
  const [hasRooms, hasPlayers, hasGameSessions, hasRoomHistory] = await Promise.all([
    tableExists("vervus_data", "rooms"),
    tableExists("vervus_data", "players"),
    tableExists("vervus_data", "game_sessions"),
    tableExists("vervus_data", "room_history")
  ]);

  if (!hasRooms) {
    return {
      source: "database",
      generatedAt: new Date().toISOString(),
      summary: { roomCount: 0, playerCount: 0, connectedPlayerCount: 0, statusCounts: {} },
      rooms: []
    };
  }

  const playerJoin = hasPlayers
    ? `LEFT JOIN (
         SELECT room_id,
                COUNT(*)::int AS player_count,
                COUNT(*) FILTER (WHERE connection_status::text IN ('connected', 'degraded'))::int AS connected_player_count,
                COALESCE(jsonb_agg(jsonb_build_object(
                  'playerId', id::text,
                  'name', display_name,
                  'connected', connection_status::text IN ('connected', 'degraded'),
                  'connectionState', connection_status::text,
                  'connectionStateLabel', initcap(replace(connection_status::text, '_', ' ')),
                  'ready', is_ready,
                  'isHost', is_host,
                  'slot', player_slot,
                  'lastSeenAt', last_seen_at,
                  'connectionStateChangedAt', connection_state_changed_at,
                  'reconnectingStartedAt', reconnecting_started_at,
                  'disconnectedAt', disconnected_at
                ) ORDER BY is_host DESC, player_slot ASC NULLS LAST, last_seen_at DESC), '[]'::jsonb) AS players
         FROM vervus_data.players
         WHERE left_at IS NULL
         GROUP BY room_id
       ) p ON p.room_id = r.id`
    : `LEFT JOIN (SELECT NULL::uuid AS room_id, 0::int AS player_count, 0::int AS connected_player_count, '[]'::jsonb AS players) p ON false`;
  const historyPlayerJoin = hasPlayers && hasRoomHistory
    ? `LEFT JOIN (
         SELECT latest.room_code,
                COUNT(*)::int AS player_count,
                COUNT(*) FILTER (WHERE p.connection_status::text IN ('connected', 'degraded'))::int AS connected_player_count,
                COALESCE(jsonb_agg(jsonb_build_object(
                  'playerId', p.id::text,
                  'name', p.display_name,
                  'connected', p.connection_status::text IN ('connected', 'degraded'),
                  'connectionState', p.connection_status::text,
                  'connectionStateLabel', initcap(replace(p.connection_status::text, '_', ' ')),
                  'ready', p.is_ready,
                  'isHost', p.is_host,
                  'slot', p.player_slot,
                  'lastSeenAt', p.last_seen_at,
                  'connectionStateChangedAt', p.connection_state_changed_at,
                  'reconnectingStartedAt', p.reconnecting_started_at,
                  'disconnectedAt', p.disconnected_at
                ) ORDER BY p.is_host DESC, p.player_slot ASC NULLS LAST, p.last_seen_at DESC), '[]'::jsonb) AS players
         FROM (
           SELECT DISTINCT ON (room_code, actor_player_id)
                  room_code,
                  actor_player_id,
                  event_type,
                  event_at
           FROM vervus_data.room_history
           WHERE actor_player_id IS NOT NULL
             AND event_type IN ('room_joined', 'room_left')
           ORDER BY room_code, actor_player_id, event_at DESC
         ) latest
         JOIN vervus_data.players p ON p.id = latest.actor_player_id
         WHERE latest.event_type = 'room_joined'
           AND p.left_at IS NULL
         GROUP BY latest.room_code
       ) hp ON hp.room_code = r.room_code`
    : `LEFT JOIN (SELECT NULL::text AS room_code, 0::int AS player_count, 0::int AS connected_player_count, '[]'::jsonb AS players) hp ON false`;
  const hasRoomMetadata = await columnExists("vervus_data", "rooms", "metadata");
  const metadataSelect = hasRoomMetadata ? "COALESCE(r.metadata, '{}'::jsonb)" : "'{}'::jsonb";
  const gameSessionJoin = hasGameSessions
    ? `LEFT JOIN LATERAL (
         SELECT mode_key, ended_at
         FROM vervus_data.game_sessions gs
         WHERE gs.room_code = r.room_code
         ORDER BY gs.started_at DESC
         LIMIT 1
       ) gs ON true`
    : `LEFT JOIN (SELECT NULL::text AS mode_key, NULL::timestamptz AS ended_at) gs ON false`;

  const { rows } = await pool.query(
    `SELECT r.room_code,
            r.status::text AS status,
            ${metadataSelect} AS metadata,
            COALESCE(gs.mode_key, ${metadataSelect}->>'selectedModeId', ${metadataSelect}->>'modeId', 'standard') AS mode_key,
            gs.mode_key AS latest_session_mode_key,
            gs.ended_at AS latest_session_ended_at,
            COALESCE(r.max_players, 0)::int AS max_players,
            CASE WHEN COALESCE(p.player_count, 0) > 0 THEN p.player_count ELSE COALESCE(hp.player_count, 0) END::int AS player_count,
            CASE WHEN COALESCE(p.player_count, 0) > 0 THEN p.connected_player_count ELSE COALESCE(hp.connected_player_count, 0) END::int AS connected_player_count,
            COALESCE(CASE WHEN COALESCE(p.player_count, 0) > 0 THEN p.players ELSE hp.players END, '[]'::jsonb) AS players,
            COALESCE(r.started_at, r.created_at, now()) AS updated_at
     FROM vervus_data.rooms r
     ${playerJoin}
     ${historyPlayerJoin}
     ${gameSessionJoin}
     WHERE r.ended_at IS NULL
       AND r.status::text NOT IN ('ended', 'expired')
     ORDER BY updated_at DESC`
  );

  const statusCounts = rows.reduce((counts, row) => {
    const status = getDatabaseRoomStatus(row);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  return {
    source: "database",
    generatedAt: new Date().toISOString(),
    summary: {
      roomCount: rows.length,
      playerCount: rows.reduce((sum, row) => sum + (Number(row.player_count) || 0), 0),
      connectedPlayerCount: rows.reduce((sum, row) => sum + (Number(row.connected_player_count) || 0), 0),
      statusCounts
    },
    rooms: rows.map((row) => {
      const status = getDatabaseRoomStatus(row);
      const playerList = (Array.isArray(row.players) ? row.players : []).map(normalizeDatabasePlayer);
      const currentPlayerCount = Math.max(Number(row.player_count) || 0, playerList.length);
      const connectedPlayerCount = Math.max(Number(row.connected_player_count) || 0, getConnectedPlayerCount(playerList));
      return {
        roomCode: row.room_code,
        players: {
          current: Math.max(currentPlayerCount, connectedPlayerCount),
          connected: connectedPlayerCount,
          max: Number(row.max_players) || 0
        },
        playerList,
        mode: row.mode_key || "standard",
        modeLabel: row.mode_key || "standard",
        status,
        rawStatus: row.status,
        pingMs: null,
        phase: null,
        hostPlayerId: playerList.find((player) => player.isHost)?.playerId || null,
        updatedAt: row.updated_at
      };
    })
  };
}

async function getLiveRooms() {
  let fallbackReason = null;

  try {
    const runtimeRooms = await getLiveRoomsFromGameServer();
    if (runtimeRooms) {
      return {
        ...runtimeRooms,
        runtime: { available: true, error: null }
      };
    }
    fallbackReason = config.gameServerAdminUrl
      ? "Game server runtime endpoint returned no payload"
      : "GAME_SERVER_ADMIN_URL is not configured";
  } catch (error) {
    fallbackReason = error.message || "Game server runtime fetch failed";
    console.warn("Game server live room fetch failed", error.message);
  }

  const databaseRooms = await getLiveRoomsFromDatabase();
  return {
    ...databaseRooms,
    source: "database_fallback",
    runtime: {
      available: false,
      error: fallbackReason
    }
  };
}

async function getRoomHistory({ limit = 50, roomCode = "", eventType = "" } = {}) {
  assertDatabaseConfigured();
  const hasHistory = await tableExists("vervus_data", "room_history");
  if (!hasHistory) {
    return { generatedAt: new Date().toISOString(), history: [] };
  }
  const hasPlayerProfiles = await tableExists("vervus_data", "player_profiles");

  const safeLimit = normalizeLimit(limit, 50, 200);
  const normalizedRoomCode = normalizeOptionalText(roomCode, 32).toUpperCase();
  const normalizedEventType = normalizeOptionalText(eventType, 64);
  const params = [];
  const filters = [];

  if (normalizedRoomCode) {
    params.push(normalizedRoomCode);
    filters.push(`rh.room_code = $${params.length}`);
  }

  if (normalizedEventType) {
    params.push(normalizedEventType);
    filters.push(`rh.event_type = $${params.length}`);
  }

  params.push(safeLimit);
  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const profileNameSelect = hasPlayerProfiles ? "pp.display_name" : "NULL";
  const profileJoin = hasPlayerProfiles ? "LEFT JOIN vervus_data.player_profiles pp ON pp.id = rh.actor_player_id" : "";
  const { rows } = await pool.query(
    `SELECT rh.id,
            rh.room_code,
            rh.event_type,
            rh.event_at,
            rh.actor_player_id,
            COALESCE(rh.metadata->>'actorDisplayName', p.display_name, ${profileNameSelect}) AS actor_display_name,
            rh.from_status::text AS from_status,
            rh.to_status::text AS to_status,
            rh.metadata
     FROM vervus_data.room_history rh
     LEFT JOIN vervus_data.players p ON p.id = rh.actor_player_id
     ${profileJoin}
     ${whereSql}
     ORDER BY rh.event_at DESC
     LIMIT $${params.length}`,
    params
  );

  return {
    generatedAt: new Date().toISOString(),
    history: rows.map((row) => ({
      id: row.id,
      roomCode: row.room_code,
      eventType: row.event_type,
      eventAt: row.event_at,
      actorPlayerId: row.actor_player_id,
      actorDisplayName: row.actor_display_name,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      metadata: row.metadata || {}
    }))
  };
}

module.exports = { getLiveRooms, getRoomHistory, normalizeRuntimeRoom };
