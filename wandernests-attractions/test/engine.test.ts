import { describe, expect, it, vi } from 'vitest';
import { AttractionsEngine, AFFILIATE_DISCLOSURE } from '../src/AttractionsEngine';
import type { SupplierRegistry } from '../src/suppliers/SupplierAdapter';
import { activity, affiliateConfig, fakeAdapter, NOW, trip } from './fixtures';

function engine(suppliers: SupplierRegistry, extra: Partial<ConstructorParameters<typeof AttractionsEngine>[0]> = {}) {
  return new AttractionsEngine({ suppliers, affiliateConfig, subIdSecret: 's3cret', now: NOW, minResults: 2, ...extra });
}

describe('AttractionsEngine.getDayRecommendations', () => {
  it('uses Klook for Asia and does not call Viator when inventory is sufficient', async () => {
    const klook = fakeAdapter('klook', () => [activity('klook', 'k1', 'Tokyo food tour'), activity('klook', 'k2', 'Mt Fuji day trip')]);
    const viator = fakeAdapter('viator', () => [activity('viator', 'v1', 'Something')]);
    const res = await engine({ klook, viator }).getDayRecommendations(trip('Tokyo', 'JP'), 0);

    expect(res.region).toBe('ASIA_PACIFIC');
    expect(res.primarySupplier).toBe('klook');
    expect(res.suppliersUsed).toEqual(['klook']);
    expect(res.fallbackUsed).toBe(false);
    expect(res.activities.map((a) => a.supplierProductId)).toEqual(['k1', 'k2']);
    expect(res.disclosure).toBe(AFFILIATE_DISCLOSURE);
    expect(viator.calls).toHaveLength(0);
    expect(klook.calls[0]).toMatchObject({ date: '2026-11-02', currency: 'EUR', location: { city: 'Tokyo' } });
  });

  it('falls back to Viator when the regional primary has no inventory', async () => {
    const klook = fakeAdapter('klook', () => []);
    const viator = fakeAdapter('viator', () => [activity('viator', 'v1', 'Luang Prabang alms tour'), activity('viator', 'v2', 'Kuang Si falls')]);
    const res = await engine({ klook, viator }).getDayRecommendations(trip('Luang Prabang', 'LA'), 0);

    expect(res.fallbackUsed).toBe(true);
    expect(res.suppliersUsed).toEqual(['viator']);
    expect(res.activities.every((a) => a.isFallback)).toBe(true);
    expect(new URL(res.activities[0].bookingUrl).searchParams.get('pid')).toBe('P00TEST');
  });

  it('falls back when the primary errors, and tops up partial inventory', async () => {
    const warn = vi.fn();
    const gyg = fakeAdapter('getyourguide', () => new Error('503'));
    const viator = fakeAdapter('viator', () => [activity('viator', 'v1', 'Seville tapas'), activity('viator', 'v2', 'Alcazar tour')]);
    const res = await engine({ getyourguide: gyg, viator }, { logger: { warn } }).getDayRecommendations(trip('Seville', 'ES'), 0);
    expect(res.suppliersUsed).toEqual(['viator']);
    expect(warn).toHaveBeenCalledWith('Supplier search failed; falling through', expect.objectContaining({ supplier: 'getyourguide' }));

    const gygPartial = fakeAdapter('getyourguide', () => [activity('getyourguide', 'g1', 'Seville tapas')]);
    const res2 = await engine({ getyourguide: gygPartial, viator }).getDayRecommendations(trip('Seville', 'ES'), 0);
    // Primary result first; duplicate title from Viator dropped; Viator tops up.
    expect(res2.activities.map((a) => `${a.supplier}:${a.supplierProductId}`)).toEqual(['getyourguide:g1', 'viator:v2']);
    expect(res2.activities.map((a) => a.isFallback)).toEqual([false, true]);
  });

  it('times out slow suppliers', async () => {
    const slow = {
      id: 'viator' as const,
      search: (_q: unknown, signal?: AbortSignal) =>
        new Promise<never>((_, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    };
    const gyg = fakeAdapter('getyourguide', () => [activity('getyourguide', 'g1', 'NYC food tour')]);
    const res = await engine({ viator: slow, getyourguide: gyg }, { supplierTimeoutMs: 20 }).getDayRecommendations(trip('New York', 'US'), 0);
    expect(res.suppliersUsed).toEqual(['getyourguide']);
  });

  it('ranks within a supplier by popularity-weighted rating', async () => {
    const gyg = fakeAdapter('getyourguide', () => [
      activity('getyourguide', 'low', 'A', { rating: { average: 4.9, count: 3 } }),
      activity('getyourguide', 'high', 'B', { rating: { average: 4.7, count: 12000 } }),
      activity('getyourguide', 'none', 'C', { rating: undefined }),
    ]);
    const res = await engine({ getyourguide: gyg }).getDayRecommendations(trip('Paris', 'FR'), 0);
    expect(res.activities.map((a) => a.supplierProductId)).toEqual(['high', 'low', 'none']);
  });

  it('drops activities whose URL cannot be safely tracked', async () => {
    const gyg = fakeAdapter('getyourguide', () => [
      activity('getyourguide', 'ok', 'Good'),
      activity('getyourguide', 'bad', 'Bad', { productUrl: 'https://phish.example/x' }),
    ]);
    const res = await engine({ getyourguide: gyg }).getDayRecommendations(trip('Paris', 'FR'), 0);
    expect(res.activities.map((a) => a.supplierProductId)).toEqual(['ok']);
  });

  it('caches supplier responses', async () => {
    const gyg = fakeAdapter('getyourguide', () => [activity('getyourguide', 'g1', 'A'), activity('getyourguide', 'g2', 'B')]);
    const e = engine({ getyourguide: gyg });
    await e.getDayRecommendations(trip('Paris', 'FR'), 0);
    await e.getDayRecommendations(trip('Paris', 'FR'), 0);
    expect(gyg.calls).toHaveLength(1);
  });

  it('returns nothing for past days without calling suppliers', async () => {
    const gyg = fakeAdapter('getyourguide', () => [activity('getyourguide', 'g1', 'A')]);
    const t = trip('Paris', 'FR');
    t.days[0].date = '2026-01-01';
    const res = await engine({ getyourguide: gyg }).getDayRecommendations(t, 0);
    expect(res.activities).toEqual([]);
    expect(gyg.calls).toHaveLength(0);
  });

  it('persists the sub-ID used in booking URLs', async () => {
    const onSubIdIssued = vi.fn();
    const gyg = fakeAdapter('getyourguide', () => [activity('getyourguide', 'g1', 'A'), activity('getyourguide', 'g2', 'B')]);
    const res = await engine({ getyourguide: gyg }, { onSubIdIssued }).getDayRecommendations(trip('Paris', 'FR'), 0);
    const cmp = new URL(res.activities[0].bookingUrl).searchParams.get('cmp');
    expect(onSubIdIssued).toHaveBeenCalledWith(
      expect.objectContaining({ subId: cmp, userId: 'user-42', tripId: 'trip-123', dayIndex: 0, placement: 'day_list' }),
    );
  });
});

describe('landmark widgets (contextual triggers)', () => {
  it('Louvre → Tiqets skip-the-line widget, de-duplicated from the day list', async () => {
    const tiqets = fakeAdapter('tiqets', () => [
      activity('tiqets', 't1', 'Louvre Museum: Timed Entry Ticket', { category: 'attraction_ticket', flags: { skipTheLine: true } }),
    ]);
    const gyg = fakeAdapter('getyourguide', () => [activity('getyourguide', 'g1', 'Seine cruise'), activity('getyourguide', 'g2', 'Montmartre walk')]);
    const res = await engine({ tiqets, getyourguide: gyg }).getDayRecommendations(trip('Paris', 'FR', ['Louvre Museum', 'Lunch']), 0);

    expect(res.landmarkWidgets).toHaveLength(1);
    const w = res.landmarkWidgets[0];
    expect(w).toMatchObject({ itemId: 'item-0', landmark: { key: 'louvre' }, offer: { supplier: 'tiqets', isFallback: false } });
    const url = new URL(w.offer.bookingUrl);
    expect(url.searchParams.get('partner')).toBe('wandernests');
    expect(url.searchParams.get('tq_campaign')).toMatch(/-lw$/);
    expect(tiqets.calls[0].text).toBe('Louvre Museum timed entry ticket');
  });

  it('ignores irrelevant fuzzy matches and falls through the chain to Viator', async () => {
    const tiqets = fakeAdapter('tiqets', () => [activity('tiqets', 't1', 'Barcelona Aquarium')]);
    const gyg = fakeAdapter('getyourguide', () => []);
    const viator = fakeAdapter('viator', () => [
      activity('viator', 'v1', 'Sagrada Familia Skip-the-Line Guided Tour', { flags: { skipTheLine: true } }),
    ]);
    const res = await engine({ tiqets, getyourguide: gyg, viator }).getLandmarkWidgets(
      trip('Barcelona', 'ES'),
      trip('Barcelona', 'ES', ['Sagrada Família']).days[0],
    );
    expect(res).toHaveLength(1);
    expect(res[0].offer).toMatchObject({ supplier: 'viator', supplierProductId: 'v1', isFallback: true });
  });

  it('produces no widget when no supplier has relevant inventory', async () => {
    const viator = fakeAdapter('viator', () => []);
    const t = trip('Paris', 'FR', ['Eiffel Tower']);
    expect(await engine({ viator }).getLandmarkWidgets(t, t.days[0])).toEqual([]);
  });
});
