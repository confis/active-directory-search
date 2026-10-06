import type { AttractionsEngine, DayRecommendations } from '../AttractionsEngine';
import { regionForCountry } from '../geo/regions';
import { recommendationModeFor, resolveTenant, type TenancyConfig } from '../tenancy/tenant';
import type { ItineraryDay, Trip } from '../types';

/**
 * Framework-agnostic controller for:
 *
 *   GET /api/trips/:tripId/days/:dayIndex/recommendations
 *
 * Wire it into Express / Fastify / a Next.js route handler by adapting req/res.
 * Authorization is enforced here (trip must belong to the caller) because the
 * response contains sub-IDs bound to that user's trip.
 *
 * Tenant gating is enforced here too, server-side, so an agency app can't obtain
 * aggregator links by calling the API directly. `host` must come from a trusted
 * source: the Host header, or X-Forwarded-Host only when set by your own proxy.
 */
export interface RecommendationsDeps {
  engine: AttractionsEngine;
  tenancy: TenancyConfig;
  loadTrip(tripId: string): Promise<Trip | undefined>;
}

export type ControllerResult =
  | { status: 200; body: DayRecommendations; headers: Record<string, string> }
  | { status: 400 | 403 | 404; body: { error: string } };

const HEADERS = {
  // Per-user links → private cache only. Supplier data itself is cached server-side.
  'Cache-Control': 'private, max-age=900',
  Vary: 'Host',
};

/** Same shape as a real response, with nothing to show; the UI renders nothing for it. */
function disabledRecommendations(day: ItineraryDay): DayRecommendations {
  return {
    date: day.date,
    dayIndex: day.dayIndex,
    location: day.location,
    region: regionForCountry(day.location.countryCode),
    primarySupplier: undefined,
    suppliersUsed: [],
    fallbackUsed: false,
    activities: [],
    landmarkWidgets: [],
    disclosure: '',
  };
}

export function createRecommendationsController(deps: RecommendationsDeps) {
  return async function handle(params: {
    authUserId: string | undefined;
    host: string | undefined;
    tripId: string;
    dayIndex: string;
  }): Promise<ControllerResult> {
    const dayIndex = Number.parseInt(params.dayIndex, 10);
    if (!Number.isInteger(dayIndex) || dayIndex < 0) return { status: 400, body: { error: 'Invalid day index' } };

    const trip = await deps.loadTrip(params.tripId);
    const day = trip?.days.find((d) => d.dayIndex === dayIndex);
    if (!trip || !day) return { status: 404, body: { error: 'Not found' } };
    if (!params.authUserId || trip.userId !== params.authUserId) return { status: 403, body: { error: 'Forbidden' } };

    const mode = recommendationModeFor(resolveTenant(params.host, deps.tenancy), deps.tenancy);
    if (mode !== 'affiliate') {
      // No supplier calls, no affiliate links, no sub-IDs issued.
      return { status: 200, body: disabledRecommendations(day), headers: HEADERS };
    }

    const body = await deps.engine.getDayRecommendations(trip, dayIndex);
    return { status: 200, body, headers: HEADERS };
  };
}
