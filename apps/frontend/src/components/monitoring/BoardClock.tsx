"use client";

/**
 * @file src/components/monitoring/BoardClock.tsx
 * @description 보드 현재시각 표시 — 1초 갱신을 이 컴포넌트 안에 가둬 보드 전체 리렌더를 막는다
 */
import { useState, useEffect } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 1초 간격 현재시각 훅 — SSR 하이드레이션 불일치 방지를 위해 초기값 null */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "HH:MM" / "HH:MM:SS" / "YYYY-MM-DD" 포맷 헬퍼 */
export function formatClock(now: Date) {
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    hm: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    hms: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    sec: pad(now.getSeconds()),
  };
}

export default function BoardClock({ className = "" }: { className?: string }) {
  const now = useNow();

  if (!now) return null;
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  return (
    <div className={`flex items-baseline gap-3 tabular-nums ${className}`}>
      <span className="text-sm uppercase tracking-[0.14em] text-text-muted">{date}</span>
      <span className="text-3xl font-extrabold leading-none tracking-tight text-text">{time}</span>
    </div>
  );
}
