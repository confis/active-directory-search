import * as React from 'react';
import type { ItineraryDay } from '../src/types';
import { RecommendedActivities, SkipTheLineWidget, useDayRecommendations, type ActivityClickHandler } from './RecommendedActivities';

/**
 * Example integration in the itinerary day view. Shows both surfaces:
 *  - contextual Skip-the-line widget directly under a matching itinerary item
 *  - the "Recommended Activities & Tours" rail at the end of the day
 */
export function DayView({ tripId, day, locale }: { tripId: string; day: ItineraryDay; locale: string }) {
  const { data, loading } = useDayRecommendations(tripId, day.dayIndex);
  const widgetsByItem = new Map(data?.landmarkWidgets.map((w) => [w.itemId, w]));

  const track: ActivityClickHandler = (activity, meta) => {
    // Client-side analytics only; attribution is carried by the sub-ID already in bookingUrl.
    window.dispatchEvent(
      new CustomEvent('wn:analytics', {
        detail: {
          event: 'affiliate_click',
          supplier: activity.supplier,
          productId: activity.supplierProductId,
          isFallback: activity.isFallback,
          dayIndex: day.dayIndex,
          ...meta,
        },
      }),
    );
  };

  return (
    <article>
      <h2>
        Day {day.dayIndex + 1} · {day.location.city}
      </h2>
      <ol>
        {day.items.map((item) => {
          const widget = widgetsByItem.get(item.id);
          return (
            <li key={item.id}>
              {item.title}
              {widget && data && (
                <SkipTheLineWidget widget={widget} disclosure={data.disclosure} locale={locale} onActivityClick={track} />
              )}
            </li>
          );
        })}
      </ol>
      <RecommendedActivities data={data} loading={loading} locale={locale} onActivityClick={track} />
    </article>
  );
}
