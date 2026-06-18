import { useState } from "react";
import { adminApiUrl } from "./config";
import { LoginPage } from "./components/Auth";
import { DashboardPage } from "./components/DashboardPage";

function App() {
  const [adminActor, setAdminActor] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState("Enter your Admin Key to continue.");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  function getAdminHeaders(key = adminKey, actor = adminActor) {
    return {
      ...(key ? { "X-Admin-Token": key } : {}),
      ...(actor.trim() ? { "X-Admin-Actor": actor.trim() } : {})
    };
  }

  async function loadOverview(key = adminKey, { logLogin = false, actor = adminActor } = {}) {
    setIsLoading(true);
    setStatus("Verifying Admin Key...");

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/${logLogin ? "login" : "overview"}`, {
        method: logLogin ? "POST" : "GET",
        headers: getAdminHeaders(key, actor)
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
    const trimmedAdminActor = adminActor.trim();
    setAdminKey(trimmedAdminKey);
    setAdminActor(trimmedAdminActor);
    loadOverview(trimmedAdminKey, { logLogin: true, actor: trimmedAdminActor });
  }

  function handleSignOut() {
    fetch(`${adminApiUrl}/api/admin/logout`, {
      method: "POST",
      headers: getAdminHeaders()
    }).catch(() => {});
    setAdminKey("");
    setAdminActor("");
    setOverview(null);
    setIsAuthenticated(false);
    setStatus("Signed out. Enter your Admin Key to continue.");
  }

  if (isAuthenticated) {
    return (
      <DashboardPage
        adminActor={adminActor}
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
      adminActor={adminActor}
      adminKey={adminKey}
      status={status}
      isLoading={isLoading}
      onAdminActorChange={setAdminActor}
      onAdminKeyChange={setAdminKey}
      onSubmit={handleLogin}
    />
  );
}

export default App;
