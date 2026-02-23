/**
 * @file src/components/pda/pdaMenuConfig.ts
 * @description PDA 메뉴 설정 - 메인 메뉴 및 서브메뉴 항목 정의
 *
 * 초보자 가이드:
 * 1. **PdaMenuItem**: 메뉴 항목 타입 (라벨 i18n 키, 경로, 아이콘, 색상)
 * 2. **mainMenuItems**: 메인 메뉴 2열 그리드용 항목
 * 3. **materialSubMenuItems**: 자재관리 서브메뉴 항목
 */
import {
  Package,
  Truck,
  ClipboardCheck,
  Settings,
  BoxSelect,
  PackageCheck,
  PackageMinus,
  RefreshCw,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

export interface PdaMenuItem {
  /** i18n 번역 키 */
  labelKey: string;
  /** 이동 경로 */
  path: string;
  /** lucide 아이콘 */
  icon: LucideIcon;
  /** 배경 그래디언트 색상 (Tailwind) */
  color: string;
  /** 아이콘 배경 색상 */
  iconBg: string;
}

/** 메인 메뉴 항목 (2열 그리드) */
export const mainMenuItems: PdaMenuItem[] = [
  {
    labelKey: "pda.menu.material",
    path: "/pda/material/menu",
    icon: Package,
    color: "from-blue-500 to-blue-600",
    iconBg: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300",
  },
  {
    labelKey: "pda.menu.shipping",
    path: "/pda/shipping",
    icon: Truck,
    color: "from-emerald-500 to-emerald-600",
    iconBg:
      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300",
  },
  {
    labelKey: "pda.menu.productInventory",
    path: "/pda/product/inventory-count",
    icon: BoxSelect,
    color: "from-purple-500 to-purple-600",
    iconBg:
      "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300",
  },
  {
    labelKey: "pda.menu.equipInspect",
    path: "/pda/equip-inspect",
    icon: ClipboardCheck,
    color: "from-orange-500 to-orange-600",
    iconBg:
      "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300",
  },
  {
    labelKey: "pda.menu.settings",
    path: "/pda/settings",
    icon: Settings,
    color: "from-slate-500 to-slate-600",
    iconBg:
      "bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300",
  },
];

/** 자재관리 서브메뉴 항목 (2열 그리드) */
export const materialSubMenuItems: PdaMenuItem[] = [
  {
    labelKey: "pda.menu.matReceiving",
    path: "/pda/material/receiving",
    icon: PackageCheck,
    color: "from-blue-500 to-blue-600",
    iconBg: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300",
  },
  {
    labelKey: "pda.menu.matIssuing",
    path: "/pda/material/issuing",
    icon: PackageMinus,
    color: "from-amber-500 to-amber-600",
    iconBg:
      "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300",
  },
  {
    labelKey: "pda.menu.matAdjustment",
    path: "/pda/material/adjustment",
    icon: RefreshCw,
    color: "from-teal-500 to-teal-600",
    iconBg: "bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300",
  },
  {
    labelKey: "pda.menu.matInventoryCount",
    path: "/pda/material/inventory-count",
    icon: ClipboardList,
    color: "from-indigo-500 to-indigo-600",
    iconBg:
      "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300",
  },
];
