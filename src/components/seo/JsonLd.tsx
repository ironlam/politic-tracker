/**
 * JSON-LD structured data components for SEO
 * @see https://schema.org
 */

interface PersonJsonLdProps {
  name: string;
  givenName?: string;
  familyName?: string;
  jobTitle?: string;
  affiliation?: string;
  image?: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  url: string;
  sameAs?: string[];
}

export function PersonJsonLd({
  name,
  givenName,
  familyName,
  jobTitle,
  affiliation,
  image,
  birthDate,
  deathDate,
  birthPlace,
  url,
  sameAs,
}: PersonJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    ...(givenName && { givenName }),
    ...(familyName && { familyName }),
    ...(jobTitle && { jobTitle }),
    ...(affiliation && {
      affiliation: {
        "@type": "PoliticalParty",
        name: affiliation,
      },
    }),
    ...(image && { image }),
    ...(birthDate && { birthDate }),
    ...(deathDate && { deathDate }),
    ...(birthPlace && {
      birthPlace: {
        "@type": "Place",
        name: birthPlace,
      },
    }),
    url,
    ...(sameAs && sameAs.length > 0 && { sameAs }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface OrganizationJsonLdProps {
  name: string;
  alternateName?: string;
  description?: string;
  logo?: string;
  url: string;
  foundingDate?: string;
  dissolutionDate?: string;
  sameAs?: string[];
}

export function OrganizationJsonLd({
  name,
  alternateName,
  description,
  logo,
  url,
  foundingDate,
  dissolutionDate,
  sameAs,
}: OrganizationJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "PoliticalParty",
    name,
    ...(alternateName && { alternateName }),
    ...(description && { description }),
    ...(logo && { logo }),
    url,
    ...(foundingDate && { foundingDate }),
    ...(dissolutionDate && { dissolutionDate }),
    ...(sameAs && sameAs.length > 0 && { sameAs }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface WebSiteJsonLdProps {
  name: string;
  description: string;
  url: string;
}

export function WebSiteJsonLd({ name, description, url }: WebSiteJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    description,
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/politiques?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface BreadcrumbJsonLdProps {
  items: Array<{
    name: string;
    url: string;
  }>;
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface FAQJsonLdProps {
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

export function FAQJsonLd({ questions }: FAQJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface ItemListJsonLdProps {
  name: string;
  description?: string;
  items: Array<{
    name: string;
    url: string;
    image?: string;
    position?: number;
  }>;
  url: string;
}

export function ItemListJsonLd({ name, description, items, url }: ItemListJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    ...(description && { description }),
    url,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: item.position || index + 1,
      item: {
        "@type": "Person",
        name: item.name,
        url: item.url,
        ...(item.image && { image: item.image }),
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface EventJsonLdProps {
  name: string;
  description?: string;
  startDate: string;
  location?: string;
  url: string;
  organizer?: string;
}

export function EventJsonLd({
  name,
  description,
  startDate,
  location,
  url,
  organizer,
}: EventJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name,
    ...(description && { description }),
    startDate,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    ...(location && {
      location: {
        "@type": "Place",
        name: location,
      },
    }),
    url,
    ...(organizer && {
      organizer: {
        "@type": "Organization",
        name: organizer,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface LegislationJsonLdProps {
  name: string;
  description?: string;
  datePublished?: string;
  legislationIdentifier?: string;
  url: string;
}

export function LegislationJsonLd({
  name,
  description,
  datePublished,
  legislationIdentifier,
  url,
}: LegislationJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Legislation",
    name,
    ...(description && { description }),
    ...(datePublished && { datePublished }),
    ...(legislationIdentifier && { legislationIdentifier }),
    url,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface ArticleJsonLdProps {
  headline: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  url: string;
  about?: {
    name: string;
    url: string;
  };
}

export function ArticleJsonLd({
  headline,
  description,
  datePublished,
  dateModified,
  url,
  about,
}: ArticleJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    ...(description && { description }),
    ...(datePublished && { datePublished }),
    ...(dateModified && { dateModified }),
    url,
    ...(about && {
      about: {
        "@type": "Person",
        name: about.name,
        url: about.url,
      },
    }),
    publisher: {
      "@type": "Organization",
      name: "Poligraph",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ─── ClaimReview (Fact-check) ─────────────────────────────────

type FactCheckRatingValue =
  | "TRUE"
  | "MOSTLY_TRUE"
  | "HALF_TRUE"
  | "MISLEADING"
  | "OUT_OF_CONTEXT"
  | "MOSTLY_FALSE"
  | "FALSE"
  | "UNVERIFIABLE";

const VERDICT_RATING_VALUE: Record<FactCheckRatingValue, number> = {
  FALSE: 1,
  MOSTLY_FALSE: 2,
  MISLEADING: 2,
  OUT_OF_CONTEXT: 3,
  HALF_TRUE: 3,
  MOSTLY_TRUE: 4,
  TRUE: 5,
  UNVERIFIABLE: 3,
};

interface ClaimReviewJsonLdProps {
  url: string;
  claimText: string;
  claimant?: string | null;
  verdict: string;
  verdictRating: FactCheckRatingValue;
  reviewDate: string;
  source: string;
  sourceUrl: string;
}

export function ClaimReviewJsonLd({
  url,
  claimText,
  claimant,
  verdict,
  verdictRating,
  reviewDate,
  source,
  sourceUrl,
}: ClaimReviewJsonLdProps) {
  const ratingValue = VERDICT_RATING_VALUE[verdictRating];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    url,
    claimReviewed: claimText,
    ...(claimant && {
      itemReviewed: {
        "@type": "Claim",
        author: {
          "@type": "Person",
          name: claimant,
        },
      },
    }),
    reviewRating: {
      "@type": "Rating",
      ratingValue,
      bestRating: 5,
      worstRating: 1,
      alternateName: verdict,
    },
    datePublished: reviewDate,
    author: {
      "@type": "Organization",
      name: source,
      url: sourceUrl,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface GovernmentOrganizationJsonLdProps {
  name: string;
  alternateName?: string;
  description?: string;
  url: string;
  logo?: string;
  address?: string;
}

export function GovernmentOrganizationJsonLd({
  name,
  alternateName,
  description,
  url,
  logo,
  address,
}: GovernmentOrganizationJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentOrganization",
    name,
    ...(alternateName && { alternateName }),
    ...(description && { description }),
    url,
    ...(logo && { logo }),
    ...(address && {
      address: {
        "@type": "PostalAddress",
        addressCountry: "FR",
        addressLocality: address,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface CollectionPageJsonLdProps {
  name: string;
  description: string;
  url: string;
  numberOfItems: number;
  about?: {
    name: string;
    url: string;
  };
}

export function CollectionPageJsonLd({
  name,
  description,
  url,
  numberOfItems,
  about,
}: CollectionPageJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems,
    },
    ...(about && {
      about: {
        "@type": "Organization",
        name: about.name,
        url: about.url,
      },
    }),
    publisher: {
      "@type": "Organization",
      name: "Poligraph",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
