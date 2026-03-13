"use client";

/**
 * @file src/app/pda/menu/page.tsx
 * @description PDA 메인 메뉴 — SMMEX 스타일 세로 리스트 레이아웃
 *
 * 초보자 가이드:
 * 1. pdaAllowedMenus: authStore에서 가져온 허용 메뉴 코드 목록
 * 2. menuCode 없는 항목(자재관리)은 항상 표시
 * 3. 로그아웃 버튼은 리스트 맨 아래 별도 표시
 * 4. PdaMenuGrid layout="list" — h-16 세로 리스트
 */
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import PdaHeader from "@/components/pda/PdaHeader";
import PdaMenuGrid from "@/components/pda/PdaMenuGrid";
import PwaInstallPrompt from "@/components/pda/PwaInstallPrompt";
import {
  pdaMainMenuItems,
  pdaLogoutItem,
} from "@/components/pda/pdaMenuConfig";

export default function PdaMenuPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, selectedCompany, selectedPlant, pdaAllowedMenus } =
    useAuthStore();

  const isAdmin = user?.role === "ADMIN";

  // ADMIN이면 전체 메뉴 표시, 일반 사용자는 pdaAllowedMenus 기반 필터링
  const visibleItems = isAdmin
    ? pdaMainMenuItems
    : pdaMainMenuItems.filter(
        (item) => !item.menuCode || pdaAllowedMenus.includes(item.menuCode)
      );

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

      {/* 메인 메뉴 — 세로 리스트 */}
      <PdaMenuGrid items={visibleItems} layout="list" />

      {/* 로그아웃 버튼 — 맨 아래 별도 */}
      <div className="px-4 pb-4 mt-auto">
        <button
          onClick={() => router.push(pdaLogoutItem.path)}
          className={[
            "flex flex-row items-center gap-4 h-16 px-5 rounded-xl w-full",
            "bg-white dark:bg-slate-900",
            "border-2",
            pdaLogoutItem.borderClass,
            "shadow-sm",
            "active:scale-[0.97] transition-transform",
          ].join(" ")}
        >
          <LogOut
            className={`w-6 h-6 shrink-0 ${pdaLogoutItem.iconColorClass}`}
          />
          <span className="text-base font-semibold text-slate-700 dark:text-slate-200">
            {t(pdaLogoutItem.labelKey)}
          </span>
        </button>
      </div>

      {/* 하단 버전 정보 */}
      <div className="p-4 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-600">
          HARNESS MES PDA v1.0
        </p>
      </div>
    </>
  );
}
