import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";

const adminApiUrl = import.meta.env.VITE_ADMIN_API_URL || "http://localhost:3002";

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

function DashboardPage({ overview, status, isLoading, onRefresh, onSignOut }) {
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Vervus Admin</p>
          <h1>Dashboard</h1>
          <p className="lede">
            Your Admin Key was accepted. Use this page as the home for monitoring,
            moderation, purchase, and room operations.
          </p>
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

      <section className="dashboard-grid" aria-live="polite">
        <article className="metric-card">
          <span>Service</span>
          <strong>{overview?.service || "Unavailable"}</strong>
        </article>
        <article className="metric-card">
          <span>Environment</span>
          <strong>{overview?.environment || "Unknown"}</strong>
        </article>
        <article className="metric-card">
          <span>Uptime</span>
          <strong>{overview ? `${overview.uptimeSeconds}s` : "--"}</strong>
        </article>
        <article className="metric-card">
          <span>Last checked</span>
          <strong>{overview?.checkedAt || "Not checked"}</strong>
        </article>
      </section>

      <section className="status-card dashboard-panel" aria-live="polite">
        <div>
          <h2>Admin server overview</h2>
          <p>{status}</p>
        </div>
        <dl>
          <div>
            <dt>API URL</dt>
            <dd>{adminApiUrl}</dd>
          </div>
          {overview?.notes?.map((note) => (
            <div key={note}>
              <dt>Note</dt>
              <dd>{note}</dd>
            </div>
          ))}
        </dl>
      </section>
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
