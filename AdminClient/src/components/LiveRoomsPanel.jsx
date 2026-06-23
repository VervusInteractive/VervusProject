import { useEffect, useState } from "react";
import { adminApiUrl } from "../config";
import { EmptyPanel, MetricGrid } from "./DashboardWidgets";
import {
  formatDateTime,
  formatNumber,
  formatPing,
  formatPlayers,
  formatStatusLabel,
  humanizeKey
} from "../utils/formatters";

function getRoomKey(room, index) {
  return room?.roomCode || `room-${index}`;
}

function getRoomPlayers(room) {
  return Array.isArray(room?.playerList) ? room.playerList : [];
}

function formatPlayerName(player, index) {
  return player?.name || player?.displayName || `Player ${index + 1}`;
}

function formatPlayerRole(player, index) {
  if (player?.isHost) return "Host";
  if (Number.isFinite(Number(player?.slot))) return `Player ${Number(player.slot)}`;
  return `Player ${index + 1}`;
}

function formatReadyState(player) {
  if (player?.ready === true) return "Ready";
  if (player?.ready === false) return "Not ready";
  return "-";
}

function LiveRoomsPanel({ adminKey }) {
  const [liveRooms, setLiveRooms] = useState(null);
  const [status, setStatus] = useState("Loading live rooms...");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoomCode, setSelectedRoomCode] = useState("");

  useEffect(() => {
    loadLiveRooms();
    const refreshTimer = window.setInterval(loadLiveRooms, 10000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    const rooms = liveRooms?.rooms || [];
    if (!rooms.length) {
      setSelectedRoomCode("");
      return;
    }

    if (!selectedRoomCode || !rooms.some((room) => room.roomCode === selectedRoomCode)) {
      setSelectedRoomCode(rooms[0].roomCode);
    }
  }, [liveRooms, selectedRoomCode]);

  async function loadLiveRooms() {
    setIsLoading(true);

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/live-rooms`, {
        headers: adminKey ? { "X-Admin-Token": adminKey } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load live rooms");
      }
      setLiveRooms(payload);
      setStatus(`Showing ${payload.summary?.roomCount || 0} live rooms from ${payload.source || "admin API"}.`);
    } catch (error) {
      setLiveRooms(null);
      setStatus(error.message || "Unable to load live rooms");
    } finally {
      setIsLoading(false);
    }
  }

  const summary = liveRooms?.summary || { roomCount: 0, playerCount: 0, connectedPlayerCount: 0, statusCounts: {} };
  const statusSummary = Object.entries(summary.statusCounts || {})
    .map(([key, value]) => `${humanizeKey(key)} ${value}`)
    .join(", ") || "No active statuses";
  const metrics = [
    { label: "Live rooms", value: formatNumber(summary.roomCount), delta: liveRooms?.source || "runtime" },
    { label: "Players", value: formatNumber(summary.playerCount), delta: `${formatNumber(summary.connectedPlayerCount)} connected` },
    { label: "Statuses", value: formatNumber(Object.keys(summary.statusCounts || {}).length), delta: statusSummary },
    { label: "Last refresh", value: formatDateTime(liveRooms?.generatedAt), delta: isLoading ? "Refreshing" : "Auto every 10s" }
  ];
  const rooms = liveRooms?.rooms || [];
  const selectedRoom = rooms.find((room) => room.roomCode === selectedRoomCode) || rooms[0] || null;
  const selectedRoomPlayers = getRoomPlayers(selectedRoom);

  return (
    <>
      <section className="dashboard-panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Live operations</p>
            <h2>Active room monitor</h2>
            <p>{status}</p>
          </div>
          <div className="dashboard-actions inline-actions">
            <button type="button" onClick={loadLiveRooms} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh rooms"}
            </button>
          </div>
        </div>
      </section>
      <MetricGrid metrics={metrics} />
      {rooms.length ? (
        <>
          <section className="table-panel live-rooms-table-panel">
            <div className="panel-heading">
              <div>
                <h2>Active rooms</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table className="live-room-table">
                <thead>
                  <tr>
                    <th>Room code</th>
                    <th>Players</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Ping</th>
                    <th>Updated</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room, index) => {
                    const roomCode = getRoomKey(room, index);
                    const isSelected = selectedRoom?.roomCode === room.roomCode;
                    return (
                      <tr className={isSelected ? "active-live-room-row" : ""} key={roomCode}>
                        <td>
                          <strong>{room.roomCode || "-"}</strong>
                        </td>
                        <td>{formatPlayers(room.players)}</td>
                        <td>{humanizeKey(room.modeLabel || room.mode)}</td>
                        <td>{formatStatusLabel(room.status)}</td>
                        <td>{formatPing(room.pingMs)}</td>
                        <td>{formatDateTime(room.updatedAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button compact-button room-inspect-button"
                            onClick={() => setSelectedRoomCode(room.roomCode)}
                            disabled={isSelected}
                          >
                            {isSelected ? "Selected" : "Inspect"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-panel live-room-detail-panel">
            <div className="panel-heading">
              <div>
                <h2>{selectedRoom?.roomCode || "Room"}</h2>
              </div>
              <span>{selectedRoomPlayers.length} players listed</span>
            </div>
            <div className="room-detail-badges">
              <span>{formatPlayers(selectedRoom?.players)}</span>
              <span>{formatStatusLabel(selectedRoom?.status)}</span>
              <span>{humanizeKey(selectedRoom?.modeLabel || selectedRoom?.mode)}</span>
              <span>{formatPing(selectedRoom?.pingMs)}</span>
              <span>{formatDateTime(selectedRoom?.updatedAt)}</span>
            </div>
            {selectedRoomPlayers.length ? (
              <div className="live-room-player-list">
                {selectedRoomPlayers.map((player, index) => (
                  <article className="live-room-player-row" key={player.playerId || `${selectedRoom?.roomCode}-${index}`}>
                    <span
                      className="player-color-dot"
                      style={{ backgroundColor: player.color || "rgba(148, 163, 184, 0.85)" }}
                      aria-hidden="true"
                    />
                    <div className="live-room-player-id">
                      <strong>{formatPlayerName(player, index)}</strong>
                      <small>{player.playerId || "-"}</small>
                    </div>
                    <span>{formatPlayerRole(player, index)}</span>
                    <span className={player.connected ? "connection-pill connected" : "connection-pill disconnected"}>
                      {player.connectionStateLabel || formatStatusLabel(player.connectionState)}
                    </span>
                    <span>{formatReadyState(player)}</span>
                    <span>{formatPing(player.pingMs)}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-detail-copy">No player records are available for this room source.</p>
            )}
          </section>
        </>
      ) : (
        <EmptyPanel title="Active rooms" message="No active rooms are currently visible to the admin API." />
      )}
    </>
  );
}

export { LiveRoomsPanel };
