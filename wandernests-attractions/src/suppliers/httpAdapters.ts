import type { Activity, ActivityCategory, SupplierId, SupplierSearchQuery } from '../types';
import { SupplierError, type SupplierAdapter } from './SupplierAdapter';

/**
 * Thin, declarative HTTP adapters. Each partner is described by a spec that
 * (a) builds the request and (b) maps the JSON payload into the normalized Activity.
 *
 * Request/response shapes follow each partner's public partner-API documentation.
 * They MUST be verified against sandbox credentials before go-live — field names
 * change between API versions, and that risk is isolated to the mappers below.
 */
interface HttpSpec {
  id: SupplierId;
  buildRequest(q: SupplierSearchQuery, apiKey: string): { url: string; init: RequestInit };
  mapResponse(json: unknown, q: SupplierSearchQuery): Activity[];
}

type Json = Record<string, any>;
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
/** Missing fields become '' (not "undefined") so the empty-URL/title filter below drops them. */
const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function inferCategory(title: string): ActivityCategory {
  const t = title.toLowerCase();
  if (/museum|gallery|exhibition/.test(t)) return 'museum';
  if (/ticket|entry|admission|skip[- ]the[- ]line|pass\b/.test(t)) return 'attraction_ticket';
  if (/day trip|excursion/.test(t)) return 'day_trip';
  if (/food|tasting|cooking|wine/.test(t)) return 'food';
  if (/hike|kayak|snorkel|dive|bike/.test(t)) return 'outdoor';
  if (/transfer|airport|rail pass|jr pass/.test(t)) return 'transport';
  if (/tour/.test(t)) return 'tour';
  return 'other';
}
const isSkipTheLine = (title: string) => /skip[- ]the[- ]line|priority|fast[- ]?track|timed entry|reserved entry/i.test(title);

function searchText(q: SupplierSearchQuery): string {
  return q.text ?? `${q.location.city} things to do`;
}

const viatorSpec: HttpSpec = {
  id: 'viator',
  buildRequest: (q, apiKey) => ({
    url: 'https://api.viator.com/partner/search/freetext',
    init: {
      method: 'POST',
      headers: {
        'exp-api-key': apiKey,
        Accept: 'application/json;version=2.0',
        'Accept-Language': q.locale,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchTerm: q.text ?? q.location.city,
        currency: q.currency,
        searchTypes: [{ searchType: 'PRODUCTS', pagination: { start: 1, count: q.limit } }],
        productFiltering: { dateRange: { from: q.date, to: q.date } },
      }),
    },
  }),
  mapResponse: (json) =>
    arr((json as Json)?.products?.results).map((p): Activity => ({
      supplier: 'viator',
      supplierProductId: str(p.productCode),
      title: str(p.title),
      imageUrl: arr(arr(p.images)[0]?.variants).at(-1)?.url,
      price: num(p.pricing?.summary?.fromPrice) !== undefined
        ? { amount: p.pricing.summary.fromPrice, currency: p.pricing.currency } : undefined,
      rating: num(p.reviews?.combinedAverageRating) !== undefined
        ? { average: p.reviews.combinedAverageRating, count: p.reviews.totalReviews ?? 0 } : undefined,
      durationMinutes: num(p.duration?.fixedDurationInMinutes),
      category: inferCategory(str(p.title)),
      flags: {
        skipTheLine: arr(p.flags).includes('SKIP_THE_LINE') || isSkipTheLine(str(p.title)),
        freeCancellation: arr(p.flags).includes('FREE_CANCELLATION'),
      },
      productUrl: str(p.productUrl),
    })),
};

const gygSpec: HttpSpec = {
  id: 'getyourguide',
  buildRequest: (q, apiKey) => {
    const params = new URLSearchParams({
      q: searchText(q),
      cnt_language: q.locale.split('-')[0],
      currency: q.currency,
      date: `${q.date}T00:00:00`,
      limit: str(q.limit),
    });
    return {
      url: `https://api.getyourguide.com/1/tours?${params}`,
      init: { headers: { 'X-ACCESS-TOKEN': apiKey, Accept: 'application/json' } },
    };
  },
  mapResponse: (json) =>
    arr((json as Json)?.data?.tours).map((t): Activity => ({
      supplier: 'getyourguide',
      supplierProductId: str(t.tour_id),
      title: str(t.title),
      imageUrl: arr(t.pictures)[0]?.url?.replace('[format_id]', '91'),
      price: num(t.price?.values?.amount) !== undefined
        ? { amount: t.price.values.amount, currency: t.price.currency ?? 'EUR' } : undefined,
      rating: num(t.overall_rating) !== undefined ? { average: t.overall_rating, count: t.number_of_ratings ?? 0 } : undefined,
      durationMinutes: num(arr(t.durations)[0]?.duration) && arr(t.durations)[0].unit === 'hour'
        ? arr(t.durations)[0].duration * 60 : undefined,
      category: inferCategory(str(t.title)),
      flags: { skipTheLine: isSkipTheLine(str(t.title)), freeCancellation: Boolean(t.free_cancellation) },
      productUrl: str(t.url),
    })),
};

const klookSpec: HttpSpec = {
  id: 'klook',
  buildRequest: (q, apiKey) => {
    const params = new URLSearchParams({
      keyword: searchText(q),
      country_code: q.location.countryCode,
      currency: q.currency,
      lang: q.locale,
      date: q.date,
      limit: str(q.limit),
    });
    return {
      // Klook affiliate API access is granted per partner; base URL is configurable.
      url: `${process.env.KLOOK_API_BASE ?? 'https://affiliate-api.klook.com'}/v1/activities/search?${params}`,
      init: { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } },
    };
  },
  mapResponse: (json) =>
    arr((json as Json)?.result?.activities).map((a): Activity => ({
      supplier: 'klook',
      supplierProductId: str(a.activity_id),
      title: str(a.title),
      imageUrl: a.cover_image_url,
      price: num(a.from_price) !== undefined ? { amount: a.from_price, currency: a.currency } : undefined,
      rating: num(a.review_score) !== undefined ? { average: a.review_score, count: a.review_count ?? 0 } : undefined,
      category: inferCategory(str(a.title)),
      flags: { skipTheLine: isSkipTheLine(str(a.title)), instantConfirmation: Boolean(a.instant_confirmation) },
      productUrl: str(a.deeplink ?? (a.activity_id ? `https://www.klook.com/activity/${a.activity_id}/` : '')),
    })),
};

const tiqetsSpec: HttpSpec = {
  id: 'tiqets',
  buildRequest: (q, apiKey) => {
    const params = new URLSearchParams({
      query: searchText(q),
      lang: q.locale.split('-')[0],
      currency: q.currency,
      page_size: str(q.limit),
    });
    return {
      url: `https://api.tiqets.com/v2/products?${params}`,
      init: { headers: { Authorization: `Token ${apiKey}`, Accept: 'application/json' } },
    };
  },
  mapResponse: (json) =>
    arr((json as Json)?.products).map((p): Activity => ({
      supplier: 'tiqets',
      supplierProductId: str(p.id),
      title: str(p.title),
      imageUrl: arr(p.images)[0]?.medium,
      price: num(p.price) !== undefined ? { amount: p.price, currency: p.currency } : undefined,
      rating: num(p.ratings?.average) !== undefined ? { average: p.ratings.average, count: p.ratings.total ?? 0 } : undefined,
      category: 'attraction_ticket',
      // Tiqets sells timed/instant entry tickets; every product is a direct-entry ticket.
      flags: { skipTheLine: true, instantConfirmation: true },
      productUrl: str(p.product_url),
    })),
};

export const HTTP_SPECS: Record<SupplierId, HttpSpec> = {
  viator: viatorSpec,
  getyourguide: gygSpec,
  klook: klookSpec,
  tiqets: tiqetsSpec,
};

export function createHttpAdapter(
  id: SupplierId,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): SupplierAdapter {
  const spec = HTTP_SPECS[id];
  return {
    id,
    async search(query, signal) {
      const { url, init } = spec.buildRequest(query, apiKey);
      const res = await fetchImpl(url, { ...init, signal });
      if (!res.ok) throw new SupplierError(id, `HTTP ${res.status}`, res.status);
      return spec.mapResponse(await res.json(), query).filter((a) => a.productUrl && a.title);
    },
  };
}
