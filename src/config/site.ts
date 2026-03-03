export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

export const SITE_HOSTNAME = new URL(SITE_URL).hostname;

export const USER_AGENT = `Poligraph/1.0 (${SITE_URL})`;
