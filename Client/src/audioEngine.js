const AUDIO_DEBUG_ENABLED = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("audioDebug") === "1";

export const AUDIO_SOURCES = {
  click: new URL("./assets/audio/Vervus/Sound_Click.wav", import.meta.url).href,
  selectionChanged: new URL("./assets/audio/Vervus/Sound_SelectionChanged.wav", import.meta.url).href,
  sheetOpen: new URL("./assets/audio/Vervus/Sound_SheetOpen.wav.wav", import.meta.url).href,
  alert: new URL("./assets/audio/Vervus/Sound_Alert.wav.wav", import.meta.url).href,
  playerJoined: new URL("./assets/audio/Vervus/Sound_PlayerJoined.wav", import.meta.url).href,
  playerLeft: new URL("./assets/audio/Vervus/Sound_PlayerLeft.wav", import.meta.url).href,
  playerReady: new URL("./assets/audio/Vervus/Sound_PlayerReady.wav", import.meta.url).href,
  gameTransition: new URL("./assets/audio/Vervus/Sound_GameTransition.wav", import.meta.url).href,
  purchaseSuccess: new URL("./assets/audio/Vervus/Sound_PurchaseSuccess.wav", import.meta.url).href,
  purchaseFailed: new URL("./assets/audio/Vervus/Sound_PurchaseFailed.wav", import.meta.url).href,
  previewEnded: new URL("./assets/audio/Vervus/Sound_PreviewEnded.wav", import.meta.url).href,
  tensionLoop: new URL("./assets/audio/GLiTCH!/Loop_TensionBase.wav", import.meta.url).href,
  correctAnswer: new URL("./assets/audio/GLiTCH!/Sound_CorrectAnswer.wav", import.meta.url).href,
  lastChanceFreeze: new URL("./assets/audio/GLiTCH!/Sound_SaveIt.wav", import.meta.url).href,
  heatSurgeWarning: new URL("./assets/audio/GLiTCH!/Sound_HeatSurgeWarning.wav", import.meta.url).href,
  failImpact: new URL("./assets/audio/GLiTCH!/Sound_FailImpact.wav", import.meta.url).href,
  killScreenSting: new URL("./assets/audio/GLiTCH!/Sound_KillScreenSting.wav", import.meta.url).href,
  resultsTick: new URL("./assets/audio/GLiTCH!/Sound_ResultsTick.wav", import.meta.url).href
};

export const GAME_AUDIO_KEYS = [
  "gameTransition",
  "previewEnded",
  "tensionLoop",
  "correctAnswer",
  "lastChanceFreeze",
  "heatSurgeWarning",
  "failImpact",
  "killScreenSting",
  "resultsTick"
];

export const PLATFORM_AUDIO_KEYS = [
  "click",
  "selectionChanged",
  "sheetOpen",
  "alert",
  "playerJoined",
  "playerLeft",
  "playerReady",
  "purchaseSuccess",
  "purchaseFailed"
];

let audioContext = null;
let unlockPromise = null;
let isUnlocked = false;
const bufferPromises = new Map();
const audioBuffers = new Map();
const htmlAudioElements = new Map();
const activeSources = new Set();
const activeHtmlFallbacks = new Set();
const debouncedPlayTimes = new Map();
let tensionLoop = null;

function logAudioDebug(event, details = {}) {
  if (!AUDIO_DEBUG_ENABLED) return;
  const payload = {
    ts: new Date().toISOString(),
    contextState: audioContext?.state ?? null,
    unlocked: isUnlocked,
    event,
    ...details
  };
  console.log("[audio-debug]", payload);
  window.__audioDebugEvents = window.__audioDebugEvents || [];
  window.__audioDebugEvents.push(payload);
  if (window.__audioDebugEvents.length > 300) window.__audioDebugEvents.shift();
}

export function getAudioContext() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContext) {
    audioContext = new AudioContextCtor({ latencyHint: "interactive" });
  }
  return audioContext;
}

function getAudioElement(soundKey) {
  if (htmlAudioElements.has(soundKey)) return htmlAudioElements.get(soundKey);
  const src = AUDIO_SOURCES[soundKey];
  if (!src || typeof Audio === "undefined") return null;

  const audio = new Audio(src);
  audio.preload = "auto";
  audio.playsInline = true;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");
  audio.load();
  htmlAudioElements.set(soundKey, audio);
  return audio;
}

function preloadHtmlAudio(soundKey) {
  return new Promise((resolve) => {
    const audio = getAudioElement(soundKey);
    if (!audio) {
      resolve();
      return;
    }

    if (audio.readyState >= 3) {
      resolve();
      return;
    }

    const finish = () => resolve();
    audio.addEventListener("canplay", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
  });
}

export function decodeAudioBuffer(soundKey) {
  if (audioBuffers.has(soundKey)) return Promise.resolve(audioBuffers.get(soundKey));
  if (bufferPromises.has(soundKey)) return bufferPromises.get(soundKey);

  const promise = (async () => {
    const context = getAudioContext();
    const src = AUDIO_SOURCES[soundKey];
    if (!context || !src) return null;

    try {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
      audioBuffers.set(soundKey, buffer);
      logAudioDebug("buffer:decode:success", { soundKey, durationSec: Number(buffer.duration.toFixed(3)) });
      return buffer;
    } catch (error) {
      logAudioDebug("buffer:decode:failed", {
        soundKey,
        errorName: error?.name || null,
        errorMessage: error?.message || null
      });
      return null;
    }
  })();

  bufferPromises.set(soundKey, promise);
  return promise;
}

export function preloadAudioAssets(soundKeys = Object.keys(AUDIO_SOURCES)) {
  const uniqueKeys = Array.from(new Set(soundKeys.filter((key) => Boolean(AUDIO_SOURCES[key]))));
  return Promise.all([
    ...uniqueKeys.map(preloadHtmlAudio),
    ...uniqueKeys.map(decodeAudioBuffer)
  ]);
}

export function unlockAudioEngine() {
  if (isUnlocked) return Promise.resolve(true);
  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    const context = getAudioContext();
    if (!context) return false;

    try {
      if (context.state !== "running") {
        await context.resume();
      }
      await preloadAudioAssets();
      isUnlocked = context.state === "running";
      logAudioDebug("unlock:complete", { didUnlock: isUnlocked });
      return isUnlocked;
    } catch (error) {
      isUnlocked = false;
      logAudioDebug("unlock:failed", {
        errorName: error?.name || null,
        errorMessage: error?.message || null
      });
      return false;
    } finally {
      unlockPromise = null;
    }
  })();

  return unlockPromise;
}

export function resumeAudioEngine() {
  const context = getAudioContext();
  if (!context || context.state === "running") return Promise.resolve(Boolean(context));
  return context.resume()
    .then(() => {
      isUnlocked = context.state === "running";
      logAudioDebug("resume:complete", { didResume: isUnlocked });
      return isUnlocked;
    })
    .catch((error) => {
      logAudioDebug("resume:failed", {
        errorName: error?.name || null,
        errorMessage: error?.message || null
      });
      return false;
    });
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

function getDistortionAmount(intensityLevel = 0) {
  const level = Math.max(0, Math.min(10, Number(intensityLevel) || 0));
  if (level <= 0) return 0;
  if (level <= 2) return 80;
  if (level <= 4) return 180;
  if (level <= 6) return 360;
  if (level <= 8) return 650;
  if (level === 9) return 850;
  return 1050;
}

function connectPlaybackChain(context, source, options = {}) {
  const gainNode = context.createGain();
  const volume = Number.isFinite(options.volume) ? Math.max(0, options.volume) : 1;
  gainNode.gain.value = volume;

  const distortionAmount = getDistortionAmount(options.distortionIntensityLevel);
  if (distortionAmount > 0) {
    const distortionNode = context.createWaveShaper();
    distortionNode.curve = createDistortionCurve(distortionAmount);
    distortionNode.oversample = "4x";
    source.connect(distortionNode);
    distortionNode.connect(gainNode);
  } else {
    source.connect(gainNode);
  }

  gainNode.connect(context.destination);
  return gainNode;
}

function playHtmlFallback(soundKey, options = {}) {
  const audio = getAudioElement(soundKey);
  if (!audio) return Promise.resolve(false);

  const instance = audio.cloneNode(true);
  instance.volume = Number.isFinite(options.volume) ? Math.max(0, Math.min(1, options.volume)) : 1;
  instance.playbackRate = Number.isFinite(options.playbackRate) ? Math.max(0.25, options.playbackRate) : 1;
  instance.preservesPitch = false;
  activeHtmlFallbacks.add(instance);

  const cleanup = () => activeHtmlFallbacks.delete(instance);
  instance.addEventListener("ended", cleanup, { once: true });
  instance.addEventListener("error", cleanup, { once: true });

  return instance.play()
    .then(() => true)
    .catch((error) => {
      cleanup();
      logAudioDebug("html:play:failed", {
        soundKey,
        errorName: error?.name || null,
        errorMessage: error?.message || null
      });
      return false;
    });
}

export async function playSound(soundKey, options = {}) {
  const debounceMs = Number(options.debounceMs) || 0;
  if (debounceMs > 0) {
    const now = performance.now();
    const lastPlayAt = debouncedPlayTimes.get(soundKey) || 0;
    if (now - lastPlayAt < debounceMs) return false;
    debouncedPlayTimes.set(soundKey, now);
  }

  const context = getAudioContext();
  const buffer = context ? await decodeAudioBuffer(soundKey) : null;

  if (!context || !buffer) {
    return playHtmlFallback(soundKey, options);
  }

  try {
    if (context.state !== "running") {
      await context.resume();
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Number.isFinite(options.playbackRate) ? Math.max(0.25, options.playbackRate) : 1;
    if (Number.isFinite(options.detune)) {
      source.detune.value = options.detune;
    }

    const gainNode = connectPlaybackChain(context, source, options);
    activeSources.add(source);
    source.onended = () => activeSources.delete(source);

    const now = context.currentTime;
    if (Number(options.fadeInMs) > 0) {
      const targetGain = gainNode.gain.value;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(targetGain, now + (Number(options.fadeInMs) / 1000));
    }
    if (Number(options.fadeOutMs) > 0) {
      const fadeOutSec = Number(options.fadeOutMs) / 1000;
      const startAt = Math.max(now, now + buffer.duration - fadeOutSec);
      gainNode.gain.setValueAtTime(gainNode.gain.value, startAt);
      gainNode.gain.linearRampToValueAtTime(0, startAt + fadeOutSec);
    }

    source.start(0);
    logAudioDebug("play:success", { soundKey });
    return true;
  } catch (error) {
    logAudioDebug("play:failed", {
      soundKey,
      errorName: error?.name || null,
      errorMessage: error?.message || null
    });
    return playHtmlFallback(soundKey, options);
  }
}

export const playDebouncedSound = (soundKey, debounceMs = 150, options = {}) => (
  playSound(soundKey, { ...options, debounceMs })
);

export function stopOneShotAudio() {
  for (const source of activeSources) {
    try {
      source.stop(0);
    } catch {
      // Source may already have ended.
    }
  }
  activeSources.clear();

  for (const audio of activeHtmlFallbacks) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Ignore fallback cleanup failures.
    }
  }
  activeHtmlFallbacks.clear();
}

export function stopTensionLoop() {
  if (!tensionLoop) return;

  if (tensionLoop.source) {
    try {
      tensionLoop.source.stop(0);
    } catch {
      // Loop may already have stopped.
    }
  }

  if (tensionLoop.htmlAudio) {
    try {
      tensionLoop.htmlAudio.pause();
      tensionLoop.htmlAudio.currentTime = 0;
    } catch {
      // Ignore fallback cleanup failures.
    }
  }

  tensionLoop = null;
  logAudioDebug("loop:stop");
}

export function stopAllActiveAudio({ includeTensionLoop = true } = {}) {
  stopOneShotAudio();
  if (includeTensionLoop) {
    stopTensionLoop();
  }
}

function applyAudioParamRamp(param, value, rampMs = 0) {
  const context = audioContext;
  if (!context || !param) return;

  const now = context.currentTime;
  const target = Number(value) || 0;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (rampMs > 0) {
    param.linearRampToValueAtTime(target, now + (rampMs / 1000));
  } else {
    param.setValueAtTime(target, now);
  }
}

function setLoopDistortion(intensityLevel = 0) {
  if (!tensionLoop?.distortionNode) return;
  const amount = getDistortionAmount(intensityLevel);
  tensionLoop.distortionNode.curve = amount > 0 ? createDistortionCurve(amount) : null;
}

export async function startTensionLoop(options = {}) {
  const playbackRate = Number.isFinite(options.playbackRate) ? options.playbackRate : 1;
  const gain = Number.isFinite(options.gain) ? options.gain : 0.15;

  if (tensionLoop) {
    setTensionLoopParameters({ playbackRate, gain, rampMs: options.rampMs || 0 });
    setLoopDistortion(options.distortionIntensityLevel);
    return true;
  }

  const context = getAudioContext();
  const buffer = context ? await decodeAudioBuffer("tensionLoop") : null;

  if (!context || !buffer) {
    const audio = getAudioElement("tensionLoop");
    if (!audio) return false;
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, gain));
    audio.playbackRate = Math.max(0.25, playbackRate);
    audio.preservesPitch = false;
    tensionLoop = { htmlAudio: audio };
    return audio.play().then(() => true).catch(() => false);
  }

  try {
    if (context.state !== "running") {
      await context.resume();
    }

    const source = context.createBufferSource();
    const distortionNode = context.createWaveShaper();
    const gainNode = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    source.playbackRate.value = Math.max(0.25, playbackRate);
    distortionNode.oversample = "4x";
    gainNode.gain.value = Math.max(0, gain);

    source.connect(distortionNode);
    distortionNode.connect(gainNode);
    gainNode.connect(context.destination);

    tensionLoop = { source, gainNode, distortionNode };
    setLoopDistortion(options.distortionIntensityLevel);
    source.start(0);
    logAudioDebug("loop:start", { playbackRate, gain });
    return true;
  } catch (error) {
    tensionLoop = null;
    logAudioDebug("loop:start:failed", {
      errorName: error?.name || null,
      errorMessage: error?.message || null
    });
    return false;
  }
}

export function setTensionLoopParameters({ playbackRate = 1, gain = 0.15, rampMs = 0, distortionIntensityLevel = null } = {}) {
  if (!tensionLoop) return false;

  const safePlaybackRate = Math.max(0.25, Number(playbackRate) || 1);
  const safeGain = Math.max(0, Number(gain) || 0);

  if (tensionLoop.source) {
    applyAudioParamRamp(tensionLoop.source.playbackRate, safePlaybackRate, rampMs);
  }
  if (tensionLoop.gainNode) {
    applyAudioParamRamp(tensionLoop.gainNode.gain, safeGain, rampMs);
  }
  if (tensionLoop.htmlAudio) {
    tensionLoop.htmlAudio.playbackRate = safePlaybackRate;
    tensionLoop.htmlAudio.volume = Math.min(1, safeGain);
  }
  if (distortionIntensityLevel !== null) {
    setLoopDistortion(distortionIntensityLevel);
  }

  logAudioDebug("loop:params", { playbackRate: safePlaybackRate, gain: safeGain, rampMs });
  return true;
}

if (AUDIO_DEBUG_ENABLED && typeof window !== "undefined") {
  window.dumpAudioDebug = () => (window.__audioDebugEvents || []).slice();
  console.info("[audio-debug] Enabled. Use window.dumpAudioDebug() to inspect captured events.");
}
