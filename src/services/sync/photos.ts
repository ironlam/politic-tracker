import { db } from "@/lib/db";
import { DataSource, MandateType } from "@/generated/prisma";

// Photo source priority (higher = better)
const PHOTO_PRIORITY: Record<string, number> = {
  "assemblee-nationale": 10,
  senat: 10,
  gouvernement: 10,
  hatvp: 8,
  nosdeputes: 5,
  nossenateurs: 5,
  wikidata: 3,
  manual: 1,
};

interface PhotoSyncResult {
  success: boolean;
  checked: number;
  updated: number;
  validated: number;
  invalidUrls: number;
  errors: string[];
}

/**
 * Check if a photo URL is valid (returns 200)
 */
async function isPhotoUrlValid(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Try to get photo URL from Wikidata
 */
async function getWikidataPhoto(wikidataId: string): Promise<string | null> {
  try {
    const query = `
      SELECT ?image WHERE {
        wd:${wikidataId} wdt:P18 ?image .
      }
      LIMIT 1
    `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;

    const response = await fetch(url, {
      headers: { "User-Agent": "TransparencePolitique/1.0" },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const results = data.results?.bindings;

    if (results && results.length > 0 && results[0].image?.value) {
      return results[0].image.value;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Normalize name for HATVP photo URL (remove accents, lowercase)
 */
function normalizeForHatvp(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z]/g, ""); // Keep only letters
}

/**
 * Generate potential photo URLs based on politician data
 */
async function getPotentialPhotoUrls(politician: {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  externalIds: { source: DataSource; externalId: string }[];
  mandates: { type: MandateType; isCurrent: boolean }[];
}): Promise<{ url: string; source: string }[]> {
  const urls: { url: string; source: string }[] = [];

  // Check mandate types to determine which sources to try
  const hasDeputeMandate = politician.mandates.some((m) => m.type === MandateType.DEPUTE);
  const hasSenateurMandate = politician.mandates.some((m) => m.type === MandateType.SENATEUR);
  const gouvernementTypes: MandateType[] = [
    MandateType.MINISTRE,
    MandateType.PREMIER_MINISTRE,
    MandateType.MINISTRE_DELEGUE,
    MandateType.SECRETAIRE_ETAT,
  ];
  const hasGouvernementMandate = politician.mandates.some((m) =>
    gouvernementTypes.includes(m.type)
  );

  // Get external IDs
  const anId = politician.externalIds.find(
    (e) => e.source === DataSource.ASSEMBLEE_NATIONALE
  )?.externalId;
  const senatId = politician.externalIds.find((e) => e.source === DataSource.SENAT)?.externalId;
  const wikidataId = politician.externalIds.find(
    (e) => e.source === DataSource.WIKIDATA
  )?.externalId;

  // 1. Assemblée Nationale (highest priority for deputies)
  if (anId && hasDeputeMandate) {
    urls.push({
      url: `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/${anId.replace("PA", "")}.jpg`,
      source: "assemblee-nationale",
    });
  }

  // 2. Sénat (highest priority for senators)
  if (senatId && hasSenateurMandate) {
    urls.push({
      url: `https://www.senat.fr/senimg/${senatId}.jpg`,
      source: "senat",
    });
  }

  // 3. HATVP photos (format: nom-prenom.jpg)
  // Try for government members and anyone with HATVP declaration
  if (hasGouvernementMandate || politician.externalIds.some((e) => e.source === DataSource.HATVP)) {
    const hatvpName = `${normalizeForHatvp(politician.lastName)}-${normalizeForHatvp(politician.firstName)}`;
    urls.push({
      url: `https://www.hatvp.fr/livraison/photos_gouvernement/${hatvpName}.jpg`,
      source: "hatvp",
    });
  }

  // 4. NosDéputés/NosSénateurs
  if (hasDeputeMandate) {
    urls.push({
      url: `https://www.nosdeputes.fr/depute/photo/${politician.slug}/120`,
      source: "nosdeputes",
    });
  }
  if (hasSenateurMandate) {
    urls.push({
      url: `https://archive.nossenateurs.fr/senateur/photo/${politician.slug}/120`,
      source: "nossenateurs",
    });
  }

  // 5. Wikidata
  if (wikidataId) {
    const wikiPhoto = await getWikidataPhoto(wikidataId);
    if (wikiPhoto) {
      urls.push({ url: wikiPhoto, source: "wikidata" });
    }
  }

  return urls;
}

/**
 * Sync photos for all politicians without photos or with invalid photos
 */
export async function syncPhotos(
  options: { validateExisting?: boolean } = {}
): Promise<PhotoSyncResult> {
  const { validateExisting = false } = options;

  const result: PhotoSyncResult = {
    success: false,
    checked: 0,
    updated: 0,
    validated: 0,
    invalidUrls: 0,
    errors: [],
  };

  try {
    console.log("Starting photo sync...");

    // Get politicians who need photos
    const politicians = await db.politician.findMany({
      where: validateExisting
        ? {} // Check all
        : { OR: [{ photoUrl: null }, { photoUrl: "" }] }, // Only those without photos
      select: {
        id: true,
        slug: true,
        firstName: true,
        lastName: true,
        fullName: true,
        photoUrl: true,
        photoSource: true,
        externalIds: {
          select: { source: true, externalId: true },
        },
        mandates: {
          select: { type: true, isCurrent: true },
        },
      },
    });

    console.log(`Checking ${politicians.length} politicians...`);

    for (const politician of politicians) {
      result.checked++;

      // If validating existing photos, check if current URL is valid
      if (validateExisting && politician.photoUrl) {
        const isValid = await isPhotoUrlValid(politician.photoUrl);
        if (isValid) {
          result.validated++;
          continue;
        }
        result.invalidUrls++;
        console.log(`Invalid photo URL for ${politician.fullName}: ${politician.photoUrl}`);
      }

      // Try to get a new photo
      const potentialUrls = await getPotentialPhotoUrls(politician);

      // Sort by priority
      potentialUrls.sort((a, b) => {
        const priorityA = PHOTO_PRIORITY[a.source] || 0;
        const priorityB = PHOTO_PRIORITY[b.source] || 0;
        return priorityB - priorityA;
      });

      // Try each URL until one works
      for (const { url, source } of potentialUrls) {
        const isValid = await isPhotoUrlValid(url);
        if (isValid) {
          // Check if this is a better source than current
          const currentPriority = politician.photoSource
            ? PHOTO_PRIORITY[politician.photoSource] || 0
            : 0;
          const newPriority = PHOTO_PRIORITY[source] || 0;

          if (newPriority >= currentPriority) {
            await db.politician.update({
              where: { id: politician.id },
              data: {
                photoUrl: url,
                photoSource: source,
              },
            });
            result.updated++;
            console.log(`Updated photo for ${politician.fullName} (${source})`);
          }
          break;
        }
      }

      // Progress logging every 100 politicians
      if (result.checked % 100 === 0) {
        console.log(
          `Progress: ${result.checked}/${politicians.length} checked, ${result.updated} updated`
        );
      }
    }

    result.success = true;
    console.log("\nPhoto sync completed:", result);
  } catch (error) {
    result.errors.push(String(error));
    console.error("Photo sync failed:", error);
  }

  return result;
}

/**
 * Get photo stats
 */
export async function getPhotoStats() {
  const [total, withPhoto, withoutPhoto] = await Promise.all([
    db.politician.count(),
    db.politician.count({ where: { photoUrl: { not: null } } }),
    db.politician.count({ where: { OR: [{ photoUrl: null }, { photoUrl: "" }] } }),
  ]);

  // Group by source
  const bySources = await db.politician.groupBy({
    by: ["photoSource"],
    _count: { photoSource: true },
    where: { photoSource: { not: null } },
  });

  return {
    total,
    withPhoto,
    withoutPhoto,
    bySource: bySources.reduce(
      (acc, s) => {
        acc[s.photoSource || "unknown"] = s._count.photoSource;
        return acc;
      },
      {} as Record<string, number>
    ),
  };
}
