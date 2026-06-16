import { useState } from "react";
import { adminApiUrl } from "./config";
import { LoginPage } from "./components/Auth";
import { DashboardPage } from "./components/DashboardPage";

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
      adminKey={adminKey}
      status={status}
      isLoading={isLoading}
      onAdminKeyChange={setAdminKey}
      onSubmit={handleLogin}
    />
  );
}

export default App;
