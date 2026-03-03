export interface WatchlistPolitician {
  slug: string;
  fullName: string;
  photoUrl: string | null;
  party: string | null;
  partyColor: string | null;
}

export interface ActivityItem {
  type: "vote" | "press" | "affair";
  date: string;
  politician: WatchlistPolitician;
  data: Record<string, unknown>;
}

export interface ActivityResponse {
  activity: ActivityItem[];
  politicians: WatchlistPolitician[];
}
