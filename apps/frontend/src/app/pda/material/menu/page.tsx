"use client";

/**
 * @file src/app/(pda)/material/menu/page.tsx
 * @description 자재관리 서브메뉴 페이지 - 입고/출고/재고조정/재고실사 진입
 *
 * 초보자 가이드:
 * 1. PdaHeader: 뒤로가기 → /pda/menu (메인 메뉴)
 * 2. PdaMenuGrid: 자재관리 4개 하위 메뉴를 2열 그리드로 표시
 * 3. materialSubMenuItems: pdaMenuConfig에서 가져온 서브메뉴 항목
 */
import PdaHeader from "@/components/pda/PdaHeader";
import PdaMenuGrid from "@/components/pda/PdaMenuGrid";
import { materialSubMenuItems } from "@/components/pda/pdaMenuConfig";

export default function MaterialMenuPage() {
  return (
    <>
      <PdaHeader titleKey="pda.menu.material" backPath="/pda/menu" />
      <PdaMenuGrid items={materialSubMenuItems} />
    </>
  );
}
