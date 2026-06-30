import { useRef, useState } from "react";
import { getPlayerIcon } from "../playerIcons";

const BAD_CONNECTION_THRESHOLD_MS = 250;

function PlayAreaPage({
  roomId,
  playerId,
  players,
  pingMs,
  serverNow,
  positionLatencyByPlayerId,
  onMove,
  onExit
}) {
  const boardRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const isBadConnection = (latencyMs) => typeof latencyMs === "number" && latencyMs > BAD_CONNECTION_THRESHOLD_MS;

  const moveFromPointer = (clientX, clientY) => {
    const board = boardRef.current;
    if (!board) return;

    const rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    onMove({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    });
  };

  const handlePointerDown = (event) => {
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    moveFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event) => {
    if (!isDragging) return;
    moveFromPointer(event.clientX, event.clientY);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <section className="panel">
      <div className="room-header">
        <div>
          <h1 className="panel-title">Play Area · Room {roomId}</h1>
          <p className="panel-subtitle">Drag anywhere on the board to move your circle.</p>
          <p className="panel-meta">
            <strong>Ping:</strong> {pingMs === null ? "-" : `${pingMs} ms`}
            {isBadConnection(pingMs) ? <span className="warning-icon" aria-label="Bad connection" title="Bad connection">⚠</span> : null}
          </p>
          <p className="panel-meta"><strong>Server Time:</strong> {serverNow ? new Date(serverNow).toLocaleTimeString() : "-"}</p>
        </div>
        <button className="btn btn-secondary" onClick={onExit}>Exit Room</button>
      </div>

      <section className="play-area-section">
        <div
          className="play-area"
          ref={boardRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {players.map((player) => {
            const isCurrentPlayer = player.playerId === playerId;
            const hasBadRemoteConnection = !isCurrentPlayer && isBadConnection(player.pingMs);

            return (
              <div
                key={player.playerId}
                className={`player-circle ${isCurrentPlayer ? "self" : ""}`}
                style={{
                  backgroundColor: player.color || "#64748b",
                  left: `${player.position?.x ?? 50}%`,
                  top: `${player.position?.y ?? 50}%`
                }}
                title={player.name}
              >
                {hasBadRemoteConnection ? (
                  <span className="player-circle-warning" aria-label={`${player.name} has a bad connection`} title={`${player.name} has a bad connection`}>
                    ⚠
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="play-area-section">
        <p className="panel-subtitle">Your ping to server plus remote dot-update latency to your screen.</p>
        {players.length > 0 ? (
          <ul className="player-list">
            {players.map((player) => {
            const isCurrentPlayer = player.playerId === playerId;
            const updateDelayMs = positionLatencyByPlayerId[player.playerId] ?? null;
            const hasBadRemoteConnection = !isCurrentPlayer && isBadConnection(player.pingMs);

            return (
              <li key={`dot-latency-${player.playerId}`} className="player-item">
                <div className="player-info">
                  <strong className="player-name">
                    {player.name}
                    {isCurrentPlayer ? " (You)" : ""}
                    <span
                      className="player-color-dot"
                      aria-hidden="true"
                    >
                      <img src={getPlayerIcon(player.color)} alt="" />
                    </span>
                    {hasBadRemoteConnection ? <span className="warning-icon" aria-label={`${player.name} has a bad connection`} title={`${player.name} has a bad connection`}>⚠</span> : null}
                  </strong>
                  <span className="player-id">{player.playerId}</span>
                </div>
                <div className="player-right">
                  <span className={`status-pill ${player.connected ? "connected" : "disconnected"}`}>
                    {player.connected ? "Connected" : "Disconnected"}
                  </span>
                  <span className="ready-pill waiting latency-pill">
                    {isCurrentPlayer
                      ? `Ping to Server: ${pingMs === null ? "-" : `${pingMs} ms`}`
                      : `Dot update → You: ${updateDelayMs === null ? "-" : `${updateDelayMs} ms`}`}
                  </span>
                </div>
              </li>
            );
            })}
          </ul>
        ) : (
          <p className="player-id">Waiting for players to join.</p>
        )}
      </section>
    </section>
  );
}

export default PlayAreaPage;
