import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../ui/attractions.css', () => ({}));

import { RecommendedActivities, SkipTheLineWidget } from '../ui/RecommendedActivities';
import type { DayRecommendations } from '../src/AttractionsEngine';
import type { RecommendedActivity } from '../src/types';

const offer: RecommendedActivity = {
  supplier: 'tiqets',
  supplierProductId: 't1',
  title: 'Louvre Museum: Timed Entry',
  category: 'attraction_ticket',
  flags: { skipTheLine: true, freeCancellation: true },
  productUrl: 'https://www.tiqets.com/x',
  bookingUrl: 'https://www.tiqets.com/x?partner=wn&tq_campaign=wn-abc-d0-lw',
  price: { amount: 22, currency: 'EUR' },
  rating: { average: 4.6, count: 1234 },
  isFallback: false,
};

const data: DayRecommendations = {
  date: '2026-11-02',
  dayIndex: 0,
  location: { city: 'Paris', countryCode: 'FR' },
  region: 'EUROPE',
  primarySupplier: 'getyourguide',
  suppliersUsed: ['getyourguide'],
  fallbackUsed: false,
  activities: [{ ...offer, supplier: 'getyourguide', supplierProductId: 'g1', title: 'Seine cruise', durationMinutes: 75 }],
  landmarkWidgets: [],
  disclosure: 'Booked via trusted partners at no extra cost',
};

describe('RecommendedActivities', () => {
  it('renders cards with sponsored affiliate links and the disclosure', () => {
    const html = renderToStaticMarkup(<RecommendedActivities data={data} locale="en-GB" />);
    expect(html).toContain('Recommended Activities &amp; Tours');
    expect(html).toContain(' in Paris');
    expect(html).toContain('Booked via trusted partners at no extra cost');
    expect(html).toContain('rel="sponsored noopener noreferrer"');
    expect(html).toContain('href="https://www.tiqets.com/x?partner=wn&amp;tq_campaign=wn-abc-d0-lw"');
    expect(html).toContain('1 h 15 min');
    expect(html).toContain('via GetYourGuide');
  });

  it('renders skeletons while loading and nothing when empty', () => {
    expect(renderToStaticMarkup(<RecommendedActivities data={undefined} loading />)).toContain('wn-attr-card--skeleton');
    expect(renderToStaticMarkup(<RecommendedActivities data={{ ...data, activities: [] }} />)).toBe('');
  });
});

describe('SkipTheLineWidget', () => {
  it('renders a skip-the-line CTA for the landmark', () => {
    const html = renderToStaticMarkup(
      <SkipTheLineWidget
        widget={{ itemId: 'i0', landmark: { key: 'louvre', name: 'Louvre Museum', city: 'Paris', kind: 'museum' }, offer }}
        disclosure={data.disclosure}
        locale="en-GB"
      />,
    );
    expect(html).toContain('Skip-the-line tickets for Louvre Museum');
    expect(html).toContain('From €22');
    expect(html).toContain('via Tiqets');
    expect(html).toContain('Get tickets');
  });
});
