export const COOKIE_CONSENT_STORAGE_KEY = "vervusCookieChoice";
export const COOKIE_CONSENT_CHANGE_EVENT = "vervus:cookie-consent-change";
export const ANALYTICS_VISITOR_STORAGE_KEY = "analyticsVisitorId";

export const COOKIE_CONSENT_CHOICES = Object.freeze({
  ALLOW: "allow",
  ESSENTIAL: "essential",
  CLOSED: "closed"
});

export function getCookieConsentChoice() {
  return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) || "";
}

export function hasCookieConsentChoice() {
  return Boolean(getCookieConsentChoice());
}

export function hasAnalyticsConsent() {
  return getCookieConsentChoice() === COOKIE_CONSENT_CHOICES.ALLOW;
}

export function setCookieConsentChoice(choice) {
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);

  if (choice !== COOKIE_CONSENT_CHOICES.ALLOW) {
    localStorage.removeItem(ANALYTICS_VISITOR_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, {
    detail: { choice }
  }));
}
