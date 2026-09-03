/**
 * @file src/app/(authenticated)/dashboard/components/skins.ts
 * @description 대시보드 스킨 3종 — 모니터링 보드와 같은 톤 규칙(A 다크 네온 / B 앰버 모노 / C 다크 편집).
 *
 * 왜 CSS 변수 오버라이드인가:
 * 대시보드 컴포넌트 5개(PulseLine/ValueStream/RhythmStrip/InspectRails/AttentionQueue)는
 * 색을 전부 의미 토큰(text-primary, bg-error, border-border …)으로만 쓴다.
 * 이 토큰은 globals.css에서 `--color-primary: var(--primary)` 식으로 CSS 변수에 묶여 있으므로,
 * 래퍼 한 겹에서 변수만 바꾸면 컴포넌트를 한 줄도 고치지 않고 스킨이 통째로 바뀐다.
 * 스킨을 추가할 때도 이 파일에 항목 하나만 늘리면 된다.
 *
 * 모든 스킨은 다크 배경이다(모니터링 보드 규칙: 흰색/라이트 배경 금지).
 */
import type { CSSProperties } from "react";

export type DashboardSkinId = "control" | "departure" | "datawall";

export const DASHBOARD_SKIN_IDS = ["control", "departure", "datawall"] as const;

export interface DashboardSkin {
  id: DashboardSkinId;
  /** 전환 버튼 글자 — 모니터링과 같은 A/B/C */
  label: "A" | "B" | "C";
  /** 툴팁·설정용 i18n 키 */
  titleKey: string;
  /** 래퍼에 얹는 토큰 오버라이드 */
  vars: CSSProperties;
  /** 숫자·본문 서체 — 앰버 모노는 전광판답게 모노스페이스 */
  fontClass?: string;
}

/**
 * 토큰 키는 globals.css의 원본 변수명과 같아야 한다.
 * (--text/--text-muted 는 --foreground 를 거치지 않고 직접 덮는다)
 */
const vars = (v: Record<string, string>): CSSProperties => v as CSSProperties;

export const DASHBOARD_SKINS: readonly DashboardSkin[] = [
  {
    // A 관제탑 — 깊은 남색 위에 시안 네온. 현장 어두운 곳에서 숫자가 먼저 보인다.
    id: "control",
    label: "A",
    titleKey: "dashboard.skin.control",
    vars: vars({
      "--background": "#0b1220",
      "--card": "#101a2c",
      "--surface": "#152238",
      "--muted": "#1a2740",
      "--border": "rgba(148, 163, 184, 0.18)",
      "--text": "#e6edf7",
      "--text-muted": "#8b9bb4",
      "--primary": "#22d3ee",
      "--primary-foreground": "#03141a",
      "--success": "#34d399",
      "--warning": "#fbbf24",
      "--error": "#fb7185",
      "--info": "#60a5fa",
    }),
  },
  {
    // B 출발 전광판 — 검정 위에 앰버 단색. 옛 공항 전광판처럼 밝기 차이로만 위계를 만든다.
    id: "departure",
    label: "B",
    titleKey: "dashboard.skin.departure",
    vars: vars({
      "--background": "#131108",
      "--card": "#1a170b",
      "--surface": "#211d0e",
      "--muted": "#2a2410",
      "--border": "#3d3212",
      "--text": "#fde68a",
      "--text-muted": "#8a6d1c",
      "--primary": "#fbbf24",
      "--primary-foreground": "#1a1200",
      "--success": "#34d399",
      "--warning": "#fbbf24",
      "--error": "#ef4444",
      "--info": "#b9922a",
    }),
    fontClass: "font-mono",
  },
  {
    // C 데이터 월 — 먹색 종이 위 상아색 글자, 강조는 주홍 하나. 편집 디자인 톤.
    id: "datawall",
    label: "C",
    titleKey: "dashboard.skin.datawall",
    vars: vars({
      "--background": "#14120e",
      "--card": "#1a1813",
      "--surface": "#2a2721",
      "--muted": "#221f19",
      "--border": "#3a352c",
      "--text": "#ece7da",
      "--text-muted": "#8d887c",
      "--primary": "#f0402c",
      "--primary-foreground": "#fff7f0",
      "--success": "#9ccf8f",
      "--warning": "#e6b04b",
      "--error": "#f0402c",
      "--info": "#8fb4cf",
    }),
  },
];

export const DASHBOARD_SKIN_STORAGE_KEY = "dashboard:skin";
export const DASHBOARD_DEFAULT_SKIN: DashboardSkinId = "control";
