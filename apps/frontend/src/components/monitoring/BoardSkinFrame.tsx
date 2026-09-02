"use client";

/**
 * @file src/components/monitoring/BoardSkinFrame.tsx
 * @description 모니터링 보드 공통 프레임 — 스킨이 화면 전체를 그리고, 우상단에 플로팅 컨트롤을 얹는다.
 *              5개 보드(생산/품질/재고/작업지시/설비가동)가 같은 위치·같은 순서의 컨트롤을 쓰도록 단일화.
 *
 * 컨트롤 순서(고정): [A][B][C] | (일시정지) 새로고침 설정 TV모드
 * - 일시정지는 onTogglePause 를 넘긴 보드에만 표시된다(순환 목록이 있는 보드).
 * - 평소 반투명(opacity 30%), 호버 시 선명.
 */
import type { ReactNode } from "react";
import { Maximize2, Minimize2, Pause, Play, RefreshCw, Settings } from "lucide-react";

export interface BoardSkinOption<T extends string> {
  id: T;
  /** 버튼 글자 (A/B/C) */
  label: string;
  /** 툴팁 — 스킨 이름 */
  title: string;
}

interface BoardSkinFrameProps<T extends string> {
  skins: readonly BoardSkinOption<T>[];
  skin: T;
  onSkinChange: (skin: T) => void;
  tvMode: boolean;
  onToggleTv: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  onSettings: () => void;
  paused?: boolean;
  onTogglePause?: () => void;
  children: ReactNode;
}

const CTL_BTN = "w-8 h-8 flex items-center justify-center rounded hover:bg-white/20 transition-colors";

export default function BoardSkinFrame<T extends string>({
  skins, skin, onSkinChange, tvMode, onToggleTv, onRefresh, refreshing = false, onSettings, paused, onTogglePause, children,
}: BoardSkinFrameProps<T>) {
  return (
    <div className={tvMode ? "fixed inset-0 z-50" : "h-full"}>
      <div className="relative w-full h-full overflow-hidden">
        {children}

        <div className="absolute top-3 right-3 z-20 flex items-center gap-0.5 rounded-lg bg-black/50 backdrop-blur px-1.5 py-1 text-white/90 opacity-30 hover:opacity-100 transition-opacity">
          {skins.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.title}
              onClick={() => onSkinChange(s.id)}
              className={`w-8 h-8 rounded text-sm font-bold transition-colors ${skin === s.id ? "bg-white text-black" : "hover:bg-white/20"}`}
            >
              {s.label}
            </button>
          ))}
          <span className="w-px h-5 bg-white/25 mx-1" />
          {onTogglePause && (
            <button type="button" className={CTL_BTN} onClick={onTogglePause} title={paused ? "재생" : "일시정지"}>
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          )}
          <button type="button" className={CTL_BTN} onClick={onRefresh} title="새로고침">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button type="button" className={CTL_BTN} onClick={onSettings} title="설정">
            <Settings className="w-4 h-4" />
          </button>
          <button type="button" className={CTL_BTN} onClick={onToggleTv} title="TV 모드">
            {tvMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
