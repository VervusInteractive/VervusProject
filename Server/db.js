const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
});

async function testDbConnection() { await pool.query('SELECT 1'); }
async function ensureRoomTrackingTables() {
  const sqlPath = path.join(__dirname, "sql_room_history_and_errors.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await pool.query(sql);
}

async function logRoomHistoryEvent({ roomCode, eventType, actorPlayerId = null, fromStatus = null, toStatus = null, metadata = {} }) {
  await ensureRoomTrackingTables();
  await pool.query(
    `INSERT INTO vervus_data.room_history (room_id, room_code, event_type, actor_player_id, from_status, to_status, metadata)
     SELECT r.id, r.room_code, $2, $3::uuid, $4::vervus_data.room_status, $5::vervus_data.room_status, $6::jsonb
     FROM vervus_data.rooms r
     WHERE r.room_code = $1`,
    [roomCode, eventType, actorPlayerId, fromStatus, toStatus, JSON.stringify(metadata || {})]
  );
}

async function logErrorEntry({ roomCode = null, playerId = null, source, errorCode = null, severity = 'error', message, stackTrace = null, context = {} }) {
  await ensureRoomTrackingTables();
  await pool.query(
    `INSERT INTO vervus_data.error_logs (room_id, room_code, player_id, source, error_code, severity, message, stack_trace, context)
     SELECT r.id, COALESCE($1, r.room_code), $2::uuid, $3, $4, $5, $6, $7, $8::jsonb
     FROM (SELECT NULL::uuid AS id, NULL::text AS room_code) x
     LEFT JOIN vervus_data.rooms r ON r.room_code = $1`,
    [roomCode, playerId, source, errorCode, severity, message, stackTrace, JSON.stringify(context || {})]
  );
}

async function ensurePlayerProfileTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.player_profiles (id UUID PRIMARY KEY, display_name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.player_profile_entitlements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), player_profile_id UUID NOT NULL REFERENCES vervus_data.player_profiles(id) ON DELETE CASCADE, starts_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), game_mode_id UUID REFERENCES vervus_data.game_modes(id) ON DELETE CASCADE);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_profile_entitlements_active ON vervus_data.player_profile_entitlements(player_profile_id, game_mode_id, expires_at);`);
  await pool.query(`ALTER TABLE IF EXISTS vervus_data.purchases ADD COLUMN IF NOT EXISTS entitlement_granted_at TIMESTAMPTZ NULL;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_stripe_checkout_session_unique ON vervus_data.purchases(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.player_profile_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), player_profile_id UUID NOT NULL REFERENCES vervus_data.player_profiles(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_profile_sessions_token_active ON vervus_data.player_profile_sessions(token_hash, expires_at) WHERE revoked_at IS NULL;`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.entitlement_transfer_tokens (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), source_player_profile_id UUID NOT NULL REFERENCES vervus_data.player_profiles(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ NULL, consumed_by_player_profile_id UUID REFERENCES vervus_data.player_profiles(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_entitlement_transfer_tokens_source_active ON vervus_data.entitlement_transfer_tokens(source_player_profile_id, expires_at) WHERE consumed_at IS NULL;`);
}

function hashEntitlementTransferToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}
async function upsertPlayerProfile({ profileId, displayName }) {
  await ensurePlayerProfileTables();
  await pool.query(`INSERT INTO vervus_data.player_profiles (id, display_name, last_seen_at) VALUES ($1::uuid, $2, now()) ON CONFLICT (id) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, vervus_data.player_profiles.display_name), last_seen_at = now();`, [profileId, displayName || null]);
}
async function grantPlayerProfileEntitlement({ profileId, productKey='glitch_party_pack', hours=24 }) {
  await ensurePlayerProfileTables();
  const { rows } = await pool.query(
    `WITH target_modes AS (
       SELECT DISTINCT pm.mode_id
       FROM vervus_data.products p
       JOIN vervus_data.product_modes pm ON pm.product_id = p.id
       WHERE p.product_key = $2
         AND p.status = 'active'::vervus_data.product_status
     ), entitlement_base AS (
       SELECT tm.mode_id,
              COALESCE(
                MAX(ppe.expires_at) FILTER (WHERE ppe.expires_at > now()),
                now()
              ) AS base_expires_at
       FROM target_modes tm
       LEFT JOIN vervus_data.player_profile_entitlements ppe
         ON ppe.player_profile_id = $1::uuid
        AND ppe.game_mode_id = tm.mode_id
       GROUP BY tm.mode_id
     ), inserted AS (
       INSERT INTO vervus_data.player_profile_entitlements (player_profile_id, game_mode_id, starts_at, expires_at)
       SELECT $1::uuid,
              eb.mode_id,
              eb.base_expires_at,
              eb.base_expires_at + make_interval(hours => $3::int)
       FROM entitlement_base eb
       RETURNING expires_at
     )
     SELECT MAX(expires_at) AS expires_at
     FROM inserted;`,
    [profileId, productKey, hours]
  );
  return rows[0]?.expires_at || null;
}
async function getActivePlayerProfileEntitlement({ profileId, productKey = null }) {
  await ensurePlayerProfileTables();
  const query = productKey
    ? `SELECT ppe.expires_at
       FROM vervus_data.player_profile_entitlements ppe
       JOIN vervus_data.game_modes gm ON gm.id = ppe.game_mode_id
       JOIN vervus_data.product_modes pm ON pm.mode_id = gm.id
       JOIN vervus_data.products p ON p.id = pm.product_id
       WHERE ppe.player_profile_id = $1::uuid
         AND p.product_key = $2
         AND ppe.expires_at > now()
         AND p.status = 'active'::vervus_data.product_status
       ORDER BY ppe.expires_at DESC
       LIMIT 1`
    : `SELECT ppe.expires_at
       FROM vervus_data.player_profile_entitlements ppe
       WHERE ppe.player_profile_id = $1::uuid
         AND ppe.expires_at > now()
       ORDER BY ppe.expires_at DESC
       LIMIT 1`;
  const params = productKey ? [profileId, productKey] : [profileId];
  const { rows } = await pool.query(query, params);
  return rows[0]?.expires_at || null;
}
async function getActiveEntitledModeKeys({ profileId }) {
  await ensurePlayerProfileTables();
  const { rows } = await pool.query(
    `SELECT DISTINCT gm.mode_key
     FROM vervus_data.player_profile_entitlements ppe
     JOIN vervus_data.game_modes gm ON gm.id = ppe.game_mode_id
     WHERE ppe.player_profile_id = $1::uuid
       AND ppe.expires_at > now()`,
    [profileId]
  );
  return rows.map((row) => row.mode_key).filter(Boolean);
}
async function getActiveEntitlementExpiriesByMode({ profileId }) {
  await ensurePlayerProfileTables();
  const { rows } = await pool.query(
    `SELECT gm.mode_key, MAX(ppe.expires_at) AS expires_at
     FROM vervus_data.player_profile_entitlements ppe
     JOIN vervus_data.game_modes gm ON gm.id = ppe.game_mode_id
     WHERE ppe.player_profile_id = $1::uuid
       AND ppe.expires_at > now()
     GROUP BY gm.mode_key`,
    [profileId]
  );
  return rows.reduce((acc, row) => {
    if (!row.mode_key || !row.expires_at) return acc;
    acc[row.mode_key] = new Date(row.expires_at).getTime();
    return acc;
  }, {});
}


async function createPlayerProfileSession({ profileId, days = 30 }) {
  await ensurePlayerProfileTables();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashEntitlementTransferToken(token);
  const { rows } = await pool.query(
    `INSERT INTO vervus_data.player_profile_sessions (player_profile_id, token_hash, expires_at)
     VALUES ($1::uuid, $2, now() + make_interval(days => $3::int))
     RETURNING expires_at`,
    [profileId, tokenHash, days]
  );
  return { token, expiresAt: rows[0]?.expires_at || null };
}

async function getPlayerProfileIdBySessionToken({ token }) {
  await ensurePlayerProfileTables();
  const tokenHash = hashEntitlementTransferToken(token);
  const { rows } = await pool.query(
    `SELECT player_profile_id
     FROM vervus_data.player_profile_sessions
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > now()
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0]?.player_profile_id || null;
}

async function createEntitlementTransferToken({ sourceProfileId, ttlMinutes = 15 }) {
  await ensurePlayerProfileTables();
  const activeEntitlement = await getActivePlayerProfileEntitlement({ profileId: sourceProfileId });
  if (!activeEntitlement) return null;

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashEntitlementTransferToken(token);
  const { rows } = await pool.query(
    `INSERT INTO vervus_data.entitlement_transfer_tokens (source_player_profile_id, token_hash, expires_at)
     VALUES ($1::uuid, $2, now() + make_interval(mins => $3::int))
     RETURNING expires_at`,
    [sourceProfileId, tokenHash, ttlMinutes]
  );
  return { token, expiresAt: rows[0]?.expires_at || null };
}

async function consumeEntitlementTransferToken({ token, targetProfileId, displayName = null }) {
  await ensurePlayerProfileTables();
  const tokenHash = hashEntitlementTransferToken(token);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO vervus_data.player_profiles (id, display_name, last_seen_at)
       VALUES ($1::uuid, $2, now())
       ON CONFLICT (id) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, vervus_data.player_profiles.display_name), last_seen_at = now()`,
      [targetProfileId, displayName]
    );

    const tokenResult = await client.query(
      `SELECT id, source_player_profile_id, expires_at, consumed_at
       FROM vervus_data.entitlement_transfer_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );
    const transferToken = tokenResult.rows[0];
    if (!transferToken || transferToken.consumed_at || transferToken.expires_at <= new Date()) {
      await client.query('ROLLBACK');
      return null;
    }

    const updatedEntitlements = await client.query(
      `UPDATE vervus_data.player_profile_entitlements
       SET player_profile_id = $2::uuid
       WHERE player_profile_id = $1::uuid
         AND expires_at > now()
       RETURNING expires_at`,
      [transferToken.source_player_profile_id, targetProfileId]
    );

    if (updatedEntitlements.rowCount < 1) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE vervus_data.entitlement_transfer_tokens
       SET consumed_at = now(), consumed_by_player_profile_id = $2::uuid
       WHERE id = $1::uuid`,
      [transferToken.id, targetProfileId]
    );

    await client.query('COMMIT');
    return { profileId: targetProfileId, sourceProfileId: transferToken.source_player_profile_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getProductByKey(productKey = 'glitch_party_pack') {
  const { rows } = await pool.query(
    `SELECT id, product_key, product_name, price_cents, currency_code, validity_duration_hours, stripe_price_id
     FROM vervus_data.products
     WHERE product_key = $1 AND status = 'active'::vervus_data.product_status
     LIMIT 1`,
    [productKey]
  );
  return rows[0] || null;
}
async function createPendingPurchase({ playerId, productId, amountCents, currencyCode }) {
  const { rows } = await pool.query(
    `INSERT INTO vervus_data.purchases (player_id, product_id, amount_cents, currency_code, payment_status)
     VALUES ($1::uuid, $2::uuid, $3::int, $4, 'pending'::vervus_data.payment_status)
     RETURNING id`,
    [playerId, productId, amountCents, currencyCode]
  );
  return rows[0]?.id || null;
}
async function attachStripeSessionToPurchase({ purchaseId, stripeCheckoutSessionId }) {
  await pool.query(
    `UPDATE vervus_data.purchases
     SET stripe_checkout_session_id = $2
     WHERE id = $1::uuid`,
    [purchaseId, stripeCheckoutSessionId]
  );
}
async function completePurchaseAndGrantEntitlementByStripeSession({ stripeCheckoutSessionId, stripePaymentIntentId }) {
  if (!stripeCheckoutSessionId) return null;
  await ensurePlayerProfileTables();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT p.id,
              p.player_id,
              p.product_id,
              p.payment_status::text AS payment_status,
              p.entitlement_granted_at,
              pr.product_key,
              pr.validity_duration_hours
       FROM vervus_data.purchases p
       JOIN vervus_data.products pr ON pr.id = p.product_id
       WHERE p.stripe_checkout_session_id = $1
       FOR UPDATE`,
      [stripeCheckoutSessionId]
    );
    const purchase = rows[0];
    if (!purchase) {
      await client.query('ROLLBACK');
      return null;
    }

    if (purchase.entitlement_granted_at) {
      await client.query('COMMIT');
      return { ...purchase, granted: false, alreadyGranted: true };
    }

    if (!['pending', 'paid'].includes(purchase.payment_status)) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE vervus_data.purchases
       SET payment_status = 'paid'::vervus_data.payment_status,
           stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
           paid_at = COALESCE(paid_at, now())
       WHERE id = $1::uuid`,
      [purchase.id, stripePaymentIntentId || null]
    );

    await client.query(
      `INSERT INTO vervus_data.player_profiles (id, display_name, last_seen_at)
       VALUES ($1::uuid, NULL, now())
       ON CONFLICT (id) DO UPDATE SET last_seen_at = now()`,
      [purchase.player_id]
    );

    const entitlementResult = await client.query(
      `WITH target_modes AS (
         SELECT DISTINCT pm.mode_id
         FROM vervus_data.products p
         JOIN vervus_data.product_modes pm ON pm.product_id = p.id
         WHERE p.id = $2::uuid
           AND p.status = 'active'::vervus_data.product_status
       ), entitlement_base AS (
         SELECT tm.mode_id,
                COALESCE(
                  MAX(ppe.expires_at) FILTER (WHERE ppe.expires_at > now()),
                  now()
                ) AS base_expires_at
         FROM target_modes tm
         LEFT JOIN vervus_data.player_profile_entitlements ppe
           ON ppe.player_profile_id = $1::uuid
          AND ppe.game_mode_id = tm.mode_id
         GROUP BY tm.mode_id
       ), inserted AS (
         INSERT INTO vervus_data.player_profile_entitlements (player_profile_id, game_mode_id, starts_at, expires_at)
         SELECT $1::uuid,
                eb.mode_id,
                eb.base_expires_at,
                eb.base_expires_at + make_interval(hours => $3::int)
         FROM entitlement_base eb
         RETURNING expires_at
       )
       SELECT MAX(expires_at) AS expires_at
       FROM inserted;`,
      [purchase.player_id, purchase.product_id, purchase.validity_duration_hours || 24]
    );

    await client.query(
      `UPDATE vervus_data.purchases
       SET entitlement_granted_at = now()
       WHERE id = $1::uuid`,
      [purchase.id]
    );

    await client.query('COMMIT');
    return {
      ...purchase,
      granted: true,
      expires_at: entitlementResult.rows[0]?.expires_at || null
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function recordStripeWebhookEvent({ eventId, eventType, payload = {} }) {
  await ensureRoomTrackingTables();
  const { rows } = await pool.query(
    `INSERT INTO vervus_data.stripe_webhook_events (id, event_type, payload)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (id) DO UPDATE
       SET received_at = vervus_data.stripe_webhook_events.received_at
     RETURNING processed_at`,
    [eventId, eventType, JSON.stringify(payload || {})]
  );
  return !rows[0]?.processed_at;
}


async function markStripeWebhookEventProcessed({ eventId }) {
  await ensureRoomTrackingTables();
  await pool.query(
    `UPDATE vervus_data.stripe_webhook_events
     SET processed_at = now(), failed_at = NULL, error_message = NULL
     WHERE id = $1`,
    [eventId]
  );
}

async function markStripeWebhookEventFailed({ eventId, errorMessage }) {
  await ensureRoomTrackingTables();
  await pool.query(
    `UPDATE vervus_data.stripe_webhook_events
     SET failed_at = now(), error_message = $2
     WHERE id = $1`,
    [eventId, String(errorMessage || "Unknown Stripe webhook failure").slice(0, 1000)]
  );
}

async function getPurchaseStatusByStripeSession({ stripeCheckoutSessionId, playerId }) {
  if (!stripeCheckoutSessionId || !playerId) return null;
  const { rows } = await pool.query(
    `SELECT p.id,
            p.payment_status::text AS payment_status,
            p.stripe_checkout_session_id,
            p.stripe_payment_intent_id,
            p.paid_at,
            p.failed_at,
            p.entitlement_granted_at,
            pr.product_key,
            pr.product_name,
            pr.validity_duration_hours
     FROM vervus_data.purchases p
     JOIN vervus_data.products pr ON pr.id = p.product_id
     WHERE p.stripe_checkout_session_id = $1
       AND p.player_id = $2::uuid
     LIMIT 1`,
    [stripeCheckoutSessionId, playerId]
  );
  return rows[0] || null;
}

async function getRecentErrorLogs({ limit = 25 } = {}) {
  await ensureRoomTrackingTables();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const { rows } = await pool.query(
    `SELECT id, room_code, player_id, source, error_code, severity, message, context, occurred_at, resolved_at
     FROM vervus_data.error_logs
     ORDER BY occurred_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return rows;
}

async function getRecentRoomHistory({ limit = 50 } = {}) {
  await ensureRoomTrackingTables();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const { rows } = await pool.query(
    `SELECT id, room_code, event_type, event_at, actor_player_id, from_status::text AS from_status, to_status::text AS to_status, metadata
     FROM vervus_data.room_history
     ORDER BY event_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return rows;
}

async function getRecentStripeWebhookEvents({ limit = 25 } = {}) {
  await ensureRoomTrackingTables();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const { rows } = await pool.query(
    `SELECT id, event_type, received_at, processed_at, failed_at, error_message
     FROM vervus_data.stripe_webhook_events
     ORDER BY received_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return rows;
}

async function markPurchaseFailedByStripeSession({ stripeCheckoutSessionId }) {
  await pool.query(
    `UPDATE vervus_data.purchases
      SET payment_status = 'failed'::vervus_data.payment_status,
          failed_at = now()
      WHERE stripe_checkout_session_id = $1
        AND payment_status <> 'paid'::vervus_data.payment_status`,
    [stripeCheckoutSessionId]
  );
}
async function getProductById(productId) {
  const { rows } = await pool.query(
    `SELECT product_key, validity_duration_hours
     FROM vervus_data.products
     WHERE id = $1::uuid
     LIMIT 1`,
    [productId]
  );
  return rows[0] || null;
}

// existing functions
async function createRoomRecord({ roomCode, status = 'lobby', maxPlayers = 4 }) { await ensureRoomTrackingTables(); await pool.query(`INSERT INTO vervus_data.rooms (room_code, status, max_players) VALUES ($1, $2::vervus_data.room_status, $3) ON CONFLICT (room_code) DO UPDATE SET status = EXCLUDED.status`, [roomCode, status, maxPlayers]); }
async function addPlayerRecord({ roomCode, playerId, displayName, isHost = false, slot }) { await pool.query(`INSERT INTO vervus_data.players (id, room_id, display_name, is_host, connection_status, is_ready, last_seen_at, player_slot) SELECT $2::uuid, r.id, $3, $4, 'connected', false, now(), $5 FROM vervus_data.rooms r WHERE r.room_code = $1 ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, connection_status = 'connected', last_seen_at = now(), left_at = null`, [roomCode, playerId, displayName, isHost, slot]); if (isHost) await pool.query(`UPDATE vervus_data.rooms SET host_player_id = $2::uuid WHERE room_code = $1`, [roomCode, playerId]); }
async function updatePlayerReady({ playerId, isReady }) { await pool.query('UPDATE vervus_data.players SET is_ready = $2, last_seen_at = now() WHERE id = $1::uuid', [playerId, isReady]); }
async function updatePlayerConnection({ playerId, status, stateChangedAtMs = Date.now(), reconnectingStartedAtMs = null, disconnectedAtMs = null }) { await ensureRoomTrackingTables(); const isDisconnected = !['connected', 'degraded'].includes(status); await pool.query(`UPDATE vervus_data.players SET connection_status = $2, last_seen_at = now(), left_at = CASE WHEN $3 THEN now() ELSE null END, connection_state_changed_at = to_timestamp($4::double precision / 1000), reconnecting_started_at = CASE WHEN $5::bigint IS NULL THEN null ELSE to_timestamp($5::double precision / 1000) END, disconnected_at = CASE WHEN $6::bigint IS NULL THEN null ELSE to_timestamp($6::double precision / 1000) END WHERE id = $1::uuid`, [playerId, status, isDisconnected, stateChangedAtMs, reconnectingStartedAtMs, disconnectedAtMs]); }
async function deletePlayerRecord(playerId) { await pool.query('DELETE FROM vervus_data.players WHERE id = $1::uuid', [playerId]); }
async function updateRoomStatus({ roomCode, status }) { await ensureRoomTrackingTables(); await pool.query(`UPDATE vervus_data.rooms SET status = $2::vervus_data.room_status, started_at = CASE WHEN $2 IN ('preview', 'premium', 'active') THEN COALESCE(started_at, now()) ELSE started_at END, ended_at = CASE WHEN $2 IN ('ended', 'expired') THEN now() ELSE ended_at END WHERE room_code = $1`, [roomCode, status]); }
async function deleteRoomRecord(roomCode) { await pool.query('DELETE FROM vervus_data.rooms WHERE room_code = $1', [roomCode]); }

module.exports = { pool, testDbConnection, ensureRoomTrackingTables, logRoomHistoryEvent, logErrorEntry, ensurePlayerProfileTables, upsertPlayerProfile, grantPlayerProfileEntitlement, getActivePlayerProfileEntitlement, getActiveEntitledModeKeys, getActiveEntitlementExpiriesByMode, createPlayerProfileSession, getPlayerProfileIdBySessionToken, createEntitlementTransferToken, consumeEntitlementTransferToken, getProductByKey, createPendingPurchase, attachStripeSessionToPurchase, completePurchaseAndGrantEntitlementByStripeSession, recordStripeWebhookEvent, markStripeWebhookEventProcessed, markStripeWebhookEventFailed, getPurchaseStatusByStripeSession, getRecentErrorLogs, getRecentRoomHistory, getRecentStripeWebhookEvents, markPurchaseFailedByStripeSession, getProductById, createRoomRecord, addPlayerRecord, updatePlayerReady, updatePlayerConnection, deletePlayerRecord, updateRoomStatus, deleteRoomRecord };
