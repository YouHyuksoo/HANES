"use client";

/**
 * @file src/components/consumables/ReceivingReturnPanel.tsx
 * @description 소모품 입고반품 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **우측 패널**: 입고반품 버튼 클릭 시 오른쪽에서 슬라이드 인
 * 2. **소모품 검색**: ConsumableSearchModal로 소모품 선택
 * 3. **API**: POST /consumables/receiving { ...form, logType: "IN_RETURN" }
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { ConsumableSearchModal } from "@/components/shared";

interface Props {
  onClose: () => void;
  onSubmit: (data: ReturnFormValues) => void;
  loading?: boolean;
  animate?: boolean;
}

export interface ReturnFormValues {
  consumableId: string;
  qty: number;
  vendorCode: string;
  vendorName: string;
  returnReason: string;
  remark: string;
}

const EMPTY: ReturnFormValues = {
  consumableId: "",
  qty: 1,
  vendorCode: "",
  vendorName: "",
  returnReason: "",
  remark: "",
};

export default function ReceivingReturnPanel({ onClose, onSubmit, loading, animate = true }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ReturnFormValues>(EMPTY);
  const [consumableSearchOpen, setConsumableSearchOpen] = useState(false);
  const [consumableLabel, setConsumableLabel] = useState("");

  const set = (k: keyof ReturnFormValues, v: string | number) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.consumableId) return;
    onSubmit(form);
    setForm(EMPTY);
    setConsumableLabel("");
  };

  return (
    <>
      <div
        className={`w-[420px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}
      >
        {/* 헤더 */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-bold text-text">{t("consumables.receiving.returnModalTitle")}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
            <X className="w-4 h-4 text-text-muted hover:text-text" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {/* 소모품 선택 */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">
              {t("consumables.receiving.consumable")}
            </h3>
            <div className="flex gap-1.5">
              <Input
                value={consumableLabel}
                readOnly
                placeholder={t("consumables.search.placeholder")}
                fullWidth
              />
              <button
                type="button"
                onClick={() => setConsumableSearchOpen(true)}
                className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-[var(--radius)] border border-gray-400 dark:border-gray-500 bg-surface hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
                title={t("consumables.search.title")}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 수량 */}
          <Input
            label={t("common.quantity")}
            type="number"
            value={String(form.qty)}
            onChange={(e) => set("qty", Number(e.target.value))}
            fullWidth
          />

          {/* 공급업체 */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">
              {t("consumables.receiving.vendorCodeLabel")}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("consumables.receiving.vendorCodeLabel")}
                value={form.vendorCode}
                onChange={(e) => set("vendorCode", e.target.value)}
                fullWidth
              />
              <Input
                label={t("consumables.receiving.vendorNameLabel")}
                value={form.vendorName}
                onChange={(e) => set("vendorName", e.target.value)}
                fullWidth
              />
            </div>
          </div>

          {/* 반품사유 */}
          <Input
            label={t("consumables.receiving.returnReasonLabel")}
            value={form.returnReason}
            onChange={(e) => set("returnReason", e.target.value)}
            placeholder={t("consumables.receiving.returnReasonPlaceholder")}
            fullWidth
          />

          {/* 비고 */}
          <Input
            label={t("common.remark")}
            value={form.remark}
            onChange={(e) => set("remark", e.target.value)}
            placeholder={t("consumables.receiving.remarkPlaceholder")}
            fullWidth
          />
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.consumableId}>
            {loading ? t("common.saving") : t("common.register")}
          </Button>
        </div>
      </div>

      <ConsumableSearchModal
        isOpen={consumableSearchOpen}
        onClose={() => setConsumableSearchOpen(false)}
        onSelect={(item) => {
          set("consumableId", item.id);
          setConsumableLabel(`${item.consumableCode} - ${item.consumableName}`);
        }}
      />
    </>
  );
}
