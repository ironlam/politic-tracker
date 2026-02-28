/**
 * Shared utilities for OpenGraph images (opengraph-image.tsx).
 *
 * Provides consistent branding across all OG thumbnails:
 * - Tricolor band (bleu/blanc/rouge)
 * - Owl watermark
 * - Footer with owl icon
 */

// Owl SVG as base64 data URI (from public/logo.svg)
const OWL_BASE64 =
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCI+CiAgPCEtLSBCb2R5IC0tPgogIDxlbGxpcHNlIGN4PSIxMDAiIGN5PSIxMTUiIHJ4PSI2MiIgcnk9IjY4IiBmaWxsPSIjMDAyNjU0Ii8+CiAgPCEtLSBCZWxseSAtLT4KICA8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTM1IiByeD0iNDAiIHJ5PSI0MCIgZmlsbD0iI0ZGRkZGRiIvPgogIDwhLS0gQmVsbHkgZmVhdGhlciBtYXJrcyAtLT4KICA8cGF0aCBkPSJNODggMTI1YzQgMyA4IDMgMTIgME05NSAxMzNjNCAzIDggMyAxMiAwTTg4IDE0MWM0IDMgOCAzIDEyIDAiIHN0cm9rZT0iI0QwRDhFOCIgc3Ryb2tlLXdpZHRoPSIxLjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDwhLS0gTGVmdCB3aW5nIC0tPgogIDxwYXRoIGQ9Ik0zOCAxMDVjLTggMTUtMTAgNDAgMCA1NWM1LTE1IDEwLTM1IDAtNTV6IiBmaWxsPSIjMDAxRjNGIi8+CiAgPCEtLSBSaWdodCB3aW5nIC0tPgogIDxwYXRoIGQ9Ik0xNjIgMTA1YzggMTUgMTAgNDAgMCA1NWMtNS0xNS0xMC0zNSAwLTU1eiIgZmlsbD0iIzAwMUYzRiIvPgogIDwhLS0gSGVhZCAtLT4KICA8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iNzUiIHJ4PSI1MiIgcnk9IjQwIiBmaWxsPSIjMDAyNjU0Ii8+CiAgPCEtLSBMZWZ0IGVhciB0dWZ0IC0tPgogIDxwYXRoIGQ9Ik01NSA1MmwtMTItMjVjOCAyIDE4IDEwIDIyIDIweiIgZmlsbD0iIzAwMjY1NCIvPgogIDwhLS0gUmlnaHQgZWFyIHR1ZnQgLS0+CiAgPHBhdGggZD0iTTE0NSA1MmwxMi0yNWMtOCAyLTE4IDEwLTIyIDIweiIgZmlsbD0iIzAwMjY1NCIvPgogIDwhLS0gTGVmdCBleWUgd2hpdGUgLS0+CiAgPGNpcmNsZSBjeD0iNzgiIGN5PSI3NSIgcj0iMTYiIGZpbGw9IndoaXRlIi8+CiAgPCEtLSBSaWdodCBleWUgd2hpdGUgLS0+CiAgPGNpcmNsZSBjeD0iMTIyIiBjeT0iNzUiIHI9IjE2IiBmaWxsPSJ3aGl0ZSIvPgogIDwhLS0gTGVmdCBpcmlzIC0tPgogIDxjaXJjbGUgY3g9IjgwIiBjeT0iNzUiIHI9IjEwIiBmaWxsPSIjNEE5RkQ5Ii8+CiAgPCEtLSBSaWdodCBpcmlzIC0tPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9Ijc1IiByPSIxMCIgZmlsbD0iIzRBOUZEOSIvPgogIDwhLS0gTGVmdCBwdXBpbCAtLT4KICA8Y2lyY2xlIGN4PSI4MiIgY3k9Ijc0IiByPSI1IiBmaWxsPSIjMDAxODMzIi8+CiAgPCEtLSBSaWdodCBwdXBpbCAtLT4KICA8Y2lyY2xlIGN4PSIxMTgiIGN5PSI3NCIgcj0iNSIgZmlsbD0iIzAwMTgzMyIvPgogIDwhLS0gRXllIHNoaW5lIGxlZnQgLS0+CiAgPGNpcmNsZSBjeD0iODQiIGN5PSI3MiIgcj0iMiIgZmlsbD0id2hpdGUiLz4KICA8IS0tIEV5ZSBzaGluZSByaWdodCAtLT4KICA8Y2lyY2xlIGN4PSIxMjAiIGN5PSI3MiIgcj0iMiIgZmlsbD0id2hpdGUiLz4KICA8IS0tIEJlYWsgLS0+CiAgPHBhdGggZD0iTTk2IDg1bDQgMTBsNC0xMHoiIGZpbGw9IiNDMTM2MkIiLz4KICA8IS0tIEZvcmVoZWFkIFYgLS0+CiAgPHBhdGggZD0iTTgwIDU4bDIwIDEybDIwLTEyIiBzdHJva2U9IiNDMTM2MkIiIHN0cm9rZS13aWR0aD0iMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CiAgPCEtLSBGZWV0IC0tPgogIDxwYXRoIGQ9Ik04MiAxODBjLTMgMy04IDMtMTIgME04OCAxODBjLTMgMy04IDMtMTIgMCIgc3Ryb2tlPSIjMDAyNjU0IiBzdHJva2Utd2lkdGg9IjIuNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTExOCAxODBjMyAzIDggMyAxMiAwTTEyNCAxODBjLTMgMy04IDMtMTIgMCIgc3Ryb2tlPSIjMDAyNjU0IiBzdHJva2Utd2lkdGg9IjIuNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPCEtLSBCcmFuY2ggLS0+CiAgPHBhdGggZD0iTTMwIDE4MmgxNDAiIHN0cm9rZT0iIzVENEUzNyIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+Cg==";

export const OWL_DATA_URI = `data:image/svg+xml;base64,${OWL_BASE64}`;

// Tricolor band colors (from the owl SVG)
const BLEU = "#002654";
const ROUGE = "#C1362B";

// Common OG image dimensions
export const OG_SIZE = { width: 1200, height: 630 };

// Background gradient used across all OG images
export const OG_BACKGROUND = "linear-gradient(135deg, #1e3a5f 0%, #0f1f3a 100%)";

/**
 * Wraps OG image content with the standard Poligraph branding:
 * - Tricolor band at the top
 * - Owl watermark in the bottom-right
 * - Footer with owl + "poligraph.fr"
 */
export function OgLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: OG_BACKGROUND,
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Tricolor band */}
      <div style={{ display: "flex", width: "100%", height: 6, flexShrink: 0 }}>
        <div style={{ flex: 1, background: BLEU }} />
        <div style={{ flex: 1, background: "#FFFFFF" }} />
        <div style={{ flex: 1, background: ROUGE }} />
      </div>

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "40px 60px 24px",
        }}
      >
        {children}
      </div>

      {/* Owl watermark — bottom right */}
      <img
        src={OWL_DATA_URI}
        width={180}
        height={180}
        style={{
          position: "absolute",
          bottom: -20,
          right: -10,
          opacity: 0.08,
        }}
      />

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 60px 20px",
        }}
      >
        <img src={OWL_DATA_URI} width={24} height={24} style={{ opacity: 0.5 }} />
        <span style={{ fontSize: 18, color: "#64748b" }}>poligraph.fr</span>
      </div>
    </div>
  );
}

/**
 * Category label (e.g. "FACT-CHECK", "VOTE", "AFFAIRE")
 */
export function OgCategoryLabel({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <span style={{ fontSize: 28 }}>{emoji}</span>
      <span
        style={{
          fontSize: 18,
          color: "#94a3b8",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 3,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Large colored badge (e.g. verdict, vote result, affair status)
 */
export function OgBadge({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 32px",
        borderRadius: 999,
        background: `${color}20`,
        border: `3px solid ${color}`,
        color: color,
        fontSize: 28,
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}

/**
 * Truncate text to a maximum number of characters
 */
export function truncateOg(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}
