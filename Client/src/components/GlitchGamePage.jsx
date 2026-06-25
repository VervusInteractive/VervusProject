import { useEffect, useMemo, useRef, useState } from "react";
import correctAnswerSoundFile from "../assets/audio/Sound_CorrectAnswer.mp3";
import gameOverSoundFile from "../assets/audio/Sound_GameOver.mp3";
import lastChanceSoundFile from "../assets/audio/Sound_LastChance.mp3";
import transitionSoundFile from "../assets/audio/Sound_Pulse.mp3";
import voteReceiveSoundFile from "../assets/audio/Sound_VoteReceive.mp3";
import countSoundFile from "../assets/audio/Sound_Count.mp3";
import tickSoundFile from "../assets/audio/Sound_Tick.mp3";
import { preloadAudioElement, preloadAudioFiles } from "../audioPreload";
import { CONNECTION_STATES, getConnectionStateLabel } from "../connectionState";

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
  return isPartialBreakToken(token) ? "partial-break-stimulus" : "";
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

const PRE_GAME_COUNTDOWN_MS = 3000;
const ICON_SHAKE_BEFORE_SWAP_MS = 220;
const ICON_SHAKE_AFTER_SWAP_MS = 90;

const PRELOAD_AUDIO_FILES = [
  voteReceiveSoundFile,
  transitionSoundFile,
  lastChanceSoundFile,
  correctAnswerSoundFile,
  gameOverSoundFile,
  countSoundFile,
  tickSoundFile
];

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


function createDistortionCurve(amount = 0) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const gain = Math.max(0, amount);

  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + gain) * x * 20 * (Math.PI / 180)) / (Math.PI + gain * Math.abs(x));
  }

  return curve;
}

function pickChaosAudioEffectKey(audioEffects = []) {
  if (!Array.isArray(audioEffects) || audioEffects.length === 0) return "clean";
  for (let i = audioEffects.length - 1; i >= 0; i -= 1) {
    if (typeof audioEffects[i] === "string" && audioEffects[i]) return audioEffects[i];
  }
  return "clean";
}

function attachChaosAudioEffect(context, source, effectKey) {
  const output = context.createGain();
  output.gain.value = 1;

  const chain = (...nodes) => {
    let current = source;
    nodes.forEach((node) => {
      current.connect(node);
      current = node;
    });
    current.connect(output);
  };

  if (effectKey === "first_light_scrape_layer") {
    const highpass = context.createBiquadFilter();
    const scrapeGain = context.createGain();
    highpass.type = "highpass";
    highpass.frequency.value = 1800;
    scrapeGain.gain.value = 0.18;
    chain(highpass, scrapeGain);
    return output;
  }

  if (effectKey === "extra_audio_layer") {
    const highpass = context.createBiquadFilter();
    const layerGain = context.createGain();
    highpass.type = "highpass";
    highpass.frequency.value = 2200;
    layerGain.gain.value = 0.12;
    chain(highpass, layerGain);
    return output;
  }

  if (effectKey === "audio_fray_or_strain") {
    const bandpass = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1700;
    bandpass.Q.value = 1.8;
    compressor.threshold.value = -20;
    compressor.ratio.value = 6;
    chain(bandpass, compressor);
    return output;
  }

  if (effectKey === "heavier_feedback_impact") {
    const bandpass = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1250;
    bandpass.Q.value = 3.2;
    compressor.threshold.value = -32;
    compressor.ratio.value = 15;
    chain(bandpass, compressor);
    return output;
  }

  if (effectKey === "audio_fray_or_scrape") {
    const bandpass = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1450;
    bandpass.Q.value = 2.5;
    compressor.threshold.value = -28;
    compressor.ratio.value = 12;
    chain(bandpass, compressor);
    return output;
  }

  if (effectKey === "light_audio_clipping") {
    const distortion = context.createWaveShaper();
    distortion.curve = createDistortionCurve(160);
    distortion.oversample = "2x";
    chain(distortion);
    return output;
  }

  if (effectKey === "slight_audio_distortion") {
    const distortion = context.createWaveShaper();
    distortion.curve = createDistortionCurve(260);
    distortion.oversample = "4x";
    chain(distortion);
    return output;
  }

  if (effectKey === "aggressive_audio_distortion") {
    const distortion = context.createWaveShaper();
    distortion.curve = createDistortionCurve(700);
    distortion.oversample = "4x";
    chain(distortion);
    return output;
  }

  if (effectKey === "more_intense_audio_layer") {
    const lowshelf = context.createBiquadFilter();
    lowshelf.type = "lowshelf";
    lowshelf.frequency.value = 210;
    lowshelf.gain.value = 7;
    chain(lowshelf);
    return output;
  }

  if (effectKey === "heavier_bass_pulse") {
    const lowshelf = context.createBiquadFilter();
    lowshelf.type = "lowshelf";
    lowshelf.frequency.value = 210;
    lowshelf.gain.value = 11;
    chain(lowshelf);
    return output;
  }

  if (effectKey === "light_tick_acceleration") {
    const lowshelf = context.createBiquadFilter();
    lowshelf.type = "lowshelf";
    lowshelf.frequency.value = 240;
    lowshelf.gain.value = 3;
    chain(lowshelf);
    return output;
  }

  if (effectKey === "subtle_bass_pulse") {
    const lowshelf = context.createBiquadFilter();
    lowshelf.type = "lowshelf";
    lowshelf.frequency.value = 190;
    lowshelf.gain.value = 5;
    chain(lowshelf);
    return output;
  }

  if (effectKey === "high_intensity_audio") {
    const distortion = context.createWaveShaper();
    const compressor = context.createDynamicsCompressor();
    distortion.curve = createDistortionCurve(780);
    distortion.oversample = "4x";
    compressor.threshold.value = -26;
    compressor.ratio.value = 12;
    chain(distortion, compressor);
    return output;
  }

  if (effectKey === "aggressive_feedback") {
    const distortion = context.createWaveShaper();
    const compressor = context.createDynamicsCompressor();
    distortion.curve = createDistortionCurve(900);
    distortion.oversample = "4x";
    compressor.threshold.value = -30;
    compressor.ratio.value = 14;
    chain(distortion, compressor);
    return output;
  }

  if (effectKey === "maximum_feedback_intensity") {
    const distortion = context.createWaveShaper();
    const compressor = context.createDynamicsCompressor();
    distortion.curve = createDistortionCurve(1000);
    distortion.oversample = "4x";
    compressor.threshold.value = -34;
    compressor.ratio.value = 18;
    chain(distortion, compressor);
    return output;
  }

  if (effectKey === "near_overload_audio") {
    const distortion = context.createWaveShaper();
    const compressor = context.createDynamicsCompressor();
    distortion.curve = createDistortionCurve(1100);
    distortion.oversample = "4x";
    compressor.threshold.value = -36;
    compressor.ratio.value = 20;
    chain(distortion, compressor);
    return output;
  }

  source.connect(output);
  return output;
}

function getTransitionBassBoost(corruptionEffects, isHeatSurgeEnabled) {
  if (isHeatSurgeEnabled) return 24;
  const level = Number(corruptionEffects?.intensityLevel) || 0;
  return Math.min(18, Math.max(0, level * 1.5));
}

function GlitchGamePage({ roomId, playerId, players, myGame, serverNow, onSubmitAnswer, onAssetsLoaded, onReturnRoom, onExit, connectionState = CONNECTION_STATES.CONNECTING, onUiButtonClick, isPreviewRoom = false, availableModes = [], selectedModeId = "standard" }) {
  const currentRound = myGame?.currentRound;
  const currentRoundCorruptionEffects = currentRound?.corruptionEffects ?? null;
  const currentRoundAudioEffects = currentRoundCorruptionEffects?.audioEffects ?? null;
  const currentRoundHeatSurgeActive = Boolean(currentRound?.heatSurgeActive);

  const selectedMode = useMemo(() => availableModes.find((mode) => mode.id === (myGame?.modeId || selectedModeId)) || null, [availableModes, myGame?.modeId, selectedModeId]);
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
  const saveItLabel = myGame?.lastRoundResult?.statusLabel || "";
  const isSaveItActive = saveItLabel === "SAVE IT!";
  const previousSaveItStateRef = useRef(false);
  const audioContextRef = useRef(null);
  const [displayedIconToken, setDisplayedIconToken] = useState(currentRound?.yourStimulus ?? null);
  const [isRoundTransitionShaking, setIsRoundTransitionShaking] = useState(false);
  const transitionTimeoutRef = useRef(null);
  const transitionStopTimeoutRef = useRef(null);
  const previousRoundIdRef = useRef(currentRound?.id ?? null);
  const hasNotifiedLoadedRef = useRef(false);
  const previousAnsweredPlayerIdsRef = useRef(new Set());
  const previousGameStatusRef = useRef(myGame?.status ?? null);
  const previousSaveItLabelRef = useRef(saveItLabel);
  const previousRoundPassedRef = useRef(myGame?.lastRoundResult?.passed ?? null);
  const voteReceiveAudioRef = useRef(preloadAudioElement(voteReceiveSoundFile));
  const transitionAudioRef = useRef(preloadAudioElement(transitionSoundFile));
  const lastChanceAudioRef = useRef(preloadAudioElement(lastChanceSoundFile));
  const correctAnswerAudioRef = useRef(preloadAudioElement(correctAnswerSoundFile));
  const gameOverAudioRef = useRef(preloadAudioElement(gameOverSoundFile));
  const countAudioRef = useRef(preloadAudioElement(countSoundFile));
  const tickAudioRef = useRef(preloadAudioElement(tickSoundFile));
  const previousPregameCountdownNumberRef = useRef(null);
  const audioBufferMapRef = useRef({});
  const activeSourceMapRef = useRef({});

  const playSound = (audioRef, audioBufferKey, options = {}) => {
    if (options.stopPrevious) {
      const previousSource = activeSourceMapRef.current[audioBufferKey];
      if (previousSource) {
        try {
          previousSource.stop();
        } catch {
          // Ignore stop failures for already-ended sources.
        }
        delete activeSourceMapRef.current[audioBufferKey];
      }
      if (audioRef?.current) {
        audioRef.current.pause();
      }
    }

    const context = audioContextRef.current;
    const audioBuffer = audioBufferMapRef.current[audioBufferKey];

    const fallbackToHtmlAudio = () => {
      if (audioRef?.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    };

    const startWebAudioPlayback = () => {
      if (!context || !audioBuffer || context.state !== "running") return false;
      try {
        const source = context.createBufferSource();
        source.buffer = audioBuffer;

        const bassBoostDb = Number(options.bassBoostDb) || 0;
        const selectedAudioEffect = pickChaosAudioEffectKey(options.audioEffects);
        if (bassBoostDb > 0) {
          const lowshelf = context.createBiquadFilter();
          lowshelf.type = "lowshelf";
          lowshelf.frequency.value = 170;
          lowshelf.gain.value = bassBoostDb;

          const limiter = context.createDynamicsCompressor();
          limiter.threshold.value = -4;
          limiter.knee.value = 0;
          limiter.ratio.value = 20;
          limiter.attack.value = 0.002;
          limiter.release.value = 0.08;

          source.connect(lowshelf);
          const processedOutput = attachChaosAudioEffect(context, lowshelf, selectedAudioEffect);
          lowshelf.disconnect();
          lowshelf.connect(limiter);
          limiter.connect(processedOutput);
          processedOutput.connect(context.destination);
        } else {
          const processedOutput = attachChaosAudioEffect(context, source, selectedAudioEffect);
          processedOutput.connect(context.destination);
        }

        source.onended = () => {
          if (activeSourceMapRef.current[audioBufferKey] === source) {
            delete activeSourceMapRef.current[audioBufferKey];
          }
        };
        source.start(0);
        if (options.stopPrevious) {
          activeSourceMapRef.current[audioBufferKey] = source;
        }
        return true;
      } catch {
        return false;
      }
    };

    if (startWebAudioPlayback()) return;

    if (context && audioBuffer && (context.state === "suspended" || context.state === "interrupted")) {
      context.resume()
        .then(() => {
          if (!startWebAudioPlayback()) {
            fallbackToHtmlAudio();
          }
        })
        .catch(() => {
          fallbackToHtmlAudio();
        });
      return;
    }

    fallbackToHtmlAudio();
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const unlockAudio = () => {
      const audioElements = [
        voteReceiveAudioRef.current,
        transitionAudioRef.current,
        lastChanceAudioRef.current,
        correctAnswerAudioRef.current,
        gameOverAudioRef.current,
        countAudioRef.current,
        tickAudioRef.current
      ].filter(Boolean);

      audioElements.forEach((audio) => {
        const previousTime = audio.currentTime;
        audio.muted = true;
        audio.currentTime = 0;
        audio.play()
          .then(() => {
            audio.pause();
            audio.currentTime = previousTime;
            audio.muted = false;
          })
          .catch(() => {
            audio.muted = false;
            audio.currentTime = previousTime;
          });
      });

      const context = audioContextRef.current;
      if (context && (context.state === "suspended" || context.state === "interrupted")) {
        context.resume().catch(() => {});
      }
    };

    const handlePageReactivation = () => {
      if (document.visibilityState === "visible") {
        unlockAudio();
      }
    };

    document.addEventListener("pointerdown", unlockAudio, { once: true });
    document.addEventListener("visibilitychange", handlePageReactivation);
    window.addEventListener("pageshow", handlePageReactivation);
    window.addEventListener("focus", handlePageReactivation);

    return () => {
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("visibilitychange", handlePageReactivation);
      window.removeEventListener("pageshow", handlePageReactivation);
      window.removeEventListener("focus", handlePageReactivation);
    };
  }, []);


  useEffect(() => {
    const roundId = currentRound?.id ?? null;
    const nextToken = currentRound?.yourStimulus ?? null;
    const previousRoundId = previousRoundIdRef.current;

    if (roundId === previousRoundId) return undefined;
    previousRoundIdRef.current = roundId;

    if (!previousRoundId && roundId) {
      transitionTimeoutRef.current = setTimeout(() => {
        setDisplayedIconToken(nextToken);
        if (transitionAudioRef.current) {
          playSound(transitionAudioRef, "transition", { bassBoostDb: getTransitionBassBoost(currentRoundCorruptionEffects, currentRoundHeatSurgeActive), audioEffects: currentRoundAudioEffects });
        }
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
      if (transitionAudioRef.current) {
        playSound(transitionAudioRef, "transition", { bassBoostDb: getTransitionBassBoost(currentRoundCorruptionEffects, currentRoundHeatSurgeActive), audioEffects: currentRoundAudioEffects });
      }
      transitionStopTimeoutRef.current = setTimeout(() => {
        setIsRoundTransitionShaking(false);
        transitionStopTimeoutRef.current = null;
      }, ICON_SHAKE_AFTER_SWAP_MS);
      transitionTimeoutRef.current = null;
    }, ICON_SHAKE_BEFORE_SWAP_MS);

    return undefined;
  }, [currentRound?.id, currentRound?.yourStimulus, currentRoundAudioEffects, currentRoundCorruptionEffects, currentRoundHeatSurgeActive]);

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
        preloadAudioFiles(PRELOAD_AUDIO_FILES),
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
    if (typeof window === "undefined") return undefined;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return undefined;

    let cancelled = false;

    const context = audioContextRef.current || new AudioContextCtor({ latencyHint: "interactive" });
    audioContextRef.current = context;

    const decodeAudioBuffers = async () => {
      const entries = [
        ["voteReceive", voteReceiveSoundFile],
        ["transition", transitionSoundFile],
        ["lastChance", lastChanceSoundFile],
        ["correctAnswer", correctAnswerSoundFile],
        ["gameOver", gameOverSoundFile],
        ["count", countSoundFile],
        ["tick", tickSoundFile]
      ];

      await Promise.all(entries.map(async ([key, src]) => {
        try {
          const response = await fetch(src);
          const fileBuffer = await response.arrayBuffer();
          const decodedBuffer = await context.decodeAudioData(fileBuffer);
          if (!cancelled) audioBufferMapRef.current[key] = decodedBuffer;
        } catch {
          // Ignore decode errors and fall back to HTMLAudioElement playback.
        }
      }));
    };

    decodeAudioBuffers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const previous = previousAnsweredPlayerIdsRef.current;
    const newlyAnsweredOthers = Array.from(answeredPlayerIds).some((id) => id !== playerId && !previous.has(id));
    if (newlyAnsweredOthers) {
      playSound(voteReceiveAudioRef, "voteReceive", { audioEffects: currentRoundAudioEffects });
    }
    previousAnsweredPlayerIdsRef.current = new Set(answeredPlayerIds);
  }, [answeredPlayerIds, playerId, currentRoundAudioEffects]);

  useEffect(() => {
    if (isSaveItActive && !previousSaveItStateRef.current && lastChanceAudioRef.current) {
      playSound(lastChanceAudioRef, "lastChance", { audioEffects: currentRoundAudioEffects });
    }

    previousSaveItStateRef.current = isSaveItActive;
  }, [isSaveItActive, currentRoundAudioEffects]);

  useEffect(() => {
    const previousRoundPassed = previousRoundPassedRef.current;
    const lastRoundPassed = myGame?.lastRoundResult?.passed ?? null;

    if ((previousRoundPassed !== true && lastRoundPassed === true) && correctAnswerAudioRef.current) {
      playSound(correctAnswerAudioRef, "correctAnswer", { audioEffects: currentRoundAudioEffects });
    }

    previousSaveItLabelRef.current = saveItLabel;
    previousRoundPassedRef.current = lastRoundPassed;
  }, [myGame?.lastRoundResult?.passed, saveItLabel, currentRoundAudioEffects]);

  useEffect(() => {
    const previousGameStatus = previousGameStatusRef.current;
    const nextGameStatus = myGame?.status ?? null;

    if (nextGameStatus === "gameover" && previousGameStatus !== "gameover" && gameOverAudioRef.current) {
      playSound(gameOverAudioRef, "gameOver", { audioEffects: currentRoundAudioEffects });
    }

    previousGameStatusRef.current = nextGameStatus;
  }, [myGame?.status, currentRoundAudioEffects]);

  useEffect(() => () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    const previousNumber = previousPregameCountdownNumberRef.current;
    if (preGameCountdownNumber !== null && preGameCountdownNumber !== previousNumber && countAudioRef.current) {
      playSound(countAudioRef, "count", { audioEffects: currentRoundAudioEffects });
    }
    previousPregameCountdownNumberRef.current = preGameCountdownNumber;
  }, [preGameCountdownNumber, currentRoundAudioEffects]);

  useEffect(() => {
    if (!currentRound || myGame?.status !== "active") return undefined;
    const isSaveItOrLastChanceActive = isSaveItActive || currentRound.isLastChanceReplay;

    const roundNumber = Number(currentRound.roundNumber) || 0;
    const goodRunRound = Math.max(1, Number(currentRound.goodRunRound) || 50);
    const progress = Math.max(0, Math.min(1, roundNumber / goodRunRound));
    const minIntervalMs = 450;
    const maxIntervalMs = 1000;
    const tickIntervalMs = isSaveItOrLastChanceActive
      ? minIntervalMs
      : Math.round(maxIntervalMs - ((maxIntervalMs - minIntervalMs) * progress));

    const timeoutMs = Math.max(0, (Number(currentRound.decisionDeadlineMs) || 0) - Date.now());
    if (timeoutMs <= 0) return undefined;

    const tickHandle = window.setInterval(() => {
      playSound(tickAudioRef, "tick", { stopPrevious: true, audioEffects: currentRoundAudioEffects });
    }, tickIntervalMs);

    const stopHandle = window.setTimeout(() => {
      window.clearInterval(tickHandle);
    }, timeoutMs);

    return () => {
      window.clearInterval(tickHandle);
      window.clearTimeout(stopHandle);
    };
  }, [currentRound, currentRoundAudioEffects, myGame?.status, isSaveItActive]);

  if (!myGame) {
    return (
      <section className="panel">
        <h1 className="panel-title">GLiTCH! · Room {roomId}</h1>
        <p className="panel-subtitle">Waiting for game state…</p>
      </section>
    );
  }

  if (isPregameCountdown) {
    return (
      <section className="pregame-blank-screen">
        <div className="pregame-countdown" aria-live="assertive">{preGameCountdownNumber}</div>
      </section>
    );
  }

  if (myGame.status === "loading") {
    const activePlayers = players.filter((player) => player.currentGameParticipant && !player.waitingForNextGame);
    const loadedCount = activePlayers.filter((player) => player.assetsLoaded).length;
    return (
      <section className="pregame-blank-screen">
        <div className="pregame-loading-text" aria-live="polite">Loading assets… {loadedCount}/{activePlayers.length}</div>
      </section>
    );
  }

  if (myGame.status === "gameover") {
    return (
      <section className="panel">
        <div className="kill-screen">
          <h2>Game Over</h2>
          {myGame.killScreen?.causeLabel === "preview ended" ? <p><strong>(preview ended)</strong></p> : null}
          <p><strong>Final combo:</strong> {myGame.killScreen?.combo ?? 0}x</p>
          <p><strong>Final score:</strong> {myGame.killScreen?.score ?? 0}</p>
          <p><strong>Correct room answer:</strong> {(myGame.killScreen?.correctAnswer || "-").toUpperCase()}</p>
          <p><strong>Cause:</strong> {myGame.killScreen?.causeLabel || "-"}</p>
          <p><strong>Decisive player(s):</strong> {(myGame.killScreen?.decisivePlayers || []).map((entry) => `${entry.name} (${entry.reason === "missed_input" ? "No response" : (entry.input || "-")})`).join(", ") || "-"}</p>
          <button className="btn btn-primary" onClick={() => { onUiButtonClick?.(); onReturnRoom(); }}>Back to Room</button>
        </div>
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
  const modeSubtitle = getModeSubtitle(selectedMode, myGame.modeId);
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
