import { useEffect, useMemo, useState } from "react";
import ModeDebugOverlay from "./ModeDebugOverlay";
import { CONNECTION_STATES, getConnectionStateLabel } from "../connectionState";

function RoomPage({
  roomId,
  playerId,
  players,
  phase,
  roomStatus = phase,
  serverNow,
  pingMs,
  waitingForNextGame = false,
  colors,
  onSetColor,
  onSetReady,
  onExit,
  connectionState = CONNECTION_STATES.CONNECTING,
  onUiButtonClick,
  canManageReady = false,
  canOpenStore = false,
  isPreviewRoom = false,
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
  onCreateEntitlementTransfer,
  modeDebugConfigs = []
}) {
  const [showQrCode, setShowQrCode] = useState(false);
  const [transferLink, setTransferLink] = useState(null);
  const [isCreatingTransferLink, setIsCreatingTransferLink] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const currentPlayer = useMemo(
    () => players.find((player) => player.playerId === playerId),
    [players, playerId]
  );
  
  const clientUrl = import.meta.env.VITE_CLIENT_URL || window.location.origin;
  const roomInviteUrl = `${clientUrl}/?room=${encodeURIComponent(roomId)}`;
  const roomInviteQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(roomInviteUrl)}`;
  const entitlementTransferQrUrl = transferLink?.transferUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(transferLink.transferUrl)}`
    : null;
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
  const canShowDebug = modeDebugConfigs.length > 0;

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
      label: `${mode.title} · ${entitlementStatus}`
    };
  });

  const handleCreateEntitlementTransfer = async () => {
    if (!onCreateEntitlementTransfer || isCreatingTransferLink) return;
    setIsCreatingTransferLink(true);
    try {
      const result = await onCreateEntitlementTransfer();
      if (result?.transferUrl) {
        setTransferLink(result);
      }
    } finally {
      setIsCreatingTransferLink(false);
    }
  };

  return (
    <section className="panel">
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
      <div className="room-header">
        <div>
          <h1 className="panel-title">Room {roomId}</h1>
          <p className="panel-subtitle">Players currently in this room.</p>
          <p className="panel-subtitle"><strong>Room status:</strong> {roomStatusLabel}</p>
          {hostUnlockingPending
            ? <p className="panel-subtitle"><strong>Payment pending:</strong> The host is unlocking {unlockingProductLabel}. Stay here for the premium game and mode teasers.</p>
            : (isPreviewRoom ? <p className="panel-subtitle"><strong>Preview:</strong> This room is in 1-minute preview mode.</p> : null)}
          <div className="room-code-row">
            <span className="room-code">Code: {roomId}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { onUiButtonClick?.(); setShowQrCode(true); }}
            >
              Show QR
            </button>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => { onUiButtonClick?.(); onExit(); }}>Exit Room</button>
      </div>

      <div className={`connection-banner ${connectionState}`} role="status" aria-live="polite">
        <strong>Connection:</strong> {getConnectionStateLabel(connectionState)}
        {connectionState === CONNECTION_STATES.RECONNECTING ? " — trying to restore your room session…" : null}
        {connectionState === CONNECTION_STATES.DEGRADED ? " — high latency detected; effects may feel lighter." : null}
        {connectionState === CONNECTION_STATES.DISCONNECTED ? " — connection lost. Keep this tab open while we retry." : null}
      </div>

      {showQrCode ? (
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
      ) : null}

      {transferLink ? (
        <div className="qr-modal-backdrop" onClick={() => { onUiButtonClick?.(); setTransferLink(null); }}>
          <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="qr-modal-title">Transfer entitlement</h2>
            <p className="panel-subtitle">Scan this QR code on another device. The one-time magic link transfers your active entitlement to that device.</p>
            {entitlementTransferQrUrl ? <img className="qr-image" src={entitlementTransferQrUrl} alt="QR code to transfer entitlement" /> : null}
            <p className="qr-link">{transferLink.transferUrl}</p>
            {transferLink.expiresAtMs ? <p className="field-label">Link expires at {new Date(transferLink.expiresAtMs).toLocaleTimeString()}.</p> : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { onUiButtonClick?.(); setTransferLink(null); }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}


      <div className="room-meta">
        <p><strong>Mode:</strong></p>
        {currentPlayer?.isHost ? (
          <>
            <select className="field-input" value={selectedModeId} disabled={!canSelectMode} onChange={(event) => { onUiButtonClick?.(); onSetMode?.(event.target.value); }}>
              {modeOptions.map((mode) => (
                <option key={mode.id} value={mode.id} disabled={mode.disabled}>{mode.label}</option>
              ))}
            </select>
            {!canSelectMode ? <span className="field-label">Preview rooms are locked to GLiTCH!.</span> : null}
          </>
        ) : (
          <p>{(availableModes.find((mode) => mode.id === selectedModeId)?.title) || selectedModeId}</p>
        )}
      </div>

      {canOpenStore ? (
        <div className="single-action-row">
          <button className="btn btn-primary" onClick={() => { onUiButtonClick?.(); onOpenStore?.(); }}>Store</button>
          {currentPlayer?.hasEntitlement ? (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={isCreatingTransferLink}
              onClick={() => { onUiButtonClick?.(); handleCreateEntitlementTransfer(); }}
            >
              {isCreatingTransferLink ? "Creating transfer…" : "Transfer Entitlement"}
            </button>
          ) : null}
        </div>
      ) : null}

      <ul className="player-list">
        {players.map((player) => {
          const isCurrentPlayer = player.playerId === playerId;
          const playerPingLabel = player.pingMs === null ? "-" : `${player.pingMs} ms`;
          const isWaitingForNextGame = Boolean(player.waitingForNextGame);
          const isActivelyInGame = phase === "play"
            && player.game?.status === "active"
            && Boolean(player.currentGameParticipant)
            && !isWaitingForNextGame;
          const readyLabel = isActivelyInGame
            ? "In Game"
            : (player.ready ? "Ready" : "Not Ready");
          const readyClassName = isActivelyInGame || player.ready ? "ready" : "waiting";

          return (
            <li key={player.playerId} className="player-item">
              <div className="player-info">
                <strong className="player-name">
                  {player.name}
                  {isCurrentPlayer ? " (You)" : ""}
                </strong>
                <span className="player-id">{player.playerId}</span>
                <span className="player-id">
                  <strong>Ping:</strong> {playerPingLabel}
                </span>
              </div>
              <div className="player-right">
                <span className={`ready-pill ${readyClassName}`}>
                  {readyLabel}
                </span>
                <span className={`status-pill ${player.connectionState || (player.connected ? "connected" : "disconnected")}`}>
                  {player.unlockingInProgress ? "Unlocking..." : (player.connectionStateLabel || getConnectionStateLabel(player.connectionState || (player.connected ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.DISCONNECTED)))}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {waitingForNextGame ? (
        <p className="panel-subtitle">
          A game is currently active. You are queued for the next game and can ready up once this round ends.
        </p>
      ) : null}

      {canManageReady ? (
        <>
        <div className="lobby-controls">
          {phase === "lobby" ? (
            <label className="field">
              <span className="field-label">Pick your color</span>
              <div className="color-picker-grid">
                {colors.map((color) => {
                  const takenByOther = players.some(
                    (player) => player.playerId !== playerId && player.color === color
                  );
                  const isSelected = currentPlayer?.color === color;

                  return (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch ${isSelected ? "selected" : ""}`}
                      style={{ backgroundColor: color }}
                      disabled={takenByOther}
                      title={takenByOther ? "Color already taken" : "Choose color"}
                      onClick={() => { onUiButtonClick?.(); onSetColor(color); }}
                    />
                  );
                })}
              </div>
            </label>
          ) : null}

          <button className="btn btn-primary" disabled={hostUnlockingPending && !currentPlayer?.isHost} onClick={() => { onUiButtonClick?.(); onSetReady(!currentPlayer?.ready); }}>
            {currentPlayer?.ready ? "Unready" : "Ready Up"}
          </button>
        </div>
        </>
      ) : null}

      <div className="room-meta">
        <p><strong>Phase:</strong> {phase}</p>
        <p><strong>Ping:</strong> {pingMs === null ? "-" : `${pingMs} ms`}</p>
        <p><strong>Server Time:</strong> {serverNow ? new Date(serverNow).toLocaleTimeString() : "-"}</p>
      </div>
    </section>
  );
}

export default RoomPage;
