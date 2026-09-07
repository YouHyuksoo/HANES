"use client";

/**
 * @file src/app/(authenticated)/quality/spc/components/SpcDataUploadModal.tsx
 * @description SPC 측정데이터(SPC_DATA) 엑셀 업로드 모달 — SpcChartUploadModal과 동일한 미리보기→업로드 2단계 UX.
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Download } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui";
import api from "@/services/api";
import { ErrorTable } from "./SpcChartUploadModal";

interface UploadResult {
  inserted: number;
  errors: { row: number; message: string }[];
}

interface PreviewRow {
  row: number;
  chartId: string;
  sampleDate: string;
  subgroupNo: number | null;
  values: number[];
  equipCode: string;
  status: "new" | "error";
  message?: string;
}

interface PreviewResult {
  rows: PreviewRow[];
  newCount: number;
  errorCount: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Stage = "idle" | "previewing" | "previewed" | "uploading" | "done";

const STATUS_STYLES: Record<PreviewRow["status"], { bg: string; label: string; icon: React.ReactNode }> = {
  new: { bg: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300", label: "신규", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  error: { bg: "bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400", label: "오류", icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

export default function SpcDataUploadModal({ isOpen, onClose, onComplete }: Props) {
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

  useEffect(() => {
    if (isOpen) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => { reset(); onClose(); };

  const handleDownloadTemplate = async () => {
    const res = await api.get("/quality/spc/data/upload/template", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SPC_DATA_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async (f: File) => {
    setStage("previewing");
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await api.post("/quality/spc/data/upload/preview", formData, {
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
    if (!file || !preview) return;
    setStage("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/quality/spc/data/upload", formData, {
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

  const canUpload = stage === "previewed" && (preview?.newCount ?? 0) > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("quality.spc.hv.dataUploadTitle", "측정데이터 엑셀 업로드")}
      size="xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-1" />{t("quality.spc.hv.downloadTemplate", "양식 다운로드")}
          </Button>
          {stage === "previewed" && (
            <Button size="sm" onClick={handleUpload} disabled={!canUpload}>
              <Upload className="w-4 h-4 mr-1" />
              {t("quality.spc.hv.uploadWithCount", "업로드")} ({preview?.newCount ?? 0}{t("common.count", "건")})
            </Button>
          )}
          <Button variant={stage === "done" ? "primary" : "ghost"} size="sm" onClick={handleClose}>{t("common.close")}</Button>
        </>
      }
    >
      <div className="mb-4">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          disabled={stage === "previewing" || stage === "uploading"}
          className="block w-full text-sm text-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
        />
        <p className="text-xs text-text-muted mt-1">{t("quality.spc.hv.dataXlsxHint", ".xlsx 파일만 업로드 가능합니다. 관리도번호는 미리 등록돼 있어야 하고, 측정값 개수는 관리도의 서브그룹크기와 같아야 합니다.")}</p>
      </div>

      {stage === "previewing" && (
        <div className="flex items-center justify-center gap-2 py-10 text-text-muted">
          <FileSpreadsheet className="w-5 h-5 animate-pulse text-primary" />
          <span className="text-sm">{t("quality.spc.hv.analyzingFile", "파일 분석 중...")}</span>
        </div>
      )}

      {(stage === "previewed" || stage === "uploading") && preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SummaryBadge label="신규" count={preview.newCount} color="emerald" />
            <SummaryBadge label="오류" count={preview.errorCount} color="gray" />
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface dark:bg-gray-800 border-b border-border">
                  <tr className="text-text-muted">
                    <th className="px-2 py-2 text-center w-12">행</th>
                    <th className="px-2 py-2 text-left">관리도번호</th>
                    <th className="px-2 py-2 text-left">측정일시</th>
                    <th className="px-2 py-2 text-center w-16">서브그룹</th>
                    <th className="px-2 py-2 text-left">측정값</th>
                    <th className="px-2 py-2 text-left w-20">설비</th>
                    <th className="px-2 py-2 text-center w-20">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => {
                    const s = STATUS_STYLES[r.status];
                    return (
                      <tr key={r.row} className="border-t border-border/50">
                        <td className="px-2 py-1.5 text-center font-mono text-text-muted">{r.row}</td>
                        <td className="px-2 py-1.5 font-mono truncate max-w-[120px]" title={r.chartId}>{r.chartId}</td>
                        <td className="px-2 py-1.5 text-text-muted">{r.sampleDate ? new Date(r.sampleDate).toLocaleString() : "-"}</td>
                        <td className="px-2 py-1.5 text-center">{r.subgroupNo ?? "-"}</td>
                        <td className="px-2 py-1.5 font-mono truncate max-w-[160px]" title={r.values.join(", ")}>{r.values.join(", ") || "-"}</td>
                        <td className="px-2 py-1.5">{r.equipCode || "-"}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${s.bg}`} title={r.message}>
                            {s.icon}{s.label}
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

      {stage === "done" && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="등록" value={result.inserted} color="emerald" />
            <StatCard label="에러" value={result.errors.length} color="red" />
          </div>
          {result.errors.length > 0 && <ErrorTable errors={result.errors} />}
        </div>
      )}
    </Modal>
  );
}

function SummaryBadge({ label, count, color }: { label: string; count: number; color: "emerald" | "gray" }) {
  const styles = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[color]}`}>
      {label} <span className="font-bold">{count}</span>
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "emerald" | "red" }) {
  const styles = {
    emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    red: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  };
  return (
    <div className={`rounded border px-3 py-3 text-center ${styles[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
    </div>
  );
}
