"use client";
/**
 * @file src/app/(authenticated)/master/carrier/CarrierFormPanel.tsx
 * @description 대차 등록/수정 우측 슬라이드 패널 — 액션 버튼 상단. 폼 상태·저장은 page.tsx 소유.
 */
import type { TFunction } from "i18next";
import { Button, Input } from "@/components/ui";
import { ComCodeSelect, UseYnSelect } from "@/components/shared";

export interface CarrierForm {
  carrierNo: string;
  carrierType: string;
  carrierName: string;
  capacity: string;
  useYn: string;
  remark: string;
}

export const emptyCarrierForm = (): CarrierForm => ({
  carrierNo: "", carrierType: "CART", carrierName: "", capacity: "", useYn: "Y", remark: "",
});

/** 저장 가능: 번호·유형 필수, 수용량은 비었거나 1 이상 정수 */
export function validateCarrierForm(form: CarrierForm): boolean {
  if (!form.carrierNo.trim() || !form.carrierType) return false;
  if (form.capacity.trim() !== "" && !(Number.isInteger(Number(form.capacity)) && Number(form.capacity) >= 1)) return false;
  return true;
}

interface Props {
  t: TFunction;
  editing: boolean;
  saving: boolean;
  form: CarrierForm;
  onChange: (key: keyof CarrierForm, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function CarrierFormPanel({ t, editing, saving, form, onChange, onSave, onCancel }: Props) {
  const canSave = !saving && validateCarrierForm(form);
  return (
    <div className="w-[420px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">{editing ? t("common.edit") : t("common.add")}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={onSave} disabled={!canSave}>{saving ? t("common.saving", "저장 중") : t("common.save")}</Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("master.carrier.carrierNo")} value={form.carrierNo}
            onChange={e => onChange("carrierNo", e.target.value.toUpperCase())} disabled={editing} fullWidth required />
          <ComCodeSelect groupCode="CARRIER_TYPE" includeAll={false} label={t("master.carrier.carrierType")}
            value={form.carrierType} onChange={v => onChange("carrierType", v)} fullWidth required />
          <div className="col-span-2">
            <Input label={t("master.carrier.carrierName")} value={form.carrierName}
              onChange={e => onChange("carrierName", e.target.value)} fullWidth />
          </div>
          <Input label={t("master.carrier.capacity")} type="number" min={1} value={form.capacity}
            placeholder={t("master.carrier.capacityUnlimited")}
            onChange={e => onChange("capacity", e.target.value)} fullWidth />
          <UseYnSelect includeAll={false} label={t("common.useYn")} value={form.useYn} onChange={v => onChange("useYn", v)} fullWidth />
          <div className="col-span-2">
            <Input label={t("common.remark")} value={form.remark} onChange={e => onChange("remark", e.target.value)} fullWidth />
          </div>
          <p className="col-span-2 text-text-muted">{t("master.carrier.capacityHint")}</p>
        </div>
      </div>
    </div>
  );
}
