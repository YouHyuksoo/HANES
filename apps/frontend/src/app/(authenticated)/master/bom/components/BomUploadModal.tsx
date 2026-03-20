"use client";

/**
 * @file BomUploadModal.tsx
 * @description BOM 엑셀 업로드 모달 - 파일 선택 → 업로드 → 결과 표시
 *
 * 초보자 가이드:
 * 1. 파일 선택 (.xlsx만)
 * 2. 업로드 버튼 → POST /master/boms/upload (multipart/form-data)
 * 3. 결과: inserted(추가), skipped(스킵), errors(에러) 표시
 */
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui";
import api from "@/services/api";

interface UploadResult {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

interface BomUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function BomUploadModal({ isOpen, onClose, onComplete }: BomUploadModalProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/master/boms/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        setResult(res.data.data);
        onComplete();
      }
    } catch {
      /* api interceptor handles */
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="BOM 엑셀 업로드"
      size="lg"
      footer={
        <>
          {!result && (
            <Button size="sm" onClick={handleUpload} disabled={!file || loading} isLoading={loading}>
              <Upload className="w-4 h-4 mr-1" />
              업로드
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t("common.close")}
          </Button>
        </>
      }
    >
      {/* 파일 선택 영역 */}
      {!result && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm text-text-muted">.xlsx 파일만 업로드 가능합니다</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 dark:file:bg-primary/20 dark:file:text-primary-light"
          />
        </div>
      )}

      {/* 결과 영역 */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="추가" value={result.inserted} color="emerald" />
            <StatCard label="스킵" value={result.skipped} color="amber" />
            <StatCard label="에러" value={result.errors.length} color="red" />
          </div>

          {result.errors.length > 0 && (
            <div className="border border-red-200 dark:border-red-800 rounded overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm font-medium">
                <AlertCircle className="w-4 h-4" />
                에러 상세
              </div>
              <div className="max-h-48 overflow-y-auto min-h-0">
                <table className="w-full text-sm">
                  <thead className="bg-surface sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-text-muted font-medium w-20">행</th>
                      <th className="px-3 py-1.5 text-left text-text-muted font-medium">메시지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 text-text font-mono">{err.row}</td>
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

/** 통계 카드 (결과 표시용) */
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
