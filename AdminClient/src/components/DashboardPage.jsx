import { useMemo, useState } from "react";
import { adminApiUrl } from "../config";
import { dashboardSections } from "../data/dashboardSections";
import { SectionNavigation } from "./Navigation";
import { DataTable, FunnelPanel, MetricGrid, PlaceholderChart, TimelinePanel } from "./DashboardWidgets";
import { GameAnalyticsPanel } from "./GameAnalyticsPanel";
import { LiveRoomsPanel } from "./LiveRoomsPanel";
import { ModeConfigPanel } from "./ModeConfigPanel";
import { ProductsPanel } from "./ProductsPanel";
import { RoomHistoryPanel } from "./RoomHistoryPanel";

function DashboardPage({ adminKey, overview, status, isLoading, onRefresh, onSignOut }) {
  const [activeSectionId, setActiveSectionId] = useState(dashboardSections[0].id);
  const activeSection = useMemo(
    () => dashboardSections.find((section) => section.id === activeSectionId) || dashboardSections[0],
    [activeSectionId]
  );

  return (
    <main className="dashboard-layout">
      <SectionNavigation activeSectionId={activeSectionId} onSectionChange={setActiveSectionId} />

      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">{activeSection.eyebrow}</p>
            <h1>{activeSection.title}</h1>
            <p className="lede">{activeSection.description}</p>
          </div>
          <div className="dashboard-actions">
            <button type="button" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh overview"}
            </button>
            <button type="button" className="secondary-button" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <section className="status-strip" aria-live="polite">
          <span>{status}</span>
          <span>API: {adminApiUrl}</span>
          <span>Service: {overview?.service || "Unavailable"}</span>
          <span>Checked: {overview?.checkedAt || "Not checked"}</span>
        </section>

        {activeSection.id === "game" ? (
          <GameAnalyticsPanel adminKey={adminKey} />
        ) : activeSection.id === "live-rooms" ? (
          <LiveRoomsPanel adminKey={adminKey} />
        ) : activeSection.id === "room-history" ? (
          <RoomHistoryPanel adminKey={adminKey} />
        ) : (
          <>
            <MetricGrid metrics={activeSection.metrics} />
            <FunnelPanel funnel={activeSection.funnel} />
            <PlaceholderChart title={activeSection.chartTitle} bars={activeSection.chartBars} />
            <TimelinePanel timeline={activeSection.timeline} />
            {activeSection.id === "mode-config" && <ModeConfigPanel adminKey={adminKey} />}
            {activeSection.id === "products" && <ProductsPanel adminKey={adminKey} />}
            <DataTable
              title={activeSection.tableTitle}
              columns={activeSection.tableColumns}
              rows={activeSection.rows}
            />
          </>
        )}
      </div>
    </main>
  );
}

export { DashboardPage };
