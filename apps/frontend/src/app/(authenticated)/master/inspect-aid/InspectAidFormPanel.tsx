"use client";

/**
 * @file src/app/(authenticated)/master/inspect-aid/InspectAidFormPanel.tsx
 * @description 검사보조구 등록/수정 우측 슬라이드 패널 — 사진 업로드/교체/삭제 포함 (액션 버튼 상단)
 *
 * 초보자 가이드:
 * 1. form 상태·저장·업로드 호출은 page.tsx가 소유. 이 컴포넌트는 입력 UI와 파일 선택만 담당한다.
 * 2. 유형은 ComCodeSelect(INSPECT_AID_TYPE), 품목 PartSelect, 공정 ProcessSelect, 불량코드는 옵션 API 목록 Select.
 * 3. 사진: previewUrl(blob 또는 서버 경로)로 미리보기, 삭제는 ConfirmModal 확인 후 page에서 처리.
 */
import { useRef } from "react";
import type { TFunction } from "i18next";
import { ImageIcon, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { ComCodeSelect, PartSelect, ProcessSelect, UseYnSelect } from "@/components/shared";
import { resolveBackendFileUrl } from "@/utils/file-url";

export interface InspectAidForm {
  aidCode: string;
  aidType: string;
  aidName: string;
  itemCode: string;
  processCode: string;
  defectCode: string;
  location: string;
  validFrom: string;
  validTo: string;
  approvedBy: string;
  approvedAt: string;
  status: string;
  remark: string;
  useYn: string;
}

export const emptyInspectAidForm = (): InspectAidForm => ({
  aidCode: "",
  aidType: "LIMIT_OK",
  aidName: "",
  itemCode: "",
  processCode: "",
  defectCode: "",
  location: "",
  validFrom: "",
  validTo: "",
  approvedBy: "",
  approvedAt: "",
  status: "ACTIVE",
  remark: "",
  useYn: "Y",
});

/** 저장 가능 조건: 코드·유형·명칭 필수, 유효기간 시작 ≤ 종료 */
export function validateInspectAidForm(form: InspectAidForm): boolean {
  if (!form.aidCode.trim() || !form.aidType || !form.aidName.trim()) return false;
  if (form.validFrom && form.validTo && form.validFrom > form.validTo) return false;
  return true;
}

interface InspectAidFormPanelProps {
  t: TFunction;
  editing: boolean;
  saving: boolean;
  form: InspectAidForm;
  defectCodeOptions: SelectOption[];
  previewUrl: string | null;
  imageError: boolean;
  onChange: (key: keyof InspectAidForm, value: string) => void;
  onImageSelect: (file: File) => void;
  onImageError: () => void;
  onRequestImageDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function InspectAidFormPanel({
  t, editing, saving, form, defectCodeOptions, previewUrl, imageError,
  onChange, onImageSelect, onImageError, onRequestImageDelete, onSave, onCancel,
}: InspectAidFormPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSave = !saving && validateInspectAidForm(form);
  const isNgSample = form.aidType === "LIMIT_NG";

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
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.inspectAid.sectionBasic")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.inspectAid.aidCode")} value={form.aidCode}
              onChange={e => onChange("aidCode", e.target.value)} disabled={editing} fullWidth required />
            <ComCodeSelect groupCode="INSPECT_AID_TYPE" includeAll={false} label={t("master.inspectAid.aidType")}
              value={form.aidType} onChange={v => onChange("aidType", v)} fullWidth required />
            <div className="col-span-2">
              <Input label={t("master.inspectAid.aidName")} value={form.aidName}
                onChange={e => onChange("aidName", e.target.value)} fullWidth required />
            </div>
            <div className="col-span-2">
              <PartSelect label={t("master.inspectAid.itemCode")} value={form.itemCode}
                onChange={v => onChange("itemCode", v)} placeholder={t("common.all")} fullWidth />
            </div>
            <ProcessSelect label={t("master.inspectAid.processCode")} value={form.processCode}
              onChange={v => onChange("processCode", v)} placeholder={t("common.all")} fullWidth />
            <Select label={t("master.inspectAid.defectCode")} options={defectCodeOptions} value={form.defectCode}
              onChange={v => onChange("defectCode", v)} placeholder={t("common.all")} fullWidth
              disabled={!isNgSample} />
            {!isNgSample && (
              <p className="col-span-2 text-text-muted">{t("master.inspectAid.defectCodeHint")}</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.inspectAid.sectionValidity")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.inspectAid.validFrom")} type="date" value={form.validFrom}
              onChange={e => onChange("validFrom", e.target.value)} fullWidth />
            <Input label={t("master.inspectAid.validTo")} type="date" value={form.validTo}
              onChange={e => onChange("validTo", e.target.value)} fullWidth />
            <Input label={t("master.inspectAid.approvedBy")} value={form.approvedBy}
              onChange={e => onChange("approvedBy", e.target.value)} fullWidth />
            <Input label={t("master.inspectAid.approvedAt")} type="date" value={form.approvedAt}
              onChange={e => onChange("approvedAt", e.target.value)} fullWidth />
            <ComCodeSelect groupCode="INSPECT_AID_STATUS" includeAll={false} label={t("common.status")}
              value={form.status} onChange={v => onChange("status", v)} fullWidth />
            <UseYnSelect includeAll={false} label={t("common.useYn")} value={form.useYn}
              onChange={v => onChange("useYn", v)} fullWidth />
            <div className="col-span-2">
              <Input label={t("master.inspectAid.location")} value={form.location}
                onChange={e => onChange("location", e.target.value)} fullWidth />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.inspectAid.image")}</h3>
          {previewUrl ? (
            <div className="relative group">
              {imageError ? (
                <div className="w-full h-44 rounded-lg border border-border bg-surface flex flex-col items-center justify-center gap-2">
                  <ImageIcon className="w-8 h-8 text-text-muted" />
                  <span className="text-xs text-text-muted">{t("master.inspectAid.imageLoadFailed")}</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveBackendFileUrl(previewUrl)} alt={form.aidName || form.aidCode}
                  onError={onImageError}
                  className="w-full h-44 object-contain rounded-lg border border-border bg-surface" />
              )}
              <button type="button" onClick={onRequestImageDelete}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title={t("common.delete")}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}
              className="w-full h-28 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary transition-colors disabled:opacity-50">
              {saving ? <RefreshCw className="w-6 h-6 text-text-muted animate-spin" /> : <ImageIcon className="w-8 h-8 text-text-muted" />}
              <span className="text-xs text-text-muted">{t("master.inspectAid.imageUploadHint")}</span>
            </button>
          )}
          {previewUrl && (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}
              className="mt-2 w-full text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              {t("master.inspectAid.imageChange")}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageSelect(file);
              e.target.value = "";
            }}
          />
        </div>

        <Input label={t("common.remark")} value={form.remark}
          onChange={e => onChange("remark", e.target.value)} fullWidth />
      </div>
    </div>
  );
}
