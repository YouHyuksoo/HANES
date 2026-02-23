"use client";

/**
 * @file src/app/(pda)/menu/page.tsx
 * @description PDA 메인 메뉴 - 2열 버튼 그리드로 7개 기능 진입
 *
 * 초보자 가이드:
 * 1. PdaHeader (hideBack): 메인 메뉴이므로 뒤로가기 없음
 * 2. PdaMenuGrid: 메인 메뉴 항목 2열 배치
 * 3. 하단: 회사/사업장 정보 표시
 */
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import PdaHeader from "@/components/pda/PdaHeader";
import PdaMenuGrid from "@/components/pda/PdaMenuGrid";
import PwaInstallPrompt from "@/components/pda/PwaInstallPrompt";
import { mainMenuItems } from "@/components/pda/pdaMenuConfig";

export default function PdaMenuPage() {
  const { t } = useTranslation();
  const { user, selectedCompany, selectedPlant } = useAuthStore();

  return (
    <>
      <PdaHeader titleKey="pda.title" hideBack />

      {/* 환영 메시지 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("pda.welcome", { name: user?.name || user?.email || "" })}
        </p>
        {(selectedCompany || selectedPlant) && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {[selectedCompany, selectedPlant].filter(Boolean).join(" / ")}
          </p>
        )}
      </div>

      {/* PWA 설치 배너 */}
      <PwaInstallPrompt />

      {/* 메뉴 그리드 */}
      <PdaMenuGrid items={mainMenuItems} />

      {/* 하단 버전 정보 */}
      <div className="mt-auto p-4 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-600">
          HARNESS MES PDA v1.0
        </p>
      </div>
    </>
  );
}
