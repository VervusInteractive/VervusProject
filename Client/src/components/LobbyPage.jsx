import { useState } from "react";
import clearBackgroundLogo from "../assets/images/Logos/Logo_ClearBackground.svg";

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

function LobbyPage({
  name,
  roomIdInput,
  onNameChange,
  onRoomIdInputChange,
  onCreateRoom,
  onJoinRoom,
  onUiButtonClick,
  actionsLocked = false
}) {
  const [lobbyStep, setLobbyStep] = useState(() => (roomIdInput ? "play" : "choice"));
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
    setLobbyStep(nextStep);
  };

  const handleOpenQrNotice = () => {
    onUiButtonClick?.();
    setIsQrNoticeOpen(true);
  };

  const renderChoiceStep = () => (
    <div className="lobby-start-form">
      <div className="lobby-heading-block">
        <p className="lobby-kicker">Vervus Interactive</p>
        <h1>Host or Play</h1>
        <p>Create a room for others, or join with a room code.</p>
      </div>

      <div className="lobby-actions">
        <button className="lobby-primary-action" type="button" onClick={() => handleSelectStep("host")}>
          Host
        </button>
        <button className="lobby-secondary-action" type="button" onClick={() => handleSelectStep("play")}>
          Play
        </button>
      </div>
    </div>
  );

  const renderHostStep = () => (
    <form className="lobby-start-form" onSubmit={handleHostSubmit}>
      <button className="lobby-back-button" type="button" onClick={() => handleSelectStep("choice")}>
        Back
      </button>

      <div className="lobby-heading-block">
        <p className="lobby-kicker">Host Room</p>
        <h1>What should we call you?</h1>
        <p>Enter a display name to create your room.</p>
      </div>

      <label className="lobby-field">
        <span>Display name</span>
        <input
          type="text"
          autoComplete="name"
          inputMode="text"
          placeholder="e.g. Alex"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>

      <div className="lobby-actions">
        <button className="lobby-primary-action" type="submit" disabled={!canHost}>
          Host room
        </button>
      </div>
    </form>
  );

  const renderPlayStep = () => (
    <form className="lobby-start-form" onSubmit={handleJoinSubmit}>
      <button className="lobby-back-button" type="button" onClick={() => handleSelectStep("choice")}>
        Back
      </button>

      <div className="lobby-heading-block">
        <p className="lobby-kicker">Join Room</p>
        <h1 id="join-room-title">Get in. We're waiting.</h1>
        <p>Join the room and start playing.<br />No download. No account.</p>
      </div>

      <label className="lobby-field">
        <span>Display name</span>
        <input
          type="text"
          autoComplete="name"
          inputMode="text"
          placeholder="e.g. Alex"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>

      <label className="lobby-field">
        <span>Room code</span>
        <input
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
          inputMode="text"
          maxLength={8}
          placeholder="XX-XX-XX"
          value={formattedRoomCode}
          onChange={handleRoomCodeChange}
        />
      </label>

      <div className="lobby-actions">
        <button className="lobby-primary-action" type="submit" disabled={!canJoin}>
          Join room
        </button>
        <button className="lobby-secondary-action" type="button" onClick={handleOpenQrNotice}>
          Scan QR code
        </button>
      </div>
    </form>
  );

  return (
    <section className="lobby-start-page" aria-label="Vervus lobby">
      <div className="lobby-brand" aria-label="Vervus">
        <img src={clearBackgroundLogo} alt="Vervus" />
      </div>

      {lobbyStep === "choice" ? renderChoiceStep() : null}
      {lobbyStep === "host" ? renderHostStep() : null}
      {lobbyStep === "play" ? renderPlayStep() : null}

      {isQrNoticeOpen ? (
        <div className="qr-modal-backdrop" onClick={() => setIsQrNoticeOpen(false)}>
          <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="qr-modal-title">Scan QR code</h2>
            <p className="panel-subtitle">QR scanning is not connected yet. Enter the room code to join for now.</p>
            <button
              type="button"
              className="btn btn-primary store-close-btn"
              onClick={() => {
                onUiButtonClick?.();
                setIsQrNoticeOpen(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default LobbyPage;
