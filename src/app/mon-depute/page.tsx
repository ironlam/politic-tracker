import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostalCodeSearch } from "@/components/politicians/PostalCodeSearch";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const revalidate = 300; // ISR: re-check feature flag every 5 minutes

export const metadata: Metadata = {
  title: "Qui est mon député ?",
  description:
    "Trouvez votre député en entrant votre code postal. Accédez à sa fiche, ses mandats et ses déclarations.",
};

export default async function MonDeputePage() {
  if (!(await isFeatureEnabled("MON_DEPUTE_SECTION"))) notFound();
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Qui est mon député ?</h1>
          <p className="text-muted-foreground">
            Entrez votre code postal pour trouver le ou les députés de votre circonscription.
          </p>
        </div>

        <PostalCodeSearch />

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            Les circonscriptions législatives ne correspondent pas exactement aux codes postaux.
            Dans les grandes villes, plusieurs circonscriptions peuvent coexister.
          </p>
          <p className="mt-2">
            Source des données géographiques :{" "}
            <a
              href="https://geo.api.gouv.fr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              API Géo
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
