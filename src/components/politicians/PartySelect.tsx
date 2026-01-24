"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Party {
  id: string;
  shortName: string;
  _count: {
    politicians: number;
  };
}

interface PartySelectProps {
  parties: Party[];
  currentValue: string;
}

export function PartySelect({ parties, currentValue }: PartySelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildUrl(partyId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("party", partyId);
    params.delete("page"); // Reset page when changing filter
    return `/politiques?${params.toString()}`;
  }

  return (
    <select
      className="text-xs border rounded px-2 py-1"
      value={currentValue}
      onChange={(e) => {
        if (e.target.value) {
          router.push(buildUrl(e.target.value));
        }
      }}
    >
      <option value="">+ autres...</option>
      {parties.map((party) => (
        <option key={party.id} value={party.id}>
          {party.shortName} ({party._count.politicians})
        </option>
      ))}
    </select>
  );
}
