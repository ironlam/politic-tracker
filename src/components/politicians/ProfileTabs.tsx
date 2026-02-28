"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ReactNode } from "react";
import { Suspense } from "react";

const VALID_TABS = ["profil", "carriere", "votes", "affaires"] as const;
type TabValue = (typeof VALID_TABS)[number];
const DEFAULT_TAB: TabValue = "profil";

interface ProfileTabsProps {
  profileContent: ReactNode;
  careerContent: ReactNode;
  votesContent: ReactNode | null;
  affairsContent: ReactNode;
}

function ProfileTabsInner({
  profileContent,
  careerContent,
  votesContent,
  affairsContent,
}: ProfileTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = searchParams.get("tab");
  const availableTabs: readonly TabValue[] = votesContent
    ? VALID_TABS
    : VALID_TABS.filter((t) => t !== "votes");
  const tab: TabValue = availableTabs.includes(rawTab as TabValue)
    ? (rawTab as TabValue)
    : DEFAULT_TAB;

  function onTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_TAB) {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value="profil">Profil</TabsTrigger>
        <TabsTrigger value="carriere">Carriere</TabsTrigger>
        {votesContent && <TabsTrigger value="votes">Votes</TabsTrigger>}
        <TabsTrigger value="affaires">Affaires</TabsTrigger>
      </TabsList>
      <TabsContent value="profil">{profileContent}</TabsContent>
      <TabsContent value="carriere">{careerContent}</TabsContent>
      {votesContent && <TabsContent value="votes">{votesContent}</TabsContent>}
      <TabsContent value="affaires">{affairsContent}</TabsContent>
    </Tabs>
  );
}

export function ProfileTabs(props: ProfileTabsProps) {
  return (
    <Suspense>
      <ProfileTabsInner {...props} />
    </Suspense>
  );
}
