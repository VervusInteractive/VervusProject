import playerCyanIcon from "./assets/images/VervusIcons/Icon_PlayerCyan.png";
import playerIndigoIcon from "./assets/images/VervusIcons/Icon_PlayerIndigo.png";
import playerLimeIcon from "./assets/images/VervusIcons/Icon_PlayerLime.png";
import playerPurpleIcon from "./assets/images/VervusIcons/Icon_PlayerPurple.png";

export const PLAYER_COLORS = Object.freeze([
  "#8d5cff",
  "#22d3ee",
  "#6366f1",
  "#84cc16"
]);

const PLAYER_ICON_BY_COLOR = Object.freeze({
  [PLAYER_COLORS[0]]: playerPurpleIcon,
  [PLAYER_COLORS[1]]: playerCyanIcon,
  [PLAYER_COLORS[2]]: playerIndigoIcon,
  [PLAYER_COLORS[3]]: playerLimeIcon,
  "#ef4444": playerPurpleIcon,
  "#3b82f6": playerCyanIcon,
  "#22c55e": playerIndigoIcon,
  "#eab308": playerLimeIcon
});

export function getPlayerIcon(color) {
  return PLAYER_ICON_BY_COLOR[String(color || "").toLowerCase()] || playerPurpleIcon;
}
