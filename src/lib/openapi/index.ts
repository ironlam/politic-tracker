import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Transparence Politique API",
      version: "1.1.0",
      description: `
API publique pour accéder aux données des représentants politiques français.

## Endpoints publics

| Endpoint | Description |
|----------|-------------|
| \`/api/affaires\` | Affaires judiciaires documentées |
| \`/api/politiques/[slug]/affaires\` | Affaires d'un représentant |
| \`/api/politiques/[slug]/votes\` | Votes parlementaires d'un représentant |
| \`/api/politiques/[slug]/relations\` | Relations d'un représentant |
| \`/api/votes\` | Liste des scrutins parlementaires |
| \`/api/search/politicians\` | Recherche de représentants |
| \`/api/deputies/by-department\` | Députés par département |

## Pagination

Les endpoints de liste supportent la pagination avec les paramètres :
- \`page\` : Numéro de page (défaut: 1)
- \`limit\` : Éléments par page (défaut: 20, max: 100)

## Authentification

Les endpoints publics ne nécessitent pas d'authentification.
Les endpoints admin (\`/api/admin/*\`) sont protégés par authentification.

## Rate limiting

Pas de rate limiting pour le moment. Merci de faire un usage raisonnable de l'API.

## Code source

Le projet est open source : [GitHub](https://github.com/ironlam/politic-tracker)
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
    servers: [
      {
        url: "https://politic-tracker.vercel.app",
        description: "Production",
      },
      {
        url: "http://localhost:3000",
        description: "Développement local",
      },
    ],
    tags: [
      {
        name: "Affaires",
        description: "Affaires judiciaires documentées avec sources",
      },
      {
        name: "Votes",
        description: "Votes parlementaires (scrutins publics)",
      },
      {
        name: "Recherche",
        description: "Recherche et autocomplétion",
      },
      {
        name: "Géographie",
        description: "Données géographiques (départements, circonscriptions)",
      },
      {
        name: "Relations",
        description: "Relations entre représentants politiques",
      },
    ],
  },
  apis: [
    "./src/lib/openapi/schemas.ts",
    "./src/app/api/affaires/route.ts",
    "./src/app/api/politiques/*/affaires/route.ts",
    "./src/app/api/politiques/*/votes/route.ts",
    "./src/app/api/politiques/*/relations/route.ts",
    "./src/app/api/votes/route.ts",
    "./src/app/api/search/*/route.ts",
    "./src/app/api/deputies/*/route.ts",
  ],
};

export const openapiSpec = swaggerJsdoc(options);
