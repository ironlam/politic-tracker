/**
 * HTML parsing utilities
 *
 * Consolidates HTML entity decoding and text extraction used across sync scripts.
 */

/**
 * Named HTML entities mapping
 */
const HTML_ENTITIES: Record<string, string> = {
  // Common entities
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",

  // French accented characters
  "&eacute;": "é",
  "&Eacute;": "É",
  "&egrave;": "è",
  "&Egrave;": "È",
  "&ecirc;": "ê",
  "&Ecirc;": "Ê",
  "&euml;": "ë",
  "&Euml;": "Ë",
  "&agrave;": "à",
  "&Agrave;": "À",
  "&acirc;": "â",
  "&Acirc;": "Â",
  "&icirc;": "î",
  "&Icirc;": "Î",
  "&iuml;": "ï",
  "&Iuml;": "Ï",
  "&ocirc;": "ô",
  "&Ocirc;": "Ô",
  "&ouml;": "ö",
  "&Ouml;": "Ö",
  "&ucirc;": "û",
  "&Ucirc;": "Û",
  "&ugrave;": "ù",
  "&Ugrave;": "Ù",
  "&uuml;": "ü",
  "&Uuml;": "Ü",
  "&ccedil;": "ç",
  "&Ccedil;": "Ç",
  "&oelig;": "œ",
  "&OElig;": "Œ",
  "&aelig;": "æ",
  "&AElig;": "Æ",

  // Special characters
  "&deg;": "°",
  "&euro;": "€",
  "&pound;": "£",
  "&yen;": "¥",
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",

  // Punctuation
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&rdquo;": '"',
  "&ldquo;": '"',
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
  "&bull;": "•",
  "&middot;": "·",
};

/**
 * Decode HTML entities in a string
 *
 * Handles both named entities (&eacute;) and numeric entities (&#233; and &#xE9;)
 *
 * @example
 * decodeHtmlEntities("Fran&ccedil;ois") // "François"
 * decodeHtmlEntities("&#233;lu") // "élu"
 * decodeHtmlEntities("&#x00E9;lu") // "élu"
 */
export function decodeHtmlEntities(html: string): string {
  if (!html) return "";

  let result = html;

  // Replace named entities
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    // Use replace with global regex for ES5 compatibility
    result = result.replace(new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), char);
  }

  // Replace decimal numeric entities: &#233;
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

  // Replace hexadecimal numeric entities: &#x00E9; or &#xE9;
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );

  return result;
}

/**
 * Strip HTML tags from a string
 *
 * @example
 * stripHtml("<p>Hello <b>World</b></p>") // "Hello World"
 * stripHtml("<a href='url'>Link</a>") // "Link"
 */
export function stripHtml(html: string): string {
  if (!html) return "";

  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove styles
    .replace(/<[^>]+>/g, "") // Remove all tags
    .trim();
}

/**
 * Normalize whitespace in a string
 *
 * Replaces multiple spaces, tabs, newlines with single spaces
 *
 * @example
 * normalizeWhitespace("Hello   World\n\nTest") // "Hello World Test"
 */
export function normalizeWhitespace(text: string): string {
  if (!text) return "";

  return text
    .replace(/[\r\n\t]+/g, " ") // Replace newlines and tabs with spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * Extract text content from HTML, cleaning entities and whitespace
 *
 * Combines stripHtml, decodeHtmlEntities, and normalizeWhitespace
 *
 * @example
 * extractText("<p>Fran&ccedil;ois   Hollande</p>") // "François Hollande"
 */
export function extractText(html: string): string {
  if (!html) return "";

  return normalizeWhitespace(decodeHtmlEntities(stripHtml(html)));
}

/**
 * Extract a specific attribute value from an HTML element
 *
 * @example
 * extractAttribute('<a href="https://example.com">Link</a>', "href") // "https://example.com"
 * extractAttribute('<img src="photo.jpg" alt="Photo">', "src") // "photo.jpg"
 */
export function extractAttribute(html: string, attribute: string): string | null {
  if (!html || !attribute) return null;

  // Match both single and double quoted attribute values
  const pattern = new RegExp(`${attribute}=["']([^"']+)["']`, "i");
  const match = html.match(pattern);

  return match ? match[1] : null;
}

/**
 * Check if a string contains HTML tags
 *
 * @example
 * containsHtml("<p>Hello</p>") // true
 * containsHtml("Hello World") // false
 */
export function containsHtml(text: string): boolean {
  if (!text) return false;
  return /<[a-z][\s\S]*>/i.test(text);
}
