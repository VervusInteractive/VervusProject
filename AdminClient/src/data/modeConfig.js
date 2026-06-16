const emptyHeatSurgeConfig = {
  isEnabled: false,
  minimumCorrectRounds: 0,
  activationChancePercent: 0,
  durationRounds: 0,
  cooldownRounds: 0,
  timerReductionMs: 0,
  intensityBonusLevels: 0,
  transitionWarningMs: 0
};

const emptyModeForm = {
  modeKey: "",
  displayName: "",
  isEnabled: true,
  hasLastChance: true,
  resultLockMs: 500,
  transitionBeatMs: 300,
  goodRunRound: 50,
  orientationLock: "both",
  difficultyBands: [],
  heatSurgeConfig: emptyHeatSurgeConfig,
  corruptionBands: []
};

const emptyProductForm = {
  productKey: "",
  productName: "",
  priceCents: 0,
  currencyCode: "USD",
  validityDurationHours: 24,
  status: "active",
  stripePriceId: "",
  displayOrder: 0,
  modeKeys: []
};

function normalizeOrientationLock(value = "both") {
  const normalized = String(value || "both").trim().toLowerCase();
  return ["portrait", "landscape", "both"].includes(normalized) ? normalized : "both";
}

function normalizeProductKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCurrencyCode(value = "USD") {
  const normalized = String(value || "USD").trim().toUpperCase().replace(/[^A-Z]/g, "");
  return normalized.length === 3 ? normalized : "USD";
}

function normalizeProductForm(product = emptyProductForm) {
  return {
    productKey: product.productKey || "",
    productName: product.productName || "",
    priceCents: product.priceCents ?? 0,
    currencyCode: normalizeCurrencyCode(product.currencyCode),
    validityDurationHours: product.validityDurationHours ?? 24,
    status: product.status || "active",
    stripePriceId: product.stripePriceId || "",
    displayOrder: product.displayOrder ?? 0,
    modeKeys: Array.isArray(product.modeKeys)
      ? product.modeKeys
      : (product.modes || []).map((mode) => mode.modeKey).filter(Boolean)
  };
}

function normalizeModeForm(mode = emptyModeForm) {
  return {
    modeKey: mode.modeKey || "",
    displayName: mode.displayName || "",
    isEnabled: mode.isEnabled ?? true,
    hasLastChance: mode.hasLastChance ?? true,
    resultLockMs: mode.resultLockMs ?? 500,
    transitionBeatMs: mode.transitionBeatMs ?? 300,
    goodRunRound: mode.goodRunRound ?? 50,
    orientationLock: normalizeOrientationLock(mode.orientationLock),
    difficultyBands: Array.isArray(mode.difficultyBands) ? mode.difficultyBands : [],
    heatSurgeConfig: mode.heatSurgeConfig || emptyHeatSurgeConfig,
    corruptionBands: Array.isArray(mode.corruptionBands) ? mode.corruptionBands : []
  };
}

const deviationTypeOptions = [
  { value: "shape_swap", label: "Shape swap" },
  { value: "false_twin", label: "False twin" },
  { value: "partial_break", label: "Partial break" }
];

const falseTwinTypeOptions = [
  { value: "readable_twin", label: "Readable twin" },
  { value: "doubt_twin", label: "Doubt twin" }
];

const visualEffectOptions = [
  { value: "subtle_flicker_pulse", label: "Subtle flicker pulse" },
  { value: "small_screen_edge_cracks", label: "Small edge cracks" },
  { value: "unstable_transition_beat", label: "Unstable transition beat" },
  { value: "slightly_more_unstable_transition_beat", label: "Slightly unstable transition beat" },
  { value: "light_color_instability", label: "Light color instability" },
  { value: "one_or_more_screens_get_light_color_instability", label: "One or more screens get color instability" },
  { value: "clearer_hue_drift", label: "Clearer hue drift" },
  { value: "light_chromatic_shift", label: "Light chromatic shift" },
  { value: "distort_pulse_before_reveal", label: "Distort pulse before reveal" },
  { value: "interference_pulse_before_reveal", label: "Interference pulse before reveal" },
  { value: "static_surge_transition", label: "Static surge transition" },
  { value: "multiple_light_effects", label: "Multiple light effects" },
  { value: "two_heavier_corruption_layers", label: "Two heavier corruption layers" },
  { value: "overload_reveal", label: "Overload reveal" },
  { value: "overload_transition", label: "Overload transition" },
  { value: "static_interference", label: "Static interference" },
  { value: "flicker_overlap", label: "Flicker overlap" },
  { value: "stronger_hue_drift", label: "Stronger hue drift" },
  { value: "color_flip_before_reveal", label: "Color flip before reveal" },
  { value: "invert_flash_before_reveal", label: "Invert flash before reveal" },
  { value: "aggressive_screen_pulse", label: "Aggressive screen pulse" },
  { value: "unstable_screen_pulse", label: "Unstable screen pulse" },
  { value: "brighter_transition_pulse", label: "Brighter transition pulse" },
  { value: "short_distort_pulse_just_before_reveal", label: "Short distort pulse before reveal" },
  { value: "short_interference_pulse_before_reveal", label: "Short interference pulse before reveal" },
  { value: "short_static_surge_in_the_transition_beat", label: "Short static surge in transition beat" },
  { value: "heavier_edge_cracks", label: "Heavier edge cracks" },
  { value: "multiple_light_effects_may_be_active_together", label: "Multiple light effects active together" },
  { value: "stronger_reveal_distortion", label: "Stronger reveal distortion" },
  { value: "dirty_reveal", label: "Dirty reveal" },
  { value: "two_heavier_corruption_layers_at_once", label: "Two heavier corruption layers at once" },
  { value: "reveal_and_transition_feel_like_the_run_could_break_at_any_moment", label: "Unstable reveal and transition" },
  { value: "overload_feeling_should_peak_without_making_core_information_unfairly_unreadable", label: "Readable overload peak" },
  { value: "stronger_hue_drift_with_static", label: "Stronger hue drift with static" },
  { value: "maximum_combined_corruption", label: "Maximum combined corruption" }
];

const audioEffectOptions = [
  { value: "first_light_scrape_layer", label: "First light scrape layer" },
  { value: "extra_audio_layer", label: "Extra audio layer" },
  { value: "audio_fray_or_strain", label: "Audio fray / strain" },
  { value: "heavier_feedback_impact", label: "Heavier feedback impact" },
  { value: "audio_fray_or_scrape", label: "Audio fray / scrape" },
  { value: "light_audio_clipping", label: "Light audio clipping" },
  { value: "slight_audio_distortion", label: "Slight audio distortion" },
  { value: "aggressive_audio_distortion", label: "Aggressive audio distortion" },
  { value: "more_intense_audio_layer", label: "More intense audio layer" },
  { value: "heavier_bass_pulse", label: "Heavier bass pulse" },
  { value: "light_tick_acceleration", label: "Light tick acceleration" },
  { value: "subtle_bass_pulse", label: "Subtle bass pulse" },
  { value: "high_intensity_audio", label: "High intensity audio" },
  { value: "aggressive_feedback", label: "Aggressive feedback" },
  { value: "maximum_feedback_intensity", label: "Maximum feedback intensity" },
  { value: "near_overload_audio", label: "Near overload audio" }
];

function cloneModeForm(mode) {
  return {
    ...mode,
    heatSurgeConfig: { ...(mode.heatSurgeConfig || emptyHeatSurgeConfig) },
    difficultyBands: (mode.difficultyBands || []).map((band) => ({
      ...band,
      deviationMix: Array.isArray(band.deviationMix) ? band.deviationMix.map((mix) => ({ ...mix })) : [],
      falseTwinMix: Array.isArray(band.falseTwinMix) ? band.falseTwinMix.map((mix) => ({ ...mix })) : []
    })),
    corruptionBands: (mode.corruptionBands || []).map((band) => ({
      ...band,
      visualEffects: Array.isArray(band.visualEffects) ? [...band.visualEffects] : [],
      audioEffects: Array.isArray(band.audioEffects) ? [...band.audioEffects] : []
    }))
  };
}

function updateListItem(list, index, updater) {
  return list.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));
}

export {
  audioEffectOptions,
  cloneModeForm,
  deviationTypeOptions,
  emptyHeatSurgeConfig,
  emptyModeForm,
  emptyProductForm,
  falseTwinTypeOptions,
  normalizeCurrencyCode,
  normalizeModeForm,
  normalizeOrientationLock,
  normalizeProductForm,
  normalizeProductKey,
  updateListItem,
  visualEffectOptions
};
