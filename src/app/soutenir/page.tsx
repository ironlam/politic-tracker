import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Soutenez Poligraph",
  description:
    "Aidez-nous à maintenir et développer cette plateforme citoyenne d'information politique",
};

const EXPENSES = [
  {
    label: "Hébergement (Vercel Pro)",
    amount: "20€/mois",
    description: "Serveurs, CDN, certificats SSL",
  },
  {
    label: "APIs IA (Anthropic, OpenAI)",
    amount: "50€/mois",
    description: "Résumés automatiques, chatbot, embeddings",
  },
  {
    label: "Base de données (Supabase)",
    amount: "25€/mois",
    description: "PostgreSQL, stockage, backups",
  },
  {
    label: "Domaine et services",
    amount: "10€/mois",
    description: "Nom de domaine, emails, monitoring",
  },
];

const FEATURES_FUNDED = [
  "Mise à jour quotidienne des données parlementaires",
  "Résumés IA des dossiers législatifs",
  "Chatbot citoyen pour poser des questions",
  "Alertes sur les nouvelles affaires judiciaires",
  "API ouverte pour les journalistes et chercheurs",
  "Zéro publicité, zéro tracking",
];

const DONATION_PLATFORMS = [
  {
    name: "Tipeee",
    url: "https://fr.tipeee.com/transparence-politique",
    description: "Soutien récurrent ou ponctuel",
    primary: true,
  },
];

export default function SoutenirPage() {
  const totalMonthly = EXPENSES.reduce((sum, exp) => {
    const amount = parseInt(exp.amount.replace(/[^0-9]/g, ""));
    return sum + amount;
  }, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Soutenez Poligraph</h1>
        <p className="text-lg text-muted-foreground">
          Un projet citoyen indépendant qui a besoin de votre soutien pour continuer à informer sur
          la vie politique française.
        </p>
      </div>

      {/* CTA Principal */}
      <Card className="mb-12 border-primary/30 bg-primary/5">
        <CardContent className="pt-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Faites un don</h2>
          <p className="text-muted-foreground mb-6">
            Chaque contribution, même modeste, nous aide à maintenir ce service gratuit et sans
            publicité.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {DONATION_PLATFORMS.map((platform) => (
              <Button
                key={platform.name}
                asChild
                size="lg"
                variant={platform.primary ? "default" : "outline"}
                className="text-base"
              >
                <a href={platform.url} target="_blank" rel="noopener noreferrer">
                  Soutenir sur {platform.name}
                  <span className="sr-only"> (ouvre un nouvel onglet)</span>
                </a>
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">{DONATION_PLATFORMS[0].description}</p>
        </CardContent>
      </Card>

      {/* Pourquoi soutenir */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Pourquoi nous soutenir ?</h2>
        <Card>
          <CardContent className="pt-6 prose prose-sm max-w-none">
            <p className="text-base leading-relaxed">
              <strong>Poligraph</strong> est un projet 100% indépendant. Nous ne recevons aucune
              subvention publique, aucun financement partisan, et nous refusons la publicité pour
              garantir notre neutralité.
            </p>
            <p className="text-base leading-relaxed mt-4">
              Notre mission : rendre accessible à tous les citoyens l&apos;information sur leurs
              représentants politiques. Votes, mandats, déclarations de patrimoine, affaires
              judiciaires... Tout est sourcé et vérifiable.
            </p>
            <p className="text-base leading-relaxed mt-4">
              Vos dons nous permettent de couvrir les frais techniques et de développer de nouvelles
              fonctionnalités pour mieux vous informer.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Ce que vous financez */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Ce que vous financez</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES_FUNDED.map((feature, index) => (
            <div key={index} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <span className="text-green-600 mt-0.5">&#10003;</span>
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Transparence des coûts */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Transparence des coûts</h2>
        <p className="text-muted-foreground mb-6">
          Voici le détail de nos dépenses mensuelles. Nous nous engageons à une gestion transparente
          de vos contributions.
        </p>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {EXPENSES.map((expense) => (
                <div
                  key={expense.label}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{expense.label}</p>
                    <p className="text-sm text-muted-foreground">{expense.description}</p>
                  </div>
                  <span className="font-mono text-sm shrink-0 ml-4">{expense.amount}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t flex items-center justify-between">
              <span className="font-bold">Total mensuel estimé</span>
              <span className="font-mono font-bold">{totalMonthly}€/mois</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Autres moyens d'aider */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Autres moyens d&apos;aider</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Partagez le projet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Parlez de Poligraph autour de vous, sur les réseaux sociaux, à vos proches. Plus
                nous sommes nombreux, plus notre voix porte.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Contribuez au code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Le projet est open source. Développeurs, data scientists, designers : vos
                contributions sont les bienvenues sur{" "}
                <a
                  href="https://github.com/ironlam/poligraph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  GitHub
                  <span className="sr-only"> (ouvre un nouvel onglet)</span>
                </a>
                .
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Signalez des erreurs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Vous avez repéré une erreur, une donnée obsolète ? Contactez-nous via les{" "}
                <Link href="/mentions-legales" className="text-primary hover:underline">
                  mentions légales
                </Link>
                . Chaque correction améliore le projet.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Utilisez l&apos;API</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Journalistes, chercheurs, développeurs : notre{" "}
                <Link href="/docs/api" className="text-primary hover:underline">
                  API ouverte
                </Link>{" "}
                vous donne accès à toutes nos données. Créez vos propres analyses !
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Merci */}
      <section>
        <Card className="bg-muted">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-2">Merci !</h2>
            <p className="text-muted-foreground">
              Que vous choisissiez de nous soutenir financièrement ou autrement, merci de croire en
              ce projet citoyen. Ensemble, rendons la politique plus transparente.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
