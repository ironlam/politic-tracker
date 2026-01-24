import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-muted/50 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Données publiques issues de{" "}
            <a
              href="https://data.gouv.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              data.gouv.fr
            </a>
            ,{" "}
            <a
              href="https://data.assemblee-nationale.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Assemblée nationale
            </a>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/mentions-legales" className="hover:text-foreground">
              Mentions légales
            </Link>
            <span>•</span>
            <span>Projet open source</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground text-center">
          La présomption d&apos;innocence s&apos;applique à toute personne
          mentionnée dans le cadre d&apos;une procédure judiciaire en cours.
        </div>
      </div>
    </footer>
  );
}
