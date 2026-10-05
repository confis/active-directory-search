import { describe, expect, it } from 'vitest';
import { AffiliateLinkError, buildSubId, decorateUrl } from '../src/tracking/affiliateLinks';
import { affiliateConfig } from './fixtures';

const ctx = { userId: 'user-42', tripId: 'trip-123', dayIndex: 2, placement: 'day_list' as const };

describe('buildSubId', () => {
  it('is deterministic, opaque and URL-safe', () => {
    const a = buildSubId(ctx, 'secret');
    const b = buildSubId(ctx, 'secret');
    expect(a.subId).toBe(b.subId);
    expect(a.subId).toMatch(/^wn-[A-Za-z0-9]{12}-d2-dl$/);
    expect(a.subId).not.toContain('user-42');
    expect(a.subId).not.toContain('trip-123');
    expect(a).toMatchObject({ userId: 'user-42', tripId: 'trip-123', dayIndex: 2, placement: 'day_list' });
  });

  it('differs per trip and per placement', () => {
    expect(buildSubId({ ...ctx, tripId: 'other' }, 'secret').subId).not.toBe(buildSubId(ctx, 'secret').subId);
    expect(buildSubId({ ...ctx, placement: 'landmark_widget' }, 'secret').subId).toMatch(/-lw$/);
  });
});

describe('decorateUrl', () => {
  it('appends Viator pid/mcid/medium/campaign', () => {
    const url = new URL(decorateUrl('viator', 'https://www.viator.com/tours/Paris/d479-123', 'wn-abc', affiliateConfig));
    expect(Object.fromEntries(url.searchParams)).toEqual({ pid: 'P00TEST', mcid: '42383', medium: 'link', campaign: 'wn-abc' });
  });

  it('preserves existing params and overrides conflicting affiliate ones', () => {
    const url = new URL(
      decorateUrl('getyourguide', 'https://www.getyourguide.com/paris-l16/t1/?date=2026-11-02&partner_id=EVIL', 'wn-abc', affiliateConfig),
    );
    expect(url.searchParams.get('date')).toBe('2026-11-02');
    expect(url.searchParams.get('partner_id')).toBe('GYGTEST');
    expect(url.searchParams.get('cmp')).toBe('wn-abc');
  });

  it('truncates the sub-ID to the partner limit', () => {
    const url = new URL(decorateUrl('klook', 'https://www.klook.com/activity/1/', 'x'.repeat(200), affiliateConfig));
    expect(url.searchParams.get('aff_sid')).toHaveLength(64);
  });

  it('refuses foreign hosts and non-https URLs', () => {
    expect(() => decorateUrl('tiqets', 'https://evil.example/tiqets', 's', affiliateConfig)).toThrow(AffiliateLinkError);
    expect(() => decorateUrl('tiqets', 'http://www.tiqets.com/x', 's', affiliateConfig)).toThrow(AffiliateLinkError);
    expect(() => decorateUrl('tiqets', 'not a url', 's', affiliateConfig)).toThrow(AffiliateLinkError);
  });
});
