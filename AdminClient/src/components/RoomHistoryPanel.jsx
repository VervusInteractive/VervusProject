import { useEffect, useRef, useState } from "react";
import { adminApiUrl } from "../config";
import { DataTable, EmptyPanel } from "./DashboardWidgets";
import { formatDateTime, formatEventLabel, formatStatusLabel, summarizeMetadata } from "../utils/formatters";

function RoomHistoryPanel({ adminKey }) {
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Loading room history...");
  const [isLoading, setIsLoading] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [eventType, setEventType] = useState("");
  const [limit, setLimit] = useState(50);
  const [resultKey, setResultKey] = useState("initial");
  const requestIdRef = useRef(0);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const normalizedEventType = eventType.trim();
    const normalizedLimit = Number(limit) || 50;
    setIsLoading(true);
    setHistory([]);
    setResultKey(`loading-${requestId}`);
    setStatus(normalizedRoomCode ? `Loading room ${normalizedRoomCode} history...` : "Loading room history...");
    const params = new URLSearchParams({ limit: String(normalizedLimit) });
    if (normalizedRoomCode) params.set("roomCode", normalizedRoomCode);
    if (normalizedEventType) params.set("eventType", normalizedEventType);

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/room-history?${params.toString()}`, {
        headers: adminKey ? { "X-Admin-Token": adminKey } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load room history");
      }
      if (requestId !== requestIdRef.current) return;
      const events = Array.isArray(payload.history) ? payload.history : [];
      const matchingEvents = normalizedRoomCode
        ? events.filter((event) => String(event.roomCode || "").trim().toUpperCase() === normalizedRoomCode)
        : events;
      setHistory(matchingEvents);
      setResultKey(`${requestId}-${params.toString()}`);
      setStatus(`Loaded ${matchingEvents.length} room history events.`);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setHistory([]);
      setResultKey(`error-${requestId}`);
      setStatus(error.message || "Unable to load room history");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }

  const historyRowKeys = history.map((event, index) => (
    event.id || `${event.roomCode || "room"}-${event.eventAt || index}-${event.eventType || "event"}-${event.actorPlayerId || index}`
  ));
  const historyRows = history.map((event) => [
    formatDateTime(event.eventAt),
    event.roomCode || "-",
    formatEventLabel(event.eventType),
    event.actorDisplayName || event.metadata?.actorDisplayName || event.actorPlayerId || "-",
    event.fromStatus ? formatStatusLabel(event.fromStatus) : "-",
    event.toStatus ? formatStatusLabel(event.toStatus) : "-",
    summarizeMetadata(event.metadata)
  ]);

  return (
    <>
      <section className="dashboard-panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Audit trail</p>
            <h2>Room event filters</h2>
            <p>{status}</p>
          </div>
          <div className="dashboard-actions inline-actions room-history-filters">
            <label className="token-field compact-field">
              <span>Room code</span>
              <input value={roomCode} onChange={(event) => setRoomCode(event.target.value)} placeholder="ABC123" />
            </label>
            <label className="token-field compact-field">
              <span>Event</span>
              <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
                <option value="">All events</option>
                <option value="room_joined">Joins</option>
                <option value="room_left">Leaves</option>
                <option value="room_started">Starts</option>
                <option value="room_ended">Ends</option>
                <option value="host_changed">Host changes</option>
              </select>
            </label>
            <label className="token-field compact-field">
              <span>Limit</span>
              <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </label>
            <button type="button" onClick={loadHistory} disabled={isLoading}>
              {isLoading ? "Loading..." : "Apply filters"}
            </button>
          </div>
        </div>
      </section>
      {historyRows.length ? (
        <DataTable
          key={resultKey}
          title="Recent room events"
          columns={["Time", "Room", "Event", "Actor", "From", "To", "Metadata"]}
          rows={historyRows}
          rowKeys={historyRowKeys}
        />
      ) : (
        <EmptyPanel title="Recent room events" message="No room history events match the current filters." />
      )}
    </>
  );
}

export { RoomHistoryPanel };
