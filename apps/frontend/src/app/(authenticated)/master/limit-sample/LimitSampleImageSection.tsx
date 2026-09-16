"use client";

/**
 * @file src/app/(authenticated)/master/limit-sample/LimitSampleImageSection.tsx
 * @description 견본 사진 다중 관리 섹션 — 여러 장 업로드, 캡션, 대표 지정, 순서 변경, 개별 삭제
 *
 * 초보자 가이드:
 * 1. 저장된 사진(images)과 아직 업로드 전인 사진(pending)을 한 목록으로 보여준다.
 *    신규 등록 화면에서는 견본이 아직 없으므로 pending에만 쌓였다가 저장 후 순차 업로드된다.
 * 2. 대표는 견본당 1장이라 라디오로만 지정한다(DB도 유니크 인덱스로 강제).
 * 3. 삭제는 브라우저 confirm 대신 page.tsx의 ConfirmModal을 거친다.
 */
import { useRef } from "react";
import type { TFunction } from "i18next";
import { ChevronDown, ChevronUp, ImageIcon, Trash2 } from "lucide-react";
import { Input } from "@/components/ui";
import { resolveBackendFileUrl } from "@/utils/file-url";
import type { LimitSampleImageRow } from "./limitSampleColumns";

/** 저장 전 로컬 큐에 담긴 사진 */
export interface PendingSampleImage {
  /** 로컬 식별자 (crypto.randomUUID) */
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  isPrimary: boolean;
}

interface LimitSampleImageSectionProps {
  t: TFunction;
  saving: boolean;
  images: LimitSampleImageRow[];
  pending: PendingSampleImage[];
  onAddFiles: (files: File[]) => void;
  onChangeSavedCaption: (seqNo: number, caption: string) => void;
  onChangePendingCaption: (id: string, caption: string) => void;
  onSetSavedPrimary: (seqNo: number) => void;
  onSetPendingPrimary: (id: string) => void;
  onMoveSaved: (seqNo: number, direction: -1 | 1) => void;
  onRequestDeleteSaved: (seqNo: number) => void;
  onRemovePending: (id: string) => void;
}

export default function LimitSampleImageSection({
  t, saving, images, pending,
  onAddFiles, onChangeSavedCaption, onChangePendingCaption,
  onSetSavedPrimary, onSetPendingPrimary, onMoveSaved,
  onRequestDeleteSaved, onRemovePending,
}: LimitSampleImageSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasAny = images.length > 0 || pending.length > 0;

  return (
    <div>
      <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.limitSample.sectionImages")}</h3>

      {hasAny && (
        <ul className="space-y-2 mb-2">
          {images.map((img, index) => (
            <li key={`saved-${img.seqNo}`} className="flex gap-2 items-start border border-border rounded-lg p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveBackendFileUrl(img.imageUrl)} alt={img.caption ?? String(img.seqNo)}
                className="w-16 h-16 object-contain rounded border border-border bg-surface flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <Input value={img.caption ?? ""} placeholder={t("master.limitSample.imageCaptionPlaceholder")}
                  onChange={(e) => onChangeSavedCaption(img.seqNo, e.target.value)} fullWidth />
                <label className="flex items-center gap-1.5 cursor-pointer text-text-muted">
                  <input type="radio" name="limitSamplePrimary" checked={img.isPrimary === "Y"}
                    onChange={() => onSetSavedPrimary(img.seqNo)} />
                  {t("master.limitSample.imageSetPrimary")}
                </label>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button type="button" onClick={() => onMoveSaved(img.seqNo, -1)} disabled={index === 0 || saving}
                  className="p-1 hover:bg-surface rounded disabled:opacity-30" title={t("master.limitSample.sortOrder")}>
                  <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
                </button>
                <button type="button" onClick={() => onMoveSaved(img.seqNo, 1)} disabled={index === images.length - 1 || saving}
                  className="p-1 hover:bg-surface rounded disabled:opacity-30" title={t("master.limitSample.sortOrder")}>
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                </button>
                <button type="button" onClick={() => onRequestDeleteSaved(img.seqNo)} disabled={saving}
                  className="p-1 hover:bg-surface rounded disabled:opacity-30" title={t("common.delete")}>
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </li>
          ))}

          {pending.map((item) => (
            <li key={`pending-${item.id}`} className="flex gap-2 items-start border border-dashed border-border rounded-lg p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt={item.caption || item.file.name}
                className="w-16 h-16 object-contain rounded border border-border bg-surface flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <Input value={item.caption} placeholder={t("master.limitSample.imageCaptionPlaceholder")}
                  onChange={(e) => onChangePendingCaption(item.id, e.target.value)} fullWidth />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-text-muted">
                    <input type="radio" name="limitSamplePrimary" checked={item.isPrimary}
                      onChange={() => onSetPendingPrimary(item.id)} />
                    {t("master.limitSample.imageSetPrimary")}
                  </label>
                  <span className="text-text-muted">{t("master.limitSample.imagePending")}</span>
                </div>
              </div>
              <button type="button" onClick={() => onRemovePending(item.id)} disabled={saving}
                className="p-1 hover:bg-surface rounded disabled:opacity-30 flex-shrink-0" title={t("common.delete")}>
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}
        className="w-full h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary transition-colors disabled:opacity-50">
        <ImageIcon className="w-6 h-6 text-text-muted" />
        <span className="text-xs text-text-muted">{t("master.limitSample.imageAddHint")}</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onAddFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
