import { storyblokEditable } from "@storyblok/react";

export const DEFAULT_START_PAGE_CONTENT = Object.freeze({
  kicker: "Vervus Interactive",
  headline: "Host or Play",
  description: "Create a room for others, or join with a room code.",
  hostLabel: "Host",
  playLabel: "Play",
  editableAttributes: {}
});

const getText = (value, fallback) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value?.text === "string" && value.text.trim()) return value.text.trim();
  return fallback;
};

const getFirstText = (blok, fieldNames, fallback) => {
  for (const fieldName of fieldNames) {
    const text = getText(blok?.[fieldName], "");
    if (text) return text;
  }

  return fallback;
};

const resolveStartPageBlok = (storyContent) => {
  if (!storyContent) return null;

  if (
    storyContent.component === "start_page"
    || storyContent.component === "startPage"
    || storyContent.headline
    || storyContent.title
  ) {
    return storyContent;
  }

  if (Array.isArray(storyContent.body)) {
    return storyContent.body.find((blok) => (
      blok?.component === "start_page"
      || blok?.component === "startPage"
      || blok?.headline
      || blok?.title
    )) || null;
  }

  return null;
};

export const normalizeStartPageContent = (storyContent) => {
  const blok = resolveStartPageBlok(storyContent);

  if (!blok) return DEFAULT_START_PAGE_CONTENT;

  return {
    kicker: getFirstText(blok, ["kicker", "eyebrow"], DEFAULT_START_PAGE_CONTENT.kicker),
    headline: getFirstText(blok, ["headline", "title"], DEFAULT_START_PAGE_CONTENT.headline),
    description: getFirstText(blok, ["description", "subtitle", "body"], DEFAULT_START_PAGE_CONTENT.description),
    hostLabel: getFirstText(blok, ["host_button_label", "hostLabel", "host_label"], DEFAULT_START_PAGE_CONTENT.hostLabel),
    playLabel: getFirstText(blok, ["play_button_label", "playLabel", "play_label"], DEFAULT_START_PAGE_CONTENT.playLabel),
    editableAttributes: storyblokEditable(blok)
  };
};
