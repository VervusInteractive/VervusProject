import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import clearBackgroundLogo from "../assets/images/Logos/Logo_ClearBackground.svg";
import warningIcon from "../assets/images/VervusIcons/Icons_Warning.png";
import timerIcon from "../assets/images/VervusIcons/Icons_Timer.png";
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
const MIN_SCANNABLE_ROOM_CODE_LENGTH = 4;
const ROOM_CODE_NOTICE_CONFIG = {
  not_found: {
    title: "Room not found",
    body: "Check the code with your host — it may have changed.",
    icon: warningIcon,
    variant: "warning"
  },
  full: {
    title: "Room is full",
    body: "This run already has 4 players.",
    icon: warningIcon,
    variant: "warning"
  },
  expired: {
    title: "Room expired",
    body: "This room has closed. Start a new run with your friends anytime.",
    icon: timerIcon,
    variant: "expired"
  }
};

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

function extractRoomCodeFromQrValue(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  try {
    const parsedUrl = new URL(rawValue, window.location.origin);
    const roomCode = normalizeRoomCodeInput(parsedUrl.searchParams.get("room"));
    if (roomCode.length >= MIN_SCANNABLE_ROOM_CODE_LENGTH) return roomCode;
  } catch {
    // Fall through to plain room-code parsing.
  }

  if (!/^[A-Z2-9\s-]{4,16}$/i.test(rawValue)) return "";

  const roomCode = normalizeRoomCodeInput(rawValue);
  return roomCode.length >= MIN_SCANNABLE_ROOM_CODE_LENGTH ? roomCode : "";
}

function isExpectedScanMiss(error) {
  const errorName = error?.name || error?.constructor?.name || "";
  return errorName === "NotFoundException"
    || errorName === "ChecksumException"
    || errorName === "FormatException";
}

function getCameraErrorMessage(error) {
  const errorName = error?.name || error?.constructor?.name || "";

  if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
    return "Camera permission was blocked. Allow camera access and try again.";
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return "The camera is already in use by another app.";
  }

  if (errorName === "OverconstrainedError" || errorName === "ConstraintNotSatisfiedError") {
    return "This camera cannot use the requested scan settings.";
  }

  if (errorName === "SecurityError") {
    return "Camera access is blocked by this browser.";
  }

  return "The camera could not start. Check permissions and try again.";
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

function RoomCodeNotice({ notice }) {
  const config = ROOM_CODE_NOTICE_CONFIG[notice?.type];
  if (!config) return null;

  return (
    <div className={`lobby-room-code-message ${config.variant}`} role="status" aria-live="polite">
      <div className="lobby-room-code-message-content">
        <div className="lobby-room-code-message-header">
          <span className="lobby-room-code-message-icon" aria-hidden="true">
            <img src={config.icon} alt="" />
          </span>
          <strong>{config.title}</strong>
        </div>
        <p>{config.body}</p>
      </div>
    </div>
  );
}

function QrScannerOverlay({
  title = "Scan QR Code",
  description = "Position the QR code within the frame.",
  cancelLabel = "Cancel",
  onCancel,
  onDetected
}) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  const onDetectedRef = useRef(onDetected);
  const hasDetectedRef = useRef(false);
  const [scannerMessage, setScannerMessage] = useState("Starting camera...");
  const [scannerMessageType, setScannerMessageType] = useState("info");

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancelRef.current?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let isActive = true;

    const stopPreviewStream = () => {
      controlsRef.current?.stop?.();
      controlsRef.current = null;

      const videoElement = videoRef.current;
      const stream = videoElement?.srcObject;
      if (stream && typeof stream.getTracks === "function") {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
        videoElement.removeAttribute("src");
      }
    };

    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerMessage("This browser does not support in-app camera scanning.");
        setScannerMessageType("error");
        return;
      }

      const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
      if (!window.isSecureContext && !isLocalHost) {
        setScannerMessage("Camera scanning requires HTTPS.");
        setScannerMessageType("error");
        return;
      }

      try {
        const codeReader = new BrowserQRCodeReader();
        const controls = await codeReader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          },
          videoRef.current,
          (result, error, scannerControls) => {
            controlsRef.current = scannerControls;
            if (!isActive || hasDetectedRef.current) return;

            if (result) {
              const rawScanValue = result.getText();
              const roomCode = extractRoomCodeFromQrValue(rawScanValue);
              if (!roomCode) {
                setScannerMessage("That QR code is not a Vervus room invite.");
                setScannerMessageType("error");
                return;
              }

              hasDetectedRef.current = true;
              scannerControls.stop();
              onDetectedRef.current?.(roomCode, rawScanValue);
              return;
            }

            if (error && !isExpectedScanMiss(error)) {
              setScannerMessage(getCameraErrorMessage(error));
              setScannerMessageType("error");
            }
          }
        );

        controlsRef.current = controls;
        if (!isActive || hasDetectedRef.current) {
          controls.stop();
          return;
        }

        setScannerMessage("Point your camera at the room QR code.");
        setScannerMessageType("info");
      } catch (error) {
        if (!isActive) return;
        setScannerMessage(getCameraErrorMessage(error));
        setScannerMessageType("error");
      }
    };

    startScanner();

    return () => {
      isActive = false;
      stopPreviewStream();
    };
  }, []);

  return (
    <div className="qr-scanner-overlay" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title">
      <div className="qr-scanner-shell">
        <div className="qr-scanner-content">
          <div className="qr-scanner-camera-mark" aria-hidden="true">
            <span />
          </div>
          <div className="qr-scanner-copy">
            <h2 id="qr-scanner-title">{title}</h2>
            <p>{description}</p>
          </div>
          <div className="qr-scanner-frame" aria-label="Camera preview">
            <video ref={videoRef} className="qr-scanner-video" autoPlay muted playsInline />
            <div className="qr-scanner-grid" aria-hidden="true" />
            <div className="qr-scanner-corners" aria-hidden="true">
              <span className="top-left" />
              <span className="top-right" />
              <span className="bottom-left" />
              <span className="bottom-right" />
            </div>
            <span className="qr-scanner-line" aria-hidden="true" />
          </div>
          <p className={`qr-scanner-status ${scannerMessageType}`} role="status" aria-live="polite">
            {scannerMessage}
          </p>
        </div>
        <button type="button" className="qr-scanner-cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

function LobbyPage({
  name,
  roomIdInput,
  roomPreview = null,
  roomCodeNotice = null,
  onNameChange,
  onRoomIdInputChange,
  onCreateRoom,
  onJoinRoom,
  onQrScanRoomCode,
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
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const formattedRoomCode = formatRoomCode(roomIdInput);
  const hasBlockingRoomCodeNotice = ["not_found", "full", "expired"].includes(roomCodeNotice?.type);
  const canJoin = !actionsLocked && !hasBlockingRoomCodeNotice && name.trim().length > 0 && normalizeRoomCodeInput(roomIdInput).length >= 4;
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

  const handleOpenQrScanner = () => {
    onUiButtonClick?.();
    setIsQrScannerOpen(true);
  };

  const handleQrScanDetected = (roomCode) => {
    onUiButtonClick?.();
    onRoomIdInputChange(roomCode);
    setPublicPage("landing");
    setLobbyStep("play");
    setIsQrScannerOpen(false);
    onQrScanRoomCode?.(roomCode);
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
        onNavigate={handleNavigatePublicPage}
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

      <RoomCodeNotice notice={roomCodeNotice} />

      <div className="lobby-actions">
        <button className="lobby-primary-action" type="submit" disabled={!canJoin}>
          {playPageContent.submitLabel}
        </button>
        <button className="lobby-secondary-action" type="button" onClick={handleOpenQrScanner} disabled={actionsLocked}>
          {playPageContent.qrButtonLabel}
        </button>
      </div>
    </form>
  );

  const renderQrScanner = (playPageContent = DEFAULT_LOBBY_CONTENT.play) => (
    <QrScannerOverlay
      title={playPageContent.qrModalTitle || DEFAULT_LOBBY_CONTENT.play.qrModalTitle}
      description={/not connected/i.test(playPageContent.qrModalDescription || "")
        ? DEFAULT_LOBBY_CONTENT.play.qrModalDescription
        : (playPageContent.qrModalDescription || DEFAULT_LOBBY_CONTENT.play.qrModalDescription)}
      cancelLabel={/^close$/i.test(playPageContent.qrModalCloseLabel || "")
        ? DEFAULT_LOBBY_CONTENT.play.qrModalCloseLabel
        : (playPageContent.qrModalCloseLabel || DEFAULT_LOBBY_CONTENT.play.qrModalCloseLabel)}
      onCancel={() => {
        onUiButtonClick?.();
        setIsQrScannerOpen(false);
      }}
      onDetected={handleQrScanDetected}
    />
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
        {isQrScannerOpen ? renderQrScanner(lobbyContent.play) : null}
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
