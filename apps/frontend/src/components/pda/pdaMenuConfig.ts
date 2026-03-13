/**
 * @file src/components/pda/pdaMenuConfig.ts
 * @description PDA 메뉴 설정 - SMMEX 스타일 메인/서브메뉴 항목 정의
 *
 * 초보자 가이드:
 * 1. **PdaMenuItem**: 메뉴 항목 타입 (i18n 키, 경로, lucide 아이콘, 테두리/아이콘 색상)
 * 2. **pdaMainMenuItems**: 세로 리스트 메인 메뉴 (h-16 버튼)
 * 3. **pdaMaterialSubMenuItems**: 자재관리 2열 그리드 서브메뉴 (h-20 버튼)
 * 4. **pdaLogoutItem**: 맨 아래 별도 표시되는 로그아웃 버튼
 *
 * 주의: Tailwind borderClass/iconColorClass는 동적 조합 금지 (PurgeCSS 대응)
 *       반드시 완전한 클래스 문자열로 정의할 것
 */
import {
  Package,
  Truck,
  Wrench,
  ClipboardCheck,
  LogOut,
  Download,
  Upload,
  Settings2,
  FileSearch,
  type LucideIcon,
} from "lucide-react";

export interface PdaMenuItem {
  /** i18n 번역 키 */
  labelKey: string;
  /** 이동 경로 */
  path: string;
  /** lucide 아이콘 컴포넌트 */
  icon: LucideIcon;
  /** 테두리 색상 클래스 (완전한 Tailwind 문자열 — 동적 조합 금지) */
  borderClass: string;
  /** 아이콘 색상 클래스 (완전한 Tailwind 문자열 — 동적 조합 금지) */
  iconColorClass: string;
  /** PDA 권한 체크용 메뉴 코드 (없으면 항상 표시) */
  menuCode?: string;
}

/**
 * 메인 메뉴 항목 (세로 리스트, h-16 버튼)
 * menuCode가 없는 항목은 권한 필터링 없이 항상 표시됨
 */
export const pdaMainMenuItems: PdaMenuItem[] = [
  {
    labelKey: "pda.menu.material",
    path: "/pda/material/menu",
    icon: Package,
    borderClass: "border-blue-200 dark:border-blue-800",
    iconColorClass: "text-blue-600 dark:text-blue-400",
  },
  {
    labelKey: "pda.menu.shipping",
    path: "/pda/shipping",
    icon: Truck,
    borderClass: "border-green-200 dark:border-green-800",
    iconColorClass: "text-green-600 dark:text-green-400",
    menuCode: "PDA_SHIPPING",
  },
  {
    labelKey: "pda.menu.equipInspect",
    path: "/pda/equip-inspect",
    icon: Wrench,
    borderClass: "border-orange-200 dark:border-orange-800",
    iconColorClass: "text-orange-600 dark:text-orange-400",
    menuCode: "PDA_EQUIP_INSPECT",
  },
  {
    labelKey: "pda.menu.productInv",
    path: "/pda/product/inventory-count",
    icon: ClipboardCheck,
    borderClass: "border-purple-200 dark:border-purple-800",
    iconColorClass: "text-purple-600 dark:text-purple-400",
    menuCode: "PDA_PRODUCT_INV_COUNT",
  },
];

/**
 * 자재관리 서브메뉴 항목 (2열 그리드, h-20 버튼)
 */
export const pdaMaterialSubMenuItems: PdaMenuItem[] = [
  {
    labelKey: "pda.menu.receiving",
    path: "/pda/material/receiving",
    icon: Download,
    borderClass: "border-blue-200 dark:border-blue-800",
    iconColorClass: "text-blue-600 dark:text-blue-400",
    menuCode: "PDA_MAT_RECEIVING",
  },
  {
    labelKey: "pda.menu.issuing",
    path: "/pda/material/issuing",
    icon: Upload,
    borderClass: "border-purple-200 dark:border-purple-800",
    iconColorClass: "text-purple-600 dark:text-purple-400",
    menuCode: "PDA_MAT_ISSUING",
  },
  {
    labelKey: "pda.menu.adjustment",
    path: "/pda/material/adjustment",
    icon: Settings2,
    borderClass: "border-green-200 dark:border-green-800",
    iconColorClass: "text-green-600 dark:text-green-400",
    menuCode: "PDA_MAT_ADJUSTMENT",
  },
  {
    labelKey: "pda.menu.invCount",
    path: "/pda/material/inventory-count",
    icon: FileSearch,
    borderClass: "border-cyan-200 dark:border-cyan-800",
    iconColorClass: "text-cyan-600 dark:text-cyan-400",
    menuCode: "PDA_MAT_INV_COUNT",
  },
];

/**
 * 로그아웃 버튼 (메인 메뉴 맨 아래 별도 표시)
 */
export const pdaLogoutItem: PdaMenuItem = {
  labelKey: "pda.menu.logout",
  path: "/pda/login",
  icon: LogOut,
  borderClass: "border-red-200 dark:border-red-800",
  iconColorClass: "text-red-600 dark:text-red-400",
};

// 하위 호환성 유지 (기존 코드에서 mainMenuItems, materialSubMenuItems를 import하는 경우 대비)
/** @deprecated pdaMainMenuItems 사용 권장 */
export const mainMenuItems = pdaMainMenuItems;
/** @deprecated pdaMaterialSubMenuItems 사용 권장 */
export const materialSubMenuItems = pdaMaterialSubMenuItems;
