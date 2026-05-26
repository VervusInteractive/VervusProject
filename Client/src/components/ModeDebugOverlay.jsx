function ModeDebugOverlay({ mode, heatSurgeConfig, onClose }) {
  return (
    <div className="debug-modal-backdrop" onClick={onClose}>
      <div className="debug-modal" onClick={(event) => event.stopPropagation()}>
        <div className="debug-modal-header">
          <h2 className="debug-modal-title">Mode Debug Config</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
        <p><strong>Mode:</strong> {mode?.title || mode?.id || "Unknown"}</p>
        <p><strong>Mode ID:</strong> {mode?.id || "-"}</p>
        <pre className="debug-json">{JSON.stringify({
          difficultyBands: mode?.curve || [],
          heatSurgeConfig: heatSurgeConfig || null,
          modeConfig: mode || null
        }, null, 2)}</pre>
      </div>
    </div>
  );
}

export default ModeDebugOverlay;
