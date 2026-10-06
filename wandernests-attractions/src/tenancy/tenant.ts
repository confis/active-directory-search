/**
 * Tenant resolution: which "app" is the request for?
 *
 *   wandernests.app / www.wandernests.app  → public consumer app
 *   <agency>.wandernests.app               → white-label app of a travel agency (e.g. shasha, rimon)
 *
 * Agency apps must not surface aggregator (Viator / GYG / Klook / Tiqets) affiliate offers:
 * the traveller is the agency's customer, and recommendations should come from the agency.
 * Until agencies have a catalog/API, agency tenants get no recommendations at all.
 */

export type Tenant =
  | { kind: 'public' }
  | { kind: 'agency'; slug: string }
  /** Unrecognised host (preview deploys, raw IPs, reserved subdomains...). Treated as fail-closed. */
  | { kind: 'unknown'; host: string };

export type RecommendationMode =
  /** Aggregator affiliate engine (public app only by default). */
  | 'affiliate'
  /** No recommendations rendered or fetched. */
  | 'none';
// Planned once agencies expose inventory:
//   | 'agency_catalog'    — agency's own products via an AgencyCatalogAdapter
//   | 'agency_affiliate'  — aggregator inventory under the agency's own affiliate IDs

export interface TenancyConfig {
  /** e.g. "wandernests.app" */
  rootDomain: string;
  /** Hosts that serve the public consumer app. */
  publicHosts: string[];
  /** Subdomains of rootDomain that are infrastructure, never agencies (api, admin, staging...). */
  reservedSubdomains: string[];
  /** Per-agency override. Absent ⇒ 'none'. Lets a specific agency opt in later without a deploy. */
  agencyModes?: Record<string, RecommendationMode>;
}

export function tenancyConfigFromEnv(env: Record<string, string | undefined> = process.env): TenancyConfig {
  const list = (v: string | undefined, fallback: string) =>
    (v ?? fallback).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const rootDomain = (env.WN_ROOT_DOMAIN ?? 'wandernests.app').toLowerCase();
  return {
    rootDomain,
    publicHosts: list(env.WN_PUBLIC_HOSTS, `${rootDomain},www.${rootDomain}`),
    reservedSubdomains: list(env.WN_RESERVED_SUBDOMAINS, 'biz,admin,wandernests-admin,api,staging,dev,mail,cdn,static,assets'),
    agencyModes: env.WN_AGENCY_RECOMMENDATION_MODES ? JSON.parse(env.WN_AGENCY_RECOMMENDATION_MODES) : undefined,
  };
}

/** Lowercase, strip port and trailing dot: "Shasha.WanderNests.app:443." → "shasha.wandernests.app". */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

const AGENCY_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function resolveTenant(rawHost: string | undefined, config: TenancyConfig): Tenant {
  const host = normalizeHost(rawHost ?? '');
  if (config.publicHosts.includes(host)) return { kind: 'public' };

  const suffix = `.${config.rootDomain}`;
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length);
    // Single label only: "shasha.wandernests.app" yes, "x.shasha.wandernests.app" no.
    if (AGENCY_SLUG.test(sub) && !config.reservedSubdomains.includes(sub)) return { kind: 'agency', slug: sub };
  }
  return { kind: 'unknown', host };
}

export function recommendationModeFor(tenant: Tenant, config: TenancyConfig): RecommendationMode {
  switch (tenant.kind) {
    case 'public':
      return 'affiliate';
    case 'agency':
      return config.agencyModes?.[tenant.slug] ?? 'none';
    case 'unknown':
      return 'none';
  }
}
