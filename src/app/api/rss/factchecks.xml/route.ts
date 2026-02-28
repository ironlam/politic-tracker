import { db } from "@/lib/db";
import { buildRss, createRssResponse } from "@/lib/rss";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

export async function GET() {
  const factchecks = await db.factCheck.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: {
      slug: true,
      title: true,
      verdict: true,
      source: true,
      publishedAt: true,
    },
  });

  const items = factchecks
    .filter((f) => f.slug)
    .map((f) => ({
      title: f.title,
      link: `${SITE_URL}/factchecks/${f.slug}`,
      description: `Verdict : ${f.verdict} — Source : ${f.source}`,
      pubDate: f.publishedAt,
      guid: `${SITE_URL}/factchecks/${f.slug}`,
      category: f.source,
    }));

  const xml = buildRss(
    {
      title: "Poligraph — Fact-checking",
      link: `${SITE_URL}/api/rss/factchecks.xml`,
      description: "Les 50 derniers fact-checks référencés sur Poligraph.",
    },
    items
  );

  return createRssResponse(xml);
}
