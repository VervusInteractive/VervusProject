const { pool } = require("../db");
const { ensureModeConfigTables } = require("./modeConfigurations");
const {
  normalizeCurrencyCode,
  normalizeInteger,
  normalizeModeKey,
  normalizeProductKey,
  normalizeProductStatus,
  normalizeTextArray
} = require("../utils/normalizers");

async function ensureProductTables() {
  await ensureModeConfigTables();
  await pool.query(`DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'vervus_data'
        AND t.typname = 'product_status'
    ) THEN
      CREATE TYPE vervus_data.product_status AS ENUM ('active', 'inactive', 'archived');
    END IF;
  END
  $$;`);
  await pool.query(`ALTER TYPE vervus_data.product_status ADD VALUE IF NOT EXISTS 'inactive';`);
  await pool.query(`ALTER TYPE vervus_data.product_status ADD VALUE IF NOT EXISTS 'archived';`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_key TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    validity_duration_hours INTEGER NOT NULL DEFAULT 24,
    status vervus_data.product_status NOT NULL DEFAULT 'active',
    stripe_price_id TEXT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`ALTER TABLE vervus_data.products
    ADD COLUMN IF NOT EXISTS stripe_price_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS description_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();`);
  await pool.query(`UPDATE vervus_data.products
    SET description_points = '[]'::jsonb
    WHERE description_points IS NULL;`);
  await pool.query(`ALTER TABLE vervus_data.products
    ALTER COLUMN description_points SET DEFAULT '[]'::jsonb,
    ALTER COLUMN description_points SET NOT NULL;`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vervus_data.product_modes (
    product_id UUID NOT NULL REFERENCES vervus_data.products(id) ON DELETE CASCADE,
    mode_id UUID NOT NULL REFERENCES vervus_data.game_modes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, mode_id)
  );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_product_modes_mode_id ON vervus_data.product_modes(mode_id);`);
  await pool.query(`WITH default_products(product_key, product_name, price_cents, currency_code, validity_duration_hours, display_order) AS (
    VALUES
      ('glitch_standard_mode', 'GLiTCH! Mode', 500, 'USD', 24, 10),
      ('glitch_chaos_mode', 'Chaos Mode', 500, 'USD', 24, 20),
      ('glitch_blitz_mode', 'Blitz Mode', 500, 'USD', 24, 30),
      ('glitch_party_pack', 'Party Pack', 1200, 'USD', 24, 40)
  )
  INSERT INTO vervus_data.products (product_key, product_name, price_cents, currency_code, validity_duration_hours, display_order)
  SELECT product_key, product_name, price_cents, currency_code, validity_duration_hours, display_order
  FROM default_products
  ON CONFLICT (product_key) DO NOTHING;`);
  await pool.query(`WITH product_mode_keys(product_key, mode_key) AS (
    VALUES
      ('glitch_standard_mode', 'standard'),
      ('glitch_chaos_mode', 'chaos'),
      ('glitch_blitz_mode', 'blitz'),
      ('glitch_party_pack', 'standard'),
      ('glitch_party_pack', 'chaos'),
      ('glitch_party_pack', 'blitz')
  )
  INSERT INTO vervus_data.product_modes (product_id, mode_id)
  SELECT p.id, gm.id
  FROM product_mode_keys pmk
  JOIN vervus_data.products p ON p.product_key = pmk.product_key
  JOIN vervus_data.game_modes gm ON gm.mode_key = pmk.mode_key
  ON CONFLICT DO NOTHING;`);
}

async function listProducts() {
  await ensureProductTables();
  const [productResult, modeResult] = await Promise.all([
    pool.query(`SELECT p.id, p.product_key, p.product_name, p.price_cents, p.currency_code,
                       p.validity_duration_hours, p.status::text AS status, p.stripe_price_id,
                       p.description_points,
                       p.display_order, p.updated_at
                FROM vervus_data.products p
                ORDER BY p.display_order ASC, p.product_name ASC`),
    pool.query(`SELECT gm.id, gm.mode_key, gm.display_name, gm.is_enabled,
                       pm.product_id
                FROM vervus_data.game_modes gm
                LEFT JOIN vervus_data.product_modes pm ON pm.mode_id = gm.id
                ORDER BY gm.display_name ASC`)
  ]);

  const modeByProductId = new Map();
  for (const row of modeResult.rows) {
    if (!row.product_id) continue;
    const list = modeByProductId.get(row.product_id) || [];
    list.push({
      id: row.id,
      modeKey: row.mode_key,
      displayName: row.display_name,
      isEnabled: Boolean(row.is_enabled)
    });
    modeByProductId.set(row.product_id, list);
  }

  const availableModes = [];
  const seenModeKeys = new Set();
  for (const row of modeResult.rows) {
    if (seenModeKeys.has(row.mode_key)) continue;
    seenModeKeys.add(row.mode_key);
    availableModes.push({
      id: row.id,
      modeKey: row.mode_key,
      displayName: row.display_name,
      isEnabled: Boolean(row.is_enabled)
    });
  }

  return {
    products: productResult.rows.map((row) => ({
      id: row.id,
      productKey: row.product_key,
      productName: row.product_name,
      priceCents: Number(row.price_cents) || 0,
      currencyCode: row.currency_code || "USD",
      validityDurationHours: Number(row.validity_duration_hours) || 24,
      status: row.status || "active",
      stripePriceId: row.stripe_price_id || "",
      descriptionPoints: Array.isArray(row.description_points)
        ? row.description_points.map((point) => String(point || "").trim()).filter(Boolean)
        : [],
      displayOrder: Number(row.display_order) || 0,
      modes: modeByProductId.get(row.id) || [],
      updatedAt: row.updated_at
    })),
    availableModes
  };
}

async function saveProduct(payload = {}) {
  await ensureProductTables();
  const productKey = normalizeProductKey(payload.productKey);
  if (!productKey) {
    const error = new Error("productKey is required");
    error.statusCode = 400;
    throw error;
  }

  const productName = String(payload.productName || productKey).trim().slice(0, 140);
  const priceCents = normalizeInteger(payload.priceCents, 0, { min: 0, max: 100000000 });
  const currencyCode = normalizeCurrencyCode(payload.currencyCode);
  const validityDurationHours = normalizeInteger(payload.validityDurationHours, 24, { min: 1, max: 8760 });
  const status = normalizeProductStatus(payload.status);
  const stripePriceId = String(payload.stripePriceId || "").trim().slice(0, 255) || null;
  const descriptionPoints = normalizeTextArray(payload.descriptionPoints).map((point) => point.slice(0, 180)).slice(0, 12);
  const displayOrder = normalizeInteger(payload.displayOrder, 0, { min: 0, max: 1000000 });
  const modeKeys = [...new Set(normalizeTextArray(payload.modeKeys).map(normalizeModeKey).filter(Boolean))];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const productResult = await client.query(
      `INSERT INTO vervus_data.products (product_key, product_name, price_cents, currency_code, validity_duration_hours, status, stripe_price_id, description_points, display_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::vervus_data.product_status, $7, $8::jsonb, $9, now())
       ON CONFLICT (product_key) DO UPDATE
       SET product_name = EXCLUDED.product_name,
           price_cents = EXCLUDED.price_cents,
           currency_code = EXCLUDED.currency_code,
           validity_duration_hours = EXCLUDED.validity_duration_hours,
           status = EXCLUDED.status,
           stripe_price_id = EXCLUDED.stripe_price_id,
           description_points = EXCLUDED.description_points,
           display_order = EXCLUDED.display_order,
           updated_at = now()
       RETURNING id`,
      [productKey, productName, priceCents, currencyCode, validityDurationHours, status, stripePriceId, JSON.stringify(descriptionPoints), displayOrder]
    );
    const productId = productResult.rows[0].id;
    await client.query(`DELETE FROM vervus_data.product_modes WHERE product_id = $1::uuid`, [productId]);

    if (modeKeys.length) {
      const modeResult = await client.query(
        `SELECT id, mode_key
         FROM vervus_data.game_modes
         WHERE mode_key = ANY($1::text[])`,
        [modeKeys]
      );
      if (modeResult.rowCount !== modeKeys.length) {
        const knownKeys = new Set(modeResult.rows.map((row) => row.mode_key));
        const missing = modeKeys.filter((modeKey) => !knownKeys.has(modeKey));
        const error = new Error(`Unknown mode key: ${missing.join(", ")}`);
        error.statusCode = 400;
        throw error;
      }
      for (const row of modeResult.rows) {
        await client.query(
          `INSERT INTO vervus_data.product_modes (product_id, mode_id)
           VALUES ($1::uuid, $2::uuid)
           ON CONFLICT DO NOTHING`,
          [productId, row.id]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listProducts();
}

module.exports = { ensureProductTables, listProducts, saveProduct };
