"use client";

/**
 * @file src/components/improvement/ImprovementFAB.tsx
 * @description 개선요청 FAB 버튼 — 오버레이·모달 조합 루트
 *
 * 초보자 가이드:
 * 1. 항상 화면 우하단에 떠 있는 버튼 (fixed bottom-6 right-6)
 * 2. 비활성 상태: 🔧 아이콘 + 파란 배경
 * 3. 활성 상태: ✕ 아이콘 + 주황 배경 + 상단 안내 배너
 * 4. selectedElement가 생기면 ImprovementRequestModal 자동 표시
 */
import { useTranslation } from "react-i18next";
import { Wrench, X, LoaderCircle } from "lucide-react";
import { useImprovementRequestStore } from "@/stores/improvementRequestStore";
import ImprovementOverlay from "./ImprovementOverlay";
import ImprovementRequestModal from "./ImprovementRequestModal";

export default function ImprovementFAB() {
  const { t } = useTranslation();
  const { isActive, isCapturing, selectedElement, activate, deactivate } =
    useImprovementRequestStore();

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

      {/* FAB 버튼 */}
      <button
        onClick={() => (isActive ? deactivate() : activate())}
        title={isActive ? t("improvement.exitHint") : t("improvement.fabTooltip")}
        className={`
          fixed bottom-6 right-6 z-[50] w-12 h-12 rounded-full shadow-lg
          flex items-center justify-center transition-all duration-200
          ${isActive
            ? "bg-orange-500 hover:bg-orange-600 scale-110"
            : "bg-blue-600 hover:bg-blue-700"
          }
          text-white
        `}
      >
        {isActive ? (
          <X className="w-5 h-5" />
        ) : (
          <Wrench className="w-5 h-5" />
        )}
      </button>
    </>
  );
}
