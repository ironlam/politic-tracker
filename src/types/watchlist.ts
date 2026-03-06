export type WatchlistItemType = "politician" | "party";

export interface WatchlistItem {
  type: WatchlistItemType;
  slug: string;
}
