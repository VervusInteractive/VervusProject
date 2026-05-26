import { useEffect, useMemo, useState } from "react";
import ModeDebugOverlay from "./ModeDebugOverlay";

function RoomPage({
  roomId,
  playerId,
  players,
  phase,
  serverNow,
  pingMs,
  sessionToken,
  waitingForNextGame = false,
  colors,
  onSetColor,
  onSetReady,
  onExit,
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
  modeDebugConfigs = []
}) {
  const [showQrCode, setShowQrCode] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const currentPlayer = useMemo(
    () => players.find((player) => player.playerId === playerId),
    [players, playerId]
  );
  
  const clientUrl = import.meta.env.VITE_CLIENT_URL;
  const roomInviteUrl = `${clientUrl}/?room=${encodeURIComponent(roomId)}`;
  const roomInviteQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(roomInviteUrl)}`;
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

  const modeOptions = (availableModes || []).map((mode) => {
    const ownsMode = (entitledModeKeys || []).includes(mode.id);
    const modeExpiryMs = entitledModeExpiriesMs?.[mode.id] ?? entitlementExpiresAtMs;
    const hasTimedEntitlement = typeof modeExpiryMs === "number";
    const remainingMs = hasTimedEntitlement ? (modeExpiryMs - Date.now()) : null;
    const entitlementStatus = ownsMode
      ? (hasTimedEntitlement ? formatRemainingTime(remainingMs) : "Owned")
      : (mode.id === "standard" ? "Preview" : "Purchase Mode");
    return {
      ...mode,
      label: `${mode.title} · ${entitlementStatus}`
    };
  });

  return (
    <section className="panel">
      {isWrongOrientation ? (
        <div className="orientation-warning-overlay" role="alert">
          <div className="orientation-warning-card">
            Wrong orientation. Please rotate to <strong>{selectedModeOrientationLock}</strong>.
          </div>
        </div>
      ) : null}
      <button type="button" className="btn btn-secondary debug-button" onClick={() => { onUiButtonClick?.(); setShowDebug(true); }}>Debug</button>
      {showDebug ? <ModeDebugOverlay mode={selectedMode} heatSurgeConfig={selectedMode?.heatSurgeConfig} onClose={() => { onUiButtonClick?.(); setShowDebug(false); }} /> : null}
      <div className="room-header">
        <div>
          <h1 className="panel-title">Room {roomId}</h1>
          <p className="panel-subtitle">Players currently in this room.</p>
          {hostUnlockingPending
            ? <p className="panel-subtitle"><strong>Unlocking:</strong> Unlocking {unlockingProductLabel}, Payment Pending...</p>
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


      <div className="room-meta">
        <p><strong>Mode:</strong></p>
        {currentPlayer?.isHost ? (
          <>
            <select className="field-input" value={selectedModeId} disabled={!canSelectMode} onChange={(event) => { onUiButtonClick?.(); onSetMode?.(event.target.value); }}>
              {modeOptions.map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.label}</option>
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
                <span className={`status-pill ${player.connected ? "connected" : "disconnected"}`}>
                  {player.unlockingInProgress ? "Unlocking..." : (player.connected ? "Connected" : "Disconnected")}
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
        <p><strong>Session:</strong> {sessionToken || "-"}</p>
      </div>
    </section>
  );
}

export default RoomPage;
