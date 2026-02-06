"use client";

import { useRouter } from "next/navigation";

interface Party {
  id: string;
  shortName: string;
  mentionCount: number;
}

interface PartyFilterSelectProps {
  parties: Party[];
  currentPartyId?: string;
  baseUrl: string;
}

export function PartyFilterSelect({
  parties,
  currentPartyId,
  baseUrl,
}: PartyFilterSelectProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const url = new URL(baseUrl, window.location.origin);

    if (value) {
      url.searchParams.set("party", value);
    } else {
      url.searchParams.delete("party");
    }

    // Remove page param when filter changes
    url.searchParams.delete("page");

    router.push(url.pathname + url.search);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="party-select" className="text-sm text-muted-foreground">
        Parti:
      </label>
      <select
        id="party-select"
        value={currentPartyId || ""}
        onChange={handleChange}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:border-primary/50 transition-colors"
      >
        <option value="">Tous les partis</option>
        {parties.map((party) => (
          <option key={party.id} value={party.id}>
            {party.shortName} ({party.mentionCount})
          </option>
        ))}
      </select>
    </div>
  );
}
