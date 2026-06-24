import { useStoryblok } from "@storyblok/react";
import {
  getStoryblokContentVersion,
  STORYBLOK_START_PAGE_SLUG
} from "./config.js";
import { normalizeLobbyContent } from "./lobbyContent.js";

function StoryblokLobbyContent({ children }) {
  const story = useStoryblok(STORYBLOK_START_PAGE_SLUG, {
    version: getStoryblokContentVersion()
  });

  return children(normalizeLobbyContent(story?.content));
}

export default StoryblokLobbyContent;
