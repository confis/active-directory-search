import { InMemoryTtlCache, type Cache } from './cache';
import { isCulturalLandmark, matchLandmark, normalize, type Landmark } from './landmarks/landmarkCatalog';
import { routeSuppliers, type RoutingIntent } from './routing/supplierRouter';
import type { SupplierRegistry } from './suppliers/SupplierAdapter';
import { buildSubId, decorateUrl, type AffiliateConfig, type SubIdRecord } from './tracking/affiliateLinks';
import type {
  Activity,
  ItineraryDay,
  ItineraryItem,
  MacroRegion,
  RecommendedActivity,
  SupplierId,
  SupplierSearchQuery,
  TrackingContext,
  Trip,
} from './types';

export const AFFILIATE_DISCLOSURE = 'Booked via trusted partners at no extra cost';

export interface LandmarkWidget {
  itemId: string;
  landmark: Pick<Landmark, 'key' | 'name' | 'city' | 'kind'>;
  offer: RecommendedActivity;
}

export interface DayRecommendations {
  date: string;
  dayIndex: number;
  location: ItineraryDay['location'];
  region: MacroRegion;
  primarySupplier: SupplierId | undefined;
  /** Suppliers that actually contributed results, in order. */
  suppliersUsed: SupplierId[];
  fallbackUsed: boolean;
  activities: RecommendedActivity[];
  landmarkWidgets: LandmarkWidget[];
  disclosure: string;
}

export interface EngineLogger {
  warn(msg: string, meta?: Record<string, unknown>): void;
}

export interface AttractionsEngineOptions {
  suppliers: SupplierRegistry;
  affiliateConfig: AffiliateConfig;
  /** Secret used to derive opaque sub-IDs. Rotate = new sub-IDs (old ones stay resolvable via SubIdRecord). */
  subIdSecret: string;
  /** Persist sub-ID → (user, trip, day) so partner conversion reports can be joined back. */
  onSubIdIssued?: (record: SubIdRecord) => void | Promise<void>;
  cache?: Cache<Activity[]>;
  cacheTtlSeconds?: number;
  /** Per-supplier request budget. A slow partner must never block the day view. */
  supplierTimeoutMs?: number;
  /** Below this many results from a supplier we consider its inventory insufficient and fall through. */
  minResults?: number;
  maxResults?: number;
  disabledSuppliers?: ReadonlySet<SupplierId>;
  logger?: EngineLogger;
  now?: () => Date;
}

export class AttractionsEngine {
  private readonly cache: Cache<Activity[]>;
  private readonly opts: Required<
    Pick<AttractionsEngineOptions, 'cacheTtlSeconds' | 'supplierTimeoutMs' | 'minResults' | 'maxResults'>
  >;

  constructor(private readonly options: AttractionsEngineOptions) {
    this.cache = options.cache ?? new InMemoryTtlCache<Activity[]>();
    this.opts = {
      cacheTtlSeconds: options.cacheTtlSeconds ?? 6 * 60 * 60,
      supplierTimeoutMs: options.supplierTimeoutMs ?? 2500,
      minResults: options.minResults ?? 4,
      maxResults: options.maxResults ?? 10,
    };
  }

  /** Main entry point: recommendations + landmark widgets for one itinerary day. */
  async getDayRecommendations(trip: Trip, dayIndex: number): Promise<DayRecommendations> {
    const day = trip.days.find((d) => d.dayIndex === dayIndex);
    if (!day) throw new Error(`Trip ${trip.id} has no day ${dayIndex}`);

    const route = routeSuppliers({
      countryCode: day.location.countryCode,
      intent: 'general',
      disabledSuppliers: this.options.disabledSuppliers,
    });

    const base: DayRecommendations = {
      date: day.date,
      dayIndex,
      location: day.location,
      region: route.region,
      primarySupplier: route.primary,
      suppliersUsed: [],
      fallbackUsed: false,
      activities: [],
      landmarkWidgets: [],
      disclosure: AFFILIATE_DISCLOSURE,
    };
    if (this.isPast(day.date)) return base;

    const [list, landmarkWidgets] = await Promise.all([
      this.fetchFromChain(route.chain, this.queryFor(trip, day), {
        userId: trip.userId, tripId: trip.id, dayIndex, placement: 'day_list',
      }),
      this.getLandmarkWidgets(trip, day),
    ]);

    // Don't repeat the landmark's ticket in the generic list right below its widget.
    const widgetIds = new Set(landmarkWidgets.map((w) => `${w.offer.supplier}:${w.offer.supplierProductId}`));
    const activities = list.activities.filter((a) => !widgetIds.has(`${a.supplier}:${a.supplierProductId}`));

    return {
      ...base,
      suppliersUsed: list.suppliersUsed,
      fallbackUsed: list.suppliersUsed.some((s) => s !== route.primary),
      activities,
      landmarkWidgets,
    };
  }

  /** Contextual triggers: one "Skip-the-line" offer per recognised landmark on the day. */
  async getLandmarkWidgets(trip: Trip, day: ItineraryDay): Promise<LandmarkWidget[]> {
    const matches = day.items
      .map((item) => ({ item, landmark: matchLandmark(item, day.location.countryCode) }))
      .filter((m): m is { item: ItineraryItem; landmark: Landmark } => Boolean(m.landmark));

    // Same landmark added twice → one widget.
    const unique = [...new Map(matches.map((m) => [m.landmark.key, m])).values()];

    const widgets = await Promise.all(
      unique.map(async ({ item, landmark }) => {
        const intent: RoutingIntent = isCulturalLandmark(landmark) ? 'cultural_ticket' : 'general';
        const route = routeSuppliers({
          countryCode: landmark.countryCode,
          intent,
          preferredSupplier: landmark.preferredSupplier,
          disabledSuppliers: this.options.disabledSuppliers,
        });
        const query: SupplierSearchQuery = {
          ...this.queryFor(trip, day),
          text: landmark.ticketQuery,
          categories: ['attraction_ticket', 'museum'],
          limit: 5,
        };
        const result = await this.fetchFromChain(
          route.chain,
          query,
          { userId: trip.userId, tripId: trip.id, dayIndex: day.dayIndex, placement: 'landmark_widget' },
          { minResults: 1, relevantTo: landmark },
        );
        const offer = pickTicketOffer(result.activities);
        return offer
          ? { itemId: item.id, landmark: { key: landmark.key, name: landmark.name, city: landmark.city, kind: landmark.kind }, offer }
          : undefined;
      }),
    );
    return widgets.filter((w): w is LandmarkWidget => Boolean(w));
  }

  /**
   * Walk the supplier chain in order until we have enough inventory.
   * Supplier errors/timeouts are logged and treated as "no inventory" so the chain
   * naturally falls through to the next supplier and, ultimately, Viator.
   */
  private async fetchFromChain(
    chain: SupplierId[],
    query: SupplierSearchQuery,
    tracking: TrackingContext,
    overrides: { minResults?: number; relevantTo?: Landmark } = {},
  ): Promise<{ activities: RecommendedActivity[]; suppliersUsed: SupplierId[] }> {
    const minResults = overrides.minResults ?? this.opts.minResults;
    const collected: RecommendedActivity[] = [];
    const seenTitles = new Set<string>();
    const suppliersUsed: SupplierId[] = [];
    const sub = buildSubId(tracking, this.options.subIdSecret);

    for (const [i, supplier] of chain.entries()) {
      if (collected.length >= minResults) break;
      const adapter = this.options.suppliers[supplier];
      if (!adapter) continue;

      let results = await this.searchWithCache(supplier, query);
      if (overrides.relevantTo) results = results.filter((a) => isRelevantTo(a, overrides.relevantTo!));

      let contributed = false;
      for (const activity of rank(results)) {
        const key = normalize(activity.title);
        if (seenTitles.has(key)) continue; // same product resold by several suppliers
        let bookingUrl: string;
        try {
          bookingUrl = decorateUrl(supplier, activity.productUrl, sub.subId, this.options.affiliateConfig);
        } catch (err) {
          this.options.logger?.warn('Dropping activity with untrackable URL', { supplier, err: String(err) });
          continue;
        }
        seenTitles.add(key);
        collected.push({ ...activity, bookingUrl, isFallback: i > 0 });
        contributed = true;
      }
      if (contributed) suppliersUsed.push(supplier);
    }

    // Deterministic sub-ID → the sink should upsert; it is called once per chain walk that produced links.
    if (collected.length > 0) await this.options.onSubIdIssued?.(sub);
    return { activities: collected.slice(0, this.opts.maxResults), suppliersUsed };
  }

  private async searchWithCache(supplier: SupplierId, query: SupplierSearchQuery): Promise<Activity[]> {
    const key = [
      'attr', supplier, query.location.countryCode, normalize(query.location.city),
      query.date, query.currency, query.locale, normalize(query.text ?? ''), query.limit,
    ].join('|');
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const adapter = this.options.suppliers[supplier]!;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.supplierTimeoutMs);
    try {
      const results = await adapter.search(query, controller.signal);
      // Only cache non-empty results so a transient empty response doesn't pin the fallback for hours.
      if (results.length > 0) await this.cache.set(key, results, this.opts.cacheTtlSeconds);
      return results;
    } catch (err) {
      this.options.logger?.warn('Supplier search failed; falling through', { supplier, err: String(err) });
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  private queryFor(trip: Trip, day: ItineraryDay): SupplierSearchQuery {
    return {
      location: day.location,
      date: day.date,
      currency: trip.currency,
      locale: trip.locale,
      limit: this.opts.maxResults,
    };
  }

  private isPast(isoDate: string): boolean {
    const today = (this.options.now?.() ?? new Date()).toISOString().slice(0, 10);
    return isoDate < today;
  }
}

/** Popularity-weighted rating; unrated products sink but are not dropped. */
function score(a: Activity): number {
  if (!a.rating) return 0;
  return a.rating.average * Math.log10(a.rating.count + 10);
}

function rank(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => score(b) - score(a));
}

/** Supplier free-text search is fuzzy; require the landmark name (or an alias) in the product title. */
function isRelevantTo(a: Activity, landmark: Landmark): boolean {
  const title = ` ${normalize(a.title)} `;
  return [landmark.name, ...landmark.aliases].some((n) => title.includes(` ${normalize(n)} `));
}

/** Prefer explicit skip-the-line products; otherwise any entry ticket; otherwise the best match. */
function pickTicketOffer(activities: RecommendedActivity[]): RecommendedActivity | undefined {
  return (
    activities.find((a) => a.flags.skipTheLine) ??
    activities.find((a) => a.category === 'attraction_ticket' || a.category === 'museum') ??
    activities[0]
  );
}
