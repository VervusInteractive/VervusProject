import { useEffect, useMemo, useState } from "react";
import ModeDebugOverlay from "./ModeDebugOverlay";
import { CONNECTION_STATES, getConnectionStateLabel } from "../connectionState";
import clearBackgroundLogo from "../assets/images/Logos/Logo_ClearBackground.svg";

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
  canManageReady = false,
  canOpenStore = false,
  isPreviewRoom = false,
  previewComboLimit = null,
  onOpenStore,
  hostUnlockingPending = false,
  unlockingProductName = null,
  selectedModeId = "standard",
  availableModes = [],
  canSelectMode = false,
  entitlementExpiresAtMs = null,
  entitledModeKeys = [],
  entitledModeExpiriesMs = {},
  onSetMode,
  onKickPlayer,
  modeDebugConfigs = []
}) {
  const [showQrCode, setShowQrCode] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const currentPlayer = useMemo(
    () => players.find((player) => player.playerId === playerId),
    [players, playerId]
  );

  const clientUrl = import.meta.env.VITE_CLIENT_URL || window.location.origin;
  const roomInviteUrl = `${clientUrl}/?room=${encodeURIComponent(roomId)}`;
  const roomInviteQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=9F4DFF&bgcolor=FFFFFF&data=${encodeURIComponent(roomInviteUrl)}`;
  const hostPlayer = players.find((player) => player.isHost) || players[0] || null;
  const isHost = Boolean(currentPlayer?.isHost);
  const connectedPlayers = players.filter((player) => player.connected);
  const readyCount = players.filter((player) => player.ready).length;
  const connectedReadyCount = connectedPlayers.filter((player) => player.ready).length;
  const selectedMode = useMemo(() => {
    const debugMode = modeDebugConfigs.find((mode) => mode.id === selectedModeId) || null;
    const availableMode = availableModes.find((mode) => mode.id === selectedModeId) || null;
    if (!debugMode) return availableMode;
    if (!availableMode) return debugMode;
    return { ...debugMode, orientationLock: availableMode.orientationLock || debugMode.orientationLock || "both" };
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
  const unlockingProductLabel = unlockingProductName || "selected product";
  const roomStatusLabels = {
    lobby: "Lobby",
    preview: "Preview",
    payment_pending: "Payment pending",
    premium: "Premium",
    reconnecting: "Reconnecting",
    ended: "Ended",
    expired: "Expired"
  };
  const roomStatusLabel = roomStatusLabels[roomStatus] || roomStatus;
  const canShowDebug = modeDebugConfigs.length > 0
    && new URLSearchParams(window.location.search).get("modeDebug") === "1";
  const formattedRoomCode = String(roomId || "").match(/.{1,2}/g)?.join(" - ") || roomId;
  const selectedModeTitle = selectedMode?.title || "GLiTCH!";
  const selectedModeLabel = selectedModeTitle.toLowerCase().startsWith("glitch") ? "GLiTCH!" : selectedModeTitle;
  const selectedModeVariant = selectedModeId === "standard"
    ? "Standard"
    : (selectedModeTitle.replace(/^GLiTCH!\s*/i, "").trim() || selectedModeId);
  const isSelectedModePreview = isPreviewRoom || !hostPlayer?.hasEntitlement;
  const hostStartLabel = isSelectedModePreview ? "Start free preview" : "Start game";
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
      disabled: canSelectMode && !hasActiveEntitlement,
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
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
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
      onExit();
      return;
    }
    onKickPlayer?.(targetPlayer.playerId);
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
        <span />
      </span>
    );

    if (!isCurrentPlayer || !canManageReady || phase !== "lobby") return avatar;

    return (
      <button
        type="button"
        className="room-player-avatar-button"
        title="Change color"
        aria-label="Change your player color"
        onClick={handleCycleColor}
      >
        {avatar}
      </button>
    );
  };

  const renderReadyPill = (player) => {
    const isWaitingForNextGame = Boolean(player.waitingForNextGame);
    const isActivelyInGame = phase === "play"
      && player.game?.status === "active"
      && Boolean(player.currentGameParticipant)
      && !isWaitingForNextGame;
    const label = isActivelyInGame ? "In Game" : (player.ready ? "Ready" : "Waiting...");
    const className = isActivelyInGame || player.ready ? "ready" : "waiting";

    return (
      <span className={`room-ready-pill ${className}`}>
        {!player.ready && !isActivelyInGame ? <span className="room-waiting-spinner" aria-hidden="true" /> : null}
        {label}
      </span>
    );
  };

  const renderPlayerRow = (player) => {
    const isCurrentPlayer = player.playerId === playerId;
    const canRemovePlayer = isHost || isCurrentPlayer;
    const removeLabel = isCurrentPlayer ? "Leave room" : `Remove ${player.name}`;

    return (
      <li key={player.playerId} className={`room-player-row${isCurrentPlayer ? " current" : ""}`}>
        {renderPlayerAvatar(player)}
        <div className="room-player-copy">
          <strong>{isCurrentPlayer ? "You" : player.name}</strong>
          {player.isHost && !isCurrentPlayer ? <span>Host</span> : null}
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
        <span>{variant === "host" ? "Players" : formattedRoomCode}</span>
        <strong>{variant === "host" ? `${readyCount} / ${maxPlayers} Ready` : `${players.length} / ${maxPlayers} joined`}</strong>
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
        <span>{isSelectedModePreview ? "Free preview" : "Experience"} selected by {hostPlayer?.name || "Host"}</span>
      </div>
      <div className="room-selected-mode">
        <div>
          <strong>{selectedModeLabel}</strong>
          <span>{selectedModeVariant}</span>
        </div>
        <button type="button" className="room-help-button" aria-label="About this experience">?</button>
      </div>
    </section>
  );

  const renderExperiencePanel = () => (
    <section className="room-card room-experience-card">
      <div className="room-card-header">
        <span>Experience</span>
      </div>
      <div className="room-mode-carousel" aria-hidden="true">
        <div className="room-mode-side-card">{visibleModeOptions[1]?.title || "Blitz"}</div>
        <div className="room-mode-main-card">
          <strong>{selectedModeLabel}</strong>
        </div>
        <div className="room-mode-side-card">{visibleModeOptions[2]?.title || "Chaos"}</div>
      </div>
      <div className="room-carousel-dots" aria-hidden="true">
        <span className="active" />
        <span />
      </div>
      <div className="room-mode-tabs" role="group" aria-label="Choose experience">
        {visibleModeOptions.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={mode.id === selectedModeId ? "active" : ""}
            disabled={!canSelectMode || mode.disabled}
            onClick={() => { onUiButtonClick?.(); onSetMode?.(mode.id); }}
          >
            {mode.id === "standard" ? "Standard" : mode.title.replace(/^GLiTCH!\s*/i, "")}
          </button>
        ))}
      </div>
      {canOpenStore ? (
        <button type="button" className="room-unlock-button" onClick={() => { onUiButtonClick?.(); onOpenStore?.(); }}>
          Unlock Vervus
        </button>
      ) : null}
      {!canSelectMode && !canOpenStore ? <span className="room-mode-note">Preview rooms are locked to GLiTCH!.</span> : null}
    </section>
  );

  const renderQrModal = () => (showQrCode ? (
    <div className="qr-modal-backdrop" onClick={() => { onUiButtonClick?.(); setShowQrCode(false); }}>
      <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
        <h2 className="qr-modal-title">Scan to join room {roomId}</h2>
        <img className="qr-image" src={roomInviteQrUrl} alt={`QR code to join room ${roomId}`} />
        <p className="qr-link">{roomInviteUrl}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { onUiButtonClick?.(); setShowQrCode(false); }}
        >
          Close
        </button>
      </div>
    </div>
  ) : null);

  return (
    <section className={`room-lobby-page ${isHost ? "room-lobby-page-host" : "room-lobby-page-join"}`}>
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
            <span className="room-status-chip">{roomStatusLabel === "Lobby" ? "Room active" : roomStatusLabel}</span>
            <h1><span>Send it.</span><span>Get everyone in.</span></h1>
          </div>

          <section className="room-card room-invite-card">
            <div className="room-invite-code-row">
              <strong>{formattedRoomCode}</strong>
              <button
                type="button"
                className="room-icon-button"
                aria-label="Open QR code"
                onClick={() => { onUiButtonClick?.(); setShowQrCode(true); }}
              >
                <span aria-hidden="true" />
              </button>
            </div>
            <div className="room-qr-frame">
              <img src={roomInviteQrUrl} alt={`QR code to join room ${roomId}`} />
            </div>
            <span className="room-share-label">Share with your group</span>
            <button type="button" className="room-copy-button" onClick={handleCopyInvite}>
              <span aria-hidden="true" />
              {copyStatus || "Copy join link"}
            </button>
          </section>

          {renderPlayersPanel("host")}
          {renderExperiencePanel()}
        </>
      ) : (
        <>
          <div className="room-join-hero">
            <span className="room-status-chip"><span aria-hidden="true" />Room {roomId}</span>
            <h1>Waiting for everyone.</h1>
            <p>{hostPlayer?.name || "The host"} will start once everyone is ready.</p>
          </div>

          {hostUnlockingPending ? (
            <section className="room-card room-preview-card">
              <div className="room-preview-kicker">
                {renderModeIcon()}
                <span>{hostPlayer?.name || "Host"} is unlocking {unlockingProductLabel}</span>
              </div>
              <div className="room-selected-mode">
                <div>
                  <strong>Payment pending</strong>
                  <span>Stay here for the premium game and mode teasers.</span>
                </div>
              </div>
            </section>
          ) : renderPreviewCard()}

          {renderPlayersPanel("join")}
        </>
      )}

      {waitingForNextGame ? (
        <p className="room-waiting-note">
          A game is currently active. You are queued for the next game and can ready up once this round ends.
        </p>
      ) : null}

      {isHost ? (
        <button
          type="button"
          className="room-bottom-action"
          disabled={!canHostStart}
          onClick={handleHostStart}
        >
          {hostStartLabel}
        </button>
      ) : (
        canManageReady ? (
          <button
            type="button"
            className="room-bottom-action"
            disabled={hostUnlockingPending && !currentPlayer?.isHost}
            onClick={handleReadyToggle}
          >
            {currentPlayer?.ready ? "I'm not ready" : "I'm ready"}
          </button>
        ) : null
      )}

      <div className="room-technical-meta" aria-label="Room diagnostics">
        <span>Phase: {phase}</span>
        <span>Ping: {pingMs === null ? "-" : `${pingMs} ms`}</span>
        <span>Sync: {timeSyncStatus?.quality || "syncing"}</span>
        <span>Server: {serverNow ? new Date(serverNow).toLocaleTimeString() : "-"}</span>
        <span>Ready: {connectedReadyCount}/{connectedPlayers.length}</span>
        <span>Preview: {isPreviewRoom ? `combo ${previewComboLimit ?? "X"}` : "off"}</span>
      </div>

      {renderQrModal()}
    </section>
  );
}

export default RoomPage;
