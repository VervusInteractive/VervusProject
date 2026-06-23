import { useEffect, useState } from "react";
import { adminApiUrl } from "../config";
import { DataTable, EmptyPanel, MetricGrid } from "./DashboardWidgets";
import { formatDateTime } from "../utils/formatters";

const severityOptions = [
  { value: "", label: "All severities" },
  { value: "warning", label: "Warnings" },
  { value: "error", label: "Errors" },
  { value: "critical", label: "Critical" }
];

function AdminAnalyticsPanel({ adminKey, sectionId }) {
  const [analytics, setAnalytics] = useState(null);
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(50);
  const [severity, setSeverity] = useState("");
  const [balanceModeKey, setBalanceModeKey] = useState("");
  const [balanceModeOptions, setBalanceModeOptions] = useState([]);
  const [status, setStatus] = useState("Loading analytics...");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [sectionId, balanceModeKey]);

  useEffect(() => {
    if (sectionId === "balancing") {
      loadBalanceModeOptions();
    }
  }, [sectionId, adminKey]);

  async function loadBalanceModeOptions() {
    try {
      const response = await fetch(`${adminApiUrl}/api/admin/game-modes`, {
        headers: adminKey ? { "X-Admin-Token": adminKey } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load mode filters");
      }

      const loadedModes = payload.modes || [];
      setBalanceModeOptions(loadedModes);
      setBalanceModeKey((currentModeKey) => (
        currentModeKey && !loadedModes.some((mode) => mode.modeKey === currentModeKey) ? "" : currentModeKey
      ));
    } catch (error) {
      setBalanceModeOptions([]);
    }
  }

  async function loadAnalytics() {
    setIsLoading(true);
    setStatus("Loading analytics from the admin API...");

    const params = new URLSearchParams({ days: String(days) });
    if (sectionId === "errors") {
      params.set("limit", String(limit));
      if (severity) params.set("severity", severity);
    }
    if (sectionId === "balancing" && balanceModeKey) {
      params.set("modeKey", balanceModeKey);
    }

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/analytics/${encodeURIComponent(sectionId)}?${params.toString()}`, {
        headers: adminKey ? { "X-Admin-Token": adminKey } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load analytics");
      }
      setAnalytics(payload);
      const selectedBalanceMode = balanceModeOptions.find((mode) => mode.modeKey === balanceModeKey);
      const balanceScope = sectionId === "balancing"
        ? balanceModeKey
          ? ` for ${selectedBalanceMode?.displayName || balanceModeKey}`
          : " across all modes"
        : "";
      setStatus(`Showing ${payload.windowDays || days} day analytics${balanceScope} generated ${formatDateTime(payload.generatedAt)}.`);
    } catch (error) {
      setAnalytics(null);
      setStatus(error.message || "Unable to load analytics");
    } finally {
      setIsLoading(false);
    }
  }

  const tables = analytics?.tables || [];

  return (
    <>
      <section className="dashboard-panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Database analytics</p>
            <h2>{analytics?.title || "Analytics controls"}</h2>
            <p>{status}</p>
          </div>
          <div className="dashboard-actions inline-actions analytics-controls">
            <label className="token-field compact-field">
              <span>Window</span>
              <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>365 days</option>
              </select>
            </label>
            {sectionId === "balancing" ? (
              <label className="token-field compact-field">
                <span>Mode</span>
                <select value={balanceModeKey} onChange={(event) => setBalanceModeKey(event.target.value)}>
                  <option value="">All modes</option>
                  {balanceModeOptions.map((mode) => (
                    <option key={mode.modeKey} value={mode.modeKey}>
                      {mode.displayName || mode.modeKey}{mode.isEnabled ? "" : " (disabled)"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {sectionId === "errors" ? (
              <>
                <label className="token-field compact-field">
                  <span>Severity</span>
                  <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                    {severityOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
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
              </>
            ) : null}
            <button type="button" onClick={loadAnalytics} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh analytics"}
            </button>
          </div>
        </div>
      </section>

      <MetricGrid metrics={analytics?.metrics || []} />

      {tables.length ? tables.map((table) => (
        table.rows?.length ? (
          <DataTable
            key={table.title}
            title={table.title}
            columns={table.columns}
            rows={table.rows}
          />
        ) : (
          <EmptyPanel
            key={table.title}
            title={table.title}
            message="No matching records are available for this window yet."
          />
        )
      )) : (
        <EmptyPanel title="Analytics data" message="No analytics tables are available for this section yet." />
      )}
    </>
  );
}

export { AdminAnalyticsPanel };
