// src/config/sync-criticality.ts

export const CRITICAL_SCRIPTS = [
  "sync-assemblee",
  "sync-senat",
  "sync-gouvernement",
  "sync-votes-an",
  "sync-press-analysis",
  "sync-judilibre",
] as const;

export type CriticalScript = (typeof CRITICAL_SCRIPTS)[number];

export function isCriticalScript(script: string): boolean {
  return (CRITICAL_SCRIPTS as readonly string[]).includes(script);
}
