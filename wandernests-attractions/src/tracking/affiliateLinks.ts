import { createHmac } from 'node:crypto';
import type { SupplierId, TrackingContext } from '../types';

/**
 * Per-supplier affiliate parameter names. Values come from env/secret config.
 *
 * NOTE: parameter names reflect each partner programme's documented deep-link format
 * at time of writing. Confirm against the partner dashboards before launch; they are
 * config, not code, precisely so they can be corrected without a deploy.
 */
export interface SupplierAffiliateConfig {
  /** Static params always appended (partner id, medium, etc.). */
  staticParams: Record<string, string>;
  /** Query param that carries our per-click sub-ID for conversion reporting. */
  subIdParam: string;
  /** Max sub-ID length the partner accepts. */
  subIdMaxLength: number;
  /** Hostnames we are allowed to decorate (prevents tagging arbitrary URLs from a bad API payload). */
  allowedHosts: string[];
}

export type AffiliateConfig = Record<SupplierId, SupplierAffiliateConfig>;

export function affiliateConfigFromEnv(env: Record<string, string | undefined> = process.env): AffiliateConfig {
  const req = (k: string) => {
    const v = env[k];
    if (!v) throw new Error(`Missing affiliate config: ${k}`);
    return v;
  };
  return {
    viator: {
      staticParams: { pid: req('VIATOR_PID'), mcid: req('VIATOR_MCID'), medium: 'link' },
      subIdParam: 'campaign',
      subIdMaxLength: 100,
      allowedHosts: ['www.viator.com', 'viator.com'],
    },
    getyourguide: {
      staticParams: { partner_id: req('GYG_PARTNER_ID'), utm_medium: 'online_publisher' },
      subIdParam: 'cmp',
      subIdMaxLength: 100,
      allowedHosts: ['www.getyourguide.com', 'getyourguide.com'],
    },
    klook: {
      staticParams: { aid: req('KLOOK_AID') },
      subIdParam: env.KLOOK_SUBID_PARAM ?? 'aff_sid',
      subIdMaxLength: 64,
      allowedHosts: ['www.klook.com', 'klook.com'],
    },
    tiqets: {
      staticParams: { partner: req('TIQETS_PARTNER') },
      subIdParam: 'tq_campaign',
      subIdMaxLength: 64,
      allowedHosts: ['www.tiqets.com', 'tiqets.com'],
    },
  };
}

const PLACEMENT_CODE: Record<TrackingContext['placement'], string> = {
  day_list: 'dl',
  landmark_widget: 'lw',
  search: 'sr',
};

export interface SubIdRecord {
  subId: string;
  userId: string;
  tripId: string;
  dayIndex: number;
  placement: TrackingContext['placement'];
}

/**
 * Build an opaque, deterministic sub-ID: `wn-<12 char hmac>-d<day>-<placement>`.
 *
 * Raw user/trip ids are never put in partner URLs (they end up in third-party logs).
 * The HMAC is stable per (user, trip), so the conversion-import job can join partner
 * reports back to trips via the persisted SubIdRecord.
 */
export function buildSubId(ctx: TrackingContext, secret: string): SubIdRecord {
  const token = createHmac('sha256', secret).update(`${ctx.userId}:${ctx.tripId}`).digest('base64url').slice(0, 12)
    // base64url may contain '-' / '_' — normalise to a strictly alphanumeric token.
    .replace(/[-_]/g, '0');
  const subId = `wn-${token}-d${ctx.dayIndex}-${PLACEMENT_CODE[ctx.placement]}`;
  return { subId, userId: ctx.userId, tripId: ctx.tripId, dayIndex: ctx.dayIndex, placement: ctx.placement };
}

export class AffiliateLinkError extends Error {}

/**
 * Append affiliate + sub-ID params to a supplier product URL.
 * Existing query params (e.g. a supplier's own date pre-selection) are preserved;
 * our affiliate params win over any conflicting values from the payload.
 */
export function decorateUrl(
  supplier: SupplierId,
  productUrl: string,
  subId: string,
  config: AffiliateConfig,
): string {
  const cfg = config[supplier];
  let url: URL;
  try {
    url = new URL(productUrl);
  } catch {
    throw new AffiliateLinkError(`Invalid ${supplier} product URL: ${productUrl}`);
  }
  if (url.protocol !== 'https:' || !cfg.allowedHosts.includes(url.hostname)) {
    throw new AffiliateLinkError(`Refusing to decorate non-${supplier} URL: ${url.hostname}`);
  }
  for (const [k, v] of Object.entries(cfg.staticParams)) url.searchParams.set(k, v);
  url.searchParams.set(cfg.subIdParam, subId.slice(0, cfg.subIdMaxLength));
  return url.toString();
}
