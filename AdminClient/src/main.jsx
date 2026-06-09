import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";

const adminApiUrl = import.meta.env.VITE_ADMIN_API_URL || "http://localhost:3002";

function App() {
  const [adminToken, setAdminToken] = useState("");
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState("Ready to connect.");
  const [isLoading, setIsLoading] = useState(false);

  async function loadOverview() {
    setIsLoading(true);
    setStatus("Loading admin overview...");
    setOverview(null);

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/overview`, {
        headers: adminToken ? { "X-Admin-Token": adminToken } : {}
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with ${response.status}`);
      }

      setOverview(payload);
      setStatus("Connected to admin server.");
    } catch (error) {
      setStatus(error.message || "Unable to load admin overview.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="admin-shell">
      <section className="hero-card">
        <p className="eyebrow">Vervus Admin</p>
        <h1>Admin dashboard starter</h1>
        <p className="lede">
          A minimal Render-ready admin client for checking the admin API and growing into
          moderation, room, purchase, and operations tools.
        </p>

        <label className="token-field">
          <span>Admin token</span>
          <input
            type="password"
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder="Paste ADMIN_TOKEN"
          />
        </label>

        <button type="button" onClick={loadOverview} disabled={isLoading}>
          {isLoading ? "Connecting..." : "Load overview"}
        </button>
      </section>

      <section className="status-card" aria-live="polite">
        <h2>Server status</h2>
        <p>{status}</p>
        <dl>
          <div>
            <dt>API URL</dt>
            <dd>{adminApiUrl}</dd>
          </div>
          {overview && (
            <>
              <div>
                <dt>Service</dt>
                <dd>{overview.service}</dd>
              </div>
              <div>
                <dt>Environment</dt>
                <dd>{overview.environment}</dd>
              </div>
              <div>
                <dt>Uptime</dt>
                <dd>{overview.uptimeSeconds}s</dd>
              </div>
              <div>
                <dt>Checked</dt>
                <dd>{overview.checkedAt}</dd>
              </div>
            </>
          )}
        </dl>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
