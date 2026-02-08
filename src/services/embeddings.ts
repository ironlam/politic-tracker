/**
 * Embedding Service for RAG (Retrieval-Augmented Generation)
 *
 * Uses Voyage AI for generating embeddings (free tier: 200M tokens/month).
 * Stores embeddings in PostgreSQL as JSON arrays.
 * For MVP, similarity search is done in JavaScript.
 * Can be upgraded to pgvector for better performance.
 */

import { VoyageAIClient } from "voyageai";
import { db } from "@/lib/db";
import type { EmbeddingType, Prisma } from "@/generated/prisma";

// Voyage AI voyage-4-lite: shared embedding space, Matryoshka dimensions
// Other options: voyage-4 (1024 dims), voyage-4-large (best quality)
const EMBEDDING_MODEL = "voyage-4-lite";
const EMBEDDING_DIMENSIONS = 512;
const RERANK_MODEL = "rerank-2.5-lite";

// Initialize Voyage AI client
function getVoyageClient(): VoyageAIClient {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY environment variable is not set");
  }
  return new VoyageAIClient({ apiKey });
}

/**
 * Generate embedding vector for a text
 */
export async function generateEmbedding(
  text: string,
  inputType: "document" | "query" = "document"
): Promise<number[]> {
  const client = getVoyageClient();

  const response = await client.embed({
    input: text.slice(0, 16000), // Voyage supports up to 32k tokens
    model: EMBEDDING_MODEL,
    inputType,
    outputDimension: EMBEDDING_DIMENSIONS,
  });

  if (!response.data || response.data.length === 0) {
    throw new Error("No embedding returned from Voyage AI");
  }

  return response.data[0].embedding as number[];
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Index a document (create or update embedding)
 */
export async function indexDocument(params: {
  entityType: EmbeddingType;
  entityId: string;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { entityType, entityId, content, metadata } = params;

  if (!content.trim()) {
    console.warn(`Empty content for ${entityType}:${entityId}, skipping`);
    return;
  }

  const embedding = await generateEmbedding(content);

  await db.chatEmbedding.upsert({
    where: {
      entityType_entityId: { entityType, entityId },
    },
    create: {
      entityType,
      entityId,
      content,
      embedding: embedding as unknown as Prisma.InputJsonValue,
      metadata: (metadata as Prisma.InputJsonValue) ?? null,
    },
    update: {
      content,
      embedding: embedding as unknown as Prisma.InputJsonValue,
      metadata: (metadata as Prisma.InputJsonValue) ?? null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  entityType: EmbeddingType;
  entityId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
}

/**
 * Search for similar documents by query
 */
export async function searchSimilar(params: {
  query: string;
  limit?: number;
  threshold?: number;
  entityTypes?: EmbeddingType[];
}): Promise<SearchResult[]> {
  const { query, limit = 5, threshold = 0.7, entityTypes } = params;

  // Generate query embedding (use "query" input type for better retrieval)
  const queryEmbedding = await generateEmbedding(query, "query");

  // Build where clause
  const where: Prisma.ChatEmbeddingWhereInput = {};
  if (entityTypes && entityTypes.length > 0) {
    where.entityType = { in: entityTypes };
  }

  // Fetch all embeddings (for MVP - can be optimized with pgvector later)
  const embeddings = await db.chatEmbedding.findMany({
    where,
    select: {
      entityType: true,
      entityId: true,
      content: true,
      embedding: true,
      metadata: true,
    },
  });

  // Calculate similarities
  const results: SearchResult[] = embeddings
    .map((doc) => {
      const docEmbedding = doc.embedding as unknown as number[];
      const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
      return {
        entityType: doc.entityType,
        entityId: doc.entityId,
        content: doc.content,
        metadata: doc.metadata as Record<string, unknown> | null,
        similarity,
      };
    })
    .filter((r) => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Rerank search results using Voyage AI reranker for better relevance
 */
export async function rerankResults(
  query: string,
  results: SearchResult[],
  topK?: number
): Promise<SearchResult[]> {
  if (results.length <= 1) return results;

  const client = getVoyageClient();
  const documents = results.map((r) => r.content);

  const response = await client.rerank({
    query,
    documents,
    model: RERANK_MODEL,
    topK: topK ?? results.length,
  });

  if (!response.data || response.data.length === 0) {
    return results; // Fallback to original order
  }

  return response.data
    .filter((item) => item.index !== undefined)
    .map((item) => ({
      ...results[item.index!],
      similarity: item.relevanceScore ?? results[item.index!].similarity,
    }));
}

/**
 * Index a politician with their relevant information
 */
export async function indexPolitician(politicianId: string): Promise<void> {
  const politician = await db.politician.findUnique({
    where: { id: politicianId },
    include: {
      currentParty: true,
      mandates: {
        where: { isCurrent: true },
        take: 5,
      },
      affairs: {
        take: 5,
        include: { sources: { take: 1 } },
      },
    },
  });

  if (!politician) return;

  // Build content for embedding
  const parts: string[] = [
    `${politician.civility || ""} ${politician.fullName}`,
    politician.currentParty ? `Parti: ${politician.currentParty.name}` : "Sans parti",
  ];

  // Add mandates
  for (const mandate of politician.mandates) {
    parts.push(`${mandate.title} (${mandate.institution})`);
  }

  // Add birth info
  if (politician.birthDate) {
    const age = Math.floor(
      (Date.now() - politician.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );
    parts.push(`Né(e) en ${politician.birthDate.getFullYear()}, ${age} ans`);
  }

  // Add affair summary (if any)
  if (politician.affairs.length > 0) {
    parts.push(`${politician.affairs.length} affaire(s) judiciaire(s)`);
  }

  const content = parts.join(". ");

  await indexDocument({
    entityType: "POLITICIAN",
    entityId: politicianId,
    content,
    metadata: {
      name: politician.fullName,
      slug: politician.slug,
      party: politician.currentParty?.name,
      partyId: politician.currentPartyId,
      hasAffairs: politician.affairs.length > 0,
    },
  });
}

/**
 * Index a legislative dossier
 */
export async function indexDossier(dossierId: string): Promise<void> {
  const dossier = await db.legislativeDossier.findUnique({
    where: { id: dossierId },
  });

  if (!dossier) return;

  const parts: string[] = [dossier.shortTitle || dossier.title];

  if (dossier.number) {
    parts.push(`Numéro: ${dossier.number}`);
  }

  if (dossier.category) {
    parts.push(`Catégorie: ${dossier.category}`);
  }

  if (dossier.summary) {
    parts.push(dossier.summary);
  }

  const content = parts.join(". ");

  await indexDocument({
    entityType: "DOSSIER",
    entityId: dossierId,
    content,
    metadata: {
      id: dossierId,
      slug: dossier.slug,
      title: dossier.shortTitle || dossier.title,
      number: dossier.number,
      status: dossier.status,
      category: dossier.category,
      sourceUrl: dossier.sourceUrl,
    },
  });
}

/**
 * Index a voting record (scrutin)
 */
export async function indexScrutin(scrutinId: string): Promise<void> {
  const scrutin = await db.scrutin.findUnique({
    where: { id: scrutinId },
  });

  if (!scrutin) return;

  const parts: string[] = [
    scrutin.title,
    `Date: ${scrutin.votingDate.toISOString().split("T")[0]}`,
    `Résultat: ${scrutin.result === "ADOPTED" ? "Adopté" : "Rejeté"}`,
    `Pour: ${scrutin.votesFor}, Contre: ${scrutin.votesAgainst}, Abstention: ${scrutin.votesAbstain}`,
  ];

  if (scrutin.description) {
    parts.push(scrutin.description);
  }

  if (scrutin.summary) {
    parts.push(scrutin.summary);
  }

  const content = parts.join(". ");

  await indexDocument({
    entityType: "SCRUTIN",
    entityId: scrutinId,
    content,
    metadata: {
      id: scrutinId,
      slug: scrutin.slug,
      title: scrutin.title,
      votingDate: scrutin.votingDate.toISOString(),
      result: scrutin.result,
      sourceUrl: scrutin.sourceUrl,
    },
  });
}

/**
 * Index an affair
 */
export async function indexAffair(affairId: string): Promise<void> {
  const affair = await db.affair.findUnique({
    where: { id: affairId },
    include: {
      politician: { select: { fullName: true, slug: true } },
      partyAtTime: { select: { name: true } },
      sources: { take: 3 },
    },
  });

  if (!affair) return;

  const parts: string[] = [
    affair.title,
    `Concernant: ${affair.politician.fullName}`,
    affair.description.slice(0, 500), // Truncate long descriptions
  ];

  if (affair.partyAtTime) {
    parts.push(`Parti à l'époque: ${affair.partyAtTime.name}`);
  }

  if (affair.verdictDate) {
    parts.push(`Verdict: ${affair.verdictDate.toISOString().split("T")[0]}`);
  }

  const content = parts.join(". ");

  await indexDocument({
    entityType: "AFFAIR",
    entityId: affairId,
    content,
    metadata: {
      title: affair.title,
      slug: affair.slug,
      politicianName: affair.politician.fullName,
      politicianSlug: affair.politician.slug,
      status: affair.status,
      category: affair.category,
      sources: affair.sources.map((s) => ({ title: s.title, url: s.url })),
    },
  });
}

/**
 * Index a political party with detailed mandate statistics
 */
export async function indexParty(partyId: string): Promise<void> {
  const party = await db.party.findUnique({
    where: { id: partyId },
    include: {
      _count: { select: { politicians: true } },
    },
  });

  if (!party) return;

  // Get mandate counts by type for this party
  const mandateCounts = await db.mandate.groupBy({
    by: ["type"],
    where: {
      isCurrent: true,
      politician: { currentPartyId: partyId },
    },
    _count: true,
  });

  const countByType: Record<string, number> = {};
  for (const m of mandateCounts) {
    countByType[m.type] = m._count;
  }

  const deputyCount = countByType["DEPUTE"] || 0;
  const senatorCount = countByType["SENATEUR"] || 0;
  const ministerCount =
    (countByType["MINISTRE"] || 0) +
    (countByType["MINISTRE_DELEGUE"] || 0) +
    (countByType["SECRETAIRE_ETAT"] || 0);
  const mepCount = countByType["DEPUTE_EUROPEEN"] || 0;

  const parts: string[] = [`${party.name} (${party.shortName})`];

  // Add detailed mandate counts
  const mandateParts: string[] = [];
  if (deputyCount > 0) mandateParts.push(`${deputyCount} député${deputyCount > 1 ? "s" : ""}`);
  if (senatorCount > 0) mandateParts.push(`${senatorCount} sénateur${senatorCount > 1 ? "s" : ""}`);
  if (ministerCount > 0)
    mandateParts.push(`${ministerCount} ministre${ministerCount > 1 ? "s" : ""}`);
  if (mepCount > 0) mandateParts.push(`${mepCount} eurodéputé${mepCount > 1 ? "s" : ""}`);

  if (mandateParts.length > 0) {
    parts.push(`Le ${party.shortName} a ${mandateParts.join(", ")}`);
    parts.push(`Combien de députés au ${party.shortName} ? ${deputyCount}`);
    parts.push(`Combien de sénateurs au ${party.shortName} ? ${senatorCount}`);
  } else {
    parts.push(`${party._count.politicians} membre(s)`);
  }

  if (party.description) {
    parts.push(party.description);
  }

  if (party.ideology) {
    parts.push(`Idéologie: ${party.ideology}`);
  }

  if (party.politicalPosition) {
    const positions: Record<string, string> = {
      FAR_LEFT: "Extrême gauche",
      LEFT: "Gauche",
      CENTER_LEFT: "Centre-gauche",
      CENTER: "Centre",
      CENTER_RIGHT: "Centre-droit",
      RIGHT: "Droite",
      FAR_RIGHT: "Extrême droite",
    };
    parts.push(`Position: ${positions[party.politicalPosition] || party.politicalPosition}`);
  }

  const content = parts.join(". ");

  await indexDocument({
    entityType: "PARTY",
    entityId: partyId,
    content,
    metadata: {
      name: party.name,
      shortName: party.shortName,
      slug: party.slug,
      color: party.color,
      memberCount: party._count.politicians,
      deputyCount,
      senatorCount,
      ministerCount,
      mepCount,
    },
  });
}

/**
 * Index global statistics (deputies, senators, parties, etc.)
 */
export async function indexGlobalStats(): Promise<void> {
  // Get mandate counts by type
  const mandateCounts = await db.mandate.groupBy({
    by: ["type"],
    where: { isCurrent: true },
    _count: true,
  });

  const countByType: Record<string, number> = {};
  for (const m of mandateCounts) {
    countByType[m.type] = m._count;
  }

  const deputyCount = countByType["DEPUTE"] || 0;
  const senatorCount = countByType["SENATEUR"] || 0;
  const mepCount = countByType["DEPUTE_EUROPEEN"] || 0;
  const ministerCount =
    (countByType["MINISTRE"] || 0) +
    (countByType["MINISTRE_DELEGUE"] || 0) +
    (countByType["SECRETAIRE_ETAT"] || 0) +
    (countByType["PREMIER_MINISTRE"] || 0);

  // Get affair counts
  const affairCount = await db.affair.count();
  const condemnedCount = await db.affair.count({
    where: { status: "CONDAMNATION_DEFINITIVE" },
  });

  // Get party count
  const partyCount = await db.party.count();

  // Get dossier count
  const dossierCount = await db.legislativeDossier.count();

  const content = `
STATISTIQUES OFFICIELLES DU PARLEMENT FRANÇAIS - Données globales et totaux.

DÉPUTÉS - ASSEMBLÉE NATIONALE:
- Combien y a-t-il de députés ? Il y a ${deputyCount} députés.
- Combien de députés en France ? ${deputyCount} députés à l'Assemblée nationale.
- Nombre total de députés : ${deputyCount}
- L'Assemblée nationale compte 577 sièges.

SÉNATEURS - SÉNAT:
- Combien y a-t-il de sénateurs ? Il y a ${senatorCount} sénateurs.
- Combien de sénateurs en France ? ${senatorCount} sénateurs au Sénat.
- Nombre total de sénateurs : ${senatorCount}
- Le Sénat compte 348 sièges.

GOUVERNEMENT:
- Combien de membres du gouvernement ? ${ministerCount} membres (ministres et secrétaires d'État).
- Combien de ministres ? ${ministerCount} au total.

PARLEMENT EUROPÉEN:
- Combien d'eurodéputés français ? ${mepCount} eurodéputés.
- La France dispose de 81 sièges au Parlement européen.

AUTRES STATISTIQUES:
- Partis politiques référencés : ${partyCount}
- Affaires judiciaires : ${affairCount} (dont ${condemnedCount} condamnations définitives)
- Dossiers législatifs : ${dossierCount}
  `.trim();

  await indexDocument({
    entityType: "PARTY", // Using PARTY type for global stats
    entityId: "global-stats",
    content,
    metadata: {
      type: "global-stats",
      deputyCount,
      senatorCount,
      mepCount,
      ministerCount,
      partyCount,
      affairCount,
      condemnedCount,
      dossierCount,
    },
  });

  console.log("Indexed global statistics");
}

/**
 * Batch index all entities of a type
 */
export async function indexAllOfType(
  entityType: EmbeddingType,
  options: {
    limit?: number;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<{ indexed: number; errors: number }> {
  const { limit, onProgress } = options;
  let indexed = 0;
  let errors = 0;

  switch (entityType) {
    case "POLITICIAN": {
      const politicians = await db.politician.findMany({
        select: { id: true },
        take: limit,
      });
      for (let i = 0; i < politicians.length; i++) {
        try {
          await indexPolitician(politicians[i].id);
          indexed++;
        } catch (e) {
          console.error(`Error indexing politician ${politicians[i].id}:`, e);
          errors++;
        }
        onProgress?.(i + 1, politicians.length);
        // Rate limit
        await new Promise((r) => setTimeout(r, 200));
      }
      break;
    }
    case "DOSSIER": {
      const dossiers = await db.legislativeDossier.findMany({
        select: { id: true },
        take: limit,
      });
      for (let i = 0; i < dossiers.length; i++) {
        try {
          await indexDossier(dossiers[i].id);
          indexed++;
        } catch (e) {
          console.error(`Error indexing dossier ${dossiers[i].id}:`, e);
          errors++;
        }
        onProgress?.(i + 1, dossiers.length);
        await new Promise((r) => setTimeout(r, 200));
      }
      break;
    }
    case "SCRUTIN": {
      const scrutins = await db.scrutin.findMany({
        select: { id: true },
        take: limit,
      });
      for (let i = 0; i < scrutins.length; i++) {
        try {
          await indexScrutin(scrutins[i].id);
          indexed++;
        } catch (e) {
          console.error(`Error indexing scrutin ${scrutins[i].id}:`, e);
          errors++;
        }
        onProgress?.(i + 1, scrutins.length);
        await new Promise((r) => setTimeout(r, 200));
      }
      break;
    }
    case "AFFAIR": {
      const affairs = await db.affair.findMany({
        select: { id: true },
        take: limit,
      });
      for (let i = 0; i < affairs.length; i++) {
        try {
          await indexAffair(affairs[i].id);
          indexed++;
        } catch (e) {
          console.error(`Error indexing affair ${affairs[i].id}:`, e);
          errors++;
        }
        onProgress?.(i + 1, affairs.length);
        await new Promise((r) => setTimeout(r, 200));
      }
      break;
    }
    case "PARTY": {
      const parties = await db.party.findMany({
        select: { id: true },
        take: limit,
      });
      for (let i = 0; i < parties.length; i++) {
        try {
          await indexParty(parties[i].id);
          indexed++;
        } catch (e) {
          console.error(`Error indexing party ${parties[i].id}:`, e);
          errors++;
        }
        onProgress?.(i + 1, parties.length);
        await new Promise((r) => setTimeout(r, 200));
      }
      break;
    }
  }

  return { indexed, errors };
}

/**
 * Get embedding stats
 */
export async function getEmbeddingStats(): Promise<Record<EmbeddingType, number>> {
  const results = await db.chatEmbedding.groupBy({
    by: ["entityType"],
    _count: true,
  });

  const stats: Record<string, number> = {
    POLITICIAN: 0,
    DOSSIER: 0,
    SCRUTIN: 0,
    AFFAIR: 0,
    PARTY: 0,
  };

  for (const r of results) {
    stats[r.entityType] = r._count;
  }

  return stats as Record<EmbeddingType, number>;
}
