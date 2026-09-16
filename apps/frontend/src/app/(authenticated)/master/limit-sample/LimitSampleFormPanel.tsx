"use client";

/**
 * @file src/app/(authenticated)/master/limit-sample/LimitSampleFormPanel.tsx
 * @description 양불마스터 등록/수정 우측 슬라이드 패널 — 사진 다중 관리 포함 (액션 버튼 상단)
 *
 * 초보자 가이드:
 * 1. form 상태·저장·업로드 호출은 page.tsx가 소유. 이 컴포넌트는 입력 UI만 담당한다.
 * 2. 유형은 ComCodeSelect(LIMIT_SAMPLE_TYPE), 품목 PartSelect, 공정 ProcessSelect, 불량코드는 옵션 API 목록 Select.
 * 3. 사진 목록·대표 지정은 LimitSampleImageSection이 맡는다.
 */
import type { TFunction } from "i18next";
import { Button, Input, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { ComCodeSelect, PartSelect, ProcessSelect, UseYnSelect } from "@/components/shared";
import LimitSampleImageSection, { type PendingSampleImage } from "./LimitSampleImageSection";
import type { LimitSampleImageRow } from "./limitSampleColumns";

export interface LimitSampleForm {
  sampleCode: string;
  sampleType: string;
  sampleName: string;
  itemCode: string;
  processCode: string;
  defectCode: string;
  /** 적용 검사유형 — 빈 값이면 전 검사유형 공통 */
  inspectType: string;
  location: string;
  validFrom: string;
  validTo: string;
  approvedBy: string;
  approvedAt: string;
  status: string;
  /** 검사 전 대조 필수 여부 */
  requiredYn: string;
  /** 대조 모달 표시 순서 */
  sortOrder: string;
  remark: string;
  useYn: string;
}

export const emptyLimitSampleForm = (): LimitSampleForm => ({
  sampleCode: "",
  sampleType: "OK",
  sampleName: "",
  itemCode: "",
  processCode: "",
  defectCode: "",
  inspectType: "",
  location: "",
  validFrom: "",
  validTo: "",
  approvedBy: "",
  approvedAt: "",
  status: "ACTIVE",
  requiredYn: "Y",
  sortOrder: "0",
  remark: "",
  useYn: "Y",
});

/** 저장 가능 조건: 코드·유형·명칭 필수, 유효기간 시작 ≤ 종료 */
export function validateLimitSampleForm(form: LimitSampleForm): boolean {
  if (!form.sampleCode.trim() || !form.sampleType || !form.sampleName.trim()) return false;
  if (form.validFrom && form.validTo && form.validFrom > form.validTo) return false;
  return true;
}

interface LimitSampleFormPanelProps {
  t: TFunction;
  editing: boolean;
  saving: boolean;
  form: LimitSampleForm;
  defectCodeOptions: SelectOption[];
  images: LimitSampleImageRow[];
  pendingImages: PendingSampleImage[];
  onChange: (key: keyof LimitSampleForm, value: string) => void;
  onAddFiles: (files: File[]) => void;
  onChangeSavedCaption: (seqNo: number, caption: string) => void;
  onChangePendingCaption: (id: string, caption: string) => void;
  onSetSavedPrimary: (seqNo: number) => void;
  onSetPendingPrimary: (id: string) => void;
  onMoveSaved: (seqNo: number, direction: -1 | 1) => void;
  onRequestDeleteSaved: (seqNo: number) => void;
  onRemovePending: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function LimitSampleFormPanel({
  t, editing, saving, form, defectCodeOptions, images, pendingImages,
  onChange, onAddFiles, onChangeSavedCaption, onChangePendingCaption,
  onSetSavedPrimary, onSetPendingPrimary, onMoveSaved,
  onRequestDeleteSaved, onRemovePending, onSave, onCancel,
}: LimitSampleFormPanelProps) {
  const canSave = !saving && validateLimitSampleForm(form);
  const isNgSample = form.sampleType === "NG";

  return (
    <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">{editing ? t("common.edit") : t("common.add")}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={onSave} disabled={!canSave}>
            {saving ? t("common.saving", "저장 중") : t("common.save")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.limitSample.sectionBasic")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.limitSample.sampleCode")} value={form.sampleCode}
              onChange={e => onChange("sampleCode", e.target.value)} disabled={editing} fullWidth required />
            <ComCodeSelect groupCode="LIMIT_SAMPLE_TYPE" includeAll={false} label={t("master.limitSample.sampleType")}
              value={form.sampleType} onChange={v => onChange("sampleType", v)} fullWidth required />
            <div className="col-span-2">
              <Input label={t("master.limitSample.sampleName")} value={form.sampleName}
                onChange={e => onChange("sampleName", e.target.value)} fullWidth required />
            </div>
            <div className="col-span-2">
              <PartSelect label={t("master.limitSample.itemCode")} value={form.itemCode}
                onChange={v => onChange("itemCode", v)} placeholder={t("common.all")} fullWidth />
            </div>
            <ProcessSelect label={t("master.limitSample.processCode")} value={form.processCode}
              onChange={v => onChange("processCode", v)} placeholder={t("common.all")} fullWidth />
            <Select label={t("master.limitSample.defectCode")} options={defectCodeOptions} value={form.defectCode}
              onChange={v => onChange("defectCode", v)} placeholder={t("common.all")} fullWidth
              disabled={!isNgSample} />
            {!isNgSample && (
              <p className="col-span-2 text-text-muted">{t("master.limitSample.defectCodeHint")}</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.limitSample.sectionSampleCheck")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <ComCodeSelect groupCode="INSPECT_TYPE" includeAll={false} label={t("master.limitSample.inspectType")}
              placeholder={t("master.limitSample.inspectTypeAll")}
              value={form.inspectType} onChange={v => onChange("inspectType", v)} fullWidth />
            <UseYnSelect includeAll={false} label={t("master.limitSample.requiredYn")}
              value={form.requiredYn} onChange={v => onChange("requiredYn", v)} fullWidth />
            <Input label={t("master.limitSample.sortOrder")} type="number" min={0} value={form.sortOrder}
              onChange={e => onChange("sortOrder", e.target.value)} fullWidth />
            <p className="col-span-2 text-text-muted">{t("master.limitSample.requiredHint")}</p>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.limitSample.sectionValidity")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.limitSample.validFrom")} type="date" value={form.validFrom}
              onChange={e => onChange("validFrom", e.target.value)} fullWidth />
            <Input label={t("master.limitSample.validTo")} type="date" value={form.validTo}
              onChange={e => onChange("validTo", e.target.value)} fullWidth />
            <Input label={t("master.limitSample.approvedBy")} value={form.approvedBy}
              onChange={e => onChange("approvedBy", e.target.value)} fullWidth />
            <Input label={t("master.limitSample.approvedAt")} type="date" value={form.approvedAt}
              onChange={e => onChange("approvedAt", e.target.value)} fullWidth />
            <ComCodeSelect groupCode="LIMIT_SAMPLE_STATUS" includeAll={false} label={t("common.status")}
              value={form.status} onChange={v => onChange("status", v)} fullWidth />
            <UseYnSelect includeAll={false} label={t("common.useYn")} value={form.useYn}
              onChange={v => onChange("useYn", v)} fullWidth />
            <div className="col-span-2">
              <Input label={t("master.limitSample.location")} value={form.location}
                onChange={e => onChange("location", e.target.value)} fullWidth />
            </div>
          </div>
        </div>

        <LimitSampleImageSection
          t={t}
          saving={saving}
          images={images}
          pending={pendingImages}
          onAddFiles={onAddFiles}
          onChangeSavedCaption={onChangeSavedCaption}
          onChangePendingCaption={onChangePendingCaption}
          onSetSavedPrimary={onSetSavedPrimary}
          onSetPendingPrimary={onSetPendingPrimary}
          onMoveSaved={onMoveSaved}
          onRequestDeleteSaved={onRequestDeleteSaved}
          onRemovePending={onRemovePending}
        />

        <Input label={t("common.remark")} value={form.remark}
          onChange={e => onChange("remark", e.target.value)} fullWidth />
      </div>
    </div>
  );
}
