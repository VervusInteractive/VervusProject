import { useEffect, useMemo, useRef, useState } from "react";
import correctAnswerSoundFile from "../assets/audio/GLiTCH!/Sound_CorrectAnswer.wav";
import failImpactSoundFile from "../assets/audio/GLiTCH!/Sound_FailImpact.wav";
import heatSurgeWarningSoundFile from "../assets/audio/GLiTCH!/Sound_HeatSurgeWarning.wav";
import killScreenStingSoundFile from "../assets/audio/GLiTCH!/Sound_KillScreenSting.wav";
import lastChanceFreezeSoundFile from "../assets/audio/GLiTCH!/Sound_SaveIt.wav";
import resultsTickSoundFile from "../assets/audio/GLiTCH!/Sound_ResultsTick.wav";
import transitionSoundFile from "../assets/audio/Vervus/Sound_GameTransition.wav";

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const EFFECT_OPTIONS = [
  "subtle_flicker_pulse",
  "small_screen_edge_cracks",
  "slightly_more_unstable_transition_beat",
  "one_or_more_screens_get_light_color_instability",
  "short_distort_pulse_just_before_reveal",
  "heavier_edge_cracks",
  "short_interference_pulse_before_reveal",
  "short_static_surge_in_the_transition_beat",
  "multiple_light_effects_may_be_active_together",
  "two_heavier_corruption_layers_at_once",
  "reveal_and_transition_feel_like_the_run_could_break_at_any_moment",
  "overload_feeling_should_peak_without_making_core_information_unfairly_unreadable",
  "static_interference",
  "flicker_overlap",
  "stronger_hue_drift",
  "light_chromatic_shift",
  "color_flip_before_reveal",
  "aggressive_screen_pulse",
  "unstable_screen_pulse",
  "stronger_reveal_distortion",
  "dirty_reveal",
  "stronger_hue_drift_with_static",
  "maximum_combined_corruption"
];

const ICONS = ["👁️", "⚡", "💀", "🙂", "⭐"];

const AUDIO_OPTIONS = [
  { key: "gameTransition", label: "Game Transition", src: transitionSoundFile },
  { key: "lastChanceFreeze", label: "Last Chance Freeze", src: lastChanceFreezeSoundFile },
  { key: "heatSurgeWarning", label: "Heat Surge Warning", src: heatSurgeWarningSoundFile },
  { key: "correctAnswer", label: "Correct", src: correctAnswerSoundFile },
  { key: "failImpact", label: "Fail Impact", src: failImpactSoundFile },
  { key: "killScreenSting", label: "Kill Screen Sting", src: killScreenStingSoundFile },
  { key: "resultsTick", label: "Results Tick", src: resultsTickSoundFile }
];

const AUDIO_EFFECT_OPTIONS = [
  "clean",
  "subtle_audio_wobble",
  "first_light_scrape_layer",
  "extra_audio_layer",
  "audio_fray_or_strain",
  "light_audio_clipping",
  "slight_audio_distortion",
  "aggressive_audio_distortion",
  "more_intense_audio_layer",
  "heavier_bass_pulse",
  "high_intensity_audio",
  "aggressive_feedback",
  "light_tick_acceleration",
  "subtle_bass_pulse",
  "maximum_feedback_intensity",
  "near_overload_audio",
  "heavier_feedback_impact",
  "audio_fray_or_scrape"
];

const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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
  color_flip_before_reveal: "corruption-invert-flash",
  aggressive_screen_pulse: "corruption-pulse-heavy",
  unstable_screen_pulse: "corruption-pulse-light",
  brighter_transition_pulse: "corruption-transition-pulse-bright",
  short_distort_pulse_just_before_reveal: "corruption-distort-pulse-light",
  short_interference_pulse_before_reveal: "corruption-static-pulse-before-reveal",
  short_static_surge_in_the_transition_beat: "corruption-static-surge-transition",
  heavier_edge_cracks: "corruption-edge-cracks-heavy",
  clearer_hue_drift: "corruption-hue-light",
  multiple_light_effects_may_be_active_together: "corruption-multiple-light-effects",
  stronger_reveal_distortion: "corruption-distort-heavy",
  dirty_reveal: "corruption-distort-light",
  two_heavier_corruption_layers_at_once: "corruption-two-heavy-layers",
  reveal_and_transition_feel_like_the_run_could_break_at_any_moment: "corruption-overload-transition",
  overload_feeling_should_peak_without_making_core_information_unfairly_unreadable: "corruption-overload-reveal",
  stronger_hue_drift_with_static: "corruption-static-overlay",
  maximum_combined_corruption: "corruption-maximum"
};

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

  if (effectKey === "subtle_audio_wobble") {
    const tremolo = context.createGain();
    const lfo = context.createOscillator();
    const lfoDepth = context.createGain();
    tremolo.gain.value = 0.75;
    lfo.frequency.value = 7;
    lfoDepth.gain.value = 0.2;
    lfo.connect(lfoDepth);
    lfoDepth.connect(tremolo.gain);
    chain(tremolo);
    lfo.start();
    source.onended = () => lfo.stop();
    return output;
  }

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
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 60;
    distortion.curve = createDistortionCurve(160);
    distortion.oversample = "2x";
    chain(highpass, distortion);
    return output;
  }

  if (effectKey === "slight_audio_distortion") {
    const distortion = context.createWaveShaper();
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 85;
    distortion.curve = createDistortionCurve(260);
    distortion.oversample = "4x";
    chain(highpass, distortion);
    return output;
  }

  if (effectKey === "aggressive_audio_distortion") {
    const distortion = context.createWaveShaper();
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 120;
    distortion.curve = createDistortionCurve(700);
    distortion.oversample = "4x";
    chain(highpass, distortion);
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
    const highshelf = context.createBiquadFilter();
    distortion.curve = createDistortionCurve(780);
    distortion.oversample = "4x";
    compressor.threshold.value = -26;
    compressor.ratio.value = 12;
    highshelf.type = "highshelf";
    highshelf.frequency.value = 2400;
    highshelf.gain.value = 6;
    chain(distortion, compressor, highshelf);
    return output;
  }

  if (effectKey === "aggressive_feedback") {
    const distortion = context.createWaveShaper();
    const compressor = context.createDynamicsCompressor();
    const highshelf = context.createBiquadFilter();
    distortion.curve = createDistortionCurve(900);
    distortion.oversample = "4x";
    compressor.threshold.value = -30;
    compressor.ratio.value = 14;
    highshelf.type = "highshelf";
    highshelf.frequency.value = 2600;
    highshelf.gain.value = 8;
    chain(distortion, compressor, highshelf);
    return output;
  }

  if (effectKey === "maximum_feedback_intensity") {
    const distortion = context.createWaveShaper();
    const compressor = context.createDynamicsCompressor();
    const highshelf = context.createBiquadFilter();
    distortion.curve = createDistortionCurve(1000);
    distortion.oversample = "4x";
    compressor.threshold.value = -34;
    compressor.ratio.value = 18;
    highshelf.type = "highshelf";
    highshelf.frequency.value = 2400;
    highshelf.gain.value = 10;
    chain(distortion, compressor, highshelf);
    return output;
  }

  if (effectKey === "near_overload_audio") {
    const distortion = context.createWaveShaper();
    const compressor = context.createDynamicsCompressor();
    const highshelf = context.createBiquadFilter();
    distortion.curve = createDistortionCurve(1100);
    distortion.oversample = "4x";
    compressor.threshold.value = -36;
    compressor.ratio.value = 20;
    highshelf.type = "highshelf";
    highshelf.frequency.value = 2600;
    highshelf.gain.value = 12;
    chain(distortion, compressor, highshelf);
    return output;
  }

  source.connect(output);
  return output;
}

function getTransitionBassBoost(intensityLevel, isHeatSurgeEnabled) {
  if (isHeatSurgeEnabled) return 24;
  const level = Number(intensityLevel) || 0;
  return Math.min(18, Math.max(0, level * 1.5));
}

function SoloChaosLabPage({ onBack, onUiButtonClick }) {
  const [selectedEffects, setSelectedEffects] = useState(["subtle_flicker_pulse"]);
  const [intensity, setIntensity] = useState(5);
  const [icon, setIcon] = useState(ICONS[0]);
  const [selectedAudioEffect, setSelectedAudioEffect] = useState("clean");
  const [difficultyLevel, setDifficultyLevel] = useState(5);
  const [isHeatSurgeEnabled, setIsHeatSurgeEnabled] = useState(false);
  const audioContextRef = useRef(null);
  const decodedAudioCacheRef = useRef({});
  const activeSourceMapRef = useRef({});
  const tickLoopIntervalRef = useRef(null);
  const tickLoopStopTimeoutRef = useRef(null);

  const corruptionClasses = useMemo(() => {
    const mapped = selectedEffects.map((effect) => VISUAL_EFFECT_CLASS_MAP[effect]).filter(Boolean);
    if (intensity > 5) mapped.push("corruption-intensity-high");
    mapped.push("corruption-intensity-medium");
    return Array.from(new Set(mapped));
  }, [intensity, selectedEffects]);

  const intensityGlowStyle = useMemo(() => ({
    "--corruption-medium-glow": clamp01(intensity / 5),
    "--corruption-high-glow": clamp01((intensity - 5) / 3)
  }), [intensity]);

  const toggleEffect = (effect) => {
    setSelectedEffects((prev) => (
      prev.includes(effect) ? prev.filter((entry) => entry !== effect) : [...prev, effect]
    ));
  };

  const playAudioSample = async (src, options = {}) => {
    if (options.stopPrevious) {
      const previousSource = activeSourceMapRef.current[src];
      if (previousSource) {
        try {
          previousSource.stop();
        } catch {
          // Ignore stop failures for already-ended sources.
        }
        delete activeSourceMapRef.current[src];
      }
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextCtor || selectedAudioEffect === "clean") {
      const audio = new Audio(src);
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    const context = audioContextRef.current || new AudioContextCtor({ latencyHint: "interactive" });
    audioContextRef.current = context;

    if (context.state === "suspended") {
      await context.resume().catch(() => {});
    }

    let buffer = decodedAudioCacheRef.current[src];

    if (!buffer) {
      const response = await fetch(src);
      const fileBuffer = await response.arrayBuffer();
      buffer = await context.decodeAudioData(fileBuffer);
      decodedAudioCacheRef.current[src] = buffer;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

    const processedOutput = attachChaosAudioEffect(context, source, selectedAudioEffect);
    processedOutput.connect(context.destination);
    source.start(0);
    if (options.stopPrevious) {
      activeSourceMapRef.current[src] = source;
    }
    return;

  };

  const playTransitionWithBassProfile = async () => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const bassBoostDb = getTransitionBassBoost(difficultyLevel, isHeatSurgeEnabled);

    if (!AudioContextCtor) {
      const audio = new Audio(transitionSoundFile);
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    const context = audioContextRef.current || new AudioContextCtor({ latencyHint: "interactive" });
    audioContextRef.current = context;

    if (context.state === "suspended") {
      await context.resume().catch(() => {});
    }

    let buffer = decodedAudioCacheRef.current.transitionBassTest;
    if (!buffer) {
      const response = await fetch(transitionSoundFile);
      const fileBuffer = await response.arrayBuffer();
      buffer = await context.decodeAudioData(fileBuffer);
      decodedAudioCacheRef.current.transitionBassTest = buffer;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

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
      lowshelf.connect(limiter);
      limiter.connect(context.destination);
    } else {
      source.connect(context.destination);
    }

    source.start(0);
  };

  const playTickCadenceTest = async ({ roundNumber = 1, goodRunRound = 50, durationMs = 5000 } = {}) => {
    const minIntervalMs = 450;
    const maxIntervalMs = 1000;
    const progress = Math.max(0, Math.min(1, roundNumber / Math.max(1, goodRunRound)));
    const tickIntervalMs = Math.round(maxIntervalMs - ((maxIntervalMs - minIntervalMs) * progress));

    if (tickLoopIntervalRef.current) window.clearInterval(tickLoopIntervalRef.current);
    if (tickLoopStopTimeoutRef.current) window.clearTimeout(tickLoopStopTimeoutRef.current);

    await playAudioSample(resultsTickSoundFile, { stopPrevious: true });
    tickLoopIntervalRef.current = window.setInterval(() => {
      playAudioSample(resultsTickSoundFile, { stopPrevious: true });
    }, tickIntervalMs);

    tickLoopStopTimeoutRef.current = window.setTimeout(() => {
      if (tickLoopIntervalRef.current) {
        window.clearInterval(tickLoopIntervalRef.current);
        tickLoopIntervalRef.current = null;
      }
      tickLoopStopTimeoutRef.current = null;
    }, durationMs);
  };

  useEffect(() => () => {
    if (tickLoopIntervalRef.current) {
      window.clearInterval(tickLoopIntervalRef.current);
      tickLoopIntervalRef.current = null;
    }
    if (tickLoopStopTimeoutRef.current) {
      window.clearTimeout(tickLoopStopTimeoutRef.current);
      tickLoopStopTimeoutRef.current = null;
    }
  }, []);

  return (
    <section className="panel">
      <div className="room-header">
        <div>
          <h1 className="panel-title">Chaos Test Mode</h1>
          <p className="panel-subtitle">Single-player sandbox for Chaos mode effects.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => { onUiButtonClick?.(); onBack?.(); }}>Back</button>
      </div>

      <div className={`glitch-icon-card ${corruptionClasses.join(" ")}`} style={intensityGlowStyle}>
        <div className="glitch-icon" role="img" aria-label="Current test symbol">{icon}</div>
      </div>

      <label className="field">
        <span className="field-label">Intensity ({intensity})</span>
        <input
          className="field-input"
          type="range"
          min="1"
          max="10"
          value={intensity}
          onChange={(event) => setIntensity(Number(event.target.value))}
        />
      </label>

      <div className="field">
        <span className="field-label">Stimulus</span>
        <div className="single-action-row">
          {ICONS.map((entry) => (
            <button
              key={entry}
              className="btn btn-secondary"
              onClick={() => { onUiButtonClick?.(); setIcon(entry); }}
            >
              {entry}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Audio Effect Profile</span>
        <div className="single-action-row">
          {AUDIO_EFFECT_OPTIONS.map((effect) => (
            <button
              key={effect}
              className={`btn ${selectedAudioEffect === effect ? "btn-primary" : "btn-secondary"}`}
              onClick={() => { onUiButtonClick?.(); setSelectedAudioEffect(effect); }}
            >
              {effect}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Chaos Audio Effects</span>
        <div className="single-action-row">
          {AUDIO_OPTIONS.map((effect) => (
            <button
              key={effect.key}
              className="btn btn-secondary"
              onClick={() => {
                onUiButtonClick?.();
                playAudioSample(effect.src);
              }}
            >
              {effect.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Game Transition Bass Test (Difficulty + Heat Surge)</span>
        <div className="single-action-row">
          <button
            className={`btn ${isHeatSurgeEnabled ? "btn-primary" : "btn-secondary"}`}
            onClick={() => { onUiButtonClick?.(); setIsHeatSurgeEnabled((prev) => !prev); }}
          >
            Heat Surge: {isHeatSurgeEnabled ? "On" : "Off"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onUiButtonClick?.();
              playTransitionWithBassProfile();
            }}
          >
            Play Game Transition Bass Test
          </button>
        </div>
        <div className="answer-row" style={{ marginTop: "0.5rem" }}>
          {DIFFICULTY_LEVELS.map((level) => (
            <button
              key={level}
              className={`btn ${difficultyLevel === level ? "btn-primary" : "btn-secondary"}`}
              onClick={() => { onUiButtonClick?.(); setDifficultyLevel(level); }}
            >
              Difficulty {level}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Results Tick Cadence Test (Solo)</span>
        <div className="single-action-row">
          <button
            className="btn btn-secondary"
            onClick={() => {
              onUiButtonClick?.();
              playTickCadenceTest({ roundNumber: 1, goodRunRound: 50 });
            }}
          >
            Round 1 (~1000ms)
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              onUiButtonClick?.();
              playTickCadenceTest({ roundNumber: 25, goodRunRound: 50 });
            }}
          >
            Round 25 (~550ms)
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onUiButtonClick?.();
              playTickCadenceTest({ roundNumber: 50, goodRunRound: 50 });
            }}
          >
            Round 50 (200ms)
          </button>
        </div>
      </div>

      <div className="field">
        <span className="field-label">Chaos Visual Effects</span>
        <div className="answer-row">
          {EFFECT_OPTIONS.map((effect) => (
            <button
              key={effect}
              className={`btn ${selectedEffects.includes(effect) ? "btn-primary" : "btn-secondary"}`}
              onClick={() => { onUiButtonClick?.(); toggleEffect(effect); }}
            >
              {effect}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SoloChaosLabPage;
