/**
 * Photo source priority for politician profile photos.
 * Higher number = higher priority. When syncing from a source,
 * we only update the photo if the new source has >= priority than the current one.
 */
export const PHOTO_SOURCE_PRIORITY: Record<string, number> = {
  "assemblee-nationale": 10,
  senat: 10,
  gouvernement: 10,
  hatvp: 8,
  "parlement-europeen": 7,
  wikidata: 6,
  nosdeputes: 5,
  nossenateurs: 5,
  manual: 1,
};

/**
 * Determine if a photo should be updated based on source priority.
 * Returns true if the new source has equal or higher priority than the current one.
 */
export function shouldUpdatePhoto(
  currentSource: string | null | undefined,
  newSource: string
): boolean {
  const currentPriority = currentSource ? (PHOTO_SOURCE_PRIORITY[currentSource] ?? 0) : 0;
  const newPriority = PHOTO_SOURCE_PRIORITY[newSource] ?? 0;
  return newPriority >= currentPriority;
}
