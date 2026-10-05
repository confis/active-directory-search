import { describe, expect, it } from 'vitest';
import { createHttpAdapter } from '../src/suppliers/httpAdapters';
import type { SupplierSearchQuery } from '../src/types';

const query: SupplierSearchQuery = {
  location: { city: 'Rome', countryCode: 'IT' },
  date: '2026-11-03',
  currency: 'EUR',
  locale: 'en-GB',
  limit: 5,
};

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('Viator HTTP adapter', () => {
  it('sends the API key and maps products into Activities', async () => {
    const { impl, calls } = fakeFetch(200, {
      products: {
        results: [
          {
            productCode: '5040COLOSSEUM',
            title: 'Colosseum Skip-the-Line Tour',
            productUrl: 'https://www.viator.com/tours/Rome/d511-5040COLOSSEUM',
            images: [{ variants: [{ url: 'small.jpg' }, { url: 'large.jpg' }] }],
            pricing: { currency: 'EUR', summary: { fromPrice: 59 } },
            reviews: { combinedAverageRating: 4.7, totalReviews: 8123 },
            duration: { fixedDurationInMinutes: 180 },
            flags: ['FREE_CANCELLATION'],
          },
          { title: 'no url → dropped' },
        ],
      },
    });
    const res = await createHttpAdapter('viator', 'KEY', impl).search(query);
    expect((calls[0].init!.headers as Record<string, string>)['exp-api-key']).toBe('KEY');
    expect(JSON.parse(calls[0].init!.body as string)).toMatchObject({ searchTerm: 'Rome', currency: 'EUR' });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      supplier: 'viator',
      supplierProductId: '5040COLOSSEUM',
      imageUrl: 'large.jpg',
      price: { amount: 59, currency: 'EUR' },
      rating: { average: 4.7, count: 8123 },
      durationMinutes: 180,
      flags: { skipTheLine: true, freeCancellation: true },
    });
  });

  it('throws SupplierError on non-2xx so the engine falls through', async () => {
    const { impl } = fakeFetch(429, {});
    await expect(createHttpAdapter('viator', 'KEY', impl).search(query)).rejects.toThrow('[viator] HTTP 429');
  });
});
