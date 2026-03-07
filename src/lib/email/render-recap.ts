import { readFileSync } from "fs";
import { join } from "path";
import mjml2html from "mjml";
import type { WeeklyRecapData } from "@/lib/data/recap";
import { getISOWeekNumber } from "@/lib/data/recap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoliticianOfWeek {
  fullName: string;
  photoUrl: string | null;
  slug: string;
  partyShortName: string | null;
  mandateTitle: string | null;
  bio: string;
}

export interface RenderInput {
  recap: WeeklyRecapData;
  editorialIntro: string;
  politician: PoliticianOfWeek | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";
const DEFAULT_PHOTO = `${SITE_URL}/images/placeholder-politician.png`;

const SEVERITY_COLORS: Record<string, string> = {
  CRITIQUE: "#dc2626",
  GRAVE: "#d97706",
  SIGNIFICATIF: "#ca8a04",
};

const SEVERITY_LABELS: Record<string, string> = {
  CRITIQUE: "Critique",
  GRAVE: "Grave",
  SIGNIFICATIF: "Significatif",
};

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// HTML building helpers (private)
// ---------------------------------------------------------------------------

function buildVotesHtml(recap: WeeklyRecapData): string {
  const top5 = recap.votes.scrutins.slice(0, 5);
  if (top5.length === 0) return "";

  const rows = top5
    .map((s) => {
      const isAdopted = s.result === "ADOPTED";
      const badgeClass = isAdopted ? "adopted" : "rejected";
      const badgeLabel = isAdopted ? "Adopté" : "Rejeté";
      const title = escapeHtml(s.title);
      const total = s.votesFor + s.votesAgainst + s.votesAbstain;
      const ratio = total > 0 ? `${s.votesFor}/${s.votesAgainst}/${s.votesAbstain}` : "";
      const link = s.slug ? `${SITE_URL}/votes/${s.slug}` : null;
      const titleHtml = link
        ? `<a href="${link}" style="color: #1e3a5f; text-decoration: none; font-weight: 600;">${title}</a>`
        : `<span style="font-weight: 600;">${title}</span>`;

      return `<tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
          <span class="badge ${badgeClass}">${badgeLabel}</span>
        </td>
        <td style="padding: 8px 0 8px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
          ${titleHtml}
          <br /><span style="font-size: 12px; color: #6b7280;">${escapeHtml(s.chamber)} · Pour/Contre/Abst: ${ratio}</span>
        </td>
      </tr>`;
    })
    .join("");

  const summary =
    recap.votes.adopted > 0 || recap.votes.rejected > 0
      ? `<p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">${recap.votes.adopted} adopté${recap.votes.adopted > 1 ? "s" : ""}, ${recap.votes.rejected} rejeté${recap.votes.rejected > 1 ? "s" : ""} sur ${recap.votes.total} scrutin${recap.votes.total > 1 ? "s" : ""}</p>`
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">${rows}</table>${summary}`;
}

function buildAffairsHtml(recap: WeeklyRecapData): string {
  const top5 = recap.affairs.newAffairs.slice(0, 5);
  if (top5.length === 0) return "";

  const rows = top5
    .map((a) => {
      const color = SEVERITY_COLORS[a.severity] ?? "#6b7280";
      const label = SEVERITY_LABELS[a.severity] ?? a.severity;
      const title = escapeHtml(a.title);
      const politician = escapeHtml(a.politicianName);
      const affairUrl = `${SITE_URL}/affaires/${a.slug}`;
      const politicianUrl = `${SITE_URL}/politiques/${a.politicianSlug}`;

      return `<div style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="color: ${color}; font-weight: 600; font-size: 11px; text-transform: uppercase;">${escapeHtml(label)}</span>
        <br /><a href="${affairUrl}" style="color: #1e3a5f; text-decoration: none; font-weight: 600;">${title}</a>
        <br /><span style="font-size: 12px; color: #6b7280;">Impliquant <a href="${politicianUrl}" style="color: #1e3a5f;">${politician}</a></span>
      </div>`;
    })
    .join("");

  return rows;
}

function buildFactChecksHtml(recap: WeeklyRecapData): string {
  const fc = recap.factChecks;
  if (fc.total === 0) return "";

  const countsHtml = `<div style="padding: 8px 0;">
    <span style="color: #166534; font-weight: 600;">${fc.trueCount} vrai${fc.trueCount > 1 ? "s" : ""}</span> ·
    <span style="color: #991b1b; font-weight: 600;">${fc.falseCount} faux</span> ·
    <span style="color: #92400e; font-weight: 600;">${fc.mixedCount} mitigé${fc.mixedCount > 1 ? "s" : ""}</span>
    <span style="font-size: 13px; color: #6b7280;"> sur ${fc.total} vérification${fc.total > 1 ? "s" : ""} cette semaine</span>
  </div>`;

  const topClaimant = fc.topPoliticians[0];
  const claimantHtml = topClaimant
    ? `<div style="padding: 8px 0; border-top: 1px solid #f3f4f6;">
        <span style="font-size: 13px; color: #6b7280;">Le plus vérifié :</span>
        <a href="${SITE_URL}/politiques/${topClaimant.slug}" style="color: #1e3a5f; text-decoration: none; font-weight: 600;"> ${escapeHtml(topClaimant.fullName)}</a>
        <span style="font-size: 13px; color: #6b7280;"> (${topClaimant.count} vérification${topClaimant.count > 1 ? "s" : ""})</span>
      </div>`
    : "";

  return countsHtml + claimantHtml;
}

function buildPressHtml(recap: WeeklyRecapData): string {
  const press = recap.press;
  if (press.articleCount === 0) return "";

  const countHtml = `<div style="padding: 8px 0;">
    <span style="font-weight: 600; color: #1e3a5f;">${press.articleCount} article${press.articleCount > 1 ? "s" : ""}</span>
    <span style="font-size: 13px; color: #6b7280;"> couverts cette semaine</span>
  </div>`;

  const top3 = press.topPoliticians.slice(0, 3);
  const mentionsHtml =
    top3.length > 0
      ? `<div style="padding: 8px 0; border-top: 1px solid #f3f4f6;">
          <span style="font-size: 13px; color: #6b7280;">Les plus cités :</span>
          ${top3
            .map(
              (p) =>
                `<a href="${SITE_URL}/politiques/${p.slug}" style="color: #1e3a5f; text-decoration: none; font-weight: 600;"> ${escapeHtml(p.fullName)}</a><span style="font-size: 12px; color: #9ca3af;"> (${p.count})</span>`
            )
            .join(" · ")}
        </div>`
      : "";

  return countHtml + mentionsHtml;
}

// ---------------------------------------------------------------------------
// Template processing
// ---------------------------------------------------------------------------

function processConditionals(
  template: string,
  replacements: Record<string, string | boolean>
): string {
  return template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key: string, content: string) => {
      return replacements[key] ? content : "";
    }
  );
}

function replacePlaceholders(template: string, replacements: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return replacements[key] ?? "";
  });
}

// ---------------------------------------------------------------------------
// Plain text generation
// ---------------------------------------------------------------------------

function buildPlainText(input: RenderInput): string {
  const { recap, editorialIntro, politician } = input;
  const weekNum = getISOWeekNumber(recap.weekStart);
  const year = recap.weekStart.getUTCFullYear();
  const lines: string[] = [];

  lines.push(`ALERTE VOTE — Semaine ${weekNum} (${year})`);
  lines.push(`Du ${formatDateShort(recap.weekStart)} au ${formatDateShort(recap.weekEnd)}`);
  lines.push("");
  lines.push(
    `${recap.votes.total} scrutins · ${recap.press.articleCount} articles · ${recap.affairs.total} affaires · ${recap.factChecks.total} fact-checks`
  );
  lines.push("");
  lines.push(editorialIntro);
  lines.push("");

  // Votes
  if (recap.votes.scrutins.length > 0) {
    lines.push("--- VOTES DE LA SEMAINE ---");
    for (const s of recap.votes.scrutins.slice(0, 5)) {
      const status = s.result === "ADOPTED" ? "Adopté" : "Rejeté";
      lines.push(`[${status}] ${s.title}`);
      lines.push(
        `  ${s.chamber} · Pour: ${s.votesFor} / Contre: ${s.votesAgainst} / Abst: ${s.votesAbstain}`
      );
      if (s.slug) {
        lines.push(`  ${SITE_URL}/votes/${s.slug}`);
      }
    }
    lines.push("");
  }

  // Affairs
  if (recap.affairs.newAffairs.length > 0) {
    lines.push("--- AFFAIRES JUDICIAIRES ---");
    for (const a of recap.affairs.newAffairs.slice(0, 5)) {
      const label = SEVERITY_LABELS[a.severity] ?? a.severity;
      lines.push(`[${label}] ${a.title}`);
      lines.push(`  Impliquant ${a.politicianName}`);
      lines.push(`  ${SITE_URL}/affaires/${a.slug}`);
    }
    lines.push("");
  }

  // Fact-checks
  if (recap.factChecks.total > 0) {
    lines.push("--- FACT-CHECKING ---");
    lines.push(
      `${recap.factChecks.trueCount} vrais · ${recap.factChecks.falseCount} faux · ${recap.factChecks.mixedCount} mitigés`
    );
    const top = recap.factChecks.topPoliticians[0];
    if (top) {
      lines.push(`Le plus vérifié : ${top.fullName} (${top.count})`);
    }
    lines.push("");
  }

  // Press
  if (recap.press.articleCount > 0) {
    lines.push("--- REVUE DE PRESSE ---");
    lines.push(`${recap.press.articleCount} articles couverts`);
    const top3 = recap.press.topPoliticians.slice(0, 3);
    if (top3.length > 0) {
      lines.push(`Les plus cités : ${top3.map((p) => `${p.fullName} (${p.count})`).join(", ")}`);
    }
    lines.push("");
  }

  // Politician of the week
  if (politician) {
    lines.push("--- POLITICIEN DE LA SEMAINE ---");
    lines.push(politician.fullName);
    if (politician.mandateTitle || politician.partyShortName) {
      lines.push([politician.mandateTitle, politician.partyShortName].filter(Boolean).join(" · "));
    }
    lines.push(politician.bio);
    lines.push(`${SITE_URL}/politiques/${politician.slug}`);
    lines.push("");
  }

  lines.push(`Récap complet : ${SITE_URL}/recap`);
  lines.push("");
  lines.push("Se désabonner : [[UNSUB_LINK_EN]]");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderNewsletterHtml(input: RenderInput): { html: string; text: string } {
  const { recap, editorialIntro, politician } = input;
  const weekNum = getISOWeekNumber(recap.weekStart);
  const year = recap.weekStart.getUTCFullYear();

  // Read MJML template
  const templatePath = join(__dirname, "templates", "weekly-recap.mjml");
  const mjmlTemplate = readFileSync(templatePath, "utf-8");

  // Build section HTML
  const votesHtml = buildVotesHtml(recap);
  const affairsHtml = buildAffairsHtml(recap);
  const factChecksHtml = buildFactChecksHtml(recap);
  const pressHtml = buildPressHtml(recap);

  // Build politician section data
  const politicianPhoto = politician?.photoUrl ?? DEFAULT_PHOTO;
  const politicianName = politician ? escapeHtml(politician.fullName) : "";
  const politicianMandate = politician?.mandateTitle ? escapeHtml(politician.mandateTitle) : "";
  const politicianParty = politician?.partyShortName ? escapeHtml(politician.partyShortName) : "";
  const politicianBio = politician ? escapeHtml(politician.bio) : "";
  const politicianUrl = politician ? `${SITE_URL}/politiques/${politician.slug}` : "";

  // Conditional flags
  const conditionals: Record<string, string | boolean> = {
    hasVotes: recap.votes.scrutins.length > 0,
    hasAffairs: recap.affairs.newAffairs.length > 0,
    hasFactChecks: recap.factChecks.total > 0,
    hasPress: recap.press.articleCount > 0,
    hasPolitician: politician !== null,
  };

  // All replacements
  const replacements: Record<string, string> = {
    weekLabel: `Semaine ${weekNum} — Du ${formatDateShort(recap.weekStart)} au ${formatDateShort(recap.weekEnd)} ${year}`,
    totalScrutins: String(recap.votes.total),
    totalArticles: String(recap.press.articleCount),
    totalAffairs: String(recap.affairs.total),
    totalFactChecks: String(recap.factChecks.total),
    editorialIntro: escapeHtml(editorialIntro),
    votesHtml,
    affairsHtml,
    factChecksHtml,
    pressHtml,
    politicianPhoto,
    politicianName,
    politicianMandate,
    politicianParty,
    politicianBio,
    politicianUrl,
    recapUrl: `${SITE_URL}/recap`,
    unsubscribeUrl: "[[UNSUB_LINK_EN]]",
  };

  // Process template
  let processed = processConditionals(mjmlTemplate, conditionals);
  processed = replacePlaceholders(processed, replacements);

  // Compile MJML to HTML
  const { html, errors } = mjml2html(processed, {
    validationLevel: "soft",
    minify: true,
  });

  if (errors.length > 0) {
    console.warn(
      "[render-recap] MJML warnings:",
      errors.map((e) => e.formattedMessage)
    );
  }

  // Generate plain text
  const text = buildPlainText(input);

  return { html, text };
}
