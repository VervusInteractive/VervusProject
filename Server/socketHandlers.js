const {
  rooms,
  getRoomState,
  generateRoomCode,
  createRandomId,
  createSessionToken,
  PLAYER_COLORS,
  consumeCreatorTimeoutNotice,
  getAvailableColor,
  getSpawnPosition
} = require("./roomStore");
const {
  createRoomRecord,
  addPlayerRecord,
  updatePlayerReady,
  updatePlayerConnection,
  deletePlayerRecord,
  updateRoomStatus,
  deleteRoomRecord,
  upsertPlayerProfile,
  grantPlayerProfileEntitlement,
  getActivePlayerProfileEntitlement,
  getActiveEntitledModeKeys,
  getActiveEntitlementExpiriesByMode,
  getProductByKey,
  logRoomHistoryEvent,
  logErrorEntry
} = require("./db");
const {
  clearCreatorDisconnectTimer,
  clearRoomGameTimers,
  disbandRoom,
  scheduleCreatorDisband
} = require("./roomLifecycle");
const { createGameState, buildRound, updateHeatSurgeStateForNextRound, evaluateRound } = require("./gameEngine");
const {
  CONNECTION_STATES,
  PLAYER_RECONNECT_GRACE_MS,
  applyPlayerConnectionState,
  updatePlayerLatencyState
} = require("./connectionState");
const { getDifficultyProfile, normalizeModeId, hydrateStandardModeFromDb, hydrateHeatSurgeConfigsFromDb, hydrateModeCorruptionBandsFromDb, getGameModesFromDb, getGameModesFallback } = require("./gameModes");

function registerSocketHandlers(io) {
  const emitState = (roomId) => {
    io.to(roomId).emit("room:state", getRoomState(roomId));
  };
  const persistConnectionState = (player, status, contextLabel) => {
    updatePlayerConnection({
      playerId: player.playerId,
      status,
      stateChangedAtMs: player.connectionStateChangedAtMs ?? Date.now(),
      reconnectingStartedAtMs: player.reconnectingStartedAtMs ?? null,
      disconnectedAtMs: player.disconnectedAtMs ?? null
    }).catch((error) => console.error(`DB ${contextLabel} connection update failed`, error));
  };

  const clearPlayerReconnectTimer = (player) => {
    if (!player?.reconnectTimer) return;
    clearTimeout(player.reconnectTimer);
    player.reconnectTimer = null;
  };

  const schedulePlayerDisconnectedState = (room, roomId, player, socketIdAtDisconnect) => {
    clearPlayerReconnectTimer(player);
    player.reconnectTimer = setTimeout(() => {
      if (!room.players.has(player.playerId) || player.socketId !== socketIdAtDisconnect || player.connectionState !== CONNECTION_STATES.RECONNECTING) {
        return;
      }

      applyPlayerConnectionState(player, CONNECTION_STATES.DISCONNECTED);
      player.ready = false;
      persistConnectionState(player, CONNECTION_STATES.DISCONNECTED, "disconnect-final");
      emitState(roomId);
    }, PLAYER_RECONNECT_GRACE_MS);
  };

  const emitWarning = (roomId, message, targetPlayerId = null) => {
    if (!message) return;
    if (!targetPlayerId) {
      io.to(roomId).emit("room:warning", { message });
      return;
    }

    const room = rooms.get(roomId);
    const targetPlayer = room?.players.get(targetPlayerId);
    if (!targetPlayer?.socketId) return;
    io.to(targetPlayer.socketId).emit("room:warning", { message });
  };

  const registerTimer = (room, timerId) => {
    room.gameTimers = room.gameTimers || [];
    room.gameTimers.push(timerId);
    return timerId;
  };

  const persistError = (payload) => {
    logErrorEntry(payload).catch((dbError) => console.error("DB error log failed", dbError));
  };

  const clearPreviewTimer = (room) => {
    if (!room?.previewTimer) return;
    clearTimeout(room.previewTimer);
    room.previewTimer = null;
  };

  const scheduleNextRound = (room, roomId, delayMs = 0, replayRound = null) => {
    const timer = setTimeout(() => {
      if (!rooms.has(roomId) || room.phase !== "play" || room.game?.status !== "active") {
        return;
      }

      const activePlayers = Array.from(room.players.values()).filter(
        (player) => player.connected && !player.waitingForNextGame
      );
      if (activePlayers.length < 2) {
        room.game.status = "paused";
        emitState(roomId);
        return;
      }

      const round = buildRound({
        modeId: room.game.modeId,
        combo: room.game.combo,
        gameState: room.game,
        playerIds: activePlayers.map((player) => player.playerId),
        replayRound
      });

      room.game.currentRound = round;
      room.game.roundNumber += 1;
      room.game.lastRoundResult = null;
      emitState(roomId);

      const endTimer = setTimeout(() => {
        resolveRound(room, roomId, round.id);
      }, round.timerMs);
      registerTimer(room, endTimer);
    }, delayMs);

    registerTimer(room, timer);
  };

  const endWithGameOver = (room, roomId, round, evaluation, wasLastChanceActive) => {
    const decisivePlayerIds = evaluation.failingPlayers;
    const decisivePlayers = decisivePlayerIds.map((playerId) => {
      const player = room.players.get(playerId);
      return {
        playerId,
        name: player?.name || "Unknown",
        input: round.playerAnswers[playerId] || null,
        reason: round.playerAnswers[playerId] ? "wrong_input" : "missed_input"
      };
    });

    room.game.status = "gameover";
    updateRoomStatus({ roomCode: roomId, status: "ended" }).catch((error) => console.error("DB room ended update failed", error));
    logRoomHistoryEvent({ roomCode: roomId, eventType: "room_ended", fromStatus: "active", toStatus: "ended" }).catch((error) => console.error("DB room history end failed", error));
    room.game.killScreen = {
      score: room.game.score,
      combo: room.game.combo,
      correctAnswer: evaluation.correctAnswer,
      causeLabel: evaluation.causeLabel,
      wasLastChanceActive,
      decisivePlayers
    };

    room.game.lastRoundResult = {
      passed: false,
      correctAnswer: evaluation.correctAnswer,
      failingPlayers: decisivePlayers.map((player) => player.name),
      wasLastChanceActive
    };
    for (const p of room.players.values()) {
      p.ready = false;
      p.waitingForNextGame = false;
    }

    emitState(roomId);
  };

  const resolveRound = (room, roomId, roundId) => {
    if (!rooms.has(roomId) || room.phase !== "play" || room.game?.status !== "active") {
      return;
    }

    const round = room.game.currentRound;
    if (!round || round.id !== roundId) {
      return;
    }
    if (round.isResolved) {
      return;
    }
    round.isResolved = true;

    const activePlayerIds = Array.from(room.players.values())
      .filter((player) => player.connected && !player.waitingForNextGame)
      .map((player) => player.playerId);
    const evaluation = evaluateRound(round, activePlayerIds);

    if (evaluation.passed) {
      room.game.combo += 1;
      room.game.score += 1;
      room.game.lastRoundResult = {
        passed: true,
        correctAnswer: evaluation.correctAnswer,
        failingPlayers: [],
        wasLastChanceActive: round.isLastChanceReplay
      };
      emitState(roomId);

      updateHeatSurgeStateForNextRound(room.game);
      const difficulty = getDifficultyProfile(room.game.modeId, room.game.combo);
      scheduleNextRound(room, roomId, difficulty.roundResultLockMs + difficulty.transitionBeatMs);
      return;
    }

    const shouldTriggerLastChance = !room.game.usedLastChance && !round.isLastChanceReplay && getDifficultyProfile(room.game.modeId, room.game.combo).hasLastChance;

    if (shouldTriggerLastChance) {
      const replayAnswers = { ...round.playerAnswers };
      for (const wrongPlayerId of evaluation.wrongPlayers) {
        delete replayAnswers[wrongPlayerId];
      }

      room.game.usedLastChance = true;
      room.game.lastRoundResult = {
        passed: false,
        correctAnswer: evaluation.correctAnswer,
        failingPlayers: evaluation.failingPlayers,
        wasLastChanceActive: false,
        statusLabel: "SAVE IT!"
      };
      emitState(roomId);

      scheduleNextRound(room, roomId, 500, {
        ...round,
        playerAnswers: replayAnswers
      });
      return;
    }

    endWithGameOver(room, roomId, round, evaluation, round.isLastChanceReplay);
  };

  const maybeAdvanceToPlayPhase = async (room, roomId) => {
    const canStartFromLobby = room.phase === "lobby";
    const canRestartFromGameOver = room.phase === "play" && room.game?.status === "gameover";
    if ((!canStartFromLobby && !canRestartFromGameOver) || room.players.size < 2) {
      return;
    }

    const allReady = Array.from(room.players.values()).every(
      (player) => player.ready && player.connected
    );

    if (allReady) {
      try {
        await hydrateStandardModeFromDb();
        await hydrateHeatSurgeConfigsFromDb();
        await hydrateModeCorruptionBandsFromDb();
      } catch (error) {
        console.warn("Failed to hydrate mode tuning for new game", error.message);
      }

      for (const player of room.players.values()) {
        player.currentGameParticipant = player.connected && !player.waitingForNextGame;
        player.assetsLoaded = false;
      }
      const host = room.players.get(room.creatorPlayerId);
      const hasEntitlement = Boolean(host?.entitlementExpiresAtMs && host.entitlementExpiresAtMs > Date.now());
      room.phase = "play";
      const selectedModeId = hasEntitlement ? (room.selectedModeId || "standard") : "standard";
      room.game = createGameState(selectedModeId);
      room.game.status = "loading";
      room.game.isPreview = !hasEntitlement;
      room.game.previewEndsAtMs = room.game.isPreview ? (Date.now() + 60000) : null;
      clearPreviewTimer(room);
      updateRoomStatus({ roomCode: roomId, status: "active" }).catch((error) => console.error("DB room active update failed", error));
      logRoomHistoryEvent({ roomCode: roomId, eventType: "room_started", fromStatus: "lobby", toStatus: "active" }).catch((error) => console.error("DB room history start failed", error));
      clearRoomGameTimers(room);
      if (room.game.isPreview) {
        room.previewTimer = setTimeout(() => {
          room.previewTimer = null;
          if (!rooms.has(roomId) || room.phase !== "play" || room.game?.status !== "active") return;
          room.game.status = "gameover";
          room.game.killScreen = {
            score: room.game.score,
            combo: room.game.combo,
            correctAnswer: "-",
            causeLabel: "preview ended",
            wasLastChanceActive: false,
            decisivePlayers: []
          };
          room.game.lastRoundResult = {
            passed: false,
            correctAnswer: "-",
            failingPlayers: [],
            wasLastChanceActive: false
          };
          for (const p of room.players.values()) {
            p.ready = false;
            p.waitingForNextGame = false;
          }
          emitState(roomId);
        }, 60000);
        registerTimer(room, room.previewTimer);
      }
    }
  };



  const maybeStartLoadedGame = (room, roomId) => {
    if (room.phase !== "play" || room.game?.status !== "loading") return;

    const participants = Array.from(room.players.values()).filter((player) => player.currentGameParticipant && !player.waitingForNextGame);
    if (participants.length < 2) return;

    const everyoneLoaded = participants.every((player) => player.assetsLoaded);
    if (!everyoneLoaded) return;

    room.game.status = "active";
    room.game.startedAtMs = Date.now();
    room.game.reconnectCountdownStartedAtMs = null;
    scheduleNextRound(room, roomId, 3000);
    emitState(roomId);
  };

  const maybePauseForDisconnectedParticipants = (room, roomId) => {
    if (room.phase !== "play" || room.game?.status !== "active") {
      return;
    }

    const disconnectedParticipant = Array.from(room.players.values()).some(
      (player) => player.currentGameParticipant && !player.waitingForNextGame && !player.connected
    );
    if (!disconnectedParticipant) {
      return;
    }

    room.game.status = "paused";
    room.game.currentRound = null;
    room.game.lastRoundResult = null;
    clearRoomGameTimers(room);
  };

  const maybeResumePausedGame = (room, roomId) => {
    if (room.phase !== "play" || room.game?.status !== "paused") {
      return;
    }

    const activeParticipants = Array.from(room.players.values()).filter(
      (player) => player.currentGameParticipant && !player.waitingForNextGame
    );
    if (activeParticipants.length < 2) {
      return;
    }

    const allParticipantsConnected = activeParticipants.every((player) => player.connected);
    if (!allParticipantsConnected) {
      return;
    }

    room.game.status = "active";
    clearRoomGameTimers(room);
    room.game.reconnectCountdownStartedAtMs = Date.now();
    scheduleNextRound(room, roomId, 3000);
  };

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("player:register", async ({ profileId, name }, callback) => {
      const nextProfileId = profileId || createRandomId();
      try {
        await upsertPlayerProfile({ profileId: nextProfileId, displayName: name || null });
        const entitlementExpiry = await getActivePlayerProfileEntitlement({ profileId: nextProfileId });
        const entitledModeKeys = await getActiveEntitledModeKeys({ profileId: nextProfileId });
        const entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId: nextProfileId });
        callback?.({ profileId: nextProfileId, entitlementExpiresAtMs: entitlementExpiry ? new Date(entitlementExpiry).getTime() : null, entitledModeKeys, entitledModeExpiriesMs });
      } catch (error) {
        callback?.({ error: "Failed to register player" });
      }
    });

    socket.on("room:create", async ({ name, profileId, selectedModeId }, callback) => {
      const roomId = generateRoomCode();
      const playerId = profileId || createRandomId();
      const sessionToken = createSessionToken();

      const room = {
        id: roomId,
        phase: "lobby",
        players: new Map(),
        creatorPlayerId: playerId,
        creatorDisconnectTimer: null,
        game: null,
        gameTimers: [],
        selectedModeId: "standard",
        availableModes: []
      };

      room.players.set(playerId, {
        playerId,
        socketId: socket.id,
        sessionToken,
        name: name || "Host",
        connected: true,
        connectionState: CONNECTION_STATES.CONNECTED,
        connectionStateChangedAtMs: Date.now(),
        reconnectingStartedAtMs: null,
        disconnectedAtMs: null,
        reconnectTimer: null,
        pingMs: null,
        color: getAvailableColor(room),
        ready: false,
        waitingForNextGame: false,
        currentGameParticipant: false,
        assetsLoaded: false,
        position: getSpawnPosition(0),
        profileId: playerId,
        entitlementExpiresAtMs: null,
        entitledModeKeys: [],
        entitledModeExpiriesMs: {}
      });

      rooms.set(roomId, room);
      socket.join(roomId);

      try {
        await upsertPlayerProfile({ profileId: playerId, displayName: name || "Host" });
        const entitlementExpiry = await getActivePlayerProfileEntitlement({ profileId: playerId });
        const entitledModeKeys = await getActiveEntitledModeKeys({ profileId: playerId });
        const entitlementExpiresAtMs = entitlementExpiry ? new Date(entitlementExpiry).getTime() : null;
        room.players.get(playerId).entitlementExpiresAtMs = entitlementExpiresAtMs;
        room.players.get(playerId).entitledModeKeys = entitledModeKeys;
        room.players.get(playerId).entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId: playerId });

        try {
          room.availableModes = await getGameModesFromDb();
          await hydrateHeatSurgeConfigsFromDb();
          await hydrateModeCorruptionBandsFromDb();
        } catch (error) {
          room.availableModes = getGameModesFallback();
        }

        const normalizedSelectedModeId = normalizeModeId(selectedModeId);
        room.selectedModeId = (normalizedSelectedModeId && entitledModeKeys.includes(normalizedSelectedModeId)) ? normalizedSelectedModeId : "standard";
        await createRoomRecord({ roomCode: roomId });
        await addPlayerRecord({ roomCode: roomId, playerId, displayName: name || "Host", isHost: true, slot: 1 });
        await logRoomHistoryEvent({ roomCode: roomId, eventType: "room_created", actorPlayerId: playerId, toStatus: "lobby", metadata: { selectedModeId: room.selectedModeId } });
        await logRoomHistoryEvent({ roomCode: roomId, eventType: "room_joined", actorPlayerId: playerId, toStatus: "lobby", metadata: { isHost: true } });
      } catch (error) {
        console.error("DB room:create persistence failed", error);
        persistError({ roomCode: roomId, playerId, source: "room:create", message: error.message, stackTrace: error.stack, context: { name, profileId } });
      }

      const allowedModeIds = new Set((room.availableModes || []).map((mode) => mode.id));
      if (!allowedModeIds.has(room.selectedModeId)) {
        room.selectedModeId = "standard";
      }
      if (callback) callback({ roomId, playerId, sessionToken, state: getRoomState(roomId) });
      emitState(roomId);
    });

    socket.on("room:join", async ({ roomId, name, profileId }, callback) => {
      const normalizedRoomId = String(roomId || "").toUpperCase();
      const room = rooms.get(normalizedRoomId);

      if (!room) {
        if (callback) callback({ error: "Room not found" });
        return;
      }

      if (room.players.size >= 4) {
        if (callback) callback({ error: "Room full" });
        return;
      }

      const playerId = profileId || createRandomId();
      const sessionToken = createSessionToken();
      const waitingForNextGame = room.phase === "play" && room.game?.status === "active";

      room.players.set(playerId, {
        playerId,
        socketId: socket.id,
        sessionToken,
        name: name || "Player",
        connected: true,
        connectionState: CONNECTION_STATES.CONNECTED,
        connectionStateChangedAtMs: Date.now(),
        reconnectingStartedAtMs: null,
        disconnectedAtMs: null,
        reconnectTimer: null,
        pingMs: null,
        color: getAvailableColor(room),
        ready: false,
        waitingForNextGame,
        currentGameParticipant: false,
        assetsLoaded: false,
        position: getSpawnPosition(room.players.size),
        entitlementExpiresAtMs: null,
        entitledModeKeys: [],
        entitledModeExpiriesMs: {}
      });

      socket.join(normalizedRoomId);

      try {
        await upsertPlayerProfile({ profileId: playerId, displayName: name || "Player" });
        const entitlementExpiry = await getActivePlayerProfileEntitlement({ profileId: playerId });
        room.players.get(playerId).entitlementExpiresAtMs = entitlementExpiry ? new Date(entitlementExpiry).getTime() : null;
        room.players.get(playerId).entitledModeKeys = await getActiveEntitledModeKeys({ profileId: playerId });
        room.players.get(playerId).entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId: playerId });
        await addPlayerRecord({ roomCode: normalizedRoomId, playerId, displayName: name || "Player", isHost: false, slot: room.players.size });
        await logRoomHistoryEvent({ roomCode: normalizedRoomId, eventType: "room_joined", actorPlayerId: playerId, toStatus: room.phase === "play" ? "active" : "lobby" });
      } catch (error) {
        console.error("DB room:join persistence failed", error);
        persistError({ roomCode: normalizedRoomId, playerId, source: "room:join", message: error.message, stackTrace: error.stack, context: { name, profileId } });
      }

      if (callback) callback({ roomId: normalizedRoomId, playerId, sessionToken, state: getRoomState(normalizedRoomId) });
      emitState(normalizedRoomId);
    });

    socket.on("room:rejoin", async ({ roomId, sessionToken }, callback) => {
      const normalizedRoomId = String(roomId || "").toUpperCase();
      const room = rooms.get(normalizedRoomId);
      if (!room) {
        const creatorTimedOut = consumeCreatorTimeoutNotice(sessionToken);
        if (callback) {
          callback(creatorTimedOut
            ? { error: "Creator timed out", code: "CREATOR_TIMED_OUT" }
            : { error: "Room not found", code: "ROOM_NOT_FOUND" });
        }
        return;
      }

      const player = Array.from(room.players.values()).find((candidate) => candidate.sessionToken === sessionToken);
      if (!player) {
        if (callback) callback({ error: "Session not found" });
        return;
      }

      clearPlayerReconnectTimer(player);
      applyPlayerConnectionState(player, CONNECTION_STATES.CONNECTED, { socketId: socket.id });
      persistConnectionState(player, CONNECTION_STATES.CONNECTED, "reconnect");

      try {
        const entitlementExpiry = await getActivePlayerProfileEntitlement({ profileId: player.playerId });
        player.entitlementExpiresAtMs = entitlementExpiry ? new Date(entitlementExpiry).getTime() : null;
        player.entitledModeKeys = await getActiveEntitledModeKeys({ profileId: player.playerId });
        player.entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId: player.playerId });
      } catch (error) {
        console.error("DB room:rejoin entitlement refresh failed", error);
      }

      if (room.creatorPlayerId === player.playerId) {
        clearCreatorDisconnectTimer(room);
        if (room.hostUnlockingPending) {
          const hasEntitlement = Boolean(player.entitlementExpiresAtMs && player.entitlementExpiresAtMs > Date.now());
          if (room.game?.isPreview) {
            room.game.isPreview = !hasEntitlement;
            if (!room.game.isPreview) {
              room.game.previewEndsAtMs = null;
              clearPreviewTimer(room);
            }
          }
          room.hostUnlockingPending = false;
          room.unlockingStartedAtMs = null;
          room.unlockingPreviousHasEntitlement = null;
          room.unlockingProductName = null;
        }
      }

      socket.join(normalizedRoomId);

      maybeResumePausedGame(room, normalizedRoomId);
      if (callback) callback({ roomId: normalizedRoomId, playerId: player.playerId, sessionToken: player.sessionToken, state: getRoomState(normalizedRoomId) });
      emitState(normalizedRoomId);
    });

    socket.on("room:leave", ({ roomId, playerId }, callback) => {
      const room = rooms.get(roomId);
      if (!room) {
        if (callback) callback({ error: "Room not found" });
        return;
      }

      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id) {
        if (callback) callback({ error: "Not allowed" });
        return;
      }

      if (room.creatorPlayerId === playerId) {
        disbandRoom(io, roomId, "Room creator left the room", socket.id);
        if (callback) callback({ ok: true, disbanded: true });
        return;
      }

      room.players.delete(playerId);
      logRoomHistoryEvent({ roomCode: roomId, eventType: "room_left", actorPlayerId: playerId }).catch((error) => console.error("DB room history left failed", error));
      deletePlayerRecord(playerId).catch((error) => console.error("DB delete player failed", error));
      socket.leave(roomId);

      if (room.players.size === 0) {
        clearRoomGameTimers(room);
        rooms.delete(roomId);
        logRoomHistoryEvent({ roomCode: roomId, eventType: "room_deleted", actorPlayerId: playerId }).catch((error) => console.error("DB room history deleted failed", error));
        deleteRoomRecord(roomId).catch((error) => console.error("DB delete room failed", error));
      } else {
        if (room.phase === "play" && room.game?.status === "active" && room.players.size === 1) {
          const [remainingPlayer] = room.players.values();
          room.phase = "lobby";
          room.game = null;
          updateRoomStatus({ roomCode: roomId, status: "lobby" }).catch((error) => console.error("DB room lobby update failed", error));
          clearRoomGameTimers(room);
          for (const candidate of room.players.values()) {
            candidate.ready = false;
            candidate.waitingForNextGame = false;
            candidate.currentGameParticipant = false;
          }
          emitWarning(
            roomId,
            "Not enough players to continue. Returning to lobby.",
            remainingPlayer?.playerId
          );
        }
        emitState(roomId);
      }

      if (callback) callback({ ok: true });
    });

    socket.on("player:setColor", ({ roomId, playerId, color }, callback) => {
      const room = rooms.get(roomId);
      if (!room) {
        if (callback) callback({ error: "Room not found" });
        return;
      }

      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id) {
        if (callback) callback({ error: "Not allowed" });
        return;
      }

      if (room.phase !== "lobby") {
        if (callback) callback({ error: "Color can only be changed in lobby" });
        return;
      }

      if (!PLAYER_COLORS.includes(color)) {
        if (callback) callback({ error: "Invalid color" });
        return;
      }

      const colorTaken = Array.from(room.players.values()).some((candidate) => candidate.playerId !== playerId && candidate.color === color);
      if (colorTaken) {
        if (callback) callback({ error: "That color is already taken" });
        return;
      }

      player.color = color;
      player.ready = false;
      emitState(roomId);
      if (callback) callback({ ok: true });
    });

    socket.on("player:setReady", async ({ roomId, playerId, ready }, callback) => {
      const room = rooms.get(roomId);
      if (!room) {
        if (callback) callback({ error: "Room not found" });
        return;
      }

      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id) {
        if (callback) callback({ error: "Not allowed" });
        return;
      }

      const isLobbyPhase = room.phase === "lobby";
      const isGameOverPhase = room.phase === "play" && room.game?.status === "gameover";
      if (!isLobbyPhase && !isGameOverPhase) {
        if (callback) callback({ error: "Cannot change ready state right now" });
        return;
      }

      if (room.hostUnlockingPending && room.creatorPlayerId !== playerId) {
        if (callback) callback({ error: "Host is currently unlocking. Please wait." });
        return;
      }

      player.ready = Boolean(ready);
      updatePlayerReady({ playerId, isReady: player.ready }).catch((error) => console.error("DB ready update failed", error));
      await maybeAdvanceToPlayPhase(room, roomId);
      emitState(roomId);
      if (callback) callback({ ok: true });
    });


    socket.on("room:setMode", ({ roomId, playerId, modeId }, callback) => {
      const room = rooms.get(roomId);
      if (!room) return callback?.({ error: "Room not found" });
      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id) return callback?.({ error: "Not allowed" });
      if (room.creatorPlayerId !== playerId) return callback?.({ error: "Only host can change mode" });

      const normalizedModeId = normalizeModeId(modeId);
      const entitledModeKeys = new Set(player.entitledModeKeys || []);
      if (!entitledModeKeys.has(normalizedModeId)) return callback?.({ error: "Store purchase required for this mode" });

      const allowedModeIds = new Set((room.availableModes || []).map((mode) => mode.id));
      if (!allowedModeIds.has(normalizedModeId)) return callback?.({ error: "Invalid mode" });

      room.selectedModeId = normalizedModeId;
      emitState(roomId);
      callback?.({ ok: true });
    });

    socket.on("entitlement:purchase:start", async ({ roomId, playerId, productKey }, callback) => {
      const room = rooms.get(roomId);
      if (!room) {
        callback?.({ error: "Room not found" });
        return;
      }

      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id || room.creatorPlayerId !== playerId) {
        callback?.({ error: "Not allowed" });
        return;
      }

      let product = null;
      try {
        product = await getProductByKey(productKey || "glitch_party_pack");
      } catch (error) {
        console.error("DB purchase product lookup failed", error);
        callback?.({ error: "Failed to look up product" });
        return;
      }

      if (!product?.product_name) {
        callback?.({ error: "Product not found or inactive" });
        return;
      }

      room.hostUnlockingPending = true;
      room.unlockingStartedAtMs = Date.now();
      room.unlockingPreviousHasEntitlement = Boolean(player.entitlementExpiresAtMs && player.entitlementExpiresAtMs > Date.now());
      room.unlockingProductName = product.product_name;
      for (const candidate of room.players.values()) {
        candidate.ready = false;
      }
      emitState(roomId);
      callback?.({ ok: true });
    });

    socket.on("entitlement:purchase:result", ({ roomId, playerId, success }, callback) => {
      const room = rooms.get(roomId);
      if (!room) return callback?.({ error: "Room not found" });
      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id || room.creatorPlayerId !== playerId) {
        return callback?.({ error: "Not allowed" });
      }

      const purchaseSucceeded = Boolean(success);
      if (!purchaseSucceeded) {
        room.hostUnlockingPending = false;
        room.unlockingStartedAtMs = null;
        room.unlockingPreviousHasEntitlement = null;
        room.unlockingProductName = null;
      }

      io.to(room.id).emit("entitlement:purchase:result", {
        success: purchaseSucceeded,
        roomId: room.id
      });
      emitState(room.id);
      return callback?.({ ok: true });
    });

    socket.on("entitlement:purchase", async ({ playerId }, callback) => {
      try {
        await upsertPlayerProfile({ profileId: playerId, displayName: null });
        const productKey = "glitch_party_pack";
        const expiresAt = await grantPlayerProfileEntitlement({ profileId: playerId, productKey });
        const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : Date.now() + (24 * 60 * 60 * 1000);

        for (const room of rooms.values()) {
          const player = room.players.get(playerId);
          if (!player) continue;

          player.entitlementExpiresAtMs = expiresAtMs;
          player.entitledModeKeys = await getActiveEntitledModeKeys({ profileId: playerId });
          player.entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId: playerId });
          const isHost = room.creatorPlayerId === playerId;
          if (isHost) {
            room.hostUnlockingPending = false;
            room.unlockingStartedAtMs = null;
            room.unlockingPreviousHasEntitlement = null;
            room.unlockingProductName = null;

            if (room.game?.isPreview) {
              room.game.isPreview = false;
              room.game.previewEndsAtMs = null;
              clearPreviewTimer(room);
            }
          }

          io.to(room.id).emit("room:state", getRoomState(room.id));
        }

        callback?.({ ok: true, expiresAtMs });
      } catch (error) {
        callback?.({ error: "Failed to purchase entitlement" });
      }
    });

    socket.on("game:assetsLoaded", ({ roomId, playerId }, callback) => {
      const room = rooms.get(roomId);
      if (!room || room.phase !== "play") {
        callback?.({ error: "Match is not in play phase" });
        return;
      }

      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id) {
        callback?.({ error: "Not allowed" });
        return;
      }

      if (!player.currentGameParticipant || player.waitingForNextGame) {
        callback?.({ ok: true });
        return;
      }

      player.assetsLoaded = true;
      callback?.({ ok: true });
      maybeStartLoadedGame(room, roomId);
      emitState(roomId);
    });

    socket.on("game:submit", ({ roomId, playerId, answer }, callback) => {
      const room = rooms.get(roomId);
      if (!room || room.phase !== "play") {
        if (callback) callback({ error: "Match is not in play phase" });
        return;
      }

      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id) {
        if (callback) callback({ error: "Not allowed" });
        return;
      }

      const game = room.game;
      const round = game?.currentRound;
      if (!round || game?.status !== "active") {
        if (callback) callback({ ok: true });
        return;
      }

      if (round.playerAnswers[playerId]) {
        if (callback) callback({ ok: true });
        return;
      }

      if (!["sync", "glitch"].includes(answer)) {
        if (callback) callback({ error: "Invalid answer" });
        return;
      }

      round.playerAnswers[playerId] = answer;
      emitState(roomId);
      if (callback) callback({ ok: true });

      const activePlayerIds = Array.from(room.players.values())
        .filter((candidate) => candidate.connected && !candidate.waitingForNextGame)
        .map((candidate) => candidate.playerId);

      const everyoneAnswered = activePlayerIds.every((activePlayerId) => Boolean(round.playerAnswers[activePlayerId]));
      if (everyoneAnswered) {
        resolveRound(room, roomId, round.id);
      }
    });

    socket.on("time:sync:ping", ({ clientSentAt }, callback) => {
      if (callback) {
        callback({ clientSentAt, serverTime: Date.now() });
      }
    });

    socket.on("player:ping", ({ roomId, playerId, pingMs }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id) return;

      const normalizedPingMs = Math.round(Number(pingMs));
      if (!Number.isFinite(normalizedPingMs) || normalizedPingMs < 0) return;

      player.pingMs = normalizedPingMs;
      const transition = updatePlayerLatencyState(player, normalizedPingMs);
      if (transition) {
        persistConnectionState(player, transition.connectionState, "latency");
        emitState(roomId);
      }
    });

    socket.on("disconnect", () => {
      for (const [roomId, room] of rooms.entries()) {
        for (const player of room.players.values()) {
          if (player.socketId === socket.id) {
            const isHost = room.creatorPlayerId === player.playerId;
            const isUnlockingHost = isHost && room.hostUnlockingPending;
            if (isUnlockingHost) {
              applyPlayerConnectionState(player, CONNECTION_STATES.DEGRADED);
              persistConnectionState(player, CONNECTION_STATES.DEGRADED, "unlocking-host");
            } else {
              applyPlayerConnectionState(player, CONNECTION_STATES.RECONNECTING);
              schedulePlayerDisconnectedState(room, roomId, player, socket.id);
              persistConnectionState(player, CONNECTION_STATES.RECONNECTING, "disconnect");
            }
            player.ready = false;

            if (isHost) {
              if (isUnlockingHost) {
                for (const candidate of room.players.values()) {
                  candidate.ready = false;
                }
              }
              scheduleCreatorDisband(io, roomId, { extendedGraceMs: isUnlockingHost });
            }

            maybePauseForDisconnectedParticipants(room, roomId);
            emitState(roomId);
            break;
          }
        }
      }
    });
  });
}

module.exports = {
  registerSocketHandlers
};
