/**
 * Shared domain types for the WanderNests Attractions Recommendation & Affiliate Engine.
 */

export type SupplierId = 'klook' | 'viator' | 'getyourguide' | 'tiqets';

/** Commercial macro-regions used for supplier routing (not strict geography). */
export type MacroRegion = 'ASIA_PACIFIC' | 'EUROPE' | 'AMERICAS' | 'MIDDLE_EAST_AFRICA' | 'UNKNOWN';

export interface GeoLocation {
  city: string;
  /** ISO 3166-1 alpha-2, e.g. "FR", "JP". */
  countryCode: string;
  lat?: number;
  lng?: number;
}

export interface ItineraryItem {
  id: string;
  title: string;
  /** Free-form place type from the itinerary editor / Places API ("museum", "restaurant", ...). */
  placeType?: string;
  /** Google/Mapbox place id, if the item was added via place search. */
  placeId?: string;
}

export interface ItineraryDay {
  /** ISO date (YYYY-MM-DD) in the destination's local calendar. */
  date: string;
  dayIndex: number;
  location: GeoLocation;
  items: ItineraryItem[];
}

export interface Trip {
  id: string;
  userId: string;
  /** Owning agency (trips.org_id). Null/undefined for a personal consumer trip. */
  orgId?: string | null;
  currency: string;
  locale: string;
  days: ItineraryDay[];
}

export type ActivityCategory =
  | 'tour'
  | 'attraction_ticket'
  | 'museum'
  | 'day_trip'
  | 'food'
  | 'outdoor'
  | 'transport'
  | 'other';

/** Normalized activity returned by every supplier adapter. */
export interface Activity {
  supplier: SupplierId;
  supplierProductId: string;
  title: string;
  imageUrl?: string;
  /** Lowest "from" price in the trip currency, when known. */
  price?: { amount: number; currency: string };
  rating?: { average: number; count: number };
  durationMinutes?: number;
  category: ActivityCategory;
  flags: {
    skipTheLine?: boolean;
    freeCancellation?: boolean;
    instantConfirmation?: boolean;
  };
  /** Supplier product URL WITHOUT affiliate parameters. The engine decorates it. */
  productUrl: string;
}

/** Activity after the engine has applied ranking + affiliate tracking. */
export interface RecommendedActivity extends Activity {
  /** Final outbound URL with affiliate + sub-ID parameters. Always use this for CTAs. */
  bookingUrl: string;
  /** True when this card came from the fallback supplier rather than the regional primary. */
  isFallback: boolean;
}

export interface SupplierSearchQuery {
  location: GeoLocation;
  date: string;
  currency: string;
  locale: string;
  /** Free text, e.g. a landmark name ("Louvre Museum skip the line"). */
  text?: string;
  categories?: ActivityCategory[];
  limit: number;
}

/** Context used to generate conversion-tracking sub-IDs. */
export interface TrackingContext {
  userId: string;
  tripId: string;
  dayIndex: number;
  /** UI surface that produced the click: day list vs. landmark widget, etc. */
  placement: 'day_list' | 'landmark_widget' | 'search';
}
