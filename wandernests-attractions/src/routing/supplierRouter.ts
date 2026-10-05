import { regionForCountry } from '../geo/regions';
import type { MacroRegion, SupplierId } from '../types';

/** Universal global-coverage supplier, always the last resort. */
export const GLOBAL_FALLBACK_SUPPLIER: SupplierId = 'viator';

/**
 * Regional priority. Europe leads with GetYourGuide (deepest EU inventory),
 * the Americas lead with Viator (deepest NA/LATAM inventory).
 */
export const REGIONAL_PRIORITY: Readonly<Record<MacroRegion, readonly SupplierId[]>> = {
  ASIA_PACIFIC: ['klook'],
  EUROPE: ['getyourguide', 'viator'],
  AMERICAS: ['viator', 'getyourguide'],
  MIDDLE_EAST_AFRICA: ['viator', 'getyourguide'],
  UNKNOWN: ['viator'],
};

export type RoutingIntent =
  /** Generic "things to do" list for a day. */
  | 'general'
  /** Museum / cultural-site entry tickets (e.g. a Louvre itinerary item). */
  | 'cultural_ticket';

export interface RoutingInput {
  countryCode: string;
  intent?: RoutingIntent;
  /** Hard override from the landmark catalog (official/exclusive allocations). */
  preferredSupplier?: SupplierId;
  /** Suppliers disabled by config / kill-switch / circuit breaker. */
  disabledSuppliers?: ReadonlySet<SupplierId>;
}

export interface SupplierRoute {
  region: MacroRegion;
  /** Ordered list to query. Index 0 is the primary; GLOBAL_FALLBACK_SUPPLIER is always present (unless disabled). */
  chain: SupplierId[];
  primary: SupplierId | undefined;
}

/**
 * Pure geo-routing function: destination country (+ intent) → ordered supplier chain.
 *
 *   1. Landmark-level override (if any)
 *   2. Tiqets, for cultural-ticket intent (global)
 *   3. Regional priority list
 *   4. Viator as universal fallback
 *
 * Duplicates are removed keeping the first occurrence; disabled suppliers are skipped.
 */
export function routeSuppliers(input: RoutingInput): SupplierRoute {
  const region = regionForCountry(input.countryCode);
  const disabled = input.disabledSuppliers ?? new Set<SupplierId>();

  const candidates: SupplierId[] = [];
  if (input.preferredSupplier) candidates.push(input.preferredSupplier);
  if (input.intent === 'cultural_ticket') candidates.push('tiqets');
  candidates.push(...REGIONAL_PRIORITY[region]);
  candidates.push(GLOBAL_FALLBACK_SUPPLIER);

  const chain = [...new Set(candidates)].filter((s) => !disabled.has(s));
  return { region, chain, primary: chain[0] };
}
