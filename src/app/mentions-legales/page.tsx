import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales - Politic Tracker",
  description: "Mentions légales et politique de confidentialité",
};

export default function MentionsLegalesPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Mentions légales</h1>

      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">Éditeur du site</h2>
          <p className="text-muted-foreground">
            {/* TODO: Compléter avec vos informations */}
            <strong>Nom / Raison sociale :</strong> [À compléter]
            <br />
            <strong>Adresse :</strong> [À compléter]
            <br />
            <strong>Email :</strong> [À compléter]
            <br />
            <strong>Directeur de la publication :</strong> [À compléter]
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Hébergement</h2>
          <p className="text-muted-foreground">
            Ce site est hébergé par Vercel Inc.
            <br />
            440 N Barranca Ave #4133
            <br />
            Covina, CA 91723
            <br />
            États-Unis
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Sources des données</h2>
          <p className="text-muted-foreground mb-4">
            Les informations publiées sur ce site proviennent exclusivement de sources publiques :
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>
              Assemblée nationale (
              <a
                href="https://data.assemblee-nationale.fr"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                data.assemblee-nationale.fr
              </a>
              )
            </li>
            <li>
              Sénat (
              <a
                href="https://data.senat.fr"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                data.senat.fr
              </a>
              )
            </li>
            <li>
              Haute Autorité pour la Transparence de la Vie Publique (
              <a
                href="https://www.hatvp.fr"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                hatvp.fr
              </a>
              )
            </li>
            <li>Articles de presse (sources citées pour chaque information)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Présomption d&apos;innocence</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-900">
              <strong>Important :</strong> Conformément à l&apos;article 9-1 du Code civil, toute
              personne mentionnée sur ce site dans le cadre d&apos;une procédure judiciaire en cours
              (enquête préliminaire, instruction, mise en examen, procès) bénéficie de la
              présomption d&apos;innocence.
            </p>
            <p className="text-amber-900 mt-2">
              Seules les condamnations définitives (après épuisement des voies de recours)
              établissent la culpabilité d&apos;une personne.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Droit de réponse et rectification</h2>
          <p className="text-muted-foreground">
            Conformément à la loi du 29 juillet 1881 sur la liberté de la presse, toute personne
            nommée ou désignée sur ce site dispose d&apos;un droit de réponse.
          </p>
          <p className="text-muted-foreground mt-2">
            Pour exercer ce droit ou signaler une erreur factuelle, veuillez nous contacter à
            l&apos;adresse : <strong>[email à compléter]</strong>
          </p>
          <p className="text-muted-foreground mt-2">
            Nous nous engageons à traiter toute demande dans un délai de 72 heures ouvrées.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Politique de confidentialité</h2>
          <p className="text-muted-foreground">
            Ce site ne collecte aucune donnée personnelle des visiteurs. Aucun cookie de tracking
            n&apos;est utilisé. Aucune donnée n&apos;est transmise à des tiers.
          </p>
          <p className="text-muted-foreground mt-2">
            Les seules données traitées sont des informations publiques concernant des personnalités
            politiques dans le cadre de leur mandat.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Propriété intellectuelle</h2>
          <p className="text-muted-foreground">
            Les données factuelles présentées sur ce site (votes, mandats, déclarations de
            patrimoine) sont des données publiques librement réutilisables.
          </p>
          <p className="text-muted-foreground mt-2">
            Le code source de ce projet est disponible sous licence MIT.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Contact</h2>
          <p className="text-muted-foreground">
            Pour toute question concernant ce site : <strong>[email à compléter]</strong>
          </p>
        </section>
      </div>

      <p className="text-sm text-muted-foreground mt-12">Dernière mise à jour : Janvier 2025</p>
    </main>
  );
}
