import { SplitOption } from '@/lib/types';
import HotelCard from './HotelCard';

interface Props {
  splitOption: SplitOption;
  singleTotal?: number;
  isRecommended?: boolean;
}

export default function SplitPlan({ splitOption, singleTotal, isRecommended }: Props) {
  const savings = singleTotal ? Math.round(singleTotal - splitOption.totalCost) : 0;

  return (
    <div className={`rounded-2xl border-2 p-5 ${isRecommended ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            {isRecommended && (
              <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">
                추천
              </span>
            )}
            <h3 className="font-bold text-gray-900">{splitOption.splitLabel} 스플릿</h3>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            평균 평점 {splitOption.avgRating.toFixed(1)} · {splitOption.segments.length}개 호텔
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-gray-900">${Math.round(splitOption.totalCost)}</p>
          {savings > 0 && (
            <p className="text-sm font-semibold text-emerald-600">
              ${savings} 절약
            </p>
          )}
          {savings < 0 && (
            <p className="text-sm text-gray-400">
              ${Math.abs(savings)} 추가
            </p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative mb-4">
        <div className="flex items-stretch">
          {splitOption.segments.map((seg, i) => {
            const pct = (seg.nights / splitOption.segments.reduce((s, x) => s + x.nights, 0)) * 100;
            return (
              <div key={i} className="relative" style={{ width: `${pct}%` }}>
                <div
                  className={`h-8 flex items-center justify-center text-xs font-bold text-white rounded-${i === 0 ? 'l' : 'r'}-lg ${i === 0 ? 'bg-blue-500' : 'bg-indigo-500'}`}
                  style={{ borderRadius: i === 0 ? '8px 0 0 8px' : '0 8px 8px 0' }}
                >
                  {seg.nights}박
                </div>
                <p className="text-xs text-center text-gray-500 mt-1">
                  {seg.checkin.slice(5)} → {seg.checkout.slice(5)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hotel cards for each segment */}
      <div className="space-y-3">
        {splitOption.segments.map((seg, i) => {
          const basePpn = seg.hotel.pricePerNight;
          const fullPeriodPpn = seg.hotel.totalPrice / seg.hotel.nights; // original 7-night rate
          const diff = basePpn - fullPeriodPpn;
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  구간 {i + 1}: {seg.checkin.slice(5)} ~ {seg.checkout.slice(5)} ({seg.nights}박)
                </p>
                {Math.abs(diff) > 1 && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${diff < 0 ? 'text-emerald-600 bg-emerald-50' : 'text-orange-500 bg-orange-50'}`}>
                    {diff < 0 ? `이 구간 $${Math.abs(Math.round(diff))} 저렴` : `이 구간 $${Math.round(diff)} 비쌈`}
                  </span>
                )}
              </div>
              <HotelCard hotel={seg.hotel} nights={seg.nights} compact />
            </div>
          );
        })}
      </div>
    </div>
  );
}
