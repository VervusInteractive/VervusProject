const {
  rooms,
  getRoomState,
  generateUniqueRoomCode,
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
  deleteRoomRecord,
  upsertPlayerProfile,
  getActivePlayerProfileEntitlement,
  getActiveEntitledModeKeys,
  getActiveEntitlementExpiriesByMode,
  createEntitlementTransferToken,
  consumeEntitlementTransferToken,
  getProductByKey,
  logRoomHistoryEvent,
  logErrorEntry
} = require("./db");
const {
  ROOM_STATUSES,
  clearCreatorDisconnectTimer,
  clearRoomGameTimers,
  disbandRoom,
  initializeRoomLifecycle,
  startRoomCleanupScheduler,
  touchRoom,
  transitionRoomStatus,
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
const {
  normalizeAnswer,
  normalizeBoolean,
  normalizePlayerName,
  normalizeProductKey,
  normalizePingMs,
  normalizeRoomCode,
  normalizeUuid,
  isValidRoomCode
} = require("./validation");

function registerSocketHandlers(io) {
  startRoomCleanupScheduler(io);

  const normalizeSocketPayload = (payload) => (payload && typeof payload === "object" ? payload : {});
  const normalizeEntitlementTransferToken = (value) => {
    const normalized = String(value || "").trim();
    return /^[A-Za-z0-9_-]{32,128}$/.test(normalized) ? normalized : null;
  };


  const emitState = (roomId) => {
    touchRoom(rooms.get(roomId));
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
    timerId.unref?.();
    return timerId;
  };

  const unregisterTimer = (room, timerId) => {
    if (!room?.gameTimers) return;
    room.gameTimers = room.gameTimers.filter((candidate) => candidate !== timerId);
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
      unregisterTimer(room, timer);
      if (!rooms.has(roomId) || room.phase !== "play" || room.game?.status !== "active") {
        return;
      }

      const activePlayers = Array.from(room.players.values()).filter(
        (player) => player.connected && !player.waitingForNextGame
      );
      if (activePlayers.length < 2) {
        room.game.status = "paused";
        room.preReconnectStatus = room.status || (room.game?.isPreview ? ROOM_STATUSES.PREVIEW : ROOM_STATUSES.PREMIUM);
        transitionRoomStatus(room, roomId, ROOM_STATUSES.RECONNECTING, {
          eventType: "settings_changed",
          metadata: { reason: "not_enough_active_players", previousStatus: room.preReconnectStatus }
        });
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

      const endDelayMs = Math.max(0, round.decisionDeadlineMs - Date.now());
      const endTimer = setTimeout(() => {
        unregisterTimer(room, endTimer);
        resolveRound(room, roomId, round.id);
      }, endDelayMs);
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
    transitionRoomStatus(room, roomId, ROOM_STATUSES.ENDED, {
      eventType: "room_ended",
      metadata: { causeLabel: evaluation.causeLabel, wasLastChanceActive }
    });
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
      .filter((player) => player.connected && player.currentGameParticipant && !player.waitingForNextGame)
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
      const requestedModeId = room.selectedModeId || "standard";
      const hostModeExpiryMs = host?.entitledModeExpiriesMs?.[requestedModeId] ?? null;
      const hasSelectedModeEntitlement = Boolean(
        hostModeExpiryMs &&
        hostModeExpiryMs > Date.now() &&
        (host?.entitledModeKeys || []).includes(requestedModeId)
      );
      room.phase = "play";
      const selectedModeId = hasSelectedModeEntitlement ? requestedModeId : "standard";
      room.game = createGameState(selectedModeId);
      room.game.status = "loading";
      room.game.isPreview = !hasSelectedModeEntitlement;
      room.game.previewEndsAtMs = room.game.isPreview ? (Date.now() + 60000) : null;
      room.expiresAtMs = hasSelectedModeEntitlement ? hostModeExpiryMs : room.game.previewEndsAtMs;
      clearPreviewTimer(room);
      transitionRoomStatus(room, roomId, hasSelectedModeEntitlement ? ROOM_STATUSES.PREMIUM : ROOM_STATUSES.PREVIEW, {
        eventType: "room_started",
        metadata: { modeId: selectedModeId, isPreview: !hasSelectedModeEntitlement, expiresAtMs: room.expiresAtMs }
      });
      clearRoomGameTimers(room);
      if (room.game.isPreview) {
        room.previewTimer = setTimeout(() => {
          unregisterTimer(room, room.previewTimer);
          room.previewTimer = null;
          if (!rooms.has(roomId) || room.phase !== "play" || room.game?.status !== "active") return;
          room.game.status = "gameover";
          room.expiresAtMs = null;
          transitionRoomStatus(room, roomId, ROOM_STATUSES.ENDED, {
            eventType: "room_ended",
            metadata: { causeLabel: "preview ended", isPreview: true }
          });
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
    room.preReconnectStatus = room.status || (room.game?.isPreview ? ROOM_STATUSES.PREVIEW : ROOM_STATUSES.PREMIUM);
    transitionRoomStatus(room, roomId, ROOM_STATUSES.RECONNECTING, {
      eventType: "settings_changed",
      metadata: { reason: "participant_disconnected", previousStatus: room.preReconnectStatus }
    });
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
    transitionRoomStatus(room, roomId, room.preReconnectStatus || (room.game?.isPreview ? ROOM_STATUSES.PREVIEW : ROOM_STATUSES.PREMIUM), {
      eventType: "settings_changed",
      metadata: { reason: "participants_reconnected" }
    });
    room.preReconnectStatus = null;
    clearRoomGameTimers(room);
    room.game.reconnectCountdownStartedAtMs = Date.now();
    scheduleNextRound(room, roomId, 3000);
  };

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("player:register", async (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const nextProfileId = normalizeUuid(payload.profileId) || createRandomId();
      const displayName = normalizePlayerName(payload.name, "Player");
      try {
        await upsertPlayerProfile({ profileId: nextProfileId, displayName });
        const entitlementExpiry = await getActivePlayerProfileEntitlement({ profileId: nextProfileId });
        const entitledModeKeys = await getActiveEntitledModeKeys({ profileId: nextProfileId });
        const entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId: nextProfileId });
        callback?.({ profileId: nextProfileId, entitlementExpiresAtMs: entitlementExpiry ? new Date(entitlementExpiry).getTime() : null, entitledModeKeys, entitledModeExpiriesMs });
      } catch (error) {
        callback?.({ error: "Failed to register player" });
      }
    });

    socket.on("room:create", async (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      let roomId;
      try {
        roomId = generateUniqueRoomCode();
      } catch (error) {
        callback?.({ error: "Could not allocate room code" });
        return;
      }
      const playerId = normalizeUuid(payload.profileId) || createRandomId();
      const displayName = normalizePlayerName(payload.name, "Host");
      const selectedModeId = payload.selectedModeId;
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
      initializeRoomLifecycle(room, ROOM_STATUSES.LOBBY);

      room.players.set(playerId, {
        playerId,
        socketId: socket.id,
        sessionToken,
        name: displayName,
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
        await upsertPlayerProfile({ profileId: playerId, displayName });
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
        await addPlayerRecord({ roomCode: roomId, playerId, displayName, isHost: true, slot: 1 });
        await logRoomHistoryEvent({ roomCode: roomId, eventType: "room_created", actorPlayerId: playerId, toStatus: "lobby", metadata: { selectedModeId: room.selectedModeId } });
        await logRoomHistoryEvent({ roomCode: roomId, eventType: "room_joined", actorPlayerId: playerId, toStatus: "lobby", metadata: { isHost: true } });
      } catch (error) {
        console.error("DB room:create persistence failed", error);
        persistError({ roomCode: roomId, playerId, source: "room:create", message: error.message, stackTrace: error.stack, context: { name: displayName, profileId: playerId } });
      }

      const allowedModeIds = new Set((room.availableModes || []).map((mode) => mode.id));
      if (!allowedModeIds.has(room.selectedModeId)) {
        room.selectedModeId = "standard";
      }
      if (callback) callback({ roomId, playerId, sessionToken, state: getRoomState(roomId) });
      emitState(roomId);
    });

    socket.on("room:join", async (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const normalizedRoomId = normalizeRoomCode(payload.roomId);
      if (!isValidRoomCode(normalizedRoomId)) {
        callback?.({ error: "Invalid room code" });
        return;
      }
      const room = rooms.get(normalizedRoomId);

      if (!room) {
        if (callback) callback({ error: "Room not found" });
        return;
      }

      if (room.players.size >= 4) {
        if (callback) callback({ error: "Room full" });
        return;
      }

      const playerId = normalizeUuid(payload.profileId) || createRandomId();
      if (room.players.has(playerId)) {
        callback?.({ error: "Player is already in this room. Rejoin with the saved session instead." });
        return;
      }
      const displayName = normalizePlayerName(payload.name, "Player");
      const sessionToken = createSessionToken();
      const waitingForNextGame = room.phase === "play" && room.game?.status === "active";

      room.players.set(playerId, {
        playerId,
        socketId: socket.id,
        sessionToken,
        name: displayName,
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
        await upsertPlayerProfile({ profileId: playerId, displayName });
        const entitlementExpiry = await getActivePlayerProfileEntitlement({ profileId: playerId });
        room.players.get(playerId).entitlementExpiresAtMs = entitlementExpiry ? new Date(entitlementExpiry).getTime() : null;
        room.players.get(playerId).entitledModeKeys = await getActiveEntitledModeKeys({ profileId: playerId });
        room.players.get(playerId).entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId: playerId });
        await addPlayerRecord({ roomCode: normalizedRoomId, playerId, displayName, isHost: false, slot: room.players.size });
        await logRoomHistoryEvent({ roomCode: normalizedRoomId, eventType: "room_joined", actorPlayerId: playerId, toStatus: room.status || (room.phase === "play" ? "premium" : "lobby") });
      } catch (error) {
        console.error("DB room:join persistence failed", error);
        persistError({ roomCode: normalizedRoomId, playerId, source: "room:join", message: error.message, stackTrace: error.stack, context: { name: displayName, profileId: playerId } });
      }

      if (callback) callback({ roomId: normalizedRoomId, playerId, sessionToken, state: getRoomState(normalizedRoomId) });
      emitState(normalizedRoomId);
    });

    socket.on("room:rejoin", async (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const normalizedRoomId = normalizeRoomCode(payload.roomId);
      const sessionToken = typeof payload.sessionToken === "string" ? payload.sessionToken : "";
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
          room.expiresAtMs = hasEntitlement ? player.entitlementExpiresAtMs : null;
          transitionRoomStatus(room, normalizedRoomId, hasEntitlement ? ROOM_STATUSES.PREMIUM : (room.game?.status === "gameover" ? ROOM_STATUSES.ENDED : ROOM_STATUSES.LOBBY), {
            eventType: "settings_changed",
            metadata: { reason: "host_returned_from_payment", hasEntitlement }
          });
        }
      }

      socket.join(normalizedRoomId);

      maybeResumePausedGame(room, normalizedRoomId);
      if (callback) callback({ roomId: normalizedRoomId, playerId: player.playerId, sessionToken: player.sessionToken, state: getRoomState(normalizedRoomId) });
      emitState(normalizedRoomId);
    });

    socket.on("room:leave", (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const roomId = normalizeRoomCode(payload.roomId);
      const playerId = normalizeUuid(payload.playerId);
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
          room.expiresAtMs = null;
          transitionRoomStatus(room, roomId, ROOM_STATUSES.LOBBY, {
            eventType: "settings_changed",
            metadata: { reason: "not_enough_players" }
          });
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

    socket.on("player:setColor", (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const roomId = normalizeRoomCode(payload.roomId);
      const playerId = normalizeUuid(payload.playerId);
      const color = typeof payload.color === "string" ? payload.color : "";
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

    socket.on("player:setReady", async (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const roomId = normalizeRoomCode(payload.roomId);
      const playerId = normalizeUuid(payload.playerId);
      const ready = normalizeBoolean(payload.ready);
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

      if (!player.connected) {
        if (callback) callback({ error: "Cannot change ready state while disconnected" });
        return;
      }

      player.ready = ready;
      updatePlayerReady({ playerId, isReady: player.ready }).catch((error) => console.error("DB ready update failed", error));
      await maybeAdvanceToPlayPhase(room, roomId);
      emitState(roomId);
      if (callback) callback({ ok: true });
    });


    socket.on("room:setMode", (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const roomId = normalizeRoomCode(payload.roomId);
      const playerId = normalizeUuid(payload.playerId);
      const modeId = payload.modeId;
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

    socket.on("entitlement:transfer:create", async (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const profileId = normalizeUuid(payload.profileId);
      if (!profileId) return callback?.({ error: "Invalid profile" });

      try {
        const transfer = await createEntitlementTransferToken({ sourceProfileId: profileId });
        if (!transfer) return callback?.({ error: "No active entitlement to transfer" });
        callback?.({
          ok: true,
          token: transfer.token,
          expiresAtMs: transfer.expiresAt ? new Date(transfer.expiresAt).getTime() : null
        });
      } catch (error) {
        console.error("DB entitlement transfer create failed", error);
        callback?.({ error: "Failed to create entitlement transfer link" });
      }
    });

    socket.on("entitlement:transfer:claim", async (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const token = normalizeEntitlementTransferToken(payload.token);
      const targetProfileId = normalizeUuid(payload.targetProfileId) || createRandomId();
      const displayName = normalizePlayerName(payload.name, "Player");
      if (!token) return callback?.({ error: "Invalid or expired entitlement transfer link" });

      try {
        const claimed = await consumeEntitlementTransferToken({ token, targetProfileId, displayName });
        if (!claimed) return callback?.({ error: "Invalid, expired, or already-used entitlement transfer link" });
        for (const [candidateRoomId, candidateRoom] of rooms.entries()) {
          const sourcePlayer = candidateRoom.players.get(claimed.sourceProfileId);
          if (!sourcePlayer) continue;
          sourcePlayer.entitlementExpiresAtMs = null;
          sourcePlayer.entitledModeKeys = [];
          sourcePlayer.entitledModeExpiriesMs = {};
          if (candidateRoom.creatorPlayerId === claimed.sourceProfileId && candidateRoom.phase === "lobby") {
            candidateRoom.selectedModeId = "standard";
          }
          emitState(candidateRoomId);
        }
        const entitlementExpiry = await getActivePlayerProfileEntitlement({ profileId: targetProfileId });
        const entitledModeKeys = await getActiveEntitledModeKeys({ profileId: targetProfileId });
        const entitledModeExpiriesMs = await getActiveEntitlementExpiriesByMode({ profileId: targetProfileId });
        callback?.({
          ok: true,
          profileId: targetProfileId,
          entitlementExpiresAtMs: entitlementExpiry ? new Date(entitlementExpiry).getTime() : null,
          entitledModeKeys,
          entitledModeExpiriesMs
        });
      } catch (error) {
        console.error("DB entitlement transfer claim failed", error);
        callback?.({ error: "Failed to claim entitlement transfer link" });
      }
    });

    socket.on("entitlement:purchase:start", async (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const roomId = normalizeRoomCode(payload.roomId);
      const playerId = normalizeUuid(payload.playerId);
      const productKey = normalizeProductKey(payload.productKey);
      if (!productKey) return callback?.({ error: "Invalid product" });
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
      transitionRoomStatus(room, roomId, ROOM_STATUSES.PAYMENT_PENDING, {
        eventType: "settings_changed",
        metadata: { productKey: productKey || "glitch_party_pack", productName: product.product_name }
      });
      room.unlockingPreviousHasEntitlement = Boolean(player.entitlementExpiresAtMs && player.entitlementExpiresAtMs > Date.now());
      room.unlockingProductName = product.product_name;
      for (const candidate of room.players.values()) {
        candidate.ready = false;
      }
      emitState(roomId);
      callback?.({ ok: true });
    });

    socket.on("entitlement:purchase:result", (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const roomId = normalizeRoomCode(payload.roomId);
      const playerId = normalizeUuid(payload.playerId);
      const success = normalizeBoolean(payload.success);
      const room = rooms.get(roomId);
      if (!room) return callback?.({ error: "Room not found" });
      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id || room.creatorPlayerId !== playerId) {
        return callback?.({ error: "Not allowed" });
      }

      const purchaseSucceeded = Boolean(success);
      if (!purchaseSucceeded) {
        const fallbackStatus = room.game?.status === "gameover" ? ROOM_STATUSES.ENDED : (room.game?.isPreview ? ROOM_STATUSES.PREVIEW : ROOM_STATUSES.LOBBY);
        room.hostUnlockingPending = false;
        room.unlockingStartedAtMs = null;
        room.unlockingPreviousHasEntitlement = null;
        room.unlockingProductName = null;
        transitionRoomStatus(room, room.id, fallbackStatus, {
          eventType: "settings_changed",
          metadata: { reason: "payment_not_completed" }
        });
      }

      io.to(room.id).emit("entitlement:purchase:result", {
        success: purchaseSucceeded,
        roomId: room.id
      });
      emitState(room.id);
      return callback?.({ ok: true });
    });

    socket.on("entitlement:purchase", (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      callback?.({ error: "Entitlements are activated only by the Stripe webhook" });
    });

    socket.on("game:assetsLoaded", (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const roomId = normalizeRoomCode(payload.roomId);
      const playerId = normalizeUuid(payload.playerId);
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

    socket.on("game:submit", (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const roomId = normalizeRoomCode(payload.roomId);
      const playerId = normalizeUuid(payload.playerId);
      const answer = normalizeAnswer(payload.answer);
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

      if (!player.currentGameParticipant || player.waitingForNextGame || !player.connected) {
        if (callback) callback({ error: "Only active game participants can submit" });
        return;
      }

      if (round.isResolved || Date.now() > round.decisionDeadlineMs) {
        if (callback) callback({ error: "Round deadline passed" });
        return;
      }

      if (round.playerAnswers[playerId]) {
        if (callback) callback({ ok: true });
        return;
      }

      if (!answer) {
        if (callback) callback({ error: "Invalid answer" });
        return;
      }

      round.playerAnswers[playerId] = answer;
      emitState(roomId);
      if (callback) callback({ ok: true });

      const activePlayerIds = Array.from(room.players.values())
        .filter((candidate) => candidate.connected && candidate.currentGameParticipant && !candidate.waitingForNextGame)
        .map((candidate) => candidate.playerId);

      const everyoneAnswered = activePlayerIds.every((activePlayerId) => Boolean(round.playerAnswers[activePlayerId]));
      if (everyoneAnswered) {
        resolveRound(room, roomId, round.id);
      }
    });

    socket.on("time:sync:ping", (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const clientSentAt = typeof payload.clientSentAt === "number" ? payload.clientSentAt : null;
      if (callback) {
        callback({ clientSentAt, serverTime: Date.now() });
      }
    });

    socket.on("player:ping", (payload = {}) => {
      payload = normalizeSocketPayload(payload);
      const roomId = normalizeRoomCode(payload.roomId);
      const playerId = normalizeUuid(payload.playerId);
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player || player.socketId !== socket.id) return;

      const normalizedPingMs = normalizePingMs(payload.pingMs);
      if (normalizedPingMs === null) return;

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
