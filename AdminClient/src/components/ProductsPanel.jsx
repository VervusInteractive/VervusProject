import { useEffect, useState } from "react";
import { adminApiUrl } from "../config";
import { DataTable } from "./DashboardWidgets";
import { emptyProductForm, normalizeCurrencyCode, normalizeProductForm, normalizeProductKey } from "../data/modeConfig";

function ProductsPanel({ adminActor, adminKey }) {
  const [products, setProducts] = useState([]);
  const [availableModes, setAvailableModes] = useState([]);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [status, setStatus] = useState("Loading product catalogue...");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  function getAdminHeaders(extraHeaders = {}) {
    return {
      ...extraHeaders,
      ...(adminKey ? { "X-Admin-Token": adminKey } : {}),
      ...(adminActor?.trim() ? { "X-Admin-Actor": adminActor.trim() } : {})
    };
  }

  async function loadProducts() {
    setIsLoading(true);
    setStatus("Loading products from database...");

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/products`, {
        headers: getAdminHeaders()
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
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
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

export { ProductsPanel };
