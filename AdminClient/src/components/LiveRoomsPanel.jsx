import { useEffect, useState } from "react";
import { adminApiUrl } from "../config";
import { DataTable, EmptyPanel } from "./DashboardWidgets";
import { formatDateTime, formatPing, formatPlayers, formatStatusLabel } from "../utils/formatters";

function LiveRoomsPanel({ adminKey }) {
  const [liveRooms, setLiveRooms] = useState(null);
  const [status, setStatus] = useState("Loading live rooms...");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadLiveRooms();
    const refreshTimer = window.setInterval(loadLiveRooms, 10000);
    return () => window.clearInterval(refreshTimer);
  }, []);

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
  const roomRows = (liveRooms?.rooms || []).map((room) => [
    room.roomCode,
    formatPlayers(room.players),
    humanizeKey(room.modeLabel || room.mode),
    formatStatusLabel(room.status),
    formatPing(room.pingMs)
  ]);

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
      {roomRows.length ? (
        <DataTable
          title="Active rooms"
          columns={["Room code", "Players", "Mode", "Status", "Ping"]}
          rows={roomRows}
        />
      ) : (
        <EmptyPanel title="Active rooms" message="No active rooms are currently visible to the admin API." />
      )}
    </>
  );
}

export { LiveRoomsPanel };
