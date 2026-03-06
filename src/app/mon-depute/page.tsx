import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostalCodeSearch } from "@/components/politicians/PostalCodeSearch";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const revalidate = 300; // ISR: re-check feature flag every 5 minutes

export const metadata: Metadata = {
  title: "Qui sont mes représentants ?",
  description:
    "Trouvez votre député et vos sénateurs par code postal ou géolocalisation. Accédez à leurs fiches, mandats et votes.",
  alternates: { canonical: "/mon-depute" },
};

export default async function MonDeputePage() {
  if (!(await isFeatureEnabled("MON_DEPUTE_SECTION"))) notFound();
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-extrabold tracking-tight mb-2">
            Qui sont mes représentants ?
          </h1>
          <p className="text-muted-foreground">
            Entrez votre code postal ou utilisez la géolocalisation pour trouver votre député et vos
            sénateurs.
          </p>
        </div>

        <PostalCodeSearch />

        <div className="mt-12 text-center text-sm text-muted-foreground space-y-2">
          <p>
            Les circonscriptions législatives ne correspondent pas exactement aux codes postaux.
            Dans les grandes villes, plusieurs circonscriptions peuvent coexister.
          </p>
          <p>
            Sources :{" "}
            <a
              href="https://www.insee.fr/fr/information/7671844"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              INSEE (COG)
            </a>
            {" · "}
            <a
              href="https://geo.api.gouv.fr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              API Géo
            </a>
            {" · "}
            <a
              href="https://www.assemblee-nationale.fr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Assemblée nationale
            </a>
            {" · "}
            <a
              href="https://www.senat.fr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Sénat
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
