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
      <div style={{ backgroundImage: "url('/hero-bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 30%', minHeight: '420px' }}
        className="relative flex items-end">
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="relative w-full max-w-3xl mx-auto px-4 pb-12 pt-20 text-white">
          <h1 className="text-5xl md:text-7xl font-black leading-none drop-shadow-lg mb-3 tracking-tight">
            SUKISM TRIP
          </h1>
          <p className="text-white/80 text-base font-medium drop-shadow">Agoda에서 찾은 호텔 URL만 붙여넣으면 끝</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-8 pb-16">
        {/* Search form card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <SearchForm onSearch={handleSearch} loading={loading} />
        </div>

        {/* Feature explainer */}
        {!loading && !result && !error && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { icon: '💱', title: '플랫폼 가격 비교', desc: 'Booking.com·Hotels.com 가격 자동 비교' },
              { icon: '🏨', title: '나눠 묵기 최적화', desc: '1박+N박 등 모든 조합 계산해 최저가 찾기' },
              { icon: '🤖', title: 'AI 리뷰 분석', desc: '진성 리뷰만 골라 장단점·가성비 평가' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <div className="text-2xl mb-2">{icon}</div>
                <p className="text-xs font-bold text-gray-800 mb-1">{title}</p>
                <p className="text-xs text-gray-400 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        )}

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

      </div>
    </main>
  );
}
