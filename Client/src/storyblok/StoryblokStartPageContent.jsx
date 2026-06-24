import { useStoryblok } from "@storyblok/react";
import {
  STORYBLOK_CONTENT_VERSION,
  STORYBLOK_START_PAGE_SLUG
} from "./config.js";
import { normalizeStartPageContent } from "./startPageContent.js";

function StoryblokStartPageContent({ children }) {
  const story = useStoryblok(STORYBLOK_START_PAGE_SLUG, {
    version: STORYBLOK_CONTENT_VERSION
  });

  return children(normalizeStartPageContent(story?.content));
}

export default StoryblokStartPageContent;
