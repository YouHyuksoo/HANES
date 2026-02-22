/**
 * @file src/app/not-found.tsx
 * @description 404 페이지 - 존재하지 않는 경로 접근 시 표시
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="text-lg text-text-muted">
          페이지를 찾을 수 없습니다.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  );
}
