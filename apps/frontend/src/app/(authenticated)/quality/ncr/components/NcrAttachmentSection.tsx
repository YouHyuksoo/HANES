"use client";

/**
 * @file quality/ncr/components/NcrAttachmentSection.tsx
 * @description 부적합 보고서 첨부 — 현상 사진, 측정 성적서, 고객 클레임 문서
 *
 * 초보자 가이드:
 * 1. 신규 발행 화면에는 아직 NCR 번호가 없다. 그래서 파일을 바로 올리지 않고 목록에만 담아두었다가
 *    (staged) 저장이 성공해 번호가 생긴 뒤에 올린다. 업로드는 부모(NcrFormPanel)가 호출한다.
 * 2. 수정 화면에서는 번호가 있으므로 고른 즉시 올린다.
 * 3. 업로드 실패는 조용히 넘기지 않고 어느 파일이 실패했는지 이름으로 알린다 —
 *    증빙이 빠진 채 "저장됨"으로 보이면 나중에 아무도 모른다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Trash2, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import api from "@/services/api";
import { attachmentUrl, type NcrAttachment } from "../types";

interface Props {
  /** 신규 발행 중이면 null — 이때는 파일을 담아두기만 한다 */
  ncrNo: string | null;
  /** 종결 건은 첨부를 바꿀 수 없다(서버도 거부한다) */
  readOnly?: boolean;
  /** 담아둔 파일 목록을 부모에게 알린다 (저장 성공 후 업로드용) */
  onStagedChange?: (files: File[]) => void;
}

const isImage = (f: File) => f.type.startsWith("image/");

const fmtSize = (bytes: number | null) => {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function NcrAttachmentSection({ ncrNo, readOnly = false, onStagedChange }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<NcrAttachment[]>([]);
  const [staged, setStaged] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!ncrNo) { setRows([]); return; }
    try {
      const res = await api.get(`/quality/ncr/${encodeURIComponent(ncrNo)}/attachments`);
      setRows(res.data?.data ?? []);
    } catch {
      setRows([]);
    }
  }, [ncrNo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { onStagedChange?.(staged); }, [staged, onStagedChange]);

  /** 수정 화면: 고른 즉시 업로드 / 신규 화면: 목록에만 담아둔다 */
  const handlePick = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);

    if (!ncrNo) {
      setStaged((prev) => [...prev, ...picked]);
      return;
    }

    setBusy(true);
    const failed: string[] = [];
    for (const file of picked) {
      try {
        const form = new FormData();
        form.append("file", file);
        await api.post(`/quality/ncr/${encodeURIComponent(ncrNo)}/attachments`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch {
        failed.push(file.name);
      }
    }
    setBusy(false);
    await load();
    if (failed.length > 0) {
      // 어느 파일이 못 올라갔는지 이름으로 알린다
      const { default: toast } = await import("react-hot-toast");
      toast.error(
        `${t("quality.ncr.attachUploadFailed", "첨부 업로드 실패")}: ${failed.join(", ")}`,
      );
    }
  }, [ncrNo, load, t]);

  const handleRemove = useCallback(async (seq: number) => {
    if (!ncrNo) return;
    setBusy(true);
    try {
      await api.delete(`/quality/ncr/${encodeURIComponent(ncrNo)}/attachments/${seq}`);
      await load();
    } finally {
      setBusy(false);
    }
  }, [ncrNo, load]);

  const removeStaged = useCallback((idx: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const empty = rows.length === 0 && staged.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="font-medium text-text flex items-center gap-1">
          <Paperclip className="w-3.5 h-3.5" />
          {t("quality.ncr.attachments", "첨부 (사진·문서)")}
        </label>
        {!readOnly && (
          <>
            <Button size="sm" variant="secondary" disabled={busy}
              onClick={() => fileRef.current?.click()}>
              {busy
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : t("quality.ncr.attachAdd", "파일 추가")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt"
              onChange={(e) => { handlePick(e.target.files); e.currentTarget.value = ""; }}
            />
          </>
        )}
      </div>

      {empty ? (
        <p className="text-[11px] text-text-muted border border-border rounded-lg px-3 py-2">
          {readOnly
            ? t("quality.ncr.attachNone", "첨부된 파일이 없습니다.")
            : t("quality.ncr.attachHint", "불량 현상 사진과 측정 성적서를 함께 올리면 원인 분석이 빨라집니다.")}
        </p>
      ) : (
        <ul className="space-y-1">
          {/* 이미 올라간 것 */}
          {rows.map((a) => (
            <li key={a.seq} className="flex items-center gap-2 border border-border rounded-lg px-2 py-1.5">
              {a.kind === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachmentUrl(a.filePath)} alt={a.fileName}
                  className="w-8 h-8 object-cover rounded flex-shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-text-muted flex-shrink-0" />
              )}
              <a href={attachmentUrl(a.filePath)} target="_blank" rel="noopener noreferrer"
                className="flex-1 min-w-0 truncate text-primary hover:underline">
                {a.fileName}
              </a>
              <span className="text-[11px] text-text-muted flex-shrink-0">{fmtSize(a.fileSize)}</span>
              {!readOnly && (
                <button type="button" disabled={busy}
                  className="text-text-muted hover:text-red-500 flex-shrink-0"
                  title={t("common.delete", "삭제")}
                  onClick={() => handleRemove(a.seq)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}

          {/* 저장 후 올릴 것 */}
          {staged.map((f, i) => (
            <li key={`${f.name}-${i}`}
              className="flex items-center gap-2 border border-dashed border-border rounded-lg px-2 py-1.5">
              {isImage(f)
                ? <ImageIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                : <FileText className="w-4 h-4 text-text-muted flex-shrink-0" />}
              <span className="flex-1 min-w-0 truncate">{f.name}</span>
              <span className="text-[11px] text-text-muted flex-shrink-0">
                {t("quality.ncr.attachPending", "저장 시 업로드")}
              </span>
              <button type="button" className="text-text-muted hover:text-red-500 flex-shrink-0"
                title={t("common.delete", "삭제")} onClick={() => removeStaged(i)}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
