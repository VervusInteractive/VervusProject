import { useEffect, useState } from "react";

function LobbyPage({
  name,
  roomIdInput,
  pingMs,
  timeSyncStatus = null,
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
  onCreateEntitlementTransfer,
  actionsLocked = false
}) {
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [transferLink, setTransferLink] = useState(null);
  const [isCreatingTransferLink, setIsCreatingTransferLink] = useState(false);

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

  const entitlementTransferQrUrl = transferLink?.transferUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(transferLink.transferUrl)}`
    : null;
  const hasActiveEntitlement = (entitledModeKeys || []).length > 0;

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

  const modeOptions = (availableModes || []).map((mode) => {
    const ownsMode = (entitledModeKeys || []).includes(mode.id);
    const modeExpiryMs = entitledModeExpiriesMs?.[mode.id] ?? profileEntitlementExpiresAtMs;
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

  return (
    <section className="panel">
      <h1 className="panel-title">Vervus Lobby</h1>
      <p className="panel-subtitle">Create a room or join with an invite code.</p>
      <p className="panel-meta"><strong>Ping:</strong> {pingMs === null ? "-" : `${pingMs} ms`}</p>
      <p className="panel-meta">
        <strong>Clock sync:</strong> {timeSyncStatus?.quality || "syncing"}
        {timeSyncStatus?.offsetMs === null || timeSyncStatus?.offsetMs === undefined ? "" : ` · offset ${timeSyncStatus.offsetMs} ms`}
        {timeSyncStatus?.jitterMs === null || timeSyncStatus?.jitterMs === undefined ? "" : ` · jitter ${timeSyncStatus.jitterMs} ms`}
      </p>

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
        {hasActiveEntitlement ? (
          <button
            className="btn btn-secondary"
            type="button"
            disabled={actionsLocked || isCreatingTransferLink}
            onClick={() => { onUiButtonClick?.(); handleCreateEntitlementTransfer(); }}
          >
            {isCreatingTransferLink ? "Creating transfer…" : "Transfer Entitlement"}
          </button>
        ) : null}
      </div>

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

      <label className="field">
        <span className="field-label">Game mode</span>
        <select
          className="field-input"
          value={selectedModeId}
          onChange={(event) => onSelectedModeChange?.(event.target.value)}
          disabled={!canSelectMode || actionsLocked}
        >
          {modeOptions.map((mode) => (
            <option key={mode.id} value={mode.id} disabled={mode.disabled}>{mode.label}</option>
          ))}
        </select>
        {!canSelectMode ? <span className="field-label">Purchase entitlement to select game mode.</span> : null}
        {canSelectMode ? <span className="field-label">Only actively owned modes can be selected.</span> : null}
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
