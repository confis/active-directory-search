import type { SupplierAdapter } from '../src/suppliers/SupplierAdapter';
import type { AffiliateConfig } from '../src/tracking/affiliateLinks';
import type { Activity, SupplierId, SupplierSearchQuery, Trip } from '../src/types';

export const affiliateConfig: AffiliateConfig = {
  viator: { staticParams: { pid: 'P00TEST', mcid: '42383', medium: 'link' }, subIdParam: 'campaign', subIdMaxLength: 100, allowedHosts: ['www.viator.com'] },
  getyourguide: { staticParams: { partner_id: 'GYGTEST', utm_medium: 'online_publisher' }, subIdParam: 'cmp', subIdMaxLength: 100, allowedHosts: ['www.getyourguide.com'] },
  klook: { staticParams: { aid: '9999' }, subIdParam: 'aff_sid', subIdMaxLength: 64, allowedHosts: ['www.klook.com'] },
  tiqets: { staticParams: { partner: 'wandernests' }, subIdParam: 'tq_campaign', subIdMaxLength: 64, allowedHosts: ['www.tiqets.com'] },
};

const HOST: Record<SupplierId, string> = {
  viator: 'www.viator.com',
  getyourguide: 'www.getyourguide.com',
  klook: 'www.klook.com',
  tiqets: 'www.tiqets.com',
};

export function activity(supplier: SupplierId, id: string, title: string, extra: Partial<Activity> = {}): Activity {
  return {
    supplier,
    supplierProductId: id,
    title,
    category: 'tour',
    flags: {},
    productUrl: `https://${HOST[supplier]}/p/${id}`,
    rating: { average: 4.5, count: 100 },
    ...extra,
  };
}

/** Fake adapter that records calls and returns canned results (or throws). */
export function fakeAdapter(
  id: SupplierId,
  respond: (q: SupplierSearchQuery) => Activity[] | Error,
): SupplierAdapter & { calls: SupplierSearchQuery[] } {
  const calls: SupplierSearchQuery[] = [];
  return {
    id,
    calls,
    async search(q) {
      calls.push(q);
      const r = respond(q);
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

export function trip(city: string, countryCode: string, items: string[] = []): Trip {
  return {
    id: 'trip-123',
    userId: 'user-42',
    currency: 'EUR',
    locale: 'en-GB',
    days: [
      {
        date: '2026-11-02',
        dayIndex: 0,
        location: { city, countryCode },
        items: items.map((title, i) => ({ id: `item-${i}`, title })),
      },
    ],
  };
}

export const NOW = () => new Date('2026-10-05T12:00:00Z');
