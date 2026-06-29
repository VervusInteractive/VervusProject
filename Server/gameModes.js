const { pool } = require("./db");

const STANDARD_CURVE = [
  { minCombo: 0, timerMs: 5000, glitchChance: 0.15, shapeSwapChance: 1, falseTwinChance: 0, partialBreakChance: 0, readableTwinChance: 1 },
  { minCombo: 7, timerMs: 4800, glitchChance: 0.18, shapeSwapChance: 0.85, falseTwinChance: 0.15, partialBreakChance: 0, readableTwinChance: 1 },
  { minCombo: 15, timerMs: 4600, glitchChance: 0.2, shapeSwapChance: 0.65, falseTwinChance: 0.35, partialBreakChance: 0, readableTwinChance: 0.8 },
  { minCombo: 25, timerMs: 4300, glitchChance: 0.22, shapeSwapChance: 0.5, falseTwinChance: 0.5, partialBreakChance: 0, readableTwinChance: 0.6 },
  { minCombo: 35, timerMs: 3900, glitchChance: 0.25, shapeSwapChance: 0.4, falseTwinChance: 0.6, partialBreakChance: 0, readableTwinChance: 0.4 },
  { minCombo: 45, timerMs: 3400, glitchChance: 0.27, shapeSwapChance: 0.35, falseTwinChance: 0.65, partialBreakChance: 0, readableTwinChance: 0.3 },
  { minCombo: 55, timerMs: 3000, glitchChance: 0.3, shapeSwapChance: 0.3, falseTwinChance: 0.7, partialBreakChance: 0, readableTwinChance: 0.25 }
];

const CHAOS_CURVE = STANDARD_CURVE.map((band) => ({
  ...band,
  shapeSwapChance: 0.3,
  falseTwinChance: 0.45,
  partialBreakChance: 0.25,
  readableTwinChance: 0.45
}));

const GAME_MODES = {
  standard: {
    id: "standard",
    title: "GLiTCH!",
    description: "Work together to decide whether every screen is in sync or one player sees a GLiTCH!.",
    shortExplanation: "Stay in sync. Until reality diverges.",
    roundResultLockMs: 500,
    transitionBeatMs: 300,
    goodRunRound: 50,
    hasLastChance: true,
    curve: STANDARD_CURVE,
    allowPartialBreak: false
  },
  blitz: {
    id: "blitz",
    title: "GLiTCH! Blitz",
    description: "The same core GLiTCH! rules at a faster, harsher pace.",
    shortExplanation: "Full speed immediately.",
    roundResultLockMs: 400,
    transitionBeatMs: 350,
    goodRunRound: 50,
    hasLastChance: false,
    curve: [
      { minCombo: 0, timerMs: 4300, glitchChance: 0.22, shapeSwapChance: 0.5, falseTwinChance: 0.45, partialBreakChance: 0.05, readableTwinChance: 0.5 },
      { minCombo: 5, timerMs: 3900, glitchChance: 0.25, shapeSwapChance: 0.45, falseTwinChance: 0.48, partialBreakChance: 0.07, readableTwinChance: 0.5 },
      { minCombo: 10, timerMs: 3400, glitchChance: 0.27, shapeSwapChance: 0.4, falseTwinChance: 0.5, partialBreakChance: 0.1, readableTwinChance: 0.45 },
      { minCombo: 15, timerMs: 3000, glitchChance: 0.3, shapeSwapChance: 0.35, falseTwinChance: 0.53, partialBreakChance: 0.12, readableTwinChance: 0.35 }
    ],
    allowPartialBreak: true
  },
  chaos: {
    id: "chaos",
    title: "GLiTCH! Chaos",
    description: "The GLiTCH! run gradually corrupts as the combo climbs.",
    shortExplanation: "Rules bend. The room keeps moving.",
    roundResultLockMs: 500,
    transitionBeatMs: 300,
    goodRunRound: 50,
    hasLastChance: true,
    curve: CHAOS_CURVE,
    allowPartialBreak: true
  }
};
const MODE_HEAT_SURGE_CONFIGS = {};
const MODE_KEY_BY_DB_ID = {};
const MODE_CORRUPTION_BANDS = {};

function normalizeModeId(modeId = "standard") {
  if (!modeId) return "standard";
  if (GAME_MODES[modeId]) return modeId;
  return MODE_KEY_BY_DB_ID[modeId] || "standard";
}

function getModeConfig(modeId = "standard") {
  return GAME_MODES[normalizeModeId(modeId)] || GAME_MODES.standard;
}

function getDifficultyProfile(modeId, combo) {
  const mode = getModeConfig(modeId);
  let profile = mode.curve[0];

  for (const candidate of mode.curve) {
    if (combo >= candidate.minCombo) {
      profile = candidate;
    }
  }

  return {
    ...profile,
    modeId: mode.id,
    modeTitle: mode.title,
    hasLastChance: mode.hasLastChance,
    roundResultLockMs: mode.roundResultLockMs,
    transitionBeatMs: mode.transitionBeatMs,
    allowPartialBreak: mode.allowPartialBreak,
    goodRunRound: mode.goodRunRound ?? 50
  };
}

function getHeatSurgeConfig(modeId = "standard") {
  return MODE_HEAT_SURGE_CONFIGS[normalizeModeId(modeId)] || null;
}

function getCorruptionBand(modeId = "standard", combo = 0) {
  const bands = MODE_CORRUPTION_BANDS[normalizeModeId(modeId)] || [];
  let selected = null;
  for (const band of bands) {
    if (combo >= band.comboMin) {
      selected = band;
    }
  }
  return selected;
}

function clampChance(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeOrientationLock(value = "both") {
  const normalized = String(value || "both").trim().toLowerCase();
  return ["portrait", "landscape", "both"].includes(normalized) ? normalized : "both";
}

function normalizeDeviationMix(deviationMix = {}, fallbackProfile = {}) {
  const fallback = {
    shapeSwapChance: clampChance(fallbackProfile.shapeSwapChance, 1),
    falseTwinChance: clampChance(fallbackProfile.falseTwinChance, 0),
    partialBreakChance: clampChance(fallbackProfile.partialBreakChance, 0)
  };

  const hasConfiguredMix = ["shape_swap", "false_twin", "partial_break"].some((key) => deviationMix[key] !== undefined);
  if (!hasConfiguredMix) return fallback;

  const weights = {
    shapeSwapChance: clampChance(deviationMix.shape_swap, 0),
    falseTwinChance: clampChance(deviationMix.false_twin, 0),
    partialBreakChance: clampChance(deviationMix.partial_break, 0)
  };
  const total = weights.shapeSwapChance + weights.falseTwinChance + weights.partialBreakChance;

  if (total <= 0) return fallback;

  return {
    shapeSwapChance: weights.shapeSwapChance / total,
    falseTwinChance: weights.falseTwinChance / total,
    partialBreakChance: weights.partialBreakChance / total
  };
}

function getFallbackProfile(mode, comboMin) {
  let profile = mode.curve[0] || {};
  for (const candidate of mode.curve || []) {
    if (Number(comboMin) >= Number(candidate.minCombo || 0)) {
      profile = candidate;
    }
  }
  return profile;
}

function getDefaultModeTemplate(modeKey = "standard") {
  return GAME_MODES[modeKey] || {
    ...GAME_MODES.standard,
    id: modeKey,
    title: modeKey
  };
}

async function hydrateGameModesFromDb() {
  const modeResult = await pool.query(
    `SELECT id, mode_key, display_name, description, short_explanation
     FROM vervus_data.game_modes
     WHERE is_enabled = true
     ORDER BY display_name ASC`
  );
  if (modeResult.rowCount === 0) return false;

  const modeRows = modeResult.rows.filter((row) => Boolean(row.mode_key));
  if (modeRows.length === 0) return false;

  for (const row of modeRows) {
    MODE_KEY_BY_DB_ID[row.id] = row.mode_key;
  }

  const modeIds = modeRows.map((row) => row.id);
  const [configResult, bandsResult] = await Promise.all([
    pool.query(
      `SELECT mode_id,
              has_last_chance,
              result_lock_ms,
              transition_beat_ms,
              good_run_round,
              orientation_lock
       FROM vervus_data.mode_configs
       WHERE mode_id = ANY($1::uuid[])`,
      [modeIds]
    ),
    pool.query(
      `SELECT id, mode_id, combo_min, decision_time_ms, glitch_chance_percent
       FROM vervus_data.mode_difficulty_bands
       WHERE mode_id = ANY($1::uuid[])
       ORDER BY mode_id ASC, sort_order ASC`,
      [modeIds]
    )
  ]);

  const bandIds = bandsResult.rows.map((row) => row.id);
  const [deviationMixResult, falseTwinMixResult] = bandIds.length > 0
    ? await Promise.all([
      pool.query(
        `SELECT difficulty_band_id, deviation_type, weight_percent
         FROM vervus_data.mode_deviation_mix
         WHERE difficulty_band_id = ANY($1::uuid[])`,
        [bandIds]
      ),
      pool.query(
        `SELECT difficulty_band_id, false_twin_type, weight_percent
         FROM vervus_data.mode_false_twin_mix
         WHERE difficulty_band_id = ANY($1::uuid[])`,
        [bandIds]
      )
    ])
    : [{ rows: [] }, { rows: [] }];

  const configByModeId = new Map(configResult.rows.map((row) => [row.mode_id, row]));
  const bandsByModeId = new Map();
  for (const band of bandsResult.rows) {
    const current = bandsByModeId.get(band.mode_id) || [];
    current.push(band);
    bandsByModeId.set(band.mode_id, current);
  }

  const deviationByBand = new Map();
  for (const row of deviationMixResult.rows) {
    const key = row.difficulty_band_id;
    const current = deviationByBand.get(key) || {};
    current[row.deviation_type] = Number(row.weight_percent) / 100;
    deviationByBand.set(key, current);
  }

  const falseTwinByBand = new Map();
  for (const row of falseTwinMixResult.rows) {
    const key = row.difficulty_band_id;
    const current = falseTwinByBand.get(key) || {};
    current[row.false_twin_type] = Number(row.weight_percent) / 100;
    falseTwinByBand.set(key, current);
  }

  for (const modeRow of modeRows) {
    const mode = getDefaultModeTemplate(modeRow.mode_key);
    const config = configByModeId.get(modeRow.id);
    const bands = bandsByModeId.get(modeRow.id) || [];
    const curve = bands.length > 0
      ? bands.map((band) => {
        const fallbackProfile = getFallbackProfile(mode, band.combo_min);
        const deviationMix = normalizeDeviationMix(deviationByBand.get(band.id), fallbackProfile);
        const falseTwinMix = falseTwinByBand.get(band.id) || {};
        const readableTwinChance = falseTwinMix.readable_twin !== undefined
          ? falseTwinMix.readable_twin
          : (falseTwinMix.doubt_twin !== undefined ? 1 - falseTwinMix.doubt_twin : fallbackProfile.readableTwinChance ?? 1);

        return {
          minCombo: Number(band.combo_min) || 0,
          timerMs: Number(band.decision_time_ms) || fallbackProfile.timerMs,
          glitchChance: clampChance(Number(band.glitch_chance_percent) / 100, fallbackProfile.glitchChance),
          ...deviationMix,
          readableTwinChance: clampChance(readableTwinChance, fallbackProfile.readableTwinChance ?? 1)
        };
      })
      : mode.curve;

    GAME_MODES[modeRow.mode_key] = {
      ...mode,
      title: modeRow.display_name || mode.title,
      description: modeRow.description || mode.description || null,
      shortExplanation: modeRow.short_explanation || mode.shortExplanation || null,
      hasLastChance: config?.has_last_chance ?? mode.hasLastChance,
      roundResultLockMs: config?.result_lock_ms ?? mode.roundResultLockMs,
      transitionBeatMs: config?.transition_beat_ms ?? mode.transitionBeatMs,
      goodRunRound: config?.good_run_round ?? mode.goodRunRound ?? 50,
      orientationLock: normalizeOrientationLock(config?.orientation_lock || mode.orientationLock),
      allowPartialBreak: curve.some((band) => clampChance(band.partialBreakChance, 0) > 0),
      curve
    };
  }

  return true;
}

async function hydrateStandardModeFromDb() {
  return hydrateGameModesFromDb();
}

async function hydrateHeatSurgeConfigsFromDb() {
  const result = await pool.query(
    `SELECT gm.id AS mode_db_id,
            gm.mode_key,
            hsc.is_enabled,
            hsc.minimum_correct_rounds,
            hsc.activation_chance_percent,
            hsc.duration_rounds,
            hsc.cooldown_rounds,
            hsc.timer_reduction_ms,
            hsc.intensity_bonus_levels,
            hsc.transition_warning_ms
     FROM vervus_data.mode_heat_surge_configs hsc
     JOIN vervus_data.game_modes gm ON gm.id = hsc.mode_id`
  );

  for (const [modeKey] of Object.entries(MODE_HEAT_SURGE_CONFIGS)) {
    delete MODE_HEAT_SURGE_CONFIGS[modeKey];
  }

  for (const row of result.rows) {
    if (!row.mode_key) continue;
    if (row.mode_db_id) {
      MODE_KEY_BY_DB_ID[row.mode_db_id] = row.mode_key;
    }
    MODE_HEAT_SURGE_CONFIGS[row.mode_key] = {
      isEnabled: Boolean(row.is_enabled),
      minimumCorrectRounds: Number(row.minimum_correct_rounds) || 0,
      activationChance: (Number(row.activation_chance_percent) || 0) / 100,
      durationRounds: Number(row.duration_rounds) || 0,
      cooldownRounds: Number(row.cooldown_rounds) || 0,
      timerReductionMs: Number(row.timer_reduction_ms) || 0,
      intensityBonusLevels: Number(row.intensity_bonus_levels) || 0,
      transitionWarningMs: Number(row.transition_warning_ms) || 0
    };
  }
}

async function hydrateModeCorruptionBandsFromDb() {
  const result = await pool.query(
    `SELECT gm.id AS mode_db_id,
            gm.mode_key,
            mcb.combo_min,
            mcb.visual_effects,
            mcb.audio_effects,
            mcb.intensity_level
     FROM vervus_data.mode_corruption_bands mcb
     JOIN vervus_data.game_modes gm ON gm.id = mcb.mode_id
     ORDER BY gm.mode_key ASC, mcb.combo_min ASC`
  );

  for (const [modeKey] of Object.entries(MODE_CORRUPTION_BANDS)) {
    delete MODE_CORRUPTION_BANDS[modeKey];
  }

  for (const row of result.rows) {
    if (!row.mode_key) continue;
    if (row.mode_db_id) {
      MODE_KEY_BY_DB_ID[row.mode_db_id] = row.mode_key;
    }
    MODE_CORRUPTION_BANDS[row.mode_key] = MODE_CORRUPTION_BANDS[row.mode_key] || [];
    MODE_CORRUPTION_BANDS[row.mode_key].push({
      comboMin: Number(row.combo_min) || 0,
      visualEffects: Array.isArray(row.visual_effects) ? row.visual_effects : [],
      audioEffects: Array.isArray(row.audio_effects) ? row.audio_effects : [],
      intensityLevel: Number(row.intensity_level) || 1
    });
  }
}

async function getGameModesFromDb() {
  await hydrateGameModesFromDb();
  await hydrateHeatSurgeConfigsFromDb();
  await hydrateModeCorruptionBandsFromDb();

  const result = await pool.query(`SELECT gm.id, gm.mode_key, gm.display_name, gm.description, gm.short_explanation, mc.orientation_lock
     FROM vervus_data.game_modes gm
     LEFT JOIN vervus_data.mode_configs mc ON mc.mode_id = gm.id
     WHERE gm.is_enabled = true
     ORDER BY gm.display_name ASC`);
  for (const row of result.rows) {
    if (row.id && row.mode_key) {
      MODE_KEY_BY_DB_ID[row.id] = row.mode_key;
    }
  }
  return result.rows
    .filter((row) => Boolean(row.mode_key))
    .map((row) => ({
      id: row.mode_key,
      title: row.display_name || row.mode_key,
      description: row.description || GAME_MODES[row.mode_key]?.description || null,
      shortExplanation: row.short_explanation || GAME_MODES[row.mode_key]?.shortExplanation || null,
      orientationLock: normalizeOrientationLock(row.orientation_lock || GAME_MODES[row.mode_key]?.orientationLock)
    }));
}

function getModeDebugConfig(modeId = "standard") {
  const mode = getModeConfig(modeId);
  return {
    ...mode,
    heatSurgeConfig: getHeatSurgeConfig(mode.id),
    corruptionBands: MODE_CORRUPTION_BANDS[mode.id] || []
  };
}

function getGameModesFallback() {
  return Object.values(GAME_MODES).map((mode) => ({
    id: mode.id,
    title: mode.title,
    description: mode.description || null,
    shortExplanation: mode.shortExplanation || null,
    orientationLock: normalizeOrientationLock(mode.orientationLock)
  }));
}

module.exports = {
  GAME_MODES,
  getModeConfig,
  normalizeModeId,
  getDifficultyProfile,
  getHeatSurgeConfig,
  getCorruptionBand,
  hydrateGameModesFromDb,
  hydrateStandardModeFromDb,
  hydrateHeatSurgeConfigsFromDb,
  hydrateModeCorruptionBandsFromDb,
  getGameModesFromDb,
  getGameModesFallback,
  getModeDebugConfig
};
