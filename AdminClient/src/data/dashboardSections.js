const dashboardSections = [
  {
    id: "overview",
    label: "Platform overview",
    eyebrow: "Command center",
    title: "Platform overview",
    description:
      "Practical admin visibility across the services that should own the data first: PostHog for traffic, Stripe for commerce, Render for logs, and the game database for rooms and gameplay.",
    metrics: [
      { label: "Visitors", value: "PostHog", delta: "Traffic source and session events" },
      { label: "Previews", value: "Game DB", delta: "preview_started and preview_completed" },
      { label: "Sales", value: "Stripe", delta: "Checkout and payment events" },
      { label: "Revenue", value: "Stripe", delta: "Dashboard first, webhook mirror later" }
    ],
    tableTitle: "Recommended data sources",
    tableColumns: ["Area", "Primary source", "Admin panel role"],
    rows: [
      ["Website traffic", "PostHog", "Embed or summarize only the high-value funnel events"],
      ["Sales and revenue", "Stripe", "Use Stripe as source of truth; mirror essentials into admin later"],
      ["Game sessions", "Game database", "Use existing game analytics endpoint and extend event capture"],
      ["Logs and incidents", "Render logs", "Link operational issues back to room, payment, or reconnect events"]
    ]
  },
  {
    id: "sales",
    label: "Sales dashboard",
    eyebrow: "Commerce",
    title: "Sales dashboard",
    description:
      "Track sales, revenue, products sold, checkout issues, and product performance with Stripe as the first source of truth.",
    metrics: [
      { label: "Sales", value: "Stripe", delta: "Completed checkout sessions" },
      { label: "Revenue", value: "Stripe", delta: "Gross, net, refunds, and fees" },
      { label: "Products sold", value: "Stripe", delta: "Line item and price reports" },
      { label: "Payment issues", value: "Stripe", delta: "Failed payment and dispute visibility" }
    ],
    tableTitle: "Commerce visibility plan",
    tableColumns: ["Need", "Fastest source", "Admin panel support"],
    rows: [
      ["Sales and revenue totals", "Stripe Dashboard", "Keep accessible; add summary cards when webhook data exists"],
      ["Products sold", "Stripe line items", "Map price IDs to admin products"],
      ["Checkout started", "Stripe Checkout + game event", "Capture checkout_started before redirect"],
      ["Purchase completed", "Stripe webhook", "Store purchase_completed with room and host identifiers"]
    ]
  },
  {
    id: "game",
    label: "Game analytics",
    eyebrow: "Gameplay",
    title: "Game analytics",
    description:
      "Sessions, combo performance, and duration metrics from the database-backed game analytics endpoint."
  },
  {
    id: "modes",
    label: "Mode analytics",
    eyebrow: "Gameplay",
    title: "Mode analytics",
    description:
      "Usage and performance breakdown for Standard, Blitz, and Chaos modes from recorded game sessions.",
    metrics: [
      { label: "Standard usage", value: "Track", delta: "Sessions by mode" },
      { label: "Blitz usage", value: "Track", delta: "Sessions by mode" },
      { label: "Chaos usage", value: "Track", delta: "Sessions by mode" },
      { label: "Performance", value: "Compare", delta: "Combo, duration, and completion" }
    ],
    tableTitle: "Mode analytics events",
    tableColumns: ["Metric", "Event or field", "Source"],
    rows: [
      ["Mode usage", "game_session.started mode_key", "Game database"],
      ["Mode performance", "duration_ms, final_combo, highest_combo", "Game database"],
      ["Preview versus paid mode use", "is_preview", "Game database"],
      ["Mode retention", "host_id plus repeat sessions", "Host analytics"]
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
    label: "Products and prices",
    eyebrow: "Commerce",
    title: "Products and prices",
    description:
      "View and edit purchasable products, prices, entitlement duration, sale status, and which game modes each product unlocks."
  },
  {
    id: "hosts",
    label: "Host analytics",
    eyebrow: "Hosts",
    title: "Host analytics",
    description:
      "Understand hosting activity, purchase behavior, repeat hosts, and games hosted by linking room creators to purchases.",
    metrics: [
      { label: "Games hosted", value: "Track", delta: "Game sessions per host" },
      { label: "Host purchases", value: "Stripe", delta: "Purchases linked to host identity" },
      { label: "Repeat hosts", value: "Track", delta: "Multiple game sessions by host" },
      { label: "Rooms per host", value: "Track", delta: "Room creation history" }
    ],
    tableTitle: "Host analytics requirements",
    tableColumns: ["Need", "Identifier", "Source"],
    rows: [
      ["Games hosted", "host_id or normalized email", "Game session rows"],
      ["Purchases", "stripe_customer_id plus host_id", "Stripe webhook mirror"],
      ["Repeat hosts", "stable host_id", "Rooms and sessions"],
      ["Support lookup", "room_code plus host_id", "Live rooms and room history"]
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
    id: "contact-inbox",
    label: "Contact Inbox",
    eyebrow: "Support",
    title: "Contact Inbox",
    description: "View contact page submissions stored in the game database."
  },
  {
    id: "admin-activity",
    label: "Admin activity",
    eyebrow: "Operations",
    title: "Admin activity log",
    description: "View admin logins, sign-outs, and database-backed edits recorded by the admin server."
  },
  {
    id: "errors",
    label: "Error logs",
    eyebrow: "Reliability",
    title: "Error log viewer",
    description:
      "Track warnings, errors, critical issues, room failures, payment issues, and reconnect problems without rebuilding Render or Stripe logging.",
    metrics: [
      { label: "Room errors", value: "Render", delta: "Server logs with room_code context" },
      { label: "Payment issues", value: "Stripe", delta: "Failed payments and checkout errors" },
      { label: "Reconnect issues", value: "Game DB", delta: "Room history and connection events" },
      { label: "Critical issues", value: "Alerts", delta: "Render alerts or external monitor" }
    ],
    tableTitle: "Operational log sources",
    tableColumns: ["Issue type", "Fastest source", "Admin panel support"],
    rows: [
      ["Room errors", "Render logs", "Add room_code and mode_key to server log context"],
      ["Payment issues", "Stripe events", "Show linked checkout or payment failure records later"],
      ["Reconnect issues", "Room history", "Capture reconnect_started and reconnect_failed events"],
      ["Critical incidents", "Render alerts", "Summarize incident state when monitoring is connected"]
    ]
  },
  {
    id: "balancing",
    label: "Balancing metrics",
    eyebrow: "Gameplay",
    title: "Gameplay balancing metrics",
    description:
      "Tune Heat Surge, Corruption, Partial Break, death reasons, and combo difficulty from session and round telemetry.",
    metrics: [
      { label: "Heat Surge", value: "Track", delta: "Occurrence rate per session" },
      { label: "Corruption", value: "Track", delta: "Occurrence rate per session" },
      { label: "Partial Break", value: "Track", delta: "Occurrence rate per session" },
      { label: "Average combo", value: "Live", delta: "Already available in game analytics" }
    ],
    tableTitle: "Balancing event capture",
    tableColumns: ["Metric", "Event or field", "Use"],
    rows: [
      ["Heat Surge percent", "heat_surge_triggered", "Tune intensity and frequency"],
      ["Corruption percent", "corruption_triggered", "Tune penalty pressure"],
      ["Partial Break percent", "partial_break_triggered", "Tune forgiveness"],
      ["Death reasons", "session_end end_reason", "Identify unfair or boring failure states"]
    ]
  },
  {
    id: "previews",
    label: "Preview analytics",
    eyebrow: "Growth",
    title: "Preview analytics",
    description:
      "Track preview starts, preview completions, checkout handoff, and preview-to-purchase conversion.",
    metrics: [
      { label: "Preview starts", value: "Track", delta: "preview_started" },
      { label: "Completions", value: "Track", delta: "preview_completed" },
      { label: "Checkout handoff", value: "Track", delta: "checkout_started from preview" },
      { label: "Purchase conversion", value: "Stripe", delta: "purchase_completed after preview" }
    ],
    tableTitle: "Preview funnel events",
    tableColumns: ["Stage", "Event", "Source"],
    rows: [
      ["Preview starts", "preview_started", "Game client or game server"],
      ["Preview completions", "preview_completed", "Game server"],
      ["Checkout started", "checkout_started", "Game server before Stripe redirect"],
      ["Purchase completed", "purchase_completed", "Stripe webhook"]
    ]
  },
  {
    id: "retention",
    label: "Retention analytics",
    eyebrow: "Retention",
    title: "Retention analytics",
    description:
      "Track repeat purchases and returning hosts from purchase history and room creation events.",
    metrics: [
      { label: "Repeat purchases", value: "Stripe", delta: "Customer or host-linked purchases" },
      { label: "Returning hosts", value: "Track", delta: "Host ID with multiple game sessions" },
      { label: "Purchase cohorts", value: "Later", delta: "When enough event history exists" },
      { label: "Churn risk", value: "Later", delta: "Derived from host inactivity" }
    ],
    tableTitle: "Retention dimensions",
    tableColumns: ["Metric", "Required data", "Source"],
    rows: [
      ["Repeat purchases", "stripe_customer_id or host_id", "Stripe plus admin DB"],
      ["Returning hosts", "host_id across game sessions", "Game database"],
      ["Cohorts", "first_purchase_at and follow-up purchases", "Admin analytics table"],
      ["Support follow-up", "host_id, email, latest room", "Host analytics and live rooms"]
    ]
  },
  {
    id: "traffic",
    label: "Traffic sources",
    eyebrow: "Acquisition",
    title: "Traffic source analytics",
    description:
      "Track TikTok, YouTube, Facebook, direct traffic, host clicks, checkout starts, and purchases from analytics events.",
    metrics: [
      { label: "TikTok", value: "PostHog", delta: "utm_source and referrer" },
      { label: "YouTube", value: "PostHog", delta: "utm_source and referrer" },
      { label: "Facebook", value: "PostHog", delta: "utm_source and referrer" },
      { label: "Direct", value: "PostHog", delta: "No referrer or UTM" }
    ],
    tableTitle: "Traffic attribution plan",
    tableColumns: ["Source", "Capture", "Conversion link"],
    rows: [
      ["TikTok", "utm_source=tiktok", "Persist attribution through preview and checkout"],
      ["YouTube", "utm_source=youtube", "Persist attribution through preview and checkout"],
      ["Facebook", "utm_source=facebook", "Persist attribution through preview and checkout"],
      ["Direct", "landing URL and no referrer", "Attach anonymous ID before checkout"]
    ]
  }
];

export { dashboardSections };
