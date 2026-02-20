import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { MessageSquare, ShieldCheck, Database, Sparkles } from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "Assistant IA - Poligraph",
  description:
    "Posez vos questions sur les représentants politiques français, les votes parlementaires et les dossiers législatifs. Réponses basées sur des sources officielles.",
  openGraph: {
    title: "Assistant IA - Poligraph",
    description: "Posez vos questions sur la politique française. Réponses sourcées et factuelles.",
  },
};

export default async function ChatPage() {
  if (!(await isFeatureEnabled("CHATBOT_ENABLED"))) notFound();
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          Bêta
        </div>
        <h1 className="text-3xl font-bold mb-3">Assistant Poligraph</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Posez vos questions sur les représentants politiques français, leurs mandats, les votes
          parlementaires ou les dossiers législatifs en cours.
        </p>
      </div>

      {/* Features badges */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="w-4 h-4 text-primary" />
          <span>Données officielles</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-green-600" />
          <span>Sources vérifiées</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span>Réponses factuelles</span>
        </div>
      </div>

      {/* Chat interface */}
      <Card className="shadow-lg">
        <CardHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">Chat avec l&apos;assistant</h2>
              <p className="text-sm text-muted-foreground">
                Alimenté par notre IA et base de données
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ChatInterface />
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-medium mb-2 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Nos engagements
        </h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>
            • Les réponses sont basées uniquement sur notre base de données de sources officielles
          </li>
          <li>
            • Toute affaire judiciaire est accompagnée d&apos;un rappel de la présomption
            d&apos;innocence
          </li>
          <li>
            • L&apos;assistant refuse de répondre s&apos;il n&apos;a pas l&apos;information dans sa
            base
          </li>
          <li>• Aucune opinion politique n&apos;est exprimée, uniquement des faits</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          <a href="/sources" className="underline hover:text-foreground">
            En savoir plus sur nos sources et notre méthodologie
          </a>
        </p>
      </div>
    </div>
  );
}
