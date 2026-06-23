"use client";

/**
 * @file components/IqcItemFormPanel.tsx
 * @description IQC 검사항목 추가/수정 오른쪽 슬라이드 패널
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";
import { FieldInput, FieldSelect, FieldComCodeSelect } from "./IqcItemFieldHelp";

export interface IqcItemPool {
  inspItemCode: string;
  inspItemName: string;
  judgeMethod: "VISUAL" | "MEASURE";
  unit: string | null;
  useYn: string;
}

export interface IqcItemFormState {
  itemCode: string;
  itemName: string;
  judgeMethod: "VISUAL" | "MEASURE";
  unit: string;
}

interface Props {
  editing: IqcItemPool | null;
  saving: boolean;
  judgeOptions: { value: string; label: string }[];
  onClose: () => void;
  onSave: (form: IqcItemFormState) => void;
  animate?: boolean;
}

const EMPTY_FORM: IqcItemFormState = {
  itemCode: "",
  itemName: "",
  judgeMethod: "VISUAL",
  unit: "",
};

const getInitialForm = (editing: IqcItemPool | null): IqcItemFormState => {
  if (!editing) return EMPTY_FORM;
  return {
    itemCode: editing.inspItemCode,
    itemName: editing.inspItemName,
    judgeMethod: editing.judgeMethod,
    unit: editing.unit ?? "",
  };
};

export default function IqcItemFormPanel({
  editing,
  saving,
  judgeOptions,
  onClose,
  onSave,
  animate = true,
}: Props) {
  const { t } = useTranslation();
  const isEdit = !!editing;
  const [form, setForm] = useState<IqcItemFormState>(() => getInitialForm(editing));

  useEffect(() => {
    setForm(getInitialForm(editing));
  }, [editing]);

  const setField = <K extends keyof IqcItemFormState>(key: K, value: IqcItemFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}
    >
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("master.iqcItem.editItem") : t("master.iqcItem.addItem")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(form)}
            disabled={saving || !form.itemCode.trim() || !form.itemName.trim()}
          >
            {saving ? t("common.saving") : t("common.save", "저장")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("master.iqcItem.sectionBasic", "기본정보")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              field="itemCode"
              label={t("master.iqcItem.itemCode", "항목코드")}
              value={form.itemCode}
              onChange={(e) => setField("itemCode", e.target.value)}
              disabled={isEdit}
              required
            />
            <FieldSelect
              field="judgeMethod"
              label={t("master.iqcItem.judgeMethod", "판정방법")}
              options={judgeOptions}
              value={form.judgeMethod}
              onChange={(v) => setField("judgeMethod", v as "VISUAL" | "MEASURE")}
            />
            <FieldInput
              field="itemName"
              label={t("master.iqcItem.inspectItem")}
              value={form.itemName}
              onChange={(e) => setField("itemName", e.target.value)}
              required
              wrapperClassName="col-span-2"
            />
            <FieldComCodeSelect
              field="unit"
              groupCode="UNIT_TYPE"
              label={t("common.unit", "단위")}
              includeAll={false}
              showCode
              value={form.unit}
              onChange={(v) => setField("unit", v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
