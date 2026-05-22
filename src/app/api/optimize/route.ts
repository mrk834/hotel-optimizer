import { NextRequest } from 'next/server';
import { scrapeHotelByUrl, scrapeHotelReviews, findSameHotelOnOtherPlatforms } from '@/lib/scraper';
import { analyzeReviews, assessPrices } from '@/lib/reviewer';
import { computeValueScore, groupHotelsByName, buildPlatformComparison, getUniquePeriods, buildSplitOptionsWithActualPrices } from '@/lib/optimizer';
import { Hotel, ProgressEvent, SearchParams } from '@/lib/types';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const params: SearchParams = await req.json();
  const { urls, checkin, checkout, guests = 2 } = params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const totalNights = Math.round(
          (new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000
        );
        const totalSteps = 6;

        // Step 1: Scrape each user-provided URL
        emit({ type: 'progress', step: 1, totalSteps, message: `호텔 정보 수집 중 (${urls.length}개)...` });

        const baseHotels: Hotel[] = [];
        for (const url of urls) {
          const hotel = await scrapeHotelByUrl(url, checkin, checkout, guests);
          if (hotel) {
            baseHotels.push(hotel);
            emit({ type: 'hotel_found', hotelName: hotel.name });
          }
        }

        if (baseHotels.length === 0) {
          emit({ type: 'error', error: '호텔 정보를 가져오지 못했어요. URL을 확인하거나 다른 사이트 URL을 써보세요.' });
          controller.close();
          return;
        }

        // Step 2: Find same hotels on other platforms (auto cross-platform search)
        emit({ type: 'progress', step: 2, totalSteps, message: 'Booking.com·Agoda·Hotels.com 가격 비교 중...' });

        const allHotelsRaw: Hotel[] = [...baseHotels];
        for (const hotel of baseHotels) {
          emit({ type: 'progress', step: 2, totalSteps, message: `"${hotel.name}" — 다른 플랫폼 검색 중...` });
          const alts = await findSameHotelOnOtherPlatforms(hotel, checkin, checkout, guests);
          allHotelsRaw.push(...alts);
          if (alts.length > 0) {
            emit({ type: 'hotel_found', hotelName: `${hotel.name} → ${alts.length}개 플랫폼 추가` });
          }
        }

        // Step 3: Review analysis for unique hotels
        emit({ type: 'progress', step: 3, totalSteps, message: 'AI 리뷰 분석 중...' });

        // Group by name → keep cheapest per platform combo
        const groups = groupHotelsByName(allHotelsRaw);
        const dedupedHotels = buildPlatformComparison(groups);

        for (const hotel of dedupedHotels) {
          try {
            const reviewContent = await scrapeHotelReviews(hotel.url);
            const analysis = await analyzeReviews(hotel.name, reviewContent, hotel.rating, hotel.reviewCount);
            hotel.reviewAnalysis = analysis;
            emit({ type: 'review_done', hotelName: hotel.name });
          } catch { /* continue */ }
        }

        // Step 4: Price assessment
        emit({ type: 'progress', step: 4, totalSteps, message: '시세 대비 가격 평가 중...' });
        const city = dedupedHotels[0]?.location?.split(',').slice(-1)[0]?.trim() || '';
        await assessPrices(dedupedHotels.filter((h) => h.pricePerNight > 0), city, checkin);

        // Value scores
        for (const hotel of dedupedHotels) {
          hotel.valueScore = computeValueScore(hotel);
        }

        // Step 5: Scrape actual prices for each hotel × sub-period (real pricing per dates)
        emit({ type: 'progress', step: 5, totalSteps, message: '구간별 실제 가격 조회 중...' });

        const uniquePeriods = getUniquePeriods(checkin, checkout);
        const periodPrices = new Map<string, Map<string, number>>();
        for (const hotel of dedupedHotels) periodPrices.set(hotel.id, new Map());

        // Batch scrape: 3 concurrent at a time
        const tasks = dedupedHotels.flatMap((hotel) =>
          uniquePeriods.map((period) => ({ hotel, period }))
        );
        const BATCH = 3;
        for (let i = 0; i < tasks.length; i += BATCH) {
          await Promise.all(
            tasks.slice(i, i + BATCH).map(async ({ hotel, period }) => {
              try {
                const result = await scrapeHotelByUrl(hotel.url, period.checkin, period.checkout, guests);
                if (result?.pricePerNight) {
                  periodPrices.get(hotel.id)?.set(period.key, result.pricePerNight);
                }
              } catch { /* fall back to base price */ }
            })
          );
        }

        const sortedByValue = [...dedupedHotels].sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0));
        const singleBest = sortedByValue[0] || null;

        const splitOptions = buildSplitOptionsWithActualPrices(dedupedHotels, periodPrices, checkin, checkout);
        const bestSplit = splitOptions[0] || null;

        const singleTotal = singleBest ? singleBest.pricePerNight * totalNights : Infinity;
        const splitTotal = bestSplit?.totalCost ?? Infinity;
        const recommendation = isFinite(splitTotal) && splitTotal < singleTotal ? 'split' : 'single';
        const savings = isFinite(singleTotal) && isFinite(splitTotal) ? Math.abs(singleTotal - splitTotal) : 0;

        emit({
          type: 'complete',
          data: {
            singleBest,
            splitOptions,
            bestSplit,
            recommendation,
            savings,
            topHotels: sortedByValue.slice(0, 12),
            city,
            checkin,
            checkout,
            totalNights,
          },
        });
      } catch (err) {
        emit({ type: 'error', error: String(err) });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
