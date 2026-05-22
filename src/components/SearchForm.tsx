'use client';

import { useState } from 'react';
import { SearchParams } from '@/lib/types';

interface Props {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
}

function getSourceLabel(url: string): string {
  if (url.includes('booking.com')) return 'Booking.com';
  if (url.includes('agoda.com')) return 'Agoda';
  if (url.includes('hotels.com')) return 'Hotels.com';
  if (url.includes('expedia.com')) return 'Expedia';
  if (url.includes('tripadvisor.com')) return 'TripAdvisor';
  if (url.includes('airbnb.com')) return 'Airbnb';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return '링크'; }
}

function getSourceColor(url: string): string {
  if (url.includes('booking.com')) return 'bg-blue-100 text-blue-700';
  if (url.includes('agoda.com')) return 'bg-red-100 text-red-700';
  if (url.includes('hotels.com')) return 'bg-orange-100 text-orange-700';
  if (url.includes('expedia.com')) return 'bg-yellow-100 text-yellow-800';
  if (url.includes('tripadvisor.com')) return 'bg-green-100 text-green-700';
  return 'bg-gray-100 text-gray-600';
}

export default function SearchForm({ onSearch, loading }: Props) {
  const [urls, setUrls] = useState<string[]>(['', '']);
  const [checkin, setCheckin] = useState('2026-07-13');
  const [checkout, setCheckout] = useState('2026-07-20');
  const [guests, setGuests] = useState(2);
  const [pasteMode, setPasteMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const nights =
    checkin && checkout
      ? Math.max(0, Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000))
      : 0;

  const validUrls = urls.filter((u) => u.trim().startsWith('http'));

  const handleAddUrl = () => setUrls((prev) => [...prev, '']);
  const handleRemoveUrl = (i: number) => setUrls((prev) => prev.filter((_, idx) => idx !== i));
  const handleUrlChange = (i: number, val: string) => {
    setUrls((prev) => prev.map((u, idx) => (idx === i ? val.trim() : u)));
  };

  const handleBulkApply = () => {
    const parsed = bulkText
      .split(/[\n,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('http'));
    if (parsed.length > 0) {
      setUrls([...parsed, '']);
      setPasteMode(false);
      setBulkText('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validUrls.length === 0) return;
    onSearch({ urls: validUrls, checkin, checkout, guests });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Dates + guests */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">체크인</label>
          <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">체크아웃</label>
          <input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">인원</label>
          <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}명</option>)}
          </select>
        </div>
      </div>

      {nights > 0 && (
        <p className="text-sm text-gray-500">총 <strong>{nights}박</strong></p>
      )}

      {/* URL inputs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            호텔 URL 붙여넣기
          </label>
          <button type="button" onClick={() => setPasteMode(!pasteMode)}
            className="text-xs text-blue-600 hover:underline">
            {pasteMode ? '한 줄씩 입력' : '여러 개 한번에'}
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-3">
          Booking.com, Agoda, Hotels.com, 공식 사이트 어디든 OK. URL 하나만 넣어도 다른 플랫폼 가격을 자동으로 찾아 비교해드려요.
        </p>

        {pasteMode ? (
          <div className="space-y-2">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"URL을 줄바꿈 또는 쉼표로 구분해서 붙여넣기\n\nhttps://www.booking.com/hotel/...\nhttps://www.agoda.com/..."}
              rows={5}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <button type="button" onClick={handleBulkApply}
              className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">
              적용
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {urls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(i, e.target.value)}
                    placeholder="https://www.booking.com/hotel/..."
                    className="w-full pl-3 pr-24 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  {url && (
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 rounded font-medium ${getSourceColor(url)}`}>
                      {getSourceLabel(url)}
                    </span>
                  )}
                </div>
                {urls.length > 1 && (
                  <button type="button" onClick={() => handleRemoveUrl(i)}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                    ✕
                  </button>
                )}
              </div>
            ))}

            <button type="button" onClick={handleAddUrl}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mt-1">
              <span className="text-lg leading-none">+</span> 호텔 추가
            </button>
          </div>
        )}
      </div>

      {/* Valid URL count */}
      {validUrls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {validUrls.map((url, i) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSourceColor(url)}`}>
              {getSourceLabel(url)}
            </span>
          ))}
          <span className="text-xs text-gray-400 self-center">
            {validUrls.length}개 분석 예정
          </span>
        </div>
      )}

      <button type="submit" disabled={loading || validUrls.length === 0 || nights <= 0}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold text-lg rounded-xl transition-colors flex items-center justify-center gap-2">
        {loading ? (
          <><span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />분석 중...</>
        ) : (
          `${validUrls.length}개 호텔 분석 시작`
        )}
      </button>
    </form>
  );
}
