"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoliticianAvatar } from "./PoliticianAvatar";
import { ensureContrast } from "@/lib/contrast";

interface GeoCommune {
  nom: string;
  code: string;
  codeDepartement: string;
  codeRegion: string;
  population: number;
}

interface Deputy {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  constituency: string | null;
  party: {
    name: string;
    shortName: string;
    color: string | null;
  } | null;
}

interface SearchResult {
  department: string;
  departmentCode: string;
  commune: string;
  deputies: Deputy[];
}

export function PostalCodeSearch() {
  const [postalCode, setPostalCode] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!postalCode || postalCode.length !== 5) {
      setError("Veuillez entrer un code postal valide (5 chiffres)");
      return;
    }

    setError(null);
    setResult(null);
    setIsSearching(true);

    try {
      // 1. Get commune info from geo.api.gouv.fr
      const geoResponse = await fetch(
        `https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom,code,codeDepartement,codeRegion,population`
      );

      if (!geoResponse.ok) {
        throw new Error("Erreur lors de la recherche géographique");
      }

      const communes: GeoCommune[] = await geoResponse.json();

      if (communes.length === 0) {
        setError("Code postal non trouvé. Vérifiez votre saisie.");
        setIsSearching(false);
        return;
      }

      // Use the most populated commune (for shared postal codes)
      const commune = communes.reduce((a, b) => (a.population > b.population ? a : b));

      // 2. Get department name from code
      const deptResponse = await fetch(
        `https://geo.api.gouv.fr/departements/${commune.codeDepartement}`
      );
      const deptData = await deptResponse.json();
      const departmentName = deptData.nom;

      // 3. Search for deputies in our API
      const deputiesResponse = await fetch(
        `/api/deputies/by-department?department=${encodeURIComponent(departmentName)}`
      );

      if (!deputiesResponse.ok) {
        throw new Error("Erreur lors de la recherche des députés");
      }

      const deputies: Deputy[] = await deputiesResponse.json();

      setResult({
        department: departmentName,
        departmentCode: commune.codeDepartement,
        commune: commune.nom,
        deputies,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="postal-code" className="sr-only">
            Code postal
          </label>
          <input
            id="postal-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={5}
            placeholder="Ex: 75001"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={handleKeyDown}
            aria-describedby={error ? "postal-code-error" : undefined}
            className="w-full h-12 px-4 text-lg rounded-lg border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearching || postalCode.length !== 5}
          className="h-12 px-6 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSearching ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Recherche...
            </>
          ) : (
            "Rechercher"
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div
          id="postal-code-error"
          role="alert"
          aria-live="assertive"
          className="p-4 bg-destructive/10 text-destructive rounded-lg text-center"
        >
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div
          className="space-y-4"
          role="region"
          aria-live="polite"
          aria-label="Résultats de recherche"
        >
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Résultats pour <strong>{result.commune}</strong> ({result.department})
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {result.deputies.length} député{result.deputies.length > 1 ? "s" : ""} dans ce
              département
            </p>
          </div>

          {result.deputies.length > 1 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 rounded-lg text-sm">
              <strong>Note :</strong> Votre département compte plusieurs circonscriptions. Votre
              député dépend de votre adresse exacte.{" "}
              <a
                href={`https://www.assemblee-nationale.fr/dyn/vos-deputes`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                Vérifiez sur le site de l&apos;Assemblée nationale →
              </a>
            </div>
          )}

          <div className="grid gap-4">
            {result.deputies.map((deputy) => (
              <Link key={deputy.id} href={`/politiques/${deputy.slug}`} className="block group">
                <Card className="transition-all duration-200 hover:shadow-lg hover:border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="transition-transform duration-200 group-hover:scale-105">
                        <PoliticianAvatar
                          photoUrl={deputy.photoUrl}
                          firstName={deputy.fullName.split(" ")[0]}
                          lastName={deputy.fullName.split(" ").slice(1).join(" ")}
                          size="md"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {deputy.fullName}
                        </p>
                        {deputy.constituency && (
                          <p className="text-sm text-muted-foreground">
                            Député · {deputy.constituency}
                          </p>
                        )}
                        {deputy.party && (
                          <Badge
                            variant="secondary"
                            className="mt-2"
                            title={deputy.party.name}
                            style={{
                              backgroundColor: deputy.party.color
                                ? `${deputy.party.color}15`
                                : undefined,
                              color: deputy.party.color
                                ? ensureContrast(deputy.party.color, "#ffffff")
                                : undefined,
                            }}
                          >
                            {deputy.party.shortName}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground group-hover:text-primary transition-colors">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {result.deputies.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">
              <p>Aucun député trouvé pour ce département.</p>
              <p className="text-sm mt-2">Les données sont peut-être en cours de mise à jour.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
