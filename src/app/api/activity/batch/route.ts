import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withCache } from "@/lib/cache";
import type { WatchlistPolitician, ActivityItem } from "@/types/activity";

const MAX_SLUGS = 50;
const DEFAULT_DAYS = 30;
const MAX_ITEMS_PER_TYPE = 50;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slugs: string[] = Array.isArray(body.slugs) ? body.slugs.slice(0, MAX_SLUGS) : [];
    const days = Math.min(Math.max(Number(body.days) || DEFAULT_DAYS, 1), 90);

    if (slugs.length === 0) {
      return NextResponse.json({ error: "slugs required" }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Resolve slugs to politicians
    const politicians = await db.politician.findMany({
      where: { slug: { in: slugs }, publicationStatus: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
        fullName: true,
        photoUrl: true,
        currentParty: { select: { shortName: true, color: true } },
      },
    });

    if (politicians.length === 0) {
      return withCache(NextResponse.json({ activity: [], politicians: [] }), "daily");
    }

    const infoById = new Map<string, WatchlistPolitician>(
      politicians.map((p) => [
        p.id,
        {
          slug: p.slug,
          fullName: p.fullName,
          photoUrl: p.photoUrl,
          party: p.currentParty?.shortName ?? null,
          partyColor: p.currentParty?.color ?? null,
        },
      ])
    );
    const politicianIds = [...infoById.keys()];

    // 3 parallel queries — within pool limits with take caps
    const [votes, pressMentions, affairs] = await Promise.all([
      db.vote.findMany({
        where: {
          politicianId: { in: politicianIds },
          scrutin: { votingDate: { gte: since } },
        },
        select: {
          politicianId: true,
          position: true,
          scrutin: {
            select: { slug: true, title: true, votingDate: true, result: true },
          },
        },
        orderBy: { scrutin: { votingDate: "desc" } },
        take: MAX_ITEMS_PER_TYPE,
      }),
      db.pressArticleMention.findMany({
        where: {
          politicianId: { in: politicianIds },
          article: { publishedAt: { gte: since } },
        },
        select: {
          politicianId: true,
          article: {
            select: { title: true, url: true, feedSource: true, publishedAt: true },
          },
        },
        orderBy: { article: { publishedAt: "desc" } },
        take: MAX_ITEMS_PER_TYPE,
      }),
      db.affair.findMany({
        where: {
          politicianId: { in: politicianIds },
          publicationStatus: "PUBLISHED",
          createdAt: { gte: since },
        },
        select: {
          politicianId: true,
          slug: true,
          title: true,
          status: true,
          category: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ITEMS_PER_TYPE,
      }),
    ]);

    // Unify into chronological feed
    const activity: ActivityItem[] = [
      ...votes.map((v) => ({
        type: "vote" as const,
        date: v.scrutin.votingDate.toISOString(),
        politician: infoById.get(v.politicianId)!,
        data: {
          position: v.position,
          title: v.scrutin.title,
          slug: v.scrutin.slug,
          result: v.scrutin.result,
        },
      })),
      ...pressMentions.map((m) => ({
        type: "press" as const,
        date: m.article.publishedAt.toISOString(),
        politician: infoById.get(m.politicianId)!,
        data: {
          title: m.article.title,
          url: m.article.url,
          source: m.article.feedSource,
        },
      })),
      ...affairs.map((a) => ({
        type: "affair" as const,
        date: a.createdAt.toISOString(),
        politician: infoById.get(a.politicianId)!,
        data: {
          slug: a.slug,
          title: a.title,
          status: a.status,
          category: a.category,
        },
      })),
    ];

    activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return withCache(
      NextResponse.json({
        activity: activity.slice(0, 100),
        politicians: politicians.map((p) => ({
          slug: p.slug,
          fullName: p.fullName,
          photoUrl: p.photoUrl,
          party: p.currentParty?.shortName ?? null,
          partyColor: p.currentParty?.color ?? null,
        })),
      }),
      "daily"
    );
  } catch (error) {
    console.error("[API] Activity batch error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
