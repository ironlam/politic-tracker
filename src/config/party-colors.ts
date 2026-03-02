// Predefined party colors for common French political nuance labels
// Shared between server (carte page) and client (PartyMap component)

export const PARTY_COLORS: Record<string, string> = {
  // Gauche
  LFI: "#BB1840",
  NFP: "#CC2443",
  PCF: "#C53030",
  PS: "#E8555E",
  EELV: "#48BB78",
  DVG: "#FC8181",
  LO: "#8B0000",
  // Centre
  RE: "#FFD966",
  MoDem: "#F6AD55",
  UDI: "#63B3ED",
  UC: "#FFA500",
  DVC: "#FFD9A0",
  // Droite
  LR: "#2B6CB0",
  DVD: "#BEE3F8",
  RN: "#1A365D",
  REC: "#0D1B2A",
  // Codes nuance non mappés
  LUXD: "#4A0E0E",
  LEXD: "#2D0A0A",
  LREG: "#6B8E6B",
  LUDR: "#1E3A5F",
  LHOR: "#90CDF4",
  LREN: "#FFD966",
  LDSV: "#D4C5A9",
  LMDM: "#F6AD55",
  // Divers
  DIV: "#CBD5E0",
  SE: "#A0AEC0",
  PRG: "#E89090",
  HOR: "#90CDF4",
};

export const NO_DATA_COLOR = "#e5e7eb";

/** Generate a consistent color for unknown party labels via simple hash */
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 50%)`;
}

export function getPartyColor(label: string | null): string {
  if (!label) return NO_DATA_COLOR;
  return PARTY_COLORS[label] ?? hashColor(label);
}
