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
