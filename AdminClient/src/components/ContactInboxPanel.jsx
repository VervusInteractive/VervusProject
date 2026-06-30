import { useEffect, useRef, useState } from "react";
import { adminApiUrl } from "../config";
import { EmptyPanel } from "./DashboardWidgets";
import { formatDateTime } from "../utils/formatters";

function previewText(value, maxLength = 140) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized || "-";
  return `${normalized.slice(0, maxLength - 1)}...`;
}

function ContactInboxPanel({ adminKey }) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("Loading contact messages...");
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState("");
  const [limit, setLimit] = useState(50);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const requestIdRef = useRef(0);

  const selectedMessage = messages.find((message) => message.id === selectedMessageId) || null;

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setMessages([]);
    setSelectedMessageId(null);
    setStatus("Loading contact messages...");

    const params = new URLSearchParams({ limit: String(Number(limit) || 50) });
    if (search.trim()) params.set("search", search.trim());
    if (unreadOnly) params.set("unreadOnly", "true");

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/contact-messages?${params.toString()}`, {
        headers: adminKey ? { "X-Admin-Token": adminKey } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load contact messages");
      }
      if (requestId !== requestIdRef.current) return;
      const nextMessages = Array.isArray(payload.messages) ? payload.messages : [];
      setMessages(nextMessages);
      setStatus(`Loaded ${nextMessages.length} contact message${nextMessages.length === 1 ? "" : "s"}.`);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setMessages([]);
      setStatus(error.message || "Unable to load contact messages");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }

  return (
    <>
      <section className="dashboard-panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Support intake</p>
            <h2>Contact inbox filters</h2>
            <p aria-live="polite">{status}</p>
          </div>
          <div className="dashboard-actions inline-actions contact-inbox-filters">
            <label className="token-field compact-field contact-search-field">
              <span>Search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Email, subject, message" />
            </label>
            <label className="token-field compact-field">
              <span>Status</span>
              <select value={unreadOnly} onChange={(event) => setUnreadOnly(event.target.value)}>
                <option value="">All messages</option>
                <option value="true">Unread only</option>
              </select>
            </label>
            <label className="token-field compact-field">
              <span>Limit</span>
              <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </label>
            <button type="button" onClick={loadMessages} disabled={isLoading}>
              {isLoading ? "Loading..." : "Apply filters"}
            </button>
          </div>
        </div>
      </section>

      {messages.length ? (
        <section className="table-panel contact-inbox-panel">
          <div className="panel-heading">
            <div>
              <h2>Contact messages</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="contact-inbox-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Email</th>
                  <th>Subject</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message.id} className={message.id === selectedMessageId ? "active-contact-row" : ""}>
                    <td>{formatDateTime(message.createdAt)}</td>
                    <td>{message.email}</td>
                    <td>{message.subject}</td>
                    <td><span className="contact-message-preview">{previewText(message.message)}</span></td>
                    <td>{message.readAt ? "Read" : "New"}</td>
                    <td>
                      <button type="button" className="secondary-button compact-button" onClick={() => setSelectedMessageId(message.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyPanel title="Contact messages" message="No contact messages match the current filters." />
      )}

      {selectedMessage ? (
        <section className="table-panel contact-detail-panel" aria-label="Selected contact message">
          <div className="panel-heading-row">
            <div>
              <p className="eyebrow">Contact details</p>
              <h2>{selectedMessage.subject || "No subject"}</h2>
              <p>{selectedMessage.email || "-"}</p>
            </div>
            <button type="button" className="secondary-button compact-button" onClick={() => setSelectedMessageId(null)}>
              Close details
            </button>
          </div>

          <div className="error-detail-summary contact-detail-summary">
            <div><span>Received</span><strong>{formatDateTime(selectedMessage.createdAt)}</strong></div>
            <div><span>Status</span><strong>{selectedMessage.readAt ? "Read" : "New"}</strong></div>
            <div><span>Source</span><strong>{selectedMessage.source || "-"}</strong></div>
            <div><span>IP</span><strong>{selectedMessage.ipAddress || "-"}</strong></div>
          </div>

          <div className="contact-message-body">{selectedMessage.message || "-"}</div>
          <dl className="error-metadata contact-message-metadata">
            <div className="full-width"><dt>User agent</dt><dd>{selectedMessage.userAgent || "-"}</dd></div>
            <div className="full-width"><dt>Metadata</dt><dd>{JSON.stringify(selectedMessage.metadata || {}, null, 2)}</dd></div>
          </dl>
        </section>
      ) : null}
    </>
  );
}

export { ContactInboxPanel };
