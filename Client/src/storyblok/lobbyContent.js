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
    qrModalDescription: "QR scanning is not connected yet. Enter the room code to join for now.",
    qrModalCloseLabel: "Close",
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

const normalizeRoomContent = (blok) => {
  const fallback = DEFAULT_LOBBY_CONTENT.room;
  if (!blok) return fallback;

  return {
    statusActiveLabel: getFirstText(blok, ["status_active_label", "Status Active Label", "statusActiveLabel"], fallback.statusActiveLabel),
    statusLabelLobby: getFirstText(blok, ["status_label_lobby", "Status Label Lobby", "statusLabelLobby"], fallback.statusLabelLobby),
    statusLabelPreview: getFirstText(blok, ["status_label_preview", "Status Label Preview", "statusLabelPreview"], fallback.statusLabelPreview),
    statusLabelPaymentPending: getFirstText(blok, ["status_label_payment_pending", "Status Label Payment Pending", "statusLabelPaymentPending"], fallback.statusLabelPaymentPending),
    statusLabelPremium: getFirstText(blok, ["status_label_premium", "Status Label Premium", "statusLabelPremium"], fallback.statusLabelPremium),
    statusLabelReconnecting: getFirstText(blok, ["status_label_reconnecting", "Status Label Reconnecting", "statusLabelReconnecting"], fallback.statusLabelReconnecting),
    statusLabelEnded: getFirstText(blok, ["status_label_ended", "Status Label Ended", "statusLabelEnded"], fallback.statusLabelEnded),
    statusLabelExpired: getFirstText(blok, ["status_label_expired", "Status Label Expired", "statusLabelExpired"], fallback.statusLabelExpired),
    hostHeadlinePrimary: getFirstText(blok, ["host_headline_primary", "Host Headline Primary", "hostHeadlinePrimary"], fallback.hostHeadlinePrimary),
    hostHeadlineSecondary: getFirstText(blok, ["host_headline_secondary", "Host Headline Secondary", "hostHeadlineSecondary"], fallback.hostHeadlineSecondary),
    joinStatusPrefix: getFirstText(blok, ["join_status_prefix", "Join Status Prefix", "joinStatusPrefix"], fallback.joinStatusPrefix),
    joinHeadline: getFirstText(blok, ["join_headline", "Join Headline", "joinHeadline"], fallback.joinHeadline),
    joinDescriptionTemplate: getFirstText(blok, ["join_description_template", "Join Description Template", "joinDescriptionTemplate"], fallback.joinDescriptionTemplate),
    fallbackHostName: getFirstText(blok, ["fallback_host_name", "Fallback Host Name", "fallbackHostName"], fallback.fallbackHostName),
    inviteShareLabel: getFirstText(blok, ["invite_share_label", "Invite Share Label", "inviteShareLabel"], fallback.inviteShareLabel),
    copyInviteLabel: getFirstText(blok, ["copy_invite_label", "Copy Invite Label", "copyInviteLabel"], fallback.copyInviteLabel),
    copySuccessLabel: getFirstText(blok, ["copy_success_label", "Copy Success Label", "copySuccessLabel"], fallback.copySuccessLabel),
    copyErrorLabel: getFirstText(blok, ["copy_error_label", "Copy Error Label", "copyErrorLabel"], fallback.copyErrorLabel),
    qrOpenLabel: getFirstText(blok, ["qr_open_label", "QR Open Label", "qrOpenLabel"], fallback.qrOpenLabel),
    qrModalTitleTemplate: getFirstText(blok, ["qr_modal_title_template", "QR Modal Title Template", "qrModalTitleTemplate"], fallback.qrModalTitleTemplate),
    qrModalCloseLabel: getFirstText(blok, ["qr_modal_close_label", "QR Modal Close Label", "qrModalCloseLabel"], fallback.qrModalCloseLabel),
    playersLabel: getFirstText(blok, ["players_label", "Players Label", "playersLabel"], fallback.playersLabel),
    readyCountLabel: getFirstText(blok, ["ready_count_label", "Ready Count Label", "readyCountLabel"], fallback.readyCountLabel),
    joinedCountLabel: getFirstText(blok, ["joined_count_label", "Joined Count Label", "joinedCountLabel"], fallback.joinedCountLabel),
    currentPlayerLabel: getFirstText(blok, ["current_player_label", "Current Player Label", "currentPlayerLabel"], fallback.currentPlayerLabel),
    playerHostLabel: getFirstText(blok, ["player_host_label", "Player Host Label", "playerHostLabel"], fallback.playerHostLabel),
    playerReadyLabel: getFirstText(blok, ["player_ready_label", "Player Ready Label", "playerReadyLabel"], fallback.playerReadyLabel),
    playerWaitingLabel: getFirstText(blok, ["player_waiting_label", "Player Waiting Label", "playerWaitingLabel"], fallback.playerWaitingLabel),
    playerReconnectingLabel: getFirstText(blok, ["player_reconnecting_label", "Player Reconnecting Label", "playerReconnectingLabel"], fallback.playerReconnectingLabel),
    playerHostReconnectingLabel: getFirstText(blok, ["player_host_reconnecting_label", "Player Host Reconnecting Label", "playerHostReconnectingLabel"], fallback.playerHostReconnectingLabel),
    playerTransferringHostLabel: getFirstText(blok, ["player_transferring_host_label", "Player Transferring Host Label", "playerTransferringHostLabel"], fallback.playerTransferringHostLabel),
    playerDisconnectedLabel: getFirstText(blok, ["player_disconnected_label", "Player Disconnected Label", "playerDisconnectedLabel"], fallback.playerDisconnectedLabel),
    playerConnectedLabel: getFirstText(blok, ["player_connected_label", "Player Connected Label", "playerConnectedLabel"], fallback.playerConnectedLabel),
    playerRemovedLabel: getFirstText(blok, ["player_removed_label", "Player Removed Label", "playerRemovedLabel"], fallback.playerRemovedLabel),
    playerInGameLabel: getFirstText(blok, ["player_in_game_label", "Player In Game Label", "playerInGameLabel"], fallback.playerInGameLabel),
    changeColorLabel: getFirstText(blok, ["change_color_label", "Change Color Label", "changeColorLabel"], fallback.changeColorLabel),
    leaveRoomLabel: getFirstText(blok, ["leave_room_label", "Leave Room Label", "leaveRoomLabel"], fallback.leaveRoomLabel),
    removePlayerTemplate: getFirstText(blok, ["remove_player_template", "Remove Player Template", "removePlayerTemplate"], fallback.removePlayerTemplate),
    previewLabel: getFirstText(blok, ["preview_label", "Preview Label", "previewLabel"], fallback.previewLabel),
    experienceLabel: getFirstText(blok, ["experience_label", "Experience Label", "experienceLabel"], fallback.experienceLabel),
    selectedByTemplate: getFirstText(blok, ["selected_by_template", "Selected By Template", "selectedByTemplate"], fallback.selectedByTemplate),
    aboutExperienceLabel: getFirstText(blok, ["about_experience_label", "About Experience Label", "aboutExperienceLabel"], fallback.aboutExperienceLabel),
    paymentPendingTitle: getFirstText(blok, ["payment_pending_title", "Payment Pending Title", "paymentPendingTitle"], fallback.paymentPendingTitle),
    paymentPendingDescription: getFirstText(blok, ["payment_pending_description", "Payment Pending Description", "paymentPendingDescription"], fallback.paymentPendingDescription),
    unlockingTemplate: getFirstText(blok, ["unlocking_template", "Unlocking Template", "unlockingTemplate"], fallback.unlockingTemplate),
    unlockButtonLabel: getFirstText(blok, ["unlock_button_label", "Unlock Button Label", "unlockButtonLabel"], fallback.unlockButtonLabel),
    modeNote: getFirstText(blok, ["mode_note", "Mode Note", "modeNote"], fallback.modeNote),
    waitingForNextGameNote: getFirstText(blok, ["waiting_for_next_game_note", "Waiting For Next Game Note", "waitingForNextGameNote"], fallback.waitingForNextGameNote),
    hostStartPreviewLabel: getFirstText(blok, ["host_start_preview_label", "Host Start Preview Label", "hostStartPreviewLabel"], fallback.hostStartPreviewLabel),
    hostStartGameLabel: getFirstText(blok, ["host_start_game_label", "Host Start Game Label", "hostStartGameLabel"], fallback.hostStartGameLabel),
    readyButtonLabel: getFirstText(blok, ["ready_button_label", "Ready Button Label", "readyButtonLabel"], fallback.readyButtonLabel),
    notReadyButtonLabel: getFirstText(blok, ["not_ready_button_label", "Not Ready Button Label", "notReadyButtonLabel"], fallback.notReadyButtonLabel),
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
  const roomBlok = resolveBlok(
    storyContent,
    ["room_lobby", "roomLobby", "room-lobby", "lobby_room", "lobbyRoom", "lobby-room"],
    ["host_headline_primary", "copy_invite_label", "ready_button_label"]
  );

  return {
    start: normalizeStartContent(startBlok),
    host: normalizeHostContent(hostBlok),
    play: normalizePlayContent(playBlok),
    room: normalizeRoomContent(roomBlok)
  };
};
