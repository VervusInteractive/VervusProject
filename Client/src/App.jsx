import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import LobbyPage from "./components/LobbyPage";
import RoomPage from "./components/RoomPage";
import GlitchGamePage from "./components/GlitchGamePage";
import SoloChaosLabPage from "./components/SoloChaosLabPage";
import "./App.css";
import { CONNECTION_STATES, deriveSocketConnectionState } from "./connectionState";
import voteSendSoundFile from "./assets/audio/Sound_VoteSend.mp3";
import clickSoundFile from "./assets/audio/Sound_Click.mp3";
import successPurchaseSoundFile from "./assets/audio/Sound_SuccessPurchase.mp3";
import failedPurchaseSoundFile from "./assets/audio/Sound_FailedPurchase.mp3";

const serverUrl = import.meta.env.VITE_SERVER_URL;
if (!serverUrl) {
  throw new Error("VITE_SERVER_URL is required");
}
const PROFILE_SESSION_STORAGE_KEY = "profileSessionToken";
const getStoredProfileSessionToken = () => localStorage.getItem(PROFILE_SESSION_STORAGE_KEY) || "";
const buildProfileSessionHeaders = () => {
  const token = getStoredProfileSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const socket = io(serverUrl, {
  autoConnect: false,
  withCredentials: true,
  auth: { profileSessionToken: getStoredProfileSessionToken() }
});
const setSocketProfileSessionToken = (token) => {
  socket.auth = { ...(socket.auth || {}), profileSessionToken: token || "" };
};

const discardBufferedSocketEmits = () => {
  if (Array.isArray(socket.sendBuffer) && socket.sendBuffer.length > 0) {
    socket.sendBuffer = [];
  }
};
const PENDING_PURCHASE_STORAGE_KEY = "pendingPurchaseCheckout";
const PURCHASE_RESULT_TO_EMIT_STORAGE_KEY = "purchaseResultToEmit";
const PENDING_PURCHASE_SOUND_STORAGE_KEY = "pendingPurchaseSoundEffect";
const PENDING_PURCHASE_SESSION_STORAGE_KEY = "pendingPurchaseCheckoutSessionId";
const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
const initialSearchParams = new URLSearchParams(window.location.search);
const initialRoomFromQuery = initialSearchParams.get("room")?.trim().toUpperCase() || "";
const initialEntitlementTransferToken = initialSearchParams.get("entitlementTransfer")?.trim() || "";
const ROOM_VIEW_PREFERENCE_KEY = "roomViewPreference";
const LOBBY_MODE_OPTIONS = [
  { id: "standard", title: "GLiTCH!" },
  { id: "blitz", title: "GLiTCH! Blitz" },
  { id: "chaos", title: "GLiTCH! Chaos" }
];

const TIME_SYNC_SAMPLE_LIMIT = 8;
const TIME_SYNC_BEST_SAMPLE_COUNT = 5;
const TIME_SYNC_DEGRADED_RTT_MS = 150;
const TIME_SYNC_DEGRADED_JITTER_MS = 80;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

function deriveTimeSyncEstimate(samples) {
  const validSamples = samples
    .filter((sample) => Number.isFinite(sample.offsetMs) && Number.isFinite(sample.rttMs))
    .sort((a, b) => a.rttMs - b.rttMs)
    .slice(0, TIME_SYNC_BEST_SAMPLE_COUNT);

  if (!validSamples.length) {
    return { offsetMs: null, rttMs: null, jitterMs: null, sampleCount: 0, quality: "syncing" };
  }

  const offsetMs = median(validSamples.map((sample) => sample.offsetMs));
  const rttMs = median(validSamples.map((sample) => sample.rttMs));
  const offsets = validSamples.map((sample) => sample.offsetMs);
  const jitterMs = offsets.length > 1 ? Math.max(...offsets) - Math.min(...offsets) : 0;
  const quality = rttMs > TIME_SYNC_DEGRADED_RTT_MS || jitterMs > TIME_SYNC_DEGRADED_JITTER_MS
    ? "degraded"
    : "synced";

  return { offsetMs, rttMs, jitterMs, sampleCount: validSamples.length, quality };
}

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


const AUDIO_DEBUG_ENABLED = new URLSearchParams(window.location.search).get("audioDebug") === "1";
const SFX_SOUND_FILES = {
  click: clickSoundFile,
  voteSend: voteSendSoundFile,
  successPurchase: successPurchaseSoundFile,
  failedPurchase: failedPurchaseSoundFile
};

let audioContextRef = null;
let audioUnlockInFlight = null;
let isAudioUnlocked = false;
let audioBufferMapPromise = null;
let audioBufferMap = null;

const getAudioContext = () => {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContextRef) {
    audioContextRef = new AudioContextCtor({ latencyHint: "interactive" });
  }
  return audioContextRef;
};

const logAudioDebug = (event, details = {}) => {
  if (!AUDIO_DEBUG_ENABLED) return;
  const context = audioContextRef;
  const payload = {
    ts: new Date().toISOString(),
    visibility: document.visibilityState,
    unlocked: isAudioUnlocked,
    contextState: context?.state ?? null,
    event,
    ...details
  };
  console.log("[audio-debug]", payload);
  window.__audioDebugEvents = window.__audioDebugEvents || [];
  window.__audioDebugEvents.push(payload);
  if (window.__audioDebugEvents.length > 300) window.__audioDebugEvents.shift();
};

const decodeAudioBufferMap = async () => {
  if (audioBufferMap) return audioBufferMap;
  if (audioBufferMapPromise) return audioBufferMapPromise;

  audioBufferMapPromise = (async () => {
    const context = getAudioContext();
    if (!context) return null;

    const entries = await Promise.all(Object.entries(SFX_SOUND_FILES).map(async ([soundKey, src]) => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
        return [soundKey, decoded];
      } catch (error) {
        logAudioDebug("buffer:decode:failed", { soundKey, errorName: error?.name || null, errorMessage: error?.message || null });
        return [soundKey, null];
      }
    }));

    audioBufferMap = Object.fromEntries(entries);
    logAudioDebug("buffer:decode:complete", { loadedKeys: Object.entries(audioBufferMap).filter(([, v]) => Boolean(v)).map(([k]) => k) });
    return audioBufferMap;
  })();

  return audioBufferMapPromise;
};

const unlockAudioEngine = () => {
  if (isAudioUnlocked) return Promise.resolve(true);
  if (audioUnlockInFlight) return audioUnlockInFlight;

  audioUnlockInFlight = (async () => {
    const context = getAudioContext();
    if (!context) return false;

    try {
      if (context.state !== "running") {
        await context.resume();
      }
      const buffers = await decodeAudioBufferMap();
      const didUnlock = context.state === "running" && Boolean(buffers);
      isAudioUnlocked = didUnlock;
      logAudioDebug("unlock:complete", { didUnlock, hasBuffers: Boolean(buffers), contextState: context.state });
      return didUnlock;
    } catch (error) {
      isAudioUnlocked = false;
      logAudioDebug("unlock:failed", { errorName: error?.name || null, errorMessage: error?.message || null });
      return false;
    } finally {
      audioUnlockInFlight = null;
    }
  })();

  return audioUnlockInFlight;
};

const playSound = async (soundKey, attemptLabel = "first") => {
  const context = getAudioContext();
  if (!context) {
    logAudioDebug("play:failed", { soundKey, attemptLabel, reason: "no-audio-context" });
    return false;
  }

  const buffers = await decodeAudioBufferMap();
  const buffer = buffers?.[soundKey] || null;
  if (!buffer) {
    logAudioDebug("play:failed", { soundKey, attemptLabel, reason: "missing-buffer" });
    return false;
  }

  try {
    if (context.state !== "running") {
      await context.resume();
    }

    logAudioDebug("play:attempt", { soundKey, attemptLabel, contextState: context.state, durationSec: Number(buffer.duration.toFixed(3)) });
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
    logAudioDebug("play:success", { soundKey, attemptLabel, contextState: context.state });
    return true;
  } catch (error) {
    logAudioDebug("play:failed", { soundKey, attemptLabel, errorName: error?.name || null, errorMessage: error?.message || null, contextState: context.state });
    return false;
  }
};

const playSoundWithUnlockRetry = (soundKey) => playSound(soundKey, "first").then((didPlay) => {
  if (didPlay) return true;
  return unlockAudioEngine().then((didUnlock) => {
    if (!didUnlock) return false;
    return playSound(soundKey, "retry");
  });
});

const playClickSound = () => {
  playSoundWithUnlockRetry("click");
};

const playVoteSendSound = () => {
  playSoundWithUnlockRetry("voteSend");
};

const playSuccessPurchaseSound = () => playSoundWithUnlockRetry("successPurchase");

const playFailedPurchaseSound = () => playSoundWithUnlockRetry("failedPurchase");

if (AUDIO_DEBUG_ENABLED) {
  window.dumpAudioDebug = () => (window.__audioDebugEvents || []).slice();
  console.info("[audio-debug] Enabled. Use window.dumpAudioDebug() to inspect captured events.");
}

function App() {
  const [name, setName] = useState(() => localStorage.getItem("playerName") || "");
  const [roomIdInput, setRoomIdInput] = useState(initialRoomFromQuery);
  const [profileId, setProfileId] = useState("");
  const [profileEntitlementExpiresAtMs, setProfileEntitlementExpiresAtMs] = useState(null);
  const [profileEntitledModeKeys, setProfileEntitledModeKeys] = useState([]);
  const [profileEntitledModeExpiriesMs, setProfileEntitledModeExpiriesMs] = useState({});
  const [showStore, setShowStore] = useState(false);
  const [purchaseOverlayStatus, setPurchaseOverlayStatus] = useState(null);
  const [isSoloChaosLabOpen, setIsSoloChaosLabOpen] = useState(false);
  const [selectedLobbyModeId, setSelectedLobbyModeId] = useState("standard");
  const [lobbyModeOptions, setLobbyModeOptions] = useState(LOBBY_MODE_OPTIONS);
  const [entitlementRefreshRequestedAtMs, setEntitlementRefreshRequestedAtMs] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [roomState, setRoomState] = useState(null);
  const modeDebugConfigs = roomState?.modeDebugConfigs?.length
    ? roomState.modeDebugConfigs
    : (import.meta.env.DEV ? DEFAULT_MODE_DEBUG_CONFIGS : []);
  const [isViewingRoomPage, setIsViewingRoomPage] = useState(false);
  const [serverNow, setServerNow] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(null);
  const [timeSyncStatus, setTimeSyncStatus] = useState({
    rttMs: null,
    offsetMs: null,
    jitterMs: null,
    sampleCount: 0,
    quality: "syncing"
  });
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [isSocketReconnecting, setIsSocketReconnecting] = useState(!socket.connected);
  const [pingMs, setPingMs] = useState(null);
  const actionsLocked = !isSocketConnected;
  const connectionState = useMemo(() => deriveSocketConnectionState({
    socketConnected: isSocketConnected,
    isReconnecting: isSocketReconnecting && !isSocketConnected,
    pingMs
  }), [isSocketConnected, isSocketReconnecting, pingMs]);
  const hasPlayedReturnPurchaseSoundRef = useRef(false);
  const suppressNextPurchaseResultRef = useRef(null);
  const timeSyncSequenceRef = useRef(0);
  const timeSyncSamplesRef = useRef([]);
  const pendingAutoJoinRoomIdRef = useRef(initialRoomFromQuery);
  const pendingEntitlementTransferTokenRef = useRef(initialEntitlementTransferToken);
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


  const emitIfConnected = useCallback((eventName, payload, callback) => {
    if (!socket.connected) {
      discardBufferedSocketEmits();
      return false;
    }

    socket.emit(eventName, payload, callback);
    return true;
  }, []);


  const applyProfileEntitlementResponse = useCallback((response) => {
    if (response?.error) return;
    if (response.profileSessionToken) {
      localStorage.setItem(PROFILE_SESSION_STORAGE_KEY, response.profileSessionToken);
      setSocketProfileSessionToken(response.profileSessionToken);
    }
    if (response.profileId && response.profileId !== profileId) {
      setProfileId(response.profileId);
    }
    setProfileEntitlementExpiresAtMs(response.entitlementExpiresAtMs ?? null);
    setProfileEntitledModeKeys(response.entitledModeKeys ?? []);
    setProfileEntitledModeExpiriesMs(response.entitledModeExpiriesMs ?? {});
  }, [profileId]);

  const refreshProfileEntitlements = useCallback(() => {
    emitIfConnected("player:register", { name }, applyProfileEntitlementResponse);
  }, [applyProfileEntitlementResponse, emitIfConnected, name]);


  const clearSessionState = useCallback(() => {
    localStorage.removeItem("roomId");
    localStorage.removeItem("sessionToken");
    if (roomId) {
      localStorage.removeItem(`${ROOM_VIEW_PREFERENCE_KEY}:${roomId}`);
    }
    setRoomId("");
    setRoomIdInput("");
    setPlayerId("");
    setRoomState(null);
    setIsViewingRoomPage(false);
  }, [roomId]);
  const applyJoinResponse = useCallback((response) => {
    setRoomId(response.roomId);
    setPlayerId(response.playerId);
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
    let isMounted = true;

    fetch(`${serverUrl}/api/player-session`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...buildProfileSessionHeaders() },
      body: JSON.stringify({ name })
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Failed to establish player session");
        if (!isMounted) return;
        applyProfileEntitlementResponse(payload);
        if (!socket.connected && !socket.active) {
          socket.connect();
        }
      })
      .catch((error) => {
        if (isMounted) alert(error.message || "Failed to establish player session");
      });

    return () => {
      isMounted = false;
    };
  }, [applyProfileEntitlementResponse, name]);

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
    const handlePurchaseResult = ({ success }) => {
      const isSuccess = Boolean(success);
      if (suppressNextPurchaseResultRef.current !== null && suppressNextPurchaseResultRef.current === isSuccess) {
        suppressNextPurchaseResultRef.current = null;
        return;
      }
      playPurchaseSoundWithFallback(isSuccess);
    };

    const handleEntitlementTransferCompleted = ({ message } = {}) => {
      refreshProfileEntitlements();
      alert(message || "Your entitlement was transferred to another device. Entitlements refreshed.");
    };

    const handleEntitlementRefresh = (payload = {}) => {
      applyProfileEntitlementResponse(payload);
    };

    socket.on("entitlement:purchase:result", handlePurchaseResult);
    socket.on("entitlement:transfer:completed", handleEntitlementTransferCompleted);
    socket.on("entitlement:refresh", handleEntitlementRefresh);

    return () => {
      socket.off("room:state", handleRoomState);
      socket.off("room:warning", handleRoomWarning);
      socket.off("room:disbanded", handleRoomDisbanded);
      socket.off("entitlement:purchase:result", handlePurchaseResult);
      socket.off("entitlement:transfer:completed", handleEntitlementTransferCompleted);
      socket.off("entitlement:refresh", handleEntitlementRefresh);
    };
  }, [applyProfileEntitlementResponse, clearSessionState, playPurchaseSoundWithFallback, refreshProfileEntitlements]);


  useEffect(() => {
    const handleAudioActivation = () => {
      unlockAudioEngine();
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
    const purchaseSessionId = params.get("purchaseSessionId")?.trim() || "";
    const normalizedPurchaseResult = purchaseResult === "canceled" ? "cancelled" : purchaseResult;
    const hasPendingPurchase = localStorage.getItem(PENDING_PURCHASE_STORAGE_KEY) === "1";
    if (purchaseSessionId) {
      localStorage.setItem(PENDING_PURCHASE_SESSION_STORAGE_KEY, purchaseSessionId);
    }
    if (normalizedPurchaseResult !== "success" && normalizedPurchaseResult !== "cancelled" && !hasPendingPurchase) return;

    const purchaseSucceeded = normalizedPurchaseResult === "success";
    if (!hasPlayedReturnPurchaseSoundRef.current) {
      window.setTimeout(() => showPurchaseResultOverlay(purchaseSucceeded), 0);
      hasPlayedReturnPurchaseSoundRef.current = true;
    }

    localStorage.setItem(PURCHASE_RESULT_TO_EMIT_STORAGE_KEY, purchaseSucceeded ? "success" : "cancelled");
    localStorage.removeItem(PENDING_PURCHASE_STORAGE_KEY);
    if (purchaseSucceeded) {
      window.setTimeout(() => setEntitlementRefreshRequestedAtMs(Date.now()), 0);
    }

    if (normalizedPurchaseResult === "success" || normalizedPurchaseResult === "cancelled") {
      params.delete("purchase");
      params.delete("purchaseSessionId");
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
    if (!emitIfConnected("entitlement:purchase:result", { roomId, playerId, success: purchaseSucceeded })) {
      return;
    }

    suppressNextPurchaseResultRef.current = purchaseSucceeded;
    localStorage.removeItem(PURCHASE_RESULT_TO_EMIT_STORAGE_KEY);
  }, [emitIfConnected, roomId, playerId]);

  const attemptSessionRejoin = useCallback(() => {
    const savedRoomId = localStorage.getItem("roomId");
    const savedSessionToken = localStorage.getItem("sessionToken");

    if (!savedRoomId || !savedSessionToken || !socket.connected) {
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
    const handleConnect = () => {
      setIsSocketConnected(true);
      setIsSocketReconnecting(false);
    };
    const handleDisconnect = () => {
      discardBufferedSocketEmits();
      setIsSocketConnected(false);
      setIsSocketReconnecting(true);
    };
    const handleReconnectAttempt = () => {
      discardBufferedSocketEmits();
      setIsSocketConnected(false);
      setIsSocketReconnecting(true);
    };
    const handleReconnectFailed = () => {
      setIsSocketConnected(false);
      setIsSocketReconnecting(false);
    };
    const handleConnectError = () => {
      setIsSocketConnected(socket.connected);
      setIsSocketReconnecting(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.io.on("reconnect_failed", handleReconnectFailed);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.io.off("reconnect_failed", handleReconnectFailed);
    };
  }, []);


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
    if (!isSocketConnected) return;
    refreshProfileEntitlements();
  }, [isSocketConnected, refreshProfileEntitlements]);

  useEffect(() => {
    if (!isSocketConnected || !pendingEntitlementTransferTokenRef.current) return;
    const token = pendingEntitlementTransferTokenRef.current;
    pendingEntitlementTransferTokenRef.current = "";

    fetch(`${serverUrl}/api/entitlement-transfer/claim`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...buildProfileSessionHeaders() },
      body: JSON.stringify({ token, name })
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Failed to claim entitlement transfer");
        applyProfileEntitlementResponse(payload);
        alert("Entitlement transferred to this device.");
        if (socket.connected) socket.disconnect();
        socket.connect();
      })
      .catch((error) => alert(error.message || "Failed to claim entitlement transfer"))
      .finally(() => {
        const params = new URLSearchParams(window.location.search);
        params.delete("entitlementTransfer");
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", nextUrl);
      });
  }, [applyProfileEntitlementResponse, isSocketConnected, name]);

  useEffect(() => {
    if (!entitlementRefreshRequestedAtMs) return;

    let attemptCount = 0;
    const refreshUntilWebhookCatchesUp = () => {
      attemptCount += 1;
      refreshProfileEntitlements();
    };

    refreshUntilWebhookCatchesUp();
    const interval = window.setInterval(() => {
      if (attemptCount >= 8) {
        window.clearInterval(interval);
        return;
      }
      refreshUntilWebhookCatchesUp();
    }, 1500);

    return () => window.clearInterval(interval);
  }, [entitlementRefreshRequestedAtMs, refreshProfileEntitlements]);

  useEffect(() => {
    const checkoutSessionId = localStorage.getItem(PENDING_PURCHASE_SESSION_STORAGE_KEY);
    if (!entitlementRefreshRequestedAtMs || !checkoutSessionId) return undefined;

    let cancelled = false;
    let attemptCount = 0;
    const pollPurchaseStatus = () => {
      attemptCount += 1;
      fetch(`${serverUrl}/api/stripe/purchase-status?sessionId=${encodeURIComponent(checkoutSessionId)}`, {
        credentials: "include",
        headers: buildProfileSessionHeaders()
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload?.error || "Failed to refresh purchase status");
          if (cancelled) return;
          applyProfileEntitlementResponse(payload);
          if (payload.paymentStatus === "paid" && payload.entitlementGrantedAtMs) {
            localStorage.removeItem(PENDING_PURCHASE_SESSION_STORAGE_KEY);
          }
        })
        .catch(() => {
          // The existing entitlement refresh loop remains the fallback while Stripe webhooks catch up.
        });
    };

    pollPurchaseStatus();
    const interval = window.setInterval(() => {
      if (attemptCount >= 8 || !localStorage.getItem(PENDING_PURCHASE_SESSION_STORAGE_KEY)) {
        window.clearInterval(interval);
        return;
      }
      pollPurchaseStatus();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyProfileEntitlementResponse, entitlementRefreshRequestedAtMs]);


  useEffect(() => {
    const syncServerTime = () => {
      if (!socket.connected) {
        discardBufferedSocketEmits();
        timeSyncSamplesRef.current = [];
        setPingMs(null);
        setServerOffsetMs(null);
        setServerNow(null);
        setTimeSyncStatus({ rttMs: null, offsetMs: null, jitterMs: null, sampleCount: 0, quality: "syncing" });
        return;
      }

      const clientSentAt = Date.now();
      const sequence = timeSyncSequenceRef.current + 1;
      timeSyncSequenceRef.current = sequence;

      socket.volatile.emit("time:sync:ping", { clientSentAt, sequence }, (response = {}) => {
        const clientReceivedAt = Date.now();
        if (response.sequence !== sequence || response.clientSentAt !== clientSentAt) {
          return;
        }

        const serverReceivedAt = Number.isFinite(response.serverReceivedAt) ? response.serverReceivedAt : response.serverTime;
        const serverSentAt = Number.isFinite(response.serverSentAt) ? response.serverSentAt : response.serverTime;
        if (!Number.isFinite(serverReceivedAt) || !Number.isFinite(serverSentAt)) {
          return;
        }

        const rttMs = Math.max(0, clientReceivedAt - clientSentAt - Math.max(0, serverSentAt - serverReceivedAt));
        const estimatedServerNow = (serverReceivedAt + serverSentAt + rttMs) / 2;
        const offsetMs = estimatedServerNow - clientReceivedAt;
        const samples = [
          ...timeSyncSamplesRef.current,
          { sequence, rttMs, offsetMs, receivedAtMs: clientReceivedAt }
        ].slice(-TIME_SYNC_SAMPLE_LIMIT);
        timeSyncSamplesRef.current = samples;

        const estimate = deriveTimeSyncEstimate(samples);
        setPingMs(Math.round(estimate.rttMs ?? rttMs));
        setServerOffsetMs(estimate.offsetMs);
        setTimeSyncStatus({
          rttMs: estimate.rttMs === null ? null : Math.round(estimate.rttMs),
          offsetMs: estimate.offsetMs === null ? null : Math.round(estimate.offsetMs),
          jitterMs: estimate.jitterMs === null ? null : Math.round(estimate.jitterMs),
          sampleCount: estimate.sampleCount,
          quality: estimate.quality
        });

        if (roomId && playerId && socket.connected) {
          socket.volatile.emit("player:ping", {
            roomId,
            playerId,
            pingMs: Math.round(estimate.rttMs ?? rttMs),
            clockOffsetMs: Math.round(estimate.offsetMs ?? offsetMs),
            timeSyncJitterMs: Math.round(estimate.jitterMs ?? 0),
            timeSyncQuality: estimate.quality
          });
        }
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
    emitIfConnected("room:create", { name, selectedModeId: selectedLobbyModeId }, (response) => {
      if (response?.error) {
        alert(response.error);
        return;
      }
      applyJoinResponse(response);
    });
  };

  const joinRoomWithCode = useCallback((nextRoomId, nextName) => {
    emitIfConnected("room:join", { roomId: nextRoomId.toUpperCase(), name: nextName }, (response) => {
      if (response?.error) {
        alert(response.error);
        return;
      }
      applyJoinResponse(response);
    });
  }, [applyJoinResponse, emitIfConnected]);

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
      emitIfConnected("room:leave", { roomId, playerId });
    }

    clearSessionState();
  };

  const setPlayerColor = (color) => {
    emitIfConnected("player:setColor", { roomId, playerId, color }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const setRoomMode = (modeId) => {
    emitIfConnected("room:setMode", { roomId, playerId, modeId }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const setPlayerReady = (ready) => {
    emitIfConnected("player:setReady", { roomId, playerId, ready }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const submitAnswer = (answer) => {
    const didSend = emitIfConnected("game:submit", { roomId, playerId, answer }, (response) => {
      if (response?.error) alert(response.error);
    });

    if (didSend) {
      playVoteSendSound();
    }
  };

  const notifyAssetsLoaded = useCallback(() => {
    if (!roomId || !playerId) return;
    emitIfConnected("game:assetsLoaded", { roomId, playerId }, (response) => {
      if (response?.error) alert(response.error);
    });
  }, [emitIfConnected, playerId, roomId]);


  const createEntitlementTransfer = useCallback(() => new Promise((resolve) => {
    const didEmit = emitIfConnected("entitlement:transfer:create", {}, (response) => {
      if (response?.error) {
        alert(response.error);
        resolve(null);
        return;
      }

      const clientUrl = import.meta.env.VITE_CLIENT_URL || window.location.origin;
      const transferUrl = `${clientUrl}/?entitlementTransfer=${encodeURIComponent(response.token)}`;
      resolve({ transferUrl, expiresAtMs: response.expiresAtMs ?? null });
    });

    if (!didEmit) {
      alert("Connect to the server before creating a transfer link.");
      resolve(null);
    }
  }), [emitIfConnected]);


  const purchaseProduct = (productKey = "glitch_party_pack") => {
    const startCheckout = () => {
      fetch(`${serverUrl}/api/stripe/checkout-session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...buildProfileSessionHeaders() },
        body: JSON.stringify({ productKey, roomId })
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
          if (payload.stripeCheckoutSessionId) {
            localStorage.setItem(PENDING_PURCHASE_SESSION_STORAGE_KEY, payload.stripeCheckoutSessionId);
          }
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

    emitIfConnected("entitlement:purchase:start", { roomId, playerId, productKey }, (response) => {
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

  const ownedLobbyModeIds = useMemo(() => {
    const entitlementKeys = new Set(profileEntitledModeKeys || []);
    return lobbyModeOptions
      .filter((mode) => entitlementKeys.has(mode.id))
      .map((mode) => mode.id);
  }, [lobbyModeOptions, profileEntitledModeKeys]);

  useEffect(() => {
    let isMounted = true;

    fetch(`${serverUrl}/api/game-modes`, {
      headers: buildProfileSessionHeaders(),
      credentials: "include"
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!isMounted || !Array.isArray(payload?.modes) || payload.modes.length === 0) return;
        setLobbyModeOptions(payload.modes);
      })
      .catch((error) => console.warn("Failed to load game modes", error));

    return () => {
      isMounted = false;
    };
  }, [entitlementRefreshRequestedAtMs]);

  useEffect(() => {
    if (ownedLobbyModeIds.length === 0) {
      if (selectedLobbyModeId !== "standard") {
        window.setTimeout(() => setSelectedLobbyModeId("standard"), 0);
      }
      return;
    }

    if (!ownedLobbyModeIds.includes(selectedLobbyModeId)) {
      window.setTimeout(() => setSelectedLobbyModeId(ownedLobbyModeIds[0]), 0);
    }
  }, [ownedLobbyModeIds, selectedLobbyModeId]);

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
      window.setTimeout(() => setIsViewingRoomPage(false), 0);
      return;
    }

    if (
      ["loading", "active", "paused"].includes(me?.game?.status)
      && !me?.waitingForNextGame
      && me?.currentGameParticipant
    ) {
      setStoredRoomViewPreference(roomId, false);
      window.setTimeout(() => setIsViewingRoomPage(false), 0);
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
            connectionState={connectionState}
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
            minPlayers={roomState?.minPlayers ?? 2}
            maxPlayers={roomState?.maxPlayers ?? 4}
            phase={roomState?.phase ?? "-"}
            roomStatus={roomState?.status ?? roomState?.phase ?? "-"}
            serverNow={serverOffsetMs === null ? null : serverNow}
            pingMs={pingMs}
            timeSyncStatus={timeSyncStatus}
            waitingForNextGame={Boolean(me?.waitingForNextGame)}
            colors={PLAYER_COLORS}
            onSetColor={setPlayerColor}
            onSetReady={setPlayerReady}
            onExit={exitRoom}
            connectionState={connectionState}
            onUiButtonClick={playClickSound}
            canManageReady={!actionsLocked && (connectionState === CONNECTION_STATES.CONNECTED || connectionState === CONNECTION_STATES.DEGRADED) && (roomState?.phase === "lobby" || (isViewingRoomPage && me?.game?.status === "gameover"))}
            canOpenStore={Boolean(me?.isHost)}
            isPreviewRoom={isPreviewRoom}
            onOpenStore={() => setShowStore(true)}
            hostUnlockingPending={Boolean(roomState?.hostUnlockingPending)}
            unlockingProductName={roomState?.unlockingProductName ?? null}
            selectedModeId={roomState?.selectedModeId ?? "standard"}
            availableModes={roomState?.availableModes ?? []}
            canSelectMode={Boolean(!actionsLocked && me?.isHost && me?.hasEntitlement && (roomState?.phase === "lobby" || (isViewingRoomPage && me?.game?.status === "gameover")))}
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
          timeSyncStatus={timeSyncStatus}
          onNameChange={setName}
          onRoomIdInputChange={setRoomIdInput}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onUiButtonClick={playClickSound}
          selectedModeId={selectedLobbyModeId}
          availableModes={lobbyModeOptions}
          canSelectMode={Boolean(!actionsLocked && profileEntitledModeKeys.length)}
          actionsLocked={actionsLocked}
          profileEntitlementExpiresAtMs={profileEntitlementExpiresAtMs}
          entitledModeKeys={profileEntitledModeKeys}
          entitledModeExpiriesMs={profileEntitledModeExpiriesMs}
          onSelectedModeChange={setSelectedLobbyModeId}
          onCreateEntitlementTransfer={createEntitlementTransfer}
          modeDebugConfigs={modeDebugConfigs}
        />
      )}
      {showStore ? (
        <div className="qr-modal-backdrop" onClick={() => setShowStore(false)}>
          <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="qr-modal-title">Store</h2>
            <p className="panel-subtitle">Buy a single mode or the Party Pack bundle.</p>
            <div className="store-action-list">
              <button className="btn btn-secondary" disabled={actionsLocked} onClick={() => purchaseProduct("glitch_standard_mode")}>Buy GLiTCH! Mode</button>
              <button className="btn btn-secondary" disabled={actionsLocked} onClick={() => purchaseProduct("glitch_chaos_mode")}>Buy Chaos Mode</button>
              <button className="btn btn-secondary" disabled={actionsLocked} onClick={() => purchaseProduct("glitch_blitz_mode")}>Buy Blitz Mode</button>
              <button className="btn btn-primary" disabled={actionsLocked} onClick={() => purchaseProduct("glitch_party_pack")}>Buy Party Pack</button>
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
