import { storyblokEditable } from "@storyblok/react";

const editableFallback = {};

export const DEFAULT_LOBBY_CONTENT = Object.freeze({
  start: {
    kicker: "",
    headline: "One Room.\nTotal Chaos.",
    description: "Play together in seconds.",
    hostLabel: "Host a room",
    playLabel: "Join a room",
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
    qrModalDescription: "Position the QR code within the frame.",
    qrModalCloseLabel: "Cancel",
    editableAttributes: editableFallback
  },
  room: {
    statusActiveLabel: "Room active",
    statusLabelLobby: "Lobby",
    statusLabelPreview: "Preview",
    statusLabelPaymentPending: "Payment pending",
    statusLabelPremium: "Premium",
    statusLabelReconnecting: "Reconnecting",
    statusLabelEnded: "Ended",
    statusLabelExpired: "Expired",
    hostHeadlinePrimary: "Send it.",
    hostHeadlineSecondary: "Get everyone in.",
    joinStatusPrefix: "Room",
    joinHeadline: "Waiting for everyone.",
    joinDescriptionTemplate: "{host} will start once everyone is ready.",
    fallbackHostName: "Host",
    inviteShareLabel: "Share with your group",
    copyInviteLabel: "Copy join link",
    copySuccessLabel: "Copied",
    copyErrorLabel: "Copy failed",
    qrOpenLabel: "Open QR code",
    qrModalTitleTemplate: "Scan to join room {room}",
    qrModalCloseLabel: "Close",
    playersLabel: "Players",
    readyCountLabel: "Ready",
    joinedCountLabel: "joined",
    currentPlayerLabel: "You",
    playerHostLabel: "Host",
    playerReadyLabel: "Ready",
    playerWaitingLabel: "Waiting...",
    playerReconnectingLabel: "Reconnecting...",
    playerHostReconnectingLabel: "Host reconnecting...",
    playerTransferringHostLabel: "Transferring host...",
    playerDisconnectedLabel: "Disconnected",
    playerConnectedLabel: "Connected",
    playerRemovedLabel: "Removed from room",
    playerInGameLabel: "In Game",
    changeColorLabel: "Change your player color",
    leaveRoomLabel: "Leave room",
    removePlayerTemplate: "Remove {player}",
    previewLabel: "Free preview",
    experienceLabel: "Experience",
    selectedByTemplate: "selected by {host}",
    aboutExperienceLabel: "About this experience",
    paymentPendingTitle: "Payment pending",
    paymentPendingDescription: "Stay here for the premium game and mode teasers.",
    unlockingTemplate: "{host} is unlocking {product}",
    unlockButtonLabel: "Unlock Vervus",
    modeNote: "Preview rooms are locked to GLiTCH!.",
    waitingForNextGameNote: "A game is currently active. You are queued for the next game and can ready up once this round ends.",
    hostStartPreviewLabel: "Start free preview",
    hostStartGameLabel: "Start game",
    readyButtonLabel: "I'm ready",
    notReadyButtonLabel: "I'm not ready",
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

export const normalizeLobbyContent = (storyContent) => {
  const startBlok = resolveBlok(
    storyContent,
    ["start_page", "startPage", "start-page"],
    ["host_button_label", "play_button_label"]
  );

  return {
    start: normalizeStartContent(startBlok),
    host: DEFAULT_LOBBY_CONTENT.host,
    play: DEFAULT_LOBBY_CONTENT.play,
    room: DEFAULT_LOBBY_CONTENT.room
  };
};
