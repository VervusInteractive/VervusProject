import { useEffect, useMemo, useState } from "react";
import GameModeSelector, { ModeDescriptionDialog } from "./GameModeSelector.jsx";
import ModeDebugOverlay from "./ModeDebugOverlay";
import { CONNECTION_STATES, getConnectionStateLabel } from "../connectionState";
import { DEFAULT_LOBBY_CONTENT } from "../storyblok/lobbyContent.js";
import clearBackgroundLogo from "../assets/images/Logos/Logo_ClearBackground.svg";
import copyButtonImage from "../assets/images/Buttons/Button_Copy.png";
import sendButtonImage from "../assets/images/Buttons/Button_Send.png";
import discordIcon from "../assets/images/SocialIcons/SocialIcon_Discord.png";
import instagramIcon from "../assets/images/SocialIcons/SocialIcon_Instagram.png";
import tiktokIcon from "../assets/images/SocialIcons/SocialIcon_TikTok.png";
import xIcon from "../assets/images/SocialIcons/SocialIcon_x.png";
import cardIcon from "../assets/images/VervusIcons/Icons_Card.png";
import failIcon from "../assets/images/VervusIcons/Icons_Fail.png";
import { getPlayerIcon } from "../playerIcons";

const ROOM_SOCIAL_LINKS = Object.freeze([
  { label: "TikTok", href: "https://www.tiktok.com", icon: tiktokIcon },
  { label: "Discord", href: "https://discord.com", icon: discordIcon },
  { label: "Instagram", href: "https://www.instagram.com", icon: instagramIcon },
  { label: "X", href: "https://x.com/PlayVervus", icon: xIcon }
]);

const renderTemplate = (template, values) => String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (
  values[key] ?? match
));

const REMOVED_PLAYER_STATUSES = new Set(["removed", "removed_from_room", "kicked"]);

function RoomPage({
  roomId,
  playerId,
  players = [],
  minPlayers = 2,
  maxPlayers = 4,
  phase,
  roomStatus = phase,
  serverNow,
  pingMs,
  timeSyncStatus = null,
  waitingForNextGame = false,
  colors = [],
  onSetColor,
  onSetReady,
  onExit,
  connectionState = CONNECTION_STATES.CONNECTING,
  onUiButtonClick,
  onSelectionChanged,
  canManageReady = false,
  canOpenStore = false,
  isPreviewRoom = false,
  previewComboLimit = null,
  onOpenStore,
  hostUnlockingPending = false,
  hostUnlockingFailed = false,
  selectedModeId = "standard",
  availableModes = [],
  canSelectMode = false,
  entitlementExpiresAtMs = null,
  entitledModeKeys = [],
  entitledModeExpiriesMs = {},
  onSetMode,
  onKickPlayer,
  modeDebugConfigs = [],
  roomContent = DEFAULT_LOBBY_CONTENT.room
}) {
  const [showQrCode, setShowQrCode] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [descriptionMode, setDescriptionMode] = useState(null);
  const [leaveConfirmation, setLeaveConfirmation] = useState(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const content = {
    ...DEFAULT_LOBBY_CONTENT.room,
    ...roomContent,
    editableAttributes: roomContent?.editableAttributes || DEFAULT_LOBBY_CONTENT.room.editableAttributes
  };
  const currentPlayer = useMemo(
    () => players.find((player) => player.playerId === playerId),
    [players, playerId]
  );

  const clientUrl = import.meta.env.VITE_CLIENT_URL || window.location.origin;
  const roomInviteUrl = `${clientUrl}/?room=${encodeURIComponent(roomId)}`;
  const roomInviteQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&color=111827&bgcolor=FFFFFF&data=${encodeURIComponent(roomInviteUrl)}`;
  const hostPlayer = players.find((player) => player.isHost) || players[0] || null;
  const hostDisplayName = hostPlayer?.name || content.fallbackHostName;
  const isHost = Boolean(currentPlayer?.isHost);
  const connectedPlayers = players.filter((player) => player.connected);
  const readyCount = players.filter((player) => player.ready).length;
  const connectedReadyCount = connectedPlayers.filter((player) => player.ready).length;
  const selectedMode = useMemo(() => {
    const debugMode = modeDebugConfigs.find((mode) => mode.id === selectedModeId) || null;
    const availableMode = availableModes.find((mode) => mode.id === selectedModeId) || null;
    if (!debugMode) return availableMode;
    if (!availableMode) return debugMode;
    return {
      ...availableMode,
      ...debugMode,
      description: availableMode.description || debugMode.description,
      shortExplanation: availableMode.shortExplanation || debugMode.shortExplanation,
      orientationLock: availableMode.orientationLock || debugMode.orientationLock || "both"
    };
  }, [modeDebugConfigs, availableModes, selectedModeId]);

  const formatRemainingTime = (remainingMs) => {
    if (remainingMs <= 0) return "Expired";
    const totalMinutes = Math.floor(remainingMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m left`;
    return `${hours}h ${minutes}m left`;
  };

  const selectedModeOrientationLock = (selectedMode?.orientationLock || "both").toLowerCase();
  const [deviceOrientation, setDeviceOrientation] = useState("unknown");
  const isMobileDevice = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTimeMs(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

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

  useEffect(() => {
    if (!copyStatus) return undefined;
    const timeoutId = window.setTimeout(() => setCopyStatus(""), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  const isWrongOrientation = isMobileDevice && selectedModeOrientationLock !== "both" && selectedModeOrientationLock !== deviceOrientation;
  const showHostPurchasePending = !isHost && hostUnlockingPending;
  const showHostPurchaseFailed = !isHost && hostUnlockingFailed && !hostUnlockingPending;
  const roomStatusLabels = {
    lobby: content.statusLabelLobby,
    preview: content.statusLabelPreview,
    payment_pending: content.statusLabelPaymentPending,
    premium: content.statusLabelPremium,
    reconnecting: content.statusLabelReconnecting,
    ended: content.statusLabelEnded,
    expired: content.statusLabelExpired
  };
  const roomStatusLabel = roomStatusLabels[roomStatus] || roomStatus;
  const canShowDebug = modeDebugConfigs.length > 0
    && new URLSearchParams(window.location.search).get("modeDebug") === "1";
  const formattedRoomCode = String(roomId || "").match(/.{1,2}/g)?.join(" · ") || roomId;
  const selectedModeTitle = selectedMode?.title || "GLiTCH!";
  const selectedModeLabel = selectedModeTitle.toLowerCase().startsWith("glitch") ? "GLiTCH!" : selectedModeTitle;
  const selectedModeVariant = selectedModeId === "standard"
    ? "Standard"
    : (selectedModeTitle.replace(/^GLiTCH!\s*/i, "").trim() || selectedModeId);
  const isSelectedModePreview = isPreviewRoom || !hostPlayer?.hasEntitlement;
  const hostStartLabel = isSelectedModePreview ? content.hostStartPreviewLabel : content.hostStartGameLabel;
  const canHostStart = canManageReady
    && isHost
    && !currentPlayer?.ready
    && !hostUnlockingPending
    && connectedPlayers.length >= minPlayers
    && (phase === "lobby" || (phase === "play" && currentPlayer?.game?.status === "gameover"));

  const modeOptions = (availableModes || []).map((mode) => {
    const ownsMode = (entitledModeKeys || []).includes(mode.id);
    const modeExpiryMs = entitledModeExpiriesMs?.[mode.id] ?? entitlementExpiresAtMs;
    const hasTimedEntitlement = typeof modeExpiryMs === "number";
    const remainingMs = hasTimedEntitlement ? (modeExpiryMs - currentTimeMs) : null;
    const hasActiveEntitlement = ownsMode && (!hasTimedEntitlement || remainingMs > 0);
    const entitlementStatus = hasActiveEntitlement
      ? (hasTimedEntitlement ? formatRemainingTime(remainingMs) : "Owned")
      : (mode.id === "standard" ? "Preview" : "Purchase Mode");
    return {
      ...mode,
      disabled: mode.id !== "standard" && !hasActiveEntitlement,
      label: `${mode.title} - ${entitlementStatus}`
    };
  });
  const visibleModeOptions = modeOptions.length
    ? modeOptions
    : [{ id: selectedModeId, title: selectedModeTitle, disabled: false, label: selectedModeTitle }];

  const copyInviteWithFallback = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(roomInviteUrl);
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = roomInviteUrl;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  };

  const handleCopyInvite = async () => {
    onUiButtonClick?.();
    try {
      await copyInviteWithFallback();
      setCopyStatus(content.copySuccessLabel);
    } catch {
      setCopyStatus(content.copyErrorLabel);
    }
  };

  const handleReadyToggle = () => {
    onUiButtonClick?.();
    onSetReady(!currentPlayer?.ready);
  };

  const handleHostStart = () => {
    if (!canHostStart) return;
    onUiButtonClick?.();
    onSetReady(true);
  };

  const handlePlayerRemove = (targetPlayer) => {
    onUiButtonClick?.();
    if (targetPlayer.playerId === playerId) {
      setLeaveConfirmation(targetPlayer.isHost ? "host" : "player");
      return;
    }
    onKickPlayer?.(targetPlayer.playerId);
  };

  const handleConfirmLeave = () => {
    onUiButtonClick?.();
    setLeaveConfirmation(null);
    onExit();
  };

  const handleCancelLeave = () => {
    onUiButtonClick?.();
    setLeaveConfirmation(null);
  };

  const handleCycleColor = () => {
    if (!canManageReady || phase !== "lobby" || !currentPlayer) return;
    const availableColors = colors.filter((color) => (
      color === currentPlayer.color
      || !players.some((player) => player.playerId !== playerId && player.color === color)
    ));
    if (availableColors.length <= 1) return;

    const currentIndex = availableColors.indexOf(currentPlayer.color);
    const nextColor = availableColors[(currentIndex + 1) % availableColors.length];
    onUiButtonClick?.();
    onSetColor(nextColor);
  };

  const renderModeIcon = (className = "") => (
    <span className={`room-mode-icon ${className}`} aria-hidden="true">
      <span />
    </span>
  );

  const renderPlayerAvatar = (player) => {
    const isCurrentPlayer = player.playerId === playerId;
    const avatarStyle = { "--player-color": player.color || "#8d5cff" };
    const avatar = (
      <span className="room-player-avatar" style={avatarStyle} aria-hidden="true">
        <img src={getPlayerIcon(player.color)} alt="" />
      </span>
    );

    if (!isCurrentPlayer || !canManageReady || phase !== "lobby") return avatar;

    return (
      <button
        type="button"
        className="room-player-avatar-button"
        title={content.changeColorLabel}
        aria-label={content.changeColorLabel}
        onClick={handleCycleColor}
      >
        {avatar}
      </button>
    );
  };

  const getPlayerStatusPill = (player, isActivelyInGame) => {
    const explicitStatus = String(player.roomStatus || player.status || player.statusKey || "").toLowerCase();
    const connectionState = String(player.connectionState || (player.connected ? "connected" : "disconnected")).toLowerCase();
    const usesReadyStatus = phase === "lobby"
      || player.waitingForNextGame
      || player.game?.status === "gameover";

    if (player.removedFromRoom || player.wasRemoved || REMOVED_PLAYER_STATUSES.has(explicitStatus)) {
      return {
        className: "removed",
        label: content.playerRemovedLabel
      };
    }

    if (player.unlockingInProgress) {
      return {
        className: "transferring-host",
        label: content.playerTransferringHostLabel,
        showSpinner: true
      };
    }

    if (connectionState === "reconnecting" || connectionState === "connecting") {
      return {
        className: player.isHost ? "host-reconnecting" : "reconnecting",
        label: player.isHost ? content.playerHostReconnectingLabel : content.playerReconnectingLabel,
        showSpinner: true
      };
    }

    if (connectionState === "disconnected") {
      return {
        className: "disconnected",
        label: content.playerDisconnectedLabel
      };
    }

    if (isActivelyInGame) {
      return {
        className: "ready",
        label: content.playerInGameLabel
      };
    }

    if (usesReadyStatus) {
      return player.ready
        ? { className: "ready", label: content.playerReadyLabel }
        : { className: "waiting", label: content.playerWaitingLabel, showSpinner: true };
    }

    return {
      className: "connected",
      label: content.playerConnectedLabel
    };
  };

  const renderReadyPill = (player) => {
    const isWaitingForNextGame = Boolean(player.waitingForNextGame);
    const isActivelyInGame = phase === "play"
      && player.game?.status === "active"
      && Boolean(player.currentGameParticipant)
      && !isWaitingForNextGame;
    const statusPill = getPlayerStatusPill(player, isActivelyInGame);

    return (
      <span className={`room-ready-pill ${statusPill.className}`}>
        {statusPill.showSpinner ? <span className="room-waiting-spinner" aria-hidden="true" /> : null}
        {statusPill.label}
      </span>
    );
  };

  const renderPlayerRow = (player) => {
    const isCurrentPlayer = player.playerId === playerId;
    const canRemovePlayer = isHost || isCurrentPlayer;
    const removeLabel = isCurrentPlayer
      ? content.leaveRoomLabel
      : renderTemplate(content.removePlayerTemplate, { player: player.name });

    return (
      <li key={player.playerId} className={`room-player-row${isCurrentPlayer ? " current" : ""}`}>
        {renderPlayerAvatar(player)}
        <div className="room-player-copy">
          <strong>{isCurrentPlayer ? content.currentPlayerLabel : player.name}</strong>
          {player.isHost && !isCurrentPlayer ? <span>{content.playerHostLabel}</span> : null}
        </div>
        <div className="room-player-actions">
          {renderReadyPill(player)}
          {canRemovePlayer ? (
            <button
              type="button"
              className="room-player-remove"
              aria-label={removeLabel}
              title={removeLabel}
              onClick={() => handlePlayerRemove(player)}
            >
              <span aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  const renderPlayersPanel = (variant) => (
    <section className={`room-card room-players-card ${variant}`}>
      <div className="room-card-header">
        <span>{variant === "host" ? content.playersLabel : formattedRoomCode}</span>
        <strong>{variant === "host" ? `${readyCount} / ${maxPlayers} ${content.readyCountLabel}` : `${players.length} / ${maxPlayers} ${content.joinedCountLabel}`}</strong>
      </div>
      <ul className="room-player-list">
        {players.map(renderPlayerRow)}
      </ul>
    </section>
  );

  const renderPreviewCard = () => (
    <section className="room-card room-preview-card">
      <div className="room-preview-kicker">
        {renderModeIcon()}
        <span>
          {isSelectedModePreview ? content.previewLabel : content.experienceLabel}{" "}
          {renderTemplate(content.selectedByTemplate, { host: hostDisplayName })}
        </span>
      </div>
      <div className="room-selected-mode">
        <div>
          <strong>{selectedModeLabel}</strong>
          <span>{selectedModeVariant}</span>
        </div>
        <button
          type="button"
          className="room-help-button"
          aria-label={content.aboutExperienceLabel}
          onClick={() => {
            onUiButtonClick?.();
            setDescriptionMode(selectedMode);
          }}
        >
          ?
        </button>
      </div>
    </section>
  );

  const renderHostPurchasePendingCard = () => (
    <section className="room-host-purchase-card room-host-purchase-card-pending" role="status" aria-live="polite">
      <img className="room-host-purchase-icon" src={cardIcon} alt="" aria-hidden="true" />
      <div className="room-host-purchase-copy">
        <h2>{hostDisplayName} is unlocking Vervus.</h2>
        <p>Room stays open while they pay. You'll be playing in a moment - stay here.</p>
      </div>
      <div className="room-host-purchase-progress-card">
        <div className="room-host-purchase-progress-header">
          <span>Payment in progress</span>
          <strong>Processing</strong>
        </div>
        <div className="room-host-purchase-progress" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
    </section>
  );

  const renderHostPurchaseFailedCard = () => (
    <section className="room-host-purchase-failed-card" role="status" aria-live="polite">
      <div className="room-host-purchase-failed-status">
        <span aria-hidden="true" />
        <strong>Waiting for {hostDisplayName}</strong>
      </div>
      <p>{hostDisplayName} can retry the payment or start a free preview.</p>
    </section>
  );

  const renderHostPurchaseFailedHero = () => (
    <section className="room-host-purchase-failed-hero">
      <img className="room-host-purchase-face" src={failIcon} alt="" aria-hidden="true" />
      <div className="room-host-purchase-copy">
        <h2>{hostDisplayName} came back.</h2>
        <p>Looks like the payment didn't go through. {hostDisplayName} might try again.</p>
      </div>
    </section>
  );

  const renderExperiencePanel = () => (
    <section className="room-experience-card">
      <GameModeSelector
        modes={visibleModeOptions}
        selectedModeId={selectedModeId}
        canSelectMode={canSelectMode}
        label={content.experienceLabel}
        onSelectMode={(modeId) => {
          if (modeId === selectedModeId) return;
          onSelectionChanged?.();
          onSetMode?.(modeId);
        }}
        className="room"
      />
      {canOpenStore ? (
        <button type="button" className="room-unlock-button" onClick={() => { onUiButtonClick?.(); onOpenStore?.(); }}>
          {content.unlockButtonLabel}
        </button>
      ) : null}
      {!canSelectMode && !canOpenStore ? <span className="room-mode-note">{content.modeNote}</span> : null}
    </section>
  );

  const renderQrModal = () => (showQrCode ? (
    <div className="qr-modal-backdrop" onClick={() => { onUiButtonClick?.(); setShowQrCode(false); }}>
      <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
        <h2 className="qr-modal-title">{renderTemplate(content.qrModalTitleTemplate, { room: roomId })}</h2>
        <img className="qr-image" src={roomInviteQrUrl} alt={`QR code to join room ${roomId}`} />
        <p className="qr-link">{roomInviteUrl}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { onUiButtonClick?.(); setShowQrCode(false); }}
        >
          {content.qrModalCloseLabel}
        </button>
      </div>
    </div>
  ) : null);

  const renderLeaveConfirmation = () => {
    if (!leaveConfirmation) return null;

    const isHostLeaving = leaveConfirmation === "host";

    return (
      <div
        className="leave-room-overlay"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-room-title"
        aria-describedby="leave-room-description"
      >
        <div className="leave-room-card">
          <span className="leave-room-side-glow" aria-hidden="true" />
          <span className="leave-room-center-glow" aria-hidden="true" />
          <div className="leave-room-content">
            <h2 id="leave-room-title">Leave room?</h2>
            <p id="leave-room-description">
              {isHostLeaving
                ? "You're the host. If you leave, the room will close for everyone."
                : "You'll leave this room. The host and other players can keep going."}
            </p>
          </div>
          <div className="leave-room-actions">
            <button type="button" className="leave-room-stay-button" onClick={handleCancelLeave}>
              Stay in the room
            </button>
            <button type="button" className="leave-room-leave-button" onClick={handleConfirmLeave}>
              Leave room
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className={`room-lobby-page ${isHost ? "room-lobby-page-host" : "room-lobby-page-join"}${showHostPurchasePending ? " room-lobby-page-host-purchase-pending" : ""}${showHostPurchaseFailed ? " room-lobby-page-host-purchase-failed" : ""}`} {...content.editableAttributes}>
      {isWrongOrientation ? (
        <div className="orientation-warning-overlay" role="alert">
          <div className="orientation-warning-card">
            Wrong orientation. Please rotate to <strong>{selectedModeOrientationLock}</strong>.
          </div>
        </div>
      ) : null}
      {canShowDebug ? (
        <button type="button" className="btn btn-secondary debug-button" onClick={() => { onUiButtonClick?.(); setShowDebug(true); }}>Debug</button>
      ) : null}
      {canShowDebug && showDebug ? <ModeDebugOverlay mode={selectedMode} heatSurgeConfig={selectedMode?.heatSurgeConfig} onClose={() => { onUiButtonClick?.(); setShowDebug(false); }} /> : null}

      <div className="room-lobby-brand" aria-label="Vervus">
        <img src={clearBackgroundLogo} alt="Vervus" />
      </div>

      <header className="room-desktop-header" aria-label="Room navigation">
        <div className="room-desktop-brand" aria-label="Vervus">
          <img src={clearBackgroundLogo} alt="Vervus" />
        </div>
        <nav className="room-desktop-nav" aria-label="Vervus sections">
          <span>How Vervus works</span>
          <span>Experiences</span>
          <span>Unlock</span>
          <span>FAQ</span>
        </nav>
        <span className="room-desktop-host-pill">Host a room</span>
      </header>

      {connectionState !== CONNECTION_STATES.CONNECTED ? (
        <div className={`connection-banner ${connectionState}`} role="status" aria-live="polite">
          <strong>Connection:</strong> {getConnectionStateLabel(connectionState)}
          {connectionState === CONNECTION_STATES.RECONNECTING ? " - trying to restore your room session." : null}
          {connectionState === CONNECTION_STATES.DEGRADED ? " - high latency detected; effects may feel lighter." : null}
          {connectionState === CONNECTION_STATES.DISCONNECTED ? " - connection lost. Keep this tab open while we retry." : null}
        </div>
      ) : null}

      {isHost ? (
        <>
          <div className="room-host-hero">
            <span className="room-status-chip"><span aria-hidden="true" />{roomStatusLabel === content.statusLabelLobby ? content.statusActiveLabel : roomStatusLabel}</span>
            <h1><span>{content.hostHeadlinePrimary}</span><span>{content.hostHeadlineSecondary}</span></h1>
          </div>

          <div className="room-host-content-grid">
            <section className="room-card room-invite-card">
              <div className="room-invite-code-row">
                <strong>{formattedRoomCode}</strong>
                <button
                  type="button"
                  className="room-icon-button"
                  aria-label={content.qrOpenLabel}
                  onClick={() => { onUiButtonClick?.(); setShowQrCode(true); }}
                >
                  <img src={copyButtonImage} alt="" aria-hidden="true" />
                </button>
              </div>
              <div className="room-qr-frame">
                <img src={roomInviteQrUrl} alt={`QR code to join room ${roomId}`} />
              </div>
              <span className="room-share-label">{content.inviteShareLabel}</span>
              <button type="button" className="room-copy-button" onClick={handleCopyInvite}>
                <img src={sendButtonImage} alt="" aria-hidden="true" />
                {copyStatus || content.copyInviteLabel}
              </button>
            </section>

            {renderPlayersPanel("host")}
            {renderExperiencePanel()}
          </div>
        </>
      ) : (
        <>
          {showHostPurchasePending ? renderHostPurchasePendingCard() : null}
          {showHostPurchaseFailed ? renderHostPurchaseFailedHero() : null}
          {!showHostPurchasePending && !showHostPurchaseFailed ? (
            <>
              <div className="room-join-hero">
                <span className="room-status-chip"><span aria-hidden="true" />{content.joinStatusPrefix} {roomId}</span>
                <h1>{content.joinHeadline}</h1>
                <p>{renderTemplate(content.joinDescriptionTemplate, { host: hostDisplayName })}</p>
              </div>
              {renderPreviewCard()}
            </>
          ) : null}

          {renderPlayersPanel("join")}
          {showHostPurchaseFailed ? renderHostPurchaseFailedCard() : null}
        </>
      )}

      {waitingForNextGame ? (
        <p className="room-waiting-note">
          {content.waitingForNextGameNote}
        </p>
      ) : null}

      {isHost ? (
        <button
          type="button"
          className="room-bottom-action"
          disabled={!canHostStart}
          data-desktop-disabled-reason={!canHostStart ? "Play on your phone to start" : undefined}
          onClick={handleHostStart}
        >
          {hostStartLabel}
        </button>
      ) : (
        canManageReady && !showHostPurchasePending ? (
          <button
            type="button"
            className="room-bottom-action"
            onClick={handleReadyToggle}
          >
            {currentPlayer?.ready ? content.notReadyButtonLabel : content.readyButtonLabel}
          </button>
        ) : null
      )}

      {!isHost ? (
        <footer className="room-desktop-footer">
          <div className="room-desktop-socials" aria-label="Vervus social links">
            {ROOM_SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                aria-label={link.label}
              >
                <img src={link.icon} alt="" aria-hidden="true" />
              </a>
            ))}
          </div>
          <nav className="room-desktop-footer-nav" aria-label="Vervus legal pages">
            <span>Terms of Service</span>
            <span>Privacy Policy</span>
            <span>Contact</span>
          </nav>
          <p>&copy; 2026 Vervus Interactive. Built for chaos.</p>
        </footer>
      ) : null}

      <div className="room-technical-meta" aria-label="Room diagnostics">
        <span>Phase: {phase}</span>
        <span>Ping: {pingMs === null ? "-" : `${pingMs} ms`}</span>
        <span>Sync: {timeSyncStatus?.quality || "syncing"}</span>
        <span>Server: {serverNow ? new Date(serverNow).toLocaleTimeString() : "-"}</span>
        <span>Ready: {connectedReadyCount}/{connectedPlayers.length}</span>
        <span>Preview: {isPreviewRoom ? `combo ${previewComboLimit ?? "X"}` : "off"}</span>
      </div>

      {renderQrModal()}
      {renderLeaveConfirmation()}
      <ModeDescriptionDialog
        mode={descriptionMode}
        gameTitle={selectedMode?.gameTitle || "GLiTCH!"}
        onClose={() => setDescriptionMode(null)}
      />
    </section>
  );
}

export default RoomPage;
