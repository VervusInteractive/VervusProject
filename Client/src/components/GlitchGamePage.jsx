import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import glitchGameLogo from "../assets/images/GameLogos/GameLogos_Glitch.png";
import { getPlayerIcon } from "../playerIcons";

const BLITZ_BACKGROUND_FRAME_SOURCES = [
  new URL("../assets/images/GlitchBackgrounds/BlitzBackgroundFrames/Background_Blitz_Frame1.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/BlitzBackgroundFrames/Background_Blitz_Frame2.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/BlitzBackgroundFrames/Background_Blitz_Frame3.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/BlitzBackgroundFrames/Background_Blitz_Frame4.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/BlitzBackgroundFrames/Background_Blitz_Frame5.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/BlitzBackgroundFrames/Background_Blitz_Frame6.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/BlitzBackgroundFrames/Background_Blitz_Frame7.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/BlitzBackgroundFrames/Background_Blitz_Frame8.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/BlitzBackgroundFrames/Background_Blitz_Frame9.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/BlitzBackgroundFrames/Background_Blitz_Frame10.png", import.meta.url).href
];
const CHAOS_BACKGROUND_FRAME_GROUPS = Object.entries(
  import.meta.glob("../assets/images/GlitchBackgrounds/ChaosBackground/**/*.png", { eager: true, import: "default" })
).reduce((groups, [path, source]) => {
  const fileName = path.split("/").pop() || "";
  const intensityMatch = path.match(/intensity[_-]?(\d+)/i);
  if (!intensityMatch) return groups;

  const intensityLevel = Number(intensityMatch[1]);
  const frameMatch = path.match(/frame[_-]?(\d+)/i);
  const frameNumber = Number(frameMatch?.[1] || 1);

  if (!groups.has(intensityLevel)) groups.set(intensityLevel, []);
  groups.get(intensityLevel).push({ source, frameNumber, fileName });
  return groups;
}, new Map());
CHAOS_BACKGROUND_FRAME_GROUPS.forEach((frames, intensityLevel) => {
  frames.sort((left, right) => left.frameNumber - right.frameNumber || left.fileName.localeCompare(right.fileName));
  CHAOS_BACKGROUND_FRAME_GROUPS.set(intensityLevel, frames.map((frame) => frame.source));
});
const HEAT_SURGE_ICON_SOURCE = new URL("../assets/images/GameIcons/GameIcons_HeatSurge.png", import.meta.url).href;
const TIMER_MASK_GLITCH_SOURCE = new URL("../assets/images/GameTimerEffectImages/Mask_Glitch.png", import.meta.url).href;
const TIMER_MASK_NOISE_SOURCE = new URL("../assets/images/GameTimerEffectImages/Mask_Noise.png", import.meta.url).href;
const TIMER_MASK_NOISE_SOFT_SOURCE = new URL("../assets/images/GameTimerEffectImages/Mask_Noise2.png", import.meta.url).href;
const BUTTON_CORRUPTION_OVERLAY_SOURCES = {
  1: new URL("../assets/images/GlitchChaos/Corruption_Buttons/Button_Corruption_Intesity1.png", import.meta.url).href,
  2: new URL("../assets/images/GlitchChaos/Corruption_Buttons/Button_Corruption_Intesity2.png", import.meta.url).href,
  3: new URL("../assets/images/GlitchChaos/Corruption_Buttons/Button_Corruption_Intesity3.png", import.meta.url).href,
  4: new URL("../assets/images/GlitchChaos/Corruption_Buttons/Button_Corruption_Intesity4.png", import.meta.url).href,
  5: new URL("../assets/images/GlitchChaos/Corruption_Buttons/Button_Corruption_Intesity5.png", import.meta.url).href,
  6: new URL("../assets/images/GlitchChaos/Corruption_Buttons/Button_Corruption_Intesity6.png", import.meta.url).href,
  7: new URL("../assets/images/GlitchChaos/Corruption_Buttons/Button_Corruption_Intesity7.png", import.meta.url).href,
  8: new URL("../assets/images/GlitchChaos/Corruption_Buttons/Button_Corruption_Intesity8.png", import.meta.url).href,
  9: new URL("../assets/images/GlitchChaos/Corruption_Buttons/Button_Corruption_Intesity9.png", import.meta.url).href
};
const BUTTON_CORRUPTION_INTENSITY9_EFFECT_SOURCE = new URL("../assets/images/GlitchChaos/Corruption_Buttons/Button_Corruption_Intesity9_Effect.png", import.meta.url).href;

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
const CHAOS_BACKGROUND_IMAGE_SOURCES = Array.from(CHAOS_BACKGROUND_FRAME_GROUPS.values()).flat();
const GLITCH_BACKGROUND_IMAGE_SOURCES = [
  ...BLITZ_BACKGROUND_FRAME_SOURCES,
  ...CHAOS_BACKGROUND_IMAGE_SOURCES,
  new URL("../assets/images/GlitchBackgrounds/subtle_noise_scanlines_white_transparent.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/horizontal_glitch_streaks_white_transparent.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/glitch_grunge_frame_white_transparent.png", import.meta.url).href,
  new URL("../assets/images/GlitchBackgrounds/energy_burst_glitch_white_transparent.png", import.meta.url).href
];
const BUTTON_CORRUPTION_IMAGE_SOURCES = [
  ...Object.values(BUTTON_CORRUPTION_OVERLAY_SOURCES),
  BUTTON_CORRUPTION_INTENSITY9_EFFECT_SOURCE
];
const GAME_IMAGE_SOURCES = Array.from(new Set([
  ...GAME_ICON_IMAGE_SOURCES,
  ...GLITCH_BACKGROUND_IMAGE_SOURCES,
  ...BUTTON_CORRUPTION_IMAGE_SOURCES,
  HEAT_SURGE_ICON_SOURCE
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

function getCounterClockwiseTimerArcPath(elapsedDegrees) {
  const safeDegrees = Math.min(359.99, Math.max(0, Number(elapsedDegrees) || 0));
  if (safeDegrees <= 0) return "";

  const center = 150;
  const radius = 138;
  const startAngle = -90;
  const endAngle = startAngle - safeDegrees;
  const toPoint = (angleDegrees) => {
    const radians = (angleDegrees * Math.PI) / 180;
    return {
      x: center + (radius * Math.cos(radians)),
      y: center + (radius * Math.sin(radians))
    };
  };
  const start = toPoint(startAngle);
  const end = toPoint(endAngle);
  const largeArcFlag = safeDegrees > 180 ? 1 : 0;

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

function getModeSubtitle(mode, modeId, t) {
  const title = mode?.title || modeId || "standard";
  const cleanedTitle = title.replace(/^GLiTCH!\s*/i, "").trim();
  if (cleanedTitle) return cleanedTitle;
  return modeId === "standard" ? t("glitchGame.mode.standard") : String(modeId || "standard");
}

const ANSWER_DISPLAY = {
  sync: { key: "glitchGame.answers.sync", className: "sync" },
  glitch: { key: "glitchGame.answers.glitch", className: "glitch" }
};

const STIMULUS_LABELS = {
  eye: "glitchGame.stimuli.eye",
  bolt: "glitchGame.stimuli.bolt",
  skull: "glitchGame.stimuli.skull",
  smiley: "glitchGame.stimuli.smiley",
  star: "glitchGame.stimuli.star"
};

function getAnswerDisplay(answer, t) {
  const config = ANSWER_DISPLAY[String(answer || "").toLowerCase()];
  if (!config) return { label: "-", className: "unknown" };
  return { label: t(config.key), className: config.className };
}

function getStimulusBaseToken(token) {
  return String(token || "")
    .replace(/_(readable|doubt)_twin$/i, "")
    .replace(/_partial_break$/i, "");
}

function getStimulusLabel(token, t) {
  const baseToken = getStimulusBaseToken(token);
  return STIMULUS_LABELS[baseToken]
    ? t(STIMULUS_LABELS[baseToken])
    : (baseToken ? baseToken.replace(/_/g, " ") : t("glitchGame.stimuli.screen"));
}

function formatKillCause(causeLabel, t) {
  const normalized = String(causeLabel || "").trim();
  if (!normalized) return t("glitchGame.killScreen.runEnded");
  if (normalized.toLowerCase() === "preview ended") return t("glitchGame.killScreen.previewEnded");
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

function getChaosBackgroundSource(modeId, corruptionEffects) {
  if (String(modeId || "").toLowerCase() !== "chaos") return null;

  const requestedIntensity = Math.max(0, Number(corruptionEffects?.intensityLevel) || 0);
  if (requestedIntensity <= 0) return null;

  const availableIntensities = Array.from(CHAOS_BACKGROUND_FRAME_GROUPS.keys()).sort((left, right) => left - right);
  if (!availableIntensities.length) return null;

  const matchedIntensity = availableIntensities
    .filter((intensityLevel) => intensityLevel <= requestedIntensity)
    .at(-1) ?? availableIntensities[0];

  return CHAOS_BACKGROUND_FRAME_GROUPS.get(matchedIntensity)?.[0] || null;
}

function getButtonCorruptionOverlaySource(intensityLevel) {
  const normalizedIntensity = Math.max(0, Math.min(9, Number(intensityLevel) || 0));
  return BUTTON_CORRUPTION_OVERLAY_SOURCES[normalizedIntensity] || null;
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

function GlitchLogo({ className = "", alt = "GLiTCH!" }) {
  return <img className={["glitch-logo-image", className].filter(Boolean).join(" ")} src={glitchGameLogo} alt={alt} />;
}

function GlitchAnswerButton({ variant, label, isCorrupted, corruptionIntensityLevel, disabled, onClick }) {
  const className = [
    "glitch-answer-button",
    variant,
    isCorrupted ? "corrupted" : "",
    corruptionIntensityLevel >= 9 ? "intensity-nine-plus" : ""
  ].filter(Boolean).join(" ");
  const overlaySource = getButtonCorruptionOverlaySource(corruptionIntensityLevel);
  const buttonStyle = overlaySource
    ? { "--button-corruption-overlay": `url(${overlaySource})` }
    : undefined;

  return (
    <button className={className} style={buttonStyle} disabled={disabled} onClick={onClick}>
      {corruptionIntensityLevel >= 9 ? <span className="glitch-answer-button-intensity-effect" aria-hidden="true" /> : null}
      <span className="glitch-answer-button-glass" aria-hidden="true" />
      {overlaySource ? <span className="glitch-answer-button-overlay" aria-hidden="true" /> : null}
      <span className="glitch-answer-button-label">{label}</span>
    </button>
  );
}


function GlitchGamePage({ roomId, playerId, players, myGame, serverNow, onSubmitAnswer, onAssetsLoaded, onReturnRoom, onExit, connectionState = CONNECTION_STATES.CONNECTING, onUiButtonClick, isPreviewRoom = false, availableModes = [], selectedModeId = "standard" }) {
  const timerEffectIdBase = useId().replace(/:/g, "");
  const { t } = useTranslation();
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
  const chaosBackgroundSource = useMemo(
    () => getChaosBackgroundSource(activeModeId, currentRoundCorruptionEffects),
    [activeModeId, currentRoundCorruptionEffects]
  );
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
      <strong>{t("glitchGame.connection.label")}</strong> {getConnectionStateLabel(connectionState)}
      {connectionState === CONNECTION_STATES.RECONNECTING ? " — trying to restore your room session…" : null}
      {connectionState === CONNECTION_STATES.DEGRADED ? " — high latency detected; effects may feel lighter." : null}
      {connectionState === CONNECTION_STATES.DISCONNECTED ? " — connection lost. Keep this tab open while we retry." : null}
    </div>
  );
  const answered = false;
  const localizedConnectionBanner = (
    <div className={`connection-banner ${connectionState}`} role="status" aria-live="polite">
      <strong>{t("glitchGame.connection.label")}</strong> {getConnectionStateLabel(connectionState)}
      {connectionState === CONNECTION_STATES.RECONNECTING ? ` ${t("glitchGame.connection.reconnectingNote")}` : null}
      {connectionState === CONNECTION_STATES.DEGRADED ? ` ${t("glitchGame.connection.degradedNote")}` : null}
      {connectionState === CONNECTION_STATES.DISCONNECTED ? ` ${t("glitchGame.connection.disconnectedNote")}` : null}
    </div>
  );

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
  const modeSubtitle = getModeSubtitle(selectedMode, myGame?.modeId || activeModeId, t);
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
        <h1 className="glitch-logo-heading">
          <GlitchLogo />
        </h1>
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
  const [isHeatSurgeIntroActive, setIsHeatSurgeIntroActive] = useState(false);
  const transitionTimeoutRef = useRef(null);
  const transitionStopTimeoutRef = useRef(null);
  const previousRoundIdRef = useRef(currentRound?.id ?? null);
  const hasNotifiedLoadedRef = useRef(false);
  const previousGameStatusRef = useRef(myGame?.status ?? null);
  const previousRoundPassedRef = useRef(myGame?.lastRoundResult?.passed ?? null);
  const previousHeatSurgeActiveRef = useRef(currentRoundHeatSurgeActive);
  const heatSurgeReturnTimeoutRef = useRef(null);
  const heatSurgeIntroTimeoutRef = useRef(null);
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
    if (heatSurgeIntroTimeoutRef.current) {
      clearTimeout(heatSurgeIntroTimeoutRef.current);
      heatSurgeIntroTimeoutRef.current = null;
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
    if (heatSurgeIntroTimeoutRef.current) {
      window.clearTimeout(heatSurgeIntroTimeoutRef.current);
      heatSurgeIntroTimeoutRef.current = null;
    }

    const heatSurgeParams = getHeatSurgeTensionParams(tensionBaseParams);
    setIsHeatSurgeIntroActive(true);
    stopAllActiveAudio();
    playSound("heatSurgeWarning");
    startTensionLoop({
      ...heatSurgeParams,
      distortionIntensityLevel: tensionDistortionLevel
    });
    heatSurgeIntroTimeoutRef.current = window.setTimeout(() => {
      setIsHeatSurgeIntroActive(false);
      heatSurgeIntroTimeoutRef.current = null;
    }, 500);

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
      if (heatSurgeIntroTimeoutRef.current) {
        window.clearTimeout(heatSurgeIntroTimeoutRef.current);
        heatSurgeIntroTimeoutRef.current = null;
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
        <h1 className="panel-title panel-title-logo">
          <GlitchLogo />
        </h1>
        <p className="panel-meta">{t("glitchGame.roomLabel", { roomId })}</p>
        <p className="panel-subtitle">{t("glitchGame.waitingForGameState")}</p>
      </section>
    );
  }

  if (isPregameCountdown) {
    return renderPregameScreen("countdown-state", (
      <>
        <div className="pregame-countdown" aria-live="assertive">
          <span>{preGameCountdownNumber}</span>
        </div>
        <p className="pregame-status-label">{t("glitchGame.getReady")}</p>
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
        <p className="pregame-status-label">{t("glitchGame.loadingAssets")}</p>
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
    const causeLabel = formatKillCause(killScreen.causeLabel, t);
    const decisivePlayers = killScreen.decisivePlayers || [];
    const decisiveNames = formatKillPlayerNames(decisivePlayers);
    const decisiveSummary = decisivePlayers.length
      ? decisivePlayers.map((entry) => {
        if (entry.reason === "missed_input") return t("glitchGame.killScreen.missedInput", { name: entry.name });
        return t("glitchGame.killScreen.tappedAnswer", { name: entry.name, answer: getAnswerDisplay(entry.input, t).label });
      }).join(", ")
      : (killScreen.causeLabel === "preview ended" ? t("glitchGame.killScreen.previewLimitReached") : t("glitchGame.killScreen.noDecisivePlayer"));
    const correctAnswer = getAnswerDisplay(killScreen.correctAnswer || realityCheck.expectedAnswer, t);
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

        <div className="kill-screen-brand" aria-label={t("app.name")}>
          <img src={clearBackgroundLogo} alt={t("app.name")} />
        </div>

        <header className="kill-screen-hero">
          <h1 className="glitch-logo-heading">
            <GlitchLogo />
          </h1>
          <strong>{finalCombo}</strong>
          <span>{t("glitchGame.comboLabel")}</span>
        </header>

        <main className="kill-screen-content">
          <section className="kill-card kill-culprit-card">
            <div className="kill-card-header">
              <span>{t("glitchGame.killScreen.whoBrokeRun")}</span>
              <strong>{correctAnswer.label}</strong>
            </div>
            <div className="kill-culprit-row">
              <span className={`kill-answer-orb ${correctAnswer.className}`} aria-hidden="true">{correctAnswer.className === "sync" ? "S" : "G"}</span>
              <div>
                <strong>{decisiveNames}</strong>
                <span>{decisiveSummary}</span>
              </div>
            </div>
            <p>{causeLabel}.</p>
          </section>

          <section className="kill-card kill-reality-card">
            <div className="kill-card-header">
              <span>{t("glitchGame.killScreen.realityCheck")}</span>
            </div>
            <div className="kill-reality-row">
              <div>
                <strong>{t("glitchGame.killScreen.standardStimulus", { stimulus: getStimulusLabel(standardStimulus, t) })}</strong>
                <span>{formatKillPlayerNames(standardPlayers)}</span>
              </div>
              <span className="kill-symbol-disc" aria-label={standardIcon?.label || t("glitchGame.killScreen.standardScreen")}>
                {renderKillSymbol(standardStimulus, "S")}
              </span>
            </div>
            <div className="kill-reality-row altered">
              <div>
                <strong>{alteredStimulus ? t("glitchGame.killScreen.alteredStimulus", { stimulus: getStimulusLabel(alteredStimulus, t) }) : t("glitchGame.killScreen.alteredScreen")}</strong>
                <span>{formatKillPlayerNames(alteredPlayers)}</span>
              </div>
              <span className="kill-symbol-disc" aria-label={alteredIcon?.label || t("glitchGame.killScreen.alteredScreen")}>
                {renderKillSymbol(alteredStimulus, "G")}
              </span>
            </div>
          </section>

          <section className="kill-card kill-experience-card">
            <div className="kill-card-header">
              <span>{t("glitchGame.killScreen.experience")}</span>
            </div>
            <div className="kill-mode-row">
              <div>
                <strong>{t("glitchGame.answers.glitch")}</strong>
                <span>{getModeSubtitle(selectedMode, myGame.modeId || selectedModeId, t)}</span>
              </div>
              <span>{t("glitchGame.killScreen.points", { score: finalScore })}</span>
            </div>
          </section>

          <section className="kill-card kill-players-card">
            <div className="kill-card-header">
              <span>{t("glitchGame.killScreen.players")}</span>
            </div>
            <ul className="kill-player-list">
              {players.filter((player) => !player.waitingForNextGame).map((player) => {
                const decisiveEntry = decisivePlayers.find((entry) => entry.playerId === player.playerId);
                const realityEntry = getKillScreenPlayerEntry(realityCheck, player.playerId);
                const answerDisplay = getAnswerDisplay(decisiveEntry?.input || realityEntry?.input, t);
                const hasMissedInput = decisiveEntry?.reason === "missed_input";
                const statusClassName = hasMissedInput ? "missed" : answerDisplay.className;
                const statusLabel = hasMissedInput ? t("glitchGame.killScreen.noResponse") : answerDisplay.label;
                return (
                  <li key={player.playerId} className="kill-player-row">
                    <span className="kill-player-avatar" style={{ "--player-color": player.color || "#8d5cff" }} aria-hidden="true">
                      <img src={getPlayerIcon(player.color)} alt="" />
                    </span>
                    <strong>{player.playerId === playerId ? t("glitchGame.killScreen.you") : player.name}</strong>
                    <div>
                      <span className={`kill-mini-pill ${statusClassName}`}>{statusLabel}</span>
                      <span className={`kill-mini-pill ${player.ready ? "ready" : "waiting"}`}>{player.ready ? t("glitchGame.killScreen.ready") : t("glitchGame.killScreen.waiting")}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>

        <footer className="kill-screen-actions">
          <button type="button" className="kill-return-button" onClick={() => { onUiButtonClick?.(); onReturnRoom(); }}>{t("glitchGame.returnToRoom")}</button>
        </footer>
      </section>
    );
  }

  if (myGame.status === "paused") {
    return (
      <section className="panel">
        <div className="kill-screen">
          <h2>{t("glitchGame.paused.title")}</h2>
          <p>{t("glitchGame.paused.description")}</p>
          {localizedConnectionBanner}
          <button className="btn btn-secondary" onClick={() => { onUiButtonClick?.(); onExit(); }}>{t("glitchGame.paused.exitRoom")}</button>
        </div>
      </section>
    );
  }

  const iconToken = displayedIconToken;
  const stimulusIcon = iconToken ? GAME_ICON_IMAGES[iconToken] : null;
  const stimulusClassName = getStimulusClassName(iconToken);
  const isHeatSurgeEnabled = Boolean(currentRound?.heatSurgeActive);
  const corruptionEffects = currentRound?.corruptionEffects;
  const corruptionIntensityLevel = Number(corruptionEffects?.intensityLevel) || 0;
  const hasCorruptionComboFont = corruptionIntensityLevel > 0;
  const corruptionClasses = getCorruptionVisualClasses(corruptionEffects).join(" ");
  const roundTimerMs = Number(currentRound?.timerMs) || 0;
  const safeTimeRemainingMs = typeof timeRemainingMs === "number" ? Math.max(0, timeRemainingMs) : 0;
  const boundedTimeRemainingMs = roundTimerMs > 0 ? Math.min(roundTimerMs, safeTimeRemainingMs) : safeTimeRemainingMs;
  const timerProgress = roundTimerMs > 0 ? clamp01(boundedTimeRemainingMs / roundTimerMs) : 0;
  const displayTimeMs = isSaveItActive ? Math.min(3000, roundTimerMs || 3000) : boundedTimeRemainingMs;
  const isLowTimeTheme = Boolean(!isSaveItActive && roundTimerMs > 0 && timerProgress <= 0.1);
  const isLastChanceTheme = Boolean(currentRound?.isLastChanceReplay || isSaveItActive);
  const isTimerShaderActive = isLastChanceTheme;
  const isDangerTheme = Boolean(isLastChanceTheme || isHeatSurgeEnabled || isLowTimeTheme);
  const showHeatSurgeIntro = Boolean(isBlitzMode && isHeatSurgeIntroActive && !isSaveItActive && myGame.status === "active");
  const comboIntensity = clamp01((Number(myGame.combo) || 0) / 40);
  const backgroundIntensity = isDangerTheme ? 1 : comboIntensity;
  const backgroundMotionDurationMs = Math.round(1700 - (backgroundIntensity * 1120));
  const backgroundShiftX = Math.round(1 + (backgroundIntensity * 5));
  const backgroundShiftY = Math.round(1 + (backgroundIntensity * 4));
  const gameScreenStyle = {
    "--glitch-bg-base-image": chaosBackgroundSource ? `url(${chaosBackgroundSource})` : "none",
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
    isLowTimeTheme ? "low-time-state" : "",
    currentRound?.isLastChanceReplay ? "last-chance-state" : "",
    isHeatSurgeEnabled && !showHeatSurgeIntro ? "heat-surge-state" : "",
    showHeatSurgeIntro ? "heat-surge-intro-state" : ""
  ].filter(Boolean).join(" ");
  const timerElapsedDegrees = Math.round((1 - timerProgress) * 360);
  const timerArcPath = getCounterClockwiseTimerArcPath(timerElapsedDegrees);
  const timerArcMaskId = `${timerEffectIdBase}-timer-arc-mask`;
  const timerArcHaloMaskId = `${timerEffectIdBase}-timer-arc-halo-mask`;
  const timerNoisePatternId = `${timerEffectIdBase}-timer-noise-pattern`;
  const timerNoiseSoftPatternId = `${timerEffectIdBase}-timer-noise-soft-pattern`;
  const timerGlitchPatternId = `${timerEffectIdBase}-timer-glitch-pattern`;
  const timerGlitchTextureMaskId = `${timerEffectIdBase}-timer-glitch-texture-mask`;
  const timerGlitchTextureMaskAltId = `${timerEffectIdBase}-timer-glitch-texture-mask-alt`;
  const timerGlitchHaloTextureMaskId = `${timerEffectIdBase}-timer-glitch-halo-texture-mask`;
  const timerGlowFilterId = `${timerEffectIdBase}-timer-glow-filter`;
  const timerCoreGradientId = `${timerEffectIdBase}-timer-core-gradient`;
  const timerRingStyle = {
    "--timer-progress": `${timerElapsedDegrees}deg`,
    "--timer-marker-angle": `${-timerElapsedDegrees - 90}deg`
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

  if (showHeatSurgeIntro) {
    return (
      <section className={gameScreenClassName} style={gameScreenStyle}>
        <span className="glitch-background-layers" aria-hidden="true" />

        {connectionState !== CONNECTION_STATES.CONNECTED ? (
          <div className="glitch-connection-slot">{localizedConnectionBanner}</div>
        ) : null}

        <header className="glitch-game-heading">
          <h1 className="glitch-logo-heading">
            <GlitchLogo />
          </h1>
          <p>{modeSubtitle}</p>
          {isPreviewRoom ? <span>{t("glitchGame.previewEndsAt", { combo: myGame.previewComboLimit ?? "X" })}</span> : null}
        </header>

        <main className="heat-surge-warning-stage" role="status" aria-live="assertive">
          <img className="heat-surge-warning-icon" src={HEAT_SURGE_ICON_SOURCE} alt={t("glitchGame.heatSurge")} />
        </main>

        <footer className="glitch-game-footer">
          <div className="glitch-time-pill">{formatDigitalTime(displayTimeMs)}</div>
        </footer>
      </section>
    );
  }

  return (
    <section className={gameScreenClassName} style={gameScreenStyle}>
      <span className="glitch-background-layers" aria-hidden="true" />

      {isWrongOrientation ? (
        <div className="orientation-warning-overlay" role="alert">
          <div className="orientation-warning-card">
            {t("glitchGame.orientationWarning")} <strong>{selectedModeOrientationLock}</strong>.
          </div>
        </div>
      ) : null}

      {connectionState !== CONNECTION_STATES.CONNECTED ? (
        <div className="glitch-connection-slot">{localizedConnectionBanner}</div>
      ) : null}

      <header className="glitch-game-heading">
        <h1 className="glitch-logo-heading">
          <GlitchLogo />
        </h1>
        <p>{isLastChanceTheme ? t("glitchGame.lastChance") : modeSubtitle}</p>
        {isPreviewRoom ? <span>{t("glitchGame.previewEndsAt", { combo: myGame.previewComboLimit ?? "X" })}</span> : null}
      </header>

      {isSaveItActive ? (
        <div className="save-it-splash" role="status" aria-live="assertive">
          <span>{t("glitchGame.saveIt")}</span>
        </div>
      ) : (
        <>
          <div className="glitch-combo-stack" aria-label={t("glitchGame.comboAriaLabel", { combo: myGame.combo })}>
            <strong className={hasCorruptionComboFont ? "glitch-combo-value corrupted" : "glitch-combo-value"}>{myGame.combo}</strong>
            <span>{t("glitchGame.comboLabel")}</span>
          </div>

          <div className="glitch-timer-stage" aria-label={t("glitchGame.timeLeftAriaLabel", { time: formatTimeLeft(boundedTimeRemainingMs) })}>
            <div className={["glitch-timer-ring", corruptionClasses].filter(Boolean).join(" ")} style={timerRingStyle}>
              <svg className="glitch-timer-arc" viewBox="0 0 300 300" aria-hidden="true">
                <defs>
                  {isTimerShaderActive ? (
                    <>
                      <linearGradient id={timerCoreGradientId} x1="24" y1="30" x2="276" y2="270" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#fff6d5" />
                        <stop offset="16%" stopColor="#ffb07d" />
                        <stop offset="42%" stopColor="#ff6038" />
                        <stop offset="72%" stopColor="#ff2a2a" />
                        <stop offset="100%" stopColor="#ff7e59" />
                      </linearGradient>
                      <filter id={timerGlowFilterId} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                        <feColorMatrix
                          in="blur"
                          type="matrix"
                          values="1 0 0 0 0
                                  0 0.42 0 0 0
                                  0 0 0.3 0 0
                                  0 0 0 1.18 0"
                          result="glow"
                        />
                        <feMerge>
                          <feMergeNode in="glow" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <pattern id={timerNoisePatternId} patternUnits="userSpaceOnUse" width="300" height="300">
                        <image href={TIMER_MASK_NOISE_SOURCE} width="300" height="300" preserveAspectRatio="xMidYMid slice" />
                      </pattern>
                      <pattern id={timerNoiseSoftPatternId} patternUnits="userSpaceOnUse" width="300" height="300">
                        <image href={TIMER_MASK_NOISE_SOFT_SOURCE} width="300" height="300" preserveAspectRatio="xMidYMid slice" />
                      </pattern>
                      <pattern id={timerGlitchPatternId} patternUnits="userSpaceOnUse" width="300" height="300">
                        <image href={TIMER_MASK_GLITCH_SOURCE} width="300" height="300" preserveAspectRatio="xMidYMid slice" />
                      </pattern>
                      <mask id={timerGlitchTextureMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
                        <rect className="glitch-timer-texture-mask" x="-64" y="0" width="428" height="300" fill={`url(#${timerGlitchPatternId})`} />
                      </mask>
                      <mask id={timerGlitchTextureMaskAltId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
                        <rect className="glitch-timer-texture-mask alt" x="-44" y="-36" width="388" height="372" fill={`url(#${timerGlitchPatternId})`} />
                      </mask>
                      <mask id={timerGlitchHaloTextureMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
                        <rect className="glitch-timer-texture-mask halo" x="-82" y="-32" width="464" height="364" fill={`url(#${timerGlitchPatternId})`} />
                      </mask>
                      <mask id={timerArcMaskId} maskUnits="userSpaceOnUse">
                        <rect width="300" height="300" fill="black" />
                        {timerArcPath ? (
                          <path d={timerArcPath} fill="none" stroke="white" strokeWidth="32" strokeLinecap="round" />
                        ) : null}
                      </mask>
                      <mask id={timerArcHaloMaskId} maskUnits="userSpaceOnUse">
                        <rect width="300" height="300" fill="black" />
                        {timerArcPath ? (
                          <path d={timerArcPath} fill="none" stroke="white" strokeWidth="52" strokeLinecap="round" />
                        ) : null}
                      </mask>
                    </>
                  ) : null}
                </defs>
                <circle className="glitch-timer-arc-track" cx="150" cy="150" r="138" />
                {timerArcPath ? (
                  isTimerShaderActive ? (
                    <>
                      <path className="glitch-timer-arc-fill glow" d={timerArcPath} filter={`url(#${timerGlowFilterId})`} />
                      <path className="glitch-timer-arc-fill core" d={timerArcPath} stroke={`url(#${timerCoreGradientId})`} />
                      <path className="glitch-timer-arc-fill hot" d={timerArcPath} />
                      <g className="glitch-timer-shader-stack halo" mask={`url(#${timerArcHaloMaskId})`}>
                        <rect className="glitch-timer-shader-layer glitch halo" x="-82" y="-32" width="464" height="364" fill="#a45cff" mask={`url(#${timerGlitchHaloTextureMaskId})`} />
                      </g>
                      <g className="glitch-timer-shader-stack" mask={`url(#${timerArcMaskId})`}>
                        <rect className="glitch-timer-shader-layer noise" x="-36" y="-28" width="372" height="356" fill={`url(#${timerNoisePatternId})`} />
                        <rect className="glitch-timer-shader-layer noise-soft" x="-30" y="-24" width="360" height="348" fill={`url(#${timerNoiseSoftPatternId})`} />
                        <rect className="glitch-timer-shader-layer glitch" x="-64" y="0" width="428" height="300" fill="#c05cff" mask={`url(#${timerGlitchTextureMaskId})`} />
                        <rect className="glitch-timer-shader-layer glitch alt" x="-44" y="-36" width="388" height="372" fill="#ff426f" mask={`url(#${timerGlitchTextureMaskAltId})`} />
                      </g>
                    </>
                  ) : (
                    <path className="glitch-timer-arc-fill default" d={timerArcPath} />
                  )
                ) : null}
              </svg>
              <div className="glitch-timer-marker"><span /></div>
              <div className="glitch-symbol-disc">
                <div className={`glitch-icon ${stimulusClassName} ${isRoundTransitionShaking ? "round-transition-shake" : ""}`} role="img" aria-label={stimulusIcon?.label || t("glitchGame.currentSymbol")}>
                  {stimulusIcon ? (
                    <span className="glitch-icon-mask" style={stimulusIconStyle} aria-hidden="true" />
                  ) : (
                    <span className="glitch-icon-fallback" aria-hidden="true">?</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isHeatSurgeEnabled ? <p className="glitch-state-callout" role="status" aria-live="assertive">{t("glitchGame.heatSurgeActive")}</p> : null}
          {corruptionEffects ? (
            <p className="glitch-state-meta">{t("glitchGame.corruptionLevel", { level: corruptionEffects.intensityLevel })}</p>
          ) : null}

          <div className="glitch-vote-strip" aria-label={t("glitchGame.playersWhoVoted")}>
            {players.filter((player) => !player.waitingForNextGame).map((player) => {
              const hasVoted = answeredPlayerIds.has(player.playerId);
              return (
                <span
                  key={player.playerId}
                  className={`vote-indicator ${hasVoted ? "voted" : "pending"}`}
                  style={{ backgroundColor: player.color || "#64748b", color: player.color || "#64748b" }}
                  title={hasVoted ? t("glitchGame.playerHasVoted", { name: player.name }) : t("glitchGame.playerHasNotVoted", { name: player.name })}
                >
                  <img src={getPlayerIcon(player.color)} alt="" aria-hidden="true" />
                </span>
              );
            })}
          </div>
        </>
      )}

      <footer className="glitch-game-footer">
        <div className="glitch-time-pill">{formatDigitalTime(displayTimeMs)}</div>
        {!isSaveItActive ? (
          <div className="glitch-answer-row">
            <GlitchAnswerButton
              variant="sync"
              label={t("glitchGame.answers.sync")}
              isCorrupted={hasCorruptionComboFont}
              corruptionIntensityLevel={corruptionIntensityLevel}
              disabled={!canSubmitAnswer}
              onClick={() => onSubmitAnswer("sync")}
            />
            <GlitchAnswerButton
              variant="glitch"
              label={t("glitchGame.answers.glitch")}
              isCorrupted={hasCorruptionComboFont}
              corruptionIntensityLevel={corruptionIntensityLevel}
              disabled={!canSubmitAnswer}
              onClick={() => onSubmitAnswer("glitch")}
            />
          </div>
        ) : null}
      </footer>
    </section>
  );
}

export default GlitchGamePage;
