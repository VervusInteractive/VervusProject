import { useState } from "react";
import clearBackgroundLogo from "../assets/images/Logos/Logo_ClearBackground.svg";
import {
  ContactPage,
  FaqPage,
  LandingHome,
  LandingMenu,
  LegalPage
} from "./VervusPublicPages.jsx";
import {
  DEFAULT_LOBBY_CONTENT
} from "../storyblok/lobbyContent.js";

const ROOM_CODE_MAX_LENGTH = 6;

function normalizeRoomCodeInput(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, ROOM_CODE_MAX_LENGTH);
}

function formatRoomCode(value) {
  const normalized = normalizeRoomCodeInput(value);
  return normalized.match(/.{1,2}/g)?.join("-") || "";
}

function formatRoomPreviewNames(playerNames = []) {
  const names = playerNames
    .map((playerName) => String(playerName || "").trim())
    .filter(Boolean)
    .map((playerName) => playerName.toUpperCase());

  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} IS ALREADY IN`;
  if (names.length === 2) return `${names[0]} & ${names[1]} ARE ALREADY IN`;

  return `${names[0]}, ${names[1]} & ${names.length - 2} MORE ARE ALREADY IN`;
}

function getRoomPreviewModeTitle(roomPreview) {
  const modeTitle = String(roomPreview?.selectedModeTitle || "GLiTCH!").trim();
  if (roomPreview?.selectedModeId === "standard" && !/standard/i.test(modeTitle)) {
    return `${modeTitle} Standard`;
  }

  return modeTitle;
}

function getRoomPreviewStatusLabel(roomPreview) {
  if (roomPreview?.joinable) return "Room active";
  if (roomPreview?.isFull) return "Room full";
  return "Room closed";
}

function LobbyPage({
  name,
  roomIdInput,
  roomPreview = null,
  onNameChange,
  onRoomIdInputChange,
  onCreateRoom,
  onJoinRoom,
  onOpenStore,
  onUiButtonClick,
  onSelectionChanged,
  selectedModeId = "standard",
  availableModes = [],
  entitledModeKeys = [],
  onSelectedModeChange,
  actionsLocked = false,
  lobbyContent = DEFAULT_LOBBY_CONTENT
}) {
  const [lobbyStep, setLobbyStep] = useState(() => (roomIdInput ? "play" : "landing"));
  const [publicPage, setPublicPage] = useState("landing");
  const [isQrNoticeOpen, setIsQrNoticeOpen] = useState(false);
  const formattedRoomCode = formatRoomCode(roomIdInput);
  const canJoin = !actionsLocked && name.trim().length > 0 && normalizeRoomCodeInput(roomIdInput).length >= 4;
  const canHost = !actionsLocked && name.trim().length > 0;

  const handleJoinSubmit = (event) => {
    event.preventDefault();
    if (!canJoin) return;
    onUiButtonClick?.();
    onJoinRoom();
  };

  const handleHostSubmit = (event) => {
    event.preventDefault();
    if (!canHost) return;
    onUiButtonClick?.();
    onCreateRoom();
  };

  const handleRoomCodeChange = (event) => {
    onRoomIdInputChange(normalizeRoomCodeInput(event.target.value));
  };

  const handleSelectStep = (nextStep) => {
    onUiButtonClick?.();
    setPublicPage("landing");
    setLobbyStep(nextStep);
  };

  const handleOpenMenu = () => {
    onUiButtonClick?.();
    setLobbyStep("landing");
    setPublicPage("menu");
    window.scrollTo({ top: 0 });
  };

  const handleCloseMenu = () => {
    onUiButtonClick?.();
    setPublicPage("landing");
    window.scrollTo({ top: 0 });
  };

  const handleNavigatePublicPage = (nextPage) => {
    onUiButtonClick?.();
    setPublicPage(nextPage);
    window.scrollTo({ top: 0 });
  };

  const handleBackToMenu = () => {
    onUiButtonClick?.();
    setPublicPage("menu");
    window.scrollTo({ top: 0 });
  };

  const handleUnlockVervus = () => {
    onOpenStore?.("landing");
  };

  const visibleLandingModes = (availableModes || []).map((mode) => ({
    ...mode,
    disabled: mode.id !== "standard" && !entitledModeKeys.includes(mode.id)
  }));

  const handleLandingModeChange = (modeId) => {
    onSelectionChanged?.();
    onSelectedModeChange?.(modeId);
  };

  const handleOpenQrNotice = () => {
    onUiButtonClick?.();
    setIsQrNoticeOpen(true);
  };

  const renderTextWithBreaks = (text) => String(text || "")
    .split("\n")
    .map((line, index, lines) => (
      <span key={`${line}-${index}`}>
        {line}
        {index < lines.length - 1 ? <br /> : null}
      </span>
    ));

  const renderLandingStep = (startPageContent = DEFAULT_LOBBY_CONTENT.start) => (
    <div {...startPageContent.editableAttributes}>
      <LandingHome
        startPageContent={startPageContent}
        onHost={() => handleSelectStep("host")}
        onJoin={() => handleSelectStep("play")}
        onOpenMenu={handleOpenMenu}
        onStartPreview={() => handleSelectStep("host")}
        onUnlock={handleUnlockVervus}
        availableModes={visibleLandingModes}
        selectedModeId={selectedModeId}
        onSelectedModeChange={handleLandingModeChange}
        canSelectMode={!actionsLocked}
      />
    </div>
  );

  const renderHostStep = (hostPageContent = DEFAULT_LOBBY_CONTENT.host) => (
    <form className="lobby-start-form" onSubmit={handleHostSubmit} {...hostPageContent.editableAttributes}>
      <button className="lobby-back-button" type="button" onClick={() => handleSelectStep("landing")}>
        {hostPageContent.backLabel}
      </button>

      <div className="lobby-heading-block">
        <p className="lobby-kicker">{hostPageContent.kicker}</p>
        <h1>{hostPageContent.headline}</h1>
        <p>{renderTextWithBreaks(hostPageContent.description)}</p>
      </div>

      <label className="lobby-field">
        <span>{hostPageContent.nameLabel}</span>
        <input
          type="text"
          autoComplete="name"
          inputMode="text"
          placeholder={hostPageContent.namePlaceholder}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>

      <div className="lobby-actions">
        <button className="lobby-primary-action" type="submit" disabled={!canHost}>
          {hostPageContent.submitLabel}
        </button>
      </div>
    </form>
  );

  const renderPlayStep = (playPageContent = DEFAULT_LOBBY_CONTENT.play) => (
    <form className="lobby-start-form" onSubmit={handleJoinSubmit} {...playPageContent.editableAttributes}>
      <button className="lobby-back-button" type="button" onClick={() => handleSelectStep("landing")}>
        {playPageContent.backLabel}
      </button>

      <div className="lobby-heading-block">
        <p className="lobby-kicker">{playPageContent.kicker}</p>
        <h1 id="join-room-title">{playPageContent.headline}</h1>
        <p>{renderTextWithBreaks(playPageContent.description)}</p>
      </div>

      <label className="lobby-field">
        <span>{playPageContent.nameLabel}</span>
        <input
          type="text"
          autoComplete="name"
          inputMode="text"
          placeholder={playPageContent.namePlaceholder}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>

      <label className="lobby-field">
        <span>{playPageContent.roomCodeLabel}</span>
        <input
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
          inputMode="text"
          maxLength={8}
          placeholder={playPageContent.roomCodePlaceholder}
          value={formattedRoomCode}
          onChange={handleRoomCodeChange}
        />
      </label>

      {roomPreview ? (
        <div className="lobby-room-preview" role="status" aria-live="polite">
          <strong>
            ROOM FOUND
            {formatRoomPreviewNames(roomPreview.playerNames) ? (
              <> &mdash; {formatRoomPreviewNames(roomPreview.playerNames)}</>
            ) : null}
          </strong>
          <p>
            {formatRoomCode(roomPreview.roomId)}
            {" "}&middot;{" "}
            {getRoomPreviewModeTitle(roomPreview)}
            {" "}&middot;{" "}
            {getRoomPreviewStatusLabel(roomPreview)}
          </p>
        </div>
      ) : null}

      <div className="lobby-actions">
        <button className="lobby-primary-action" type="submit" disabled={!canJoin}>
          {playPageContent.submitLabel}
        </button>
        <button className="lobby-secondary-action" type="button" onClick={handleOpenQrNotice}>
          {playPageContent.qrButtonLabel}
        </button>
      </div>
    </form>
  );

  const renderQrNotice = (playPageContent = DEFAULT_LOBBY_CONTENT.play) => (
    <div className="qr-modal-backdrop" onClick={() => setIsQrNoticeOpen(false)}>
      <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
        <h2 className="qr-modal-title">{playPageContent.qrModalTitle}</h2>
        <p className="panel-subtitle">{playPageContent.qrModalDescription}</p>
        <button
          type="button"
          className="btn btn-primary store-close-btn"
          onClick={() => {
            onUiButtonClick?.();
            setIsQrNoticeOpen(false);
          }}
        >
          {playPageContent.qrModalCloseLabel}
        </button>
      </div>
    </div>
  );

  const renderLobbySteps = (lobbyContent = DEFAULT_LOBBY_CONTENT) => {
    if (publicPage === "menu") {
      return <LandingMenu onClose={handleCloseMenu} onNavigate={handleNavigatePublicPage} />;
    }

    if (publicPage === "faq") {
      return <FaqPage onBack={handleBackToMenu} />;
    }

    if (publicPage === "terms") {
      return <LegalPage kind="terms" onBack={handleBackToMenu} />;
    }

    if (publicPage === "privacy") {
      return <LegalPage kind="privacy" onBack={handleBackToMenu} />;
    }

    if (publicPage === "contact") {
      return <ContactPage onBack={handleBackToMenu} />;
    }

    return (
      <>
        {lobbyStep === "host" ? renderHostStep(lobbyContent.host) : null}
        {lobbyStep === "play" ? renderPlayStep(lobbyContent.play) : null}
        {lobbyStep === "landing" ? renderLandingStep(lobbyContent.start) : null}
        {isQrNoticeOpen ? renderQrNotice(lobbyContent.play) : null}
      </>
    );
  };

  const shouldShowLegacyBrand = publicPage === "landing" && (lobbyStep === "host" || lobbyStep === "play");

  return (
    <section className="lobby-start-page" aria-label="Vervus lobby">
      {shouldShowLegacyBrand ? (
        <div className="lobby-brand" aria-label="Vervus">
          <img src={clearBackgroundLogo} alt="Vervus" />
        </div>
      ) : null}

      {renderLobbySteps(lobbyContent)}
    </section>
  );
}

export default LobbyPage;
