import { useEffect, useState } from "react";

function LobbyPage({
  name,
  roomIdInput,
  pingMs,
  onNameChange,
  onRoomIdInputChange,
  onCreateRoom,
  onJoinRoom,
  onUiButtonClick,
  onOpenStore,
  selectedModeId = "standard",
  availableModes = [],
  canSelectMode = false,
  profileEntitlementExpiresAtMs = null,
  entitledModeKeys = [],
  entitledModeExpiriesMs = {},
  onSelectedModeChange,
  actionsLocked = false
}) {
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTimeMs(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const formatRemainingTime = (remainingMs) => {
    if (remainingMs <= 0) return "Expired";
    const totalMinutes = Math.floor(remainingMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m left`;
    return `${hours}h ${minutes}m left`;
  };

  const modeOptions = (availableModes || []).map((mode) => {
    const ownsMode = (entitledModeKeys || []).includes(mode.id);
    const modeExpiryMs = entitledModeExpiriesMs?.[mode.id] ?? profileEntitlementExpiresAtMs;
    const hasTimedEntitlement = typeof modeExpiryMs === "number";
    const remainingMs = hasTimedEntitlement ? (modeExpiryMs - currentTimeMs) : null;
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
      <h1 className="panel-title">Vervus Lobby</h1>
      <p className="panel-subtitle">Create a room or join with an invite code.</p>
      <p className="panel-meta"><strong>Ping:</strong> {pingMs === null ? "-" : `${pingMs} ms`}</p>

      <label className="field">
        <span className="field-label">Display name</span>
        <input
          className="field-input"
          placeholder="Your name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>

      <div className="single-action-row">
        <button className="btn btn-primary" disabled={actionsLocked} onClick={() => { onUiButtonClick?.(); onCreateRoom(); }}>Create Room</button>
        <button className="btn btn-secondary" disabled={actionsLocked} onClick={() => { onUiButtonClick?.(); onOpenStore?.(); }}>Store</button>
      </div>


      <label className="field">
        <span className="field-label">Game mode</span>
        <select
          className="field-input"
          value={selectedModeId}
          onChange={(event) => onSelectedModeChange?.(event.target.value)}
          disabled={!canSelectMode || actionsLocked}
        >
          {modeOptions.map((mode) => (
            <option key={mode.id} value={mode.id}>{mode.label}</option>
          ))}
        </select>
        {!canSelectMode ? <span className="field-label">Purchase entitlement to select game mode.</span> : null}
      </label>

      <div className="join-row">
        <label className="field join-field">
          <span className="field-label">Room code</span>
          <input
            className="field-input"
            placeholder="ABCD"
            value={roomIdInput}
            onChange={(event) => onRoomIdInputChange(event.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={actionsLocked} onClick={() => { onUiButtonClick?.(); onJoinRoom(); }}>Join Room</button>
      </div>
    </section>
  );
}

export default LobbyPage;
