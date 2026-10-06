# @wandernests/attractions-engine

Location-based recommendations for attractions and tours, with affiliate routing across Klook, GetYourGuide, Viator and Tiqets.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design and data flow.

```bash
npm install
npm run typecheck
npm test
```

## Usage (backend)

```ts
import {
  AttractionsEngine, affiliateConfigFromEnv, createHttpAdapter, createRecommendationsController, tenancyConfigFromEnv,
} from '@wandernests/attractions-engine';

const engine = new AttractionsEngine({
  suppliers: {
    klook: createHttpAdapter('klook', process.env.KLOOK_API_KEY!),
    viator: createHttpAdapter('viator', process.env.VIATOR_API_KEY!),
    getyourguide: createHttpAdapter('getyourguide', process.env.GYG_API_KEY!),
    tiqets: createHttpAdapter('tiqets', process.env.TIQETS_API_KEY!),
  },
  affiliateConfig: affiliateConfigFromEnv(),
  subIdSecret: process.env.AFFILIATE_SUBID_SECRET!,
  onSubIdIssued: (r) => db.affiliateSubids.upsert(r),
});

const handle = createRecommendationsController({
  engine,
  tenancy: tenancyConfigFromEnv(), // wandernests.app → affiliate; <agency>.wandernests.app → none
  loadTrip: (id) => db.trips.findWithDays(id),
});

app.get('/api/trips/:tripId/days/:dayIndex/recommendations', async (req, res) => {
  // req.hostname: with Express `trust proxy` set only for your own load balancer.
  const out = await handle({ authUserId: req.user?.id, host: req.hostname, ...req.params });
  res.status(out.status).set('headers' in out ? out.headers : {}).json(out.body);
});
```

## Usage (UI)

```tsx
import { RecommendedActivities, SkipTheLineWidget, useDayRecommendations } from './ui/RecommendedActivities';
// See ui/DayViewExample.tsx for the full day-view integration.
```

## Environment

| Var | Purpose |
|---|---|
| `VIATOR_API_KEY`, `VIATOR_PID`, `VIATOR_MCID` | Viator Partner API and affiliate IDs |
| `GYG_API_KEY`, `GYG_PARTNER_ID` | GetYourGuide |
| `KLOOK_API_KEY`, `KLOOK_AID`, `KLOOK_API_BASE`, `KLOOK_SUBID_PARAM` | Klook |
| `TIQETS_API_KEY`, `TIQETS_PARTNER` | Tiqets |
| `AFFILIATE_SUBID_SECRET` | HMAC secret for opaque sub-IDs |
| `WN_ROOT_DOMAIN` | Default `wandernests.app` |
| `WN_PUBLIC_HOSTS` | Hosts serving the public app. Default `wandernests.app,www.wandernests.app` |
| `WN_RESERVED_SUBDOMAINS` | Subdomains that are never agencies. Default `api,admin,staging,dev,mail,cdn,static,assets` |
| `WN_AGENCY_RECOMMENDATION_MODES` | Optional JSON per-agency override, e.g. `{"rimon":"affiliate"}`. Default for every agency is `none` |
