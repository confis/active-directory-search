import * as React from 'react';
import type { DayRecommendations, LandmarkWidget } from '../src/AttractionsEngine';
import type { RecommendedActivity, SupplierId } from '../src/types';
import './attractions.css';

const SUPPLIER_LABEL: Record<SupplierId, string> = {
  viator: 'Viator',
  getyourguide: 'GetYourGuide',
  klook: 'Klook',
  tiqets: 'Tiqets',
};

export type ActivityClickHandler = (
  activity: RecommendedActivity,
  meta: { position: number; placement: 'day_list' | 'landmark_widget' },
) => void;

/* ------------------------------------------------------------------------ */
/* Disclosure                                                                */
/* ------------------------------------------------------------------------ */

export function AffiliateDisclosure({ text }: { text: string }) {
  return (
    <p className="wn-attr-disclosure">
      <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12">
        <path fill="currentColor" d="M8 1 2 3.5v4C2 11 4.6 14.2 8 15c3.4-.8 6-4 6-7.5v-4L8 1Zm-1 10L4.5 8.5l1-1L7 9l3.5-3.5 1 1L7 11Z" />
      </svg>
      {text}
    </p>
  );
}

/* ------------------------------------------------------------------------ */
/* Card                                                                      */
/* ------------------------------------------------------------------------ */

function formatPrice(p: RecommendedActivity['price'], locale: string): string | undefined {
  if (!p) return undefined;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.amount);
  } catch {
    return `${p.amount} ${p.currency}`;
  }
}

function formatDuration(min?: number): string | undefined {
  if (!min) return undefined;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function ActivityCard({
  activity,
  locale,
  onClick,
}: {
  activity: RecommendedActivity;
  locale: string;
  onClick?: () => void;
}) {
  const price = formatPrice(activity.price, locale);
  const duration = formatDuration(activity.durationMinutes);
  return (
    <li className="wn-attr-card">
      <a
        href={activity.bookingUrl}
        target="_blank"
        // `sponsored` is required by search-engine guidelines for affiliate links.
        rel="sponsored noopener noreferrer"
        onClick={onClick}
        className="wn-attr-card__link"
      >
        <div className="wn-attr-card__media">
          {activity.imageUrl ? (
            <img src={activity.imageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="wn-attr-card__placeholder" aria-hidden="true" />
          )}
          {activity.flags.skipTheLine && <span className="wn-attr-chip wn-attr-chip--accent">Skip the line</span>}
        </div>
        <div className="wn-attr-card__body">
          <h4 className="wn-attr-card__title">{activity.title}</h4>
          <div className="wn-attr-card__meta">
            {activity.rating && (
              <span aria-label={`Rated ${activity.rating.average.toFixed(1)} out of 5 from ${activity.rating.count} reviews`}>
                ★ {activity.rating.average.toFixed(1)}{' '}
                <span className="wn-attr-muted">({activity.rating.count.toLocaleString(locale)})</span>
              </span>
            )}
            {duration && <span>{duration}</span>}
          </div>
          {activity.flags.freeCancellation && <p className="wn-attr-card__perk">Free cancellation</p>}
          <div className="wn-attr-card__footer">
            {price ? (
              <span className="wn-attr-card__price">
                <span className="wn-attr-muted">from</span> {price}
              </span>
            ) : (
              <span />
            )}
            <span className="wn-attr-card__supplier">via {SUPPLIER_LABEL[activity.supplier]}</span>
          </div>
        </div>
      </a>
    </li>
  );
}

function SkeletonCard() {
  return (
    <li className="wn-attr-card wn-attr-card--skeleton" aria-hidden="true">
      <div className="wn-attr-card__media" />
      <div className="wn-attr-card__body">
        <div className="wn-attr-skel-line" />
        <div className="wn-attr-skel-line wn-attr-skel-line--short" />
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------------ */
/* Day section                                                               */
/* ------------------------------------------------------------------------ */

export interface RecommendedActivitiesProps {
  data: DayRecommendations | undefined;
  loading?: boolean;
  locale?: string;
  onActivityClick?: ActivityClickHandler;
}

/**
 * "Recommended Activities & Tours" section for one itinerary day.
 * Mobile-first horizontal scroll-snap rail; becomes a wrapping grid on wide screens.
 * Renders nothing when there is no inventory — an empty upsell block is noise.
 */
export function RecommendedActivities({ data, loading, locale = 'en', onActivityClick }: RecommendedActivitiesProps) {
  const headingId = React.useId();
  if (!loading && (!data || data.activities.length === 0)) return null;

  return (
    <section className="wn-attr" aria-labelledby={headingId}>
      <header className="wn-attr__header">
        <h3 id={headingId} className="wn-attr__title">
          Recommended Activities &amp; Tours
          {data && <span className="wn-attr__subtitle"> in {data.location.city}</span>}
        </h3>
        {data && <AffiliateDisclosure text={data.disclosure} />}
      </header>

      <ul className="wn-attr__rail" aria-busy={loading || undefined}>
        {loading
          ? Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)
          : data!.activities.map((a, i) => (
              <ActivityCard
                key={`${a.supplier}:${a.supplierProductId}`}
                activity={a}
                locale={locale}
                onClick={() => onActivityClick?.(a, { position: i, placement: 'day_list' })}
              />
            ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Contextual landmark widget                                                */
/* ------------------------------------------------------------------------ */

/**
 * Inline "Skip-the-line tickets" prompt rendered directly under the matching
 * itinerary item (e.g. the user just added "Louvre Museum").
 */
export function SkipTheLineWidget({
  widget,
  disclosure,
  locale = 'en',
  onActivityClick,
}: {
  widget: LandmarkWidget;
  disclosure: string;
  locale?: string;
  onActivityClick?: ActivityClickHandler;
}) {
  const { offer, landmark } = widget;
  const price = formatPrice(offer.price, locale);
  const label = offer.flags.skipTheLine ? 'Skip-the-line tickets' : 'Entry tickets';
  return (
    <aside className="wn-attr-stl" aria-label={`${label} for ${landmark.name}`}>
      <div className="wn-attr-stl__icon" aria-hidden="true">🎟️</div>
      <div className="wn-attr-stl__body">
        <p className="wn-attr-stl__title">
          {label} for {landmark.name}
        </p>
        <p className="wn-attr-stl__sub">
          {price && <>From {price} · </>}via {SUPPLIER_LABEL[offer.supplier]}
          {offer.flags.freeCancellation && <> · Free cancellation</>}
        </p>
        <AffiliateDisclosure text={disclosure} />
      </div>
      <a
        className="wn-attr-stl__cta"
        href={offer.bookingUrl}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={() => onActivityClick?.(offer, { position: 0, placement: 'landmark_widget' })}
      >
        Get tickets
      </a>
    </aside>
  );
}

/* ------------------------------------------------------------------------ */
/* Data hook                                                                 */
/* ------------------------------------------------------------------------ */

export function useDayRecommendations(tripId: string, dayIndex: number) {
  const [state, setState] = React.useState<{ data?: DayRecommendations; loading: boolean; error?: Error }>({
    loading: true,
  });
  React.useEffect(() => {
    const ctrl = new AbortController();
    setState({ loading: true });
    fetch(`/api/trips/${encodeURIComponent(tripId)}/days/${dayIndex}/recommendations`, {
      signal: ctrl.signal,
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: DayRecommendations) => setState({ data, loading: false }))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setState({ loading: false, error });
      });
    return () => ctrl.abort();
  }, [tripId, dayIndex]);
  return state;
}
