import type { AttractionsEngine, DayRecommendations } from '../AttractionsEngine';
import type { Trip } from '../types';

/**
 * Framework-agnostic controller for:
 *
 *   GET /api/trips/:tripId/days/:dayIndex/recommendations
 *
 * Wire it into Express / Fastify / a Next.js route handler by adapting req/res.
 * Authorization is enforced here (trip must belong to the caller) because the
 * response contains sub-IDs bound to that user's trip.
 */
export interface RecommendationsDeps {
  engine: AttractionsEngine;
  loadTrip(tripId: string): Promise<Trip | undefined>;
}

export type ControllerResult =
  | { status: 200; body: DayRecommendations; headers: Record<string, string> }
  | { status: 400 | 403 | 404; body: { error: string } };

export function createRecommendationsController(deps: RecommendationsDeps) {
  return async function handle(params: {
    authUserId: string | undefined;
    tripId: string;
    dayIndex: string;
  }): Promise<ControllerResult> {
    const dayIndex = Number.parseInt(params.dayIndex, 10);
    if (!Number.isInteger(dayIndex) || dayIndex < 0) return { status: 400, body: { error: 'Invalid day index' } };

    const trip = await deps.loadTrip(params.tripId);
    if (!trip || !trip.days.some((d) => d.dayIndex === dayIndex)) return { status: 404, body: { error: 'Not found' } };
    if (!params.authUserId || trip.userId !== params.authUserId) return { status: 403, body: { error: 'Forbidden' } };

    const body = await deps.engine.getDayRecommendations(trip, dayIndex);
    return {
      status: 200,
      body,
      // Per-user links → private cache only. Supplier data itself is cached server-side.
      headers: { 'Cache-Control': 'private, max-age=900' },
    };
  };
}
