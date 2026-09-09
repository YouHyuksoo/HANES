"use client";

/**
 * @file src/app/(authenticated)/master/terminal-crimp-spec/TerminalCrimpSpecFormPanel.tsx
 * @description 단자별 압착 규격 등록/수정 우측 슬라이드 패널 (액션 버튼 상단, 데이터 교체 방식)
 *
 * 초보자 가이드:
 * 1. form 상태와 저장 로직은 page.tsx가 소유하고, 이 컴포넌트는 입력 UI만 그린다.
 * 2. 단자/전선 품목은 PartSelect(원자재), 단자 종류는 ComCodeSelect(TERMINAL_TYPE) — 코드성 값 직접 입력 금지.
 * 3. 수치는 문자열로 보관하다가 page.tsx의 payload 변환에서 Number로 바꾼다(빈값은 null).
 */
import type { TFunction } from "i18next";
import { Button, Input } from "@/components/ui";
import { ComCodeSelect, PartSelect, UseYnSelect } from "@/components/shared";

export interface TerminalCrimpSpecForm {
  terminalItemCode: string;
  terminalType: string;
  wireSize: string;
  wireItemCode: string;
  crimpHeightLsl: string;
  crimpHeightUsl: string;
  crimpWidthLsl: string;
  crimpWidthUsl: string;
  insCrimpHeightLsl: string;
  insCrimpHeightUsl: string;
  pullForceMin: string;
  stripLengthMin: string;
  stripLengthMax: string;
  applicatorCode: string;
  remark: string;
  useYn: string;
}

export const emptyTerminalCrimpSpecForm = (): TerminalCrimpSpecForm => ({
  terminalItemCode: "",
  terminalType: "",
  wireSize: "",
  wireItemCode: "",
  crimpHeightLsl: "",
  crimpHeightUsl: "",
  crimpWidthLsl: "",
  crimpWidthUsl: "",
  insCrimpHeightLsl: "",
  insCrimpHeightUsl: "",
  pullForceMin: "",
  stripLengthMin: "",
  stripLengthMax: "",
  applicatorCode: "",
  remark: "",
  useYn: "Y",
});

/** 저장 가능 조건: 단자 품목 + 전선 사이즈 필수, 각 LSL ≤ USL */
export function validateTerminalCrimpSpecForm(form: TerminalCrimpSpecForm): boolean {
  if (!form.terminalItemCode.trim() || !form.wireSize.trim()) return false;
  const pairs: Array<[string, string]> = [
    [form.crimpHeightLsl, form.crimpHeightUsl],
    [form.crimpWidthLsl, form.crimpWidthUsl],
    [form.insCrimpHeightLsl, form.insCrimpHeightUsl],
    [form.stripLengthMin, form.stripLengthMax],
  ];
  return pairs.every(([lo, hi]) => lo === "" || hi === "" || Number(lo) <= Number(hi));
}

interface TerminalCrimpSpecFormPanelProps {
  t: TFunction;
  editing: boolean;
  saving: boolean;
  form: TerminalCrimpSpecForm;
  onChange: (key: keyof TerminalCrimpSpecForm, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function TerminalCrimpSpecFormPanel({
  t, editing, saving, form, onChange, onSave, onCancel,
}: TerminalCrimpSpecFormPanelProps) {
  const canSave = !saving && validateTerminalCrimpSpecForm(form);
  const num = (key: keyof TerminalCrimpSpecForm, label: string) => (
    <Input label={label} type="number" step="0.001" value={form[key]}
      onChange={e => onChange(key, e.target.value)} fullWidth />
  );

  return (
    <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {editing ? t("common.edit") : t("common.add")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={onSave} disabled={!canSave}>
            {saving ? t("common.saving", "저장 중") : t("common.save")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.terminalCrimpSpec.sectionBasic")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <PartSelect partType="RAW" label={t("master.terminalCrimpSpec.terminalItemCode")} value={form.terminalItemCode}
                onChange={v => onChange("terminalItemCode", v)} fullWidth required />
            </div>
            <ComCodeSelect groupCode="TERMINAL_TYPE" includeAll={false} label={t("master.terminalCrimpSpec.terminalType")}
              value={form.terminalType} onChange={v => onChange("terminalType", v)} fullWidth />
            <Input label={t("master.terminalCrimpSpec.wireSize")} value={form.wireSize}
              onChange={e => onChange("wireSize", e.target.value)} placeholder="0.5SQ" fullWidth required />
            <div className="col-span-2">
              <PartSelect partType="RAW" label={t("master.terminalCrimpSpec.wireItemCode")} value={form.wireItemCode}
                onChange={v => onChange("wireItemCode", v)} fullWidth />
            </div>
            <Input label={t("master.terminalCrimpSpec.applicatorCode")} value={form.applicatorCode}
              onChange={e => onChange("applicatorCode", e.target.value)} fullWidth />
            <UseYnSelect includeAll={false} label={t("common.useYn")} value={form.useYn}
              onChange={v => onChange("useYn", v)} fullWidth />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.terminalCrimpSpec.sectionSpec")}</h3>
          <div className="grid grid-cols-2 gap-3">
            {num("crimpHeightLsl", t("master.terminalCrimpSpec.crimpHeightLsl"))}
            {num("crimpHeightUsl", t("master.terminalCrimpSpec.crimpHeightUsl"))}
            {num("crimpWidthLsl", t("master.terminalCrimpSpec.crimpWidthLsl"))}
            {num("crimpWidthUsl", t("master.terminalCrimpSpec.crimpWidthUsl"))}
            {num("insCrimpHeightLsl", t("master.terminalCrimpSpec.insCrimpHeightLsl"))}
            {num("insCrimpHeightUsl", t("master.terminalCrimpSpec.insCrimpHeightUsl"))}
            {num("pullForceMin", t("master.terminalCrimpSpec.pullForceMin"))}
            <div />
            {num("stripLengthMin", t("master.terminalCrimpSpec.stripLengthMin"))}
            {num("stripLengthMax", t("master.terminalCrimpSpec.stripLengthMax"))}
          </div>
          <p className="mt-2 text-text-muted">{t("master.terminalCrimpSpec.specHint")}</p>
        </div>

        <Input label={t("common.remark")} value={form.remark}
          onChange={e => onChange("remark", e.target.value)} fullWidth />
      </div>
    </div>
  );
}
