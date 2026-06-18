import { useEffect, useState } from "react";
import { adminApiUrl } from "../config";
import { DataTable, EmptyPanel } from "./DashboardWidgets";
import { formatDateTime, humanizeKey, summarizeMetadata } from "../utils/formatters";

function summarizeTarget(event) {
  const targetType = event.targetType ? humanizeKey(event.targetType) : "Session";
  return event.targetKey ? `${targetType}: ${event.targetKey}` : targetType;
}

function summarizeRequest(event) {
  const parts = [event.method, event.path].filter(Boolean);
  return parts.length ? parts.join(" ") : "-";
}

function AdminActivityPanel({ adminActor, adminKey }) {
  const [activity, setActivity] = useState([]);
  const [status, setStatus] = useState("Loading admin activity...");
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    loadActivity();
  }, []);

  function getAdminHeaders() {
    return {
      ...(adminKey ? { "X-Admin-Token": adminKey } : {}),
      ...(adminActor?.trim() ? { "X-Admin-Actor": adminActor.trim() } : {})
    };
  }

  async function loadActivity() {
    setIsLoading(true);
    const params = new URLSearchParams({ limit: String(limit) });
    if (actionType) params.set("actionType", actionType);
    if (targetType) params.set("targetType", targetType);
    if (targetKey.trim()) params.set("targetKey", targetKey.trim());

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/admin-activity?${params.toString()}`, {
        headers: getAdminHeaders()
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load admin activity");
      }

      const loadedActivity = payload.activity || [];
      setActivity(loadedActivity);
      setStatus(`Loaded ${loadedActivity.length} admin activity events.`);
    } catch (error) {
      setActivity([]);
      setStatus(error.message || "Unable to load admin activity");
    } finally {
      setIsLoading(false);
    }
  }

  const activityRows = activity.map((event) => [
    formatDateTime(event.actionAt),
    event.adminActor || "admin",
    humanizeKey(event.actionType),
    summarizeTarget(event),
    event.ipAddress || "-",
    event.outcome || "-",
    summarizeMetadata(event.metadata),
    summarizeRequest(event)
  ]);

  return (
    <>
      <section className="dashboard-panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Admin audit trail</p>
            <h2>Admin activity filters</h2>
            <p>{status}</p>
          </div>
          <div className="dashboard-actions inline-actions room-history-filters">
            <label className="token-field compact-field">
              <span>Action</span>
              <select value={actionType} onChange={(event) => setActionType(event.target.value)}>
                <option value="">All actions</option>
                <option value="admin_login">Logins</option>
                <option value="admin_logout">Logouts</option>
                <option value="game_mode_created">Mode creates</option>
                <option value="game_mode_updated">Mode edits</option>
                <option value="product_created">Product creates</option>
                <option value="product_updated">Product edits</option>
              </select>
            </label>
            <label className="token-field compact-field">
              <span>Target</span>
              <select value={targetType} onChange={(event) => setTargetType(event.target.value)}>
                <option value="">All targets</option>
                <option value="session">Session</option>
                <option value="game_mode">Game mode</option>
                <option value="product">Product</option>
              </select>
            </label>
            <label className="token-field compact-field">
              <span>Target key</span>
              <input value={targetKey} onChange={(event) => setTargetKey(event.target.value)} placeholder="standard" />
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
            <button type="button" onClick={loadActivity} disabled={isLoading}>
              {isLoading ? "Loading..." : "Apply filters"}
            </button>
          </div>
        </div>
      </section>

      {activityRows.length ? (
        <DataTable
          title="Recent admin actions"
          columns={["Time", "Admin", "Action", "Target", "IP", "Outcome", "Details", "Request"]}
          rows={activityRows}
        />
      ) : (
        <EmptyPanel title="Recent admin actions" message="No admin activity events match the current filters." />
      )}
    </>
  );
}

export { AdminActivityPanel };
