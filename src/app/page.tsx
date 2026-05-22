'use client';

import { useState } from 'react';
import SearchForm from '@/components/SearchForm';
import ResultsView from '@/components/ResultsView';
import { OptimizationResult, ProgressEvent, SearchParams } from '@/lib/types';

interface ProgressState {
  step: number;
  totalSteps: number;
  message: string;
  reviewsDone: string[];
}

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (params: SearchParams) => {
    setLoading(true);
    setResult(null);
    setError(null);
    setProgress({ step: 1, totalSteps: 4, message: '검색 시작 중...', reviewsDone: [] });

    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok || !response.body) {
        throw new Error('서버 오류가 발생했습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: ProgressEvent = JSON.parse(line.slice(6));

            if (event.type === 'progress') {
              setProgress((prev) => ({
                step: event.step || 1,
                totalSteps: event.totalSteps || 4,
                message: event.message || '',
                reviewsDone: prev?.reviewsDone || [],
              }));
            } else if (event.type === 'review_done') {
              setProgress((prev) =>
                prev
                  ? { ...prev, reviewsDone: [...prev.reviewsDone, event.hotelName || ''] }
                  : null
              );
            } else if (event.type === 'complete' && event.data) {
              setResult(event.data as OptimizationResult);
            } else if (event.type === 'error') {
              setError(event.error || '알 수 없는 오류');
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-blue-200 text-sm font-medium tracking-widest uppercase mb-4">Only for SU trip</p>
          <h1 className="text-4xl md:text-5xl font-black mb-5 leading-tight">
            호텔 URL 하나로<br />최저가 + 최적 조합 찾기
          </h1>

          {/* Split stay concept explainer */}
          <div className="bg-white/10 backdrop-blur rounded-2xl px-5 py-4 max-w-xl mx-auto mb-4 text-left">
            <p className="text-white font-semibold text-sm mb-2">💡 이런 걸 해드려요</p>
            <div className="space-y-2 text-blue-100 text-sm leading-relaxed">
              <p>
                <span className="text-white font-medium">① 플랫폼 가격 비교</span><br />
                호텔 URL 하나를 입력하면 Booking.com·Agoda·Hotels.com을 자동으로 뒤져서 어디가 제일 싼지 비교해요.
              </p>
              <p>
                <span className="text-white font-medium">② 나눠 묵기 최적 조합</span><br />
                7박이면 A호텔 1박 → B호텔 6박, 혹은 3박 → 4박 등 모든 조합을 계산해요.
                호텔마다 날짜별 가격이 다르기 때문에, 나눠 묵으면 한 곳만 있는 것보다 더 저렴해지는 경우가 있어요.
              </p>
              <p>
                <span className="text-white font-medium">③ AI 리뷰 분석</span><br />
                진성 리뷰를 골라 장단점을 정리하고, 이 시기 파리 시세 대비 가격이 좋은지 나쁜지도 알려드려요.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-6 pb-16">
        {/* Search form card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <SearchForm onSearch={handleSearch} loading={loading} />
        </div>

        {/* Progress */}
        {loading && progress && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="font-semibold text-gray-800">{progress.message}</p>
            </div>
            <div className="flex gap-2 mb-2">
              {Array.from({ length: progress.totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < progress.step ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500">단계 {progress.step}/{progress.totalSteps}</p>
            {progress.reviewsDone.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium text-gray-500 mb-2">AI 리뷰 분석 완료:</p>
                {progress.reviewsDone.map((name) => (
                  <p key={name} className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="text-emerald-500">✓</span>
                    {name}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-8">
            <p className="font-semibold text-red-700 mb-1">오류 발생</p>
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-red-400 mt-2">
              FIRECRAWL_API_KEY와 ANTHROPIC_API_KEY가 .env.local에 설정되어 있는지 확인하세요.
            </p>
          </div>
        )}

        {/* Results */}
        {result && <ResultsView result={result} />}

        {/* Empty state */}
        {!loading && !result && !error && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">🏨</div>
            <p className="text-lg font-medium text-gray-500">위에서 조건을 입력하고 검색하세요</p>
            <p className="text-sm mt-1">Booking.com 실시간 가격 + AI 리뷰 분석</p>
          </div>
        )}
      </div>
    </main>
  );
}
