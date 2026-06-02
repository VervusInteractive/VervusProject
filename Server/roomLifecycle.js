const {
  rooms,
  CREATOR_RECONNECT_GRACE_MS,
  CREATOR_UNLOCK_RECONNECT_GRACE_MS,
  markCreatorTimedOut
} = require("./roomStore");
const { deleteRoomRecord, updateRoomStatus, logRoomHistoryEvent, logErrorEntry } = require("./db");

const ROOM_STATUSES = Object.freeze({
  LOBBY: "lobby",
  PREVIEW: "preview",
  PAYMENT_PENDING: "payment_pending",
  PREMIUM: "premium",
  RECONNECTING: "reconnecting",
  ENDED: "ended",
  EXPIRED: "expired"
});

const ROOM_CLEANUP_DEFAULTS_MS = Object.freeze({
  ended: 15 * 60 * 1000,
  expired: 2 * 60 * 1000,
  abandoned: 5 * 60 * 1000,
  inactive: 30 * 60 * 1000,
  paymentPending: 10 * 60 * 1000,
  interval: 60 * 1000
});

function parseCleanupMs(envName, fallbackMs) {
  const value = Number(process.env[envName]);
  return Number.isFinite(value) && value >= 0 ? value : fallbackMs;
}

const ROOM_CLEANUP_MS = Object.freeze({
  ended: parseCleanupMs("ROOM_ENDED_CLEANUP_MS", ROOM_CLEANUP_DEFAULTS_MS.ended),
  expired: parseCleanupMs("ROOM_EXPIRED_CLEANUP_MS", ROOM_CLEANUP_DEFAULTS_MS.expired),
  abandoned: parseCleanupMs("ROOM_ABANDONED_CLEANUP_MS", ROOM_CLEANUP_DEFAULTS_MS.abandoned),
  inactive: parseCleanupMs("ROOM_INACTIVE_CLEANUP_MS", ROOM_CLEANUP_DEFAULTS_MS.inactive),
  paymentPending: parseCleanupMs("ROOM_PAYMENT_PENDING_CLEANUP_MS", ROOM_CLEANUP_DEFAULTS_MS.paymentPending),
  interval: parseCleanupMs("ROOM_CLEANUP_INTERVAL_MS", ROOM_CLEANUP_DEFAULTS_MS.interval)
});

function nowMs() {
  return Date.now();
}

function touchRoom(room, timestampMs = nowMs()) {
  if (!room) return;
  room.lastActivityAtMs = timestampMs;
}

function initializeRoomLifecycle(room, status = ROOM_STATUSES.LOBBY, timestampMs = nowMs()) {
  room.status = status;
  room.statusChangedAtMs = timestampMs;
  room.lastActivityAtMs = timestampMs;
  room.expiresAtMs = null;
  room.preReconnectStatus = null;
  room.cleanupMarkedAtMs = null;
}

function getRoomStatus(room) {
  return room?.status || room?.phase || ROOM_STATUSES.LOBBY;
}

function persistRoomStatus(roomId, toStatus, fromStatus, eventType, metadata = {}) {
  updateRoomStatus({ roomCode: roomId, status: toStatus }).catch((error) => console.error(`DB room ${toStatus} update failed`, error));
  logRoomHistoryEvent({ roomCode: roomId, eventType, fromStatus, toStatus, metadata }).catch((error) => console.error(`DB room history ${eventType} failed`, error));
}

function transitionRoomStatus(room, roomId, toStatus, { eventType = "settings_changed", persist = true, metadata = {}, timestampMs = nowMs() } = {}) {
  if (!room || !toStatus) return null;

  const fromStatus = getRoomStatus(room);
  if (fromStatus === toStatus) {
    touchRoom(room, timestampMs);
    return fromStatus;
  }

  room.status = toStatus;
  room.statusChangedAtMs = timestampMs;
  touchRoom(room, timestampMs);

  if (persist) {
    persistRoomStatus(roomId || room.id, toStatus, fromStatus, eventType, metadata);
  }

  return fromStatus;
}

function clearCreatorDisconnectTimer(room) {
  if (!room?.creatorDisconnectTimer) return;

  clearTimeout(room.creatorDisconnectTimer);
  room.creatorDisconnectTimer = null;
}

function clearRoomGameTimers(room) {
  if (!room?.gameTimers) {
    return;
  }

  for (const timer of room.gameTimers) {
    clearTimeout(timer);
  }
  room.gameTimers = [];
}

function clearPlayerReconnectTimers(room) {
  for (const player of room?.players?.values?.() || []) {
    if (player.reconnectTimer) {
      clearTimeout(player.reconnectTimer);
      player.reconnectTimer = null;
    }
  }
}

function deleteRoomRuntime(roomId) {
  rooms.delete(roomId);
  logRoomHistoryEvent({ roomCode: roomId, eventType: "room_deleted" }).catch((error) => console.error("DB room history deleted failed", error));
  deleteRoomRecord(roomId).catch((error) => {
    console.error("DB delete room failed", error);
    logErrorEntry({ roomCode: roomId, source: "roomLifecycle:deleteRoomRuntime", message: error.message, stackTrace: error.stack }).catch(() => {});
  });
}

function disbandRoom(io, roomId, reason = "Room disbanded", excludedSocketId = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  clearCreatorDisconnectTimer(room);
  clearPlayerReconnectTimers(room);
  clearRoomGameTimers(room);

  if (excludedSocketId) {
    io.except(excludedSocketId).to(roomId).emit("room:disbanded", { roomId, reason });
  } else {
    io.to(roomId).emit("room:disbanded", { roomId, reason });
  }
  deleteRoomRuntime(roomId);
}

function scheduleCreatorDisband(io, roomId, { extendedGraceMs = false } = {}) {
  const room = rooms.get(roomId);
  if (!room || room.creatorDisconnectTimer) return;

  room.creatorDisconnectTimer = setTimeout(() => {
    const latestRoom = rooms.get(roomId);
    if (!latestRoom) return;

    const creator = latestRoom.players.get(latestRoom.creatorPlayerId);
    if (creator && !creator.connected) {
      markCreatorTimedOut(creator.sessionToken);
      transitionRoomStatus(latestRoom, roomId, ROOM_STATUSES.EXPIRED, {
        eventType: "room_expired",
        metadata: { reason: "creator_timeout" }
      });
      disbandRoom(io, roomId, "Room disbanded");
    }
  }, extendedGraceMs ? CREATOR_UNLOCK_RECONNECT_GRACE_MS : CREATOR_RECONNECT_GRACE_MS);
}

function hasConnectedPlayers(room) {
  return Array.from(room.players.values()).some((player) => player.connected);
}

function expireAndDisbandRoom(io, room, roomId, reason, metadata = {}) {
  transitionRoomStatus(room, roomId, ROOM_STATUSES.EXPIRED, {
    eventType: "room_expired",
    metadata: { reason, ...metadata }
  });
  io.to(roomId).emit("room:expired", { roomId, reason });
  disbandRoom(io, roomId, reason);
}

function startRoomCleanupScheduler(io, { intervalMs = ROOM_CLEANUP_MS.interval } = {}) {
  if (intervalMs <= 0) return null;

  const scheduler = setInterval(() => {
    const timestampMs = nowMs();
    for (const [roomId, room] of rooms.entries()) {
      const status = getRoomStatus(room);
      const statusAgeMs = timestampMs - (room.statusChangedAtMs || room.lastActivityAtMs || timestampMs);
      const inactiveAgeMs = timestampMs - (room.lastActivityAtMs || room.statusChangedAtMs || timestampMs);

      if (status === ROOM_STATUSES.ENDED && statusAgeMs >= ROOM_CLEANUP_MS.ended) {
        disbandRoom(io, roomId, "Ended room cleaned up");
        continue;
      }

      if (status === ROOM_STATUSES.EXPIRED && statusAgeMs >= ROOM_CLEANUP_MS.expired) {
        disbandRoom(io, roomId, "Expired room cleaned up");
        continue;
      }

      if (!hasConnectedPlayers(room) && inactiveAgeMs >= ROOM_CLEANUP_MS.abandoned) {
        expireAndDisbandRoom(io, room, roomId, "Abandoned room cleaned up");
        continue;
      }

      if (status === ROOM_STATUSES.PAYMENT_PENDING && statusAgeMs >= ROOM_CLEANUP_MS.paymentPending) {
        expireAndDisbandRoom(io, room, roomId, "Payment pending room expired");
        continue;
      }

      if (status === ROOM_STATUSES.LOBBY && inactiveAgeMs >= ROOM_CLEANUP_MS.inactive) {
        expireAndDisbandRoom(io, room, roomId, "Inactive lobby expired");
        continue;
      }

      if (room.expiresAtMs && timestampMs >= room.expiresAtMs) {
        expireAndDisbandRoom(io, room, roomId, "Room entitlement expired", { expiresAtMs: room.expiresAtMs });
      }
    }
  }, intervalMs);

  scheduler.unref?.();
  return scheduler;
}

module.exports = {
  ROOM_STATUSES,
  ROOM_CLEANUP_MS,
  clearCreatorDisconnectTimer,
  clearRoomGameTimers,
  disbandRoom,
  initializeRoomLifecycle,
  startRoomCleanupScheduler,
  touchRoom,
  transitionRoomStatus,
  scheduleCreatorDisband
};
