import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import LobbyPage from "./components/LobbyPage";
import RoomPage from "./components/RoomPage";
import GlitchGamePage from "./components/GlitchGamePage";
import SoloChaosLabPage from "./components/SoloChaosLabPage";
import StoryblokLobbyContent from "./storyblok/StoryblokLobbyContent";
import { DEFAULT_LOBBY_CONTENT } from "./storyblok/lobbyContent";
import { STORYBLOK_IS_ENABLED } from "./storyblok/config";
import "./App.css";
import { CONNECTION_STATES, deriveSocketConnectionState } from "./connectionState";
import {
  ANALYTICS_VISITOR_STORAGE_KEY,
  COOKIE_CONSENT_CHANGE_EVENT,
  hasAnalyticsConsent
} from "./privacyConsent";
import {
  GAME_AUDIO_KEYS,
  PLATFORM_AUDIO_KEYS,
  playDebouncedSound,
  playSound,
  preloadAudioAssets,
  resumeAudioEngine,
  unlockAudioEngine
} from "./audioEngine";
import warningIcon from "./assets/images/VervusIcons/Icons_Warning.png";
import emailIcon from "./assets/images/VervusIcons/Icons_Email.png";
import clearBackgroundLogo from "./assets/images/Logos/Logo_ClearBackground.svg";

const serverUrl = import.meta.env.VITE_SERVER_URL;
if (!serverUrl) {
  throw new Error("VITE_SERVER_URL is required");
}
const PROFILE_SESSION_STORAGE_KEY = "profileSessionToken";
const getStoredProfileSessionToken = () => localStorage.getItem(PROFILE_SESSION_STORAGE_KEY) || "";
const buildProfileSessionHeaders = () => {
  const token = getStoredProfileSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const getAnalyticsVisitorId = () => {
  const existing = localStorage.getItem(ANALYTICS_VISITOR_STORAGE_KEY);
  if (existing) return existing;
  const nextId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(ANALYTICS_VISITOR_STORAGE_KEY, nextId);
  return nextId;
};
const getTrafficAttribution = () => {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source") || "";
  const referrer = document.referrer || "";
  let referrerHost = "";
  try {
    referrerHost = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "";
  } catch {
    referrerHost = "";
  }
  return {
    source: utmSource || referrerHost || "Direct",
    referrer,
    utm: {
      source: utmSource || null,
      medium: params.get("utm_medium") || null,
      campaign: params.get("utm_campaign") || null,
      term: params.get("utm_term") || null,
      content: params.get("utm_content") || null
    }
  };
};
const trackAnalyticsEvent = (eventName, payload = {}) => {
  if (!hasAnalyticsConsent()) return false;

  const attribution = getTrafficAttribution();
  fetch(`${serverUrl}/api/analytics/event`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json", ...buildProfileSessionHeaders() },
    body: JSON.stringify({
      eventName,
      sessionId: getAnalyticsVisitorId(),
      source: attribution.source,
      referrer: attribution.referrer,
      roomCode: payload.roomCode || null,
      productKey: payload.productKey || null,
      modeKey: payload.modeKey || null,
      metadata: {
        path: window.location.pathname,
        search: window.location.search,
        title: document.title,
        utm: attribution.utm,
        ...(payload.metadata || {})
      }
    })
  }).catch(() => {});

  return true;
};
const socket = io(serverUrl, {
  autoConnect: false,
  withCredentials: true,
  auth: { profileSessionToken: getStoredProfileSessionToken() }
});
const setSocketProfileSessionToken = (token) => {
  socket.auth = { ...(socket.auth || {}), profileSessionToken: token || "" };
};

const discardBufferedSocketEmits = () => {
  if (Array.isArray(socket.sendBuffer) && socket.sendBuffer.length > 0) {
    socket.sendBuffer = [];
  }
};
const PENDING_PURCHASE_STORAGE_KEY = "pendingPurchaseCheckout";
const PURCHASE_RESULT_TO_EMIT_STORAGE_KEY = "purchaseResultToEmit";
const PENDING_PURCHASE_SOUND_STORAGE_KEY = "pendingPurchaseSoundEffect";
const PENDING_PURCHASE_SESSION_STORAGE_KEY = "pendingPurchaseCheckoutSessionId";
const RECOVERY_EMAIL_STORAGE_KEY = "vervusRecoveryEmail";
const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
const initialSearchParams = new URLSearchParams(window.location.search);
const DEBUG_QUERY_VALUES = new Set(["1", "true", "yes", "on"]);
const isQueryFlagEnabled = (key) => DEBUG_QUERY_VALUES.has(String(initialSearchParams.get(key) || "").trim().toLowerCase());
const debugUnlockAllModes = isQueryFlagEnabled("modeDebug")
  || isQueryFlagEnabled("debugMode")
  || isQueryFlagEnabled("debugUnlockAllModes");
const ROOM_PREVIEW_DEBOUNCE_MS = 250;
const ROOM_PREVIEW_MIN_LENGTH = 4;
const ROOM_CODE_NOTICE_TYPES_BY_ERROR_CODE = {
  ROOM_NOT_FOUND: "not_found",
  ROOM_FULL: "full",
  ROOM_EXPIRED: "expired"
};
function normalizeRoomCodeForLookup(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, 8);
}
function getRoomCodeNoticeType(response = {}) {
  if (ROOM_CODE_NOTICE_TYPES_BY_ERROR_CODE[response.code]) {
    return ROOM_CODE_NOTICE_TYPES_BY_ERROR_CODE[response.code];
  }

  const message = String(response.error || "").toLowerCase();
  if (message.includes("not found")) return "not_found";
  if (message.includes("full")) return "full";
  if (message.includes("expired")) return "expired";
  return null;
}
function getRoomPreviewStatus(room) {
  const status = String(room?.status || "").toLowerCase();
  if (status === "expired" || status === "ended") return "expired";
  if (room?.isFull) return "full";
  return "found";
}
function getRoomCodeNotice(roomPreview) {
  return ["not_found", "full", "expired"].includes(roomPreview?.status)
    ? { type: roomPreview.status }
    : null;
}
const initialRoomFromQuery = normalizeRoomCodeForLookup(initialSearchParams.get("room"));
const initialEntitlementTransferToken = initialSearchParams.get("entitlementTransfer")?.trim() || "";
const ROOM_VIEW_PREFERENCE_KEY = "roomViewPreference";
const LOBBY_MODE_OPTIONS = [
  { id: "standard", title: "GLiTCH!" },
  { id: "blitz", title: "GLiTCH! Blitz" },
  { id: "chaos", title: "GLiTCH! Chaos" }
];
const REMOVED_FROM_ROOM_REASON = "You were removed from the room by the host.";

const TIME_SYNC_SAMPLE_LIMIT = 8;
const TIME_SYNC_BEST_SAMPLE_COUNT = 5;
const TIME_SYNC_DEGRADED_RTT_MS = 150;
const TIME_SYNC_DEGRADED_JITTER_MS = 80;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

function deriveTimeSyncEstimate(samples) {
  const validSamples = samples
    .filter((sample) => Number.isFinite(sample.offsetMs) && Number.isFinite(sample.rttMs))
    .sort((a, b) => a.rttMs - b.rttMs)
    .slice(0, TIME_SYNC_BEST_SAMPLE_COUNT);

  if (!validSamples.length) {
    return { offsetMs: null, rttMs: null, jitterMs: null, sampleCount: 0, quality: "syncing" };
  }

  const offsetMs = median(validSamples.map((sample) => sample.offsetMs));
  const rttMs = median(validSamples.map((sample) => sample.rttMs));
  const offsets = validSamples.map((sample) => sample.offsetMs);
  const jitterMs = offsets.length > 1 ? Math.max(...offsets) - Math.min(...offsets) : 0;
  const quality = rttMs > TIME_SYNC_DEGRADED_RTT_MS || jitterMs > TIME_SYNC_DEGRADED_JITTER_MS
    ? "degraded"
    : "synced";

  return { offsetMs, rttMs, jitterMs, sampleCount: validSamples.length, quality };
}

const DEFAULT_MODE_DEBUG_CONFIGS = [
  {
    id: "standard",
    title: "GLiTCH!",
    roundResultLockMs: 500,
    transitionBeatMs: 300,
    hasLastChance: true,
    allowPartialBreak: false,
    curve: [
      { minCombo: 0, timerMs: 5000, glitchChance: 0.15, shapeSwapChance: 1, falseTwinChance: 0, readableTwinChance: 1 }
    ],
    heatSurgeConfig: null
  },
  { id: "blitz", title: "GLiTCH! Blitz", curve: [], heatSurgeConfig: null },
  { id: "chaos", title: "GLiTCH! Chaos", curve: [], heatSurgeConfig: null }
];


const playSoundWithUnlockRetry = (soundKey, options = {}) => playSound(soundKey, options).then((didPlay) => {
  if (didPlay) return true;
  return unlockAudioEngine().then((didUnlock) => {
    if (!didUnlock) return false;
    return playSound(soundKey, options);
  });
});

const playClickSound = () => {
  playDebouncedSound("click", 150);
};

const playSelectionChangedSound = () => {
  playDebouncedSound("selectionChanged", 150);
};

const playAlertSound = () => playSoundWithUnlockRetry("alert");

const playSuccessPurchaseSound = () => playSoundWithUnlockRetry("purchaseSuccess");

const playFailedPurchaseSound = () => playSoundWithUnlockRetry("purchaseFailed");
const createFallbackPlayerName = () => `Player-${Math.floor(1000 + Math.random() * 9000)}`;

function formatProductPrice(product) {
  const currencyCode = String(product?.currencyCode || "EUR").toUpperCase();
  const amount = (Number(product?.priceCents) || 0) / 100;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

function formatProductAccess(product) {
  const hours = Math.max(1, Number(product?.validityDurationHours) || 24);
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function getProductModeCount(product) {
  return Array.isArray(product?.modes) ? product.modes.length : 0;
}

function getStoreProductLabel(product, allModeCount) {
  const modeCount = getProductModeCount(product);
  if (modeCount > 0 && allModeCount > 0 && modeCount >= allModeCount) {
    return "All experiences";
  }
  if (modeCount > 0) {
    return `${modeCount} ${modeCount === 1 ? "experience" : "experiences"}`;
  }
  return product?.productName || "Experience";
}

function getStoreProductDescriptionPoints(product) {
  if (Array.isArray(product?.descriptionPoints) && product.descriptionPoints.length > 0) {
    return product.descriptionPoints;
  }
  const fallbackDescription = String(product?.description || "").trim();
  return fallbackDescription ? [fallbackDescription] : [];
}

function isValidRecoveryEmail(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function StoreCheckoutPage({
  products,
  selectedProduct,
  selectedProductKey,
  allModeCount,
  isLoading,
  error,
  hasAcceptedTerms,
  isCheckoutStarting,
  actionsLocked,
  onSelectProduct,
  onAcceptTermsChange,
  onPay,
  onCancel,
  onRetry
}) {
  const hasProducts = products.length > 0;
  const selectedPrice = selectedProduct ? formatProductPrice(selectedProduct) : "-";
  const selectedAccess = selectedProduct ? formatProductAccess(selectedProduct) : "-";
  const selectedPoints = getStoreProductDescriptionPoints(selectedProduct);
  const canPay = Boolean(selectedProduct && hasAcceptedTerms && !isCheckoutStarting && !actionsLocked);
  const selectedModeCount = getProductModeCount(selectedProduct);
  const checkoutHeading = selectedProduct && selectedModeCount > 0 && allModeCount > 0 && selectedModeCount >= allModeCount
    ? `All experiences. All modes. ${selectedAccess}.`
    : `${selectedProduct ? getStoreProductLabel(selectedProduct, allModeCount) : "All experiences"}. ${selectedAccess === "-" ? "24 hours" : selectedAccess}.`;

  return (
    <section className="store-checkout-page" aria-labelledby="store-checkout-title">
      <section
        className="store-checkout-shell"
      >
        <header className="store-checkout-header">
          <img src={clearBackgroundLogo} alt="Vervus" />
          <span aria-hidden="true" />
        </header>

        <div className="store-checkout-content">
          <div className="store-checkout-title-block">
            <p>Checkout</p>
            <h2 id="store-checkout-title">{checkoutHeading}</h2>
            <span>Room stays open while you pay.</span>
          </div>

          {isLoading ? (
            <div className="store-checkout-message" role="status">Loading experiences...</div>
          ) : null}

          {!isLoading && error ? (
            <div className="store-checkout-message error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={onRetry}>Retry</button>
            </div>
          ) : null}

          {!isLoading && !error && !hasProducts ? (
            <div className="store-checkout-message" role="status">No experiences are available right now.</div>
          ) : null}

          {hasProducts ? (
            <>
              <div className="store-experience-options" aria-label="Experience options">
                {products.map((product) => {
                  const isActive = product.productKey === selectedProductKey;
                  return (
                    <button
                      type="button"
                      key={product.productKey}
                      className={`store-experience-option${isActive ? " active" : ""}`}
                      onClick={() => onSelectProduct(product.productKey)}
                      aria-pressed={isActive}
                    >
                      <span>{getStoreProductLabel(product, allModeCount)}</span>
                      <strong>{formatProductPrice(product)}</strong>
                    </button>
                  );
                })}
              </div>

              <article className="store-selected-product-card">
                <h3>{selectedProduct?.productName || "Unlock Vervus"}</h3>
                <strong>{selectedPrice}</strong>
                <div className="store-card-divider" />
                {selectedPoints.length > 0 ? (
                  <ul>
                    {selectedPoints.map((point) => (
                      <li key={point}>
                        <span aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>

              <div className="store-order-summary">
                <div>
                  <span>{selectedProduct?.productName || "Unlock Vervus"}</span>
                  <strong>{selectedPrice}</strong>
                </div>
                <div>
                  <span>Access</span>
                  <strong>{selectedAccess}</strong>
                </div>
                <div className="store-card-divider" />
                <div className="total">
                  <span>Total</span>
                  <strong>{selectedPrice}</strong>
                </div>
              </div>

              <label className="store-terms-checkbox">
                <input
                  type="checkbox"
                  checked={hasAcceptedTerms}
                  onChange={(event) => onAcceptTermsChange(event.target.checked)}
                />
                <span>
                  I agree to the <span className="store-inline-link">Terms of Service</span> and{" "}
                  <span className="store-inline-link">Privacy Policy</span>, and understand that digital access starts immediately after purchase and that my right of withdrawal no longer applies.
                </span>
              </label>

              <div className="store-pay-divider">
                <span />
                <p>Pay another way</p>
                <span />
              </div>

              <button
                type="button"
                className="store-pay-button"
                disabled={!canPay}
                onClick={() => onPay(selectedProduct.productKey)}
              >
                {isCheckoutStarting ? "Starting checkout..." : `Pay ${selectedPrice}`}
              </button>

              <button type="button" className="store-cancel-button" onClick={onCancel}>
                Cancel
              </button>

              <p className="store-secure-note"><span aria-hidden="true" />Secure payment via Stripe</p>
            </>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function PostPurchaseUnlockMenu({
  email,
  transferLink,
  transferLinkStatus,
  transferLinkCopied,
  onEmailChange,
  onContinue,
  onSkip,
  onClose,
  onCopyTransferLink,
  onRetryTransferLink
}) {
  const canContinue = isValidRecoveryEmail(email);
  const isTransferLoading = transferLinkStatus === "loading";
  const hasTransferError = transferLinkStatus === "error";

  return (
    <section className="unlock-success-menu" role="dialog" aria-modal="true" aria-labelledby="unlock-success-title">
      <span className="unlock-success-side-glow" aria-hidden="true" />
      <span className="unlock-success-center-glow" aria-hidden="true" />
      <button type="button" className="unlock-success-close" aria-label="Close" onClick={onClose}>
        <span aria-hidden="true" />
      </button>

      <div className="unlock-success-content">
        <div className="unlock-success-heading">
          <span className="unlock-success-icon" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <h2 id="unlock-success-title">Vervus unlocked</h2>
          <p>24 hours - unlimited runs</p>
        </div>

        <div className="unlock-success-divider" />

        <label className="unlock-email-field">
          <span>Add recovery email</span>
          <div className="unlock-email-input">
            <img src={emailIcon} alt="" aria-hidden="true" />
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="Email address"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </div>
          <small>For receipts and access recovery</small>
        </label>

        <div className="unlock-or-divider">
          <span />
          <p>or</p>
          <span />
        </div>

        <div className="unlock-transfer-link-block">
          <label htmlFor="unlock-transfer-link">Entitlement Transfer link</label>
          <div className="unlock-transfer-copy-row">
            <input
              id="unlock-transfer-link"
              type="text"
              readOnly
              value={transferLink || (isTransferLoading ? "Preparing transfer link..." : "")}
              placeholder={hasTransferError ? "Transfer link unavailable" : "Preparing transfer link..."}
              onFocus={(event) => event.target.select()}
            />
            <button type="button" disabled={!transferLink} onClick={onCopyTransferLink}>
              {transferLinkCopied ? "Copied" : "Copy"}
            </button>
          </div>
          {hasTransferError ? (
            <button type="button" className="unlock-transfer-retry" onClick={onRetryTransferLink}>
              Retry transfer link
            </button>
          ) : null}
        </div>

        <div className="unlock-success-actions">
          <button type="button" className="unlock-success-secondary" onClick={onSkip}>
            Skip
          </button>
          <button type="button" className="unlock-success-primary" disabled={!canContinue} onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [name, setName] = useState(() => localStorage.getItem("playerName") || "");
  const [roomIdInput, setRoomIdInput] = useState(initialRoomFromQuery);
  const [roomPreview, setRoomPreview] = useState({ status: "idle", roomId: "", room: null, error: "" });
  const [profileId, setProfileId] = useState("");
  const [profileEntitlementExpiresAtMs, setProfileEntitlementExpiresAtMs] = useState(null);
  const [profileEntitledModeKeys, setProfileEntitledModeKeys] = useState([]);
  const [profileEntitledModeExpiriesMs, setProfileEntitledModeExpiriesMs] = useState({});
  const [showStore, setShowStore] = useState(false);
  const [storeProducts, setStoreProducts] = useState([]);
  const [selectedStoreProductKey, setSelectedStoreProductKey] = useState("");
  const [storeError, setStoreError] = useState("");
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [hasAcceptedStoreTerms, setHasAcceptedStoreTerms] = useState(false);
  const [isCheckoutStarting, setIsCheckoutStarting] = useState(false);
  const [purchaseOverlayStatus, setPurchaseOverlayStatus] = useState(null);
  const [unlockMenuVisible, setUnlockMenuVisible] = useState(false);
  const [unlockRecoveryEmail, setUnlockRecoveryEmail] = useState(() => localStorage.getItem(RECOVERY_EMAIL_STORAGE_KEY) || "");
  const [unlockTransferLink, setUnlockTransferLink] = useState("");
  const [unlockTransferLinkStatus, setUnlockTransferLinkStatus] = useState("idle");
  const [unlockTransferLinkCopied, setUnlockTransferLinkCopied] = useState(false);
  const [unlockTransferLinkRequestId, setUnlockTransferLinkRequestId] = useState(0);
  const [removedFromRoomNotice, setRemovedFromRoomNotice] = useState(null);
  const [isSoloChaosLabOpen, setIsSoloChaosLabOpen] = useState(false);
  const [selectedLobbyModeId, setSelectedLobbyModeId] = useState("standard");
  const [lobbyModeOptions, setLobbyModeOptions] = useState(LOBBY_MODE_OPTIONS);
  const [entitlementRefreshRequestedAtMs, setEntitlementRefreshRequestedAtMs] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [roomState, setRoomState] = useState(null);
  const modeDebugConfigs = roomState?.modeDebugConfigs?.length
    ? roomState.modeDebugConfigs
    : ((import.meta.env.DEV || debugUnlockAllModes) ? DEFAULT_MODE_DEBUG_CONFIGS : []);
  const [isViewingRoomPage, setIsViewingRoomPage] = useState(false);
  const [serverNow, setServerNow] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(null);
  const [timeSyncStatus, setTimeSyncStatus] = useState({
    rttMs: null,
    offsetMs: null,
    jitterMs: null,
    sampleCount: 0,
    quality: "syncing"
  });
  const [analyticsConsentVersion, setAnalyticsConsentVersion] = useState(0);
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [isSocketReconnecting, setIsSocketReconnecting] = useState(!socket.connected);
  const [pingMs, setPingMs] = useState(null);
  const actionsLocked = !isSocketConnected;
  const connectionState = useMemo(() => deriveSocketConnectionState({
    socketConnected: isSocketConnected,
    isReconnecting: isSocketReconnecting && !isSocketConnected,
    pingMs
  }), [isSocketConnected, isSocketReconnecting, pingMs]);
  const hasPlayedReturnPurchaseSoundRef = useRef(false);
  const hasTrackedPageViewRef = useRef(false);
  const suppressNextPurchaseResultRef = useRef(null);
  const previousRoomAudioSnapshotRef = useRef(null);
  const timeSyncSequenceRef = useRef(0);
  const timeSyncSamplesRef = useRef([]);
  const roomPreviewRequestRef = useRef(0);
  const pendingAutoJoinRoomIdRef = useRef(initialRoomFromQuery);
  const pendingEntitlementTransferTokenRef = useRef(initialEntitlementTransferToken);
  const playPurchaseSoundWithFallback = useCallback((success) => {
    const pendingSoundValue = success ? "success" : "cancelled";
    const playNow = () => (success ? playSuccessPurchaseSound() : playFailedPurchaseSound());
    const scheduleRetry = (remainingAttempts = 6) => {
      if (remainingAttempts <= 0) {
        localStorage.setItem(PENDING_PURCHASE_SOUND_STORAGE_KEY, pendingSoundValue);
        return;
      }
      window.setTimeout(() => {
        Promise.resolve(playNow()).then((didPlay) => {
          if (didPlay) return;
          scheduleRetry(remainingAttempts - 1);
        });
      }, 150);
    };

    Promise.resolve(playNow()).then((didPlay) => {
      if (didPlay) return;
      scheduleRetry();
    });
  }, []);
  const showPurchaseResultOverlay = useCallback((success) => {
    if (success) {
      setPurchaseOverlayStatus(null);
      setUnlockMenuVisible(true);
      setUnlockTransferLink("");
      setUnlockTransferLinkStatus("idle");
      setUnlockTransferLinkCopied(false);
      setUnlockTransferLinkRequestId((requestId) => requestId + 1);
      return;
    }

    setUnlockMenuVisible(false);
    setPurchaseOverlayStatus("failed");
  }, []);
  const dismissUnlockMenu = useCallback(() => {
    playPurchaseSoundWithFallback(true);
    setUnlockMenuVisible(false);
    setUnlockTransferLinkCopied(false);
  }, [playPurchaseSoundWithFallback]);
  const handleUnlockMenuContinue = useCallback(() => {
    const email = unlockRecoveryEmail.trim();
    if (isValidRecoveryEmail(email)) {
      localStorage.setItem(RECOVERY_EMAIL_STORAGE_KEY, email);
    }
    dismissUnlockMenu();
  }, [dismissUnlockMenu, unlockRecoveryEmail]);
  const handleDismissPurchaseOverlay = useCallback(() => {
    if (!purchaseOverlayStatus) return;
    const purchaseSucceeded = purchaseOverlayStatus === "success";
    playPurchaseSoundWithFallback(purchaseSucceeded);
    setPurchaseOverlayStatus(null);
  }, [playPurchaseSoundWithFallback, purchaseOverlayStatus]);
  const getStoredRoomViewPreference = useCallback(
    (nextRoomId) => localStorage.getItem(`${ROOM_VIEW_PREFERENCE_KEY}:${nextRoomId}`) === "room",
    []
  );
  const setStoredRoomViewPreference = useCallback((nextRoomId, prefersRoomView) => {
    const key = `${ROOM_VIEW_PREFERENCE_KEY}:${nextRoomId}`;
    if (prefersRoomView) {
      localStorage.setItem(key, "room");
      return;
    }
    localStorage.removeItem(key);
  }, []);

  useEffect(() => {
    const handleCookieConsentChange = () => {
      setAnalyticsConsentVersion((version) => version + 1);
    };

    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleCookieConsentChange);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleCookieConsentChange);
  }, []);


  const emitIfConnected = useCallback((eventName, payload, callback) => {
    if (!socket.connected) {
      discardBufferedSocketEmits();
      return false;
    }

    socket.emit(eventName, payload, callback);
    return true;
  }, []);


  const applyProfileEntitlementResponse = useCallback((response) => {
    if (response?.error) return;
    if (response.profileSessionToken) {
      localStorage.setItem(PROFILE_SESSION_STORAGE_KEY, response.profileSessionToken);
      setSocketProfileSessionToken(response.profileSessionToken);
    }
    if (response.profileId) {
      setProfileId((currentProfileId) => (
        response.profileId !== currentProfileId ? response.profileId : currentProfileId
      ));
    }
    setProfileEntitlementExpiresAtMs(response.entitlementExpiresAtMs ?? null);
    setProfileEntitledModeKeys(response.entitledModeKeys ?? []);
    setProfileEntitledModeExpiriesMs(response.entitledModeExpiriesMs ?? {});
  }, []);

  const refreshProfileEntitlements = useCallback(() => {
    emitIfConnected("player:register", { name, profileSessionToken: getStoredProfileSessionToken() }, applyProfileEntitlementResponse);
  }, [applyProfileEntitlementResponse, emitIfConnected, name]);

  useEffect(() => {
    const normalizedRoomId = normalizeRoomCodeForLookup(roomIdInput);
    const requestId = roomPreviewRequestRef.current + 1;
    roomPreviewRequestRef.current = requestId;

    if (roomId || !isSocketConnected || normalizedRoomId.length < ROOM_PREVIEW_MIN_LENGTH) {
      const resetTimeoutId = window.setTimeout(() => {
        setRoomPreview((previous) => {
          if (
            previous.status === "idle"
            && previous.roomId === normalizedRoomId
            && previous.room === null
            && previous.error === ""
          ) {
            return previous;
          }

          return { status: "idle", roomId: normalizedRoomId, room: null, error: "" };
        });
      }, 0);

      return () => window.clearTimeout(resetTimeoutId);
    }

    const loadingTimeoutId = window.setTimeout(() => {
      setRoomPreview((previous) => {
        if (previous.roomId === normalizedRoomId && previous.status === "found") {
          return previous;
        }

        return { status: "loading", roomId: normalizedRoomId, room: null, error: "" };
      });
    }, 0);

    const timeoutId = window.setTimeout(() => {
      const didEmit = emitIfConnected("room:preview", { roomId: normalizedRoomId }, (response) => {
        if (roomPreviewRequestRef.current !== requestId) return;

        if (response?.error) {
          const noticeType = getRoomCodeNoticeType(response);
          setRoomPreview({ status: noticeType || "error", roomId: normalizedRoomId, room: null, error: response.error });
          return;
        }

        if (response?.found && response.room) {
          const previewStatus = getRoomPreviewStatus(response.room);
          setRoomPreview({ status: previewStatus, roomId: normalizedRoomId, room: response.room, error: "" });
          return;
        }

        setRoomPreview({ status: getRoomCodeNoticeType(response) || "not_found", roomId: normalizedRoomId, room: null, error: "" });
      });

      if (!didEmit && roomPreviewRequestRef.current === requestId) {
        setRoomPreview({ status: "idle", roomId: normalizedRoomId, room: null, error: "" });
      }
    }, ROOM_PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(loadingTimeoutId);
      window.clearTimeout(timeoutId);
    };
  }, [emitIfConnected, isSocketConnected, roomId, roomIdInput]);


  const clearSessionState = useCallback(() => {
    localStorage.removeItem("roomId");
    localStorage.removeItem("sessionToken");
    if (roomId) {
      localStorage.removeItem(`${ROOM_VIEW_PREFERENCE_KEY}:${roomId}`);
    }
    setRoomId("");
    setRoomIdInput("");
    setPlayerId("");
    setRoomState(null);
    setIsViewingRoomPage(false);
  }, [roomId]);
  const handleRemovedRoomHome = useCallback(() => {
    playClickSound();
    setRemovedFromRoomNotice(null);
    clearSessionState();
    setIsSoloChaosLabOpen(false);
    window.scrollTo({ top: 0 });
  }, [clearSessionState]);
  const applyJoinResponse = useCallback((response) => {
    setRemovedFromRoomNotice(null);
    setRoomPreview({ status: "idle", roomId: "", room: null, error: "" });
    setRoomId(response.roomId);
    setPlayerId(response.playerId);
    setRoomState(response.state);

    localStorage.setItem("roomId", response.roomId);
    localStorage.setItem("sessionToken", response.sessionToken);
    const responsePlayers = response.state?.players ?? [];
    const joiningPlayer = responsePlayers.find((player) => player.playerId === response.playerId);
    const isWaitingForNextGame = Boolean(joiningPlayer?.waitingForNextGame);
    const didParticipateInCurrentGame = Boolean(joiningPlayer?.currentGameParticipant);
    const isGameOver = response.state?.phase === "play" && joiningPlayer?.game?.status === "gameover";
    setIsViewingRoomPage(
      isWaitingForNextGame
      || !didParticipateInCurrentGame
      || (isGameOver && getStoredRoomViewPreference(response.roomId))
    );
  }, [getStoredRoomViewPreference]);

  useEffect(() => {
    let isMounted = true;

    fetch(`${serverUrl}/api/player-session`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...buildProfileSessionHeaders() },
      body: JSON.stringify({ name })
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Failed to establish player session");
        if (!isMounted) return;
        const previousProfileSessionToken = String(socket.auth?.profileSessionToken || "");
        applyProfileEntitlementResponse(payload);
        if (payload.profileSessionToken && payload.profileSessionToken !== previousProfileSessionToken && socket.connected) {
          socket.disconnect();
          socket.connect();
          return;
        }
        if (!socket.connected && !socket.active) {
          socket.connect();
        }
      })
      .catch((error) => {
        if (isMounted) alert(error.message || "Failed to establish player session");
      });

    return () => {
      isMounted = false;
    };
  }, [applyProfileEntitlementResponse, name]);

  useEffect(() => {
    if (!profileId || hasTrackedPageViewRef.current || !hasAnalyticsConsent()) return;
    const didTrack = trackAnalyticsEvent("page_view", { metadata: { profileId } });
    if (didTrack) {
      hasTrackedPageViewRef.current = true;
    }
  }, [analyticsConsentVersion, profileId]);

  useEffect(() => {
    const handleRoomState = (state) => setRoomState(state);
    const handleRoomWarning = ({ message }) => {
      if (message) {
        playAlertSound();
        alert(message);
      }
    };

    const handleRoomDisbanded = ({ reason }) => {
      clearSessionState();
      if (reason === REMOVED_FROM_ROOM_REASON) {
        playAlertSound();
        setRemovedFromRoomNotice({ reason });
        return;
      }
      if (reason) {
        playAlertSound();
        alert(reason);
      }
    };

    socket.on("room:state", handleRoomState);
    socket.on("room:warning", handleRoomWarning);
    socket.on("room:disbanded", handleRoomDisbanded);
    const handlePurchaseResult = ({ success }) => {
      const isSuccess = Boolean(success);
      if (suppressNextPurchaseResultRef.current !== null && suppressNextPurchaseResultRef.current === isSuccess) {
        suppressNextPurchaseResultRef.current = null;
        return;
      }
      playPurchaseSoundWithFallback(isSuccess);
    };

    const handleEntitlementTransferCompleted = ({ message } = {}) => {
      refreshProfileEntitlements();
      alert(message || "Your entitlement was transferred to another device. Entitlements refreshed.");
    };

    const handleEntitlementRefresh = (payload = {}) => {
      applyProfileEntitlementResponse(payload);
    };

    socket.on("entitlement:purchase:result", handlePurchaseResult);
    socket.on("entitlement:transfer:completed", handleEntitlementTransferCompleted);
    socket.on("entitlement:refresh", handleEntitlementRefresh);

    return () => {
      socket.off("room:state", handleRoomState);
      socket.off("room:warning", handleRoomWarning);
      socket.off("room:disbanded", handleRoomDisbanded);
      socket.off("entitlement:purchase:result", handlePurchaseResult);
      socket.off("entitlement:transfer:completed", handleEntitlementTransferCompleted);
      socket.off("entitlement:refresh", handleEntitlementRefresh);
    };
  }, [applyProfileEntitlementResponse, clearSessionState, playPurchaseSoundWithFallback, refreshProfileEntitlements]);


  useEffect(() => {
    preloadAudioAssets([...PLATFORM_AUDIO_KEYS, ...GAME_AUDIO_KEYS]).catch(() => {});

    const handleAudioActivation = () => {
      unlockAudioEngine();
    };

    window.addEventListener("pointerdown", handleAudioActivation);
    window.addEventListener("touchend", handleAudioActivation);
    window.addEventListener("keydown", handleAudioActivation);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resumeAudioEngine();
      }
    };

    const handlePageShow = () => resumeAudioEngine();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pointerdown", handleAudioActivation);
      window.removeEventListener("touchend", handleAudioActivation);
      window.removeEventListener("keydown", handleAudioActivation);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchaseResult = params.get("purchase");
    const purchaseSessionId = params.get("purchaseSessionId")?.trim() || "";
    const normalizedPurchaseResult = purchaseResult === "canceled" ? "cancelled" : purchaseResult;
    const hasPendingPurchase = localStorage.getItem(PENDING_PURCHASE_STORAGE_KEY) === "1";
    if (purchaseSessionId) {
      localStorage.setItem(PENDING_PURCHASE_SESSION_STORAGE_KEY, purchaseSessionId);
    }
    if (normalizedPurchaseResult !== "success" && normalizedPurchaseResult !== "cancelled" && !hasPendingPurchase) return;

    const purchaseSucceeded = normalizedPurchaseResult === "success";
    if (!hasPlayedReturnPurchaseSoundRef.current) {
      window.setTimeout(() => showPurchaseResultOverlay(purchaseSucceeded), 0);
      hasPlayedReturnPurchaseSoundRef.current = true;
    }

    localStorage.setItem(PURCHASE_RESULT_TO_EMIT_STORAGE_KEY, purchaseSucceeded ? "success" : "cancelled");
    localStorage.removeItem(PENDING_PURCHASE_STORAGE_KEY);
    if (purchaseSucceeded) {
      window.setTimeout(() => setEntitlementRefreshRequestedAtMs(Date.now()), 0);
    }

    if (normalizedPurchaseResult === "success" || normalizedPurchaseResult === "cancelled") {
      params.delete("purchase");
      params.delete("purchaseSessionId");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [playPurchaseSoundWithFallback, showPurchaseResultOverlay]);

  useEffect(() => {
    const playPendingPurchaseSound = () => {
      const pendingSound = localStorage.getItem(PENDING_PURCHASE_SOUND_STORAGE_KEY);
      if (pendingSound !== "success" && pendingSound !== "cancelled") return;
      const playAttempt = pendingSound === "success" ? playSuccessPurchaseSound() : playFailedPurchaseSound();
      Promise.resolve(playAttempt).then((didPlay) => {
        if (didPlay) {
          localStorage.removeItem(PENDING_PURCHASE_SOUND_STORAGE_KEY);
        }
      });
    };

    window.addEventListener("pointerdown", playPendingPurchaseSound);
    window.addEventListener("keydown", playPendingPurchaseSound);
    playPendingPurchaseSound();

    return () => {
      window.removeEventListener("pointerdown", playPendingPurchaseSound);
      window.removeEventListener("keydown", playPendingPurchaseSound);
    };
  }, []);

  useEffect(() => {
    if (!roomId || !playerId) return;
    const purchaseResultToEmit = localStorage.getItem(PURCHASE_RESULT_TO_EMIT_STORAGE_KEY);
    if (purchaseResultToEmit !== "success" && purchaseResultToEmit !== "cancelled") return;
    const purchaseSucceeded = purchaseResultToEmit === "success";
    if (!emitIfConnected("entitlement:purchase:result", { roomId, playerId, success: purchaseSucceeded })) {
      return;
    }

    suppressNextPurchaseResultRef.current = purchaseSucceeded;
    localStorage.removeItem(PURCHASE_RESULT_TO_EMIT_STORAGE_KEY);
  }, [emitIfConnected, roomId, playerId]);

  const attemptSessionRejoin = useCallback(() => {
    const savedRoomId = localStorage.getItem("roomId");
    const savedSessionToken = localStorage.getItem("sessionToken");

    if (!savedRoomId || !savedSessionToken || !socket.connected) {
      return;
    }

    socket.emit("room:rejoin", { roomId: savedRoomId, sessionToken: savedSessionToken }, (response) => {
      if (response?.error) {
        clearSessionState();
        if (response.code === "CREATOR_TIMED_OUT") {
          alert("You timed out, so your room was disbanded.");
        }
        return;
      }

      applyJoinResponse(response);
    });
  }, [applyJoinResponse, clearSessionState]);

  useEffect(() => {
    const handleConnect = () => {
      setIsSocketConnected(true);
      setIsSocketReconnecting(false);
    };
    const handleDisconnect = () => {
      discardBufferedSocketEmits();
      setIsSocketConnected(false);
      setIsSocketReconnecting(true);
    };
    const handleReconnectAttempt = () => {
      discardBufferedSocketEmits();
      setIsSocketConnected(false);
      setIsSocketReconnecting(true);
    };
    const handleReconnectFailed = () => {
      setIsSocketConnected(false);
      setIsSocketReconnecting(false);
    };
    const handleConnectError = () => {
      setIsSocketConnected(socket.connected);
      setIsSocketReconnecting(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.io.on("reconnect_failed", handleReconnectFailed);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.io.off("reconnect_failed", handleReconnectFailed);
    };
  }, []);


  useEffect(() => {
    attemptSessionRejoin();
  }, [attemptSessionRejoin]);

  useEffect(() => {
    socket.on("connect", attemptSessionRejoin);
    return () => {
      socket.off("connect", attemptSessionRejoin);
    };
  }, [attemptSessionRejoin]);

  useEffect(() => {
    if (!name) return;
    localStorage.setItem("playerName", name);
  }, [name]);

  useEffect(() => {
    if (!isSocketConnected) return;
    refreshProfileEntitlements();
  }, [isSocketConnected, refreshProfileEntitlements]);

  useEffect(() => {
    if (!isSocketConnected || !pendingEntitlementTransferTokenRef.current) return;
    const token = pendingEntitlementTransferTokenRef.current;
    pendingEntitlementTransferTokenRef.current = "";

    fetch(`${serverUrl}/api/entitlement-transfer/claim`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...buildProfileSessionHeaders() },
      body: JSON.stringify({ token, name })
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Failed to claim entitlement transfer");
        applyProfileEntitlementResponse(payload);
        alert("Entitlement transferred to this device.");
        if (socket.connected) socket.disconnect();
        socket.connect();
      })
      .catch((error) => alert(error.message || "Failed to claim entitlement transfer"))
      .finally(() => {
        const params = new URLSearchParams(window.location.search);
        params.delete("entitlementTransfer");
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", nextUrl);
      });
  }, [applyProfileEntitlementResponse, isSocketConnected, name]);

  useEffect(() => {
    if (!entitlementRefreshRequestedAtMs) return;

    let attemptCount = 0;
    const refreshUntilWebhookCatchesUp = () => {
      attemptCount += 1;
      refreshProfileEntitlements();
    };

    refreshUntilWebhookCatchesUp();
    const interval = window.setInterval(() => {
      if (attemptCount >= 8) {
        window.clearInterval(interval);
        return;
      }
      refreshUntilWebhookCatchesUp();
    }, 1500);

    return () => window.clearInterval(interval);
  }, [entitlementRefreshRequestedAtMs, refreshProfileEntitlements]);

  useEffect(() => {
    const checkoutSessionId = localStorage.getItem(PENDING_PURCHASE_SESSION_STORAGE_KEY);
    if (!entitlementRefreshRequestedAtMs || !checkoutSessionId) return undefined;

    let cancelled = false;
    let attemptCount = 0;
    const pollPurchaseStatus = () => {
      attemptCount += 1;
      fetch(`${serverUrl}/api/stripe/purchase-status?sessionId=${encodeURIComponent(checkoutSessionId)}`, {
        credentials: "include",
        headers: buildProfileSessionHeaders()
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload?.error || "Failed to refresh purchase status");
          if (cancelled) return;
          applyProfileEntitlementResponse(payload);
          if (payload.paymentStatus === "paid" && payload.entitlementGrantedAtMs) {
            localStorage.removeItem(PENDING_PURCHASE_SESSION_STORAGE_KEY);
          }
        })
        .catch(() => {
          // The existing entitlement refresh loop remains the fallback while Stripe webhooks catch up.
        });
    };

    pollPurchaseStatus();
    const interval = window.setInterval(() => {
      if (attemptCount >= 8 || !localStorage.getItem(PENDING_PURCHASE_SESSION_STORAGE_KEY)) {
        window.clearInterval(interval);
        return;
      }
      pollPurchaseStatus();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyProfileEntitlementResponse, entitlementRefreshRequestedAtMs]);


  useEffect(() => {
    const syncServerTime = () => {
      if (!socket.connected) {
        discardBufferedSocketEmits();
        timeSyncSamplesRef.current = [];
        setPingMs(null);
        setServerOffsetMs(null);
        setServerNow(null);
        setTimeSyncStatus({ rttMs: null, offsetMs: null, jitterMs: null, sampleCount: 0, quality: "syncing" });
        return;
      }

      const clientSentAt = Date.now();
      const sequence = timeSyncSequenceRef.current + 1;
      timeSyncSequenceRef.current = sequence;

      socket.volatile.emit("time:sync:ping", { clientSentAt, sequence }, (response = {}) => {
        const clientReceivedAt = Date.now();
        if (response.sequence !== sequence || response.clientSentAt !== clientSentAt) {
          return;
        }

        const serverReceivedAt = Number.isFinite(response.serverReceivedAt) ? response.serverReceivedAt : response.serverTime;
        const serverSentAt = Number.isFinite(response.serverSentAt) ? response.serverSentAt : response.serverTime;
        if (!Number.isFinite(serverReceivedAt) || !Number.isFinite(serverSentAt)) {
          return;
        }

        const rttMs = Math.max(0, clientReceivedAt - clientSentAt - Math.max(0, serverSentAt - serverReceivedAt));
        const estimatedServerNow = (serverReceivedAt + serverSentAt + rttMs) / 2;
        const offsetMs = estimatedServerNow - clientReceivedAt;
        const samples = [
          ...timeSyncSamplesRef.current,
          { sequence, rttMs, offsetMs, receivedAtMs: clientReceivedAt }
        ].slice(-TIME_SYNC_SAMPLE_LIMIT);
        timeSyncSamplesRef.current = samples;

        const estimate = deriveTimeSyncEstimate(samples);
        setPingMs(Math.round(estimate.rttMs ?? rttMs));
        setServerOffsetMs(estimate.offsetMs);
        setTimeSyncStatus({
          rttMs: estimate.rttMs === null ? null : Math.round(estimate.rttMs),
          offsetMs: estimate.offsetMs === null ? null : Math.round(estimate.offsetMs),
          jitterMs: estimate.jitterMs === null ? null : Math.round(estimate.jitterMs),
          sampleCount: estimate.sampleCount,
          quality: estimate.quality
        });

        if (roomId && playerId && socket.connected) {
          socket.volatile.emit("player:ping", {
            roomId,
            playerId,
            pingMs: Math.round(estimate.rttMs ?? rttMs),
            clockOffsetMs: Math.round(estimate.offsetMs ?? offsetMs),
            timeSyncJitterMs: Math.round(estimate.jitterMs ?? 0),
            timeSyncQuality: estimate.quality
          });
        }
      });
    };

    syncServerTime();
    const interval = setInterval(syncServerTime, 2000);
    return () => clearInterval(interval);
  }, [roomId, playerId]);

  useEffect(() => {
    if (serverOffsetMs === null) return;

    const updateServerNow = () => setServerNow(Date.now() + serverOffsetMs);
    updateServerNow();
    const interval = setInterval(updateServerNow, 100);
    return () => clearInterval(interval);
  }, [serverOffsetMs]);

  const createRoom = () => {
    trackAnalyticsEvent("host_click", {
      modeKey: selectedLobbyModeId,
      metadata: { selectedModeId: selectedLobbyModeId }
    });
    emitIfConnected("room:create", { name, selectedModeId: selectedLobbyModeId, debugUnlockAllModes, profileSessionToken: getStoredProfileSessionToken() }, (response) => {
      if (response?.error) {
        alert(response.error);
        return;
      }
      applyJoinResponse(response);
    });
  };

  const joinRoomWithCode = useCallback((nextRoomId, nextName) => {
    const normalizedRoomId = normalizeRoomCodeForLookup(nextRoomId);
    emitIfConnected("room:join", { roomId: normalizedRoomId, name: nextName, profileSessionToken: getStoredProfileSessionToken() }, (response) => {
      if (response?.error) {
        const noticeType = getRoomCodeNoticeType(response);
        if (noticeType) {
          setRoomPreview({ status: noticeType, roomId: normalizedRoomId, room: null, error: response.error });
          return;
        }

        alert(response.error);
        return;
      }
      applyJoinResponse(response);
    });
  }, [applyJoinResponse, emitIfConnected]);

  const joinRoom = () => joinRoomWithCode(roomIdInput, name);

  const joinRoomFromQrScan = useCallback((nextRoomId) => {
    const normalizedRoomId = normalizeRoomCodeForLookup(nextRoomId);
    setRoomIdInput(normalizedRoomId);

    if (normalizedRoomId.length < ROOM_PREVIEW_MIN_LENGTH) return;

    if (!isSocketConnected) {
      alert("Connection is still restoring. Try again in a moment.");
      return;
    }

    joinRoomWithCode(normalizedRoomId, name || createFallbackPlayerName());
  }, [isSocketConnected, joinRoomWithCode, name]);

  useEffect(() => {
    const pendingAutoJoinRoomId = pendingAutoJoinRoomIdRef.current;
    if (!pendingAutoJoinRoomId || roomId || pendingAutoJoinRoomId !== roomIdInput) {
      return;
    }

    pendingAutoJoinRoomIdRef.current = "";
    const autoJoinName = name || createFallbackPlayerName();
    joinRoomWithCode(pendingAutoJoinRoomId, autoJoinName);
  }, [joinRoomWithCode, name, roomId, roomIdInput]);

  const exitRoom = () => {
    if (roomId && playerId) {
      emitIfConnected("room:leave", { roomId, playerId });
    }

    clearSessionState();
  };

  const setPlayerColor = (color) => {
    emitIfConnected("player:setColor", { roomId, playerId, color }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const setRoomMode = (modeId) => {
    emitIfConnected("room:setMode", { roomId, playerId, modeId, debugUnlockAllModes }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const setPlayerReady = (ready) => {
    emitIfConnected("player:setReady", { roomId, playerId, ready }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const kickPlayer = (targetPlayerId) => {
    emitIfConnected("room:kickPlayer", { roomId, playerId, targetPlayerId }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const submitAnswer = (answer) => {
    emitIfConnected("game:submit", { roomId, playerId, answer }, (response) => {
      if (response?.error) alert(response.error);
    });
  };

  const notifyAssetsLoaded = useCallback(() => {
    if (!roomId || !playerId) return;
    emitIfConnected("game:assetsLoaded", { roomId, playerId }, (response) => {
      if (response?.error) alert(response.error);
    });
  }, [emitIfConnected, playerId, roomId]);


  const createEntitlementTransfer = useCallback(({ showErrors = true } = {}) => new Promise((resolve) => {
    const fail = (message) => {
      if (showErrors) {
        alert(message);
      }
      resolve(null);
    };

    const didEmit = emitIfConnected("entitlement:transfer:create", {}, (response) => {
      if (response?.error) {
        fail(response.error);
        return;
      }

      const clientUrl = import.meta.env.VITE_CLIENT_URL || window.location.origin;
      const transferUrl = `${clientUrl}/?entitlementTransfer=${encodeURIComponent(response.token)}`;
      resolve({ transferUrl, expiresAtMs: response.expiresAtMs ?? null });
    });

    if (!didEmit) {
      fail("Connect to the server before creating a transfer link.");
    }
  }), [emitIfConnected]);

  useEffect(() => {
    if (!unlockMenuVisible) return undefined;

    let cancelled = false;
    let timeoutId = null;
    let attemptCount = 0;

    const requestTransferLink = () => {
      attemptCount += 1;
      setUnlockTransferLink("");
      setUnlockTransferLinkCopied(false);
      setUnlockTransferLinkStatus("loading");

      createEntitlementTransfer({ showErrors: false }).then((transfer) => {
        if (cancelled) return;

        if (transfer?.transferUrl) {
          setUnlockTransferLink(transfer.transferUrl);
          setUnlockTransferLinkStatus("ready");
          return;
        }

        if (attemptCount >= 8) {
          setUnlockTransferLinkStatus("error");
          return;
        }

        timeoutId = window.setTimeout(requestTransferLink, 1500);
      });
    };

    requestTransferLink();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [createEntitlementTransfer, unlockMenuVisible, unlockTransferLinkRequestId]);

  const copyUnlockTransferLink = useCallback(() => {
    if (!unlockTransferLink) return;

    const markCopied = () => {
      setUnlockTransferLinkCopied(true);
      window.setTimeout(() => setUnlockTransferLinkCopied(false), 1800);
    };

    const fallbackCopy = () => {
      const input = document.getElementById("unlock-transfer-link");
      if (!input) return;
      input.focus();
      input.select();
      try {
        if (document.execCommand("copy")) {
          markCopied();
        }
      } catch {
        setUnlockTransferLinkCopied(false);
      }
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(unlockTransferLink).then(markCopied).catch(fallbackCopy);
      return;
    }

    fallbackCopy();
  }, [unlockTransferLink]);

  const retryUnlockTransferLink = useCallback(() => {
    setUnlockTransferLink("");
    setUnlockTransferLinkStatus("idle");
    setUnlockTransferLinkCopied(false);
    setUnlockTransferLinkRequestId((requestId) => requestId + 1);
  }, []);

  const loadStoreProducts = useCallback(() => {
    setIsStoreLoading(true);
    setStoreError("");

    fetch(`${serverUrl}/api/products`, {
      credentials: "include",
      headers: buildProfileSessionHeaders()
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load experiences");
        }

        const activeProducts = Array.isArray(payload.products) ? payload.products : [];
        setStoreProducts(activeProducts);
        setSelectedStoreProductKey((currentKey) => {
          if (currentKey && activeProducts.some((product) => product.productKey === currentKey)) {
            return currentKey;
          }

          const defaultProduct = activeProducts.reduce((best, product) => {
            if (!best) return product;
            const modeDelta = getProductModeCount(product) - getProductModeCount(best);
            if (modeDelta !== 0) return modeDelta > 0 ? product : best;
            return (Number(product.displayOrder) || 0) > (Number(best.displayOrder) || 0) ? product : best;
          }, null);

          return defaultProduct?.productKey || "";
        });
      })
      .catch((error) => {
        setStoreError(error.message || "Failed to load experiences");
      })
      .finally(() => {
        setIsStoreLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!showStore || storeProducts.length || isStoreLoading) return;
    loadStoreProducts();
  }, [isStoreLoading, loadStoreProducts, showStore, storeProducts.length]);

  const selectedStoreProduct = useMemo(
    () => storeProducts.find((product) => product.productKey === selectedStoreProductKey) || storeProducts[0] || null,
    [selectedStoreProductKey, storeProducts]
  );

  const storeProductModeCount = useMemo(
    () => storeProducts.reduce((maxCount, product) => Math.max(maxCount, getProductModeCount(product)), 0),
    [storeProducts]
  );

  const purchaseProduct = (productKey = selectedStoreProduct?.productKey || "glitch_party_pack") => {
    setIsCheckoutStarting(true);

    const startCheckout = () => {
      fetch(`${serverUrl}/api/stripe/checkout-session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...buildProfileSessionHeaders() },
        body: JSON.stringify({ productKey, roomId })
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error || "Failed to start checkout");
          }
          if (!payload?.url) {
            throw new Error("Stripe checkout URL missing");
          }
          localStorage.setItem(PENDING_PURCHASE_STORAGE_KEY, "1");
          if (payload.stripeCheckoutSessionId) {
            localStorage.setItem(PENDING_PURCHASE_SESSION_STORAGE_KEY, payload.stripeCheckoutSessionId);
          }
          window.location.assign(payload.url);
        })
        .catch((error) => {
          alert(error.message || "Failed to start checkout");
          setShowStore(false);
        })
        .finally(() => {
          setIsCheckoutStarting(false);
        });
    };

    if (!roomId || !playerId) {
      startCheckout();
      return;
    }

    const didEmitPurchaseStart = emitIfConnected("entitlement:purchase:start", { roomId, playerId, productKey }, (response) => {
      if (response?.error) {
        alert(response.error);
        setIsCheckoutStarting(false);
        return;
      }

      startCheckout();
      return;
    });

    if (!didEmitPurchaseStart) {
      alert("Connect to the server before starting checkout.");
      setIsCheckoutStarting(false);
    }
  };

  const returnToRoom = () => {
    setStoredRoomViewPreference(roomId, true);
    setIsViewingRoomPage(true);
  };

  const openStore = useCallback((placement = "unknown") => {
    trackAnalyticsEvent("store_open", {
      roomCode: roomId,
      metadata: { placement }
    });
    playSoundWithUnlockRetry("sheetOpen");
    setHasAcceptedStoreTerms(false);
    setShowStore(true);
    window.setTimeout(() => window.scrollTo({ top: 0 }), 0);
    if (!storeProducts.length && !isStoreLoading) {
      loadStoreProducts();
    }
  }, [isStoreLoading, loadStoreProducts, roomId, storeProducts.length]);

  const debugLobbyModeIds = useMemo(
    () => lobbyModeOptions.map((mode) => mode.id).filter(Boolean),
    [lobbyModeOptions]
  );
  const effectiveProfileEntitledModeKeys = debugUnlockAllModes ? debugLobbyModeIds : profileEntitledModeKeys;
  const ownedLobbyModeIds = useMemo(() => {
    if (debugUnlockAllModes) {
      return lobbyModeOptions.map((mode) => mode.id).filter(Boolean);
    }

    const entitlementKeys = new Set(profileEntitledModeKeys || []);
    return lobbyModeOptions
      .filter((mode) => entitlementKeys.has(mode.id))
      .map((mode) => mode.id);
  }, [lobbyModeOptions, profileEntitledModeKeys]);

  useEffect(() => {
    let isMounted = true;

    fetch(`${serverUrl}/api/game-modes`, {
      headers: buildProfileSessionHeaders(),
      credentials: "include"
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!isMounted || !Array.isArray(payload?.modes) || payload.modes.length === 0) return;
        setLobbyModeOptions(payload.modes);
      })
      .catch((error) => console.warn("Failed to load game modes", error));

    return () => {
      isMounted = false;
    };
  }, [entitlementRefreshRequestedAtMs]);

  useEffect(() => {
    if (ownedLobbyModeIds.length === 0) {
      if (selectedLobbyModeId !== "standard") {
        window.setTimeout(() => setSelectedLobbyModeId("standard"), 0);
      }
      return;
    }

    if (!ownedLobbyModeIds.includes(selectedLobbyModeId)) {
      window.setTimeout(() => setSelectedLobbyModeId(ownedLobbyModeIds[0]), 0);
    }
  }, [ownedLobbyModeIds, selectedLobbyModeId]);

  const players = (roomState?.players ?? []).filter(Boolean);
  const me = players.find((player) => player.playerId === playerId);
  const roomAvailableModes = roomState?.availableModes ?? [];
  const debugRoomModeIds = roomAvailableModes.map((mode) => mode.id).filter(Boolean);
  const effectiveRoomEntitledModeKeys = debugUnlockAllModes ? debugRoomModeIds : (me?.entitledModeKeys ?? []);
  const hostPlayer = players.find((player) => player.isHost);
  const isPreviewRoom = Boolean(roomState?.game?.isPreview)
    || (roomState?.phase === "lobby" && Boolean(hostPlayer) && !hostPlayer.hasEntitlement);
  const shouldShowGamePage = roomState?.phase === "play"
    && !isViewingRoomPage
    && !me?.waitingForNextGame
    && me?.currentGameParticipant;

  useEffect(() => {
    if (!roomId || !players.length) {
      previousRoomAudioSnapshotRef.current = null;
      return;
    }

    const playerSnapshot = new Map(players.map((player) => [player.playerId, {
      ready: Boolean(player.ready),
      connected: Boolean(player.connected)
    }]));
    const previousSnapshot = previousRoomAudioSnapshotRef.current;

    if (!previousSnapshot || previousSnapshot.roomId !== roomId) {
      previousRoomAudioSnapshotRef.current = { roomId, players: playerSnapshot };
      return;
    }

    const previousPlayers = previousSnapshot.players;
    const hasNewPlayer = players.some((player) => !previousPlayers.has(player.playerId));
    const hasRemovedPlayer = Array.from(previousPlayers.keys()).some((id) => !playerSnapshot.has(id));
    const hasNewReadyPlayer = players.some((player) => {
      const previousPlayer = previousPlayers.get(player.playerId);
      return Boolean(player.ready) && previousPlayer && !previousPlayer.ready;
    });

    if (hasNewPlayer) {
      playSoundWithUnlockRetry("playerJoined");
    }
    if (hasRemovedPlayer) {
      playSoundWithUnlockRetry("playerLeft");
    }
    if (hasNewReadyPlayer) {
      playSoundWithUnlockRetry("playerReady");
    }

    previousRoomAudioSnapshotRef.current = { roomId, players: playerSnapshot };
  }, [players, roomId]);

  useEffect(() => {
    if (!roomId || roomState?.phase !== "play") {
      window.setTimeout(() => setIsViewingRoomPage(false), 0);
      return;
    }

    if (
      ["loading", "active", "paused"].includes(me?.game?.status)
      && !me?.waitingForNextGame
      && me?.currentGameParticipant
    ) {
      setStoredRoomViewPreference(roomId, false);
      window.setTimeout(() => setIsViewingRoomPage(false), 0);
    }
  }, [roomId, roomState?.phase, me?.game?.status, me?.waitingForNextGame, me?.currentGameParticipant, setStoredRoomViewPreference]);

  const usesDarkLobbyShell = (!roomId && !isSoloChaosLabOpen) || (roomId && !shouldShowGamePage);

  const renderApp = (lobbyContent = DEFAULT_LOBBY_CONTENT) => (
    <main className={`app-page${usesDarkLobbyShell || showStore ? " app-page-lobby" : ""}${showStore ? " app-page-checkout" : ""}`}>
      {showStore ? (
        <StoreCheckoutPage
          products={storeProducts}
          selectedProduct={selectedStoreProduct}
          selectedProductKey={selectedStoreProductKey}
          allModeCount={storeProductModeCount}
          isLoading={isStoreLoading}
          error={storeError}
          hasAcceptedTerms={hasAcceptedStoreTerms}
          isCheckoutStarting={isCheckoutStarting}
          actionsLocked={actionsLocked}
          onSelectProduct={setSelectedStoreProductKey}
          onAcceptTermsChange={setHasAcceptedStoreTerms}
          onPay={purchaseProduct}
          onCancel={() => setShowStore(false)}
          onRetry={loadStoreProducts}
        />
      ) : roomId ? (
        shouldShowGamePage ? (
          <GlitchGamePage
            roomId={roomId}
            playerId={playerId}
            players={players}
            myGame={me?.game ?? null}
            serverNow={serverOffsetMs === null ? null : serverNow}
            onSubmitAnswer={submitAnswer}
            onAssetsLoaded={notifyAssetsLoaded}
            onReturnRoom={returnToRoom}
            onExit={exitRoom}
            connectionState={connectionState}
            onUiButtonClick={playClickSound}
            isPreviewRoom={isPreviewRoom}
            availableModes={roomAvailableModes}
            selectedModeId={roomState?.selectedModeId ?? "standard"}
          />
        ) : (
          <RoomPage
            roomId={roomId}
            playerId={playerId}
            players={players}
            minPlayers={roomState?.minPlayers ?? 2}
            maxPlayers={roomState?.maxPlayers ?? 4}
            phase={roomState?.phase ?? "-"}
            roomStatus={roomState?.status ?? roomState?.phase ?? "-"}
            serverNow={serverOffsetMs === null ? null : serverNow}
            pingMs={pingMs}
            timeSyncStatus={timeSyncStatus}
            waitingForNextGame={Boolean(me?.waitingForNextGame)}
            colors={PLAYER_COLORS}
            onSetColor={setPlayerColor}
            onSetReady={setPlayerReady}
            onExit={exitRoom}
            connectionState={connectionState}
            onUiButtonClick={playClickSound}
            onSelectionChanged={playSelectionChangedSound}
            canManageReady={!actionsLocked && (connectionState === CONNECTION_STATES.CONNECTED || connectionState === CONNECTION_STATES.DEGRADED) && (roomState?.phase === "lobby" || (isViewingRoomPage && me?.game?.status === "gameover"))}
            canOpenStore={Boolean(me?.isHost)}
            isPreviewRoom={isPreviewRoom}
            previewComboLimit={roomState?.game?.previewComboLimit ?? null}
            onOpenStore={() => openStore("room")}
            hostUnlockingPending={Boolean(roomState?.hostUnlockingPending)}
            unlockingProductName={roomState?.unlockingProductName ?? null}
            selectedModeId={roomState?.selectedModeId ?? "standard"}
            availableModes={roomAvailableModes}
            canSelectMode={Boolean(!actionsLocked && me?.isHost && (debugUnlockAllModes || me?.hasEntitlement) && (roomState?.phase === "lobby" || (isViewingRoomPage && me?.game?.status === "gameover")))}
            entitlementExpiresAtMs={me?.entitlementExpiresAtMs ?? null}
            entitledModeKeys={effectiveRoomEntitledModeKeys}
            entitledModeExpiriesMs={me?.entitledModeExpiriesMs ?? {}}
            onSetMode={setRoomMode}
            onKickPlayer={kickPlayer}
            modeDebugConfigs={modeDebugConfigs}
            roomContent={lobbyContent.room}
          />
        )
      ) : isSoloChaosLabOpen ? (
        <SoloChaosLabPage
          onBack={() => setIsSoloChaosLabOpen(false)}
          onUiButtonClick={playClickSound}
        />
      ) : (
        <LobbyPage
          onOpenStore={() => openStore("lobby")}
          name={name}
          roomIdInput={roomIdInput}
          roomCodeNotice={getRoomCodeNotice(roomPreview)}
          pingMs={pingMs}
          timeSyncStatus={timeSyncStatus}
          onNameChange={setName}
          onRoomIdInputChange={setRoomIdInput}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onQrScanRoomCode={joinRoomFromQrScan}
          roomPreview={roomPreview.status === "found" ? roomPreview.room : null}
          onUiButtonClick={playClickSound}
          onSelectionChanged={playSelectionChangedSound}
          selectedModeId={selectedLobbyModeId}
          availableModes={lobbyModeOptions}
          canSelectMode={Boolean(!actionsLocked && effectiveProfileEntitledModeKeys.length)}
          actionsLocked={actionsLocked}
          profileEntitlementExpiresAtMs={profileEntitlementExpiresAtMs}
          entitledModeKeys={effectiveProfileEntitledModeKeys}
          entitledModeExpiriesMs={profileEntitledModeExpiriesMs}
          onSelectedModeChange={setSelectedLobbyModeId}
          onCreateEntitlementTransfer={createEntitlementTransfer}
          modeDebugConfigs={modeDebugConfigs}
          lobbyContent={lobbyContent}
        />
      )}
      {unlockMenuVisible ? (
        <div className="purchase-result-overlay purchase-result-overlay-unlock" role="presentation">
          <PostPurchaseUnlockMenu
            email={unlockRecoveryEmail}
            transferLink={unlockTransferLink}
            transferLinkStatus={unlockTransferLinkStatus}
            transferLinkCopied={unlockTransferLinkCopied}
            onEmailChange={setUnlockRecoveryEmail}
            onContinue={handleUnlockMenuContinue}
            onSkip={dismissUnlockMenu}
            onClose={dismissUnlockMenu}
            onCopyTransferLink={copyUnlockTransferLink}
            onRetryTransferLink={retryUnlockTransferLink}
          />
        </div>
      ) : null}
      {purchaseOverlayStatus ? (
        <div className="purchase-result-overlay" role="status" aria-live="polite">
          <div className={`purchase-result-card ${purchaseOverlayStatus}`}>
            <h2>{purchaseOverlayStatus === "success" ? "Purchase Successful" : "Purchase Failed"}</h2>
            <p>
              {purchaseOverlayStatus === "success"
                ? "Your purchase is complete and unlocks are now available."
                : "Purchase was not completed. Please try again when you're ready."}
            </p>
            <button className="btn btn-primary" onClick={handleDismissPurchaseOverlay}>Continue</button>
          </div>
        </div>
      ) : null}
      {removedFromRoomNotice ? (
        <div className="removed-room-overlay" role="alertdialog" aria-modal="true" aria-labelledby="removed-room-title" aria-describedby="removed-room-description">
          <div className="removed-room-card">
            <span className="removed-room-side-glow" aria-hidden="true" />
            <span className="removed-room-center-glow" aria-hidden="true" />
            <div className="removed-room-content">
              <span className="removed-room-icon" aria-hidden="true">
                <img src={warningIcon} alt="" />
              </span>
              <h2 id="removed-room-title">You were removed from the room.</h2>
              <p id="removed-room-description">
                The host removed you from this session.<br />
                You can host your own room anytime.
              </p>
            </div>
            <button type="button" className="removed-room-home-button" onClick={handleRemovedRoomHome}>
              Home
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );

  return STORYBLOK_IS_ENABLED ? (
    <StoryblokLobbyContent>
      {(lobbyContent) => renderApp(lobbyContent)}
    </StoryblokLobbyContent>
  ) : renderApp();
}

export default App;
