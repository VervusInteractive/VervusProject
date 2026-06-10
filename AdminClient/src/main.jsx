import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";

const adminApiUrl = import.meta.env.VITE_ADMIN_API_URL || "http://localhost:3002";

const dashboardSections = [
  {
    id: "overview",
    label: "Platform overview",
    eyebrow: "Command center",
    title: "Platform overview",
    description: "A top-level readout for traffic, previews, sales, and revenue across Vervus.",
    metrics: [
      { label: "Visitors", value: "24,890", delta: "+12.4%" },
      { label: "Preview starts", value: "8,742", delta: "+8.1%" },
      { label: "Sales", value: "1,286", delta: "+5.7%" },
      { label: "Revenue", value: "$38.6K", delta: "+14.2%" }
    ],
    chartTitle: "Platform pulse",
    chartBars: [62, 74, 58, 83, 91, 78, 88],
    tableTitle: "Priority signals",
    tableColumns: ["Signal", "Current", "Status"],
    rows: [
      ["Preview conversion", "14.7%", "Healthy"],
      ["Checkout abandonment", "22.1%", "Watch"],
      ["Critical errors", "0", "Clear"]
    ]
  },
  {
    id: "conversion",
    label: "Conversion funnel",
    eyebrow: "Growth",
    title: "Conversion funnel",
    description: "Track the complete journey from visitor to host click, preview, checkout, and purchase.",
    funnel: [
      { label: "Visitors", value: "24,890", percent: 100 },
      { label: "Host game clicks", value: "15,410", percent: 62 },
      { label: "Preview", value: "8,742", percent: 35 },
      { label: "Checkout", value: "2,340", percent: 9 },
      { label: "Purchase", value: "1,286", percent: 5 }
    ],
    tableTitle: "Funnel notes",
    tableColumns: ["Stage", "Drop-off", "Action"],
    rows: [
      ["Host click → Preview", "43%", "Improve CTA clarity"],
      ["Preview → Checkout", "73%", "Add social proof"],
      ["Checkout → Purchase", "45%", "Review payment friction"]
    ]
  },
  {
    id: "website",
    label: "Website analytics",
    eyebrow: "Website",
    title: "Website analytics",
    description: "Monitor visitor behavior, scroll depth, and host-game engagement across marketing pages.",
    metrics: [
      { label: "Visitors", value: "24,890", delta: "+12.4%" },
      { label: "Avg. scroll depth", value: "68%", delta: "+4.0%" },
      { label: "Host game clicks", value: "15,410", delta: "+9.8%" },
      { label: "Bounce rate", value: "31%", delta: "-2.6%" }
    ],
    chartTitle: "Engagement by page section",
    chartBars: [95, 82, 74, 65, 47, 38],
    tableTitle: "Top pages",
    tableColumns: ["Page", "Visitors", "Host clicks"],
    rows: [
      ["Homepage", "18,240", "11,904"],
      ["How it works", "4,318", "2,012"],
      ["Pricing", "2,332", "1,494"]
    ]
  },
  {
    id: "sales",
    label: "Sales dashboard",
    eyebrow: "Commerce",
    title: "Sales dashboard",
    description: "Placeholder sales operations view for transactions, revenue, and product performance.",
    metrics: [
      { label: "Sales", value: "1,286", delta: "+5.7%" },
      { label: "Revenue", value: "$38.6K", delta: "+14.2%" },
      { label: "Products sold", value: "1,478", delta: "+6.9%" },
      { label: "Avg. order", value: "$30.02", delta: "+3.2%" }
    ],
    tableTitle: "Products sold",
    tableColumns: ["Product", "Units", "Revenue"],
    rows: [
      ["Party Pack", "724", "$21.7K"],
      ["Streamer Pack", "418", "$12.5K"],
      ["Event Pack", "336", "$4.4K"]
    ]
  },
  {
    id: "game",
    label: "Game analytics",
    eyebrow: "Gameplay",
    title: "Game analytics",
    description: "Sessions, combo performance, and duration metrics for each game experience.",
    metrics: [
      { label: "Sessions", value: "6,204", delta: "+11.0%" },
      { label: "Avg. combo", value: "7.4x", delta: "+0.8x" },
      { label: "Highest combo", value: "42x", delta: "Record" },
      { label: "Avg. duration", value: "11m 24s", delta: "+36s" }
    ],
    tableTitle: "Game performance",
    tableColumns: ["Game", "Sessions", "Avg. duration"],
    rows: [
      ["Glitch Grid", "2,184", "12m 05s"],
      ["Signal Rush", "1,846", "10m 42s"],
      ["Corruption Core", "1,324", "13m 18s"]
    ]
  },
  {
    id: "modes",
    label: "Mode analytics",
    eyebrow: "Gameplay",
    title: "Mode analytics",
    description: "Usage and performance breakdown for Standard, Blitz, and Chaos game modes.",
    metrics: [
      { label: "Standard usage", value: "51%", delta: "+2.1%" },
      { label: "Blitz usage", value: "29%", delta: "+4.8%" },
      { label: "Chaos usage", value: "20%", delta: "-1.6%" },
      { label: "Best retention", value: "Chaos", delta: "38% return" }
    ],
    chartTitle: "Mode performance score",
    chartBars: [76, 68, 84],
    tableTitle: "Mode comparison",
    tableColumns: ["Mode", "Sessions", "Win rate"],
    rows: [
      ["Standard", "3,164", "46%"],
      ["Blitz", "1,799", "39%"],
      ["Chaos", "1,241", "32%"]
    ]
  },
  {
    id: "hosts",
    label: "Host analytics",
    eyebrow: "Hosts",
    title: "Host analytics",
    description: "Understand hosting activity, purchase behavior, and repeat-host retention.",
    metrics: [
      { label: "Games hosted", value: "3,982", delta: "+7.3%" },
      { label: "Host purchases", value: "846", delta: "+6.5%" },
      { label: "Repeat hosts", value: "39%", delta: "+3.4%" },
      { label: "Avg. rooms / host", value: "2.8", delta: "+0.2" }
    ],
    tableTitle: "Host segments",
    tableColumns: ["Segment", "Hosts", "Purchase rate"],
    rows: [
      ["First-time", "2,914", "18%"],
      ["Returning", "1,068", "41%"],
      ["Power hosts", "184", "67%"]
    ]
  },
  {
    id: "live-rooms",
    label: "Live rooms",
    eyebrow: "Operations",
    title: "Live rooms overview",
    description: "A real-time placeholder for active rooms, player counts, mode, status, and ping.",
    tableTitle: "Active rooms",
    tableColumns: ["Room code", "Players", "Mode", "Status", "Ping"],
    rows: [
      ["VX9K", "8/12", "Chaos", "In game", "42ms"],
      ["PL7Q", "4/10", "Blitz", "Lobby", "31ms"],
      ["MN2R", "11/12", "Standard", "Starting", "58ms"],
      ["QA5T", "2/8", "Chaos", "Waiting", "36ms"]
    ]
  },
  {
    id: "room-history",
    label: "Room history",
    eyebrow: "Operations",
    title: "Room history viewer",
    description: "Audit joins, leaves, starts, ends, and host changes for completed or active rooms.",
    timeline: [
      "20:14 — Room VX9K started in Chaos mode",
      "20:12 — Host changed from Riley to Morgan",
      "20:10 — Player Nova joined VX9K",
      "20:04 — Room VX9K created"
    ],
    tableTitle: "Recent room events",
    tableColumns: ["Time", "Room", "Event"],
    rows: [
      ["20:14", "VX9K", "Game started"],
      ["20:12", "VX9K", "Host changed"],
      ["20:10", "VX9K", "Player joined"],
      ["20:03", "PL7Q", "Player left"]
    ]
  },
  {
    id: "errors",
    label: "Error logs",
    eyebrow: "Reliability",
    title: "Error log viewer",
    description: "Placeholder log console for warnings, errors, and critical platform issues.",
    metrics: [
      { label: "Warnings", value: "14", delta: "Last 24h" },
      { label: "Errors", value: "3", delta: "Last 24h" },
      { label: "Critical", value: "0", delta: "Clear" },
      { label: "MTTR", value: "8m", delta: "Target met" }
    ],
    tableTitle: "Latest logs",
    tableColumns: ["Severity", "Source", "Message"],
    rows: [
      ["Warning", "socket", "Reconnect spike detected"],
      ["Error", "checkout", "Payment retry required"],
      ["Warning", "room", "Ping above threshold"]
    ]
  },
  {
    id: "balancing",
    label: "Balancing metrics",
    eyebrow: "Gameplay",
    title: "Gameplay balancing metrics",
    description: "Tune Heat Surge, Corruption, Partial Break, death reasons, and combo difficulty.",
    metrics: [
      { label: "Heat Surge", value: "18%", delta: "Target 15–22%" },
      { label: "Corruption", value: "12%", delta: "Target 10–16%" },
      { label: "Partial Break", value: "27%", delta: "Target 24–30%" },
      { label: "Average combo", value: "7.4x", delta: "+0.8x" }
    ],
    tableTitle: "Death reasons",
    tableColumns: ["Reason", "Share", "Trend"],
    rows: [
      ["Timeout", "34%", "Stable"],
      ["Corruption overload", "28%", "+2%"],
      ["Missed chain", "21%", "-1%"],
      ["Heat Surge", "17%", "+1%"]
    ]
  },
  {
    id: "previews",
    label: "Preview analytics",
    eyebrow: "Growth",
    title: "Preview analytics",
    description: "Track preview starts, completions, and preview-to-purchase conversion.",
    metrics: [
      { label: "Preview starts", value: "8,742", delta: "+8.1%" },
      { label: "Completions", value: "5,916", delta: "+6.6%" },
      { label: "Completion rate", value: "67.7%", delta: "Healthy" },
      { label: "Preview → purchase", value: "14.7%", delta: "+1.9%" }
    ],
    chartTitle: "Preview completion trend",
    chartBars: [58, 62, 66, 61, 70, 74, 78],
    tableTitle: "Preview drop-off",
    tableColumns: ["Moment", "Drop-off", "Opportunity"],
    rows: [
      ["Intro", "11%", "Shorten setup"],
      ["First challenge", "14%", "Add hint"],
      ["Purchase CTA", "7%", "Clarify offer"]
    ]
  },
  {
    id: "retention",
    label: "Retention analytics",
    eyebrow: "Retention",
    title: "Retention analytics",
    description: "Placeholder retention view for repeat purchases and returning host behavior.",
    metrics: [
      { label: "Repeat purchases", value: "31%", delta: "+4.3%" },
      { label: "Returning hosts", value: "39%", delta: "+3.4%" },
      { label: "30-day retention", value: "44%", delta: "+2.2%" },
      { label: "Churn risk", value: "12%", delta: "-1.5%" }
    ],
    tableTitle: "Retention cohorts",
    tableColumns: ["Cohort", "Returning hosts", "Repeat purchase"],
    rows: [
      ["Week 1", "52%", "18%"],
      ["Week 2", "44%", "25%"],
      ["Week 3", "39%", "31%"]
    ]
  },
  {
    id: "traffic",
    label: "Traffic sources",
    eyebrow: "Acquisition",
    title: "Traffic source analytics",
    description: "Understand which channels drive visitors, previews, and purchases.",
    metrics: [
      { label: "TikTok", value: "38%", delta: "+6.2%" },
      { label: "YouTube", value: "24%", delta: "+3.1%" },
      { label: "Facebook", value: "14%", delta: "-0.8%" },
      { label: "Direct", value: "19%", delta: "+1.2%" }
    ],
    tableTitle: "Channel performance",
    tableColumns: ["Source", "Visitors", "Purchases"],
    rows: [
      ["TikTok", "9,458", "512"],
      ["YouTube", "5,974", "344"],
      ["Facebook", "3,485", "128"],
      ["Direct", "4,729", "249"]
    ]
  }
];

const manageGamesSectionIds = ["game", "modes", "balancing", "previews"];
const manageGamesSections = dashboardSections.filter((section) =>
  manageGamesSectionIds.includes(section.id)
);
const navigationItems = dashboardSections.reduce((items, section) => {
  if (!manageGamesSectionIds.includes(section.id)) {
    return [...items, { type: "section", section }];
  }

  if (section.id === manageGamesSectionIds[0]) {
    return [...items, { type: "manage-games" }];
  }

  return items;
}, []);

function LoginPage({ adminKey, status, isLoading, onAdminKeyChange, onSubmit }) {
  return (
    <main className="admin-shell login-shell">
      <section className="hero-card login-card">
        <p className="eyebrow">Vervus Admin</p>
        <h1>Admin access</h1>
        <p className="lede">
          Enter the Admin Key to verify your session and open the operations dashboard.
        </p>

        <form className="login-form" onSubmit={onSubmit}>
          <label className="token-field">
            <span>Admin Key</span>
            <input
              type="password"
              value={adminKey}
              onChange={(event) => onAdminKeyChange(event.target.value)}
              placeholder="Enter Admin Key"
              autoComplete="current-password"
              autoFocus
            />
          </label>

          <button type="submit" disabled={isLoading || !adminKey.trim()}>
            {isLoading ? "Verifying..." : "Enter dashboard"}
          </button>
        </form>

        <p className="status-line" aria-live="polite">{status}</p>
      </section>
    </main>
  );
}

function SectionNavigation({ activeSectionId, onSectionChange }) {
  const [isManageGamesOpen, setIsManageGamesOpen] = useState(
    manageGamesSectionIds.includes(activeSectionId)
  );
  const isManageGamesActive = manageGamesSectionIds.includes(activeSectionId);

  function handleManageGamesClick() {
    const shouldOpen = !isManageGamesOpen;
    setIsManageGamesOpen(shouldOpen);

    if (shouldOpen && !isManageGamesActive) {
      onSectionChange(manageGamesSections[0].id);
    }
  }

  function handleSectionChange(sectionId) {
    onSectionChange(sectionId);

    if (!manageGamesSectionIds.includes(sectionId)) {
      setIsManageGamesOpen(false);
    }
  }

  return (
    <aside className="dashboard-sidebar" aria-label="Admin dashboard sections">
      <div className="sidebar-brand">
        <span className="brand-mark">V</span>
        <div>
          <strong>Vervus</strong>
          <small>Admin panel</small>
        </div>
      </div>

      <nav className="section-nav">
        {navigationItems.map((item) => {
          if (item.type === "manage-games") {
            return (
              <div className="nav-menu-group" key="manage-games">
                <button
                  type="button"
                  className={isManageGamesActive ? "nav-item menu-toggle active" : "nav-item menu-toggle"}
                  aria-expanded={isManageGamesOpen}
                  aria-controls="manage-games-menu"
                  onClick={handleManageGamesClick}
                >
                  <span>Manage Games</span>
                  <span aria-hidden="true">{isManageGamesOpen ? "−" : "+"}</span>
                </button>

                {isManageGamesOpen && (
                  <div className="submenu-nav" id="manage-games-menu">
                    {manageGamesSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        className={section.id === activeSectionId ? "submenu-item active" : "submenu-item"}
                        onClick={() => onSectionChange(section.id)}
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.section.id}
              type="button"
              className={item.section.id === activeSectionId ? "nav-item active" : "nav-item"}
              onClick={() => handleSectionChange(item.section.id)}
            >
              {item.section.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function MetricGrid({ metrics = [] }) {
  if (!metrics.length) {
    return null;
  }

  return (
    <section className="dashboard-grid" aria-label="Key metrics">
      {metrics.map((metric) => (
        <article className="metric-card" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <em>{metric.delta}</em>
        </article>
      ))}
    </section>
  );
}

function PlaceholderChart({ title, bars }) {
  if (!bars?.length) {
    return null;
  }

  return (
    <section className="dashboard-panel chart-panel">
      <div>
        <p className="eyebrow">Placeholder chart</p>
        <h2>{title}</h2>
        <p>Mock chart styling is ready for wiring into live analytics data.</p>
      </div>
      <div className="bar-chart" aria-label={title}>
        {bars.map((height, index) => (
          <span key={`${title}-${index}`} style={{ height: `${height}%` }} />
        ))}
      </div>
    </section>
  );
}

function FunnelPanel({ funnel }) {
  if (!funnel?.length) {
    return null;
  }

  return (
    <section className="dashboard-panel funnel-panel">
      <div>
        <p className="eyebrow">Placeholder funnel</p>
        <h2>Visitor to purchase path</h2>
        <p>Each stage is represented with mock counts and relative width.</p>
      </div>
      <div className="funnel-list">
        {funnel.map((stage) => (
          <div className="funnel-stage" key={stage.label}>
            <div>
              <strong>{stage.label}</strong>
              <span>{stage.value}</span>
            </div>
            <i style={{ width: `${stage.percent}%` }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function TimelinePanel({ timeline }) {
  if (!timeline?.length) {
    return null;
  }

  return (
    <section className="dashboard-panel timeline-panel">
      <div>
        <p className="eyebrow">Audit trail</p>
        <h2>Room event stream</h2>
        <p>Placeholder timeline for room joins, leaves, starts, ends, and host changes.</p>
      </div>
      <ol className="timeline-list">
        {timeline.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function DataTable({ title, columns = [], rows = [] }) {
  if (!columns.length || !rows.length) {
    return null;
  }

  return (
    <section className="table-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Placeholder table</p>
          <h2>{title}</h2>
        </div>
        <span>Mock data</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.join("-")}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DashboardPage({ overview, status, isLoading, onRefresh, onSignOut }) {
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

        <MetricGrid metrics={activeSection.metrics} />
        <FunnelPanel funnel={activeSection.funnel} />
        <PlaceholderChart title={activeSection.chartTitle} bars={activeSection.chartBars} />
        <TimelinePanel timeline={activeSection.timeline} />
        <DataTable
          title={activeSection.tableTitle}
          columns={activeSection.tableColumns}
          rows={activeSection.rows}
        />
      </div>
    </main>
  );
}

function App() {
  const [adminKey, setAdminKey] = useState("");
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState("Enter your Admin Key to continue.");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  async function loadOverview(key = adminKey) {
    setIsLoading(true);
    setStatus("Verifying Admin Key...");

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/overview`, {
        headers: key ? { "X-Admin-Token": key } : {}
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with ${response.status}`);
      }

      setOverview(payload);
      setIsAuthenticated(true);
      setStatus("Connected to admin server.");
    } catch (error) {
      setOverview(null);
      setIsAuthenticated(false);
      setStatus(error.message || "Unable to verify Admin Key.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogin(event) {
    event.preventDefault();
    const trimmedAdminKey = adminKey.trim();
    setAdminKey(trimmedAdminKey);
    loadOverview(trimmedAdminKey);
  }

  function handleSignOut() {
    setAdminKey("");
    setOverview(null);
    setIsAuthenticated(false);
    setStatus("Signed out. Enter your Admin Key to continue.");
  }

  if (isAuthenticated) {
    return (
      <DashboardPage
        overview={overview}
        status={status}
        isLoading={isLoading}
        onRefresh={() => loadOverview(adminKey)}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <LoginPage
      adminKey={adminKey}
      status={status}
      isLoading={isLoading}
      onAdminKeyChange={setAdminKey}
      onSubmit={handleLogin}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
