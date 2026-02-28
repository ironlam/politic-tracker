import { db } from "@/lib/db";
import { buildRss, createRssResponse } from "@/lib/rss";
import { AFFAIR_CATEGORY_LABELS } from "@/config/labels";
import type { AffairCategory } from "@/types";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

export async function GET() {
  const affairs = await db.affair.findMany({
    where: { publicationStatus: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      slug: true,
      title: true,
      description: true,
      createdAt: true,
      category: true,
      politician: { select: { fullName: true } },
    },
  });

  const items = affairs.map((a) => ({
    title: `${a.title} — ${a.politician.fullName}`,
    link: `${SITE_URL}/affaires/${a.slug}`,
    description: a.description.slice(0, 500),
    pubDate: a.createdAt,
    guid: `${SITE_URL}/affaires/${a.slug}`,
    category: AFFAIR_CATEGORY_LABELS[a.category as AffairCategory],
  }));

  const xml = buildRss(
    {
      title: "Poligraph — Affaires judiciaires",
      link: `${SITE_URL}/api/rss/affaires.xml`,
      description: "Les 50 dernières affaires judiciaires publiées sur Poligraph.",
    },
    items
  );

  return createRssResponse(xml);
}
