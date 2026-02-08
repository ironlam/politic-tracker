"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Vote, FileText, Newspaper, ChevronRight } from "lucide-react";

interface VoteItem {
  id: string;
  slug: string | null;
  title: string;
  date: Date;
  result: string;
  chamber: string;
}

interface DossierItem {
  id: string;
  slug: string | null;
  title: string;
  shortTitle: string | null;
  status: string;
  filingDate: Date | null;
}

interface ArticleItem {
  id: string;
  title: string;
  source: string;
  publishedAt: Date;
  url: string;
}

interface ActivityTabsProps {
  votes: VoteItem[];
  dossiers: DossierItem[];
  articles: ArticleItem[];
}

type TabType = "votes" | "dossiers" | "presse";

export function ActivityTabs({ votes, dossiers, articles }: ActivityTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("votes");

  const tabs: { id: TabType; label: string; icon: typeof Vote; count: number }[] = [
    { id: "votes", label: "Votes", icon: Vote, count: votes.length },
    { id: "dossiers", label: "Dossiers", icon: FileText, count: dossiers.length },
    { id: "presse", label: "Presse", icon: Newspaper, count: articles.length },
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Dernières activités</h2>
            <p className="text-muted-foreground">Actualités parlementaires et médiatiques</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count > 0 && (
                  <span className="text-xs text-muted-foreground">({tab.count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="bg-card border rounded-xl overflow-hidden">
          {activeTab === "votes" && <VotesContent votes={votes} />}
          {activeTab === "dossiers" && <DossiersContent dossiers={dossiers} />}
          {activeTab === "presse" && <PresseContent articles={articles} />}
        </div>
      </div>
    </section>
  );
}

function VotesContent({ votes }: { votes: VoteItem[] }) {
  if (votes.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Aucun vote récent</div>;
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {votes.map((vote) => (
          <li key={vote.id}>
            <Link
              href={`/votes/${vote.slug || vote.id}`}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-medium truncate group-hover:text-primary transition-colors">
                  {vote.title}
                </p>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{formatDate(vote.date)}</span>
                  <span>•</span>
                  <span>{vote.chamber === "AN" ? "Assemblée" : "Sénat"}</span>
                </div>
              </div>
              <Badge
                variant={
                  vote.result === "ADOPTE"
                    ? "default"
                    : vote.result === "REJETE"
                      ? "destructive"
                      : "secondary"
                }
                className={
                  vote.result === "ADOPTE"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                    : ""
                }
              >
                {vote.result === "ADOPTE"
                  ? "Adopté"
                  : vote.result === "REJETE"
                    ? "Rejeté"
                    : vote.result}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
      <div className="p-4 border-t bg-muted/30">
        <Button variant="ghost" asChild className="w-full sm:w-auto">
          <Link href="/votes" className="flex items-center gap-2">
            Voir tous les votes
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </>
  );
}

function DossiersContent({ dossiers }: { dossiers: DossierItem[] }) {
  if (dossiers.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Aucun dossier en cours</div>;
  }

  const statusLabels: Record<string, string> = {
    EN_COURS: "En cours",
    ADOPTE: "Adopté",
    REJETE: "Rejeté",
    RETIRE: "Retiré",
  };

  return (
    <>
      <ul className="divide-y divide-border">
        {dossiers.map((dossier) => (
          <li key={dossier.id}>
            <Link
              href={`/assemblee/${dossier.slug || dossier.id}`}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-medium truncate group-hover:text-primary transition-colors">
                  {dossier.shortTitle || dossier.title}
                </p>
                {dossier.filingDate && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Déposé le {formatDate(dossier.filingDate)}
                  </p>
                )}
              </div>
              <Badge variant={dossier.status === "EN_COURS" ? "default" : "secondary"}>
                {statusLabels[dossier.status] || dossier.status}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
      <div className="p-4 border-t bg-muted/30">
        <Button variant="ghost" asChild className="w-full sm:w-auto">
          <Link href="/assemblee" className="flex items-center gap-2">
            Voir tous les dossiers
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </>
  );
}

function PresseContent({ articles }: { articles: ArticleItem[] }) {
  if (articles.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Aucun article récent</div>;
  }

  const sourceLabels: Record<string, string> = {
    LEMONDE: "Le Monde",
    POLITICO: "Politico",
    MEDIAPART: "Mediapart",
  };

  return (
    <>
      <ul className="divide-y divide-border">
        {articles.map((article) => (
          <li key={article.id}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-medium truncate group-hover:text-primary transition-colors">
                  {article.title}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDate(article.publishedAt)}
                </p>
              </div>
              <Badge variant="outline">{sourceLabels[article.source] || article.source}</Badge>
            </a>
          </li>
        ))}
      </ul>
      <div className="p-4 border-t bg-muted/30">
        <Button variant="ghost" asChild className="w-full sm:w-auto">
          <Link href="/presse" className="flex items-center gap-2">
            Voir tous les articles
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </>
  );
}
