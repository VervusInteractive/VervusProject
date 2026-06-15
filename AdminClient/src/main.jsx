import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";

const adminApiUrl = import.meta.env.VITE_ADMIN_API_URL || "http://localhost:3002";

const dashboardSections = [
  {
    id: "overview",
    label: "Platform overview",
    eyebrow: "Command center",
    title: "Platform overview",
    description: "Live admin connection details and service status for Vervus. Analytics cards and mock data are hidden until real reporting is connected."
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
    id: "mode-config",
    label: "Game database config",
    eyebrow: "Manage games",
    title: "Game database configuration",
    description: "Create, enable, disable, and tune the database-backed game modes served to the game client."
  },
  {
    id: "products",
    label: "Products & prices",
    eyebrow: "Commerce",
    title: "Products and prices",
    description: "View and edit purchasable products, prices, entitlement duration, sale status, and which game modes each product unlocks."
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
    description: "Monitor active rooms, player counts, mode, lifecycle status, and average player ping."
  },
  {
    id: "room-history",
    label: "Room history",
    eyebrow: "Operations",
    title: "Room history viewer",
    description: "Audit joins, leaves, starts, ends, and host changes for completed or active rooms."
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

const manageGamesSectionIds = ["game", "mode-config", "products"];
const manageGamesSections = dashboardSections.filter((section) =>
  manageGamesSectionIds.includes(section.id)
);

const emptyHeatSurgeConfig = {
  isEnabled: false,
  minimumCorrectRounds: 0,
  activationChancePercent: 0,
  durationRounds: 0,
  cooldownRounds: 0,
  timerReductionMs: 0,
  intensityBonusLevels: 0,
  transitionWarningMs: 0
};

const emptyModeForm = {
  modeKey: "",
  displayName: "",
  isEnabled: true,
  hasLastChance: true,
  resultLockMs: 500,
  transitionBeatMs: 300,
  goodRunRound: 50,
  orientationLock: "both",
  difficultyBands: [],
  heatSurgeConfig: emptyHeatSurgeConfig,
  corruptionBands: []
};

const emptyProductForm = {
  productKey: "",
  productName: "",
  priceCents: 0,
  currencyCode: "USD",
  validityDurationHours: 24,
  status: "active",
  stripePriceId: "",
  displayOrder: 0,
  modeKeys: []
};

function normalizeOrientationLock(value = "both") {
  const normalized = String(value || "both").trim().toLowerCase();
  return ["portrait", "landscape", "both"].includes(normalized) ? normalized : "both";
}

function normalizeProductKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCurrencyCode(value = "USD") {
  const normalized = String(value || "USD").trim().toUpperCase().replace(/[^A-Z]/g, "");
  return normalized.length === 3 ? normalized : "USD";
}

function normalizeProductForm(product = emptyProductForm) {
  return {
    productKey: product.productKey || "",
    productName: product.productName || "",
    priceCents: product.priceCents ?? 0,
    currencyCode: normalizeCurrencyCode(product.currencyCode),
    validityDurationHours: product.validityDurationHours ?? 24,
    status: product.status || "active",
    stripePriceId: product.stripePriceId || "",
    displayOrder: product.displayOrder ?? 0,
    modeKeys: Array.isArray(product.modeKeys)
      ? product.modeKeys
      : (product.modes || []).map((mode) => mode.modeKey).filter(Boolean)
  };
}

function normalizeModeForm(mode = emptyModeForm) {
  return {
    modeKey: mode.modeKey || "",
    displayName: mode.displayName || "",
    isEnabled: mode.isEnabled ?? true,
    hasLastChance: mode.hasLastChance ?? true,
    resultLockMs: mode.resultLockMs ?? 500,
    transitionBeatMs: mode.transitionBeatMs ?? 300,
    goodRunRound: mode.goodRunRound ?? 50,
    orientationLock: normalizeOrientationLock(mode.orientationLock),
    difficultyBands: Array.isArray(mode.difficultyBands) ? mode.difficultyBands : [],
    heatSurgeConfig: mode.heatSurgeConfig || emptyHeatSurgeConfig,
    corruptionBands: Array.isArray(mode.corruptionBands) ? mode.corruptionBands : []
  };
}

const deviationTypeOptions = [
  { value: "shape_swap", label: "Shape swap" },
  { value: "false_twin", label: "False twin" },
  { value: "partial_break", label: "Partial break" }
];

const falseTwinTypeOptions = [
  { value: "readable_twin", label: "Readable twin" },
  { value: "doubt_twin", label: "Doubt twin" }
];

const visualEffectOptions = [
  { value: "subtle_flicker_pulse", label: "Subtle flicker pulse" },
  { value: "small_screen_edge_cracks", label: "Small edge cracks" },
  { value: "unstable_transition_beat", label: "Unstable transition beat" },
  { value: "slightly_more_unstable_transition_beat", label: "Slightly unstable transition beat" },
  { value: "light_color_instability", label: "Light color instability" },
  { value: "one_or_more_screens_get_light_color_instability", label: "One or more screens get color instability" },
  { value: "clearer_hue_drift", label: "Clearer hue drift" },
  { value: "light_chromatic_shift", label: "Light chromatic shift" },
  { value: "distort_pulse_before_reveal", label: "Distort pulse before reveal" },
  { value: "interference_pulse_before_reveal", label: "Interference pulse before reveal" },
  { value: "static_surge_transition", label: "Static surge transition" },
  { value: "multiple_light_effects", label: "Multiple light effects" },
  { value: "two_heavier_corruption_layers", label: "Two heavier corruption layers" },
  { value: "overload_reveal", label: "Overload reveal" },
  { value: "overload_transition", label: "Overload transition" },
  { value: "static_interference", label: "Static interference" },
  { value: "flicker_overlap", label: "Flicker overlap" },
  { value: "stronger_hue_drift", label: "Stronger hue drift" },
  { value: "color_flip_before_reveal", label: "Color flip before reveal" },
  { value: "invert_flash_before_reveal", label: "Invert flash before reveal" },
  { value: "aggressive_screen_pulse", label: "Aggressive screen pulse" },
  { value: "unstable_screen_pulse", label: "Unstable screen pulse" },
  { value: "brighter_transition_pulse", label: "Brighter transition pulse" },
  { value: "short_distort_pulse_just_before_reveal", label: "Short distort pulse before reveal" },
  { value: "short_interference_pulse_before_reveal", label: "Short interference pulse before reveal" },
  { value: "short_static_surge_in_the_transition_beat", label: "Short static surge in transition beat" },
  { value: "heavier_edge_cracks", label: "Heavier edge cracks" },
  { value: "multiple_light_effects_may_be_active_together", label: "Multiple light effects active together" },
  { value: "stronger_reveal_distortion", label: "Stronger reveal distortion" },
  { value: "dirty_reveal", label: "Dirty reveal" },
  { value: "two_heavier_corruption_layers_at_once", label: "Two heavier corruption layers at once" },
  { value: "reveal_and_transition_feel_like_the_run_could_break_at_any_moment", label: "Unstable reveal and transition" },
  { value: "overload_feeling_should_peak_without_making_core_information_unfairly_unreadable", label: "Readable overload peak" },
  { value: "stronger_hue_drift_with_static", label: "Stronger hue drift with static" },
  { value: "maximum_combined_corruption", label: "Maximum combined corruption" }
];

const audioEffectOptions = [
  { value: "first_light_scrape_layer", label: "First light scrape layer" },
  { value: "extra_audio_layer", label: "Extra audio layer" },
  { value: "audio_fray_or_strain", label: "Audio fray / strain" },
  { value: "heavier_feedback_impact", label: "Heavier feedback impact" },
  { value: "audio_fray_or_scrape", label: "Audio fray / scrape" },
  { value: "light_audio_clipping", label: "Light audio clipping" },
  { value: "slight_audio_distortion", label: "Slight audio distortion" },
  { value: "aggressive_audio_distortion", label: "Aggressive audio distortion" },
  { value: "more_intense_audio_layer", label: "More intense audio layer" },
  { value: "heavier_bass_pulse", label: "Heavier bass pulse" },
  { value: "light_tick_acceleration", label: "Light tick acceleration" },
  { value: "subtle_bass_pulse", label: "Subtle bass pulse" },
  { value: "high_intensity_audio", label: "High intensity audio" },
  { value: "aggressive_feedback", label: "Aggressive feedback" },
  { value: "maximum_feedback_intensity", label: "Maximum feedback intensity" },
  { value: "near_overload_audio", label: "Near overload audio" }
];

function cloneModeForm(mode) {
  return {
    ...mode,
    heatSurgeConfig: { ...(mode.heatSurgeConfig || emptyHeatSurgeConfig) },
    difficultyBands: (mode.difficultyBands || []).map((band) => ({
      ...band,
      deviationMix: Array.isArray(band.deviationMix) ? band.deviationMix.map((mix) => ({ ...mix })) : [],
      falseTwinMix: Array.isArray(band.falseTwinMix) ? band.falseTwinMix.map((mix) => ({ ...mix })) : []
    })),
    corruptionBands: (mode.corruptionBands || []).map((band) => ({
      ...band,
      visualEffects: Array.isArray(band.visualEffects) ? [...band.visualEffects] : [],
      audioEffects: Array.isArray(band.audioEffects) ? [...band.audioEffects] : []
    }))
  };
}

function updateListItem(list, index, updater) {
  return list.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));
}

const visibleNavigationSectionIds = ["overview", ...manageGamesSectionIds, "live-rooms", "room-history"];

const navigationItems = visibleNavigationSectionIds.reduce((items, sectionId) => {
  const section = dashboardSections.find((dashboardSection) => dashboardSection.id === sectionId);

  if (!section) {
    return items;
  }

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



function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

function formatCombo(value) {
  return `${(Number(value) || 0).toFixed(1).replace(/\.0$/, "")}x`;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.round((Number(milliseconds) || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function humanizeKey(value) {
  const text = String(value || "unknown").replace(/[_-]+/g, " ").trim();
  if (!text) return "Unknown";
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const roomStatusLabels = {
  waiting_for_players: "Waiting for players",
  waiting_to_start: "Waiting to start",
  players_readying: "Players readying",
  starting: "Starting",
  in_game: "In game",
  game_over: "Game over",
  payment_pending: "Payment pending",
  reconnecting: "Reconnecting",
  ended: "Ended",
  expired: "Expired",
  lobby: "Waiting to start",
  preview: "In game",
  premium: "In game",
  active: "In game",
  loading: "Starting",
  paused: "Reconnecting",
  gameover: "Game over"
};

const roomEventLabels = {
  room_created: "Room created",
  room_joined: "Joined",
  room_left: "Left",
  room_started: "Started",
  room_ended: "Ended",
  room_expired: "Expired",
  room_deleted: "Deleted",
  host_changed: "Host changed",
  settings_changed: "Settings changed"
};

function formatStatusLabel(value) {
  return roomStatusLabels[String(value || "").toLowerCase()] || humanizeKey(value);
}

function formatEventLabel(value) {
  return roomEventLabels[String(value || "").toLowerCase()] || humanizeKey(value);
}

function formatPlayers(players = {}) {
  const current = Number(players.current) || 0;
  const connected = Number(players.connected) || 0;
  const max = Number(players.max) || 0;
  return max ? `${connected}/${current}/${max}` : `${connected}/${current}`;
}

function formatPing(pingMs) {
  const normalized = Number(pingMs);
  return Number.isFinite(normalized) ? `${Math.round(normalized)}ms` : "-";
}

function summarizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object") return "-";
  const importantEntries = Object.entries(metadata)
    .filter(([key]) => key !== "actorDisplayName")
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 3);
  if (!importantEntries.length) return "-";
  return importantEntries
    .map(([key, value]) => `${humanizeKey(key)}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join(", ");
}

function EmptyPanel({ title, message }) {
  return (
    <section className="table-panel empty-panel">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

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

function RoomHistoryPanel({ adminKey }) {
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Loading room history...");
  const [isLoading, setIsLoading] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [eventType, setEventType] = useState("");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setIsLoading(true);
    const params = new URLSearchParams({ limit: String(limit) });
    if (roomCode.trim()) params.set("roomCode", roomCode.trim().toUpperCase());
    if (eventType) params.set("eventType", eventType);

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/room-history?${params.toString()}`, {
        headers: adminKey ? { "X-Admin-Token": adminKey } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load room history");
      }
      setHistory(payload.history || []);
      setStatus(`Loaded ${(payload.history || []).length} room history events.`);
    } catch (error) {
      setHistory([]);
      setStatus(error.message || "Unable to load room history");
    } finally {
      setIsLoading(false);
    }
  }

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
          title="Recent room events"
          columns={["Time", "Room", "Event", "Actor", "From", "To", "Metadata"]}
          rows={historyRows}
        />
      ) : (
        <EmptyPanel title="Recent room events" message="No room history events match the current filters." />
      )}
    </>
  );
}

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
    session.modeKey,
    session.isPreview ? "Preview" : "Premium",
    session.endedAt ? formatDuration(session.durationMs) : "In progress",
    `${formatNumber(session.highestCombo)}x`,
    session.endReason || "—"
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
        columns={["Room", "Game", "Type", "Duration", "Highest combo", "End reason"]}
        rows={recentRows}
      />
    </>
  );
}

function ModeConfigPanel({ adminKey }) {
  const [modes, setModes] = useState([]);
  const [modeForm, setModeForm] = useState(emptyModeForm);
  const [configStatus, setConfigStatus] = useState("Loading database-backed game configuration...");
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    loadModes();
  }, []);

  async function loadModes() {
    setIsConfigLoading(true);
    setConfigStatus("Loading modes from database...");

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/game-modes`, {
        headers: adminKey ? { "X-Admin-Token": adminKey } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load modes");
      }

      const loadedModes = payload.modes || [];
      setModes(loadedModes);
      const selectedMode = loadedModes.find((mode) => mode.modeKey === modeForm.modeKey) || loadedModes[0] || emptyModeForm;
      selectMode(selectedMode, false);
      setConfigStatus(`Loaded ${loadedModes.length} modes from the database. Click to select; double click or use Edit config to open advanced tables.`);
    } catch (error) {
      setConfigStatus(error.message || "Unable to load modes");
    } finally {
      setIsConfigLoading(false);
    }
  }

  async function saveMode(event) {
    event.preventDefault();
    const modeKey = modeForm.modeKey.trim().toLowerCase();
    if (!modeKey) {
      setConfigStatus("Mode key is required before saving.");
      return;
    }

    setIsConfigLoading(true);
    setConfigStatus(`Saving ${modeKey} to the database...`);

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/game-modes/${encodeURIComponent(modeKey)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "X-Admin-Token": adminKey } : {})
        },
        body: JSON.stringify({ ...modeForm, modeKey })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save mode");
      }

      const loadedModes = payload.modes || [];
      setModes(loadedModes);
      const savedMode = loadedModes.find((mode) => mode.modeKey === modeKey);
      selectMode(savedMode || { ...modeForm, modeKey }, true);
      setConfigStatus(`Saved ${modeKey}. Restart or refresh game workers if they cache mode config.`);
    } catch (error) {
      setConfigStatus(error.message || "Unable to save mode");
    } finally {
      setIsConfigLoading(false);
    }
  }

  function selectMode(mode, openEditor = false) {
    const normalized = normalizeModeForm(mode);
    setModeForm(cloneModeForm(normalized));
    setIsEditorOpen(openEditor);
  }

  function createNewMode() {
    selectMode({ ...emptyModeForm, heatSurgeConfig: { ...emptyHeatSurgeConfig } }, true);
    setConfigStatus("New mode draft ready. Fill out the fields and save to create it.");
  }

  function updateField(field, value) {
    setModeForm((current) => ({ ...current, [field]: value }));
  }

  function updateDifficultyBand(index, field, value) {
    setModeForm((current) => ({
      ...current,
      difficultyBands: updateListItem(current.difficultyBands, index, (band) => ({ ...band, [field]: value }))
    }));
  }

  function updateDifficultyMix(index, mixName, mixIndex, field, value) {
    setModeForm((current) => ({
      ...current,
      difficultyBands: updateListItem(current.difficultyBands, index, (band) => ({
        ...band,
        [mixName]: updateListItem(band[mixName] || [], mixIndex, (mix) => ({ ...mix, [field]: value }))
      }))
    }));
  }

  function addDifficultyMix(index, mixName) {
    const defaults = mixName === "deviationMix"
      ? { deviationType: "shape_swap", weightPercent: 0 }
      : { falseTwinType: "readable_twin", weightPercent: 0 };
    setModeForm((current) => ({
      ...current,
      difficultyBands: updateListItem(current.difficultyBands, index, (band) => ({
        ...band,
        [mixName]: [...(band[mixName] || []), defaults]
      }))
    }));
  }

  function removeDifficultyMix(index, mixName, mixIndex) {
    setModeForm((current) => ({
      ...current,
      difficultyBands: updateListItem(current.difficultyBands, index, (band) => ({
        ...band,
        [mixName]: (band[mixName] || []).filter((_, itemIndex) => itemIndex !== mixIndex)
      }))
    }));
  }

  function addDifficultyBand() {
    setModeForm((current) => ({
      ...current,
      difficultyBands: [
        ...current.difficultyBands,
        {
          comboMin: 0,
          decisionTimeMs: 5000,
          glitchChancePercent: 0,
          sortOrder: current.difficultyBands.length,
          deviationMix: [
            { deviationType: "shape_swap", weightPercent: 100 },
            { deviationType: "false_twin", weightPercent: 0 },
            { deviationType: "partial_break", weightPercent: 0 }
          ],
          falseTwinMix: [
            { falseTwinType: "readable_twin", weightPercent: 100 },
            { falseTwinType: "doubt_twin", weightPercent: 0 }
          ]
        }
      ]
    }));
    setIsEditorOpen(true);
  }

  function removeDifficultyBand(index) {
    setModeForm((current) => ({ ...current, difficultyBands: current.difficultyBands.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function updateHeatSurgeField(field, value) {
    setModeForm((current) => ({
      ...current,
      heatSurgeConfig: { ...(current.heatSurgeConfig || emptyHeatSurgeConfig), [field]: value }
    }));
  }

  function updateCorruptionBand(index, field, value) {
    setModeForm((current) => ({
      ...current,
      corruptionBands: updateListItem(current.corruptionBands, index, (band) => ({ ...band, [field]: value }))
    }));
  }

  function updateCorruptionEffect(index, field, effectIndex, value) {
    setModeForm((current) => ({
      ...current,
      corruptionBands: updateListItem(current.corruptionBands, index, (band) => ({
        ...band,
        [field]: updateListItem(band[field] || [], effectIndex, () => value)
      }))
    }));
  }

  function addCorruptionEffect(index, field, options) {
    setModeForm((current) => ({
      ...current,
      corruptionBands: updateListItem(current.corruptionBands, index, (band) => ({
        ...band,
        [field]: [...(band[field] || []), options[0]?.value || ""]
      }))
    }));
  }

  function removeCorruptionEffect(index, field, effectIndex) {
    setModeForm((current) => ({
      ...current,
      corruptionBands: updateListItem(current.corruptionBands, index, (band) => ({
        ...band,
        [field]: (band[field] || []).filter((_, itemIndex) => itemIndex !== effectIndex)
      }))
    }));
  }

  function addCorruptionBand() {
    setModeForm((current) => ({
      ...current,
      corruptionBands: [
        ...current.corruptionBands,
        { comboMin: 0, visualEffects: [], audioEffects: [], intensityLevel: 1 }
      ]
    }));
    setIsEditorOpen(true);
  }

  function removeCorruptionBand(index) {
    setModeForm((current) => ({ ...current, corruptionBands: current.corruptionBands.filter((_, itemIndex) => itemIndex !== index) }));
  }

  return (
    <section className="mode-config-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Database controls</p>
          <h2>Configured modes</h2>
        </div>
        <div className="mode-panel-actions">
          <button type="button" className="secondary-button" onClick={loadModes} disabled={isConfigLoading}>
            {isConfigLoading ? "Working..." : "Reload modes"}
          </button>
          <button type="button" onClick={createNewMode} disabled={isConfigLoading}>
            + New mode
          </button>
        </div>
      </div>

      <div className="mode-config-layout">
        <div className="mode-list" aria-label="Database modes">
          {modes.length === 0 ? (
            <p>No modes loaded yet.</p>
          ) : modes.map((mode) => (
            <article className={mode.modeKey === modeForm.modeKey ? "mode-list-card active" : "mode-list-card"} key={mode.modeKey}>
              <button
                type="button"
                className="mode-list-item"
                onClick={() => selectMode(mode)}
                onDoubleClick={() => selectMode(mode, true)}
              >
                <strong>{mode.displayName}</strong>
                <span>{mode.modeKey} · {mode.isEnabled ? "Enabled" : "Disabled"} · Orientation: {mode.orientationLock}</span>
              </button>
              <button type="button" className="secondary-button compact-button" onClick={() => selectMode(mode, true)}>
                Edit config
              </button>
            </article>
          ))}
        </div>

        <form className="mode-config-form" onSubmit={saveMode}>
          <label>
            <span>Mode key</span>
            <input value={modeForm.modeKey} onChange={(event) => updateField("modeKey", event.target.value)} placeholder="standard" />
          </label>
          <label>
            <span>Display name</span>
            <input value={modeForm.displayName} onChange={(event) => updateField("displayName", event.target.value)} placeholder="GLiTCH!" />
          </label>
          <label>
            <span>Orientation lock</span>
            <select value={modeForm.orientationLock} onChange={(event) => updateField("orientationLock", normalizeOrientationLock(event.target.value))}>
              <option value="both">Both</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label>
            <span>Result lock ms</span>
            <input type="number" min="0" value={modeForm.resultLockMs} onChange={(event) => updateField("resultLockMs", event.target.value)} />
          </label>
          <label>
            <span>Transition beat ms</span>
            <input type="number" min="0" value={modeForm.transitionBeatMs} onChange={(event) => updateField("transitionBeatMs", event.target.value)} />
          </label>
          <label>
            <span>Good run round</span>
            <input type="number" min="1" value={modeForm.goodRunRound} onChange={(event) => updateField("goodRunRound", event.target.value)} />
          </label>
          <label className="checkbox-field">
            <span>Enabled for players</span>
            <input type="checkbox" checked={modeForm.isEnabled} onChange={(event) => updateField("isEnabled", event.target.checked)} />
          </label>
          <label className="checkbox-field">
            <span>Has last chance</span>
            <input type="checkbox" checked={modeForm.hasLastChance} onChange={(event) => updateField("hasLastChance", event.target.checked)} />
          </label>

          <div className="advanced-config-panel">
            <div className="advanced-config-header">
              <div>
                <h3>Advanced mode tables</h3>
                <p>Edit difficulty_bands with nested deviation_mix and false_twin_mix, plus heat_surge_configs and corruption_bands.</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => setIsEditorOpen((open) => !open)}>
                {isEditorOpen ? "Hide editor" : "Edit config"}
              </button>
            </div>

            {isEditorOpen && (
              <div className="advanced-config-grid">
                <section className="config-table-card">
                  <div className="config-table-heading">
                    <div>
                      <h4>Difficulty bands</h4>
                      <p>Add combo thresholds, tune timing, then choose weighted deviation and false-twin behavior from dropdowns.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={addDifficultyBand}>+ Difficulty band</button>
                  </div>

                  {modeForm.difficultyBands.length === 0 ? <p className="empty-config-copy">No difficulty bands yet.</p> : null}
                  {modeForm.difficultyBands.map((band, bandIndex) => (
                    <article className="config-row-card" key={`difficulty-${bandIndex}`}>
                      <div className="config-row-header">
                        <strong>Difficulty band #{bandIndex + 1}</strong>
                        <button type="button" className="secondary-button compact-button" onClick={() => removeDifficultyBand(bandIndex)}>Remove</button>
                      </div>
                      <div className="config-field-grid">
                        <label><span>Combo min</span><input type="number" min="0" value={band.comboMin ?? 0} onChange={(event) => updateDifficultyBand(bandIndex, "comboMin", event.target.value)} /></label>
                        <label><span>Decision time ms</span><input type="number" min="0" value={band.decisionTimeMs ?? 0} onChange={(event) => updateDifficultyBand(bandIndex, "decisionTimeMs", event.target.value)} /></label>
                        <label><span>Glitch chance %</span><input type="number" min="0" max="100" step="0.1" value={band.glitchChancePercent ?? 0} onChange={(event) => updateDifficultyBand(bandIndex, "glitchChancePercent", event.target.value)} /></label>
                        <label><span>Sort order</span><input type="number" min="0" value={band.sortOrder ?? bandIndex} onChange={(event) => updateDifficultyBand(bandIndex, "sortOrder", event.target.value)} /></label>
                      </div>

                      <div className="nested-config-grid">
                        <div className="nested-config-card">
                          <div className="nested-config-heading"><strong>Deviation mix</strong><button type="button" className="secondary-button compact-button" onClick={() => addDifficultyMix(bandIndex, "deviationMix")}>+ Mix row</button></div>
                          {(band.deviationMix || []).map((mix, mixIndex) => (
                            <div className="mix-row" key={`deviation-${bandIndex}-${mixIndex}`}>
                              <select value={mix.deviationType || "shape_swap"} onChange={(event) => updateDifficultyMix(bandIndex, "deviationMix", mixIndex, "deviationType", event.target.value)}>
                                {deviationTypeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                              </select>
                              <input type="number" min="0" max="100" step="0.1" value={mix.weightPercent ?? 0} onChange={(event) => updateDifficultyMix(bandIndex, "deviationMix", mixIndex, "weightPercent", event.target.value)} aria-label="Deviation weight percent" />
                              <button type="button" className="secondary-button compact-button" onClick={() => removeDifficultyMix(bandIndex, "deviationMix", mixIndex)}>Remove</button>
                            </div>
                          ))}
                        </div>

                        <div className="nested-config-card">
                          <div className="nested-config-heading"><strong>False twin mix</strong><button type="button" className="secondary-button compact-button" onClick={() => addDifficultyMix(bandIndex, "falseTwinMix")}>+ Mix row</button></div>
                          {(band.falseTwinMix || []).map((mix, mixIndex) => (
                            <div className="mix-row" key={`false-twin-${bandIndex}-${mixIndex}`}>
                              <select value={mix.falseTwinType || "readable_twin"} onChange={(event) => updateDifficultyMix(bandIndex, "falseTwinMix", mixIndex, "falseTwinType", event.target.value)}>
                                {falseTwinTypeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                              </select>
                              <input type="number" min="0" max="100" step="0.1" value={mix.weightPercent ?? 0} onChange={(event) => updateDifficultyMix(bandIndex, "falseTwinMix", mixIndex, "weightPercent", event.target.value)} aria-label="False twin weight percent" />
                              <button type="button" className="secondary-button compact-button" onClick={() => removeDifficultyMix(bandIndex, "falseTwinMix", mixIndex)}>Remove</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </section>

                <section className="config-table-card">
                  <div className="config-table-heading">
                    <div>
                      <h4>Heat Surge</h4>
                      <p>Use dropdowns and number fields to configure if and when the heat surge modifier activates.</p>
                    </div>
                  </div>
                  <div className="config-field-grid">
                    <label><span>Status</span><select value={modeForm.heatSurgeConfig?.isEnabled ? "true" : "false"} onChange={(event) => updateHeatSurgeField("isEnabled", event.target.value === "true")}><option value="false">Disabled</option><option value="true">Enabled</option></select></label>
                    <label><span>Minimum correct rounds</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.minimumCorrectRounds ?? 0} onChange={(event) => updateHeatSurgeField("minimumCorrectRounds", event.target.value)} /></label>
                    <label><span>Activation chance %</span><input type="number" min="0" max="100" step="0.1" value={modeForm.heatSurgeConfig?.activationChancePercent ?? 0} onChange={(event) => updateHeatSurgeField("activationChancePercent", event.target.value)} /></label>
                    <label><span>Duration rounds</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.durationRounds ?? 0} onChange={(event) => updateHeatSurgeField("durationRounds", event.target.value)} /></label>
                    <label><span>Cooldown rounds</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.cooldownRounds ?? 0} onChange={(event) => updateHeatSurgeField("cooldownRounds", event.target.value)} /></label>
                    <label><span>Timer reduction ms</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.timerReductionMs ?? 0} onChange={(event) => updateHeatSurgeField("timerReductionMs", event.target.value)} /></label>
                    <label><span>Intensity bonus levels</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.intensityBonusLevels ?? 0} onChange={(event) => updateHeatSurgeField("intensityBonusLevels", event.target.value)} /></label>
                    <label><span>Transition warning ms</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.transitionWarningMs ?? 0} onChange={(event) => updateHeatSurgeField("transitionWarningMs", event.target.value)} /></label>
                  </div>
                </section>

                <section className="config-table-card">
                  <div className="config-table-heading">
                    <div>
                      <h4>Corruption bands</h4>
                      <p>Add combo thresholds and pick visual/audio effects from dropdown rows for each band.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={addCorruptionBand}>+ Corruption band</button>
                  </div>

                  {modeForm.corruptionBands.length === 0 ? <p className="empty-config-copy">No corruption bands yet.</p> : null}
                  {modeForm.corruptionBands.map((band, bandIndex) => (
                    <article className="config-row-card" key={`corruption-${bandIndex}`}>
                      <div className="config-row-header">
                        <strong>Corruption band #{bandIndex + 1}</strong>
                        <button type="button" className="secondary-button compact-button" onClick={() => removeCorruptionBand(bandIndex)}>Remove</button>
                      </div>
                      <div className="config-field-grid">
                        <label><span>Combo min</span><input type="number" min="0" value={band.comboMin ?? 0} onChange={(event) => updateCorruptionBand(bandIndex, "comboMin", event.target.value)} /></label>
                        <label><span>Intensity level</span><input type="number" min="1" value={band.intensityLevel ?? 1} onChange={(event) => updateCorruptionBand(bandIndex, "intensityLevel", event.target.value)} /></label>
                      </div>
                      <div className="nested-config-grid">
                        <div className="nested-config-card">
                          <div className="nested-config-heading"><strong>Visual effects</strong><button type="button" className="secondary-button compact-button" onClick={() => addCorruptionEffect(bandIndex, "visualEffects", visualEffectOptions)}>+ Effect</button></div>
                          {(band.visualEffects || []).map((effect, effectIndex) => (
                            <div className="effect-row" key={`visual-${bandIndex}-${effectIndex}`}>
                              <select value={effect} onChange={(event) => updateCorruptionEffect(bandIndex, "visualEffects", effectIndex, event.target.value)}>
                                {visualEffectOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                              </select>
                              <button type="button" className="secondary-button compact-button" onClick={() => removeCorruptionEffect(bandIndex, "visualEffects", effectIndex)}>Remove</button>
                            </div>
                          ))}
                        </div>
                        <div className="nested-config-card">
                          <div className="nested-config-heading"><strong>Audio effects</strong><button type="button" className="secondary-button compact-button" onClick={() => addCorruptionEffect(bandIndex, "audioEffects", audioEffectOptions)}>+ Effect</button></div>
                          {(band.audioEffects || []).map((effect, effectIndex) => (
                            <div className="effect-row" key={`audio-${bandIndex}-${effectIndex}`}>
                              <select value={effect} onChange={(event) => updateCorruptionEffect(bandIndex, "audioEffects", effectIndex, event.target.value)}>
                                {audioEffectOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                              </select>
                              <button type="button" className="secondary-button compact-button" onClick={() => removeCorruptionEffect(bandIndex, "audioEffects", effectIndex)}>Remove</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </section>
              </div>
            )}
          </div>

          <button type="submit" disabled={isConfigLoading}>{isConfigLoading ? "Saving..." : "Save mode config"}</button>
        </form>
      </div>

      <p className="mode-config-status" aria-live="polite">{configStatus}</p>
    </section>
  );
}

function ProductsPanel({ adminKey }) {
  const [products, setProducts] = useState([]);
  const [availableModes, setAvailableModes] = useState([]);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [status, setStatus] = useState("Loading product catalogue...");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setIsLoading(true);
    setStatus("Loading products from database...");

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/products`, {
        headers: adminKey ? { "X-Admin-Token": adminKey } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load products");
      }

      const loadedProducts = payload.products || [];
      setProducts(loadedProducts);
      setAvailableModes(payload.availableModes || []);
      const selectedProduct = loadedProducts.find((product) => product.productKey === productForm.productKey) || loadedProducts[0] || emptyProductForm;
      selectProduct(selectedProduct);
      setStatus(`Loaded ${loadedProducts.length} products. Select a product or create a new one.`);
    } catch (error) {
      setStatus(error.message || "Unable to load products");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    const productKey = normalizeProductKey(productForm.productKey);
    if (!productKey) {
      setStatus("Product key is required before saving.");
      return;
    }
    if (!productForm.modeKeys.length) {
      setStatus("Select at least one included mode before saving.");
      return;
    }

    setIsLoading(true);
    setStatus(`Saving ${productKey} to the database...`);

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/products/${encodeURIComponent(productKey)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "X-Admin-Token": adminKey } : {})
        },
        body: JSON.stringify({
          ...productForm,
          productKey,
          currencyCode: normalizeCurrencyCode(productForm.currencyCode)
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save product");
      }

      const loadedProducts = payload.products || [];
      setProducts(loadedProducts);
      setAvailableModes(payload.availableModes || availableModes);
      const savedProduct = loadedProducts.find((product) => product.productKey === productKey);
      selectProduct(savedProduct || { ...productForm, productKey });
      setStatus(`Saved ${productKey}. New checkouts will use the updated price and included modes.`);
    } catch (error) {
      setStatus(error.message || "Unable to save product");
    } finally {
      setIsLoading(false);
    }
  }

  function selectProduct(product) {
    setProductForm(normalizeProductForm(product));
  }

  function createNewProduct() {
    setProductForm({
      ...emptyProductForm,
      displayOrder: products.length ? Math.max(...products.map((product) => Number(product.displayOrder) || 0)) + 10 : 10
    });
    setStatus("New product draft ready. Fill out the fields and save to create it.");
  }

  function updateField(field, value) {
    setProductForm((current) => ({ ...current, [field]: value }));
  }

  function toggleMode(modeKey) {
    setProductForm((current) => {
      const existing = new Set(current.modeKeys || []);
      if (existing.has(modeKey)) {
        existing.delete(modeKey);
      } else {
        existing.add(modeKey);
      }
      return { ...current, modeKeys: [...existing] };
    });
  }

  const productRows = products.map((product) => [
    product.productName,
    product.productKey,
    `${product.currencyCode} ${(Number(product.priceCents || 0) / 100).toFixed(2)}`,
    `${product.validityDurationHours}h`,
    product.status,
    (product.modes || []).map((mode) => mode.displayName || mode.modeKey).join(", ") || "-"
  ]);

  return (
    <>
      <section className="mode-config-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Product catalogue</p>
            <h2>Products and included modes</h2>
          </div>
          <div className="mode-panel-actions">
            <button type="button" className="secondary-button" onClick={loadProducts} disabled={isLoading}>
              {isLoading ? "Working..." : "Reload products"}
            </button>
            <button type="button" onClick={createNewProduct} disabled={isLoading}>
              + New product
            </button>
          </div>
        </div>

        <div className="mode-config-layout">
          <div className="mode-list" aria-label="Products">
            {products.length === 0 ? (
              <p>No products loaded yet.</p>
            ) : products.map((product) => (
              <article className={product.productKey === productForm.productKey ? "mode-list-card active" : "mode-list-card"} key={product.productKey}>
                <button type="button" className="mode-list-item" onClick={() => selectProduct(product)}>
                  <strong>{product.productName}</strong>
                  <span>{product.productKey} · {product.currencyCode} {(Number(product.priceCents || 0) / 100).toFixed(2)} · {product.status}</span>
                </button>
              </article>
            ))}
          </div>

          <form className="mode-config-form product-config-form" onSubmit={saveProduct}>
            <label>
              <span>Product key</span>
              <input value={productForm.productKey} onChange={(event) => updateField("productKey", event.target.value)} placeholder="glitch_party_pack" />
            </label>
            <label>
              <span>Product name</span>
              <input value={productForm.productName} onChange={(event) => updateField("productName", event.target.value)} placeholder="Party Pack" />
            </label>
            <label>
              <span>Price cents</span>
              <input type="number" min="0" value={productForm.priceCents} onChange={(event) => updateField("priceCents", event.target.value)} />
            </label>
            <label>
              <span>Currency</span>
              <input value={productForm.currencyCode} maxLength={3} onChange={(event) => updateField("currencyCode", event.target.value.toUpperCase())} placeholder="USD" />
            </label>
            <label>
              <span>Validity hours</span>
              <input type="number" min="1" value={productForm.validityDurationHours} onChange={(event) => updateField("validityDurationHours", event.target.value)} />
            </label>
            <label>
              <span>Status</span>
              <select value={productForm.status} onChange={(event) => updateField("status", event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              <span>Display order</span>
              <input type="number" min="0" value={productForm.displayOrder} onChange={(event) => updateField("displayOrder", event.target.value)} />
            </label>
            <label>
              <span>Stripe price id</span>
              <input value={productForm.stripePriceId} onChange={(event) => updateField("stripePriceId", event.target.value)} placeholder="Optional" />
            </label>

            <div className="advanced-config-panel product-mode-panel">
              <div className="advanced-config-header">
                <div>
                  <h3>Included modes</h3>
                  <p>Purchases grant entitlement only for the selected database-backed modes.</p>
                </div>
              </div>
              <div className="product-mode-grid">
                {availableModes.map((mode) => (
                  <label className="checkbox-field product-mode-option" key={mode.modeKey}>
                    <span>{mode.displayName || mode.modeKey}</span>
                    <input
                      type="checkbox"
                      checked={(productForm.modeKeys || []).includes(mode.modeKey)}
                      onChange={() => toggleMode(mode.modeKey)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save product"}</button>
          </form>
        </div>

        <p className="mode-config-status" aria-live="polite">{status}</p>
      </section>

      <DataTable
        title="Current products"
        columns={["Product", "Key", "Price", "Validity", "Status", "Included modes"]}
        rows={productRows}
      />
    </>
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
          <h2>{title}</h2>
        </div>
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
        adminKey={adminKey}
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
