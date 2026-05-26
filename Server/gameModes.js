const { pool } = require("./db");

const STANDARD_CURVE = [
  { minCombo: 0, timerMs: 5000, glitchChance: 0.15, shapeSwapChance: 1, falseTwinChance: 0, readableTwinChance: 1 },
  { minCombo: 7, timerMs: 4800, glitchChance: 0.18, shapeSwapChance: 0.85, falseTwinChance: 0.15, readableTwinChance: 1 },
  { minCombo: 15, timerMs: 4600, glitchChance: 0.2, shapeSwapChance: 0.65, falseTwinChance: 0.35, readableTwinChance: 0.8 },
  { minCombo: 25, timerMs: 4300, glitchChance: 0.22, shapeSwapChance: 0.5, falseTwinChance: 0.5, readableTwinChance: 0.6 },
  { minCombo: 35, timerMs: 3900, glitchChance: 0.25, shapeSwapChance: 0.4, falseTwinChance: 0.6, readableTwinChance: 0.4 },
  { minCombo: 45, timerMs: 3400, glitchChance: 0.27, shapeSwapChance: 0.35, falseTwinChance: 0.65, readableTwinChance: 0.3 },
  { minCombo: 55, timerMs: 3000, glitchChance: 0.3, shapeSwapChance: 0.3, falseTwinChance: 0.7, readableTwinChance: 0.25 }
];

const GAME_MODES = {
  standard: {
    id: "standard",
    title: "GLiTCH!",
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
    roundResultLockMs: 400,
    transitionBeatMs: 350,
    goodRunRound: 50,
    hasLastChance: false,
    curve: [
      { minCombo: 0, timerMs: 4300, glitchChance: 0.22, shapeSwapChance: 0.5, falseTwinChance: 0.5, readableTwinChance: 0.5 },
      { minCombo: 5, timerMs: 3900, glitchChance: 0.25, shapeSwapChance: 0.45, falseTwinChance: 0.55, readableTwinChance: 0.5 },
      { minCombo: 10, timerMs: 3400, glitchChance: 0.27, shapeSwapChance: 0.4, falseTwinChance: 0.6, readableTwinChance: 0.45 },
      { minCombo: 15, timerMs: 3000, glitchChance: 0.3, shapeSwapChance: 0.35, falseTwinChance: 0.65, readableTwinChance: 0.35 }
    ],
    allowPartialBreak: true
  },
  chaos: {
    id: "chaos",
    title: "GLiTCH! Chaos",
    roundResultLockMs: 500,
    transitionBeatMs: 300,
    goodRunRound: 50,
    hasLastChance: true,
    curve: STANDARD_CURVE,
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

async function hydrateStandardModeFromDb() {
  const modeResult = await pool.query(`SELECT id, display_name FROM vervus_data.game_modes WHERE mode_key = 'standard' LIMIT 1`);
  if (modeResult.rowCount === 0) return false;

  const modeDbId = modeResult.rows[0].id;

  const configResult = await pool.query(
    `SELECT has_last_chance, result_lock_ms, transition_beat_ms, good_run_round
     FROM vervus_data.mode_configs
     WHERE mode_id = $1`,
    [modeDbId]
  );

  const bandsResult = await pool.query(
    `SELECT id, combo_min, decision_time_ms, glitch_chance_percent
     FROM vervus_data.mode_difficulty_bands
     WHERE mode_id = $1
     ORDER BY sort_order ASC`,
    [modeDbId]
  );

  const bandIds = bandsResult.rows.map((row) => row.id);
  if (bandIds.length === 0) return false;

  const [deviationMixResult, falseTwinMixResult] = await Promise.all([
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
  ]);

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

  const curve = bandsResult.rows.map((band) => {
    const deviationMix = deviationByBand.get(band.id) || {};
    const falseTwinMix = falseTwinByBand.get(band.id) || {};

    return {
      minCombo: band.combo_min,
      timerMs: band.decision_time_ms,
      glitchChance: Number(band.glitch_chance_percent) / 100,
      shapeSwapChance: deviationMix.shape_swap ?? 1,
      falseTwinChance: deviationMix.false_twin ?? 0,
      readableTwinChance: falseTwinMix.readable_twin ?? 1
    };
  });

  const config = configResult.rows[0];
  GAME_MODES.standard = {
    ...GAME_MODES.standard,
    title: modeResult.rows[0].display_name || GAME_MODES.standard.title,
    hasLastChance: config?.has_last_chance ?? GAME_MODES.standard.hasLastChance,
    roundResultLockMs: config?.result_lock_ms ?? GAME_MODES.standard.roundResultLockMs,
    transitionBeatMs: config?.transition_beat_ms ?? GAME_MODES.standard.transitionBeatMs,
    goodRunRound: config?.good_run_round ?? GAME_MODES.standard.goodRunRound ?? 50,
    curve
  };

  return true;
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
  const result = await pool.query(`SELECT gm.id, gm.mode_key, gm.display_name, mc.orientation_lock
     FROM vervus_data.game_modes gm
     LEFT JOIN vervus_data.mode_configs mc ON mc.mode_id = gm.id
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
      orientationLock: row.orientation_lock || "both"
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
  return Object.values(GAME_MODES).map((mode) => ({ id: mode.id, title: mode.title, orientationLock: "both" }));
}

module.exports = {
  GAME_MODES,
  getModeConfig,
  normalizeModeId,
  getDifficultyProfile,
  getHeatSurgeConfig,
  getCorruptionBand,
  hydrateStandardModeFromDb,
  hydrateHeatSurgeConfigsFromDb,
  hydrateModeCorruptionBandsFromDb,
  getGameModesFromDb,
  getGameModesFallback,
  getModeDebugConfig
};
