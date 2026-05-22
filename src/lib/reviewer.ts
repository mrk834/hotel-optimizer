import Anthropic from '@anthropic-ai/sdk';
import { Hotel, ReviewAnalysis } from './types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function analyzeReviews(
  hotelName: string,
  reviewContent: string,
  rating: number,
  reviewCount: number
): Promise<ReviewAnalysis> {
  if (!reviewContent || reviewContent.length < 100) {
    return buildFallback(rating, reviewCount);
  }

  const prompt = `당신은 여행 전문가이자 호텔 리뷰 분석가입니다. "${hotelName}"의 리뷰를 분석하고 JSON 객체를 반환하세요.

호텔 정보: 평점 ${rating}/10, 리뷰 수 ${reviewCount}개.

리뷰 내용:
---
${reviewContent}
---

아래 구조의 JSON만 반환하세요 (마크다운, 설명 없이):
{
  "pros": ["구체적인 장점 1", "구체적인 장점 2", "구체적인 장점 3"],
  "cons": ["구체적인 단점 1", "구체적인 단점 2", "구체적인 단점 3"],
  "authenticityScore": <0-10 정수, 10=모두 진성, 0=명백히 가짜>,
  "authenticityReason": "<진성 점수 이유를 한 문장으로>",
  "bestFor": "<이 호텔에 가장 잘 맞는 여행자 유형, 예: '조용하고 빠른 와이파이가 필요한 비즈니스 여행자'>",
  "summary": "<2-3문장으로 솔직한 호텔 경험 요약>"
}

규칙:
- 모든 텍스트는 반드시 한국어로 작성
- 장단점은 구체적으로 (예: "에펠탑에서 도보 5분" — "위치 좋음" 같은 모호한 표현 금지)
- 진성 점수 감점 요인: 매우 짧은 리뷰, 별점 5점만 있음, 구체적 내용 없음, 반복 문구
- bestFor: 여행자 유형을 구체적으로
- summary: 솔직하게, 전체적으로 좋더라도 단점 한 가지 포함`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const json = JSON.parse(text.trim());
    return {
      pros: json.pros || [],
      cons: json.cons || [],
      authenticityScore: Number(json.authenticityScore) || 5,
      authenticityReason: json.authenticityReason || '',
      bestFor: json.bestFor || '',
      summary: json.summary || '',
    };
  } catch {
    return buildFallback(rating, reviewCount);
  }
}

export async function assessPrices(
  hotels: Hotel[],
  city: string,
  checkin: string
): Promise<void> {
  if (!hotels.length) return;

  const month = new Date(checkin).toLocaleString('en-US', { month: 'long' });
  const hotelList = hotels
    .map((h) => `- "${h.name}": $${Math.round(h.pricePerNight)}/night, rating ${h.rating}/10, ${h.reviewCount} reviews, ${h.location}`)
    .join('\n');

  const prompt = `You are a travel pricing expert with deep knowledge of hotel prices worldwide.

City: ${city}
Travel month: ${month}
Hotels to assess:
${hotelList}

For each hotel, assess whether the nightly price is a good deal for this city and season.
Consider: typical price range for this city/season, hotel rating, number of reviews, location.

Return ONLY valid JSON (no markdown):
{
  "assessments": [
    {
      "name": "exact hotel name",
      "dealRating": "excellent" | "good" | "fair" | "expensive",
      "dealNote": "한국어로 1줄 설명 (예: '7월 파리 기준 평균보다 30% 저렴', '성수기 대비 적정 수준')"
    }
  ]
}

dealRating scale:
- excellent: 시세 대비 20%+ 저렴하거나 가성비 탁월
- good: 시세 대비 적당하거나 살짝 저렴
- fair: 시세 수준 (보통)
- expensive: 시세 대비 비싼 편`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]) as {
      assessments: Array<{ name: string; dealRating: Hotel['dealRating']; dealNote: string }>;
    };

    for (const assessment of parsed.assessments) {
      const hotel = hotels.find(
        (h) => h.name.toLowerCase().includes(assessment.name.toLowerCase()) ||
               assessment.name.toLowerCase().includes(h.name.toLowerCase())
      );
      if (hotel) {
        hotel.dealRating = assessment.dealRating;
        hotel.dealNote = assessment.dealNote;
      }
    }
  } catch (err) {
    console.error('Price assessment error:', err);
  }
}

function buildFallback(rating: number, reviewCount: number): ReviewAnalysis {
  const auth = reviewCount > 500 ? 8 : reviewCount > 100 ? 6 : 4;
  return {
    pros: rating >= 8 ? ['전반적으로 높은 투숙객 만족도', '일관되게 긍정적인 리뷰'] : ['합리적인 가격대'],
    cons: ['리뷰 상세 내용 확인 불가'],
    authenticityScore: auth,
    authenticityReason: '리뷰 수량 기준으로 추정한 점수입니다',
    bestFor: '일반 여행자',
    summary: `${reviewCount}명이 ${rating}/10 평점을 부여했습니다. 상세 리뷰 분석이 불가합니다 — 호텔 페이지에서 직접 확인하세요.`,
  };
}
