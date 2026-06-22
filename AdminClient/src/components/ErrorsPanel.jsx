import { useEffect, useMemo, useState } from "react";
import { adminApiUrl } from "../config";
import { DataTable, EmptyPanel, MetricGrid } from "./DashboardWidgets";
import { formatDateTime, humanizeKey } from "../utils/formatters";

const severityOptions = [
  { value: "", label: "All severities" },
  { value: "warning", label: "Warnings" },
  { value: "error", label: "Errors" },
  { value: "critical", label: "Critical" }
];

function getGroupKey(error) {
  const code = String(error.errorCode || "").trim().toLowerCase();
  if (code) return `code:${code}`;
  return `message:${String(error.message || "Unknown error").trim().replace(/\s+/g, " ").toLowerCase()}`;
}

function groupErrors(errors) {
  const groups = new Map();
  errors.forEach((error) => {
    const key = getGroupKey(error);
    const existing = groups.get(key);
    if (existing) {
      existing.errors.push(error);
      existing.unresolvedCount += error.resolvedAt ? 0 : 1;
      return;
    }
    groups.set(key, {
      key,
      latest: error,
      errors: [error],
      unresolvedCount: error.resolvedAt ? 0 : 1
    });
  });
  return [...groups.values()];
}

function ErrorDetails({ group, onClose }) {
  if (!group) return null;

  return (
    <section className="table-panel error-details" aria-label="Selected error details">
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Error details</p>
          <h2>{group.latest.errorCode || "Error without a code"}</h2>
          <p>{group.errors.length} similar occurrence{group.errors.length === 1 ? "" : "s"}; {group.unresolvedCount} unresolved.</p>
        </div>
        <button type="button" className="secondary-button compact-button" onClick={onClose}>Close details</button>
      </div>

      <div className="error-detail-summary">
        <div><span>Grouping</span><strong>{group.latest.errorCode ? "Error code" : "Exact message"}</strong></div>
        <div><span>Latest source</span><strong>{group.latest.source || "-"}</strong></div>
        <div><span>Latest room</span><strong>{group.latest.roomCode || "-"}</strong></div>
        <div><span>Latest occurrence</span><strong>{formatDateTime(group.latest.occurredAt)}</strong></div>
      </div>

      <div className="error-occurrence-list">
        {group.errors.map((error, index) => (
          <details key={error.id} open={index === 0}>
            <summary>
              <span>{formatDateTime(error.occurredAt)} · {humanizeKey(error.severity)}</span>
              <span>{error.resolvedAt ? `Resolved ${formatDateTime(error.resolvedAt)}` : "Unresolved"}</span>
            </summary>
            <dl className="error-metadata">
              <div><dt>ID</dt><dd>{error.id}</dd></div>
              <div><dt>Code</dt><dd>{error.errorCode || "-"}</dd></div>
              <div><dt>Source</dt><dd>{error.source || "-"}</dd></div>
              <div><dt>Room</dt><dd>{error.roomCode || "-"}</dd></div>
              <div><dt>Player</dt><dd>{error.playerId || "-"}</dd></div>
              <div className="full-width"><dt>Message</dt><dd>{error.message || "-"}</dd></div>
            </dl>
            <h3>Context</h3>
            <pre>{JSON.stringify(error.context || {}, null, 2)}</pre>
            {error.stackTrace ? <><h3>Stack trace</h3><pre>{error.stackTrace}</pre></> : null}
          </details>
        ))}
      </div>
    </section>
  );
}

function ErrorsPanel({ adminActor, adminKey }) {
  const [analytics, setAnalytics] = useState(null);
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(50);
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("Loading errors...");
  const [isLoading, setIsLoading] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState(() => new Set());
  const [detailGroupKey, setDetailGroupKey] = useState(null);

  const groups = useMemo(() => groupErrors(analytics?.errorLogs || []), [analytics]);
  const detailGroup = groups.find((group) => group.key === detailGroupKey) || null;
  const selectedErrors = groups
    .filter((group) => selectedGroups.has(group.key))
    .flatMap((group) => group.errors)
    .filter((error) => !error.resolvedAt);
  const selectableGroups = groups.filter((group) => group.unresolvedCount > 0);
  const allSelected = selectableGroups.length > 0 && selectableGroups.every((group) => selectedGroups.has(group.key));

  useEffect(() => {
    loadErrors();
  }, []);

  function getAdminHeaders(includeJson = false) {
    return {
      ...(adminKey ? { "X-Admin-Token": adminKey } : {}),
      ...(adminActor?.trim() ? { "X-Admin-Actor": adminActor.trim() } : {}),
      ...(includeJson ? { "Content-Type": "application/json" } : {})
    };
  }

  async function loadErrors() {
    setIsLoading(true);
    const params = new URLSearchParams({ days: String(days), limit: String(limit) });
    if (severity) params.set("severity", severity);

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/analytics/errors?${params.toString()}`, {
        headers: getAdminHeaders()
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load errors");
      setAnalytics(payload);
      setSelectedGroups(new Set());
      setDetailGroupKey(null);
      const loadedGroups = groupErrors(payload.errorLogs || []);
      setStatus(`Loaded ${(payload.errorLogs || []).length} occurrences in ${loadedGroups.length} similar-error groups.`);
    } catch (error) {
      setAnalytics(null);
      setStatus(error.message || "Unable to load errors");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleGroup(groupKey) {
    setSelectedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function toggleAll() {
    setSelectedGroups(allSelected ? new Set() : new Set(selectableGroups.map((group) => group.key)));
  }

  async function resolveSelected() {
    if (!selectedErrors.length) return;
    setIsResolving(true);
    try {
      const response = await fetch(`${adminApiUrl}/api/admin/errors/resolve`, {
        method: "PATCH",
        headers: getAdminHeaders(true),
        body: JSON.stringify({ ids: selectedErrors.map((error) => error.id) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to resolve selected errors");
      await loadErrors();
      setStatus(`Resolved ${payload.resolvedCount} error occurrence${payload.resolvedCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(error.message || "Unable to resolve selected errors");
    } finally {
      setIsResolving(false);
    }
  }

  const supplementalTables = (analytics?.tables || []).filter((table) => table.title !== "Latest logs");

  return (
    <>
      <section className="dashboard-panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Database analytics</p>
            <h2>Error controls</h2>
            <p aria-live="polite">{status}</p>
          </div>
          <div className="dashboard-actions inline-actions analytics-controls">
            <label className="token-field compact-field">
              <span>Window</span>
              <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
                <option value={7}>7 days</option><option value={30}>30 days</option>
                <option value={90}>90 days</option><option value={365}>365 days</option>
              </select>
            </label>
            <label className="token-field compact-field">
              <span>Severity</span>
              <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                {severityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="token-field compact-field">
              <span>Occurrences</span>
              <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                <option value={25}>25</option><option value={50}>50</option>
                <option value={100}>100</option><option value={200}>200</option>
              </select>
            </label>
            <button type="button" onClick={loadErrors} disabled={isLoading || isResolving}>
              {isLoading ? "Refreshing..." : "Apply filters"}
            </button>
          </div>
        </div>
      </section>

      <MetricGrid metrics={analytics?.metrics || []} />

      {groups.length ? (
        <section className="table-panel error-table-panel">
          <div className="panel-heading-row error-table-heading">
            <div><h2>Latest error groups</h2><p>Grouped by error code, or exact message when no code exists.</p></div>
            <button type="button" onClick={resolveSelected} disabled={!selectedErrors.length || isResolving || isLoading}>
              {isResolving ? "Resolving..." : `Resolve selected (${selectedErrors.length})`}
            </button>
          </div>
          <div className="table-wrap">
            <table className="error-table">
              <thead><tr>
                <th className="selection-cell"><input type="checkbox" aria-label="Select all unresolved error groups" checked={allSelected} onChange={toggleAll} /></th>
                <th>Latest</th><th>Severity</th><th>Source</th><th>Room</th><th>Code</th><th>Message</th><th>Occurrences</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.key} className={detailGroupKey === group.key ? "active-error-row" : ""}>
                    <td className="selection-cell"><input type="checkbox" aria-label={`Select ${group.latest.errorCode || group.latest.message}`} checked={selectedGroups.has(group.key)} disabled={!group.unresolvedCount} onChange={() => toggleGroup(group.key)} /></td>
                    <td>{formatDateTime(group.latest.occurredAt)}</td>
                    <td>{humanizeKey(group.latest.severity)}</td>
                    <td>{group.latest.source || "-"}</td>
                    <td>{group.latest.roomCode || "-"}</td>
                    <td>{group.latest.errorCode || "-"}</td>
                    <td><span className="truncated-error-message" title={group.latest.message}>{group.latest.message}</span></td>
                    <td><span className="occurrence-badge">×{group.errors.length}</span></td>
                    <td>{group.unresolvedCount ? `${group.unresolvedCount} open` : "Resolved"}</td>
                    <td><button type="button" className="secondary-button compact-button" onClick={() => setDetailGroupKey(group.key)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : <EmptyPanel title="Latest error groups" message="No errors match the current filters." />}

      <ErrorDetails group={detailGroup} onClose={() => setDetailGroupKey(null)} />

      {supplementalTables.map((table) => table.rows?.length ? (
        <DataTable key={table.title} title={table.title} columns={table.columns} rows={table.rows} />
      ) : (
        <EmptyPanel key={table.title} title={table.title} message="No matching records are available for this window yet." />
      ))}
    </>
  );
}

export { ErrorsPanel, getGroupKey, groupErrors };
