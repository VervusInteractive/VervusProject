import { useEffect, useState } from "react";
import { adminApiUrl } from "../config";
import { DataTable, EmptyPanel, MetricGrid } from "./DashboardWidgets";
import { formatCombo, formatDateTime, formatDuration, formatNumber } from "../utils/formatters";

function GameAnalyticsPanel({ adminKey }) {
  const [analytics, setAnalytics] = useState(null);
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState("Loading game analytics...");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAnalytics(days);
  }, []);

  async function loadAnalytics(windowDays = days) {
    setIsLoading(true);
    setStatus(`Loading the last ${windowDays} days of game analytics...`);

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/game-analytics?days=${encodeURIComponent(windowDays)}`, {
        headers: adminKey ? { "X-Admin-Token": adminKey } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load game analytics");
      }
      setAnalytics(payload);
      setStatus(`Showing ${payload.windowDays || windowDays} day analytics generated at ${payload.generatedAt || "now"}.`);
    } catch (error) {
      setAnalytics(null);
      setStatus(error.message || "Unable to load game analytics");
    } finally {
      setIsLoading(false);
    }
  }

  const summary = analytics?.summary || { sessions: 0, avgCombo: 0, highestCombo: 0, avgDurationMs: 0 };
  const metrics = [
    { label: "Sessions", value: formatNumber(summary.sessions), delta: `${analytics?.windowDays || days} day window` },
    { label: "Avg. combo", value: formatCombo(summary.avgCombo), delta: "Completed sessions" },
    { label: "Highest combo", value: `${formatNumber(summary.highestCombo)}x`, delta: "Best recorded run" },
    { label: "Avg. duration", value: formatDuration(summary.avgDurationMs), delta: "Completed sessions" }
  ];

  const gameRows = (analytics?.games || []).map((game) => [
    game.gameName || game.modeKey,
    formatNumber(game.sessions),
    formatCombo(game.avgCombo),
    `${formatNumber(game.highestCombo)}x`,
    formatDuration(game.avgDurationMs)
  ]);
  const recentRows = (analytics?.recentSessions || []).map((session) => [
    session.roomCode,
    `#${formatNumber(session.roomPlayNumber || 1)}`,
    session.modeKey,
    session.isPreview ? "Preview" : "Premium",
    session.endedAt ? formatDuration(session.durationMs) : "In progress",
    `${formatNumber(session.highestCombo)}x`,
    session.endReason || "-"
  ]);

  return (
    <>
      <section className="dashboard-panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Live database metrics</p>
            <h2>Game analytics controls</h2>
            <p>{status}</p>
          </div>
          <div className="dashboard-actions inline-actions">
            <label className="token-field compact-field">
              <span>Window</span>
              <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>365 days</option>
              </select>
            </label>
            <button type="button" onClick={() => loadAnalytics(days)} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh analytics"}
            </button>
          </div>
        </div>
      </section>
      <MetricGrid metrics={metrics} />
      <DataTable
        title="Game performance by game"
        columns={["Game", "Sessions", "Avg. combo", "Highest combo", "Avg. duration"]}
        rows={gameRows}
      />
      <DataTable
        title="Recent game sessions"
        columns={["Room", "Play", "Game", "Type", "Duration", "Highest combo", "End reason"]}
        rows={recentRows}
      />
    </>
  );
}

export { GameAnalyticsPanel };
