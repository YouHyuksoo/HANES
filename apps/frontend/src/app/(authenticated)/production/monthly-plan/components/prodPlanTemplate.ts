/**
 * @file production/monthly-plan/components/prodPlanTemplate.ts
 * @description 월간생산계획 엑셀 업로드 양식(빈 템플릿) 생성·다운로드 공통 함수
 *
 * 페이지 툴바와 엑셀 업로드 모달에서 동일한 양식을 내려받도록 단일 출처로 사용한다.
 */

import * as XLSX from "xlsx";
import type { TFunction } from "i18next";

/** 빈 엑셀 업로드 양식을 생성해 다운로드한다. */
export function downloadProdPlanTemplate(t: TFunction, planMonth: string): void {
  const headers = [
    t("monthlyPlan.excel.itemCode"),
    t("monthlyPlan.excel.itemType"),
    t("monthlyPlan.excel.planQty"),
    t("monthlyPlan.excel.customer"),
    t("monthlyPlan.excel.lineCode"),
    t("monthlyPlan.excel.priority"),
    t("monthlyPlan.excel.remark"),
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws["!cols"] = [{ wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, `prod-plan-template-${planMonth}.xlsx`);
}
