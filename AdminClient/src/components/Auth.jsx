function LoginPage({ adminActor, adminKey, status, isLoading, onAdminActorChange, onAdminKeyChange, onSubmit }) {
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
            <span>Admin name</span>
            <input
              value={adminActor}
              onChange={(event) => onAdminActorChange(event.target.value)}
              placeholder="Who is signing in?"
              autoComplete="username"
            />
          </label>

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

export { LoginPage };
