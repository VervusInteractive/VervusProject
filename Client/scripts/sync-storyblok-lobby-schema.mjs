import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SPACE_ID = process.env.STORYBLOK_SPACE_ID || "293406830388703";
const API_BASE_URL = process.env.STORYBLOK_MANAGEMENT_API_URL || "https://mapi.storyblok.com/v1";
const DEFAULT_TOKEN_FILE = resolve(process.cwd(), "../Document/storyblok Token.txt");

const field = (displayName, pos, type = "text") => ({
  type,
  pos,
  display_name: displayName,
  required: true
});

const componentDefinitions = [
  {
    name: "start_page",
    display_name: "Start Page",
    schema: {
      kicker: field("Kicker", 0),
      headline: field("Headline", 1),
      description: field("Description", 2),
      host_button_label: field("Host Button Label", 3),
      play_button_label: field("Play Button Label", 4)
    },
    defaults: {
      kicker: "Vervus Interactive",
      headline: "Host or Play",
      description: "Create a room for others, or join with a room code.",
      host_button_label: "Host",
      play_button_label: "Play"
    }
  }
];

const getManagementToken = () => {
  if (process.env.STORYBLOK_MANAGEMENT_TOKEN) {
    return process.env.STORYBLOK_MANAGEMENT_TOKEN.trim();
  }

  const tokenFile = process.env.STORYBLOK_MANAGEMENT_TOKEN_FILE
    ? resolve(process.env.STORYBLOK_MANAGEMENT_TOKEN_FILE)
    : DEFAULT_TOKEN_FILE;

  if (!existsSync(tokenFile)) {
    throw new Error(`Set STORYBLOK_MANAGEMENT_TOKEN or create ${tokenFile}`);
  }

  return readFileSync(tokenFile, "utf8").trim();
};

const token = getManagementToken();

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  }

  return data;
};

const mergeSchema = (existingSchema = {}, targetSchema) => Object.fromEntries(
  Object.entries(targetSchema).map(([key, targetField]) => [
    key,
    {
      ...(existingSchema[key] || {}),
      ...targetField
    }
  ])
);

const ensureComponent = async (existingComponents, definition) => {
  const existing = existingComponents.find((component) => component.name === definition.name);
  const schema = mergeSchema(existing?.schema, definition.schema);
  const component = {
    ...(existing?.id ? { id: existing.id } : {}),
    name: definition.name,
    display_name: definition.display_name,
    is_root: false,
    is_nestable: true,
    schema
  };

  if (existing) {
    await request(`/spaces/${SPACE_ID}/components/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ component })
    });
    return { action: "updated", name: definition.name };
  }

  await request(`/spaces/${SPACE_ID}/components`, {
    method: "POST",
    body: JSON.stringify({ component })
  });
  return { action: "created", name: definition.name };
};

const getHomeStory = async () => {
  const { stories } = await request(`/spaces/${SPACE_ID}/stories?per_page=100`);
  const homeStory = stories.find((story) => story.slug === "home" || story.full_slug === "home");

  if (!homeStory) {
    throw new Error("Could not find Home content entry with slug 'home'.");
  }

  const { story } = await request(`/spaces/${SPACE_ID}/stories/${homeStory.id}`);
  return story;
};

const fillMissingValues = (blok, defaults) => {
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof blok[key] !== "string" || blok[key].trim() === "") {
      blok[key] = value;
    }
  }
};

const ensureHomeBlocks = async () => {
  const story = await getHomeStory();
  const content = {
    ...story.content,
    component: story.content?.component || "page",
    body: Array.isArray(story.content?.body) ? [...story.content.body] : []
  };

  const allowedComponentNames = new Set(componentDefinitions.map((definition) => definition.name));
  content.body = content.body.filter((blok) => allowedComponentNames.has(blok?.component));

  for (const definition of componentDefinitions) {
    let blok = content.body.find((candidate) => candidate?.component === definition.name);

    if (!blok) {
      blok = {
        _uid: randomUUID(),
        component: definition.name
      };
      content.body.push(blok);
    }

    fillMissingValues(blok, definition.defaults);
  }

  await request(`/spaces/${SPACE_ID}/stories/${story.id}`, {
    method: "PUT",
    body: JSON.stringify({
      story: {
        name: story.name,
        slug: story.slug,
        content
      }
    })
  });

  return story.name;
};

const main = async () => {
  const { components } = await request(`/spaces/${SPACE_ID}/components?per_page=100`);
  const results = [];

  for (const definition of componentDefinitions) {
    results.push(await ensureComponent(components, definition));
  }

  const homeName = await ensureHomeBlocks();

  for (const result of results) {
    console.log(`${result.action}: ${result.name}`);
  }
  console.log(`updated content entry: ${homeName}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
