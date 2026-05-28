import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import LobbyPage from "./components/LobbyPage";
import RoomPage from "./components/RoomPage";
import GlitchGamePage from "./components/GlitchGamePage";
import SoloChaosLabPage from "./components/SoloChaosLabPage";
import "./App.css";
import voteSendSoundFile from "./assets/audio/Sound_VoteSend.mp3";
import clickSoundFile from "./assets/audio/Sound_Click.mp3";
import successPurchaseSoundFile from "./assets/audio/Sound_SuccessPurchase.mp3";
import failedPurchaseSoundFile from "./assets/audio/Sound_FailedPurchase.mp3";
import { preloadAudioElement } from "./audioPreload";

const serverUrl = import.meta.env.VITE_SERVER_URL;
const socket = io(serverUrl);
const PENDING_PURCHASE_STORAGE_KEY = "pendingPurchaseCheckout";
const PURCHASE_RESULT_TO_EMIT_STORAGE_KEY = "purchaseResultToEmit";
const PENDING_PURCHASE_SOUND_STORAGE_KEY = "pendingPurchaseSoundEffect";
const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
const initialRoomFromQuery = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() || "";
const ROOM_VIEW_PREFERENCE_KEY = "roomViewPreference";
const LOBBY_MODE_OPTIONS = [
  { id: "standard", title: "GLiTCH!" },
  { id: "blitz", title: "GLiTCH! Blitz" },
  { id: "chaos", title: "GLiTCH! Chaos" }
];

const DEFAULT_MODE_DEBUG_CONFIGS = [
  {
    id: "standard",
    title: "GLiTCH!",
    roundResultLockMs: 500,
    transitionBeatMs: 300,
    hasLastChance: true,
    allowPartialBreak: false,
    curve: [
      { minCombo: 0, timerMs: 5000, glitchChance: 0.15, shapeSwapChance: 1, falseTwinChance: 0, readableTwinChance: 1 }
    ],
    heatSurgeConfig: null
  },
  { id: "blitz", title: "GLiTCH! Blitz", curve: [], heatSurgeConfig: null },
  { id: "chaos", title: "GLiTCH! Chaos", curve: [], heatSurgeConfig: null }
];

const voteSendAudio = preloadAudioElement(voteSendSoundFile);
const clickAudio = preloadAudioElement(clickSoundFile);
const successPurchaseAudio = preloadAudioElement(successPurchaseSoundFile);
const failedPurchaseAudio = preloadAudioElement(failedPurchaseSoundFile);
const AUDIO_POOL_SIZE = 6;

const AUDIO_DEBUG_ENABLED = new URLSearchParams(window.location.search).get("audioDebug") === "1";
const getAudioSnapshot = (audio) => {
  if (!audio) return null;
  return {
    paused: audio.paused,
    ended: audio.ended,
    currentTime: Number.isFinite(audio.currentTime) ? Number(audio.currentTime.toFixed(3)) : audio.currentTime,
    readyState: audio.readyState,
    networkState: audio.networkState,
    muted: audio.muted,
    volume: audio.volume
  };
};

const logAudioDebug = (event, details = {}) => {
  if (!AUDIO_DEBUG_ENABLED) return;
  const payload = {
    ts: new Date().toISOString(),
    visibility: document.visibilityState,
    unlocked: isAudioUnlocked,
    event,
    ...details
  };
  console.log("[audio-debug]", payload);
  window.__audioDebugEvents = window.__audioDebugEvents || [];
  window.__audioDebugEvents.push(payload);
  if (window.__audioDebugEvents.length > 300) window.__audioDebugEvents.shift();
};

const createAudioPool = (baseAudio) => {
  if (!baseAudio) return [];
  return Array.from({ length: AUDIO_POOL_SIZE }, (_, index) => {
    if (index === 0) return baseAudio;
    const clone = baseAudio.cloneNode(true);
    clone.preload = "auto";
    clone.load();
    return clone;
  });
};

const clickAudioPool = createAudioPool(clickAudio);
const voteSendAudioPool = createAudioPool(voteSendAudio);
const successPurchaseAudioPool = createAudioPool(successPurchaseAudio);
const failedPurchaseAudioPool = createAudioPool(failedPurchaseAudio);

let audioUnlockInFlight = null;
let isAudioUnlocked = false;

const unlockAudioPools = () => {
  if (isAudioUnlocked) return Promise.resolve(true);
  if (audioUnlockInFlight) return audioUnlockInFlight;

  const allPools = [
    clickAudioPool,
    voteSendAudioPool,
    successPurchaseAudioPool,
    failedPurchaseAudioPool
  ];

  audioUnlockInFlight = Promise.allSettled(
    allPools.flat().map((audio, index) => {
      if (!audio) return Promise.resolve(false);
      logAudioDebug("unlock:attempt", { index, stateBefore: getAudioSnapshot(audio) });
      const previousTime = audio.currentTime;
      audio.muted = true;
      audio.currentTime = 0;
      return audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = previousTime;
          audio.muted = false;
          logAudioDebug("unlock:success", { index, stateAfter: getAudioSnapshot(audio) });
          return true;
        })
        .catch(() => {
          audio.currentTime = previousTime;
          audio.muted = false;
          logAudioDebug("unlock:failed", { index, stateAfter: getAudioSnapshot(audio) });
          return false;
        });
    })
  ).then((results) => {
    const didUnlock = results.some((result) => result.status === "fulfilled" && result.value === true);
    logAudioDebug("unlock:complete", { didUnlock, settledCount: results.length });
    isAudioUnlocked = didUnlock;
    return didUnlock;
  }).finally(() => {
    audioUnlockInFlight = null;
  });

  return audioUnlockInFlight;
};

const playFromPool = (pool, soundKey = "unknown") => {
  if (!pool.length) return Promise.resolve(false);

  const pickPlayableAudio = () => pool.find((audio) => audio.paused || audio.ended) || pool[0];

  const attemptPlay = (audio, attemptLabel = "attempt") => {
    if (!audio) return Promise.resolve(false);
    const audioIndex = pool.indexOf(audio);
    logAudioDebug("play:attempt", { soundKey, attemptLabel, audioIndex, stateBefore: getAudioSnapshot(audio) });
    audio.pause();
    audio.muted = false;
    audio.currentTime = 0;
    return audio.play()
      .then(() => {
        logAudioDebug("play:success", { soundKey, attemptLabel, audioIndex, stateAfter: getAudioSnapshot(audio) });
        return true;
      })
      .catch((error) => {
        logAudioDebug("play:failed", { soundKey, attemptLabel, audioIndex, errorName: error?.name || null, errorMessage: error?.message || null, stateAfter: getAudioSnapshot(audio) });
        return false;
      });
  };

  const firstChoice = pickPlayableAudio();
  return attemptPlay(firstChoice, "first").then((didPlay) => {
    if (didPlay) return true;
    return unlockAudioPools().then((didUnlock) => {
      if (!didUnlock) return false;
      const retryChoice = pickPlayableAudio();
      return attemptPlay(retryChoice, "retry").then((didRetryPlay) => {
        if (didRetryPlay) return true;
        const fallbackChoice = pool.find((audio) => audio !== retryChoice && (audio.paused || audio.ended));
        return attemptPlay(fallbackChoice, "fallback");
      });
    });
  });
};


const playClickSound = () => {
  playFromPool(clickAudioPool, "click");
};

const playVoteSendSound = () => {
  playFromPool(voteSendAudioPool, "voteSend");
};

const playSuccessPurchaseSound = () => {
  return playFromPool(successPurchaseAudioPool, "successPurchase");
};

const playFailedPurchaseSound = () => {
  return playFromPool(failedPurchaseAudioPool, "failedPurchase");
};

if (AUDIO_DEBUG_ENABLED) {
  window.dumpAudioDebug = () => (window.__audioDebugEvents || []).slice();
  console.info("[audio-debug] Enabled. Use window.dumpAudioDebug() to inspect captured events.");
}

function App() {
  const [name, setName] = useState(() => localStorage.getItem("playerName") || "");
  const [roomIdInput, setRoomIdInput] = useState(initialRoomFromQuery);
  const [profileId, setProfileId] = useState(() => localStorage.getItem("playerProfileId") || "");
  const [profileEntitlementExpiresAtMs, setProfileEntitlementExpiresAtMs] = useState(null);
  const [profileEntitledModeKeys, setProfileEntitledModeKeys] = useState([]);
  const [profileEntitledModeExpiriesMs, setProfileEntitledModeExpiriesMs] = useState({});
  const [showStore, setShowStore] = useState(false);
  const [purchaseOverlayStatus, setPurchaseOverlayStatus] = useState(null);
  const [isSoloChaosLabOpen, setIsSoloChaosLabOpen] = useState(false);
  const [selectedLobbyModeId, setSelectedLobbyModeId] = useState("standard");
  const [roomId, setRoomId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [roomState, setRoomState] = useState(null);
  const modeDebugConfigs = roomState?.modeDebugConfigs || DEFAULT_MODE_DEBUG_CONFIGS;
  const [isViewingRoomPage, setIsViewingRoomPage] = useState(false);
  const [serverNow, setServerNow] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(null);
  const [pingMs, setPingMs] = useState(null);
  const hasPlayedReturnPurchaseSoundRef = useRef(false);
  const suppressNextPurchaseResultRef = useRef(null);
  const pendingAutoJoinRoomIdRef = useRef(initialRoomFromQuery);
  const playPurchaseSoundWithFallback = useCallback((success) => {
    const pendingSoundValue = success ? "success" : "cancelled";
    const playNow = () => (success ? playSuccessPurchaseSound() : playFailedPurchaseSound());
    const scheduleRetry = (remainingAttempts = 6) => {
      if (remainingAttempts <= 0) {
        localStorage.setItem(PENDING_PURCHASE_SOUND_STORAGE_KEY, pendingSoundValue);
        return;
      }
      window.setTimeout(() => {
        Promise.resolve(playNow()).then((didPlay) => {
          if (didPlay) return;
          scheduleRetry(remainingAttempts - 1);
        });
      }, 150);
    };

    Promise.resolve(playNow()).then((didPlay) => {
      if (didPlay) return;
      scheduleRetry();
    });
  }, []);
  const showPurchaseResultOverlay = useCallback((success) => {
    setPurchaseOverlayStatus(success ? "success" : "failed");
  }, []);
  const handleDismissPurchaseOverlay = useCallback(() => {
    if (!purchaseOverlayStatus) return;
    const purchaseSucceeded = purchaseOverlayStatus === "success";
    playPurchaseSoundWithFallback(purchaseSucceeded);
    setPurchaseOverlayStatus(null);
  }, [playPurchaseSoundWithFallback, purchaseOverlayStatus]);
  const getStoredRoomViewPreference = useCallback(
    (nextRoomId) => localStorage.getItem(`${ROOM_VIEW_PREFERENCE_KEY}:${nextRoomId}`) === "room",
    []
  );
  const setStoredRoomViewPreference = useCallback((nextRoomId, prefersRoomView) => {
    const key = `${ROOM_VIEW_PREFERENCE_KEY}:${nextRoomId}`;
    if (prefersRoomView) {
      localStorage.setItem(key, "room");
      return;
    }
    localStorage.removeItem(key);
  }, []);


  const clearSessionState = useCallback(() => {
    localStorage.removeItem("roomId");
    localStorage.removeItem("sessionToken");
    if (roomId) {
      localStorage.removeItem(`${ROOM_VIEW_PREFERENCE_KEY}:${roomId}`);
    }
    setRoomId("");
    setRoomIdInput("");
    setPlayerId("");
    setSessionToken("");
    setRoomState(null);
    setIsViewingRoomPage(false);
  }, [roomId]);
  const applyJoinResponse = useCallback((response) => {
    setRoomId(response.roomId);
    setPlayerId(response.playerId);
    setSessionToken(response.sessionToken);
    setRoomState(response.state);

    localStorage.setItem("roomId", response.roomId);
    localStorage.setItem("sessionToken", response.sessionToken);
    const responsePlayers = response.state?.players ?? [];
    const joiningPlayer = responsePlayers.find((player) => player.playerId === response.playerId);
    const isWaitingForNextGame = Boolean(joiningPlayer?.waitingForNextGame);
    const didParticipateInCurrentGame = Boolean(joiningPlayer?.currentGameParticipant);
    const isGameOver = response.state?.phase === "play" && joiningPlayer?.game?.status === "gameover";
    setIsViewingRoomPage(
      isWaitingForNextGame
      || !didParticipateInCurrentGame
      || (isGameOver && getStoredRoomViewPreference(response.roomId))
    );
  }, [getStoredRoomViewPreference]);

  useEffect(() => {
    const handleRoomState = (state) => setRoomState(state);
    const handleRoomWarning = ({ message }) => {
      if (message) {
        alert(message);
      }
    };

    const handleRoomDisbanded = ({ reason }) => {
      clearSessionState();
      if (reason) {
        alert(reason);
      }
    };

    socket.on("room:state", handleRoomState);
    socket.on("room:warning", handleRoomWarning);
    socket.on("room:disbanded", handleRoomDisbanded);
    socket.on("entitlement:purchase:result", ({ success }) => {
      const isSuccess = Boolean(success);
      if (suppressNextPurchaseResultRef.current !== null && suppressNextPurchaseResultRef.current === isSuccess) {
        suppressNextPurchaseResultRef.current = null;
        return;
      }
      playPurchaseSoundWithFallback(isSuccess);
    });

    return () => {
      socket.off("room:state", handleRoomState);
      socket.off("room:warning", handleRoomWarning);
      socket.off("room:disbanded", handleRoomDisbanded);
      socket.off("entitlement:purchase:result");
    };
  }, [clearSessionState, playPurchaseSoundWithFallback]);


  useEffect(() => {
    const handleAudioActivation = () => {
      unlockAudioPools();
    };

    window.addEventListener("pointerdown", handleAudioActivation);
    window.addEventListener("touchend", handleAudioActivation);
    window.addEventListener("keydown", handleAudioActivation);

    const handleVisibilityChange = () => {
      logAudioDebug("lifecycle:visibilitychange", { visibility: document.visibilityState });
      if (document.visibilityState === "visible") {
        isAudioUnlocked = false;
      }
    };

    const handlePageShow = () => logAudioDebug("lifecycle:pageshow");
    const handlePageHide = () => logAudioDebug("lifecycle:pagehide");

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pointerdown", handleAudioActivation);
      window.removeEventListener("touchend", handleAudioActivation);
      window.removeEventListener("keydown", handleAudioActivation);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchaseResult = params.get("purchase");
    const normalizedPurchaseResult = purchaseResult === "canceled" ? "cancelled" : purchaseResult;
    const hasPendingPurchase = localStorage.getItem(PENDING_PURCHASE_STORAGE_KEY) === "1";
    if (normalizedPurchaseResult !== "success" && normalizedPurchaseResult !== "cancelled" && !hasPendingPurchase) return;

    const purchaseSucceeded = normalizedPurchaseResult === "success";
    if (!hasPlayedReturnPurchaseSoundRef.current) {
      showPurchaseResultOverlay(purchaseSucceeded);
      hasPlayedReturnPurchaseSoundRef.current = true;
    }

    localStorage.setItem(PURCHASE_RESULT_TO_EMIT_STORAGE_KEY, purchaseSucceeded ? "success" : "cancelled");
    localStorage.removeItem(PENDING_PURCHASE_STORAGE_KEY);

    if (normalizedPurchaseResult === "success" || normalizedPurchaseResult === "cancelled") {
      params.delete("purchase");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [playPurchaseSoundWithFallback, showPurchaseResultOverlay]);

  useEffect(() => {
    const playPendingPurchaseSound = () => {
      const pendingSound = localStorage.getItem(PENDING_PURCHASE_SOUND_STORAGE_KEY);
      if (pendingSound !== "success" && pendingSound !== "cancelled") return;
      const playAttempt = pendingSound === "success" ? playSuccessPurchaseSound() : playFailedPurchaseSound();
      Promise.resolve(playAttempt).then((didPlay) => {
        if (didPlay) {
          localStorage.removeItem(PENDING_PURCHASE_SOUND_STORAGE_KEY);
        }
      });
    };

    window.addEventListener("pointerdown", playPendingPurchaseSound);
    window.addEventListener("keydown", playPendingPurchaseSound);
    playPendingPurchaseSound();

    return () => {
      window.removeEventListener("pointerdown", playPendingPurchaseSound);
      window.removeEventListener("keydown", playPendingPurchaseSound);
    };
  }, []);

  useEffect(() => {
    if (!roomId || !playerId) return;
    const purchaseResultToEmit = localStorage.getItem(PURCHASE_RESULT_TO_EMIT_STORAGE_KEY);
    if (purchaseResultToEmit !== "success" && purchaseResultToEmit !== "cancelled") return;
    const purchaseSucceeded = purchaseResultToEmit === "success";
    suppressNextPurchaseResultRef.current = purchaseSucceeded;
    socket.emit("entitlement:purchase:result", { roomId, playerId, success: purchaseSucceeded });
    localStorage.removeItem(PURCHASE_RESULT_TO_EMIT_STORAGE_KEY);
  }, [roomId, playerId]);

  const attemptSessionRejoin = useCallback(() => {
    const savedRoomId = localStorage.getItem("roomId");
    const savedSessionToken = localStorage.getItem("sessionToken");

    if (!savedRoomId || !savedSessionToken) {
      return;
    }

    socket.emit("room:rejoin", { roomId: savedRoomId, sessionToken: savedSessionToken }, (response) => {
      if (response?.error) {
        clearSessionState();
        if (response.code === "CREATOR_TIMED_OUT") {
          alert("You timed out, so your room was disbanded.");
        }
        return;
      }

      applyJoinResponse(response);
    });
  }, [applyJoinResponse, clearSessionState]);

  useEffect(() => {
    attemptSessionRejoin();
  }, [attemptSessionRejoin]);

  useEffect(() => {
    socket.on("connect", attemptSessionRejoin);
    return () => {
      socket.off("connect", attemptSessionRejoin);
    };
  }, [attemptSessionRejoin]);

  useEffect(() => {
    if (!name) return;
    localStorage.setItem("playerName", name);
  }, [name]);

  useEffect(() => {
    socket.emit("player:register", { profileId, name }, (response) => {
      if (response?.error) return;
      if (response.profileId && response.profileId !== profileId) {
        setProfileId(response.profileId);
        localStorage.setItem("playerProfileId", response.profileId);
      }
      setProfileEntitlementExpiresAtMs(response.entitlementExpiresAtMs ?? null);
      setProfileEntitledModeKeys(response.entitledModeKeys ?? []);
      setProfileEntitledModeExpiriesMs(response.entitledModeExpiriesMs ?? {});
    });
  }, [profileId, name]);


  useEffect(() => {
    const syncServerTime = () => {
      const clientSentAt = Date.now();

      socket.emit("time:sync:ping", { clientSentAt }, ({ serverTime }) => {
        const clientReceivedAt = Date.now();
        const rtt = clientReceivedAt - clientSentAt;
        setPingMs(rtt);

        if (roomId && playerId) {
          socket.emit("player:ping", { roomId, playerId, pingMs: rtt });
        }

        if (typeof serverTime !== "number") {
          return;
        }

        const estimatedServerNow = serverTime + rtt / 2;
        setServerOffsetMs(estimatedServerNow - clientReceivedAt);
      });
    };

    syncServerTime();
    const interval = setInterval(syncServerTime, 2000);
    return () => clearInterval(interval);
  }, [roomId, playerId]);

  useEffect(() => {
    if (serverOffsetMs === null) return;

    const updateServerNow = () => setServerNow(Date.now() + serverOffsetMs);
    updateServerNow();
    const interval = setInterval(updateServerNow, 100);
    return () => clearInterval(interval);
  }, [serverOffsetMs]);

  const createRoom = () => {
    socket.emit("room:create", { name, profileId, selectedModeId: selectedLobbyModeId }, (response) => {
      if (response?.error) {
        alert(response.error);
        return;
      }
      applyJoinResponse(response);
    });
  };

  const joinRoomWithCode = useCallback((nextRoomId, nextName) => {
    socket.emit("room:join", { roomId: nextRoomId.toUpperCase(), name: nextName, profileId }, (response) => {
      if (response?.error) {
        alert(response.error);
        return;
      }
      applyJoinResponse(response);
    });
  }, [applyJoinResponse]);

  const joinRoom = () => joinRoomWithCode(roomIdInput, name);

  useEffect(() => {
    const pendingAutoJoinRoomId = pendingAutoJoinRoomIdRef.current;
    if (!pendingAutoJoinRoomId || roomId || pendingAutoJoinRoomId !== roomIdInput) {
      return;
    }

    pendingAutoJoinRoomIdRef.current = "";
    const autoJoinName = name || `Player-${Math.floor(1000 + Math.random() * 9000)}`;
    joinRoomWithCode(pendingAutoJoinRoomId, autoJoinName);
  }, [joinRoomWithCode, name, roomId, roomIdInput]);

  const exitRoom = () => {
    if (roomId && playerId) {
      socket.emit("room:leave", { roomId, playerId });
    }

    clearSessionState();
  };

  const setPlayerColor = (color) => {
    socket.emit("player:setColor", { roomId, playerId, color }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const setRoomMode = (modeId) => {
    socket.emit("room:setMode", { roomId, playerId, modeId }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const setPlayerReady = (ready) => {
    socket.emit("player:setReady", { roomId, playerId, ready }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const submitAnswer = (answer) => {
    playVoteSendSound();
    socket.emit("game:submit", { roomId, playerId, answer }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const notifyAssetsLoaded = useCallback(() => {
    if (!roomId || !playerId) return;
    socket.emit("game:assetsLoaded", { roomId, playerId }, (response) => {
      if (response?.error) alert(response.error);
    });
  }, [playerId, roomId]);


  const purchaseProduct = (productKey = "glitch_party_pack") => {
    if (!profileId) {
      alert("Create or join a room first to initialize your profile.");
      return;
    }

    const startCheckout = () => {
      fetch(`${serverUrl}/api/stripe/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, productKey })
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error || "Failed to start checkout");
          }
          if (!payload?.url) {
            throw new Error("Stripe checkout URL missing");
          }
          localStorage.setItem(PENDING_PURCHASE_STORAGE_KEY, "1");
          window.location.assign(payload.url);
        })
        .catch((error) => {
          alert(error.message || "Failed to start checkout");
          setShowStore(false);
        });
    };

    if (!roomId || !playerId) {
      startCheckout();
      return;
    }

    socket.emit("entitlement:purchase:start", { roomId, playerId, productKey }, (response) => {
      if (response?.error) {
        alert(response.error);
        return;
      }

      startCheckout();
      return;
    });
  };

  const returnToRoom = () => {
    setStoredRoomViewPreference(roomId, true);
    setIsViewingRoomPage(true);
  };

  const players = roomState?.players ?? [];
  const me = players.find((player) => player.playerId === playerId);
  const hostPlayer = players.find((player) => player.isHost);
  const isPreviewRoom = Boolean(roomState?.game?.isPreview)
    || (roomState?.phase === "lobby" && Boolean(hostPlayer) && !hostPlayer.hasEntitlement);
  const shouldShowGamePage = roomState?.phase === "play"
    && !isViewingRoomPage
    && !me?.waitingForNextGame
    && me?.currentGameParticipant;

  useEffect(() => {
    if (!roomId || roomState?.phase !== "play") {
      setIsViewingRoomPage(false);
      return;
    }

    if (
      ["loading", "active", "paused"].includes(me?.game?.status)
      && !me?.waitingForNextGame
      && me?.currentGameParticipant
    ) {
      setStoredRoomViewPreference(roomId, false);
      setIsViewingRoomPage(false);
    }
  }, [roomId, roomState?.phase, me?.game?.status, me?.waitingForNextGame, me?.currentGameParticipant, setStoredRoomViewPreference]);

  return (
    <main className="app-page">
      {roomId ? (
        shouldShowGamePage ? (
        <GlitchGamePage
            roomId={roomId}
            playerId={playerId}
            players={players}
            myGame={me?.game ?? null}
            serverNow={serverOffsetMs === null ? null : serverNow}
          onSubmitAnswer={submitAnswer}
          onAssetsLoaded={notifyAssetsLoaded}
            onReturnRoom={returnToRoom}
            onExit={exitRoom}
            onUiButtonClick={playClickSound}
            isPreviewRoom={isPreviewRoom}
            availableModes={roomState?.availableModes ?? []}
            selectedModeId={roomState?.selectedModeId ?? "standard"}
          />
        ) : (
          <RoomPage
            roomId={roomId}
            playerId={playerId}
            players={players}
            phase={roomState?.phase ?? "-"}
            serverNow={serverOffsetMs === null ? null : serverNow}
            pingMs={pingMs}
            sessionToken={sessionToken}
            waitingForNextGame={Boolean(me?.waitingForNextGame)}
            colors={PLAYER_COLORS}
            onSetColor={setPlayerColor}
            onSetReady={setPlayerReady}
            onExit={exitRoom}
            onUiButtonClick={playClickSound}
            canManageReady={roomState?.phase === "lobby" || (isViewingRoomPage && me?.game?.status === "gameover")}
            canOpenStore={Boolean(me?.isHost)}
            isPreviewRoom={isPreviewRoom}
            onOpenStore={() => setShowStore(true)}
            hostUnlockingPending={Boolean(roomState?.hostUnlockingPending)}
            unlockingProductName={roomState?.unlockingProductName ?? null}
            selectedModeId={roomState?.selectedModeId ?? "standard"}
            availableModes={roomState?.availableModes ?? []}
            canSelectMode={Boolean(me?.isHost && me?.hasEntitlement && (roomState?.phase === "lobby" || (isViewingRoomPage && me?.game?.status === "gameover")))}
            entitlementExpiresAtMs={me?.entitlementExpiresAtMs ?? null}
            entitledModeKeys={me?.entitledModeKeys ?? []}
            entitledModeExpiriesMs={me?.entitledModeExpiriesMs ?? {}}
            onSetMode={setRoomMode}
            modeDebugConfigs={modeDebugConfigs}
          />
        )
      ) : isSoloChaosLabOpen ? (
        <SoloChaosLabPage
          onBack={() => setIsSoloChaosLabOpen(false)}
          onUiButtonClick={playClickSound}
        />
      ) : (
        <LobbyPage
          onOpenStore={() => setShowStore(true)}
          name={name}
          roomIdInput={roomIdInput}
          pingMs={pingMs}
          onNameChange={setName}
          onRoomIdInputChange={setRoomIdInput}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onUiButtonClick={playClickSound}
          selectedModeId={selectedLobbyModeId}
          availableModes={LOBBY_MODE_OPTIONS}
          canSelectMode={Boolean(profileEntitledModeKeys.length)}
          profileEntitlementExpiresAtMs={profileEntitlementExpiresAtMs}
          entitledModeKeys={profileEntitledModeKeys}
          entitledModeExpiriesMs={profileEntitledModeExpiriesMs}
          onSelectedModeChange={setSelectedLobbyModeId}
          modeDebugConfigs={modeDebugConfigs}
        />
      )}
      {showStore ? (
        <div className="qr-modal-backdrop" onClick={() => setShowStore(false)}>
          <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="qr-modal-title">Store</h2>
            <p className="panel-subtitle">Buy a single mode or the Party Pack bundle.</p>
            <div className="store-action-list">
              <button className="btn btn-secondary" onClick={() => purchaseProduct("glitch_standard_mode")}>Buy GLiTCH! Mode</button>
              <button className="btn btn-secondary" onClick={() => purchaseProduct("glitch_chaos_mode")}>Buy Chaos Mode</button>
              <button className="btn btn-secondary" onClick={() => purchaseProduct("glitch_blitz_mode")}>Buy Blitz Mode</button>
              <button className="btn btn-primary" onClick={() => purchaseProduct("glitch_party_pack")}>Buy Party Pack</button>
            </div>
            <button className="btn btn-primary store-close-btn" onClick={() => setShowStore(false)}>Close</button>
          </div>
        </div>
      ) : null}
      {purchaseOverlayStatus ? (
        <div className="purchase-result-overlay" role="status" aria-live="polite">
          <div className={`purchase-result-card ${purchaseOverlayStatus}`}>
            <h2>{purchaseOverlayStatus === "success" ? "Purchase Successful" : "Purchase Failed"}</h2>
            <p>
              {purchaseOverlayStatus === "success"
                ? "Your purchase is complete and unlocks are now available."
                : "Purchase was not completed. Please try again when you're ready."}
            </p>
            <button className="btn btn-primary" onClick={handleDismissPurchaseOverlay}>Continue</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
