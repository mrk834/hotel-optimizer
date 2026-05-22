import { OptimizationResult } from '@/lib/types';
import HotelCard from './HotelCard';
import SplitPlan from './SplitPlan';

interface Props {
  result: OptimizationResult;
}

export default function ResultsView({ result }: Props) {
  const { singleBest, splitOptions, bestSplit, recommendation, savings, topHotels, city, checkin, checkout, totalNights } = result;
  const singleTotal = singleBest ? Math.round(singleBest.pricePerNight * totalNights) : 0;

  return (
    <div className="space-y-8">
      {/* Summary banner */}
      <div className={`rounded-2xl p-5 ${recommendation === 'split' ? 'bg-emerald-600' : 'bg-blue-600'} text-white`}>
        <p className="text-sm opacity-80 mb-1">
          {city} · {checkin} ~ {checkout} · {totalNights}박
        </p>
        <h2 className="text-2xl font-black mb-1">
          {recommendation === 'split' ? '스플릿 숙박이 유리해요' : '한 곳 연박이 더 좋아요'}
        </h2>
        {savings > 0 && (
          <p className="text-lg opacity-90">
            {recommendation === 'split' ? `한 곳 대비 $${Math.round(savings)} 절약` : `스플릿 대비 $${Math.round(savings)} 절약`}
          </p>
        )}
      </div>

      {/* Best single stay */}
      {singleBest && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            최고 단일 숙박
            {recommendation === 'single' && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">추천</span>
            )}
          </h2>
          <HotelCard hotel={singleBest} nights={totalNights} showValueScore />
        </section>
      )}

      {/* Best split stays */}
      {splitOptions.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <span className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            나눠 묵기 — 호텔을 바꿔서 더 아끼기
          </h2>
          <p className="text-sm text-gray-400 mb-3 pl-9">
            1박+{totalNights-1}박부터 {Math.floor(totalNights/2)}박+{Math.ceil(totalNights/2)}박까지 모든 조합을 비교했어요.
            구간마다 실제 날짜로 재조회한 가격이에요.
          </p>
          <div className="space-y-4">
            {splitOptions.slice(0, 5).map((opt, i) => (
              <SplitPlan
                key={i}
                splitOption={opt}
                singleTotal={singleTotal}
                isRecommended={recommendation === 'split' && i === 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* No data state */}
      {!singleBest && splitOptions.length === 0 && topHotels.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="font-bold text-amber-800 mb-1">호텔 데이터를 가져오지 못했어요</p>
          <p className="text-sm text-amber-700">Booking.com이 스크래핑을 차단했을 수 있어요. 잠시 후 다시 시도하거나 날짜/도시를 바꿔보세요.</p>
        </div>
      )}

      {/* All top hotels */}
      {topHotels.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            가성비 TOP {topHotels.length} (AI 분석)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topHotels.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} nights={totalNights} showValueScore />
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-gray-400 text-center pb-4">
        가격은 Booking.com 기준이며 실시간 변동됩니다. 예약 전 직접 확인하세요.
      </p>
    </div>
  );
}
