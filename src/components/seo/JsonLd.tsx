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
