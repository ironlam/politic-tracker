"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ReactNode } from "react";

interface StatsTabsProps {
  judicialContent: ReactNode;
  factCheckContent: ReactNode;
  legislativeContent: ReactNode;
}

export function StatsTabs({
  judicialContent,
  factCheckContent,
  legislativeContent,
}: StatsTabsProps) {
  return (
    <Tabs defaultValue="judicial">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="judicial">Judiciaire</TabsTrigger>
        <TabsTrigger value="factcheck">Fact-checking</TabsTrigger>
        <TabsTrigger value="legislative">Législatif</TabsTrigger>
      </TabsList>
      <TabsContent value="judicial">{judicialContent}</TabsContent>
      <TabsContent value="factcheck">{factCheckContent}</TabsContent>
      <TabsContent value="legislative">{legislativeContent}</TabsContent>
    </Tabs>
  );
}
