import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Only for SU trip',
  description:
    '호텔 URL 하나만 넣으면 Booking.com·Agoda·Hotels.com 가격을 자동으로 비교하고, 날짜별로 다른 호텔을 조합하는 스플릿 숙박 최적 플랜까지 찾아드립니다. AI 리뷰 분석으로 진성 리뷰만 골라 장단점을 정리하고, 이 도시·이 시즌 기준 시세 대비 좋은 가격인지도 알려드려요.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-slate-50">{children}</body>
    </html>
  );
}
