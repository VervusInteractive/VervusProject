const { pool } = require("../db");
const { normalizeAnalyticsWindowDays, normalizeLimit, normalizeModeKey, normalizeOptionalText } = require("../utils/normalizers");
const { ensureCommerceTables, ensureOperationalTables } = require("./adminSchema");
const { ensureGameAnalyticsTables } = require("./gameAnalytics");
const { ensureProductTables } = require("./products");

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

function formatCurrency(cents, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currencyCode || "USD").toUpperCase()
  }).format((Number(cents) || 0) / 100);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.round((Number(milliseconds) || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatPercent(numerator, denominator) {
  const top = Number(numerator) || 0;
  const bottom = Number(denominator) || 0;
  if (bottom <= 0) return "0%";
  return `${((top / bottom) * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString();
}

function humanizeKey(value) {
  const text = String(value || "unknown").replace(/[_-]+/g, " ").trim();
  if (!text) return "Unknown";
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metric(label, value, delta = "") {
  return { label, value: String(value ?? "-"), delta };
}

function table(title, columns, rows) {
  return { title, columns, rows };
}

function buildPayload(sectionId, title, { windowDays, metrics = [], tables = [], sourceStatus = [], errorLogs } = {}) {
  const payload = {
    sectionId,
    title,
    windowDays,
    generatedAt: new Date().toISOString(),
    metrics,
    tables,
    sourceStatus
  };
  if (errorLogs) payload.errorLogs = errorLogs;
  return payload;
}

const HOST_EVENTS_CTE = `unique_profile_names AS (
  SELECT LOWER(TRIM(display_name)) AS normalized_name,
         MIN(id::text)::uuid AS profile_id
  FROM vervus_data.player_profiles
  WHERE NULLIF(TRIM(display_name), '') IS NOT NULL
  GROUP BY LOWER(TRIM(display_name))
  HAVING COUNT(*) = 1
), host_events AS (
  SELECT COALESCE(rh.actor_profile_id, rh.actor_player_id, upn.profile_id) AS profile_id,
         COALESCE(
           rh.actor_profile_id::text,
           rh.actor_player_id::text,
           upn.profile_id::text,
           'name:' || LOWER(TRIM(rh.metadata->>'actorDisplayName'))
         ) AS host_key,
         NULLIF(TRIM(rh.metadata->>'actorDisplayName'), '') AS recorded_display_name,
         rh.event_at
  FROM vervus_data.room_history rh
  LEFT JOIN unique_profile_names upn
    ON upn.normalized_name = LOWER(TRIM(rh.metadata->>'actorDisplayName'))
  WHERE rh.event_type = 'room_created'
    AND rh.event_at >= now() - ($1::int * interval '1 day')
)`;

async function prepareAnalyticsTables() {
  await ensureProductTables();
  await ensureCommerceTables();
  await ensureGameAnalyticsTables();
}

async function getPlatformOverview({ days }) {
  await prepareAnalyticsTables();
  const windowDays = normalizeAnalyticsWindowDays(days);
  const params = [windowDays];
  const [trafficResult, previewResult, salesResult, errorResult] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS visitors
                FROM vervus_data.analytics_events
                WHERE event_name = 'page_view'
                  AND event_at >= now() - ($1::int * interval '1 day')`, params),
    pool.query(`SELECT COUNT(*)::int AS previews
                FROM vervus_data.game_sessions
                WHERE is_preview = true
                  AND started_at >= now() - ($1::int * interval '1 day')`, params),
    pool.query(`SELECT COUNT(*) FILTER (WHERE payment_status::text = 'paid')::int AS sales,
                       COALESCE(SUM(amount_cents) FILTER (WHERE payment_status::text = 'paid'), 0)::int AS revenue_cents,
                       COALESCE(MAX(currency_code), 'USD') AS currency_code
                FROM vervus_data.purchases
                WHERE created_at >= now() - ($1::int * interval '1 day')`, params),
    pool.query(`SELECT COUNT(*) FILTER (WHERE severity IN ('error', 'critical'))::int AS issues
                FROM vervus_data.error_logs
                WHERE occurred_at >= now() - ($1::int * interval '1 day')
                  AND resolved_at IS NULL`, params)
  ]);

  const traffic = trafficResult.rows[0] || {};
  const preview = previewResult.rows[0] || {};
  const sales = salesResult.rows[0] || {};
  const errors = errorResult.rows[0] || {};
  return buildPayload("overview", "Platform overview", {
    windowDays,
    metrics: [
      metric("Visitors", formatNumber(traffic.visitors), "Tracked page_view events"),
      metric("Previews", formatNumber(preview.previews), "Preview game sessions"),
      metric("Sales", formatNumber(sales.sales), "Paid purchases"),
      metric("Revenue", formatCurrency(sales.revenue_cents, sales.currency_code), "Paid purchase total"),
      metric("Open issues", formatNumber(errors.issues), "Unresolved errors and critical logs")
    ],
    tables: [
      table("Functional data sources", ["Area", "Source", "Status"], [
        ["Traffic", "analytics_events", "Capturing page views from the client"],
        ["Sales", "purchases and Stripe webhooks", "Reading checkout and paid purchase records"],
        ["Gameplay", "game_sessions and analytics_events", "Reading sessions, combos, modes, and round telemetry"],
        ["Operations", "rooms, room_history, error_logs", "Reading live rooms, history, and logged issues"]
      ])
    ]
  });
}

async function getSalesAnalytics({ days }) {
  await prepareAnalyticsTables();
  const windowDays = normalizeAnalyticsWindowDays(days);
  const params = [windowDays];
  const [summaryResult, productResult, recentResult, webhookResult] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS checkout_started,
                       COUNT(*) FILTER (WHERE payment_status::text = 'paid')::int AS sales,
                       COUNT(*) FILTER (WHERE payment_status::text = 'failed')::int AS failed,
                       COUNT(*) FILTER (WHERE payment_status::text = 'pending')::int AS pending,
                       COALESCE(SUM(amount_cents) FILTER (WHERE payment_status::text = 'paid'), 0)::int AS revenue_cents,
                       COALESCE(MAX(currency_code), 'USD') AS currency_code
                FROM vervus_data.purchases
                WHERE created_at >= now() - ($1::int * interval '1 day')`, params),
    pool.query(`SELECT COALESCE(pr.product_name, 'Unknown product') AS product_name,
                       COALESCE(pr.product_key, '-') AS product_key,
                       COUNT(*) FILTER (WHERE p.payment_status::text = 'paid')::int AS sales,
                       COALESCE(SUM(p.amount_cents) FILTER (WHERE p.payment_status::text = 'paid'), 0)::int AS revenue_cents,
                       COUNT(*) FILTER (WHERE p.payment_status::text = 'failed')::int AS failed,
                       COALESCE(MAX(p.currency_code), 'USD') AS currency_code
                FROM vervus_data.purchases p
                LEFT JOIN vervus_data.products pr ON pr.id = p.product_id
                WHERE p.created_at >= now() - ($1::int * interval '1 day')
                GROUP BY pr.product_name, pr.product_key
                ORDER BY revenue_cents DESC, sales DESC
                LIMIT 12`, params),
    pool.query(`SELECT p.created_at, p.payment_status::text AS payment_status, p.amount_cents, p.currency_code,
                       p.stripe_checkout_session_id, COALESCE(pr.product_name, 'Unknown product') AS product_name
                FROM vervus_data.purchases p
                LEFT JOIN vervus_data.products pr ON pr.id = p.product_id
                ORDER BY p.created_at DESC
                LIMIT 15`),
    pool.query(`SELECT event_type, COUNT(*)::int AS count,
                       COUNT(*) FILTER (WHERE failed_at IS NOT NULL)::int AS failed
                FROM vervus_data.stripe_webhook_events
                WHERE received_at >= now() - ($1::int * interval '1 day')
                GROUP BY event_type
                ORDER BY count DESC
                LIMIT 10`, params)
  ]);

  const summary = summaryResult.rows[0] || {};
  return buildPayload("sales", "Sales dashboard", {
    windowDays,
    metrics: [
      metric("Checkout started", formatNumber(summary.checkout_started), `${windowDays} day window`),
      metric("Sales", formatNumber(summary.sales), "Paid purchases"),
      metric("Revenue", formatCurrency(summary.revenue_cents, summary.currency_code), "Paid purchase total"),
      metric("Payment issues", formatNumber(summary.failed), "Failed purchases"),
      metric("Pending", formatNumber(summary.pending), "Checkout sessions not completed yet")
    ],
    tables: [
      table("Products sold", ["Product", "Key", "Sales", "Revenue", "Failed"], productResult.rows.map((row) => [
        row.product_name,
        row.product_key,
        formatNumber(row.sales),
        formatCurrency(row.revenue_cents, row.currency_code),
        formatNumber(row.failed)
      ])),
      table("Recent purchases", ["Created", "Product", "Status", "Amount", "Stripe checkout"], recentResult.rows.map((row) => [
        formatDateTime(row.created_at),
        row.product_name,
        humanizeKey(row.payment_status),
        formatCurrency(row.amount_cents, row.currency_code),
        row.stripe_checkout_session_id || "-"
      ])),
      table("Stripe webhook events", ["Event type", "Received", "Failed"], webhookResult.rows.map((row) => [
        row.event_type,
        formatNumber(row.count),
        formatNumber(row.failed)
      ]))
    ]
  });
}

async function getModeAnalytics({ days }) {
  await prepareAnalyticsTables();
  const windowDays = normalizeAnalyticsWindowDays(days);
  const params = [windowDays];
  const [summaryResult, modeResult, previewResult] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS sessions,
                       COALESCE(AVG(final_combo) FILTER (WHERE ended_at IS NOT NULL), 0)::float AS avg_combo,
                       COALESCE(MAX(highest_combo), 0)::int AS highest_combo,
                       COALESCE(AVG(duration_ms) FILTER (WHERE ended_at IS NOT NULL AND duration_ms IS NOT NULL), 0)::float AS avg_duration_ms
                FROM vervus_data.game_sessions
                WHERE started_at >= now() - ($1::int * interval '1 day')`, params),
    pool.query(`SELECT COALESCE(gm.display_name, initcap(replace(gs.mode_key, '_', ' '))) AS mode_name,
                       gs.mode_key,
                       COUNT(*)::int AS sessions,
                       COUNT(*) FILTER (WHERE gs.is_preview)::int AS previews,
                       COALESCE(AVG(gs.final_combo) FILTER (WHERE gs.ended_at IS NOT NULL), 0)::float AS avg_combo,
                       COALESCE(MAX(gs.highest_combo), 0)::int AS highest_combo,
                       COALESCE(AVG(gs.duration_ms) FILTER (WHERE gs.ended_at IS NOT NULL AND gs.duration_ms IS NOT NULL), 0)::float AS avg_duration_ms
                FROM vervus_data.game_sessions gs
                LEFT JOIN vervus_data.game_modes gm ON gm.mode_key = gs.mode_key
                WHERE gs.started_at >= now() - ($1::int * interval '1 day')
                GROUP BY gs.mode_key, gm.display_name
                ORDER BY sessions DESC, mode_name ASC`, params),
    pool.query(`SELECT mode_key,
                       COUNT(*) FILTER (WHERE is_preview = true)::int AS previews,
                       COUNT(*) FILTER (WHERE is_preview = false)::int AS paid_sessions
                FROM vervus_data.game_sessions
                WHERE started_at >= now() - ($1::int * interval '1 day')
                GROUP BY mode_key
                ORDER BY mode_key ASC`, params)
  ]);

  const summary = summaryResult.rows[0] || {};
  return buildPayload("modes", "Mode analytics", {
    windowDays,
    metrics: [
      metric("Sessions", formatNumber(summary.sessions), "All modes"),
      metric("Avg. combo", `${(Number(summary.avg_combo) || 0).toFixed(1).replace(/\.0$/, "")}x`, "Completed sessions"),
      metric("Highest combo", `${formatNumber(summary.highest_combo)}x`, "Best recorded run"),
      metric("Avg. duration", formatDuration(summary.avg_duration_ms), "Completed sessions")
    ],
    tables: [
      table("Mode performance", ["Mode", "Sessions", "Usage", "Previews", "Avg. combo", "Highest", "Avg. duration"], modeResult.rows.map((row) => [
        row.mode_name,
        formatNumber(row.sessions),
        formatPercent(row.sessions, summary.sessions),
        formatNumber(row.previews),
        `${(Number(row.avg_combo) || 0).toFixed(1).replace(/\.0$/, "")}x`,
        `${formatNumber(row.highest_combo)}x`,
        formatDuration(row.avg_duration_ms)
      ])),
      table("Preview versus paid by mode", ["Mode", "Previews", "Paid sessions"], previewResult.rows.map((row) => [
        humanizeKey(row.mode_key),
        formatNumber(row.previews),
        formatNumber(row.paid_sessions)
      ]))
    ]
  });
}

async function getHostAnalytics({ days }) {
  await prepareAnalyticsTables();
  const windowDays = normalizeAnalyticsWindowDays(days);
  const params = [windowDays];
  const [summaryResult, topHostsResult, purchaseResult] = await Promise.all([
    pool.query(`WITH ${HOST_EVENTS_CTE}, hosted AS (
                  SELECT host_key, MIN(profile_id::text)::uuid AS profile_id, COUNT(*)::int AS rooms
                  FROM host_events
                  WHERE host_key IS NOT NULL
                  GROUP BY host_key
                )
                SELECT (SELECT COUNT(*)::int
                        FROM vervus_data.room_history
                        WHERE event_type = 'room_created'
                          AND event_at >= now() - ($1::int * interval '1 day')) AS games_hosted,
                       COUNT(*)::int AS hosts,
                       COUNT(*) FILTER (WHERE rooms > 1)::int AS repeat_hosts
                FROM hosted`, params),
    pool.query(`WITH ${HOST_EVENTS_CTE}, hosted AS (
                  SELECT host_key,
                         MIN(profile_id::text)::uuid AS profile_id,
                         MAX(recorded_display_name) AS recorded_display_name,
                         COUNT(*)::int AS rooms,
                         MAX(event_at) AS last_hosted_at
                  FROM host_events
                  WHERE host_key IS NOT NULL
                  GROUP BY host_key
                ),
                paid AS (
                  SELECT player_id AS host_id,
                         COUNT(*) FILTER (WHERE payment_status::text = 'paid')::int AS purchases,
                         COALESCE(SUM(amount_cents) FILTER (WHERE payment_status::text = 'paid'), 0)::int AS revenue_cents,
                         COALESCE(MAX(currency_code), 'USD') AS currency_code
                  FROM vervus_data.purchases
                  WHERE created_at >= now() - ($1::int * interval '1 day')
                  GROUP BY player_id
                )
                SELECT h.profile_id AS host_id,
                       COALESCE(pp.display_name, h.recorded_display_name, h.profile_id::text, 'Unknown host') AS host_name,
                       h.rooms,
                       COALESCE(p.purchases, 0)::int AS purchases,
                       COALESCE(p.revenue_cents, 0)::int AS revenue_cents,
                       COALESCE(p.currency_code, 'USD') AS currency_code,
                       h.last_hosted_at
                FROM hosted h
                LEFT JOIN paid p ON p.host_id = h.profile_id
                LEFT JOIN vervus_data.player_profiles pp ON pp.id = h.profile_id
                ORDER BY h.rooms DESC, purchases DESC, h.last_hosted_at DESC
                LIMIT 15`, params),
    pool.query(`SELECT COUNT(*) FILTER (WHERE payment_status::text = 'paid')::int AS host_purchases,
                       COUNT(DISTINCT player_id) FILTER (WHERE payment_status::text = 'paid')::int AS purchasing_hosts
                FROM vervus_data.purchases
                WHERE created_at >= now() - ($1::int * interval '1 day')`, params)
  ]);

  const summary = summaryResult.rows[0] || {};
  const purchases = purchaseResult.rows[0] || {};
  return buildPayload("hosts", "Host analytics", {
    windowDays,
    metrics: [
      metric("Games hosted", formatNumber(summary.games_hosted), "Room creation events"),
      metric("Hosts", formatNumber(summary.hosts), "Unique room creators"),
      metric("Repeat hosts", formatPercent(summary.repeat_hosts, summary.hosts), `${formatNumber(summary.repeat_hosts)} repeat hosts`),
      metric("Host purchases", formatNumber(purchases.host_purchases), `${formatNumber(purchases.purchasing_hosts)} purchasing hosts`)
    ],
    tables: [
      table("Top hosts", ["Host", "Rooms hosted", "Purchases", "Revenue", "Last hosted"], topHostsResult.rows.map((row) => [
        row.host_name,
        formatNumber(row.rooms),
        formatNumber(row.purchases),
        formatCurrency(row.revenue_cents, row.currency_code),
        formatDateTime(row.last_hosted_at)
      ]))
    ]
  });
}

async function getErrorAnalytics({ days, limit, severity }) {
  await ensureOperationalTables();
  const windowDays = normalizeAnalyticsWindowDays(days);
  const safeLimit = normalizeLimit(limit, 50, 200);
  const normalizedSeverity = normalizeOptionalText(severity, 20).toLowerCase();
  const params = [windowDays, safeLimit];
  const severityFilter = ["debug", "info", "warning", "error", "critical"].includes(normalizedSeverity)
    ? `AND severity = $3`
    : "";
  const listParams = severityFilter ? [...params, normalizedSeverity] : params;
  const [summaryResult, latestResult, reconnectResult, webhookResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) FILTER (WHERE severity = 'warning')::int AS warnings,
                       COUNT(*) FILTER (WHERE severity = 'error')::int AS errors,
                       COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
                       COUNT(*) FILTER (WHERE resolved_at IS NULL)::int AS open_issues
                FROM vervus_data.error_logs
                WHERE occurred_at >= now() - ($1::int * interval '1 day')`, [windowDays]),
    pool.query(`SELECT id, room_id, room_code, player_id, occurred_at, severity, source,
                       error_code, message, stack_trace, context, resolved_at
                FROM vervus_data.error_logs
                WHERE occurred_at >= now() - ($1::int * interval '1 day')
                ${severityFilter}
                ORDER BY occurred_at DESC
                LIMIT $2`, listParams),
    pool.query(`SELECT event_at, room_code, event_type, metadata->>'reason' AS reason
                FROM vervus_data.room_history
                WHERE event_at >= now() - ($1::int * interval '1 day')
                  AND (
                    to_status::text = 'reconnecting'
                    OR metadata->>'reason' ILIKE '%reconnect%'
                    OR metadata->>'reason' ILIKE '%disconnect%'
                  )
                ORDER BY event_at DESC
                LIMIT 15`, [windowDays]),
    pool.query(`SELECT received_at, event_type, failed_at, error_message
                FROM vervus_data.stripe_webhook_events
                WHERE received_at >= now() - ($1::int * interval '1 day')
                  AND failed_at IS NOT NULL
                ORDER BY received_at DESC
                LIMIT 15`, [windowDays])
  ]);

  const summary = summaryResult.rows[0] || {};
  return buildPayload("errors", "Error log viewer", {
    windowDays,
    errorLogs: latestResult.rows.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      roomCode: row.room_code,
      playerId: row.player_id,
      occurredAt: row.occurred_at,
      severity: row.severity,
      source: row.source,
      errorCode: row.error_code,
      message: row.message,
      stackTrace: row.stack_trace,
      context: row.context || {},
      resolvedAt: row.resolved_at
    })),
    metrics: [
      metric("Warnings", formatNumber(summary.warnings), `${windowDays} day window`),
      metric("Errors", formatNumber(summary.errors), "Logged server errors"),
      metric("Critical", formatNumber(summary.critical), "Critical logs"),
      metric("Open issues", formatNumber(summary.open_issues), "Unresolved logs")
    ],
    tables: [
      table("Latest logs", ["Time", "Severity", "Source", "Room", "Code", "Message", "Resolved"], latestResult.rows.map((row) => [
        formatDateTime(row.occurred_at),
        humanizeKey(row.severity),
        row.source,
        row.room_code || "-",
        row.error_code || "-",
        row.message,
        row.resolved_at ? "Yes" : "No"
      ])),
      table("Reconnect issues", ["Time", "Room", "Event", "Reason"], reconnectResult.rows.map((row) => [
        formatDateTime(row.event_at),
        row.room_code || "-",
        humanizeKey(row.event_type),
        row.reason || "-"
      ])),
      table("Stripe webhook failures", ["Time", "Event", "Message"], webhookResult.rows.map((row) => [
        formatDateTime(row.received_at),
        row.event_type,
        row.error_message || "-"
      ]))
    ]
  });
}

async function getBalancingAnalytics({ days, modeKey }) {
  await prepareAnalyticsTables();
  const windowDays = normalizeAnalyticsWindowDays(days);
  const normalizedModeKey = normalizeModeKey(modeKey);
  const params = normalizedModeKey ? [windowDays, normalizedModeKey] : [windowDays];
  const eventModeFilter = normalizedModeKey ? "AND mode_key = $2" : "";
  const sessionModeFilter = normalizedModeKey ? "AND mode_key = $2" : "";
  const modeConfigFilter = normalizedModeKey ? "WHERE gm.mode_key = $1" : "";
  const modeConfigParams = normalizedModeKey ? [normalizedModeKey] : [];
  const [roundResult, sessionResult, deathResult, modeConfigResult] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS rounds,
                       COUNT(*) FILTER (WHERE COALESCE((metadata->>'heatSurgeActive')::boolean, false))::int AS heat_surge_rounds,
                       COUNT(*) FILTER (WHERE COALESCE((metadata->>'corruptionIntensityLevel')::int, 0) > 0)::int AS corruption_rounds,
                       COUNT(*) FILTER (WHERE metadata->>'deviationType' = 'partial_break')::int AS partial_break_rounds
                FROM vervus_data.analytics_events
                WHERE event_name = 'round_started'
                  AND event_at >= now() - ($1::int * interval '1 day')
                  ${eventModeFilter}`, params),
    pool.query(`SELECT COUNT(*)::int AS sessions,
                       COALESCE(AVG(final_combo) FILTER (WHERE ended_at IS NOT NULL), 0)::float AS avg_combo,
                       COALESCE(MAX(highest_combo), 0)::int AS highest_combo
                FROM vervus_data.game_sessions
                WHERE started_at >= now() - ($1::int * interval '1 day')
                  ${sessionModeFilter}`, params),
    pool.query(`SELECT COALESCE(end_reason, 'unknown') AS reason,
                       COUNT(*)::int AS count
                FROM vervus_data.game_sessions
                WHERE started_at >= now() - ($1::int * interval '1 day')
                  ${sessionModeFilter}
                  AND ended_at IS NOT NULL
                GROUP BY end_reason
                ORDER BY count DESC
                LIMIT 12`, params),
    pool.query(`SELECT gm.display_name,
                       gm.mode_key,
                       COALESCE(hs.activation_chance_percent, 0)::float AS heat_surge_percent,
                       COUNT(db.id)::int AS difficulty_bands
                FROM vervus_data.game_modes gm
                LEFT JOIN vervus_data.mode_heat_surge_configs hs ON hs.mode_id = gm.id
                LEFT JOIN vervus_data.mode_difficulty_bands db ON db.mode_id = gm.id
                ${modeConfigFilter}
                GROUP BY gm.display_name, gm.mode_key, hs.activation_chance_percent
                ORDER BY gm.display_name ASC`, modeConfigParams)
  ]);

  const rounds = roundResult.rows[0] || {};
  const sessions = sessionResult.rows[0] || {};
  const selectedModeName = normalizedModeKey
    ? modeConfigResult.rows[0]?.display_name || humanizeKey(normalizedModeKey)
    : "";
  return buildPayload("balancing", selectedModeName ? `Gameplay balancing metrics - ${selectedModeName}` : "Gameplay balancing metrics", {
    windowDays,
    metrics: [
      metric("Heat Surge", formatPercent(rounds.heat_surge_rounds, rounds.rounds), `${formatNumber(rounds.heat_surge_rounds)} of ${formatNumber(rounds.rounds)} rounds`),
      metric("Corruption", formatPercent(rounds.corruption_rounds, rounds.rounds), `${formatNumber(rounds.corruption_rounds)} of ${formatNumber(rounds.rounds)} rounds`),
      metric("Partial Break", formatPercent(rounds.partial_break_rounds, rounds.rounds), `${formatNumber(rounds.partial_break_rounds)} of ${formatNumber(rounds.rounds)} rounds`),
      metric("Average combo", `${(Number(sessions.avg_combo) || 0).toFixed(1).replace(/\.0$/, "")}x`, `${formatNumber(sessions.sessions)} sessions`),
      metric("Highest combo", `${formatNumber(sessions.highest_combo)}x`, "Best recorded run")
    ],
    tables: [
      table("Death reasons", ["Reason", "Count", "Share"], deathResult.rows.map((row) => [
        humanizeKey(row.reason),
        formatNumber(row.count),
        formatPercent(row.count, sessions.sessions)
      ])),
      table("Mode tuning snapshot", ["Mode", "Heat Surge config", "Difficulty bands"], modeConfigResult.rows.map((row) => [
        row.display_name || humanizeKey(row.mode_key),
        `${Number(row.heat_surge_percent || 0).toFixed(1).replace(/\.0$/, "")}%`,
        formatNumber(row.difficulty_bands)
      ]))
    ]
  });
}

async function getPreviewAnalytics({ days }) {
  await prepareAnalyticsTables();
  const windowDays = normalizeAnalyticsWindowDays(days);
  const params = [windowDays];
  const [summaryResult, modeResult, recentResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) FILTER (WHERE is_preview = true)::int AS preview_starts,
                       COUNT(*) FILTER (WHERE is_preview = true AND ended_at IS NOT NULL)::int AS preview_ends,
                       COUNT(*) FILTER (WHERE is_preview = true AND (end_reason = 'preview ended' OR metadata->>'causeLabel' = 'preview ended'))::int AS preview_completions,
                       COALESCE(AVG(duration_ms) FILTER (WHERE is_preview = true AND ended_at IS NOT NULL), 0)::float AS avg_duration_ms
                FROM vervus_data.game_sessions
                WHERE started_at >= now() - ($1::int * interval '1 day')`, params),
    pool.query(`SELECT mode_key,
                       COUNT(*)::int AS starts,
                       COUNT(*) FILTER (WHERE ended_at IS NOT NULL)::int AS ends,
                       COUNT(*) FILTER (WHERE end_reason = 'preview ended' OR metadata->>'causeLabel' = 'preview ended')::int AS completions
                FROM vervus_data.game_sessions
                WHERE is_preview = true
                  AND started_at >= now() - ($1::int * interval '1 day')
                GROUP BY mode_key
                ORDER BY starts DESC`, params),
    pool.query(`SELECT room_code, mode_key, started_at, ended_at, duration_ms, highest_combo, end_reason
                FROM vervus_data.game_sessions
                WHERE is_preview = true
                ORDER BY started_at DESC
                LIMIT 15`)
  ]);

  const summary = summaryResult.rows[0] || {};
  const conversionResult = await pool.query(`WITH preview_hosts AS (
                                               SELECT profile_id, MIN(event_at) AS first_preview_at
                                               FROM vervus_data.analytics_events
                                               WHERE event_name = 'preview_started'
                                                 AND profile_id IS NOT NULL
                                                 AND event_at >= now() - ($1::int * interval '1 day')
                                               GROUP BY profile_id
                                             ), converted_hosts AS (
                                               SELECT DISTINCT ph.profile_id
                                               FROM preview_hosts ph
                                               JOIN vervus_data.purchases p
                                                 ON p.player_id = ph.profile_id
                                                AND p.payment_status::text = 'paid'
                                                AND COALESCE(p.paid_at, p.created_at) >= ph.first_preview_at
                                             )
                                             SELECT COUNT(*)::int AS preview_hosts,
                                                    COUNT(ch.profile_id)::int AS converted_hosts
                                             FROM preview_hosts ph
                                             LEFT JOIN converted_hosts ch ON ch.profile_id = ph.profile_id`, params);
  const conversion = conversionResult.rows[0] || {};
  return buildPayload("previews", "Preview analytics", {
    windowDays,
    metrics: [
      metric("Preview starts", formatNumber(summary.preview_starts), "Preview game sessions"),
      metric("Preview completions", formatNumber(summary.preview_completions), "Ended at preview combo limit"),
      metric("Completion rate", formatPercent(summary.preview_completions, summary.preview_starts), "Completions / starts"),
      metric("Preview to purchase", formatPercent(conversion.converted_hosts, conversion.preview_hosts), `${formatNumber(conversion.converted_hosts)} of ${formatNumber(conversion.preview_hosts)} preview hosts purchased`),
      metric("Avg. preview duration", formatDuration(summary.avg_duration_ms), "Completed previews")
    ],
    tables: [
      table("Preview performance by mode", ["Mode", "Starts", "Ended", "Completions", "Completion rate"], modeResult.rows.map((row) => [
        humanizeKey(row.mode_key),
        formatNumber(row.starts),
        formatNumber(row.ends),
        formatNumber(row.completions),
        formatPercent(row.completions, row.starts)
      ])),
      table("Recent previews", ["Room", "Mode", "Started", "Duration", "Highest combo", "End reason"], recentResult.rows.map((row) => [
        row.room_code,
        humanizeKey(row.mode_key),
        formatDateTime(row.started_at),
        row.ended_at ? formatDuration(row.duration_ms) : "In progress",
        `${formatNumber(row.highest_combo)}x`,
        row.end_reason || "-"
      ]))
    ]
  });
}

async function getRetentionAnalytics({ days }) {
  await prepareAnalyticsTables();
  const windowDays = normalizeAnalyticsWindowDays(days);
  const params = [windowDays];
  const [purchaseResult, hostResult, cohortResult] = await Promise.all([
    pool.query(`WITH paid AS (
                  SELECT player_id, COUNT(*)::int AS purchases
                  FROM vervus_data.purchases
                  WHERE payment_status::text = 'paid'
                    AND created_at >= now() - ($1::int * interval '1 day')
                    AND player_id IS NOT NULL
                  GROUP BY player_id
                )
                SELECT COUNT(*)::int AS purchasing_hosts,
                       COUNT(*) FILTER (WHERE purchases > 1)::int AS repeat_purchasers,
                       COALESCE(SUM(purchases), 0)::int AS purchases
                FROM paid`, params),
    pool.query(`WITH ${HOST_EVENTS_CTE}, hosted AS (
                  SELECT host_key, COUNT(*)::int AS rooms
                  FROM host_events
                  WHERE host_key IS NOT NULL
                  GROUP BY host_key
                )
                SELECT COUNT(*)::int AS hosts,
                       COUNT(*) FILTER (WHERE rooms > 1)::int AS returning_hosts
                FROM hosted`, params),
    pool.query(`WITH first_purchase AS (
                  SELECT player_id, MIN(paid_at) AS first_paid_at
                  FROM vervus_data.purchases
                  WHERE payment_status::text = 'paid'
                    AND player_id IS NOT NULL
                  GROUP BY player_id
                ),
                cohort AS (
                  SELECT date_trunc('week', first_paid_at)::date AS cohort_week,
                         COUNT(*)::int AS buyers
                  FROM first_purchase
                  WHERE first_paid_at >= now() - ($1::int * interval '1 day')
                  GROUP BY cohort_week
                ),
                repeaters AS (
                  SELECT date_trunc('week', fp.first_paid_at)::date AS cohort_week,
                         COUNT(DISTINCT p.player_id)::int AS repeat_buyers
                  FROM first_purchase fp
                  JOIN vervus_data.purchases p ON p.player_id = fp.player_id
                   AND p.payment_status::text = 'paid'
                   AND p.paid_at > fp.first_paid_at
                  WHERE fp.first_paid_at >= now() - ($1::int * interval '1 day')
                  GROUP BY date_trunc('week', fp.first_paid_at)::date
                )
                SELECT c.cohort_week, c.buyers, COALESCE(r.repeat_buyers, 0)::int AS repeat_buyers
                FROM cohort c
                LEFT JOIN repeaters r ON r.cohort_week = c.cohort_week
                ORDER BY c.cohort_week DESC
                LIMIT 12`, params)
  ]);

  const purchases = purchaseResult.rows[0] || {};
  const hosts = hostResult.rows[0] || {};
  return buildPayload("retention", "Retention analytics", {
    windowDays,
    metrics: [
      metric("Repeat purchases", formatPercent(purchases.repeat_purchasers, purchases.purchasing_hosts), `${formatNumber(purchases.repeat_purchasers)} repeat buyers`),
      metric("Returning hosts", formatPercent(hosts.returning_hosts, hosts.hosts), `${formatNumber(hosts.returning_hosts)} returning hosts`),
      metric("Purchases", formatNumber(purchases.purchases), "Paid purchases"),
      metric("Active hosts", formatNumber(hosts.hosts), "Hosts creating rooms")
    ],
    tables: [
      table("Purchase cohorts", ["Cohort week", "Buyers", "Repeat buyers", "Repeat rate"], cohortResult.rows.map((row) => [
        String(row.cohort_week || "-"),
        formatNumber(row.buyers),
        formatNumber(row.repeat_buyers),
        formatPercent(row.repeat_buyers, row.buyers)
      ]))
    ]
  });
}

async function getTrafficAnalytics({ days }) {
  await prepareAnalyticsTables();
  const windowDays = normalizeAnalyticsWindowDays(days);
  const params = [windowDays];
  const [summaryResult, sourceResult, recentResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS visitors,
                       COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'page_view' AND session_id IS NOT NULL)::int AS unique_sessions,
                       COUNT(*) FILTER (WHERE event_name = 'host_click')::int AS host_clicks,
                       COUNT(*) FILTER (WHERE event_name = 'checkout_started')::int AS checkout_started,
                       COUNT(*) FILTER (WHERE event_name = 'purchase_completed')::int AS purchases
                FROM vervus_data.analytics_events
                WHERE event_at >= now() - ($1::int * interval '1 day')`, params),
    pool.query(`WITH sourced_events AS (
                  SELECT ae.event_name,
                         COALESCE(NULLIF(ae.source, ''), NULLIF(pv.source, ''), 'Direct') AS source
                  FROM vervus_data.analytics_events ae
                  LEFT JOIN LATERAL (
                    SELECT source
                    FROM vervus_data.analytics_events latest
                    WHERE latest.event_name = 'page_view'
                      AND latest.profile_id = ae.profile_id
                      AND latest.event_at <= ae.event_at
                      AND latest.source IS NOT NULL
                    ORDER BY latest.event_at DESC
                    LIMIT 1
                  ) pv ON true
                  WHERE ae.event_at >= now() - ($1::int * interval '1 day')
                )
                SELECT source,
                       COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS visitors,
                       COUNT(*) FILTER (WHERE event_name = 'host_click')::int AS host_clicks,
                       COUNT(*) FILTER (WHERE event_name = 'checkout_started')::int AS checkout_started,
                       COUNT(*) FILTER (WHERE event_name = 'purchase_completed')::int AS purchases
                FROM sourced_events
                GROUP BY source
                ORDER BY visitors DESC, purchases DESC
                LIMIT 15`, params),
    pool.query(`SELECT event_at, event_name, COALESCE(source, 'Direct') AS source, referrer, room_code, product_key
                FROM vervus_data.analytics_events
                WHERE event_at >= now() - ($1::int * interval '1 day')
                ORDER BY event_at DESC
                LIMIT 20`, params)
  ]);

  const summary = summaryResult.rows[0] || {};
  return buildPayload("traffic", "Traffic source analytics", {
    windowDays,
    metrics: [
      metric("Visitors", formatNumber(summary.visitors), `${formatNumber(summary.unique_sessions)} unique sessions`),
      metric("Host clicks", formatNumber(summary.host_clicks), "Create room attempts"),
      metric("Checkout started", formatNumber(summary.checkout_started), "Checkout redirects"),
      metric("Purchases", formatNumber(summary.purchases), "Stripe completed purchases")
    ],
    tables: [
      table("Source performance", ["Source", "Visitors", "Host clicks", "Checkout started", "Purchases"], sourceResult.rows.map((row) => [
        row.source || "Direct",
        formatNumber(row.visitors),
        formatNumber(row.host_clicks),
        formatNumber(row.checkout_started),
        formatNumber(row.purchases)
      ])),
      table("Recent traffic events", ["Time", "Event", "Source", "Referrer", "Room", "Product"], recentResult.rows.map((row) => [
        formatDateTime(row.event_at),
        humanizeKey(row.event_name),
        row.source || "Direct",
        row.referrer || "-",
        row.room_code || "-",
        row.product_key || "-"
      ]))
    ]
  });
}

const analyticsHandlers = {
  overview: getPlatformOverview,
  sales: getSalesAnalytics,
  modes: getModeAnalytics,
  hosts: getHostAnalytics,
  errors: getErrorAnalytics,
  balancing: getBalancingAnalytics,
  previews: getPreviewAnalytics,
  retention: getRetentionAnalytics,
  traffic: getTrafficAnalytics
};

async function getAdminAnalyticsSection(sectionId, query = {}) {
  const handler = analyticsHandlers[sectionId];
  if (!handler) {
    const error = new Error(`Unknown analytics section: ${sectionId}`);
    error.statusCode = 404;
    throw error;
  }

  return handler(query);
}

module.exports = { getAdminAnalyticsSection };
