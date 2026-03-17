/**
 * @file SessionModals.tsx
 * @description 자재재고실사 세션 관리 모달 — 실사 개시 / 실사 완료 / 실사 반영 확인
 *
 * 초보자 가이드:
 * 1. **StartSessionModal**: 기준년월/창고 선택 → 실사 세션 생성 (트랜잭션 차단 시작)
 * 2. **CompleteSessionModal**: 실사 종료 확인 → 세션 COMPLETED (트랜잭션 차단 해제)
 * 3. **ApplyConfirmModal**: 실사 반영 전 불일치 항목 목록 표시 + 최종 확인
 */

import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { WarehouseSelect } from "@/components/shared";

interface MismatchItem {
  id: string;
  itemCode: string;
  itemName?: string;
  qty: number;
  countedQty: number | null;
}

/** 실사 개시 모달 */
export function StartSessionModal({
  isOpen, onClose, countMonth, onCountMonthChange, warehouse, onWarehouseChange, onStart, saving,
}: {
  isOpen: boolean; onClose: () => void;
  countMonth: string; onCountMonthChange: (v: string) => void;
  warehouse: string; onWarehouseChange: (v: string) => void;
  onStart: () => void; saving: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.physicalInv.startSession")} size="md">
      <div className="space-y-4">
        <p className="text-text">{t("material.physicalInv.startSessionDesc")}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("material.physicalInv.countMonth")}</label>
            <input type="month" value={countMonth} onChange={e => onCountMonthChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("material.physicalInv.warehouse")}</label>
            <WarehouseSelect includeAll labelPrefix={t("common.all")} value={warehouse} onChange={onWarehouseChange} fullWidth />
          </div>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {t("material.physicalInv.startSessionWarning")}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={onStart} disabled={saving || !countMonth}>
          {saving ? t("common.saving") : t("material.physicalInv.startSession")}
        </Button>
      </div>
    </Modal>
  );
}

/** 실사 완료 모달 */
export function CompleteSessionModal({
  isOpen, onClose, onComplete, saving, mismatchCount,
}: {
  isOpen: boolean; onClose: () => void;
  onComplete: () => void; saving: boolean; mismatchCount: number;
}) {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.physicalInv.completeSession")} size="md">
      <div className="space-y-4">
        <p className="text-text">{t("material.physicalInv.completeSessionDesc")}</p>
        {mismatchCount > 0 && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {t("material.physicalInv.unreflectedWarning", { count: mismatchCount })}
            </p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="danger" onClick={onComplete} disabled={saving}>
          {saving ? t("common.saving") : t("material.physicalInv.completeSession")}
        </Button>
      </div>
    </Modal>
  );
}

/** 실사 반영 확인 모달 */
export function ApplyConfirmModal({
  isOpen, onClose, onApply, saving, countedCount, mismatchItems,
}: {
  isOpen: boolean; onClose: () => void;
  onApply: () => void; saving: boolean;
  countedCount: number; mismatchItems: MismatchItem[];
}) {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.physicalInv.applyCount")} size="lg">
      <div className="space-y-4">
        <p className="text-text">{t("material.physicalInv.confirmMessage", { count: countedCount })}</p>
        {mismatchItems.length > 0 && (
          <div className="bg-surface-alt dark:bg-surface rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
            {mismatchItems.map(item => {
              const diff = item.countedQty! - item.qty;
              return (
                <div key={item.id} className="flex justify-between text-sm border-b border-border pb-1">
                  <span className="text-text">{item.itemCode} — {item.itemName}</span>
                  <span className={diff > 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                    {item.qty} → {item.countedQty} ({diff > 0 ? "+" : ""}{diff})
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={onApply} disabled={saving}>
          {saving ? t("common.saving") : t("material.physicalInv.applyCount")}
        </Button>
      </div>
    </Modal>
  );
}
