import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Sources et Méthodologie",
  description: "Nos sources de données, notre méthodologie et notre engagement pour la transparence",
};

const DATA_SOURCES = [
  {
    name: "Assemblée nationale",
    shortName: "AN",
    description: "Liste officielle des 577 députés, mandats, groupes parlementaires",
    url: "https://data.gouv.fr",
    frequency: "Quotidienne",
    fields: ["Identité", "Parti", "Circonscription", "Date de mandat", "Photo"],
    color: "#0066CC",
  },
  {
    name: "Sénat",
    shortName: "Sénat",
    description: "Liste officielle des 348 sénateurs via l'API du Sénat",
    url: "https://data.senat.fr",
    frequency: "Hebdomadaire",
    fields: ["Identité", "Groupe", "Circonscription", "Photo"],
    color: "#8B0000",
  },
  {
    name: "Gouvernement",
    shortName: "Gouv",
    description: "Historique des gouvernements de la Ve République",
    url: "https://data.gouv.fr",
    frequency: "À chaque remaniement",
    fields: ["Ministres", "Fonctions", "Dates de mandat"],
    color: "#000091",
  },
  {
    name: "HATVP",
    shortName: "HATVP",
    description: "Déclarations de patrimoine et d'intérêts des élus",
    url: "https://www.hatvp.fr/open-data/",
    frequency: "Mensuelle",
    fields: ["Déclarations patrimoine", "Déclarations intérêts", "Photos officielles"],
    color: "#00A86B",
  },
  {
    name: "Wikidata",
    shortName: "WD",
    description: "Données biographiques et affaires judiciaires documentées",
    url: "https://www.wikidata.org",
    frequency: "Hebdomadaire",
    fields: ["Dates de naissance", "Condamnations", "Photos Wikipedia"],
    color: "#006699",
  },
  {
    name: "NosDéputés / NosSénateurs",
    shortName: "ND/NS",
    description: "Activité parlementaire, votes nominatifs et données complémentaires",
    url: "https://www.nosdeputes.fr",
    frequency: "Quotidienne",
    fields: ["Photos", "Activité", "Votes nominatifs", "Scrutins"],
    color: "#FF6600",
  },
  {
    name: "Parlement Européen",
    shortName: "PE",
    description: "Données sur les 81 eurodéputés français",
    url: "https://data.europarl.europa.eu",
    frequency: "Mensuelle",
    fields: ["Identité", "Groupe politique", "Commission", "Photo"],
    color: "#003399",
  },
];

const METHODOLOGY_POINTS = [
  {
    title: "Vérification des sources",
    description:
      "Chaque affaire judiciaire est documentée par au moins une source journalistique vérifiable. Nous privilégions les sources de presse nationale reconnue (Le Monde, Mediapart, AFP, etc.).",
  },
  {
    title: "Présomption d'innocence",
    description:
      "Toute personne mise en examen ou en cours de jugement est présumée innocente. Cette mention apparaît systématiquement sur les fiches concernées.",
  },
  {
    title: "Actualisation continue",
    description:
      "Les données sont mises à jour régulièrement via des scripts automatisés. Les affaires sont actualisées manuellement lors d'évolutions judiciaires significatives.",
  },
  {
    title: "Transparence totale",
    description:
      "Tout notre code source est disponible. Nous documentons nos sources et notre méthodologie. Les erreurs signalées sont corrigées rapidement.",
  },
];

const INCLUSION_CRITERIA = [
  {
    title: "Politiciens français uniquement",
    description:
      "Seuls les responsables politiques français sont référencés : élus nationaux, locaux, ministres et candidats aux élections majeures.",
    included: true,
  },
  {
    title: "Pertinence temporelle",
    description:
      "Les personnes décédées depuis plus de 10 ans ne sont pas incluses, sauf cas historiques exceptionnels liés à la Ve République.",
    included: true,
  },
  {
    title: "Mandat ou notoriété politique",
    description:
      "Les personnes référencées doivent avoir exercé un mandat politique OU être impliquées dans une affaire judiciaire en lien direct avec la politique française.",
    included: true,
  },
  {
    title: "Personnalités étrangères",
    description:
      "Les dirigeants étrangers, même impliqués dans des affaires avec la France, ne sont pas référencés.",
    included: false,
  },
  {
    title: "Figures historiques anciennes",
    description:
      "Les personnalités de l'Ancien Régime, des Républiques précédentes ou décédées avant 1958 sont exclues.",
    included: false,
  },
];

export default function SourcesPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-4">Sources et Méthodologie</h1>
        <p className="text-lg text-muted-foreground">
          Notre engagement : des données vérifiables, une méthodologie transparente,
          et le respect de la présomption d&apos;innocence.
        </p>
      </div>

      {/* Manifesto */}
      <Card className="mb-12 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl">Notre Manifeste</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p className="text-base leading-relaxed">
            <strong>Transparence Politique</strong> est un projet citoyen indépendant
            dont l&apos;objectif est de rendre accessible et compréhensible l&apos;information
            sur nos représentants politiques.
          </p>
          <p className="text-base leading-relaxed mt-4">
            Nous croyons que l&apos;accès à l&apos;information est un pilier de la démocratie.
            Les citoyens ont le droit de connaître le parcours, les mandats et les
            éventuelles affaires judiciaires de leurs élus.
          </p>
          <p className="text-base leading-relaxed mt-4">
            Ce projet ne poursuit aucun agenda politique. Nous appliquons les mêmes
            critères à tous les élus, indépendamment de leur appartenance partisane.
            Notre seul engagement est envers les faits documentés et vérifiables.
          </p>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Nos Sources de Données</h2>
        <div className="grid gap-4">
          {DATA_SOURCES.map((source) => (
            <Card key={source.shortName}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        style={{
                          backgroundColor: `${source.color}20`,
                          color: source.color,
                        }}
                      >
                        {source.shortName}
                      </Badge>
                      <h3 className="font-semibold">{source.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {source.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {source.fields.map((field) => (
                        <Badge key={field} variant="outline" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Mise à jour : {source.frequency}
                    </p>
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline shrink-0"
                  >
                    Source
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Notre Méthodologie</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {METHODOLOGY_POINTS.map((point) => (
            <Card key={point.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{point.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{point.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Inclusion Criteria */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Critères de Pertinence</h2>
        <p className="text-muted-foreground mb-6">
          Pour garantir la qualité et la pertinence des données, nous appliquons des critères
          stricts de sélection des personnes référencées.
        </p>
        <div className="grid gap-4">
          {INCLUSION_CRITERIA.map((criterion) => (
            <Card key={criterion.title} className={criterion.included ? "border-green-200 dark:border-green-900" : "border-red-200 dark:border-red-900"}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <span className={`text-lg ${criterion.included ? "text-green-600" : "text-red-600"}`}>
                    {criterion.included ? "✓" : "✗"}
                  </span>
                  <div>
                    <h3 className="font-semibold mb-1">
                      {criterion.included ? "Inclus" : "Exclus"} : {criterion.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{criterion.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Legal Notice */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Cadre Légal</h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Présomption d&apos;innocence</h3>
              <p className="text-sm text-muted-foreground">
                Conformément à l&apos;article 9-1 du Code civil, toute personne a droit
                au respect de la présomption d&apos;innocence. Les affaires en cours
                ne préjugent en rien de la culpabilité des personnes concernées.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Droit de réponse</h3>
              <p className="text-sm text-muted-foreground">
                Toute personne citée dispose d&apos;un droit de réponse. Les demandes
                de correction ou de mise à jour peuvent être adressées via notre
                formulaire de contact.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Données personnelles</h3>
              <p className="text-sm text-muted-foreground">
                Les données publiées sont issues de sources publiques officielles.
                Conformément au RGPD, les personnes concernées peuvent exercer
                leurs droits d&apos;accès, de rectification et d&apos;opposition.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Fonctionnalités */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Fonctionnalités</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Votes parlementaires</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Consultez les votes nominatifs de chaque député sur les scrutins publics.
                Importés depuis NosDéputés.fr pour la 16e législature.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Graphe de relations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Visualisez les connexions entre politiciens : même parti, même gouvernement,
                même législature, même département.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">API publique</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Accédez à nos données via une API REST documentée avec OpenAPI/Swagger.
                <Link href="/docs/api" className="text-blue-600 hover:underline ml-1">
                  Voir la documentation
                </Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Déclarations HATVP</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Liens directs vers les déclarations de patrimoine et d&apos;intérêts
                publiées par la Haute Autorité pour la Transparence de la Vie Publique.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Architecture Technique */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Architecture Technique</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Notre système utilise une architecture multi-sources permettant de
              croiser et enrichir les données provenant de différentes origines :
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>
                <strong>Identifiants uniques</strong> : Chaque politicien est lié à ses
                identifiants dans chaque source (AN, Sénat, PE, Wikidata, HATVP)
              </li>
              <li>
                <strong>Matching intelligent</strong> : Recherche par ID externe, puis par
                nom avec gestion des variantes (particules, accents)
              </li>
              <li>
                <strong>Priorité des sources</strong> : Les données officielles (AN, Sénat, Gouvernement)
                prévalent sur les sources tierces
              </li>
              <li>
                <strong>Traçabilité</strong> : Chaque donnée conserve sa source d&apos;origine
              </li>
              <li>
                <strong>Synchronisation automatique</strong> : Mise à jour hebdomadaire via GitHub Actions
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Contact */}
      <section>
        <Card className="bg-muted">
          <CardContent className="pt-6 text-center">
            <h3 className="font-semibold mb-2">Une erreur ? Une suggestion ?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Nous nous engageons à corriger rapidement toute erreur signalée.
            </p>
            <Link
              href="/mentions-legales"
              className="text-sm text-blue-600 hover:underline"
            >
              Nous contacter via les mentions légales
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
