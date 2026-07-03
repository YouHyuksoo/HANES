"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui";
import api from "@/services/api";

interface UploadResult {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

interface PreviewRow {
  row: number;
  parentItemCode: string;
  childItemCode: string;
  validFrom: string | null;
  validTo: string | null;
  qtyPer: number | null;
  revision: string;
  status: "new" | "duplicate_db" | "duplicate_file" | "error";
  message?: string;
}

interface PreviewResult {
  rows: PreviewRow[];
  duplicateCount: number;
  newCount: number;
  errorCount: number;
}

interface BomUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Stage = "idle" | "previewing" | "previewed" | "uploading" | "done";

const STATUS_STYLES: Record<PreviewRow["status"], { bg: string; labelKey: string; labelFallback: string; icon: React.ReactNode }> = {
  new: { bg: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300", labelKey: "master.bom.uploadStatusNew", labelFallback: "신규", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  duplicate_db: { bg: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300", labelKey: "master.bom.uploadStatusDuplicateDb", labelFallback: "DB중복", icon: <XCircle className="w-3.5 h-3.5" /> },
  duplicate_file: { bg: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300", labelKey: "master.bom.uploadStatusDuplicateFile", labelFallback: "파일중복", icon: <XCircle className="w-3.5 h-3.5" /> },
  error: { bg: "bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400", labelKey: "master.bom.uploadStatusError", labelFallback: "오류", icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

export default function BomUploadModal({ isOpen, onClose, onComplete }: BomUploadModalProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const reset = () => {
    setFile(null);
    setStage("idle");
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // 모달이 열릴 때마다 항상 초기화 — 직전 업로드의 잔존 상태(stage="done", 선택 파일)
  // 때문에 같은 파일 재선택 시 onChange가 안 떠 미리보기/업로드 버튼이 안 나오는 문제 방지
  useEffect(() => {
    if (isOpen) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => { reset(); onClose(); };

  const handlePreview = async (f: File) => {
    setStage("previewing");
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await api.post("/master/boms/upload/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        setPreview(res.data.data);
        setStage("previewed");
      } else {
        setStage("idle");
      }
    } catch {
      setStage("idle");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    if (f) handlePreview(f);
    else setStage("idle");
  };

  const handleUpload = async () => {
    if (!file || !preview || preview.duplicateCount > 0) return;
    setStage("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/master/boms/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        setResult(res.data.data);
        setStage("done");
        onComplete();
      } else {
        setStage("previewed");
      }
    } catch {
      setStage("previewed");
    }
  };

  const hasDuplicates = (preview?.duplicateCount ?? 0) > 0;
  const canUpload = stage === "previewed" && !hasDuplicates && (preview?.errorCount ?? 0) < (preview?.rows.length ?? 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("master.bom.excelUploadTitle", "BOM 엑셀 업로드")}
      size="xl"
      footer={
        <>
          {stage === "previewed" && !hasDuplicates && (
            <Button size="sm" onClick={handleUpload} disabled={!canUpload} isLoading={false}>
              <Upload className="w-4 h-4 mr-1" />
              {t("master.bom.uploadWithCount", "업로드")} ({preview?.newCount ?? 0}{t("common.count", "건")})
            </Button>
          )}
          {stage === "done" ? (
            <Button size="sm" onClick={handleClose}>{t("common.close")}</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleClose}>{t("common.close")}</Button>
          )}
        </>
      }
    >
      {/* 파일 선택 */}
      <div className="mb-4">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          disabled={stage === "previewing" || stage === "uploading"}
          className="block w-full text-sm text-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
        />
        <p className="text-xs text-text-muted mt-1">{t("master.bom.xlsxOnlyHint", ".xlsx 파일만 업로드 가능합니다")}</p>
      </div>

      {/* 로딩 */}
      {stage === "previewing" && (
        <div className="flex items-center justify-center gap-2 py-10 text-text-muted">
          <FileSpreadsheet className="w-5 h-5 animate-pulse text-primary" />
          <span className="text-sm">{t("master.bom.analyzingFile", "파일 분석 중...")}</span>
        </div>
      )}

      {/* 미리보기 결과 */}
      {(stage === "previewed" || stage === "uploading") && preview && (
        <div className="space-y-3">
          {/* 요약 배지 */}
          <div className="flex items-center gap-2 flex-wrap">
            <SummaryBadge label={t("master.bom.uploadStatusNew", "신규")} count={preview.newCount} color="emerald" />
            <SummaryBadge label={t("master.bom.summaryDuplicate", "중복")} count={preview.duplicateCount} color="red" />
            <SummaryBadge label={t("master.bom.uploadStatusError", "오류")} count={preview.errorCount} color="gray" />
          </div>

          {/* 중복 경고 배너 */}
          {hasDuplicates && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">{t("master.bom.duplicateFoundWarning", { count: preview.duplicateCount, defaultValue: "중복 {{count}}건 발견 — 업로드할 수 없습니다." })}</span>
                <p className="text-xs mt-0.5 opacity-80">{t("master.bom.duplicateFoundDetail", "동일한 상위품목+하위품목+적용일자 조합이 이미 존재합니다. 파일을 수정 후 다시 선택하세요.")}</p>
              </div>
            </div>
          )}

          {/* 행 목록 */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface dark:bg-gray-800 border-b border-border">
                  <tr className="text-text-muted">
                    <th className="px-2 py-2 text-center w-12">{t("master.bom.colRow", "행")}</th>
                    <th className="px-2 py-2 text-left">{t("master.bom.colParentItem", "상위품목")}</th>
                    <th className="px-2 py-2 text-left">{t("master.bom.colChildItem", "하위품목")}</th>
                    <th className="px-2 py-2 text-center w-24">{t("master.bom.colValidFrom", "적용일자")}</th>
                    <th className="px-2 py-2 text-center w-24">{t("master.bom.colValidTo", "완료일자")}</th>
                    <th className="px-2 py-2 text-center w-8">{t("common.quantity", "수량")}</th>
                    <th className="px-2 py-2 text-center w-20">{t("common.status", "상태")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => {
                    const s = STATUS_STYLES[r.status];
                    return (
                      <tr key={r.row} className="border-t border-border/50">
                        <td className="px-2 py-1.5 text-center font-mono text-text-muted">{r.row}</td>
                        <td className="px-2 py-1.5 font-mono truncate max-w-[120px]" title={r.parentItemCode}>{r.parentItemCode}</td>
                        <td className="px-2 py-1.5 font-mono truncate max-w-[120px]" title={r.childItemCode}>{r.childItemCode}</td>
                        <td className="px-2 py-1.5 text-center text-text-muted">{r.validFrom ?? "-"}</td>
                        <td className="px-2 py-1.5 text-center text-text-muted">{r.validTo ?? "-"}</td>
                        <td className="px-2 py-1.5 text-center">{r.qtyPer ?? "-"}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${s.bg}`} title={r.message}>
                            {s.icon}{t(s.labelKey, s.labelFallback)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 업로드 완료 결과 */}
      {stage === "done" && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label={t("master.bom.resultInserted", "추가")} value={result.inserted} color="emerald" />
            <StatCard label={t("master.bom.resultSkipped", "스킵")} value={result.skipped} color="amber" />
            <StatCard label={t("master.bom.resultError", "에러")} value={result.errors.length} color="red" />
          </div>
          {result.errors.length > 0 && (
            <div className="border border-red-200 dark:border-red-800 rounded overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm font-medium">
                <AlertCircle className="w-4 h-4" />{t("master.bom.errorDetail", "에러 상세")}
              </div>
              <div className="max-h-48 overflow-y-auto min-h-0">
                <table className="w-full text-sm">
                  <thead className="bg-surface sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-text-muted font-medium w-20">{t("master.bom.colRow", "행")}</th>
                      <th className="px-3 py-1.5 text-left text-text-muted font-medium">{t("master.bom.colMessage", "메시지")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{err.row}</td>
                        <td className="px-3 py-1.5 text-red-600 dark:text-red-400">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function SummaryBadge({ label, count, color }: { label: string; count: number; color: "emerald" | "red" | "gray" }) {
  const styles = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[color]}`}>
      {label} <span className="font-bold">{count}</span>
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "emerald" | "amber" | "red" }) {
  const styles = {
    emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    red: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  };
  return (
    <div className={`rounded border px-3 py-3 text-center ${styles[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
    </div>
  );
}
