import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Transparence Politique API",
      version: "1.1.0",
      description: `
API publique pour accéder aux données des représentants politiques français.

## Endpoints disponibles

| Endpoint | Description |
|----------|-------------|
| \`/api/politiques\` | Liste des représentants politiques |
| \`/api/politiques/{slug}\` | Détails d'un représentant |
| \`/api/politiques/{slug}/affaires\` | Affaires judiciaires d'un représentant |
| \`/api/politiques/{slug}/votes\` | Votes parlementaires d'un représentant |
| \`/api/politiques/{slug}/relations\` | Relations d'un représentant |
| \`/api/affaires\` | Toutes les affaires judiciaires documentées |
| \`/api/votes\` | Liste des scrutins parlementaires |

## Pagination

Les endpoints de liste supportent la pagination :
- \`page\` : Numéro de page (défaut: 1)
- \`limit\` : Éléments par page (défaut: 20, max: 100)

## Utilisation responsable

Merci de faire un usage raisonnable de l'API.
      `.trim(),
      contact: {
        name: "Transparence Politique",
        url: "https://politic-tracker.vercel.app",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    tags: [
      {
        name: "Politiques",
        description: "Représentants politiques français",
      },
      {
        name: "Affaires",
        description: "Affaires judiciaires documentées avec sources",
      },
      {
        name: "Votes",
        description: "Votes parlementaires (scrutins publics)",
      },
      {
        name: "Relations",
        description: "Relations entre représentants politiques",
      },
    ],
  },
  apis: [
    "./src/lib/openapi/schemas.ts",
    "./src/app/api/politiques/route.ts",
    "./src/app/api/politiques/[slug]/route.ts",
    "./src/app/api/politiques/[slug]/affaires/route.ts",
    "./src/app/api/politiques/[slug]/votes/route.ts",
    "./src/app/api/politiques/[slug]/relations/route.ts",
    "./src/app/api/affaires/route.ts",
    "./src/app/api/votes/route.ts",
  ],
};

export const openapiSpec = swaggerJsdoc(options);
