export const STORYBLOK_ACCESS_TOKEN = import.meta.env.VITE_STORYBLOK_DELIVERY_API_TOKEN || "";
export const STORYBLOK_IS_ENABLED = Boolean(STORYBLOK_ACCESS_TOKEN);
export const STORYBLOK_REGION = import.meta.env.VITE_STORYBLOK_REGION || "eu";
export const STORYBLOK_START_PAGE_SLUG = import.meta.env.VITE_STORYBLOK_START_PAGE_SLUG || "home";
export const STORYBLOK_CONTENT_VERSION = import.meta.env.DEV ? "draft" : "published";
