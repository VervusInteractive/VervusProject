const { getDifficultyProfile, getHeatSurgeConfig, getCorruptionBand, normalizeModeId } = require("./gameModes");

const ICONS = ["eye", "bolt", "skull", "smiley", "star"];
const FALSE_TWINS = {
  eye: { readable: "eye_readable_twin", doubt: "eye_doubt_twin" },
  bolt: { readable: "bolt_readable_twin", doubt: "bolt_doubt_twin" },
  skull: { readable: "skull_readable_twin", doubt: "skull_doubt_twin" },
  smiley: { readable: "smiley_readable_twin", doubt: "smiley_doubt_twin" },
  star: { readable: "star_readable_twin", doubt: "star_doubt_twin" }
};

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickDifferentIcon(baseIcon) {
  const alternatives = ICONS.filter((icon) => icon !== baseIcon);
  return randomItem(alternatives);
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
  const isGlitchRound = Math.random() < difficulty.glitchChance;
  const deviatorId = isGlitchRound ? randomItem(playerIds) : null;

  let deviationType = "none";
  let deviationLabel = "All screens matched";
  let deviatingStimulus = baseIcon;

  if (isGlitchRound) {
    const pick = Math.random();
    if (pick < difficulty.shapeSwapChance) {
      deviationType = "shape_swap";
      deviatingStimulus = pickDifferentIcon(baseIcon);
      deviationLabel = "Shape Swap";
    } else {
      deviationType = "false_twin";
      const twinType = Math.random() < difficulty.readableTwinChance ? "readable" : "doubt";
      deviatingStimulus = FALSE_TWINS[baseIcon][twinType];
      deviationLabel = twinType === "readable" ? "False Twin" : "Evil Twin";
    }
  }

  const playerStimuli = {};
  for (const playerId of playerIds) {
    playerStimuli[playerId] = playerId === deviatorId ? deviatingStimulus : baseIcon;
  }

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
  createGameState,
  buildRound,
  updateHeatSurgeStateForNextRound,
  evaluateRound
};
