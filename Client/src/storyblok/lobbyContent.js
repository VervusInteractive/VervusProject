import { storyblokEditable } from "@storyblok/react";

const editableFallback = {};

export const DEFAULT_LOBBY_CONTENT = Object.freeze({
  start: {
    kicker: "Vervus Interactive",
    headline: "Host or Play",
    description: "Create a room for others, or join with a room code.",
    hostLabel: "Host",
    playLabel: "Play",
    editableAttributes: editableFallback
  },
  host: {
    backLabel: "Back",
    kicker: "Host Room",
    headline: "What should we call you?",
    description: "Enter a display name to create your room.",
    nameLabel: "Display name",
    namePlaceholder: "e.g. Alex",
    submitLabel: "Host room",
    editableAttributes: editableFallback
  },
  play: {
    backLabel: "Back",
    kicker: "Join Room",
    headline: "Get in. We're waiting.",
    description: "Join the room and start playing.\nNo download. No account.",
    nameLabel: "Display name",
    namePlaceholder: "e.g. Alex",
    roomCodeLabel: "Room code",
    roomCodePlaceholder: "XX-XX-XX",
    submitLabel: "Join room",
    qrButtonLabel: "Scan QR code",
    qrModalTitle: "Scan QR code",
    qrModalDescription: "QR scanning is not connected yet. Enter the room code to join for now.",
    qrModalCloseLabel: "Close",
    editableAttributes: editableFallback
  }
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

const isMatchingComponent = (blok, componentNames) => (
  componentNames.includes(blok?.component)
);

const resolveBlok = (storyContent, componentNames, fieldHints = []) => {
  if (!storyContent) return null;

  if (isMatchingComponent(storyContent, componentNames)) return storyContent;

  if (fieldHints.some((fieldName) => Boolean(storyContent[fieldName]))) {
    return storyContent;
  }

  if (!Array.isArray(storyContent.body)) return null;

  return storyContent.body.find((blok) => (
    isMatchingComponent(blok, componentNames)
    || fieldHints.some((fieldName) => Boolean(blok?.[fieldName]))
  )) || null;
};

const normalizeStartContent = (blok) => {
  const fallback = DEFAULT_LOBBY_CONTENT.start;
  if (!blok) return fallback;

  return {
    kicker: getFirstText(blok, ["kicker", "Kicker", "eyebrow", "Eyebrow"], fallback.kicker),
    headline: getFirstText(blok, ["headline", "Headline", "title", "Title"], fallback.headline),
    description: getFirstText(blok, ["description", "Description", "subtitle", "Subtitle", "body", "Body"], fallback.description),
    hostLabel: getFirstText(blok, ["host_button_label", "Host Button Label", "HostButtonLabel", "hostButtonLabel", "hostLabel", "host_label"], fallback.hostLabel),
    playLabel: getFirstText(blok, ["play_button_label", "Play Button Label", "PlayButtonLabel", "playButtonLabel", "playLabel", "play_label"], fallback.playLabel),
    editableAttributes: storyblokEditable(blok)
  };
};

const normalizeHostContent = (blok) => {
  const fallback = DEFAULT_LOBBY_CONTENT.host;
  if (!blok) return fallback;

  return {
    backLabel: getFirstText(blok, ["back_label", "Back Label", "BackLabel", "backLabel"], fallback.backLabel),
    kicker: getFirstText(blok, ["kicker", "Kicker", "eyebrow", "Eyebrow"], fallback.kicker),
    headline: getFirstText(blok, ["headline", "Headline", "title", "Title"], fallback.headline),
    description: getFirstText(blok, ["description", "Description", "subtitle", "Subtitle", "body", "Body"], fallback.description),
    nameLabel: getFirstText(blok, ["name_label", "Name Label", "NameLabel", "nameLabel"], fallback.nameLabel),
    namePlaceholder: getFirstText(blok, ["name_placeholder", "Name Placeholder", "NamePlaceholder", "namePlaceholder"], fallback.namePlaceholder),
    submitLabel: getFirstText(blok, ["submit_label", "Submit Label", "SubmitLabel", "submitLabel", "host_button_label", "hostButtonLabel"], fallback.submitLabel),
    editableAttributes: storyblokEditable(blok)
  };
};

const normalizePlayContent = (blok) => {
  const fallback = DEFAULT_LOBBY_CONTENT.play;
  if (!blok) return fallback;

  return {
    backLabel: getFirstText(blok, ["back_label", "Back Label", "BackLabel", "backLabel"], fallback.backLabel),
    kicker: getFirstText(blok, ["kicker", "Kicker", "eyebrow", "Eyebrow"], fallback.kicker),
    headline: getFirstText(blok, ["headline", "Headline", "title", "Title"], fallback.headline),
    description: getFirstText(blok, ["description", "Description", "subtitle", "Subtitle", "body", "Body"], fallback.description),
    nameLabel: getFirstText(blok, ["name_label", "Name Label", "NameLabel", "nameLabel"], fallback.nameLabel),
    namePlaceholder: getFirstText(blok, ["name_placeholder", "Name Placeholder", "NamePlaceholder", "namePlaceholder"], fallback.namePlaceholder),
    roomCodeLabel: getFirstText(blok, ["room_code_label", "Room Code Label", "RoomCodeLabel", "roomCodeLabel"], fallback.roomCodeLabel),
    roomCodePlaceholder: getFirstText(blok, ["room_code_placeholder", "Room Code Placeholder", "RoomCodePlaceholder", "roomCodePlaceholder"], fallback.roomCodePlaceholder),
    submitLabel: getFirstText(blok, ["submit_label", "Submit Label", "SubmitLabel", "submitLabel", "join_button_label", "joinButtonLabel"], fallback.submitLabel),
    qrButtonLabel: getFirstText(blok, ["qr_button_label", "QR Button Label", "QrButtonLabel", "qrButtonLabel"], fallback.qrButtonLabel),
    qrModalTitle: getFirstText(blok, ["qr_modal_title", "QR Modal Title", "QrModalTitle", "qrModalTitle"], fallback.qrModalTitle),
    qrModalDescription: getFirstText(blok, ["qr_modal_description", "QR Modal Description", "QrModalDescription", "qrModalDescription"], fallback.qrModalDescription),
    qrModalCloseLabel: getFirstText(blok, ["qr_modal_close_label", "QR Modal Close Label", "QrModalCloseLabel", "qrModalCloseLabel"], fallback.qrModalCloseLabel),
    editableAttributes: storyblokEditable(blok)
  };
};

export const normalizeLobbyContent = (storyContent) => {
  const startBlok = resolveBlok(
    storyContent,
    ["start_page", "startPage", "start-page"],
    ["host_button_label", "play_button_label"]
  );
  const hostBlok = resolveBlok(
    storyContent,
    ["host_page", "hostPage", "host-page", "host_room", "hostRoom", "host-room"],
    ["name_placeholder", "host_button_label"]
  );
  const playBlok = resolveBlok(
    storyContent,
    ["play_page", "playPage", "play-page", "join_page", "joinPage", "join-page"],
    ["room_code_label", "qr_button_label", "join_button_label"]
  );

  return {
    start: normalizeStartContent(startBlok),
    host: normalizeHostContent(hostBlok),
    play: normalizePlayContent(playBlok)
  };
};
