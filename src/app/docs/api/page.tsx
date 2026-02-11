"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  ),
});

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
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <SwaggerUI url="/api/docs" />
        </div>
      </div>
    </div>
  );
}
