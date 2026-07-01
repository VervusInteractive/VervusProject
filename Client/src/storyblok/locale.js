import { DEFAULT_LANGUAGE, normalizeLanguage } from "../i18n.js";

export const STORYBLOK_DEFAULT_LANGUAGE = "default";

const STORYBLOK_LANGUAGE_BY_APP_LANGUAGE = {
  [DEFAULT_LANGUAGE]: STORYBLOK_DEFAULT_LANGUAGE,
  af: "af",
  fr: "fr",
  nl: "nl",
  ru: "ru",
  pt: "pt",
  es: "es"
};

export const getStoryblokLanguage = (language) => {
  const normalized = normalizeLanguage(language);
  const storyblokLanguage = STORYBLOK_LANGUAGE_BY_APP_LANGUAGE[normalized]
    || STORYBLOK_LANGUAGE_BY_APP_LANGUAGE[DEFAULT_LANGUAGE];

  return storyblokLanguage === STORYBLOK_DEFAULT_LANGUAGE ? null : storyblokLanguage;
};

export const getStoryblokLanguageLabel = (language) => {
  const normalized = normalizeLanguage(language);
  return STORYBLOK_LANGUAGE_BY_APP_LANGUAGE[normalized]
    || STORYBLOK_LANGUAGE_BY_APP_LANGUAGE[DEFAULT_LANGUAGE];
};
