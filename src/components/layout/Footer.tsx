import Link from "next/link";
import { FOOTER_SECTIONS, DATA_SOURCES } from "@/config/navigation";
import { ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer role="contentinfo" className="border-t bg-muted/30 mt-auto">
      <div className="container mx-auto px-4 py-8 md:py-10">
        {/* Main footer content */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
          {/* About */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-semibold text-sm mb-3">À propos</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Observatoire citoyen des représentants politiques français. Un
              projet indépendant et transparent.
            </p>
          </div>

          {/* Navigation sections */}
          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.title} aria-labelledby={`footer-nav-${section.title}`}>
              <h3
                id={`footer-nav-${section.title}`}
                className="font-semibold text-sm mb-3"
              >
                {section.title}
              </h3>
              <ul className="space-y-2 text-sm">
                {section.links.map((link) => (
                  <li key={link.href}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                      >
                        {link.label}
                        <ExternalLink className="h-3 w-3" />
                        <span className="sr-only">(ouvre un nouvel onglet)</span>
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Data Sources */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Sources</h3>
            <ul className="space-y-2 text-sm">
              {DATA_SOURCES.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    {source.label}
                    <ExternalLink className="h-3 w-3" />
                    <span className="sr-only">(ouvre un nouvel onglet)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link
              href="/mentions-legales"
              className="hover:text-foreground transition-colors"
            >
              Mentions légales
            </Link>
            <span className="hidden sm:inline">•</span>
            <a
              href="https://github.com/ironlam/politic-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
                aria-hidden="true"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Open source
              <span className="sr-only">(ouvre un nouvel onglet)</span>
            </a>
          </div>
          <p className="text-xs text-muted-foreground text-center sm:text-right max-w-lg">
            La présomption d&apos;innocence s&apos;applique à toute personne
            mentionnée dans le cadre d&apos;une procédure judiciaire en cours.
          </p>
        </div>
      </div>
    </footer>
  );
}
