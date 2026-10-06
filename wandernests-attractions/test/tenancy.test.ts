import { describe, expect, it } from 'vitest';
import { AttractionsEngine } from '../src/AttractionsEngine';
import { createRecommendationsController } from '../src/server/recommendationsController';
import { recommendationModeFor, resolveTenant, tenancyConfigFromEnv, type TenancyConfig } from '../src/tenancy/tenant';
import { activity, affiliateConfig, fakeAdapter, NOW, trip } from './fixtures';

const config = tenancyConfigFromEnv({});

describe('resolveTenant', () => {
  it.each([
    ['wandernests.app', { kind: 'public' }],
    ['www.wandernests.app', { kind: 'public' }],
    ['WanderNests.app:443', { kind: 'public' }],
    ['shasha.wandernests.app', { kind: 'agency', slug: 'shasha' }],
    ['rimon.wandernests.app.', { kind: 'agency', slug: 'rimon' }],
    ['api.wandernests.app', { kind: 'unknown', host: 'api.wandernests.app' }],
    ['biz.wandernests.app', { kind: 'unknown', host: 'biz.wandernests.app' }],
    ['wandernests-admin.wandernests.app', { kind: 'unknown', host: 'wandernests-admin.wandernests.app' }],
    ['x.shasha.wandernests.app', { kind: 'unknown', host: 'x.shasha.wandernests.app' }],
    ['evilwandernests.app', { kind: 'unknown', host: 'evilwandernests.app' }],
    ['wandernests.app.evil.com', { kind: 'unknown', host: 'wandernests.app.evil.com' }],
    [undefined, { kind: 'unknown', host: '' }],
  ])('%s', (host, expected) => {
    expect(resolveTenant(host, config)).toEqual(expected);
  });
});

describe('recommendationModeFor', () => {
  it('affiliate on the public app, none for agencies and unknown hosts', () => {
    expect(recommendationModeFor({ kind: 'public' }, config)).toBe('affiliate');
    expect(recommendationModeFor({ kind: 'agency', slug: 'shasha' }, config)).toBe('none');
    expect(recommendationModeFor({ kind: 'unknown', host: 'localhost' }, config)).toBe('none');
  });

  it('allows a per-agency override', () => {
    const c: TenancyConfig = { ...config, agencyModes: { rimon: 'affiliate' } };
    expect(recommendationModeFor({ kind: 'agency', slug: 'rimon' }, c)).toBe('affiliate');
    expect(recommendationModeFor({ kind: 'agency', slug: 'shasha' }, c)).toBe('none');
  });
});

describe('controller tenant gating', () => {
  function setup(opts: { orgId?: string; agencyLinked?: boolean } = {}) {
    const gyg = fakeAdapter('getyourguide', () => [activity('getyourguide', 'g1', 'A'), activity('getyourguide', 'g2', 'B')]);
    const engine = new AttractionsEngine({ suppliers: { getyourguide: gyg }, affiliateConfig, subIdSecret: 's', now: NOW });
    const t = { ...trip('Paris', 'FR', ['Louvre']), orgId: opts.orgId ?? null };
    const handle = createRecommendationsController({
      engine,
      tenancy: config,
      loadTrip: async () => t,
      isAgencyLinkedUser: async () => opts.agencyLinked ?? false,
    });
    return { gyg, handle };
  }
  async function expectEmpty(res: Awaited<ReturnType<ReturnType<typeof setup>['handle']>>) {
    expect(res.status).toBe(200);
    if (res.status === 200) {
      expect(res.body.activities).toEqual([]);
      expect(res.body.landmarkWidgets).toEqual([]);
    }
  }
  const req = (host: string) => ({ authUserId: 'user-42', host, tripId: 'trip-123', dayIndex: '0' });

  it('returns affiliate recommendations on wandernests.app', async () => {
    const { gyg, handle } = setup();
    const res = await handle(req('wandernests.app'));
    expect(res.status).toBe(200);
    if (res.status === 200) expect(res.body.activities.length).toBeGreaterThan(0);
    expect(gyg.calls.length).toBeGreaterThan(0);
  });

  it('returns nothing on an agency subdomain and never calls suppliers', async () => {
    const { gyg, handle } = setup();
    const res = await handle(req('shasha.wandernests.app'));
    expect(res.status).toBe(200);
    if (res.status === 200) {
      expect(res.body.activities).toEqual([]);
      expect(res.body.landmarkWidgets).toEqual([]);
      expect(res.body.disclosure).toBe('');
      expect(res.headers.Vary).toBe('Host');
    }
    expect(gyg.calls).toHaveLength(0);
  });

  it('returns nothing on the public app for an agency-owned trip', async () => {
    const { gyg, handle } = setup({ orgId: 'org-shasha' });
    await expectEmpty(await handle(req('wandernests.app')));
    expect(gyg.calls).toHaveLength(0);
  });

  it('returns nothing on the public app for an agency client, even on a personal trip', async () => {
    const { gyg, handle } = setup({ agencyLinked: true });
    await expectEmpty(await handle(req('wandernests.app')));
    expect(gyg.calls).toHaveLength(0);
  });

  it.each(['biz.wandernests.app', 'wandernests-admin.wandernests.app'])('returns nothing on %s', async (host) => {
    const { handle } = setup();
    await expectEmpty(await handle(req(host)));
  });

  it('still enforces auth on agency hosts', async () => {
    const { handle } = setup();
    expect((await handle({ ...req('shasha.wandernests.app'), authUserId: 'someone-else' })).status).toBe(403);
  });
});
