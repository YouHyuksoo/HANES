"use client";

/**
 * @file src/components/monitoring/BoardClock.tsx
 * @description 보드 현재시각 표시 — 1초 갱신을 이 컴포넌트 안에 가둬 보드 전체 리렌더를 막는다
 */
import { useState, useEffect } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function BoardClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

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
