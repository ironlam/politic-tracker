import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation API",
  description:
    "Explorez les endpoints de l'API publique Poligraph : politiciens, affaires judiciaires, votes, partis et fact-checks. Documentation interactive Swagger/OpenAPI.",
  robots: { index: false, follow: true },
};

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
