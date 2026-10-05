import type { MacroRegion } from '../types';

/**
 * ISO 3166-1 alpha-2 → commercial macro-region.
 *
 * "Asia & Pacific" deliberately includes Oceania and the Pacific islands, which is
 * where Klook's inventory and payment methods are strongest. Middle East & Africa
 * are kept separate because no regional specialist is configured for them; they
 * route straight to the global default.
 */
const ASIA_PACIFIC = [
  // East Asia
  'CN', 'HK', 'MO', 'TW', 'JP', 'KR', 'KP', 'MN',
  // South-East Asia
  'SG', 'MY', 'TH', 'VN', 'ID', 'PH', 'KH', 'LA', 'MM', 'BN', 'TL',
  // South Asia
  'IN', 'LK', 'NP', 'BT', 'BD', 'MV', 'PK',
  // Oceania & Pacific
  'AU', 'NZ', 'FJ', 'PG', 'NC', 'PF', 'WS', 'TO', 'VU', 'SB', 'GU', 'MP', 'PW', 'FM', 'MH', 'KI', 'NR', 'TV', 'CK',
  // Central Asia
  'KZ', 'UZ', 'KG', 'TJ', 'TM',
];

const EUROPE = [
  'AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR',
  'GB', 'GE', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'GG', 'LI', 'LT', 'LU', 'LV', 'MC',
  'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'SM', 'UA', 'VA',
  'XK', 'AM', 'AZ', 'TR',
];

const AMERICAS = [
  // North & Central America
  'US', 'CA', 'MX', 'GT', 'BZ', 'HN', 'SV', 'NI', 'CR', 'PA', 'GL', 'BM', 'PM',
  // Caribbean
  'CU', 'DO', 'HT', 'JM', 'PR', 'BS', 'BB', 'TT', 'AG', 'DM', 'GD', 'KN', 'LC', 'VC', 'AW', 'CW', 'SX',
  'BQ', 'KY', 'TC', 'VG', 'VI', 'AI', 'MS', 'GP', 'MQ', 'BL', 'MF',
  // South America
  'AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE', 'GF', 'FK',
];

const MIDDLE_EAST_AFRICA = [
  'AE', 'SA', 'QA', 'BH', 'KW', 'OM', 'YE', 'JO', 'IL', 'PS', 'LB', 'SY', 'IQ', 'IR',
  'EG', 'MA', 'TN', 'DZ', 'LY', 'ZA', 'KE', 'TZ', 'UG', 'RW', 'ET', 'NA', 'BW', 'ZW', 'ZM', 'MZ', 'MG',
  'MU', 'SC', 'GH', 'NG', 'SN', 'CI', 'CM', 'CV', 'RE',
];

const REGION_BY_COUNTRY: ReadonlyMap<string, MacroRegion> = new Map<string, MacroRegion>([
  ...ASIA_PACIFIC.map((c) => [c, 'ASIA_PACIFIC'] as const),
  ...EUROPE.map((c) => [c, 'EUROPE'] as const),
  ...AMERICAS.map((c) => [c, 'AMERICAS'] as const),
  ...MIDDLE_EAST_AFRICA.map((c) => [c, 'MIDDLE_EAST_AFRICA'] as const),
]);

export function regionForCountry(countryCode: string | undefined | null): MacroRegion {
  if (!countryCode) return 'UNKNOWN';
  return REGION_BY_COUNTRY.get(countryCode.trim().toUpperCase()) ?? 'UNKNOWN';
}
