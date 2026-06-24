export const STORYBLOK_ACCESS_TOKEN = import.meta.env.VITE_STORYBLOK_DELIVERY_API_TOKEN || "";
export const STORYBLOK_IS_ENABLED = Boolean(STORYBLOK_ACCESS_TOKEN);
export const STORYBLOK_REGION = import.meta.env.VITE_STORYBLOK_REGION || "eu";
export const STORYBLOK_START_PAGE_SLUG = import.meta.env.VITE_STORYBLOK_START_PAGE_SLUG || "home";

const STORYBLOK_CONTENT_VERSION = import.meta.env.VITE_STORYBLOK_CONTENT_VERSION || "";

const isStoryblokVisualEditor = () => {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const hasStoryblokParam = [...params.keys()].some((key) => key.startsWith("_storyblok"));
  const hasStoryblokReferrer = document.referrer.includes("app.storyblok.com");

  return hasStoryblokParam || hasStoryblokReferrer;
};

export const getStoryblokContentVersion = () => {
  if (STORYBLOK_CONTENT_VERSION) return STORYBLOK_CONTENT_VERSION;
  if (import.meta.env.DEV || isStoryblokVisualEditor()) return "draft";
  return "published";
};
