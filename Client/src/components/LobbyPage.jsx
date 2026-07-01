import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { useTranslation } from "react-i18next";
import clearBackgroundLogo from "../assets/images/Logos/Logo_ClearBackground.svg";
import phoneIcon from "../assets/images/VervusIcons/Icons_Phone.png";
import warningIcon from "../assets/images/VervusIcons/Icons_Warning.png";
import timerIcon from "../assets/images/VervusIcons/Icons_Timer.png";
import {
  ContactPage,
  FaqPage,
  LanguagePage,
  LandingHome,
  LandingMenu,
  LegalPage
} from "./VervusPublicPages.jsx";
import {
  DEFAULT_LOBBY_CONTENT
} from "../storyblok/lobbyContent.js";

const ROOM_CODE_MAX_LENGTH = 6;
const MIN_SCANNABLE_ROOM_CODE_LENGTH = 4;
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

const getRoomCodeNoticeConfig = (t) => ({
  not_found: {
    title: t("lobby.roomCodeNotice.notFound.title"),
    body: t("lobby.roomCodeNotice.notFound.body"),
    icon: warningIcon,
    variant: "warning"
  },
  full: {
    title: t("lobby.roomCodeNotice.full.title"),
    body: t("lobby.roomCodeNotice.full.body"),
    icon: warningIcon,
    variant: "warning"
  },
  expired: {
    title: t("lobby.roomCodeNotice.expired.title"),
    body: t("lobby.roomCodeNotice.expired.body"),
    icon: timerIcon,
    variant: "expired"
  }
});

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

function getErrorKind(error) {
  if (!error) return "";
  if (typeof error.getKind === "function") return error.getKind();
  return error.kind || error.name || error.constructor?.kind || error.constructor?.name || "";
}

function isExpectedScanMiss(error) {
  const errorKind = getErrorKind(error);
  return errorKind === "NotFoundException"
    || errorKind === "ChecksumException"
    || errorKind === "FormatException";
}

function getCameraErrorMessage(t, error) {
  const errorName = getErrorKind(error);

  if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
    return t("lobby.qrScanner.errors.permissionBlocked");
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return t("lobby.qrScanner.errors.noCamera");
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return t("lobby.qrScanner.errors.cameraInUse");
  }

  if (errorName === "OverconstrainedError" || errorName === "ConstraintNotSatisfiedError") {
    return t("lobby.qrScanner.errors.unsupportedSettings");
  }

  if (errorName === "SecurityError") {
    return t("lobby.qrScanner.errors.browserBlocked");
  }

  return t("lobby.qrScanner.errors.generic");
}

function formatRoomPreviewNames(t, playerNames = []) {
  const names = playerNames
    .map((playerName) => String(playerName || "").trim())
    .filter(Boolean)
    .map((playerName) => playerName.toUpperCase());

  if (names.length === 0) return "";
  if (names.length === 1) return t("lobby.preview.players.one", { first: names[0] });
  if (names.length === 2) return t("lobby.preview.players.two", { first: names[0], second: names[1] });

  return t("lobby.preview.players.many", { first: names[0], second: names[1], count: names.length - 2 });
}

function getRoomPreviewModeTitle(roomPreview) {
  const modeTitle = String(roomPreview?.selectedModeTitle || "GLiTCH!").trim();
  if (roomPreview?.selectedModeId === "standard" && !/standard/i.test(modeTitle)) {
    return `${modeTitle} Standard`;
  }

  return modeTitle;
}

function getRoomPreviewStatusLabel(t, roomPreview) {
  if (roomPreview?.joinable) return t("lobby.preview.status.active");
  if (roomPreview?.isFull) return t("lobby.preview.status.full");
  return t("lobby.preview.status.closed");
}

function RoomCodeNotice({ notice }) {
  const { t } = useTranslation();
  const config = getRoomCodeNoticeConfig(t)[notice?.type];
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

function isDesktopLayout() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function DesktopPhoneNotice({ onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="desktop-phone-notice-backdrop" role="presentation">
      <section
        className="desktop-phone-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-phone-notice-title"
        aria-describedby="desktop-phone-notice-description"
      >
        <button className="desktop-phone-notice-close" type="button" aria-label={t("common.close")} onClick={onClose}>
          <span aria-hidden="true" />
        </button>
        <span className="desktop-phone-notice-icon" aria-hidden="true">
          <img src={phoneIcon} alt="" />
        </span>
        <h2 id="desktop-phone-notice-title">{t("lobby.desktopPhone.title")}</h2>
        <p id="desktop-phone-notice-description">
          {t("lobby.desktopPhone.description")}
        </p>
        <p>{t("lobby.desktopPhone.secondaryDescription")}</p>
        <button className="desktop-phone-notice-action" type="button" onClick={onClose}>
          {t("lobby.desktopPhone.action")}
        </button>
      </section>
    </div>
  );
}

function QrScannerOverlay({
  title,
  description,
  cancelLabel,
  onCancel,
  onDetected
}) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  const onDetectedRef = useRef(onDetected);
  const hasDetectedRef = useRef(false);
  const hasStartedCameraRef = useRef(false);
  const resolvedTitle = title || t("lobby.qrScanner.title");
  const resolvedDescription = description || t("lobby.qrScanner.description");
  const resolvedCancelLabel = cancelLabel || t("common.cancel");
  const [scannerMessage, setScannerMessage] = useState(() => t("lobby.qrScanner.messages.startingCamera"));
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
        setScannerMessage(t("lobby.qrScanner.errors.browserUnsupported"));
        setScannerMessageType("error");
        return;
      }

      const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
      if (!window.isSecureContext && !isLocalHost) {
        setScannerMessage(t("lobby.qrScanner.errors.httpsRequired"));
        setScannerMessageType("error");
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (!isActive) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        hasStartedCameraRef.current = true;
        setScannerMessage(t("lobby.qrScanner.messages.pointCamera"));
        setScannerMessageType("info");

        const codeReader = new BrowserQRCodeReader();
        const controls = await codeReader.decodeFromStream(
          mediaStream,
          videoRef.current,
          (result, error, scannerControls) => {
            controlsRef.current = scannerControls;
            if (!isActive || hasDetectedRef.current) return;

            if (result) {
              const rawScanValue = result.getText();
              const roomCode = extractRoomCodeFromQrValue(rawScanValue);
              if (!roomCode) {
                setScannerMessage(t("lobby.qrScanner.errors.invalidInvite"));
                setScannerMessageType("error");
                return;
              }

              hasDetectedRef.current = true;
              scannerControls.stop();
              onDetectedRef.current?.(roomCode, rawScanValue);
              return;
            }

            if (error && !isExpectedScanMiss(error) && !hasStartedCameraRef.current) {
              setScannerMessage(getCameraErrorMessage(t, error));
              setScannerMessageType("error");
            }
          }
        );

        controlsRef.current = controls;
        if (!isActive || hasDetectedRef.current) {
          controls.stop();
          return;
        }

      } catch (error) {
        if (!isActive) return;
        setScannerMessage(getCameraErrorMessage(t, error));
        setScannerMessageType("error");
      }
    };

    startScanner();

    return () => {
      isActive = false;
      stopPreviewStream();
    };
  }, [t]);

  return (
    <div className="qr-scanner-overlay" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title">
      <div className="qr-scanner-shell">
        <div className="qr-scanner-content">
          <div className="qr-scanner-camera-mark" aria-hidden="true">
            <span />
          </div>
          <div className="qr-scanner-copy">
            <h2 id="qr-scanner-title">{resolvedTitle}</h2>
            <p>{resolvedDescription}</p>
          </div>
          <div className="qr-scanner-frame" aria-label={t("lobby.qrScanner.cameraPreviewLabel")}>
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
          {resolvedCancelLabel}
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
  const { t } = useTranslation();
  const [lobbyStep, setLobbyStep] = useState(() => (roomIdInput ? "play" : "landing"));
  const [publicPage, setPublicPage] = useState("landing");
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isDesktopPhoneNoticeOpen, setIsDesktopPhoneNoticeOpen] = useState(false);
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
    if (nextStep === "play" && isDesktopLayout()) {
      setIsDesktopPhoneNoticeOpen(true);
      return;
    }

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
            {t("lobby.preview.roomFound")}
            {formatRoomPreviewNames(t, roomPreview.playerNames) ? (
              <> &mdash; {formatRoomPreviewNames(t, roomPreview.playerNames)}</>
            ) : null}
          </strong>
          <p>
            {formatRoomCode(roomPreview.roomId)}
            {" "}&middot;{" "}
            {getRoomPreviewModeTitle(roomPreview)}
            {" "}&middot;{" "}
            {getRoomPreviewStatusLabel(t, roomPreview)}
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

    if (publicPage === "language") {
      return <LanguagePage onBack={handleBackToMenu} />;
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
        {isDesktopPhoneNoticeOpen ? (
          <DesktopPhoneNotice onClose={() => setIsDesktopPhoneNoticeOpen(false)} />
        ) : null}
      </>
    );
  };

  const shouldShowLegacyBrand = publicPage === "landing" && (lobbyStep === "host" || lobbyStep === "play");

  return (
    <section className="lobby-start-page" aria-label={t("lobby.ariaLabel")}>
      {shouldShowLegacyBrand ? (
        <div className="lobby-brand" aria-label={t("app.name")}>
          <img src={clearBackgroundLogo} alt={t("app.name")} />
        </div>
      ) : null}

      {renderLobbySteps(lobbyContent)}
    </section>
  );
}

export default LobbyPage;
