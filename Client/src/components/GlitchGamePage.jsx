import { useEffect, useMemo, useRef, useState } from "react";
import {
  GAME_AUDIO_KEYS,
  playSound,
  preloadAudioAssets,
  resumeAudioEngine,
  setTensionLoopParameters,
  startTensionLoop,
  stopAllActiveAudio,
  stopTensionLoop
} from "../audioEngine";
import { CONNECTION_STATES, getConnectionStateLabel } from "../connectionState";
import clearBackgroundLogo from "../assets/images/Logos/Logo_ClearBackground.svg";

const BLITZ_BACKGROUND_IMAGE_SOURCE = new URL("../assets/images/GlitchBackgrounds/blitz_blue_streaks.png", import.meta.url).href;

const GAME_ICON_IMAGES = {
  eye: { label: "Eye", src: new URL("../assets/images/GameIcons/Eye_Base.png", import.meta.url).href, aspect: "280 / 154", width: "78%" },
  bolt: { label: "Lightning bolt", src: new URL("../assets/images/GameIcons/Lightning_Base.png", import.meta.url).href, aspect: "200 / 202", width: "58%" },
  skull: { label: "Skull", src: new URL("../assets/images/GameIcons/Skull_Base.png", import.meta.url).href, aspect: "241 / 254", width: "62%" },
  smiley: { label: "Smiley", src: new URL("../assets/images/GameIcons/Smile_Base.png", import.meta.url).href, aspect: "1 / 1", width: "58%" },
  star: { label: "Star", src: new URL("../assets/images/GameIcons/Star_base.png", import.meta.url).href, aspect: "1 / 1", width: "64%" },
  eye_readable_twin: { label: "Eye readable twin", src: new URL("../assets/images/GameIcons/Eye_RT.png", import.meta.url).href, aspect: "280 / 154", width: "78%" },
  eye_doubt_twin: { label: "Eye doubt twin", src: new URL("../assets/images/GameIcons/Eye_DT.png", import.meta.url).href, aspect: "280 / 154", width: "78%" },
  bolt_readable_twin: { label: "Lightning readable twin", src: new URL("../assets/images/GameIcons/Lightning_RT.png", import.meta.url).href, aspect: "193 / 188", width: "58%" },
  bolt_doubt_twin: { label: "Lightning doubt twin", src: new URL("../assets/images/GameIcons/Light_DT.png", import.meta.url).href, aspect: "200 / 202", width: "58%" },
  skull_readable_twin: { label: "Skull readable twin", src: new URL("../assets/images/GameIcons/Skull_RT.png", import.meta.url).href, aspect: "240 / 254", width: "62%" },
  skull_doubt_twin: { label: "Skull doubt twin", src: new URL("../assets/images/GameIcons/Skull_DT.png", import.meta.url).href, aspect: "240 / 254", width: "62%" },
  smiley_readable_twin: { label: "Smiley readable twin", src: new URL("../assets/images/GameIcons/Smile_RT.png", import.meta.url).href, aspect: "1 / 1", width: "58%" },
  smiley_doubt_twin: { label: "Smiley doubt twin", src: new URL("../assets/images/GameIcons/Smile_DT.png", import.meta.url).href, aspect: "1 / 1", width: "58%" },
  star_readable_twin: { label: "Star readable twin", src: new URL("../assets/images/GameIcons/Star_RT.png", import.meta.url).href, aspect: "242 / 259", width: "64%" },
  star_doubt_twin: { label: "Star doubt twin", src: new URL("../assets/images/GameIcons/Star_DT.png", import.meta.url).href, aspect: "1 / 1", width: "64%" },
  eye_partial_break: { label: "Eye partial break", src: new URL("../assets/images/GameIcons/Eye_PB.png", import.meta.url).href, aspect: "303 / 170", width: "80%" },
  bolt_partial_break: { label: "Lightning partial break", src: new URL("../assets/images/GameIcons/Light_PB.png", import.meta.url).href, aspect: "200 / 204", width: "58%" },
  skull_partial_break: { label: "Skull partial break", src: new URL("../assets/images/GameIcons/Skull_PB.png", import.meta.url).href, aspect: "254 / 286", width: "64%" },
  smiley_partial_break: { label: "Smiley partial break", src: new URL("../assets/images/GameIcons/Smile_PB.png", import.meta.url).href, aspect: "227 / 234", width: "60%" },
  star_partial_break: { label: "Star partial break", src: new URL("../assets/images/GameIcons/Star_PB.png", import.meta.url).href, aspect: "239 / 247", width: "64%" }
};

const GAME_ICON_IMAGE_SOURCES = Array.from(new Set(Object.values(GAME_ICON_IMAGES).map((icon) => icon.src)));
const GLITCH_BACKGROUND_IMAGE_SOURCES = [
  BLITZ_BACKGROUND_IMAGE_SOURCE,
  new URL("../assets/images/GlitchBackgrounds/subtle_noise_scanlines_white_transparent.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/horizontal_glitch_streaks_white_transparent.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/glitch_grunge_frame_white_transparent.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/energy_burst_glitch_white_transparent.png", import.meta.url).href
];
const GAME_IMAGE_SOURCES = Array.from(new Set([
  ...GAME_ICON_IMAGE_SOURCES,
  ...GLITCH_BACKGROUND_IMAGE_SOURCES
]));
const imagePreloadCache = new Map();

function isPartialBreakToken(token) {
  return typeof token === "string" && token.endsWith("_partial_break");
}

function getStimulusClassName(token) {
  const baseToken = getStimulusBaseToken(token);
  return [
    baseToken ? `stimulus-${baseToken}` : "",
    isPartialBreakToken(token) ? "partial-break-stimulus" : ""
  ].filter(Boolean).join(" ");
}

function preloadImageFiles(sources) {
  if (typeof Image === "undefined") return Promise.resolve([]);

  return Promise.all(sources.map((src) => {
    if (imagePreloadCache.has(src)) return imagePreloadCache.get(src);

    const promise = new Promise((resolve) => {
      const image = new Image();
      const finish = () => resolve();
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
      image.src = src;
    });

    imagePreloadCache.set(src, promise);
    return promise;
  }));
}

function formatTimeLeft(ms) {
  if (typeof ms !== "number") return "-";
  return `${Math.max(0, Math.ceil(ms / 100) / 10).toFixed(1)}s`;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function formatDigitalTime(ms) {
  if (typeof ms !== "number") return "00 : 00";
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")} : ${String(seconds).padStart(2, "0")}`;
}

function getModeSubtitle(mode, modeId) {
  const title = mode?.title || modeId || "standard";
  const cleanedTitle = title.replace(/^GLiTCH!\s*/i, "").trim();
  if (cleanedTitle) return cleanedTitle;
  return modeId === "standard" ? "Standard" : String(modeId || "standard");
}

const ANSWER_DISPLAY = {
  sync: { label: "SYNC", className: "sync" },
  glitch: { label: "GLiTCH!", className: "glitch" }
};

const STIMULUS_LABELS = {
  eye: "Eye",
  bolt: "Lightning",
  skull: "Skull",
  smiley: "Smiley",
  star: "Star"
};

function getAnswerDisplay(answer) {
  return ANSWER_DISPLAY[String(answer || "").toLowerCase()] || { label: "-", className: "unknown" };
}

function getStimulusBaseToken(token) {
  return String(token || "")
    .replace(/_(readable|doubt)_twin$/i, "")
    .replace(/_partial_break$/i, "");
}

function getStimulusLabel(token) {
  const baseToken = getStimulusBaseToken(token);
  return STIMULUS_LABELS[baseToken] || (baseToken ? baseToken.replace(/_/g, " ") : "Screen");
}

function formatKillCause(causeLabel) {
  const normalized = String(causeLabel || "").trim();
  if (!normalized) return "Run ended";
  if (normalized.toLowerCase() === "preview ended") return "Preview ended";
  return normalized;
}

function formatKillPlayerNames(entries) {
  const names = (entries || []).map((entry) => entry.name).filter(Boolean);
  if (!names.length) return "-";
  return names.join(", ");
}

function getKillScreenPlayerEntry(realityCheck, playerId) {
  const groups = [
    ...(realityCheck?.standardPlayers || []),
    ...(realityCheck?.alteredPlayers || [])
  ];
  return groups.find((entry) => entry.playerId === playerId) || null;
}

const PRE_GAME_COUNTDOWN_MS = 3000;
const ICON_SHAKE_BEFORE_SWAP_MS = 220;
const ICON_SHAKE_AFTER_SWAP_MS = 90;

const VISUAL_EFFECT_CLASS_MAP = {
  subtle_flicker_pulse: "corruption-flicker-light",
  small_screen_edge_cracks: "corruption-edge-cracks-light",
  slightly_more_unstable_transition_beat: "corruption-transition-beat-unstable",
  unstable_transition_beat: "corruption-transition-beat-unstable",
  light_color_instability: "corruption-color-instability-light",
  distort_pulse_before_reveal: "corruption-distort-pulse-light",
  interference_pulse_before_reveal: "corruption-static-pulse-before-reveal",
  static_surge_transition: "corruption-static-surge-transition",
  multiple_light_effects: "corruption-multiple-light-effects",
  two_heavier_corruption_layers: "corruption-two-heavy-layers",
  overload_reveal: "corruption-overload-reveal",
  overload_transition: "corruption-overload-transition",

  static_interference: "corruption-static-overlay",
  flicker_overlap: "corruption-flicker-heavy",
  stronger_hue_drift: "corruption-hue-heavy",
  light_chromatic_shift: "corruption-hue-light",
  one_or_more_screens_get_light_color_instability: "corruption-color-instability-light",
  clearer_hue_drift: "corruption-hue-light",
  color_flip_before_reveal: "corruption-invert-flash",
  invert_flash_before_reveal: "corruption-invert-flash",
  aggressive_screen_pulse: "corruption-pulse-heavy",
  unstable_screen_pulse: "corruption-pulse-light",
  brighter_transition_pulse: "corruption-transition-pulse-bright",
  short_distort_pulse_just_before_reveal: "corruption-distort-pulse-light",
  short_interference_pulse_before_reveal: "corruption-static-pulse-before-reveal",
  short_static_surge_in_the_transition_beat: "corruption-static-surge-transition",
  heavier_edge_cracks: "corruption-edge-cracks-heavy",
  multiple_light_effects_may_be_active_together: "corruption-multiple-light-effects",
  stronger_reveal_distortion: "corruption-distort-heavy",
  dirty_reveal: "corruption-distort-light",
  two_heavier_corruption_layers_at_once: "corruption-two-heavy-layers",
  reveal_and_transition_feel_like_the_run_could_break_at_any_moment: "corruption-overload-transition",
  overload_feeling_should_peak_without_making_core_information_unfairly_unreadable: "corruption-overload-reveal",
  stronger_hue_drift_with_static: "corruption-static-overlay",
  maximum_combined_corruption: "corruption-maximum"
};

function getCorruptionVisualClasses(corruptionEffects) {
  if (!corruptionEffects) return [];
  const visualEffects = Array.isArray(corruptionEffects.visualEffects) ? corruptionEffects.visualEffects : [];
  const mappedClasses = visualEffects.map((effect) => VISUAL_EFFECT_CLASS_MAP[effect]).filter(Boolean);
  if (corruptionEffects.intensityLevel >= 8) mappedClasses.push("corruption-intensity-high");
  if (corruptionEffects.intensityLevel >= 5) mappedClasses.push("corruption-intensity-medium");
  return Array.from(new Set(mappedClasses));
}

function getBaseTensionParams(modeId = "standard", combo = 0) {
  const normalizedModeId = String(modeId || "standard").toLowerCase();
  const safeCombo = Math.max(0, Number(combo) || 0);

  if (normalizedModeId === "blitz") {
    const comboSteps = Math.floor(safeCombo / 5);
    return {
      playbackRate: Math.min(1.75, 1.25 + (comboSteps * 0.1)),
      gain: Math.min(0.6, 0.25 + (comboSteps * 0.05))
    };
  }

  const comboSteps = Math.floor(safeCombo / 10);
  return {
    playbackRate: Math.min(1.25, 1 + (comboSteps * 0.03)),
    gain: Math.min(0.25, 0.15 + (comboSteps * 0.025))
  };
}

function getLastChanceTensionParams(baseParams) {
  return {
    playbackRate: Math.min(1.35, baseParams.playbackRate + 0.15),
    gain: Math.min(0.35, baseParams.gain + 0.15)
  };
}

function getHeatSurgeTensionParams(baseParams) {
  return {
    playbackRate: Math.min(2, baseParams.playbackRate + 0.25),
    gain: Math.min(0.75, baseParams.gain + 0.15)
  };
}

function getTensionDistortionLevel(modeId, corruptionEffects) {
  return String(modeId || "").toLowerCase() === "chaos"
    ? Number(corruptionEffects?.intensityLevel) || 0
    : 0;
}

function scheduleResultsTicks(combo, registerTimeout) {
  const tickCount = Math.min(120, Math.max(0, Math.floor(Number(combo) || 0)));
  if (tickCount <= 0) return;

  const totalDurationMs = Math.min(1500, Math.max(1000, tickCount * 35));
  const intervalMs = totalDurationMs / tickCount;

  for (let index = 0; index < tickCount; index += 1) {
    registerTimeout(window.setTimeout(() => {
      playSound("resultsTick", { volume: 0.7 });
    }, 550 + (intervalMs * index)));
  }
}


function GlitchGamePage({ roomId, playerId, players, myGame, serverNow, onSubmitAnswer, onAssetsLoaded, onReturnRoom, onExit, connectionState = CONNECTION_STATES.CONNECTING, onUiButtonClick, isPreviewRoom = false, availableModes = [], selectedModeId = "standard" }) {
  const currentRound = myGame?.currentRound;
  const currentRoundCorruptionEffects = currentRound?.corruptionEffects ?? null;
  const currentRoundHeatSurgeActive = Boolean(currentRound?.heatSurgeActive);
  const tensionBaseParams = useMemo(
    () => getBaseTensionParams(myGame?.modeId || selectedModeId, myGame?.combo),
    [myGame?.combo, myGame?.modeId, selectedModeId]
  );
  const tensionTargetParams = useMemo(
    () => (currentRound?.isLastChanceReplay ? getLastChanceTensionParams(tensionBaseParams) : tensionBaseParams),
    [currentRound?.isLastChanceReplay, tensionBaseParams]
  );
  const tensionDistortionLevel = useMemo(
    () => getTensionDistortionLevel(myGame?.modeId || selectedModeId, currentRoundCorruptionEffects),
    [currentRoundCorruptionEffects, myGame?.modeId, selectedModeId]
  );

  const activeModeId = myGame?.modeId || selectedModeId;
  const isBlitzMode = String(activeModeId || "").toLowerCase() === "blitz";
  const selectedMode = useMemo(() => availableModes.find((mode) => mode.id === activeModeId) || null, [activeModeId, availableModes]);
  const selectedModeOrientationLock = (selectedMode?.orientationLock || "both").toLowerCase();
  const [deviceOrientation, setDeviceOrientation] = useState("unknown");
  const isMobileDevice = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");

  useEffect(() => {
    const updateOrientation = () => {
      const isLandscape = typeof window !== "undefined" ? window.matchMedia("(orientation: landscape)").matches : false;
      setDeviceOrientation(isLandscape ? "horizontal" : "vertical");
    };
    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);
    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, []);

  const isWrongOrientation = isMobileDevice && selectedModeOrientationLock !== "both" && selectedModeOrientationLock !== deviceOrientation;
  const connectionBanner = (
    <div className={`connection-banner ${connectionState}`} role="status" aria-live="polite">
      <strong>Connection:</strong> {getConnectionStateLabel(connectionState)}
      {connectionState === CONNECTION_STATES.RECONNECTING ? " — trying to restore your room session…" : null}
      {connectionState === CONNECTION_STATES.DEGRADED ? " — high latency detected; effects may feel lighter." : null}
      {connectionState === CONNECTION_STATES.DISCONNECTED ? " — connection lost. Keep this tab open while we retry." : null}
    </div>
  );
  const answered = false;

  const timeRemainingMs = useMemo(() => {
    if (!currentRound || typeof serverNow !== "number") return null;
    return currentRound.decisionDeadlineMs - serverNow;
  }, [currentRound, serverNow]);

  const answeredPlayerIds = useMemo(() => new Set(currentRound?.answeredPlayerIds || []), [currentRound]);

  const preGameCountdownNumber = useMemo(() => {
    if (!myGame || myGame.status !== "active" || currentRound) return null;
    if (typeof serverNow !== "number") return null;

    const countdownStartMs = myGame.roundNumber === 0
      ? myGame.startedAtMs
      : myGame.reconnectCountdownStartedAtMs;

    if (typeof countdownStartMs !== "number") return null;

    const elapsedMs = serverNow - countdownStartMs;
    if (elapsedMs < 0 || elapsedMs >= PRE_GAME_COUNTDOWN_MS) return null;

    return 3 - Math.floor(elapsedMs / 1000);
  }, [currentRound, myGame, serverNow]);

  const isPregameCountdown = preGameCountdownNumber !== null;
  const modeSubtitle = getModeSubtitle(selectedMode, myGame?.modeId || activeModeId);
  const pregameScreenClassName = [
    "glitch-game-screen",
    "pregame-screen",
    isBlitzMode ? "blitz-mode" : "",
    "standard"
  ].filter(Boolean).join(" ");
  const pregameScreenStyle = {
    "--glitch-bg-motion-opacity": "0.64",
    "--glitch-bg-structure-opacity": "0.58",
    "--glitch-bg-motion-duration": "980ms",
    "--glitch-bg-shift-x": "4px",
    "--glitch-bg-shift-y": "3px",
    "--glitch-bg-shift-x-neg": "-4px",
    "--glitch-bg-shift-y-neg": "-3px",
    "--glitch-bg-motion-peak-opacity": "0.82"
  };
  const renderPregameScreen = (stateClassName, children) => (
    <section className={pregameScreenClassName} style={pregameScreenStyle}>
      <span className="glitch-background-layers" aria-hidden="true" />
      <header className="glitch-game-heading pregame-heading">
        <h1>GLiTCH!</h1>
        <p>{modeSubtitle}</p>
      </header>
      <main className={`pregame-stage ${stateClassName}`}>
        {children}
      </main>
    </section>
  );
  const saveItLabel = myGame?.lastRoundResult?.statusLabel || "";
  const isSaveItActive = saveItLabel === "SAVE IT!";
  const previousSaveItStateRef = useRef(false);
  const [displayedIconToken, setDisplayedIconToken] = useState(currentRound?.yourStimulus ?? null);
  const [isRoundTransitionShaking, setIsRoundTransitionShaking] = useState(false);
  const transitionTimeoutRef = useRef(null);
  const transitionStopTimeoutRef = useRef(null);
  const previousRoundIdRef = useRef(currentRound?.id ?? null);
  const hasNotifiedLoadedRef = useRef(false);
  const previousGameStatusRef = useRef(myGame?.status ?? null);
  const previousRoundPassedRef = useRef(myGame?.lastRoundResult?.passed ?? null);
  const previousHeatSurgeActiveRef = useRef(currentRoundHeatSurgeActive);
  const heatSurgeReturnTimeoutRef = useRef(null);
  const resultsTickTimeoutsRef = useRef([]);
  const hasStartedRunAudioRef = useRef(false);

  useEffect(() => {
    const roundId = currentRound?.id ?? null;
    const nextToken = currentRound?.yourStimulus ?? null;
    const previousRoundId = previousRoundIdRef.current;

    if (roundId === previousRoundId) return undefined;
    previousRoundIdRef.current = roundId;

    if (!previousRoundId && roundId) {
      transitionTimeoutRef.current = setTimeout(() => {
        setDisplayedIconToken(nextToken);
        setIsRoundTransitionShaking(false);
        transitionTimeoutRef.current = null;
      }, 0);
      return undefined;
    }

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    if (transitionStopTimeoutRef.current) {
      clearTimeout(transitionStopTimeoutRef.current);
      transitionStopTimeoutRef.current = null;
    }

    window.setTimeout(() => setIsRoundTransitionShaking(true), 0);

    transitionTimeoutRef.current = setTimeout(() => {
      setDisplayedIconToken(nextToken);
      transitionStopTimeoutRef.current = setTimeout(() => {
        setIsRoundTransitionShaking(false);
        transitionStopTimeoutRef.current = null;
      }, ICON_SHAKE_AFTER_SWAP_MS);
      transitionTimeoutRef.current = null;
    }, ICON_SHAKE_BEFORE_SWAP_MS);

    return undefined;
  }, [currentRound?.id, currentRound?.yourStimulus]);

  useEffect(() => () => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (transitionStopTimeoutRef.current) {
      clearTimeout(transitionStopTimeoutRef.current);
      transitionStopTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (myGame?.status !== "loading") {
      hasNotifiedLoadedRef.current = false;
      return;
    }
    if (hasNotifiedLoadedRef.current) return;

    let cancelled = false;
    const preloadAllAssets = async () => {
      await Promise.all([
        preloadAudioAssets(GAME_AUDIO_KEYS),
        preloadImageFiles(GAME_IMAGE_SOURCES)
      ]);
      if (!cancelled) {
        hasNotifiedLoadedRef.current = true;
        onAssetsLoaded?.();
      }
    };

    preloadAllAssets();
    return () => {
      cancelled = true;
    };
  }, [myGame?.status, onAssetsLoaded]);

  useEffect(() => {
    if (isSaveItActive && !previousSaveItStateRef.current) {
      stopAllActiveAudio();
      playSound("lastChanceFreeze");
    }

    previousSaveItStateRef.current = isSaveItActive;
  }, [isSaveItActive]);

  useEffect(() => {
    const previousRoundPassed = previousRoundPassedRef.current;
    const lastRoundPassed = myGame?.lastRoundResult?.passed ?? null;

    if (previousRoundPassed !== true && lastRoundPassed === true) {
      playSound("correctAnswer");
    }

    previousRoundPassedRef.current = lastRoundPassed;
  }, [myGame?.lastRoundResult?.passed]);

  useEffect(() => {
    const previousGameStatus = previousGameStatusRef.current;
    const nextGameStatus = myGame?.status ?? null;

    const clearResultsTickTimeouts = () => {
      resultsTickTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      resultsTickTimeoutsRef.current = [];
    };
    const registerResultsTickTimeout = (timeoutId) => {
      resultsTickTimeoutsRef.current.push(timeoutId);
    };

    if (nextGameStatus === "active" && previousGameStatus !== "active") {
      hasStartedRunAudioRef.current = true;
      playSound("gameTransition");
      startTensionLoop({ playbackRate: 1, gain: 0.15, distortionIntensityLevel: 0 });
    }

    if (nextGameStatus === "paused" && previousGameStatus !== "paused") {
      stopTensionLoop();
    }

    if (nextGameStatus === "gameover" && previousGameStatus !== "gameover") {
      clearResultsTickTimeouts();
      hasStartedRunAudioRef.current = false;
      stopAllActiveAudio();

      if (myGame?.killScreen?.causeLabel === "preview ended") {
        playSound("previewEnded");
      } else {
        playSound("failImpact");
        registerResultsTickTimeout(window.setTimeout(() => {
          playSound("killScreenSting");
          scheduleResultsTicks(myGame?.killScreen?.combo ?? myGame?.combo, registerResultsTickTimeout);
        }, 300));
      }
    }

    previousGameStatusRef.current = nextGameStatus;
  }, [myGame?.combo, myGame?.killScreen?.causeLabel, myGame?.killScreen?.combo, myGame?.status]);

  useEffect(() => () => {
    stopTensionLoop();
    resultsTickTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    resultsTickTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resumeAudioEngine();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const previousHeatSurgeActive = previousHeatSurgeActiveRef.current;
    previousHeatSurgeActiveRef.current = currentRoundHeatSurgeActive;

    if (!currentRoundHeatSurgeActive || previousHeatSurgeActive || myGame?.status !== "active") {
      return undefined;
    }

    if (heatSurgeReturnTimeoutRef.current) {
      window.clearTimeout(heatSurgeReturnTimeoutRef.current);
      heatSurgeReturnTimeoutRef.current = null;
    }

    const heatSurgeParams = getHeatSurgeTensionParams(tensionBaseParams);
    stopAllActiveAudio();
    playSound("heatSurgeWarning");
    startTensionLoop({
      ...heatSurgeParams,
      distortionIntensityLevel: tensionDistortionLevel
    });

    heatSurgeReturnTimeoutRef.current = window.setTimeout(() => {
      setTensionLoopParameters({
        ...tensionTargetParams,
        distortionIntensityLevel: tensionDistortionLevel,
        rampMs: 400
      });
      heatSurgeReturnTimeoutRef.current = null;
    }, 400);

    return () => {
      if (heatSurgeReturnTimeoutRef.current) {
        window.clearTimeout(heatSurgeReturnTimeoutRef.current);
        heatSurgeReturnTimeoutRef.current = null;
      }
    };
  }, [currentRoundHeatSurgeActive, myGame?.status, tensionBaseParams, tensionDistortionLevel, tensionTargetParams]);

  useEffect(() => {
    if (myGame?.status !== "active" || isSaveItActive || heatSurgeReturnTimeoutRef.current) return;

    startTensionLoop({
      ...tensionTargetParams,
      distortionIntensityLevel: tensionDistortionLevel,
      rampMs: hasStartedRunAudioRef.current ? 150 : 0
    });
    hasStartedRunAudioRef.current = true;
  }, [currentRoundHeatSurgeActive, isSaveItActive, myGame?.status, tensionDistortionLevel, tensionTargetParams]);

  if (!myGame) {
    return (
      <section className="panel">
        <h1 className="panel-title">GLiTCH! · Room {roomId}</h1>
        <p className="panel-subtitle">Waiting for game state…</p>
      </section>
    );
  }

  if (isPregameCountdown) {
    return renderPregameScreen("countdown-state", (
      <>
        <div className="pregame-countdown" aria-live="assertive">
          <span>{preGameCountdownNumber}</span>
        </div>
        <p className="pregame-status-label">Get ready</p>
      </>
    ));
  }

  if (myGame.status === "loading") {
    const activePlayers = players.filter((player) => player.currentGameParticipant && !player.waitingForNextGame);
    const loadedCount = activePlayers.filter((player) => player.assetsLoaded).length;
    const loadingProgress = activePlayers.length ? clamp01(loadedCount / activePlayers.length) : 0;
    return renderPregameScreen("loading-state", (
      <>
        <div
          className="pregame-loading-ring"
          style={{ "--pregame-load-progress": `${Math.round(loadingProgress * 360)}deg` }}
          aria-live="polite"
        >
          <span>{loadedCount}/{activePlayers.length}</span>
        </div>
        <p className="pregame-status-label">Loading assets</p>
        <div className="pregame-loading-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(loadingProgress * 100)}%` }} />
        </div>
      </>
    ));
  }

  if (myGame.status === "gameover") {
    const killScreen = myGame.killScreen || {};
    const realityCheck = killScreen.realityCheck || {};
    const finalCombo = killScreen.combo ?? myGame.combo ?? 0;
    const finalScore = killScreen.score ?? myGame.score ?? 0;
    const causeLabel = formatKillCause(killScreen.causeLabel);
    const decisivePlayers = killScreen.decisivePlayers || [];
    const decisiveNames = formatKillPlayerNames(decisivePlayers);
    const decisiveSummary = decisivePlayers.length
      ? decisivePlayers.map((entry) => {
        if (entry.reason === "missed_input") return `${entry.name} missed the input`;
        return `${entry.name} tapped ${getAnswerDisplay(entry.input).label}`;
      }).join(", ")
      : (killScreen.causeLabel === "preview ended" ? "Preview limit reached" : "No decisive player recorded");
    const correctAnswer = getAnswerDisplay(killScreen.correctAnswer || realityCheck.expectedAnswer);
    const standardStimulus = realityCheck.standardStimulus || currentRound?.yourStimulus || null;
    const alteredStimulus = realityCheck.alteredStimulus || null;
    const fallbackRealityPlayers = alteredStimulus ? [] : players.filter((player) => !player.waitingForNextGame);
    const standardPlayers = (realityCheck.standardPlayers || []).length ? realityCheck.standardPlayers : fallbackRealityPlayers;
    const alteredPlayers = realityCheck.alteredPlayers || [];
    const standardIcon = GAME_ICON_IMAGES[standardStimulus] || null;
    const alteredIcon = GAME_ICON_IMAGES[alteredStimulus] || null;
    const renderKillSymbol = (stimulus, fallbackLabel) => {
      const icon = GAME_ICON_IMAGES[stimulus] || null;
      if (!icon) return <span className="kill-symbol-fallback">{fallbackLabel || "?"}</span>;
      return (
        <span
          className="kill-symbol-icon"
          style={{
            "--game-icon-image": `url(${icon.src})`,
            "--game-icon-aspect": icon.aspect,
            "--game-icon-width": icon.width
          }}
          aria-hidden="true"
        />
      );
    };

    return (
      <section className="kill-screen-page">
        <span className="glitch-background-layers" aria-hidden="true" />

        <div className="kill-screen-brand" aria-label="Vervus">
          <img src={clearBackgroundLogo} alt="Vervus" />
        </div>

        <header className="kill-screen-hero">
          <h1>GLiTCH!</h1>
          <strong>{finalCombo}</strong>
          <span>COMBO</span>
        </header>

        <main className="kill-screen-content">
          <section className="kill-card kill-culprit-card">
            <div className="kill-card-header">
              <span>Who broke the run</span>
              <strong>{correctAnswer.label}</strong>
            </div>
            <div className="kill-culprit-row">
              <span className={`kill-answer-orb ${correctAnswer.className}`} aria-hidden="true">{correctAnswer.label === "SYNC" ? "S" : "G"}</span>
              <div>
                <strong>{decisiveNames}</strong>
                <span>{decisiveSummary}</span>
              </div>
            </div>
            <p>{causeLabel}.</p>
          </section>

          <section className="kill-card kill-reality-card">
            <div className="kill-card-header">
              <span>Reality check</span>
            </div>
            <div className="kill-reality-row">
              <div>
                <strong>Standard {getStimulusLabel(standardStimulus)}</strong>
                <span>{formatKillPlayerNames(standardPlayers)}</span>
              </div>
              <span className="kill-symbol-disc" aria-label={standardIcon?.label || "Standard screen"}>
                {renderKillSymbol(standardStimulus, "S")}
              </span>
            </div>
            <div className="kill-reality-row altered">
              <div>
                <strong>{alteredStimulus ? `Altered ${getStimulusLabel(alteredStimulus)}` : "Altered screen"}</strong>
                <span>{formatKillPlayerNames(alteredPlayers)}</span>
              </div>
              <span className="kill-symbol-disc" aria-label={alteredIcon?.label || "Altered screen"}>
                {renderKillSymbol(alteredStimulus, "G")}
              </span>
            </div>
          </section>

          <section className="kill-card kill-experience-card">
            <div className="kill-card-header">
              <span>Experience</span>
            </div>
            <div className="kill-mode-row">
              <div>
                <strong>GLiTCH!</strong>
                <span>{getModeSubtitle(selectedMode, myGame.modeId || selectedModeId)}</span>
              </div>
              <span>{finalScore} pts</span>
            </div>
          </section>

          <section className="kill-card kill-players-card">
            <div className="kill-card-header">
              <span>Players</span>
            </div>
            <ul className="kill-player-list">
              {players.filter((player) => !player.waitingForNextGame).map((player) => {
                const decisiveEntry = decisivePlayers.find((entry) => entry.playerId === player.playerId);
                const realityEntry = getKillScreenPlayerEntry(realityCheck, player.playerId);
                const answerDisplay = getAnswerDisplay(decisiveEntry?.input || realityEntry?.input);
                const hasMissedInput = decisiveEntry?.reason === "missed_input";
                const statusClassName = hasMissedInput ? "missed" : answerDisplay.className;
                const statusLabel = hasMissedInput ? "No response" : answerDisplay.label;
                return (
                  <li key={player.playerId} className="kill-player-row">
                    <span className="kill-player-avatar" style={{ "--player-color": player.color || "#8d5cff" }} aria-hidden="true">
                      <span />
                    </span>
                    <strong>{player.playerId === playerId ? "You" : player.name}</strong>
                    <div>
                      <span className={`kill-mini-pill ${statusClassName}`}>{statusLabel}</span>
                      <span className={`kill-mini-pill ${player.ready ? "ready" : "waiting"}`}>{player.ready ? "Ready" : "Waiting"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>

        <footer className="kill-screen-actions">
          <button type="button" className="kill-return-button" onClick={() => { onUiButtonClick?.(); onReturnRoom(); }}>Return to room</button>
        </footer>
      </section>
    );
  }

  if (myGame.status === "paused") {
    return (
      <section className="panel">
        <div className="kill-screen">
          <h2>Game Paused</h2>
          <p>A participant disconnected. The game will resume once everyone reconnects.</p>
          {connectionBanner}
          <button className="btn btn-secondary" onClick={() => { onUiButtonClick?.(); onExit(); }}>Exit Room</button>
        </div>
      </section>
    );
  }

  const iconToken = displayedIconToken;
  const stimulusIcon = iconToken ? GAME_ICON_IMAGES[iconToken] : null;
  const stimulusClassName = getStimulusClassName(iconToken);
  const isHeatSurgeEnabled = Boolean(currentRound?.heatSurgeActive);
  const corruptionEffects = currentRound?.corruptionEffects;
  const corruptionClasses = getCorruptionVisualClasses(corruptionEffects).join(" ");
  const roundTimerMs = Number(currentRound?.timerMs) || 0;
  const safeTimeRemainingMs = typeof timeRemainingMs === "number" ? Math.max(0, timeRemainingMs) : 0;
  const boundedTimeRemainingMs = roundTimerMs > 0 ? Math.min(roundTimerMs, safeTimeRemainingMs) : safeTimeRemainingMs;
  const timerProgress = roundTimerMs > 0 ? clamp01(boundedTimeRemainingMs / roundTimerMs) : 0;
  const displayTimeMs = isSaveItActive ? Math.min(3000, roundTimerMs || 3000) : boundedTimeRemainingMs;
  const isLastChanceTheme = Boolean(currentRound?.isLastChanceReplay || isSaveItActive);
  const isDangerTheme = Boolean(isLastChanceTheme || isHeatSurgeEnabled);
  const comboIntensity = clamp01((Number(myGame.combo) || 0) / 40);
  const backgroundIntensity = isDangerTheme ? 1 : comboIntensity;
  const backgroundMotionDurationMs = Math.round(1700 - (backgroundIntensity * 1120));
  const backgroundShiftX = Math.round(1 + (backgroundIntensity * 5));
  const backgroundShiftY = Math.round(1 + (backgroundIntensity * 4));
  const gameScreenStyle = {
    "--glitch-bg-motion-opacity": isDangerTheme
      ? "0.86"
      : (0.46 + (backgroundIntensity * 0.26)).toFixed(2),
    "--glitch-bg-structure-opacity": isDangerTheme
      ? "0.72"
      : (0.4 + (backgroundIntensity * 0.18)).toFixed(2),
    "--glitch-bg-motion-duration": `${backgroundMotionDurationMs}ms`,
    "--glitch-bg-shift-x": `${backgroundShiftX}px`,
    "--glitch-bg-shift-y": `${backgroundShiftY}px`,
    "--glitch-bg-shift-x-neg": `${-backgroundShiftX}px`,
    "--glitch-bg-shift-y-neg": `${-backgroundShiftY}px`,
    "--glitch-bg-motion-peak-opacity": isDangerTheme
      ? "0.98"
      : (0.58 + (backgroundIntensity * 0.24)).toFixed(2)
  };
  const gameScreenClassName = [
    "glitch-game-screen",
    isBlitzMode ? "blitz-mode" : "",
    isDangerTheme ? "danger" : "standard",
    isSaveItActive ? "save-it-state" : "",
    currentRound?.isLastChanceReplay ? "last-chance-state" : "",
    isHeatSurgeEnabled ? "heat-surge-state" : "",
    corruptionClasses
  ].filter(Boolean).join(" ");
  const timerRingStyle = {
    "--timer-progress": `${Math.round(timerProgress * 360)}deg`,
    "--timer-marker-angle": `${Math.round((timerProgress * 360) - 180)}deg`
  };
  const stimulusIconStyle = stimulusIcon
    ? {
      "--game-icon-image": `url(${stimulusIcon.src})`,
      "--game-icon-aspect": stimulusIcon.aspect,
      "--game-icon-width": stimulusIcon.width
    }
    : undefined;
  const canSubmitAnswer = !answered
    && myGame.status === "active"
    && currentRound
    && !isSaveItActive
    && connectionState !== CONNECTION_STATES.DISCONNECTED
    && connectionState !== CONNECTION_STATES.RECONNECTING;

  return (
    <section className={gameScreenClassName} style={gameScreenStyle}>
      <span className="glitch-background-layers" aria-hidden="true" />

      {isWrongOrientation ? (
        <div className="orientation-warning-overlay" role="alert">
          <div className="orientation-warning-card">
            Wrong orientation. Please rotate to <strong>{selectedModeOrientationLock}</strong>.
          </div>
        </div>
      ) : null}

      {connectionState !== CONNECTION_STATES.CONNECTED ? (
        <div className="glitch-connection-slot">{connectionBanner}</div>
      ) : null}

      <header className="glitch-game-heading">
        <h1>GLiTCH!</h1>
        <p>{isLastChanceTheme ? "Last Chance" : modeSubtitle}</p>
        {isPreviewRoom ? <span>Preview ends at {myGame.previewComboLimit ?? "X"} combo</span> : null}
      </header>

      {isSaveItActive ? (
        <div className="save-it-splash" role="status" aria-live="assertive">
          <span>SAVE IT!</span>
        </div>
      ) : (
        <>
          <div className="glitch-combo-stack" aria-label={`${myGame.combo} combo`}>
            <strong>{myGame.combo}</strong>
            <span>COMBO</span>
          </div>

          <div className="glitch-timer-stage" aria-label={`Time left ${formatTimeLeft(boundedTimeRemainingMs)}`}>
            <div className="glitch-timer-ring" style={timerRingStyle}>
              <div className="glitch-timer-marker"><span /></div>
              <div className="glitch-symbol-disc">
                <div className={`glitch-icon ${stimulusClassName} ${isRoundTransitionShaking ? "round-transition-shake" : ""}`} role="img" aria-label={stimulusIcon?.label || "Current symbol"}>
                  {stimulusIcon ? (
                    <span className="glitch-icon-mask" style={stimulusIconStyle} aria-hidden="true" />
                  ) : (
                    <span className="glitch-icon-fallback" aria-hidden="true">?</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isHeatSurgeEnabled ? <p className="glitch-state-callout" role="status" aria-live="assertive">Heat Surge active</p> : null}
          {corruptionEffects ? (
            <p className="glitch-state-meta">Corruption Lv {corruptionEffects.intensityLevel}</p>
          ) : null}

          <div className="glitch-vote-strip" aria-label="Players who have voted">
            {players.filter((player) => !player.waitingForNextGame).map((player) => {
              const hasVoted = answeredPlayerIds.has(player.playerId);
              return (
                <span
                  key={player.playerId}
                  className={`vote-indicator ${hasVoted ? "voted" : "pending"}`}
                  style={{ backgroundColor: player.color || "#64748b" }}
                  title={`${player.name}${hasVoted ? " has voted" : " has not voted yet"}`}
                />
              );
            })}
          </div>
        </>
      )}

      <footer className="glitch-game-footer">
        <div className="glitch-time-pill">{formatDigitalTime(displayTimeMs)}</div>
        {!isSaveItActive ? (
          <div className="glitch-answer-row">
            <button className="glitch-answer-button sync" disabled={!canSubmitAnswer} onClick={() => onSubmitAnswer("sync")}>SYNC</button>
            <button className="glitch-answer-button glitch" disabled={!canSubmitAnswer} onClick={() => onSubmitAnswer("glitch")}>GLiTCH!</button>
          </div>
        ) : null}
      </footer>
    </section>
  );
}

export default GlitchGamePage;
