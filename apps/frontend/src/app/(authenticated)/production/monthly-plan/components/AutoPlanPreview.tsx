/**
 * @file production/monthly-plan/components/AutoPlanPreview.tsx
 * @description 자동 생산계획 미리보기 결과 표시 컴포넌트
 *
 * 초보자 가이드:
 * 1. **요약 카드**: 작업일수, 수주품목 수, 기존 DRAFT 수를 색상별 카드로 표시
 * 2. **상세 테이블**: 품목별 수주량, 병목공정, CAPA, 계획수량, 활용률 표시
 * 3. **경고 메시지**: CAPA 초과 등 주의사항을 노란색 박스로 표시
 * 4. **AutoGenerateModal**에서 preview 데이터를 받아 순수 렌더링만 수행
 */

"use client";

import { useTranslation } from "react-i18next";

/** 수주 조회 결과 행 */
export interface AutoPlanPreviewItem {
  itemCode: string;
  itemName: string;
  customerId: string;
  customerName: string;
  orderNo: string;
  dueDate: string;
  demandQty: number;
  planQty: number;
}

/** 미리보기 응답 */
export interface AutoPlanPreviewData {
  items: AutoPlanPreviewItem[];
  workDays: number;
  existingDraftCount: number;
  warnings: string[];
}

interface AutoPlanPreviewProps {
  preview: AutoPlanPreviewData;
  selectedIndexes: Set<number>;
  onToggle: (index: number) => void;
  onToggleAll: () => void;
}

/** 미리보기 요약/테이블/경고를 렌더링하는 순수 표시 컴포넌트 */
export default function AutoPlanPreview({ preview, selectedIndexes, onToggle, onToggleAll }: AutoPlanPreviewProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* 조회 결과 요약 */}
      <div className="mb-3 text-sm text-text-muted">
        {t("monthlyPlan.autoGenerate.demandItems")}: <span className="font-bold text-text">{preview.items.length}</span>{t("common.count", "건")}
      </div>

      {/* 품목별 상세 테이블 */}
      <div className="max-h-60 overflow-y-auto min-h-0 border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-surface sticky top-0">
            <tr className="text-left text-text-muted text-xs">
              <th className="px-3 py-2 text-center w-10">
                <input
                  type="checkbox"
                  checked={selectedIndexes.size === preview.items.length && preview.items.length > 0}
                  onChange={onToggleAll}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
              </th>
              <th className="px-3 py-2">{t("monthlyPlan.autoGenerate.orderNo")}</th>
              <th className="px-3 py-2">{t("monthlyPlan.autoGenerate.dueDate")}</th>
              <th className="px-3 py-2">{t("common.partName")}</th>
              <th className="px-3 py-2">{t("monthlyPlan.customer")}</th>
              <th className="px-3 py-2 text-right">
                {t("monthlyPlan.autoGenerate.demandQty")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {preview.items.map((item, i) => (
              <tr key={i} className="hover:bg-surface/50">
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIndexes.has(i)}
                    onChange={() => onToggle(i)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs">{item.orderNo}</td>
                <td className="px-3 py-2 text-xs">{item.dueDate}</td>
                <td className="px-3 py-2">
                  {item.itemName}{" "}
                  <span className="text-xs text-text-muted">
                    ({item.itemCode})
                  </span>
                </td>
                <td className="px-3 py-2">{item.customerName}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {item.demandQty.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 경고 메시지 */}
      {preview.warnings.length > 0 && (
        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
          {preview.warnings.map((w, i) => (
            <p key={i}>&#x26A0; {w}</p>
          ))}
        </div>
      )}
    </>
  );
}
