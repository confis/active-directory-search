import type { ItineraryItem, SupplierId } from '../types';

export type LandmarkKind = 'museum' | 'monument' | 'religious_site' | 'theme_park' | 'observation_deck';

export interface Landmark {
  key: string;
  name: string;
  countryCode: string;
  city: string;
  kind: LandmarkKind;
  /** Normalized aliases (see normalize()). The canonical name is matched automatically. */
  aliases: string[];
  /** Search text sent to suppliers when building a skip-the-line widget. */
  ticketQuery: string;
  /**
   * Optional hard override when a partner holds the official/exclusive allocation.
   * Otherwise the router decides.
   */
  preferredSupplier?: SupplierId;
}

/**
 * Seed catalog of high-intent landmarks. In production this lives in the DB
 * (table `landmarks`, keyed by placeId) and is editable by the partnerships team;
 * the shape here is the contract.
 */
export const LANDMARKS: Landmark[] = [
  { key: 'louvre', name: 'Louvre Museum', countryCode: 'FR', city: 'Paris', kind: 'museum',
    aliases: ['louvre', 'musee du louvre', 'le louvre'], ticketQuery: 'Louvre Museum timed entry ticket' },
  { key: 'eiffel-tower', name: 'Eiffel Tower', countryCode: 'FR', city: 'Paris', kind: 'observation_deck',
    aliases: ['tour eiffel', 'eiffel'], ticketQuery: 'Eiffel Tower summit skip the line' },
  { key: 'sagrada-familia', name: 'Sagrada Família', countryCode: 'ES', city: 'Barcelona', kind: 'religious_site',
    aliases: ['sagrada familia', 'basilica de la sagrada familia', 'la sagrada familia'],
    ticketQuery: 'Sagrada Familia skip the line ticket' },
  { key: 'alhambra', name: 'Alhambra', countryCode: 'ES', city: 'Granada', kind: 'monument',
    aliases: ['alhambra palace', 'la alhambra'], ticketQuery: 'Alhambra Nasrid Palaces ticket' },
  { key: 'colosseum', name: 'Colosseum', countryCode: 'IT', city: 'Rome', kind: 'monument',
    aliases: ['colosseo', 'coliseum', 'roman colosseum'], ticketQuery: 'Colosseum Roman Forum skip the line' },
  { key: 'vatican-museums', name: 'Vatican Museums', countryCode: 'VA', city: 'Vatican City', kind: 'museum',
    aliases: ['musei vaticani', 'sistine chapel', 'vatican museum'], ticketQuery: 'Vatican Museums Sistine Chapel skip the line' },
  { key: 'uffizi', name: 'Uffizi Gallery', countryCode: 'IT', city: 'Florence', kind: 'museum',
    aliases: ['uffizi', 'galleria degli uffizi'], ticketQuery: 'Uffizi Gallery reserved entry' },
  { key: 'rijksmuseum', name: 'Rijksmuseum', countryCode: 'NL', city: 'Amsterdam', kind: 'museum',
    aliases: ['rijks museum'], ticketQuery: 'Rijksmuseum entry ticket' },
  { key: 'acropolis', name: 'Acropolis', countryCode: 'GR', city: 'Athens', kind: 'monument',
    aliases: ['acropolis of athens', 'parthenon'], ticketQuery: 'Acropolis skip the line ticket' },
  { key: 'statue-of-liberty', name: 'Statue of Liberty', countryCode: 'US', city: 'New York', kind: 'monument',
    aliases: ['liberty island'], ticketQuery: 'Statue of Liberty Ellis Island ferry ticket' },
  { key: 'moma', name: 'Museum of Modern Art', countryCode: 'US', city: 'New York', kind: 'museum',
    aliases: ['moma'], ticketQuery: 'MoMA admission ticket' },
  { key: 'tokyo-skytree', name: 'Tokyo Skytree', countryCode: 'JP', city: 'Tokyo', kind: 'observation_deck',
    aliases: ['skytree'], ticketQuery: 'Tokyo Skytree fast skytree ticket' },
  { key: 'teamlab-planets', name: 'teamLab Planets', countryCode: 'JP', city: 'Tokyo', kind: 'museum',
    aliases: ['teamlab planets tokyo', 'teamlab'], ticketQuery: 'teamLab Planets ticket' },
  { key: 'gardens-by-the-bay', name: 'Gardens by the Bay', countryCode: 'SG', city: 'Singapore', kind: 'monument',
    aliases: ['cloud forest', 'flower dome'], ticketQuery: 'Gardens by the Bay Flower Dome Cloud Forest ticket' },
  { key: 'universal-singapore', name: 'Universal Studios Singapore', countryCode: 'SG', city: 'Singapore', kind: 'theme_park',
    aliases: ['universal studios sentosa', 'uss'], ticketQuery: 'Universal Studios Singapore ticket' },
  { key: 'sydney-opera-house', name: 'Sydney Opera House', countryCode: 'AU', city: 'Sydney', kind: 'monument',
    aliases: ['opera house sydney'], ticketQuery: 'Sydney Opera House guided tour' },
];

/** Lowercase, strip diacritics and punctuation, collapse whitespace. "Sagrada Família!" → "sagrada familia". */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const INDEX: ReadonlyArray<{ phrase: string; landmark: Landmark }> = LANDMARKS.flatMap((l) =>
  [l.name, ...l.aliases].map((a) => ({ phrase: normalize(a), landmark: l })),
)
  // Longest phrase first so "teamlab planets tokyo" wins over "teamlab".
  .sort((a, b) => b.phrase.length - a.phrase.length);

/**
 * Detect a known landmark in an itinerary item. Matches on whole-word phrases so that
 * e.g. "uss" does not match "discussion". Pass the day's country to avoid cross-country
 * false positives (a "Louvre" restaurant in Tokyo must not trigger Paris tickets).
 */
export function matchLandmark(item: Pick<ItineraryItem, 'title'>, countryCode?: string): Landmark | undefined {
  const haystack = ` ${normalize(item.title)} `;
  for (const { phrase, landmark } of INDEX) {
    if (countryCode && landmark.countryCode !== countryCode.toUpperCase()) continue;
    if (haystack.includes(` ${phrase} `)) return landmark;
  }
  return undefined;
}

export function isCulturalLandmark(l: Landmark): boolean {
  return l.kind === 'museum' || l.kind === 'monument' || l.kind === 'religious_site';
}
