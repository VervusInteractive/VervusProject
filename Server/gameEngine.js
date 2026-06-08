const { getDifficultyProfile, getHeatSurgeConfig, getCorruptionBand, normalizeModeId } = require("./gameModes");

const ICONS = ["eye", "bolt", "skull", "smiley", "star"];
const FALSE_TWINS = {
  eye: { readable: "eye_readable_twin", doubt: "eye_doubt_twin" },
  bolt: { readable: "bolt_readable_twin", doubt: "bolt_doubt_twin" },
  skull: { readable: "skull_readable_twin", doubt: "skull_doubt_twin" },
  smiley: { readable: "smiley_readable_twin", doubt: "smiley_doubt_twin" },
  star: { readable: "star_readable_twin", doubt: "star_doubt_twin" }
};
const PARTIAL_BREAKS = {
  eye: "eye_partial_break",
  bolt: "bolt_partial_break",
  skull: "skull_partial_break",
  smiley: "smiley_partial_break",
  star: "star_partial_break"
};
const PARTIAL_BREAK_LABELS = {
  eye: "Broken Eye",
  bolt: "Broken Bolt",
  skull: "Broken Skull",
  smiley: "Broken Smiley",
  star: "Broken Star"
};
const MIXED_DEVIATION_DISPLAY_PATTERNS = [
  "single_deviation",
  "single_normal",
  "all_deviation"
];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickDifferentIcon(baseIcon) {
  const alternatives = ICONS.filter((icon) => icon !== baseIcon);
  return randomItem(alternatives);
}

function pickRandomSubset(list, count) {
  const remaining = [...list];
  const subset = [];

  while (subset.length < count && remaining.length > 0) {
    const index = Math.floor(Math.random() * remaining.length);
    subset.push(remaining[index]);
    remaining.splice(index, 1);
  }

  return subset;
}

function pickMixedDeviationDisplay(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return { pattern: "none", deviatorIds: [] };
  }

  const playerCount = playerIds.length;
  const pattern = randomItem(MIXED_DEVIATION_DISPLAY_PATTERNS);
  const deviationCountByPattern = {
    single_deviation: 1,
    single_normal: Math.max(1, playerCount - 1),
    all_deviation: playerCount
  };
  const deviationCount = deviationCountByPattern[pattern];

  return {
    pattern,
    deviatorIds: pickRandomSubset(playerIds, deviationCount)
  };
}

function pickDeviationType(difficulty) {
  const shapeSwapChance = Math.max(0, Number(difficulty.shapeSwapChance) || 0);
  const falseTwinChance = Math.max(0, Number(difficulty.falseTwinChance) || 0);
  const partialBreakChance = difficulty.allowPartialBreak ? Math.max(0, Number(difficulty.partialBreakChance) || 0) : 0;
  const total = shapeSwapChance + falseTwinChance + partialBreakChance;

  if (total <= 0) return "shape_swap";

  const pick = Math.random() * total;
  if (pick < shapeSwapChance) return "shape_swap";
  if (pick < shapeSwapChance + falseTwinChance) return "false_twin";
  return "partial_break";
}

function createGameState(modeId = "standard") {
  const normalizedModeId = normalizeModeId(modeId);
  const heatSurgeConfig = getHeatSurgeConfig(normalizedModeId);
  return {
    modeId: normalizedModeId,
    status: "active",
    combo: 0,
    score: 0,
    roundNumber: 0,
    usedLastChance: false,
    currentRound: null,
    lastRoundResult: null,
    killScreen: null,
    startedAtMs: Date.now(),
    reconnectCountdownStartedAtMs: null,
    heatSurge: {
      config: heatSurgeConfig,
      activeRoundsRemaining: 0,
      cooldownRoundsRemaining: 0,
      isActive: false,
      lastTriggeredAtMs: null,
      roundsSinceStart: 0
    }
  };
}

function buildRound({ modeId, combo, gameState, playerIds, replayRound = null }) {
  const normalizedModeId = normalizeModeId(modeId);
  const difficulty = getDifficultyProfile(normalizedModeId, combo);
  const heatSurge = gameState?.heatSurge;
  const corruptionBand = getCorruptionBand(normalizedModeId, combo);

  if (replayRound) {
    const panicTimerMs = replayRound.timerMs;
    return {
      ...replayRound,
      id: `${replayRound.id}-replay`,
      isLastChanceReplay: true,
      isResolved: false,
      startedAtMs: Date.now(),
      decisionDeadlineMs: Date.now() + panicTimerMs,
      timerMs: panicTimerMs,
      playerAnswers: { ...replayRound.playerAnswers }
    };
  }

  const baseIcon = randomItem(ICONS);
  const shouldApplyDeviation = Math.random() < difficulty.glitchChance;

  let isGlitchRound = shouldApplyDeviation;
  let deviationType = "none";
  let deviationLabel = "All screens matched";
  let deviatingStimulus = baseIcon;
  let deviationDisplayPattern = "none";
  let deviatorIds = [];

  if (shouldApplyDeviation) {
    const selectedDeviationType = pickDeviationType(difficulty);
    if (selectedDeviationType === "shape_swap") {
      deviationType = "shape_swap";
      deviatingStimulus = pickDifferentIcon(baseIcon);
      deviationLabel = "Shape Swap";
      deviationDisplayPattern = "single_deviation";
      deviatorIds = playerIds.length > 0 ? [randomItem(playerIds)] : [];
    } else if (selectedDeviationType === "partial_break") {
      deviationType = "partial_break";
      deviatingStimulus = PARTIAL_BREAKS[baseIcon];
      deviationLabel = PARTIAL_BREAK_LABELS[baseIcon] || "Partial Break";
      ({ pattern: deviationDisplayPattern, deviatorIds } = pickMixedDeviationDisplay(playerIds));
    } else {
      deviationType = "false_twin";
      const twinType = Math.random() < difficulty.readableTwinChance ? "readable" : "doubt";
      deviatingStimulus = FALSE_TWINS[baseIcon][twinType];
      deviationLabel = twinType === "readable" ? "False Twin" : "Evil Twin";
      ({ pattern: deviationDisplayPattern, deviatorIds } = pickMixedDeviationDisplay(playerIds));
    }

    isGlitchRound = deviatorIds.length > 0 && deviatorIds.length < playerIds.length;
  }

  const deviatorIdSet = new Set(deviatorIds);
  const playerStimuli = {};
  for (const playerId of playerIds) {
    playerStimuli[playerId] = deviatorIdSet.has(playerId) ? deviatingStimulus : baseIcon;
  }

  const deviatorId = isGlitchRound && deviatorIds.length > 0 ? deviatorIds[0] : null;

  const baseTimerMs = difficulty.timerMs;
  const timerMs = heatSurge?.isActive
    ? Math.max(500, baseTimerMs - (heatSurge.config?.timerReductionMs || 0))
    : baseTimerMs;

  return {
    id: `round-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    roundNumber: combo + 1,
    baseIcon,
    isGlitchRound,
    deviatorId,
    deviatorIds,
    deviationDisplayPattern,
    deviationType,
    deviationLabel,
    playerStimuli,
    timerMs,
    baseTimerMs,
    heatSurgeActive: Boolean(heatSurge?.isActive),
    heatSurgeIntensityBonusLevels: heatSurge?.isActive ? (heatSurge.config?.intensityBonusLevels || 0) : 0,
    heatSurgeTransitionWarningMs: heatSurge?.isActive ? (heatSurge.config?.transitionWarningMs || 0) : 0,
    goodRunRound: Number(difficulty.goodRunRound) || 50,
    corruptionEffects: corruptionBand
      ? {
        comboMin: corruptionBand.comboMin,
        visualEffects: corruptionBand.visualEffects,
        audioEffects: corruptionBand.audioEffects,
        intensityLevel: corruptionBand.intensityLevel
      }
      : null,
    startedAtMs: Date.now(),
    decisionDeadlineMs: Date.now() + timerMs,
    playerAnswers: {},
    expectedAnswer: isGlitchRound ? "glitch" : "sync",
    isLastChanceReplay: false
  };
}

function updateHeatSurgeStateForNextRound(gameState) {
  const heatSurge = gameState?.heatSurge;
  if (!heatSurge?.config?.isEnabled) return;

  heatSurge.roundsSinceStart += 1;

  if (heatSurge.isActive) {
    heatSurge.activeRoundsRemaining = Math.max(0, heatSurge.activeRoundsRemaining - 1);
    if (heatSurge.activeRoundsRemaining === 0) {
      heatSurge.isActive = false;
      heatSurge.cooldownRoundsRemaining = heatSurge.config.cooldownRounds;
    }
    return;
  }

  if (heatSurge.cooldownRoundsRemaining > 0) {
    heatSurge.cooldownRoundsRemaining -= 1;
    return;
  }

  if (gameState.combo < heatSurge.config.minimumCorrectRounds) {
    return;
  }

  if (Math.random() < heatSurge.config.activationChance && heatSurge.config.durationRounds > 0) {
    heatSurge.isActive = true;
    heatSurge.activeRoundsRemaining = heatSurge.config.durationRounds;
    heatSurge.lastTriggeredAtMs = Date.now();
  }
}

function evaluateRound(round, playerIds) {
  const missingPlayers = [];
  const wrongPlayers = [];

  for (const playerId of playerIds) {
    const answer = round.playerAnswers[playerId];
    if (!answer) {
      missingPlayers.push(playerId);
      continue;
    }

    if (answer !== round.expectedAnswer) {
      wrongPlayers.push(playerId);
    }
  }

  const passed = missingPlayers.length === 0 && wrongPlayers.length === 0;

  return {
    passed,
    missingPlayers,
    wrongPlayers,
    failingPlayers: [...wrongPlayers, ...missingPlayers],
    correctAnswer: round.expectedAnswer,
    causeLabel: missingPlayers.length > 0 ? "No response" : round.deviationLabel
  };
}

module.exports = {
  ICONS,
  PARTIAL_BREAKS,
  createGameState,
  buildRound,
  updateHeatSurgeStateForNextRound,
  evaluateRound
};
