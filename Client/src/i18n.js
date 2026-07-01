import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import afCommon from "./locales/af/common.json";
import enCommon from "./locales/en/common.json";

const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = ["en", "af"];

const normalizeLanguage = (language) => {
  const normalized = String(language || "").trim().toLowerCase();
  if (!normalized) return DEFAULT_LANGUAGE;

  const exactMatch = SUPPORTED_LANGUAGES.find((value) => value === normalized);
  if (exactMatch) return exactMatch;

  const baseLanguage = normalized.split("-")[0];
  return SUPPORTED_LANGUAGES.includes(baseLanguage) ? baseLanguage : DEFAULT_LANGUAGE;
};

const getInitialLanguage = () => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  return normalizeLanguage(window.localStorage.getItem("vervusLanguage") || navigator.language);
};

const resources = {
  af: {
    common: afCommon
  },
  en: {
    common: enCommon
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
      escapeValue: false
    }
  });

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.resolvedLanguage || DEFAULT_LANGUAGE;
}

i18n.on("languageChanged", (language) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("vervusLanguage", language);
  }

  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
});

export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, normalizeLanguage };
export default i18n;
