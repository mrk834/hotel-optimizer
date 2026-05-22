import { Hotel } from '@/lib/types';

interface Props {
  hotel: Hotel;
  nights?: number;
  showValueScore?: boolean;
  compact?: boolean;
}

function getPlatformLabel(url: string): string {
  if (url.includes('booking.com')) return 'Booking.com';
  if (url.includes('agoda.com')) return 'Agoda';
  if (url.includes('hotels.com')) return 'Hotels.com';
  if (url.includes('expedia.com')) return 'Expedia';
  if (url.includes('tripadvisor.com')) return 'TripAdvisor';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return 'Other'; }
}

function getPlatformColor(url: string): string {
  if (url.includes('booking.com')) return 'bg-blue-100 text-blue-700';
  if (url.includes('agoda.com')) return 'bg-red-100 text-red-700';
  if (url.includes('hotels.com')) return 'bg-orange-100 text-orange-700';
  if (url.includes('expedia.com')) return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

function DealBadge({ dealRating, dealNote }: { dealRating: Hotel['dealRating']; dealNote?: string }) {
  if (!dealRating) return null;
  const config = {
    excellent: { bg: 'bg-emerald-500', label: '특가', icon: '🔥' },
    good: { bg: 'bg-green-500', label: '좋은 가격', icon: '✅' },
    fair: { bg: 'bg-gray-400', label: '평균 수준', icon: '📊' },
    expensive: { bg: 'bg-orange-400', label: '비싼 편', icon: '⚠️' },
  }[dealRating];
  return (
    <div className="mt-2">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-bold ${config.bg}`}>
        {config.icon} {config.label}
      </span>
      {dealNote && (
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{dealNote}</p>
      )}
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const color =
    rating >= 9 ? 'bg-emerald-500' : rating >= 8 ? 'bg-green-500' : rating >= 7 ? 'bg-yellow-500' : 'bg-orange-400';
  const label = rating >= 9 ? '최상' : rating >= 8 ? '매우 좋음' : rating >= 7 ? '좋음' : '보통';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-white text-sm font-bold ${color}`}>
      {rating.toFixed(1)} <span className="text-xs font-normal opacity-90">{label}</span>
    </span>
  );
}

function AuthBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? 'text-emerald-600 bg-emerald-50' : score >= 6 ? 'text-yellow-600 bg-yellow-50' : 'text-red-500 bg-red-50';
  const label = score >= 8 ? '진성 리뷰' : score >= 6 ? '신뢰도 보통' : '리뷰 주의';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {label} ({score}/10)
    </span>
  );
}

export default function HotelCard({ hotel, nights, showValueScore, compact }: Props) {
  const reviewAnalysis = hotel.reviewAnalysis;
  const displayNights = nights ?? hotel.nights;
  const totalCost = hotel.pricePerNight * displayNights;

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow ${compact ? 'p-4' : 'p-5'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold text-gray-900 truncate ${compact ? 'text-base' : 'text-lg'}`}>
            {hotel.name}
          </h3>
          {hotel.location && (
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {hotel.location}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          {hotel.rating > 0 && <RatingBadge rating={hotel.rating} />}
          {hotel.reviewCount > 0 && (
            <p className="text-xs text-gray-400 mt-1">{hotel.reviewCount.toLocaleString()}개 리뷰</p>
          )}
        </div>
      </div>

      {/* Price */}
      {hotel.priceUnavailable || hotel.pricePerNight === 0 ? (
        <div className="flex items-center gap-2 mb-3 py-2.5 px-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <span className="text-sm text-gray-400">가격 조회 실패 —</span>
          <a href={hotel.url} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline">사이트에서 직접 확인</a>
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-3 py-2.5 px-3 bg-blue-50 rounded-xl">
          <div>
            <span className="text-2xl font-black text-blue-700">${Math.round(hotel.pricePerNight)}</span>
            <span className="text-sm text-blue-500">/박</span>
          </div>
          {displayNights > 0 && (
            <div className="text-sm text-blue-600">
              × {displayNights}박 = <span className="font-bold">${Math.round(totalCost)}</span>
            </div>
          )}
          {showValueScore && hotel.valueScore && (
            <div className="ml-auto text-xs text-gray-500">
              가성비 <span className="font-bold text-purple-600">{hotel.valueScore.toFixed(1)}</span>
            </div>
          )}
        </div>
      )}

      {/* Deal badge */}
      {hotel.dealRating && (
        <DealBadge dealRating={hotel.dealRating} dealNote={hotel.dealNote} />
      )}

      {/* Platform price comparison */}
      {hotel.platformAlternatives && hotel.platformAlternatives.length > 0 && !compact && (
        <div className="mt-3 p-3 bg-gray-50 rounded-xl">
          <p className="text-xs font-semibold text-gray-500 mb-2">다른 사이트 가격 비교</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getPlatformColor(hotel.url)}`}>
                {getPlatformLabel(hotel.url)} ✓ 최저가
              </span>
              <span className="text-sm font-bold text-emerald-700">${Math.round(hotel.pricePerNight)}/박</span>
            </div>
            {hotel.platformAlternatives.map((alt, i) => (
              <div key={i} className="flex items-center justify-between">
                <a href={alt.url} target="_blank" rel="noopener noreferrer"
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${getPlatformColor(alt.url)} opacity-70 hover:opacity-100`}>
                  {getPlatformLabel(alt.url)}
                </a>
                {alt.priceUnavailable || alt.pricePerNight === 0 ? (
                  <span className="text-xs text-gray-400">직접 확인 필요</span>
                ) : (
                  <span className="text-sm text-gray-500">
                    ${Math.round(alt.pricePerNight)}/박
                    {hotel.pricePerNight > 0 && alt.pricePerNight > hotel.pricePerNight && (
                      <span className="text-red-400 ml-1">(+${Math.round(alt.pricePerNight - hotel.pricePerNight)})</span>
                    )}
                    {hotel.pricePerNight > 0 && alt.pricePerNight < hotel.pricePerNight && (
                      <span className="text-emerald-500 ml-1 font-semibold">(-${Math.round(hotel.pricePerNight - alt.pricePerNight)})</span>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviewAnalysis && !compact && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <AuthBadge score={reviewAnalysis.authenticityScore} />
            {reviewAnalysis.bestFor && (
              <span className="text-xs text-gray-500 italic">{reviewAnalysis.bestFor}</span>
            )}
          </div>

          {reviewAnalysis.pros.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-1">장점</p>
              <ul className="space-y-0.5">
                {reviewAnalysis.pros.map((pro, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reviewAnalysis.cons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1">단점</p>
              <ul className="space-y-0.5">
                {reviewAnalysis.cons.map((con, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">✗</span>
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reviewAnalysis.summary && (
            <p className="text-xs text-gray-500 border-t pt-2 mt-2 leading-relaxed">
              {reviewAnalysis.summary}
            </p>
          )}
        </div>
      )}

      {/* Link */}
      {hotel.url && !hotel.url.includes('searchresults') && (
        <a
          href={hotel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          Booking.com에서 보기
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}
