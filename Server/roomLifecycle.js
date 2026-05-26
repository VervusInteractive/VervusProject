const {
  rooms,
  CREATOR_RECONNECT_GRACE_MS,
  CREATOR_UNLOCK_RECONNECT_GRACE_MS,
  markCreatorTimedOut
} = require("./roomStore");
const { deleteRoomRecord } = require("./db");

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

function disbandRoom(io, roomId, reason = "Room disbanded", excludedSocketId = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  clearCreatorDisconnectTimer(room);
  clearRoomGameTimers(room);

  if (excludedSocketId) {
    io.except(excludedSocketId).to(roomId).emit("room:disbanded", { roomId, reason });
  } else {
    io.to(roomId).emit("room:disbanded", { roomId, reason });
  }
  rooms.delete(roomId);
  deleteRoomRecord(roomId).catch((error) => console.error("DB delete room failed", error));
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
      disbandRoom(io, roomId, "Room disbanded");
    }
  }, extendedGraceMs ? CREATOR_UNLOCK_RECONNECT_GRACE_MS : CREATOR_RECONNECT_GRACE_MS);
}

module.exports = {
  clearCreatorDisconnectTimer,
  clearRoomGameTimers,
  disbandRoom,
  scheduleCreatorDisband
};
