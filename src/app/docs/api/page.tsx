import type { Metadata } from "next";
import { SwaggerUIWrapper } from "./_components/SwaggerUIWrapper";

export const metadata: Metadata = {
  title: "Documentation API",
  description:
    "Documentation interactive de l'API publique Poligraph : politiques, votes, affaires, élections et plus.",
};

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Documentation API</h1>
          <p className="text-muted-foreground mt-2">
            Explorez et testez les endpoints de l&apos;API Poligraph
          </p>
        </div>
        <SwaggerUIWrapper />
      </div>
    </div>
  );
}
