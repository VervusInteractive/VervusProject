import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SPACE_ID = process.env.STORYBLOK_SPACE_ID || "293406830388703";
const API_BASE_URL = process.env.STORYBLOK_MANAGEMENT_API_URL || "https://mapi.storyblok.com/v1";
const DEFAULT_TOKEN_FILE = resolve(process.cwd(), "../Document/storyblok Token.txt");
const HOME_SLUG = "home";
const START_PAGE_COMPONENT_NAME = "start_page";
const PUBLISH_LANGUAGES = "[default],af,fr,nl,ru,pt,es";

const defaultFields = {
  headline: "",
  description: "",
  host_button_label: "",
  play_button_label: ""
};

const localeOverrides = {
  af: {
    headline: "Skep of speel",
    description: "Skep 'n kamer vir ander, of sluit aan met 'n kamerkode.",
    host_button_label: "Skep kamer",
    play_button_label: "Sluit aan"
  },
  fr: {
    headline: "Créer ou jouer",
    description: "Créez une salle pour d'autres personnes, ou rejoignez-en une avec un code de salle.",
    host_button_label: "Créer une salle",
    play_button_label: "Rejoindre une salle"
  },
  nl: {
    headline: "Host of speel",
    description: "Maak een kamer voor anderen of doe mee met een kamercode.",
    host_button_label: "Host een kamer",
    play_button_label: "Kamer joinen"
  },
  ru: {
    headline: "Создать или играть",
    description: "Создайте комнату для других или присоединяйтесь по коду комнаты.",
    host_button_label: "Создать комнату",
    play_button_label: "Присоединиться"
  },
  pt: {
    headline: "Criar ou jogar",
    description: "Crie uma sala para outras pessoas ou entre com um código de sala.",
    host_button_label: "Criar uma sala",
    play_button_label: "Entrar na sala"
  },
  es: {
    headline: "Crear o jugar",
    description: "Crea una sala para otras personas o únete con un código de sala.",
    host_button_label: "Crear una sala",
    play_button_label: "Unirse a la sala"
  }
};

const translatableFields = Object.keys(defaultFields);
const optionalStartPageFields = new Set(translatableFields);

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

const getHomeStory = async () => {
  const { stories } = await request(`/spaces/${SPACE_ID}/stories?per_page=100`);
  const story = stories.find((candidate) => (
    candidate.slug === HOME_SLUG || candidate.full_slug === HOME_SLUG
  ));

  if (!story) {
    throw new Error(`Could not find Home content entry with slug '${HOME_SLUG}'.`);
  }

  const { story: fullStory } = await request(`/spaces/${SPACE_ID}/stories/${story.id}`);
  return fullStory;
};

const ensureStartPageSchemaAllowsBlankDefaults = async () => {
  const { components } = await request(`/spaces/${SPACE_ID}/components?per_page=100`);
  const component = components.find((candidate) => candidate.name === START_PAGE_COMPONENT_NAME);

  if (!component) {
    throw new Error(`Could not find Storyblok component '${START_PAGE_COMPONENT_NAME}'.`);
  }

  const schema = Object.fromEntries(
    Object.entries(component.schema || {}).map(([fieldName, definition]) => [
      fieldName,
      optionalStartPageFields.has(fieldName)
        ? { ...definition, required: false }
        : definition
    ])
  );

  await request(`/spaces/${SPACE_ID}/components/${component.id}`, {
    method: "PUT",
    body: JSON.stringify({
      component: {
        id: component.id,
        name: component.name,
        display_name: component.display_name,
        is_root: component.is_root,
        is_nestable: component.is_nestable,
        schema
      }
    })
  });
};

const findStartPageBlok = (content) => {
  if (!Array.isArray(content?.body)) return null;
  return content.body.find((blok) => blok?.component === START_PAGE_COMPONENT_NAME) || null;
};

const applyDefaultAndTranslations = (blok) => {
  for (const [fieldName, value] of Object.entries(defaultFields)) {
    blok[fieldName] = value;
  }

  for (const fieldName of translatableFields) {
    for (const locale of Object.keys(localeOverrides)) {
      delete blok[`${fieldName}__i18n__${locale}`];
    }
  }

  for (const [locale, fields] of Object.entries(localeOverrides)) {
    for (const [fieldName, value] of Object.entries(fields)) {
      blok[`${fieldName}__i18n__${locale}`] = value;
    }
  }
};

const updateAndPublishStory = async (story) => {
  const content = {
    ...story.content,
    body: Array.isArray(story.content?.body) ? [...story.content.body] : []
  };
  const blok = findStartPageBlok(content);

  if (!blok) {
    throw new Error(`Story '${story.name}' does not contain a start_page block.`);
  }

  applyDefaultAndTranslations(blok);

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

  await request(`/spaces/${SPACE_ID}/stories/${story.id}/publish?lang=${encodeURIComponent(PUBLISH_LANGUAGES)}`, {
    method: "GET"
  });
};

const main = async () => {
  await ensureStartPageSchemaAllowsBlankDefaults();
  const story = await getHomeStory();
  await updateAndPublishStory(story);
  console.log(`updated and published ${HOME_SLUG} for ${PUBLISH_LANGUAGES}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
