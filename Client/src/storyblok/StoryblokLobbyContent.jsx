import { useStoryblok } from "@storyblok/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  getStoryblokContentVersion,
  STORYBLOK_START_PAGE_SLUG
} from "./config.js";
import { getStoryblokLanguage } from "./locale.js";
import { normalizeLobbyContent } from "./lobbyContent.js";

function StoryblokLobbyContent({ children }) {
  const { i18n } = useTranslation();
  const storyblokLanguage = getStoryblokLanguage(i18n.resolvedLanguage || i18n.language);
  const storyParams = useMemo(() => ({
    version: getStoryblokContentVersion(),
    ...(storyblokLanguage ? { language: storyblokLanguage } : {})
  }), [storyblokLanguage]);
  const story = useStoryblok(STORYBLOK_START_PAGE_SLUG, storyParams);

  return children(normalizeLobbyContent(story?.content));
}

export default StoryblokLobbyContent;
