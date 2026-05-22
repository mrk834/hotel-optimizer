import { Hotel, SplitOption, StaySegment } from './types';
import { addDays, format } from 'date-fns';

export function computeValueScore(hotel: Hotel): number {
  if (!hotel.pricePerNight || hotel.pricePerNight === 0) return 0;
  const ratingWeight = hotel.rating * 10;
  const reviewBonus = Math.min(Math.log10(Math.max(hotel.reviewCount, 1)) * 10, 30);
  const authBonus = hotel.reviewAnalysis ? hotel.reviewAnalysis.authenticityScore * 3 : 15;
  return Math.round(((ratingWeight + reviewBonus + authBonus) / hotel.pricePerNight) * 100) / 100;
}

// Group hotels by name similarity (same hotel, different OTA)
export function groupHotelsByName(hotels: Hotel[]): Map<string, Hotel[]> {
  const groups = new Map<string, Hotel[]>();

  for (const hotel of hotels) {
    const normalized = normalizeHotelName(hotel.name);
    let matched = false;

    for (const [key, group] of groups.entries()) {
      if (isSameHotel(normalized, key)) {
        group.push(hotel);
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.set(normalized, [hotel]);
    }
  }

  return groups;
}

function normalizeHotelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/hotel|hôtel|resort|inn|suite|suites|&|the|le|la|les|\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function isSameHotel(a: string, b: string): boolean {
  if (a === b) return true;
  // Check if one contains the other (handles "Hotel X" vs "X Paris")
  const wordsA = a.split(' ').filter((w) => w.length > 3);
  const wordsB = b.split(' ').filter((w) => w.length > 3);
  const shared = wordsA.filter((w) => wordsB.includes(w));
  return shared.length >= 2 || (shared.length >= 1 && (wordsA.length <= 2 || wordsB.length <= 2));
}

// For each hotel group, pick the cheapest platform (ignoring failed scrapes with $0)
export function buildPlatformComparison(groups: Map<string, Hotel[]>): Hotel[] {
  return [...groups.values()].map((group) => {
    const valid = group.filter((h) => h.pricePerNight > 0);
    const invalid = group.filter((h) => h.pricePerNight === 0);

    if (valid.length === 0) {
      // All failed to get price — return first entry marked as unavailable
      const h = { ...group[0], priceUnavailable: true };
      return h;
    }

    const sorted = [...valid].sort((a, b) => a.pricePerNight - b.pricePerNight);
    const cheapest = sorted[0];

    // Alternatives: pricier valid ones + failed ones (marked unavailable)
    cheapest.platformAlternatives = [
      ...sorted.slice(1),
      ...invalid.map((h) => ({ ...h, priceUnavailable: true })),
    ];

    // Carry over better rating/reviewCount from any variant
    const bestRating = Math.max(...group.map((h) => h.rating));
    const bestReviews = Math.max(...group.map((h) => h.reviewCount));
    if (cheapest.rating === 0) cheapest.rating = bestRating;
    if (cheapest.reviewCount === 0) cheapest.reviewCount = bestReviews;

    return cheapest;
  });
}

// Returns unique sub-periods needed for all split combinations
export function getUniquePeriods(
  checkin: string,
  checkout: string
): Array<{ checkin: string; checkout: string; key: string }> {
  const totalNights = Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000
  );
  const points = getSplitPoints(totalNights);
  const seen = new Set<string>();
  const result: Array<{ checkin: string; checkout: string; key: string }> = [];

  for (const point of points) {
    const mid = format(addDays(new Date(checkin), point), 'yyyy-MM-dd');
    for (const [c, o] of [[checkin, mid], [mid, checkout]] as [string, string][]) {
      const key = `${c}_${o}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ checkin: c, checkout: o, key });
      }
    }
  }
  return result;
}

// Build split options using actual per-period prices
// periodPrices: hotelId → periodKey → actual pricePerNight for that sub-period
export function buildSplitOptionsWithActualPrices(
  hotels: Hotel[],
  periodPrices: Map<string, Map<string, number>>,
  checkin: string,
  checkout: string
): SplitOption[] {
  const totalNights = Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000
  );

  // Only use hotels with real prices for split optimization
  const validHotels = hotels.filter((h) => h.pricePerNight > 0);
  if (validHotels.length < 2 || totalNights < 2) return [];
  const hotels2use = validHotels;

  const splitPoints = getSplitPoints(totalNights);
  const options: SplitOption[] = [];

  for (const point of splitPoints) {
    const mid = format(addDays(new Date(checkin), point), 'yyyy-MM-dd');
    const nights1 = point;
    const nights2 = totalNights - point;
    const key1 = `${checkin}_${mid}`;
    const key2 = `${mid}_${checkout}`;

    for (let i = 0; i < hotels2use.length; i++) {
      for (let j = 0; j < hotels2use.length; j++) {
        if (i === j) continue;
        const h1 = hotels2use[i];
        const h2 = hotels2use[j];

        // Use actual sub-period price if available, fall back to base rate
        const ppn1 = periodPrices.get(h1.id)?.get(key1) ?? h1.pricePerNight;
        const ppn2 = periodPrices.get(h2.id)?.get(key2) ?? h2.pricePerNight;

        const seg1: StaySegment = {
          hotel: { ...h1, pricePerNight: ppn1, nights: nights1 },
          checkin,
          checkout: mid,
          nights: nights1,
          totalCost: ppn1 * nights1,
        };
        const seg2: StaySegment = {
          hotel: { ...h2, pricePerNight: ppn2, nights: nights2 },
          checkin: mid,
          checkout,
          nights: nights2,
          totalCost: ppn2 * nights2,
        };

        options.push({
          segments: [seg1, seg2],
          totalCost: seg1.totalCost + seg2.totalCost,
          avgRating: (h1.rating + h2.rating) / 2,
          splitLabel: `${nights1}박 + ${nights2}박`,
        });
      }
    }
  }

  const seen = new Set<string>();
  return options
    .filter((o) => {
      const key = `${o.segments[0].hotel.name}|${o.segments[1].hotel.name}|${o.splitLabel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.totalCost - b.totalCost)
    .slice(0, 6);
}

// Legacy wrapper kept for compat
export function buildSplitOptionsFromHotels(
  hotels: Hotel[],
  checkin: string,
  checkout: string
): SplitOption[] {
  const empty = new Map<string, Map<string, number>>();
  return buildSplitOptionsWithActualPrices(hotels, empty, checkin, checkout);
}

function getSplitPoints(totalNights: number): number[] {
  const points = new Set<number>();
  // Always include 1+rest and rest+1
  points.add(1);
  points.add(totalNights - 1);
  // Middle splits
  points.add(Math.floor(totalNights / 2));
  points.add(Math.ceil(totalNights / 2));
  if (totalNights >= 4) { points.add(2); points.add(totalNights - 2); }
  if (totalNights >= 6) { points.add(3); points.add(totalNights - 3); }
  return [...points].filter((p) => p > 0 && p < totalNights);
}

// Keep old functions for backward compat
export function generateSplitDates(checkin: string, checkout: string) {
  const start = new Date(checkin);
  const end = new Date(checkout);
  const totalNights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return getSplitPoints(totalNights).map((point) => ({
    mid: format(addDays(start, point), 'yyyy-MM-dd'),
    label: `${point}박 + ${totalNights - point}박`,
  }));
}

export function buildSplitOptions(
  hotelsByPeriod: Map<string, Hotel[]>,
  checkin: string,
  checkout: string
): SplitOption[] {
  const totalNights = Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24)
  );
  const splitDates = generateSplitDates(checkin, checkout);
  const options: SplitOption[] = [];

  for (const { mid, label } of splitDates) {
    const key1 = `${checkin}-${mid}`;
    const key2 = `${mid}-${checkout}`;
    const firstHalf = hotelsByPeriod.get(key1) || [];
    const secondHalf = hotelsByPeriod.get(key2) || [];
    if (!firstHalf.length || !secondHalf.length) continue;

    const bestFirst = [...firstHalf].sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0))[0];
    const bestSecond = [...secondHalf].sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0))[0];
    const nights1 = Math.round((new Date(mid).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24));
    const nights2 = totalNights - nights1;

    options.push({
      segments: [
        { hotel: bestFirst, checkin, checkout: mid, nights: nights1, totalCost: bestFirst.pricePerNight * nights1 },
        { hotel: bestSecond, checkin: mid, checkout, nights: nights2, totalCost: bestSecond.pricePerNight * nights2 },
      ],
      totalCost: bestFirst.pricePerNight * nights1 + bestSecond.pricePerNight * nights2,
      avgRating: (bestFirst.rating + bestSecond.rating) / 2,
      splitLabel: label,
    });
  }

  return options.sort((a, b) => a.totalCost - b.totalCost);
}
