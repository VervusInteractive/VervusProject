import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import afCommon from "./locales/af/common.json";
import enCommon from "./locales/en/common.json";

const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = ["en", "af", "fr", "nl", "ru", "pt", "es"];

const LANGUAGE_LABELS = {
  en: "English",
  af: "Afrikaans",
  fr: "Français",
  nl: "Nederlands",
  ru: "Русский",
  pt: "Português",
  es: "Español"
};

const LANGUAGE_SELECTOR_LABELS = {
  en: "Language",
  af: "Taal",
  fr: "Langue",
  nl: "Taal",
  ru: "Язык",
  pt: "Idioma",
  es: "Idioma"
};

const buildLocaleCommon = (baseCommon, languageCode) => ({
  ...baseCommon,
  app: {
    ...baseCommon.app,
    language: LANGUAGE_LABELS[languageCode]
  },
  common: {
    ...baseCommon.common,
    languageSelector: LANGUAGE_SELECTOR_LABELS[languageCode]
  },
  languages: LANGUAGE_LABELS
});

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
    common: buildLocaleCommon(afCommon, "af")
  },
  en: {
    common: buildLocaleCommon(enCommon, "en")
  },
  fr: {
    common: buildLocaleCommon(enCommon, "fr")
  },
  nl: {
    common: buildLocaleCommon(enCommon, "nl")
  },
  ru: {
    common: buildLocaleCommon(enCommon, "ru")
  },
  pt: {
    common: buildLocaleCommon(enCommon, "pt")
  },
  es: {
    common: buildLocaleCommon(enCommon, "es")
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
