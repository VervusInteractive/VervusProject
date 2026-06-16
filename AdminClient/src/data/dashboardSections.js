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
    label: "Live Rooms",
    eyebrow: "Operations",
    title: "Live rooms overview",
    description: "Monitor active rooms, player counts, mode, lifecycle status, and average player ping."
  },
  {
    id: "room-history",
    label: "Room History",
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

export { dashboardSections };
