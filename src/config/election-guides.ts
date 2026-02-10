import type { ElectionType } from "@/generated/prisma";

export interface ElectionGuideSection {
  title: string;
  icon: string;
  content: string;
}

/**
 * Practical guide content per election type.
 * Displayed on election detail pages when FEATURES.ELECTION_GUIDE_SECTION is enabled.
 */
export const ELECTION_GUIDES: Partial<Record<ElectionType, ElectionGuideSection[]>> = {
  MUNICIPALES: [
    {
      title: "Comment ça marche ?",
      icon: "🗳️",
      content:
        "Les conseillers municipaux sont élus au scrutin de liste à deux tours. " +
        "Dans les communes de 1 000 habitants et plus, les listes doivent être paritaires. " +
        "La liste arrivée en tête au 1er tour avec la majorité absolue, ou en tête au 2nd tour, " +
        "obtient la moitié des sièges (prime majoritaire). Les sièges restants sont répartis à la proportionnelle.",
    },
    {
      title: "Nouveauté 2026",
      icon: "✨",
      content:
        "La loi du 11 avril 2025 étend le scrutin de liste paritaire à toutes les communes, " +
        "y compris celles de moins de 1 000 habitants (auparavant au scrutin majoritaire plurinominal). " +
        "C'est une avancée majeure pour la parité dans les conseils municipaux ruraux.",
    },
    {
      title: "Qui peut voter ?",
      icon: "👤",
      content:
        "Pour voter, il faut avoir 18 ans révolus, être inscrit sur les listes électorales " +
        "et jouir de ses droits civils et politiques. Les citoyens de l'Union européenne résidant " +
        "en France peuvent également voter aux municipales.",
    },
    {
      title: "Comment s'inscrire ?",
      icon: "📋",
      content:
        "L'inscription est possible en ligne sur service-public.fr, en mairie ou par courrier. " +
        "La date limite d'inscription est fixée au 7 février 2026 pour ces municipales. " +
        "Pensez à vérifier votre situation électorale sur le site de l'INSEE.",
    },
  ],
};
