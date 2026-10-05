import { describe, expect, it } from 'vitest';
import { regionForCountry } from '../src/geo/regions';
import { matchLandmark } from '../src/landmarks/landmarkCatalog';
import { routeSuppliers } from '../src/routing/supplierRouter';

describe('regionForCountry', () => {
  it.each([
    ['JP', 'ASIA_PACIFIC'],
    ['au', 'ASIA_PACIFIC'],
    ['FR', 'EUROPE'],
    ['US', 'AMERICAS'],
    ['BR', 'AMERICAS'],
    ['AE', 'MIDDLE_EAST_AFRICA'],
    ['ZZ', 'UNKNOWN'],
    ['', 'UNKNOWN'],
  ])('%s → %s', (cc, region) => {
    expect(regionForCountry(cc)).toBe(region);
  });
});

describe('routeSuppliers', () => {
  it('Asia & Pacific → Klook first, Viator fallback', () => {
    expect(routeSuppliers({ countryCode: 'TH' }).chain).toEqual(['klook', 'viator']);
  });

  it('Europe → GetYourGuide then Viator', () => {
    expect(routeSuppliers({ countryCode: 'ES' }).chain).toEqual(['getyourguide', 'viator']);
  });

  it('Americas → Viator then GetYourGuide', () => {
    expect(routeSuppliers({ countryCode: 'US' }).chain).toEqual(['viator', 'getyourguide']);
  });

  it('cultural tickets put Tiqets in front, globally', () => {
    expect(routeSuppliers({ countryCode: 'FR', intent: 'cultural_ticket' }).chain).toEqual(['tiqets', 'getyourguide', 'viator']);
    expect(routeSuppliers({ countryCode: 'JP', intent: 'cultural_ticket' }).chain).toEqual(['tiqets', 'klook', 'viator']);
  });

  it('landmark override goes first and is de-duplicated', () => {
    expect(routeSuppliers({ countryCode: 'FR', preferredSupplier: 'viator' }).chain).toEqual(['viator', 'getyourguide']);
  });

  it('unknown destinations still route to Viator', () => {
    const r = routeSuppliers({ countryCode: 'XX' });
    expect(r).toEqual({ region: 'UNKNOWN', chain: ['viator'], primary: 'viator' });
  });

  it('skips disabled suppliers (kill-switch)', () => {
    expect(routeSuppliers({ countryCode: 'SG', disabledSuppliers: new Set(['klook'] as const) }).chain).toEqual(['viator']);
  });
});

describe('matchLandmark', () => {
  it('matches accents/case/punctuation-insensitively', () => {
    expect(matchLandmark({ title: 'Visit the SAGRADA FAMILIA!' })?.key).toBe('sagrada-familia');
    expect(matchLandmark({ title: 'Musée du Louvre' })?.key).toBe('louvre');
  });

  it('respects the day country', () => {
    expect(matchLandmark({ title: 'Louvre' }, 'JP')).toBeUndefined();
    expect(matchLandmark({ title: 'Louvre' }, 'fr')?.key).toBe('louvre');
  });

  it('only matches whole words', () => {
    expect(matchLandmark({ title: 'Team discussion over coffee' })).toBeUndefined();
  });

  it('prefers the longest alias', () => {
    expect(matchLandmark({ title: 'teamLab Planets Tokyo' })?.key).toBe('teamlab-planets');
  });
});
