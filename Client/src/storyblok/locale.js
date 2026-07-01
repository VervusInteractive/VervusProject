import { DEFAULT_LANGUAGE, normalizeLanguage } from "../i18n.js";

export const getStoryblokLanguage = (language) => {
  const normalized = normalizeLanguage(language);
  return normalized === DEFAULT_LANGUAGE ? null : normalized;
};
