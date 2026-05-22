import FirecrawlApp from '@mendable/firecrawl-js';
import Anthropic from '@anthropic-ai/sdk';
import { Hotel } from './types';

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY || '' });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// Platform definitions — patterns match hotel *detail* pages (not search results)
const PLATFORMS = [
  {
    name: 'Booking.com',
    domain: 'booking.com',
    pattern: /booking\.com\/hotel\//,
    searchHint: 'booking.com',
  },
  {
    name: 'Agoda',
    domain: 'agoda.com',
    // Agoda hotel URLs: agoda.com/hotel-name/hotel/city.html
    pattern: /agoda\.com\/[\w%-]+\/hotel\//,
    searchHint: 'agoda.com',
  },
  {
    name: 'Hotels.com',
    domain: 'hotels.com',
    // Hotels.com: hotels.com/ho123456/...
    pattern: /hotels\.com\/ho\d+/,
    searchHint: 'hotels.com',
  },
  {
    name: 'Expedia',
    domain: 'expedia.com',
    // Expedia: expedia.com/...-Hotels-...-h123456.Hotel-Information
    pattern: /expedia\.com\/.+\.h\d+\.|expedia\.com\/.*hotel/i,
    searchHint: 'expedia.com',
  },
];

function addDateParams(url: string, checkin: string, checkout: string, guests: number): string {
  const sep = url.includes('?') ? '&' : '?';
  if (url.includes('booking.com') && !url.includes('checkin=')) {
    return `${url}${sep}checkin=${checkin}&checkout=${checkout}&group_adults=${guests}&no_rooms=1`;
  }
  if (url.includes('agoda.com') && !url.includes('checkIn=')) {
    return `${url}${sep}checkIn=${checkin}&checkOut=${checkout}&adults=${guests}&rooms=1`;
  }
  if (url.includes('hotels.com') && !url.includes('checkIn=')) {
    return `${url}${sep}checkIn=${checkin}&checkOut=${checkout}&adults=${guests}`;
  }
  if (url.includes('expedia.com') && !url.includes('startDate=')) {
    return `${url}${sep}startDate=${checkin}&endDate=${checkout}&adults=${guests}`;
  }
  return url;
}

export async function scrapeHotelByUrl(
  url: string,
  checkin: string,
  checkout: string,
  guests: number
): Promise<Hotel | null> {
  const nights = Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000
  );

  console.log(`[scraper] Fetching: ${url.slice(0, 80)}`);

  try {
    const fetchUrl = addDateParams(url, checkin, checkout, guests);
    const scraped = await firecrawl.scrapeUrl(fetchUrl, {
      formats: ['markdown'],
      onlyMainContent: false,
      waitFor: 3000,   // wait 3s for JS-rendered prices
    } as Parameters<typeof firecrawl.scrapeUrl>[1]);

    const content = (scraped as { markdown?: string }).markdown || '';
    console.log(`[scraper] Got ${content.length} chars`);
    if (content.length < 300) return null;

    return await parseHotelPage(content, url, checkin, checkout, nights, guests);
  } catch (err) {
    console.error(`[scraper] Error:`, err);
    return null;
  }
}

// Given a hotel, find it on ALL other major booking platforms automatically
export async function findSameHotelOnOtherPlatforms(
  hotel: Hotel,
  checkin: string,
  checkout: string,
  guests: number
): Promise<Hotel[]> {
  const nights = Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000
  );

  // Which domains are already covered?
  const coveredDomains = [hotel.url, ...(hotel.platformAlternatives || []).map((h) => h.url)]
    .map((u) => { try { return new URL(u).hostname; } catch { return ''; } });

  const results: Hotel[] = [];

  for (const platform of PLATFORMS) {
    if (coveredDomains.some((d) => d.includes(platform.domain))) {
      console.log(`[scraper] Already have ${platform.name}, skipping`);
      continue;
    }

    console.log(`[scraper] Searching ${platform.name} for "${hotel.name}"`);

    try {
      // Search: hotel name + city + platform domain
      const city = hotel.location?.split(',').slice(-1)[0]?.trim() || '';
      const query = `"${hotel.name}" ${city} ${platform.searchHint}`;

      const searchResult = await (firecrawl as FirecrawlApp & {
        search: (q: string, opts: object) => Promise<{ data?: Array<{ url?: string }> }>;
      }).search(query, { limit: 8 });

      const candidates = (searchResult.data || [])
        .map((r) => r.url)
        .filter((u): u is string => typeof u === 'string' && u.includes(platform.domain));

      // Pick the first URL matching hotel detail page pattern
      const hotelUrl = candidates.find((u) => platform.pattern.test(u))
        // Fallback: any URL from the platform domain
        ?? candidates[0];

      if (!hotelUrl) {
        console.log(`[scraper] Not found on ${platform.name}`);
        continue;
      }

      console.log(`[scraper] Found on ${platform.name}: ${hotelUrl.slice(0, 70)}`);

      const fetchUrl = addDateParams(hotelUrl, checkin, checkout, guests);
      const scraped = await firecrawl.scrapeUrl(fetchUrl, {
        formats: ['markdown'],
        onlyMainContent: false,
        waitFor: 3000,
      } as Parameters<typeof firecrawl.scrapeUrl>[1]);

      const content = (scraped as { markdown?: string }).markdown || '';
      if (content.length < 300) continue;

      const found = await parseHotelPage(content, hotelUrl, checkin, checkout, nights, guests);
      if (found) {
        // Even if price = 0, include it so user sees we checked this platform
        results.push(found);
      }
    } catch (err) {
      console.error(`[scraper] ${platform.name} error:`, err);
    }
  }

  return results;
}

async function parseHotelPage(
  content: string,
  url: string,
  checkin: string,
  checkout: string,
  nights: number,
  guests: number
): Promise<Hotel | null> {
  const prompt = `Extract hotel booking information from this page.
Stay: ${checkin} to ${checkout} (${nights} nights), ${guests} guest(s).

PAGE CONTENT:
---
${content.slice(0, 12000)}
---

Return ONLY valid JSON (no markdown, no code block):
{
  "name": "Hotel Name",
  "pricePerNight": 150,
  "totalPrice": 1050,
  "rating": 8.5,
  "reviewCount": 1234,
  "location": "Neighborhood, City",
  "currency": "USD",
  "stars": 4
}

Rules:
- pricePerNight: the nightly rate as a plain number. If only total shown, divide by ${nights}. If no price found, use 0.
- rating: 0-10 scale (multiply by 2 if site uses 0-5 scale)
- Use 0 / "" for any field you can't find`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const h = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (!h.name || String(h.name).length < 2) return null;

    const ppn = Number(h.pricePerNight) || 0;
    return {
      id: url,
      name: String(h.name),
      url,
      pricePerNight: ppn,
      totalPrice: Number(h.totalPrice) || ppn * nights,
      nights,
      rating: Number(h.rating) || 0,
      reviewCount: Number(h.reviewCount) || 0,
      location: String(h.location || ''),
      currency: String(h.currency || 'USD'),
      stars: Number(h.stars) || undefined,
    };
  } catch {
    return null;
  }
}

export async function scrapeHotelReviews(hotelUrl: string): Promise<string> {
  if (!hotelUrl) return '';
  try {
    const reviewUrl = hotelUrl.includes('booking.com') && !hotelUrl.includes('#')
      ? `${hotelUrl}#tab-reviews`
      : hotelUrl;

    const result = await firecrawl.scrapeUrl(reviewUrl, {
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 2000,
    } as Parameters<typeof firecrawl.scrapeUrl>[1]);

    const md = (result as { markdown?: string }).markdown || '';
    const idx = md.toLowerCase().indexOf('review');
    const start = idx > 300 ? idx - 100 : 0;
    return md.slice(start, start + 5000);
  } catch {
    return '';
  }
}
