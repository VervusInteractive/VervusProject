const {
  rooms,
  getRoomState,
  generateUniqueRoomCode,
  createRandomId,
  createSessionToken,
  MIN_PLAYERS_PER_ROOM,
  MAX_PLAYERS_PER_ROOM,
  PLAYER_COLORS,
  consumeCreatorTimeoutNotice,
  hasExpiredRoomNotice,
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
  getPlayerProfileIdBySessionToken,
  createEntitlementTransferToken,
  consumeEntitlementTransferToken,
  getProductByKey,
  recordAnalyticsEvent,
  recordGameSessionStart,
  recordGameSessionEnd,
  logRoomHistoryEvent,
  logErrorEntry,
  updateRoomStatus
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
const { getDifficultyProfile, normalizeModeId, hydrateGameModesFromDb, hydrateHeatSurgeConfigsFromDb, hydrateModeCorruptionBandsFromDb, getGameModesFromDb, getGameModesFallback } = require("./gameModes");
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
const { createSocketRateLimitGuard, getClientIp, parsePositiveInt } = require("./rateLimit");

const ROOM_JOIN_ERROR_CODES = Object.freeze({
  NOT_FOUND: "ROOM_NOT_FOUND",
  FULL: "ROOM_FULL",
  EXPIRED: "ROOM_EXPIRED"
});

function registerSocketHandlers(io) {
  startRoomCleanupScheduler(io);

  const SOCKET_EVENT_RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.SOCKET_EVENT_RATE_LIMIT_WINDOW_MS, 10 * 1000);
  const SOCKET_EVENT_RATE_LIMIT_MAX = parsePositiveInt(process.env.SOCKET_EVENT_RATE_LIMIT_MAX, 80);
  const SOCKET_JOIN_RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.SOCKET_JOIN_RATE_LIMIT_WINDOW_MS, 60 * 1000);
  const SOCKET_JOIN_RATE_LIMIT_MAX = parsePositiveInt(process.env.SOCKET_JOIN_RATE_LIMIT_MAX, 12);
  const SOCKET_ROOM_CODE_RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.SOCKET_ROOM_CODE_RATE_LIMIT_WINDOW_MS, 60 * 1000);
  const SOCKET_ROOM_CODE_RATE_LIMIT_MAX = parsePositiveInt(process.env.SOCKET_ROOM_CODE_RATE_LIMIT_MAX, 20);

  const socketEventLimiter = createSocketRateLimitGuard({
    windowMs: SOCKET_EVENT_RATE_LIMIT_WINDOW_MS,
    max: SOCKET_EVENT_RATE_LIMIT_MAX,
    keyPrefix: "socket:event",
    keyGenerator: (socket, eventName) => `${getClientIp(socket)}:${socket.data?.profileId || socket.id}:${eventName}`
  });
  const socketJoinLimiter = createSocketRateLimitGuard({
    windowMs: SOCKET_JOIN_RATE_LIMIT_WINDOW_MS,
    max: SOCKET_JOIN_RATE_LIMIT_MAX,
    keyPrefix: "socket:join",
    keyGenerator: (socket) => `${getClientIp(socket)}:${socket.data?.profileId || socket.id}`
  });
  const roomCodeProbeLimiter = createSocketRateLimitGuard({
    windowMs: SOCKET_ROOM_CODE_RATE_LIMIT_WINDOW_MS,
    max: SOCKET_ROOM_CODE_RATE_LIMIT_MAX,
    keyPrefix: "socket:room-code",
    keyGenerator: (socket, roomId) => `${getClientIp(socket)}:${roomId || "invalid"}`
  });

  const normalizeSocketPayload = (payload) => (payload && typeof payload === "object" ? payload : {});
  const resolveSocketProfileId = async (socket, payload = {}) => {
    const existingProfileId = normalizeUuid(socket.data.profileId);
    if (existingProfileId) return existingProfileId;

    const token = typeof payload.profileSessionToken === "string" ? payload.profileSessionToken.trim() : "";
    if (!token) return null;

    const profileId = normalizeUuid(await getPlayerProfileIdBySessionToken({ token }));
    if (profileId) {
      socket.data.profileId = profileId;
      joinProfileSocketRoom(socket, profileId);
    }
    return profileId;
  };
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

  const getConnectedPlayerCount = (room) => Array.from(room?.players?.values?.() || [])
    .filter((player) => player.connected).length;

  const isRoomOpenForJoin = (room) => {
    if (!room) return false;
    if ([ROOM_STATUSES.ENDED, ROOM_STATUSES.EXPIRED].includes(room.status)) return false;

    const isPlayableRoom = room.phase === "play" && ["active", "gameover"].includes(room.game?.status);
    return room.phase === "lobby" || isPlayableRoom;
  };

  const buildRoomPreview = (roomId, room) => {
    const selectedModeId = room.selectedModeId || "standard";
    const selectedMode = (room.availableModes || []).find((mode) => mode.id === selectedModeId);
    const players = Array.from(room.players.values());

    return {
      roomId,
      phase: room.phase,
      status: room.status || room.phase,
      currentPlayerCount: players.length,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      playerNames: players.map((player) => player.name).filter(Boolean),
      selectedModeId,
      selectedModeTitle: selectedMode?.title || "GLiTCH!",
      joinable: isRoomOpenForJoin(room) && players.length < MAX_PLAYERS_PER_ROOM,
      isFull: players.length >= MAX_PLAYERS_PER_ROOM
    };
  };
  const isRoomExpiredOrEnded = (room) => [ROOM_STATUSES.ENDED, ROOM_STATUSES.EXPIRED].includes(room?.status);

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

  const getProfileSocketRoom = (profileId) => `profile:${profileId}`;

  const joinProfileSocketRoom = (socket, profileId) => {
    const normalizedProfileId = normalizeUuid(profileId);
    if (!normalizedProfileId) return;
    socket.join(getProfileSocketRoom(normalizedProfileId));
  };

  const notifyEntitlementTransferCompleted = (profileId) => {
    const normalizedProfileId = normalizeUuid(profileId);
    if (!normalizedProfileId) return;

    io.to(getProfileSocketRoom(normalizedProfileId)).emit("entitlement:transfer:completed", {
      message: "Your entitlement was transferred to another device. Refreshing entitlements…"
    });
  };

  const persistError = (payload) => {
    logErrorEntry(payload).catch((dbError) => console.error("DB error log failed", dbError));
  };

  const PREVIEW_COMBO_LIMIT = parsePositiveInt(process.env.PREVIEW_COMBO_LIMIT, 10);

  const clearPreviewTimer = (room) => {
    if (!room?.previewTimer) return;
    clearTimeout(room.previewTimer);
    room.previewTimer = null;
  };

  const endPreviewAtComboLimit = (room, roomId) => {
    if (!rooms.has(roomId) || room.phase !== "play" || room.game?.status !== "active" || !room.game?.isPreview) {
      return;
    }

    room.game.status = "gameover";
    room.game.killScreen = {
      score: room.game.score,
      combo: room.game.combo,
      correctAnswer: "-",
      causeLabel: "preview ended",
      wasLastChanceActive: false,
      decisivePlayers: [],
      realityCheck: buildKillScreenRealityCheck(room, room.game.currentRound)
    };
    room.game.lastRoundResult = {
      passed: false,
      correctAnswer: "-",
      failingPlayers: [],
      wasLastChanceActive: false
    };
    prepareRoomForGameOverScreen(room, roomId, {
      causeLabel: "preview ended",
      isPreview: true,
      previewComboLimit: room.game.previewComboLimit
    });
    emitState(roomId);
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
      if (activePlayers.length < MIN_PLAYERS_PER_ROOM) {
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
      recordAnalyticsEvent({
        eventName: "round_started",
        profileId: room.creatorPlayerId,
        roomCode: roomId,
        modeKey: room.game.modeId,
        metadata: {
          roundNumber: round.roundNumber,
          isPreview: room.game.isPreview,
          isReplay: Boolean(replayRound),
          heatSurgeActive: Boolean(round.heatSurgeActive),
          deviationType: round.deviationType,
          isGlitchRound: Boolean(round.isGlitchRound),
          corruptionIntensityLevel: round.corruptionEffects?.intensityLevel || 0
        }
      }).catch((error) => console.error("DB round analytics event failed", error));

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

  const prepareRoomForGameOverScreen = (room, roomId, metadata = {}) => {
    room.phase = "play";
    room.expiresAtMs = null;
    room.preReconnectStatus = null;
    if (room.game) {
      room.game.previewEndsAtMs = null;
    }
    clearPreviewTimer(room);
    clearRoomGameTimers(room);
    touchRoom(room);
    if (room.game && !room.game.analyticsEnded) {
      const completedGame = room.game;
      completedGame.analyticsEnded = true;
      const sessionEndPayload = {
        sessionId: completedGame.analyticsSessionId,
        roomCode: roomId,
        finalCombo: completedGame.combo,
        highestCombo: completedGame.highestCombo ?? completedGame.combo,
        endReason: metadata.causeLabel || metadata.reason || "game_over",
        metadata: {
          ...metadata,
          score: completedGame.score,
          modeId: completedGame.modeId,
          isPreview: completedGame.isPreview,
          analyticsRunId: completedGame.analyticsRunId || null,
          startedAtMs: completedGame.startedAtMs || null,
          playerCount: Array.from(room.players.values()).filter((player) => player.currentGameParticipant).length
        }
      };
      const hasSessionStartPromise = Boolean(completedGame.analyticsSessionStartPromise);
      Promise.resolve(completedGame.analyticsSessionStartPromise)
        .catch(() => null)
        .then((session) => {
          const resolvedSessionId = completedGame.analyticsSessionId || session?.id || sessionEndPayload.sessionId;
          return recordGameSessionEnd({
            ...sessionEndPayload,
            sessionId: resolvedSessionId,
            analyticsRunId: completedGame.analyticsRunId || null
          });
        })
        .then((session) => {
          if (session?.id) completedGame.analyticsSessionId = session.id;
          if (hasSessionStartPromise && !session?.id) {
            console.warn("DB game session end did not match an open session", { roomId, analyticsRunId: completedGame.analyticsRunId || null });
          }
        })
        .catch((error) => console.error("DB game session end failed", error));
      recordAnalyticsEvent({
        eventName: completedGame.isPreview ? "preview_completed" : "game_completed",
        profileId: room.creatorPlayerId,
        roomCode: roomId,
        modeKey: completedGame.modeId,
        sessionId: completedGame.analyticsRunId || completedGame.analyticsSessionId || null,
        metadata: {
          ...metadata,
          score: completedGame.score,
          finalCombo: completedGame.combo,
          highestCombo: completedGame.highestCombo ?? completedGame.combo,
          isPreview: completedGame.isPreview,
          analyticsRunId: completedGame.analyticsRunId || null
        }
      }).catch((error) => console.error("DB completion analytics event failed", error));
    }
    logRoomHistoryEvent({
      roomCode: roomId,
      eventType: "room_ended",
      fromStatus: room.status || ROOM_STATUSES.PREMIUM,
      toStatus: ROOM_STATUSES.ENDED,
      metadata: { reason: "game_over", ...metadata }
    }).catch((error) => console.error("DB room history game over failed", error));

    for (const player of room.players.values()) {
      player.ready = false;
      player.waitingForNextGame = false;
      player.assetsLoaded = false;
    }
  };

  const buildKillScreenRealityCheck = (room, round) => {
    if (!round) {
      return {
        expectedAnswer: null,
        deviationLabel: null,
        standardStimulus: null,
        alteredStimulus: null,
        standardPlayers: [],
        alteredPlayers: []
      };
    }

    const standardPlayers = [];
    const alteredPlayers = [];
    const playerStimuli = round.playerStimuli || {};

    for (const [playerId, stimulus] of Object.entries(playerStimuli)) {
      const player = room.players.get(playerId);
      const entry = {
        playerId,
        name: player?.name || "Unknown",
        stimulus,
        input: round.playerAnswers?.[playerId] || null
      };

      if (stimulus === round.baseIcon) {
        standardPlayers.push(entry);
      } else {
        alteredPlayers.push(entry);
      }
    }

    return {
      expectedAnswer: round.expectedAnswer || null,
      deviationLabel: round.deviationLabel || null,
      standardStimulus: round.baseIcon || null,
      alteredStimulus: alteredPlayers[0]?.stimulus || null,
      standardPlayers,
      alteredPlayers
    };
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
    room.game.killScreen = {
      score: room.game.score,
      combo: room.game.combo,
      correctAnswer: evaluation.correctAnswer,
      causeLabel: evaluation.causeLabel,
      wasLastChanceActive,
      decisivePlayers,
      realityCheck: buildKillScreenRealityCheck(room, round)
    };

    room.game.lastRoundResult = {
      passed: false,
      correctAnswer: evaluation.correctAnswer,
      failingPlayers: decisivePlayers.map((player) => player.name),
      wasLastChanceActive
    };
    prepareRoomForGameOverScreen(room, roomId, {
      causeLabel: evaluation.causeLabel,
      wasLastChanceActive
    });

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
      room.game.highestCombo = Math.max(room.game.highestCombo || 0, room.game.combo);
      room.game.score += 1;
      room.game.lastRoundResult = {
        passed: true,
        correctAnswer: evaluation.correctAnswer,
        failingPlayers: [],
        wasLastChanceActive: round.isLastChanceReplay
      };
      emitState(roomId);

      if (room.game.isPreview && Number.isFinite(room.game.previewComboLimit) && room.game.combo >= room.game.previewComboLimit) {
        const difficulty = getDifficultyProfile(room.game.modeId, room.game.combo);
        const previewEndDelayMs = difficulty.roundResultLockMs + difficulty.transitionBeatMs;
        const previewEndTimer = setTimeout(() => {
          unregisterTimer(room, previewEndTimer);
          endPreviewAtComboLimit(room, roomId);
        }, previewEndDelayMs);
        registerTimer(room, previewEndTimer);
        return;
      }

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
    if ((!canStartFromLobby && !canRestartFromGameOver) || getConnectedPlayerCount(room) < MIN_PLAYERS_PER_ROOM) {
      return;
    }

    const allReady = Array.from(room.players.values()).every(
      (player) => player.ready && player.connected
    );

    if (allReady) {
      try {
        await hydrateGameModesFromDb();
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
      const hasSelectedModeEntitlement = Boolean(room.debugUnlockAllModes) || Boolean(
        hostModeExpiryMs &&
        hostModeExpiryMs > Date.now() &&
        (host?.entitledModeKeys || []).includes(requestedModeId)
      );
      room.phase = "play";
      const selectedModeId = hasSelectedModeEntitlement ? requestedModeId : "standard";
      room.game = createGameState(selectedModeId);
      room.game.analyticsRunId = createRandomId();
      room.game.status = "loading";
      room.game.isPreview = !hasSelectedModeEntitlement;
      room.game.previewComboLimit = room.game.isPreview ? PREVIEW_COMBO_LIMIT : null;
      room.game.previewEndsAtMs = null;
      room.expiresAtMs = hasSelectedModeEntitlement ? hostModeExpiryMs : null;
      clearPreviewTimer(room);
      transitionRoomStatus(room, roomId, hasSelectedModeEntitlement ? ROOM_STATUSES.PREMIUM : ROOM_STATUSES.PREVIEW, {
        eventType: "room_started",
        metadata: {
          modeId: selectedModeId,
          isPreview: !hasSelectedModeEntitlement,
          expiresAtMs: room.expiresAtMs,
          previewComboLimit: room.game.previewComboLimit
        }
      });
      clearRoomGameTimers(room);
    }
  };



  const maybeStartLoadedGame = (room, roomId) => {
    if (room.phase !== "play" || room.game?.status !== "loading") return;

    const participants = Array.from(room.players.values()).filter((player) => player.currentGameParticipant && !player.waitingForNextGame);
    if (participants.length < MIN_PLAYERS_PER_ROOM) return;

    const everyoneLoaded = participants.every((player) => player.assetsLoaded);
    if (!everyoneLoaded) return;

    room.game.status = "active";
    room.game.startedAtMs = Date.now();
    room.game.highestCombo = Math.max(room.game.highestCombo || 0, room.game.combo || 0);
    room.game.reconnectCountdownStartedAtMs = null;
    const activeGame = room.game;
    const analyticsRunId = activeGame.analyticsRunId || createRandomId();
    activeGame.analyticsRunId = analyticsRunId;
    activeGame.analyticsSessionStartPromise = recordGameSessionStart({
      roomCode: roomId,
      modeKey: activeGame.modeId,
      isPreview: activeGame.isPreview,
      playerCount: participants.length,
      metadata: {
        previewComboLimit: activeGame.previewComboLimit,
        expiresAtMs: room.expiresAtMs,
        analyticsRunId
      }
    }).then((session) => {
      if (session?.id && room.game === activeGame && activeGame.analyticsRunId === analyticsRunId) {
        activeGame.analyticsSessionId = session.id;
      }
      return session;
    }).catch((error) => console.error("DB game session start failed", error));
    recordAnalyticsEvent({
      eventName: activeGame.isPreview ? "preview_started" : "game_started",
      profileId: room.creatorPlayerId,
      roomCode: roomId,
      modeKey: activeGame.modeId,
      sessionId: analyticsRunId,
      metadata: {
        playerCount: participants.length,
        previewComboLimit: activeGame.previewComboLimit,
        expiresAtMs: room.expiresAtMs,
        analyticsRunId
      }
    }).catch((error) => console.error("DB start analytics event failed", error));
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
    if (activeParticipants.length < MIN_PLAYERS_PER_ROOM) {
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
    joinProfileSocketRoom(socket, socket.data.profileId);

    socket.use((packet, next) => {
      const eventName = typeof packet?.[0] === "string" ? packet[0] : "unknown";
      const payload = normalizeSocketPayload(packet?.[1]);
      const eventLimit = socketEventLimiter(socket, eventName);
      const callback = Array.isArray(packet) && typeof packet[packet.length - 1] === "function" ? packet[packet.length - 1] : null;

      if (!eventLimit.allowed) {
        const response = { error: "Too many socket events", code: "RATE_LIMITED", retryAfterMs: eventLimit.retryAfterMs };
        socket.emit("rate_limit", { event: eventName, retryAfterMs: eventLimit.retryAfterMs });
        callback?.(response);
        return;
      }

      if (["room:preview", "room:join", "room:rejoin"].includes(eventName)) {
        const normalizedRoomId = normalizeRoomCode(payload.roomId);
        const isJoinAttempt = ["room:join", "room:rejoin"].includes(eventName);
        const joinLimit = isJoinAttempt
          ? socketJoinLimiter(socket, eventName)
          : { allowed: true, retryAfterMs: 0 };
        const probeLimit = roomCodeProbeLimiter(socket, isValidRoomCode(normalizedRoomId) ? normalizedRoomId : "invalid");
        if (!joinLimit.allowed || !probeLimit.allowed) {
          const retryAfterMs = Math.max(joinLimit.retryAfterMs, probeLimit.retryAfterMs);
          const response = {
            error: isJoinAttempt ? "Too many room join attempts" : "Too many room lookup attempts",
            code: "RATE_LIMITED",
            retryAfterMs
          };
          socket.emit("rate_limit", { event: eventName, retryAfterMs });
          callback?.(response);
          return;
        }
      }

      next();
    });

    socket.on("player:register", async (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const nextProfileId = await resolveSocketProfileId(socket, payload);
      const displayName = normalizePlayerName(payload.name, "Player");
      if (!nextProfileId) return callback?.({ error: "Session required" });
      joinProfileSocketRoom(socket, nextProfileId);
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

    socket.on("room:preview", (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const normalizedRoomId = normalizeRoomCode(payload.roomId);
      if (!isValidRoomCode(normalizedRoomId)) {
        callback?.({ found: false });
        return;
      }

      const room = rooms.get(normalizedRoomId);
      if (!room) {
        callback?.({
          found: false,
          code: hasExpiredRoomNotice(normalizedRoomId)
            ? ROOM_JOIN_ERROR_CODES.EXPIRED
            : ROOM_JOIN_ERROR_CODES.NOT_FOUND
        });
        return;
      }

      callback?.({ found: true, room: buildRoomPreview(normalizedRoomId, room) });
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
      const playerId = await resolveSocketProfileId(socket, payload);
      const displayName = normalizePlayerName(payload.name, "Host");
      if (!playerId) return callback?.({ error: "Session required" });
      const selectedModeId = payload.selectedModeId;
      const debugUnlockAllModes = normalizeBoolean(payload.debugUnlockAllModes);
      const sessionToken = createSessionToken();

      const room = {
        id: roomId,
        phase: "lobby",
        players: new Map(),
        creatorPlayerId: playerId,
        creatorDisconnectTimer: null,
        game: null,
        gameTimers: [],
        debugUnlockAllModes,
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
        clockOffsetMs: null,
        timeSyncJitterMs: null,
        timeSyncQuality: "syncing",
        lastTimeSyncAtMs: null,
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
          await hydrateGameModesFromDb();
          await hydrateHeatSurgeConfigsFromDb();
          await hydrateModeCorruptionBandsFromDb();
        } catch (error) {
          room.availableModes = getGameModesFallback();
        }

        const normalizedSelectedModeId = normalizeModeId(selectedModeId);
        const debugEntitledModeKeys = debugUnlockAllModes ? (room.availableModes || []).map((mode) => mode.id).filter(Boolean) : [];
        if (debugUnlockAllModes && debugEntitledModeKeys.length) {
          room.players.get(playerId).entitledModeKeys = debugEntitledModeKeys;
          room.players.get(playerId).entitlementExpiresAtMs = Date.now() + (24 * 60 * 60 * 1000);
        }
        const selectableModeKeys = debugUnlockAllModes ? debugEntitledModeKeys : entitledModeKeys;
        room.selectedModeId = (normalizedSelectedModeId && selectableModeKeys.includes(normalizedSelectedModeId)) ? normalizedSelectedModeId : "standard";
        await createRoomRecord({ roomCode: roomId, selectedModeId: room.selectedModeId });
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
        if (callback) {
          callback(hasExpiredRoomNotice(normalizedRoomId)
            ? { error: "Room expired", code: ROOM_JOIN_ERROR_CODES.EXPIRED }
            : { error: "Room not found", code: ROOM_JOIN_ERROR_CODES.NOT_FOUND });
        }
        return;
      }

      if (isRoomExpiredOrEnded(room)) {
        if (callback) callback({ error: "Room expired", code: ROOM_JOIN_ERROR_CODES.EXPIRED });
        return;
      }

      if (!isRoomOpenForJoin(room)) {
        if (callback) callback({ error: "Room is no longer accepting players" });
        return;
      }

      if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
        if (callback) callback({ error: "Room full", code: ROOM_JOIN_ERROR_CODES.FULL });
        return;
      }

      const playerId = await resolveSocketProfileId(socket, payload);
      if (!playerId) return callback?.({ error: "Session required" });
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
        clockOffsetMs: null,
        timeSyncJitterMs: null,
        timeSyncQuality: "syncing",
        lastTimeSyncAtMs: null,
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
              room.game.previewComboLimit = null;
              room.game.previewEndsAtMs = null;
              clearPreviewTimer(room);
            }
          }
          room.hostUnlockingPending = false;
          room.unlockingStartedAtMs = null;
          room.unlockingPreviousHasEntitlement = null;
          room.unlockingProductName = null;
          room.expiresAtMs = hasEntitlement ? player.entitlementExpiresAtMs : null;
          const returnStatus = room.phase === "play" && hasEntitlement ? ROOM_STATUSES.PREMIUM : ROOM_STATUSES.LOBBY;
          transitionRoomStatus(room, normalizedRoomId, returnStatus, {
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
        if (room.phase === "play" && room.game?.status === "active" && room.players.size < MIN_PLAYERS_PER_ROOM) {
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

    socket.on("room:kickPlayer", (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const roomId = normalizeRoomCode(payload.roomId);
      const playerId = normalizeUuid(payload.playerId);
      const targetPlayerId = normalizeUuid(payload.targetPlayerId);
      const room = rooms.get(roomId);
      if (!room) return callback?.({ error: "Room not found" });

      const host = room.players.get(playerId);
      if (!host || host.socketId !== socket.id || room.creatorPlayerId !== playerId) {
        return callback?.({ error: "Only the host can remove players" });
      }

      if (targetPlayerId === playerId) {
        return callback?.({ error: "Use leave room to exit as host" });
      }

      const targetPlayer = room.players.get(targetPlayerId);
      if (!targetPlayer) return callback?.({ error: "Player not found" });

      const canRemoveNow = room.phase === "lobby" || (room.phase === "play" && room.game?.status === "gameover");
      if (!canRemoveNow) {
        return callback?.({ error: "Players can only be removed while waiting in the lobby" });
      }

      clearPlayerReconnectTimer(targetPlayer);
      room.players.delete(targetPlayerId);
      logRoomHistoryEvent({
        roomCode: roomId,
        eventType: "room_left",
        actorPlayerId: targetPlayerId,
        metadata: { reason: "host_removed", removedByPlayerId: playerId }
      }).catch((error) => console.error("DB room history host remove failed", error));
      deletePlayerRecord(targetPlayerId).catch((error) => console.error("DB delete removed player failed", error));

      const targetSocket = targetPlayer.socketId ? io.sockets.sockets.get(targetPlayer.socketId) : null;
      if (targetSocket) {
        targetSocket.leave(roomId);
        targetSocket.emit("room:disbanded", {
          roomId,
          reason: "You were removed from the room by the host."
        });
      }

      emitState(roomId);
      callback?.({ ok: true });
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

      if (room.creatorPlayerId === playerId && ready && room.hostUnlockingFailed) {
        room.hostUnlockingFailed = false;
        room.hostUnlockingFailedAtMs = null;
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
      const allowedModeIds = new Set((room.availableModes || []).map((mode) => mode.id));
      if (normalizeBoolean(payload.debugUnlockAllModes)) {
        room.debugUnlockAllModes = true;
        player.entitledModeKeys = Array.from(allowedModeIds);
        player.entitlementExpiresAtMs = Date.now() + (24 * 60 * 60 * 1000);
      }

      const entitledModeKeys = new Set(player.entitledModeKeys || []);
      if (!room.debugUnlockAllModes && !entitledModeKeys.has(normalizedModeId)) return callback?.({ error: "Store purchase required for this mode" });

      if (!allowedModeIds.has(normalizedModeId)) return callback?.({ error: "Invalid mode" });

      const previousModeId = room.selectedModeId || "standard";
      room.selectedModeId = normalizedModeId;
      updateRoomStatus({
        roomCode: roomId,
        status: room.status || ROOM_STATUSES.LOBBY,
        metadata: { selectedModeId: normalizedModeId }
      }).catch((error) => console.error("DB room mode update failed", error));
      logRoomHistoryEvent({
        roomCode: roomId,
        eventType: "settings_changed",
        actorPlayerId: playerId,
        fromStatus: room.status || ROOM_STATUSES.LOBBY,
        toStatus: room.status || ROOM_STATUSES.LOBBY,
        metadata: { setting: "mode", previousModeId, selectedModeId: normalizedModeId }
      }).catch((error) => console.error("DB room history mode change failed", error));
      emitState(roomId);
      callback?.({ ok: true });
    });

    socket.on("entitlement:transfer:create", async (payload = {}, callback) => {
      payload = normalizeSocketPayload(payload);
      const profileId = normalizeUuid(socket.data.profileId);
      if (!profileId) return callback?.({ error: "Session required" });

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
      const targetProfileId = normalizeUuid(socket.data.profileId);
      const displayName = normalizePlayerName(payload.name, "Player");
      if (!targetProfileId) return callback?.({ error: "Session required" });
      if (!token) return callback?.({ error: "Invalid or expired entitlement transfer link" });

      try {
        const claimed = await consumeEntitlementTransferToken({ token, targetProfileId, displayName });
        if (!claimed) return callback?.({ error: "Invalid, expired, or already-used entitlement transfer link" });
        notifyEntitlementTransferCompleted(claimed.sourceProfileId);
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
      room.hostUnlockingFailed = false;
      room.hostUnlockingFailedAtMs = null;
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
        const fallbackStatus = room.phase === "play" && room.game?.isPreview ? ROOM_STATUSES.PREVIEW : ROOM_STATUSES.LOBBY;
        room.hostUnlockingPending = false;
        room.hostUnlockingFailed = true;
        room.hostUnlockingFailedAtMs = Date.now();
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
      const serverReceivedAt = Date.now();
      payload = normalizeSocketPayload(payload);
      const clientSentAt = typeof payload.clientSentAt === "number" ? payload.clientSentAt : null;
      const sequence = Number.isInteger(payload.sequence) ? payload.sequence : null;
      if (callback) {
        callback({
          clientSentAt,
          sequence,
          serverTime: serverReceivedAt,
          serverReceivedAt,
          serverSentAt: Date.now()
        });
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
      const clockOffsetMs = typeof payload.clockOffsetMs === "number" && Number.isFinite(payload.clockOffsetMs)
        ? Math.round(payload.clockOffsetMs)
        : null;
      const timeSyncJitterMs = typeof payload.timeSyncJitterMs === "number" && Number.isFinite(payload.timeSyncJitterMs)
        ? Math.max(0, Math.round(payload.timeSyncJitterMs))
        : null;
      const timeSyncQuality = ["syncing", "synced", "degraded"].includes(payload.timeSyncQuality)
        ? payload.timeSyncQuality
        : null;

      const previousClockOffsetMs = player.clockOffsetMs;
      const previousTimeSyncJitterMs = player.timeSyncJitterMs;
      const previousTimeSyncQuality = player.timeSyncQuality;
      const previousLastTimeSyncAtMs = player.lastTimeSyncAtMs || 0;

      if (clockOffsetMs !== null) player.clockOffsetMs = clockOffsetMs;
      if (timeSyncJitterMs !== null) player.timeSyncJitterMs = timeSyncJitterMs;
      if (timeSyncQuality) player.timeSyncQuality = timeSyncQuality;
      player.lastTimeSyncAtMs = Date.now();

      const syncTelemetryChanged = Math.abs((player.clockOffsetMs ?? 0) - (previousClockOffsetMs ?? 0)) >= 10
        || Math.abs((player.timeSyncJitterMs ?? 0) - (previousTimeSyncJitterMs ?? 0)) >= 10
        || player.timeSyncQuality !== previousTimeSyncQuality
        || player.lastTimeSyncAtMs - previousLastTimeSyncAtMs >= 10000;
      const transition = updatePlayerLatencyState(player, normalizedPingMs);
      if (transition) {
        persistConnectionState(player, transition.connectionState, "latency");
      }
      if (transition || syncTelemetryChanged) {
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
