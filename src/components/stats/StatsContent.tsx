"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatsTabs, type StatsTabType } from "./StatsTabs";
import { AffairsTab } from "./AffairsTab";
import { VotesTab } from "./VotesTab";
import { FactChecksTab } from "./FactChecksTab";
import { GeoTab } from "./GeoTab";
import type { VoteStatsResult } from "@/services/voteStats";

interface StatsContentProps {
  affairsData: {
    globalStats: Parameters<typeof AffairsTab>[0]["globalStats"];
    byStatus: Parameters<typeof AffairsTab>[0]["byStatus"];
    byCategory: Parameters<typeof AffairsTab>[0]["byCategory"];
    byParty: Parameters<typeof AffairsTab>[0]["byParty"];
    topPoliticians: Parameters<typeof AffairsTab>[0]["topPoliticians"];
  };
  votesData: {
    all: VoteStatsResult;
    an: VoteStatsResult;
    senat: VoteStatsResult;
  };
  factChecksData: Parameters<typeof FactChecksTab>[0];
  geoData: Parameters<typeof GeoTab>[0]["stats"];
}

export function StatsContent({
  affairsData,
  votesData,
  factChecksData,
  geoData,
}: StatsContentProps) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<StatsTabType>(
    (searchParams.get("tab") as StatsTabType) || "affaires"
  );

  return (
    <>
      <StatsTabs activeTab={tab} onTabChange={setTab} />

      {tab === "affaires" && (
        <AffairsTab
          globalStats={affairsData.globalStats}
          byStatus={affairsData.byStatus}
          byCategory={affairsData.byCategory}
          byParty={affairsData.byParty}
          topPoliticians={affairsData.topPoliticians}
        />
      )}

      {tab === "votes" && (
        <VotesTab allData={votesData.all} anData={votesData.an} senatData={votesData.senat} />
      )}

      {tab === "factchecks" && (
        <FactChecksTab
          total={factChecksData.total}
          groups={factChecksData.groups}
          byRating={factChecksData.byRating}
          bySource={factChecksData.bySource}
          topPoliticians={factChecksData.topPoliticians}
        />
      )}

      {tab === "geo" && <GeoTab stats={geoData} />}
    </>
  );
}
