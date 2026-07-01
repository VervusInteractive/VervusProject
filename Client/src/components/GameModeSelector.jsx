import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import lockIcon from "../assets/images/Buttons/Button_Lock.png";
import questionIcon from "../assets/images/Buttons/Button_Question.png";

const DEFAULT_GAME_OPTIONS = Object.freeze([
  {
    id: "ghost",
    title: "GHOST",
    description: "Coming soon."
  },
  {
    id: "glitch",
    title: "GLiTCH!",
    description: "Stay in sync. Until reality diverges."
  },
  {
    id: "curse",
    title: "CURSE",
    description: "Coming soon."
  }
]);

const FALLBACK_MODES = Object.freeze([
  {
    id: "standard",
    title: "GLiTCH!",
    gameKey: "glitch",
    gameTitle: "GLiTCH!",
    shortExplanation: "Stay in sync. Until reality diverges."
  },
  {
    id: "blitz",
    title: "GLiTCH! Blitz",
    gameKey: "glitch",
    gameTitle: "GLiTCH!"
  },
  {
    id: "chaos",
    title: "GLiTCH! Chaos",
    gameKey: "glitch",
    gameTitle: "GLiTCH!"
  }
]);

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferGame(mode) {
  const title = String(mode?.title || "").trim();
  const id = String(mode?.id || "").trim();
  const explicitGameKey = normalizeId(mode?.gameKey || mode?.gameId);
  const explicitGameTitle = String(mode?.gameTitle || mode?.gameName || "").trim();

  if (explicitGameKey || explicitGameTitle) {
    return {
      id: explicitGameKey || normalizeId(explicitGameTitle),
      title: explicitGameTitle || explicitGameKey.toUpperCase()
    };
  }

  if (/^glitch\b|^glitch!/i.test(title) || ["standard", "blitz", "chaos"].includes(id)) {
    return { id: "glitch", title: "GLiTCH!" };
  }

  const idParts = id.split(/[_-]/).filter(Boolean);
  if (idParts.length > 1) {
    return { id: normalizeId(idParts[0]), title: idParts[0].toUpperCase() };
  }

  const firstWord = title.split(/\s+/)[0] || id || "game";
  return { id: normalizeId(firstWord), title: firstWord.toUpperCase() };
}

function normalizeMode(mode) {
  const game = inferGame(mode);
  return {
    ...mode,
    id: String(mode?.id || "").trim(),
    title: String(mode?.title || mode?.displayName || mode?.id || "").trim(),
    gameKey: game.id,
    gameTitle: game.title
  };
}

function getModeLabel(mode, gameTitle) {
  const title = String(mode?.title || mode?.id || "").trim();
  const modeId = String(mode?.id || "").trim().toLowerCase();
  if (modeId === "standard") return "Standard";

  const escapedGameTitle = String(gameTitle || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cleanedTitle = escapedGameTitle
    ? title.replace(new RegExp(`^${escapedGameTitle}\\s*`, "i"), "").trim()
    : title;

  return cleanedTitle || title || modeId;
}

function rotateGames(games, activeGameId) {
  if (games.length <= 1) return games;
  const activeIndex = Math.max(0, games.findIndex((game) => game.id === activeGameId));
  if (games.length === 2) return [games[activeIndex], games[(activeIndex + 1) % games.length]];
  return [
    games[(activeIndex - 1 + games.length) % games.length],
    games[activeIndex],
    games[(activeIndex + 1) % games.length]
  ];
}

export function ModeDescriptionDialog({ mode, gameTitle, onClose }) {
  const { t } = useTranslation();
  if (!mode) return null;

  const modeLabel = getModeLabel(mode, gameTitle || mode.gameTitle);
  const description = String(mode.description || mode.shortExplanation || "").trim();
  const isStandardGlitch = String(mode.id || "").toLowerCase() === "standard";
  const displayTitle = isStandardGlitch ? (gameTitle || mode.gameTitle || modeLabel) : modeLabel;
  const displayLabel = isStandardGlitch ? modeLabel : (gameTitle || mode.gameTitle || t("modeSelector.gameModeLabel"));

  return (
    <div className="mode-description-backdrop" onClick={onClose}>
      <div className="mode-description-dialog" role="dialog" aria-modal="true" aria-labelledby="mode-description-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="mode-description-close" aria-label={t("modeSelector.closeDescription")} onClick={onClose}>
          <span aria-hidden="true" />
        </button>
        <h2 id="mode-description-title">{displayTitle}</h2>
        <p>{displayLabel}</p>
        <div className="mode-description-body">
          {isStandardGlitch ? (
            <>
              <p>{t("modeSelector.standardGlitch.line1")}</p>
              <p>{t("modeSelector.standardGlitch.line2")}</p>
              <p>{t("modeSelector.standardGlitch.line3Prefix")} <strong>{t("modeSelector.standardGlitch.line3Strong")}</strong></p>
              <div className="mode-description-choice-row" aria-hidden="true">
                <span className="mode-description-choice sync">
                  <strong>SYNC</strong>
                  <small>{t("modeSelector.standardGlitch.syncHelp")}</small>
                </span>
                <span className="mode-description-choice glitch">
                  <strong>GLiTCH!</strong>
                  <small>{t("modeSelector.standardGlitch.glitchHelp")}</small>
                </span>
              </div>
              <p>{t("modeSelector.standardGlitch.line4Prefix")} <strong>{t("modeSelector.standardGlitch.line4Strong")}</strong></p>
            </>
          ) : (
            description || t("modeSelector.modeDetailsUnavailable")
          )}
        </div>
        {isStandardGlitch ? (
          <button type="button" className="mode-description-got-it" onClick={onClose}>
            {t("modeSelector.gotIt")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function GameModeSelector({
  modes = FALLBACK_MODES,
  selectedModeId = "standard",
  onSelectMode,
  canSelectMode = true,
  className = "",
  showDescriptions = true,
  label = "EXPERIENCE"
}) {
  const { t } = useTranslation();
  const normalizedModes = useMemo(() => {
    const sourceModes = Array.isArray(modes) && modes.length ? modes : FALLBACK_MODES;
    return sourceModes.map(normalizeMode).filter((mode) => mode.id);
  }, [modes]);
  const selectedMode = normalizedModes.find((mode) => mode.id === selectedModeId) || normalizedModes[0] || FALLBACK_MODES[0];
  const [descriptionMode, setDescriptionMode] = useState(null);

  const games = useMemo(() => {
    const discoveredGames = new Map(DEFAULT_GAME_OPTIONS.map((game) => [game.id, { ...game, hasModes: false }]));
    normalizedModes.forEach((mode) => {
      const current = discoveredGames.get(mode.gameKey);
      const modeDescription = mode.id === "standard" ? (mode.shortExplanation || mode.description) : "";
      discoveredGames.set(mode.gameKey, {
        ...(current || {}),
        id: mode.gameKey,
        title: mode.gameTitle,
        description: modeDescription || current?.description || "",
        hasModes: true
      });
    });
    return Array.from(discoveredGames.values());
  }, [normalizedModes]);

  const activeGame = games.find((game) => game.id === selectedMode?.gameKey) || games[0];
  const modesForGame = normalizedModes.filter((mode) => mode.gameKey === activeGame.id);
  const activeMode = modesForGame.find((mode) => mode.id === selectedModeId) || modesForGame[0] || selectedMode;
  const visibleGames = rotateGames(games, activeGame.id);

  const handleSelectGame = (game) => {
    if (!game.hasModes || game.id === activeGame.id) return;
    const nextMode = normalizedModes.find((mode) => mode.gameKey === game.id && !mode.disabled)
      || normalizedModes.find((mode) => mode.gameKey === game.id);
    if (nextMode) onSelectMode?.(nextMode.id);
  };

  return (
    <div className={`game-mode-panel ${className}`.trim()}>
      {label ? (
        <div className="game-mode-header">
          <span>{label}</span>
        </div>
      ) : null}

      <div className="game-mode-window">
        <div className="game-mode-carousel" aria-label={t("modeSelector.gamesAriaLabel")}>
          {visibleGames.map((game) => {
            const isActive = game.id === activeGame.id;
            const Tag = game.hasModes && !isActive ? "button" : "div";
            return (
              <Tag
                key={game.id}
                type={Tag === "button" ? "button" : undefined}
                className={`game-mode-game-card${isActive ? " active" : ""}${game.hasModes ? "" : " locked"}`}
                aria-current={isActive ? "true" : undefined}
                aria-disabled={!game.hasModes || undefined}
                onClick={Tag === "button" ? () => handleSelectGame(game) : undefined}
              >
                {game.title}
              </Tag>
            );
          })}
        </div>
      </div>

      <p className="game-mode-summary">{activeGame.description || activeMode?.shortExplanation || activeMode?.description || ""}</p>

      <div className="game-mode-dots" aria-hidden="true">
        {games.map((game) => (
          <span key={game.id} className={game.id === activeGame.id ? "active" : undefined} />
        ))}
      </div>

      <div className="game-mode-tabs" role="group" aria-label={t("modeSelector.gameModesAriaLabel", { game: activeGame.title })}>
        {modesForGame.map((mode) => {
          const isActive = mode.id === activeMode.id;
          const modeLabel = getModeLabel(mode, activeGame.title);
          const isLocked = Boolean(mode.disabled);
          const isDisabled = !canSelectMode || isLocked;

          return (
            <div key={mode.id} className={`game-mode-tab${isActive ? " active" : ""}${isDisabled ? " disabled" : ""}${isLocked ? " locked" : ""}`}>
              <button
                type="button"
                className="game-mode-select"
                aria-pressed={isActive}
                disabled={isDisabled}
                onClick={() => {
                  if (mode.id === selectedModeId) return;
                  onSelectMode?.(mode.id);
                }}
              >
                {isLocked ? <img className="game-mode-lock-icon" src={lockIcon} alt="" aria-hidden="true" /> : null}
                <span>{modeLabel}</span>
              </button>
              {showDescriptions ? (
                <button
                  type="button"
                  className="game-mode-help"
                  aria-label={t("modeSelector.aboutMode", { mode: modeLabel })}
                  onClick={() => setDescriptionMode(mode)}
                >
                  <img src={questionIcon} alt="" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <ModeDescriptionDialog
        mode={descriptionMode}
        gameTitle={activeGame.title}
        onClose={() => setDescriptionMode(null)}
      />
    </div>
  );
}

export default GameModeSelector;
