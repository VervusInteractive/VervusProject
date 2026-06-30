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
  },
  {
    name: "host_page",
    display_name: "Host Page",
    schema: {
      back_label: field("Back Label", 0),
      kicker: field("Kicker", 1),
      headline: field("Headline", 2),
      description: field("Description", 3),
      name_label: field("Name Label", 4),
      name_placeholder: field("Name Placeholder", 5),
      submit_label: field("Submit Label", 6)
    },
    defaults: {
      back_label: "Back",
      kicker: "Host Room",
      headline: "What should we call you?",
      description: "Enter a display name to create your room.",
      name_label: "Display name",
      name_placeholder: "e.g. Alex",
      submit_label: "Host room"
    }
  },
  {
    name: "play_page",
    display_name: "Play Page",
    schema: {
      back_label: field("Back Label", 0),
      kicker: field("Kicker", 1),
      headline: field("Headline", 2),
      description: field("Description", 3),
      name_label: field("Name Label", 4),
      name_placeholder: field("Name Placeholder", 5),
      room_code_label: field("Room Code Label", 6),
      room_code_placeholder: field("Room Code Placeholder", 7),
      submit_label: field("Submit Label", 8),
      qr_button_label: field("QR Button Label", 9),
      qr_modal_title: field("QR Modal Title", 10),
      qr_modal_description: field("QR Modal Description", 11),
      qr_modal_close_label: field("QR Modal Close Label", 12)
    },
    defaults: {
      back_label: "Back",
      kicker: "Join Room",
      headline: "Get in. We're waiting.",
      description: "Join the room and start playing.\nNo download. No account.",
      name_label: "Display name",
      name_placeholder: "e.g. Alex",
      room_code_label: "Room code",
      room_code_placeholder: "XX-XX-XX",
      submit_label: "Join room",
      qr_button_label: "Scan QR code",
      qr_modal_title: "Scan QR code",
      qr_modal_description: "Position the QR code within the frame.",
      qr_modal_close_label: "Cancel"
    }
  },
  {
    name: "room_lobby",
    display_name: "Room Lobby",
    schema: {
      status_active_label: field("Status Active Label", 0),
      status_label_lobby: field("Status Label - Lobby", 1),
      status_label_preview: field("Status Label - Preview", 2),
      status_label_payment_pending: field("Status Label - Payment Pending", 3),
      status_label_premium: field("Status Label - Premium", 4),
      status_label_reconnecting: field("Status Label - Reconnecting", 5),
      status_label_ended: field("Status Label - Ended", 6),
      status_label_expired: field("Status Label - Expired", 7),
      host_headline_primary: field("Host Headline Primary", 8),
      host_headline_secondary: field("Host Headline Secondary", 9),
      join_status_prefix: field("Join Status Prefix", 10),
      join_headline: field("Join Headline", 11),
      join_description_template: field("Join Description Template", 12),
      fallback_host_name: field("Fallback Host Name", 13),
      invite_share_label: field("Invite Share Label", 14),
      copy_invite_label: field("Copy Invite Label", 15),
      copy_success_label: field("Copy Success Label", 16),
      copy_error_label: field("Copy Error Label", 17),
      qr_open_label: field("QR Open Label", 18),
      qr_modal_title_template: field("QR Modal Title Template", 19),
      qr_modal_close_label: field("QR Modal Close Label", 20),
      players_label: field("Players Label", 21),
      ready_count_label: field("Ready Count Label", 22),
      joined_count_label: field("Joined Count Label", 23),
      current_player_label: field("Current Player Label", 24),
      player_host_label: field("Player Host Label", 25),
      player_ready_label: field("Player Ready Label", 26),
      player_waiting_label: field("Player Waiting Label", 27),
      player_reconnecting_label: field("Player Reconnecting Label", 28),
      player_host_reconnecting_label: field("Player Host Reconnecting Label", 29),
      player_transferring_host_label: field("Player Transferring Host Label", 30),
      player_disconnected_label: field("Player Disconnected Label", 31),
      player_connected_label: field("Player Connected Label", 32),
      player_removed_label: field("Player Removed Label", 33),
      player_in_game_label: field("Player In Game Label", 34),
      change_color_label: field("Change Color Label", 35),
      leave_room_label: field("Leave Room Label", 36),
      remove_player_template: field("Remove Player Template", 37),
      preview_label: field("Preview Label", 38),
      experience_label: field("Experience Label", 39),
      selected_by_template: field("Selected By Template", 40),
      about_experience_label: field("About Experience Label", 41),
      payment_pending_title: field("Payment Pending Title", 42),
      payment_pending_description: field("Payment Pending Description", 43),
      unlocking_template: field("Unlocking Template", 44),
      unlock_button_label: field("Unlock Button Label", 45),
      mode_note: field("Mode Note", 46),
      waiting_for_next_game_note: field("Waiting For Next Game Note", 47),
      host_start_preview_label: field("Host Start Preview Label", 48),
      host_start_game_label: field("Host Start Game Label", 49),
      ready_button_label: field("Ready Button Label", 50),
      not_ready_button_label: field("Not Ready Button Label", 51)
    },
    defaults: {
      status_active_label: "Room active",
      status_label_lobby: "Lobby",
      status_label_preview: "Preview",
      status_label_payment_pending: "Payment pending",
      status_label_premium: "Premium",
      status_label_reconnecting: "Reconnecting",
      status_label_ended: "Ended",
      status_label_expired: "Expired",
      host_headline_primary: "Send it.",
      host_headline_secondary: "Get everyone in.",
      join_status_prefix: "Room",
      join_headline: "Waiting for everyone.",
      join_description_template: "{host} will start once everyone is ready.",
      fallback_host_name: "Host",
      invite_share_label: "Share with your group",
      copy_invite_label: "Copy join link",
      copy_success_label: "Copied",
      copy_error_label: "Copy failed",
      qr_open_label: "Open QR code",
      qr_modal_title_template: "Scan to join room {room}",
      qr_modal_close_label: "Close",
      players_label: "Players",
      ready_count_label: "Ready",
      joined_count_label: "joined",
      current_player_label: "You",
      player_host_label: "Host",
      player_ready_label: "Ready",
      player_waiting_label: "Waiting...",
      player_reconnecting_label: "Reconnecting...",
      player_host_reconnecting_label: "Host reconnecting...",
      player_transferring_host_label: "Transferring host...",
      player_disconnected_label: "Disconnected",
      player_connected_label: "Connected",
      player_removed_label: "Removed from room",
      player_in_game_label: "In Game",
      change_color_label: "Change your player color",
      leave_room_label: "Leave room",
      remove_player_template: "Remove {player}",
      preview_label: "Free preview",
      experience_label: "Experience",
      selected_by_template: "selected by {host}",
      about_experience_label: "About this experience",
      payment_pending_title: "Payment pending",
      payment_pending_description: "Stay here for the premium game and mode teasers.",
      unlocking_template: "{host} is unlocking {product}",
      unlock_button_label: "Unlock Vervus",
      mode_note: "Preview rooms are locked to GLiTCH!.",
      waiting_for_next_game_note: "A game is currently active. You are queued for the next game and can ready up once this round ends.",
      host_start_preview_label: "Start free preview",
      host_start_game_label: "Start game",
      ready_button_label: "I'm ready",
      not_ready_button_label: "I'm not ready"
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
