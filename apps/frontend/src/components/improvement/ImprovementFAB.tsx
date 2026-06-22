"use client";

/**
 * @file src/components/improvement/ImprovementFAB.tsx
 * @description 우하단 FAB(speed dial) — 호버 시 액션 메뉴가 펼쳐진다.
 *
 * 초보자 가이드:
 * 1. 항상 화면 우하단에 떠 있는 메인 버튼 (fixed bottom-6 right-6)
 * 2. 메인 버튼에 마우스를 올리면(group-hover) 등록된 액션들이 위로 펼쳐진다.
 * 3. 액션: 개선요청 등록 / AI 채팅 / 전체화면 보기 (FAB_ACTIONS에 추가로 확장 가능)
 * 4. 개선요청 선택 모드(isActive)에서는 speed dial 대신 X(취소) 버튼 + 배너/오버레이 표시
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Wrench, X, LoaderCircle, Plus, MessageCircle, Maximize2, Minimize2 } from "lucide-react";
import { useImprovementRequestStore } from "@/stores/improvementRequestStore";
import { useAiChatStore } from "@/stores/aiChatStore";
import ImprovementOverlay from "./ImprovementOverlay";
import ImprovementRequestModal from "./ImprovementRequestModal";

export default function ImprovementFAB() {
  const { t } = useTranslation();
  const { isActive, isCapturing, selectedElement, activate, deactivate } =
    useImprovementRequestStore();
  const openAiChat = useAiChatStore((s) => s.open);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handle = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handle();
    document.addEventListener("fullscreenchange", handle);
    return () => document.removeEventListener("fullscreenchange", handle);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }, []);

  // 위에서부터 펼쳐지는 액션 목록 (메인 버튼 바로 위가 마지막 항목)
  const actions = [
    {
      key: "fullscreen",
      icon: isFullscreen ? Minimize2 : Maximize2,
      label: isFullscreen ? t("fab.exitFullscreen", "전체화면 종료") : t("fab.fullscreen", "전체화면 보기"),
      onClick: toggleFullscreen,
      color: "bg-slate-700 hover:bg-slate-800",
    },
    {
      key: "aichat",
      icon: MessageCircle,
      label: t("fab.aiChat", "AI 채팅"),
      onClick: openAiChat,
      color: "bg-violet-600 hover:bg-violet-700",
    },
    {
      key: "improve",
      icon: Wrench,
      label: t("improvement.fabTooltip", "개선요청 등록"),
      onClick: activate,
      color: "bg-blue-600 hover:bg-blue-700",
    },
  ];

  return (
    <>
      {/* 선택 모드 안내 배너 */}
      {isActive && (
        <div className="fixed top-[var(--header-height)] left-0 right-0 z-[50] flex items-center justify-center py-2 bg-orange-500 text-white text-sm font-medium shadow-md">
          <span>{t("improvement.selectHint")}</span>
          <span className="ml-3 text-xs opacity-80">{t("improvement.exitHint")}</span>
        </div>
      )}

      {/* 오버레이 (선택 모드 활성 + 캡처 중 아닐 때) */}
      {isActive && !selectedElement && !isCapturing && <ImprovementOverlay />}

      {/* 캡처 중 로딩 UI */}
      {isCapturing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-2xl px-8 py-5 flex flex-col items-center gap-3 shadow-2xl border border-border">
            <LoaderCircle className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-sm font-medium text-text">{t("improvement.capturing")}</p>
          </div>
        </div>
      )}

      {/* 입력 모달 */}
      <ImprovementRequestModal />

      {/* 선택 모드: 취소 버튼만 노출 */}
      {isActive ? (
        <button
          onClick={deactivate}
          title={t("improvement.exitHint")}
          className="fixed bottom-6 right-6 z-[50] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 bg-orange-500 hover:bg-orange-600 scale-110 text-white"
        >
          <X className="w-5 h-5" />
        </button>
      ) : (
        /* Speed dial: 호버 시 액션 펼침 */
        <div className="group fixed bottom-6 right-6 z-[50] flex flex-col items-end gap-3">
          {actions.map((action, idx) => (
            <button
              key={action.key}
              onClick={action.onClick}
              title={action.label}
              style={{ transitionDelay: `${idx * 40}ms` }}
              className="flex items-center gap-2 opacity-0 translate-y-3 pointer-events-none transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
            >
              <span className="rounded-md bg-slate-900/90 px-2 py-1 text-xs font-medium text-white shadow whitespace-nowrap dark:bg-slate-700">
                {action.label}
              </span>
              <span className={`flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </span>
            </button>
          ))}

          {/* 메인 FAB */}
          <button
            title={t("fab.menuTooltip", "메뉴")}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform duration-200 hover:bg-blue-700 group-hover:rotate-45"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      )}
    </>
  );
}
