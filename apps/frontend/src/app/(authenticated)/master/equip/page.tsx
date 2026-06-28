"use client";

/**
 * @file src/app/(authenticated)/master/equip/page.tsx
 * @description 설비관리 페이지 — 설비 기본정보 그리드 단일 화면.
 *
 * 초보자 가이드:
 * 1. 설비 마스터 CRUD — 설비 기본 정보 관리.
 * 2. 설비 BOM은 그리드 행의 BOM 아이콘 클릭 시 우측 슬라이드 패널로 관리한다(설비별).
 * 3. 헤더/그리드/우측 패널 레이아웃은 EquipMasterTab이 자체적으로 구성한다(전체 높이).
 */

import EquipMasterTab from "./components/EquipMasterTab";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";

export default function EquipPage() {
  usePageAiTools("master.equip");

  return (
    <div className="h-full">
      <EquipMasterTab />
    </div>
  );
}
