import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export const getFeatureFlags = unstable_cache(
  async () => {
    const flags = await db.featureFlag.findMany();
    const now = new Date();
    return flags.reduce(
      (acc, flag) => {
        let enabled = flag.enabled;
        if (flag.startDate && now < flag.startDate) enabled = false;
        if (flag.endDate && now > flag.endDate) enabled = false;
        acc[flag.name] = { enabled, value: flag.value };
        return acc;
      },
      {} as Record<string, { enabled: boolean; value: unknown }>
    );
  },
  ["feature-flags"],
  { revalidate: 60, tags: ["feature-flags"] }
);

export async function isFeatureEnabled(name: string): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[name]?.enabled ?? false;
}

export async function getFeatureValue<T = unknown>(name: string): Promise<T | null> {
  const flags = await getFeatureFlags();
  return (flags[name]?.value as T) ?? null;
}

/**
 * Returns a Set of enabled feature flag names.
 * Used by navigation components to filter items in a single DB call.
 */
export async function getEnabledFlags(): Promise<Set<string>> {
  const flags = await getFeatureFlags();
  return new Set(
    Object.entries(flags)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k)
  );
}
