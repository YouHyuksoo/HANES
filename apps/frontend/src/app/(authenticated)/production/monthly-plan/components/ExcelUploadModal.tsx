/**
 * @file production/monthly-plan/components/ExcelUploadModal.tsx
 * @description 엑셀 업로드 모달 - 프론트에서 xlsx 파싱 → JSON으로 백엔드 전송
 *
 * 초보자 가이드:
 * 1. **xlsx 라이브러리**: 프론트에서 엑셀 파일을 파싱
 * 2. **템플릿 다운로드**: 빈 엑셀 파일 생성
 * 3. **미리보기**: 파싱 결과를 테이블로 표시 후 업로드 확인
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui";
import api from "@/services/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
  planMonth: string;
}

interface ParsedRow {
  itemCode: string;
  itemType: string;
  planQty: number;
  customer?: string;
  lineCode?: string;
  priority?: number;
  remark?: string;
  error?: string;
}

export default function ExcelUploadModal({ isOpen, onClose, onUploaded, planMonth }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleDownloadTemplate = useCallback(() => {
    const headers = [
      t("monthlyPlan.excel.itemCode"),
      t("monthlyPlan.excel.itemType"),
      t("monthlyPlan.excel.planQty"),
      t("monthlyPlan.excel.customer"),
      t("monthlyPlan.excel.lineCode"),
      t("monthlyPlan.excel.priority"),
      t("monthlyPlan.excel.remark"),
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = [{ wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `prod-plan-template-${planMonth}.xlsx`);
  }, [t, planMonth]);

  const validateRow = (row: ParsedRow, idx: number): string | undefined => {
    if (!row.itemCode) return t("monthlyPlan.validation.itemCodeRequired");
    if (!row.itemType || !["FG", "WIP"].includes(row.itemType.toUpperCase()))
      return t("monthlyPlan.validation.itemTypeInvalid");
    if (!row.planQty || row.planQty <= 0) return t("monthlyPlan.validation.planQtyRequired");
    return undefined;
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      const headerMap: Record<string, string> = {
        [t("monthlyPlan.excel.itemCode")]: "itemCode",
        [t("monthlyPlan.excel.itemType")]: "itemType",
        [t("monthlyPlan.excel.planQty")]: "planQty",
        [t("monthlyPlan.excel.customer")]: "customer",
        [t("monthlyPlan.excel.lineCode")]: "lineCode",
        [t("monthlyPlan.excel.priority")]: "priority",
        [t("monthlyPlan.excel.remark")]: "remark",
        "itemCode": "itemCode", "ItemCode": "itemCode", "품목코드": "itemCode",
        "itemType": "itemType", "ItemType": "itemType", "품목유형": "itemType",
        "planQty": "planQty", "PlanQty": "planQty", "계획수량": "planQty",
        "customer": "customer", "Customer": "customer", "고객사": "customer",
        "lineCode": "lineCode", "LineCode": "lineCode", "라인": "lineCode",
        "priority": "priority", "Priority": "priority", "우선순위": "priority",
        "remark": "remark", "Remark": "remark", "비고": "remark",
      };

      const parsed: ParsedRow[] = jsonData.map((raw, idx) => {
        const mapped: Record<string, any> = {};
        for (const [key, val] of Object.entries(raw)) {
          const field = headerMap[key.trim()];
          if (field) mapped[field] = val;
        }

        const row: ParsedRow = {
          itemCode: String(mapped.itemCode || "").trim(),
          itemType: String(mapped.itemType || "").toUpperCase().trim(),
          planQty: Number(mapped.planQty) || 0,
          customer: mapped.customer ? String(mapped.customer).trim() : undefined,
          lineCode: mapped.lineCode ? String(mapped.lineCode).trim() : undefined,
          priority: mapped.priority ? Number(mapped.priority) : undefined,
          remark: mapped.remark ? String(mapped.remark).trim() : undefined,
        };

        row.error = validateRow(row, idx);
        return row;
      });

      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  }, [t]);

  const hasErrors = rows.some(r => !!r.error);
  const validCount = rows.filter(r => !r.error).length;

  const handleUpload = async () => {
    if (hasErrors || rows.length === 0) return;
    setUploading(true);
    try {
      const items = rows.map(({ error, ...rest }) => rest);
      await api.post("/production/prod-plans/bulk", { planMonth, items });
      setUploadResult({ success: true, message: t("monthlyPlan.excel.uploadSuccess", { count: items.length }) });
      onUploaded();
      setTimeout(() => { onClose(); setRows([]); setUploadResult(null); }, 1500);
    } catch {
      setUploadResult({ success: false, message: t("monthlyPlan.excel.uploadFailed") });
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            {t("monthlyPlan.excel.title")}
          </h2>
          <button onClick={() => { onClose(); setRows([]); setUploadResult(null); }}
            className="text-text-muted hover:text-text">✕</button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {/* 업로드 영역 */}
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-1" />{t("monthlyPlan.excel.downloadTemplate")}
            </Button>
            <label className="cursor-pointer">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" />{t("monthlyPlan.excel.selectFile")}
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
            </label>
            <span className="text-xs text-text-muted self-center">
              {t("monthlyPlan.excel.planMonthLabel")}: <strong>{planMonth}</strong>
            </span>
          </div>

          {/* 미리보기 테이블 */}
          {rows.length > 0 && (
            <div className="border border-border rounded-lg overflow-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className="bg-surface sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">{t("monthlyPlan.excel.itemCode")}</th>
                    <th className="px-3 py-2 text-left">{t("monthlyPlan.excel.itemType")}</th>
                    <th className="px-3 py-2 text-right">{t("monthlyPlan.excel.planQty")}</th>
                    <th className="px-3 py-2 text-left">{t("monthlyPlan.excel.customer")}</th>
                    <th className="px-3 py-2 text-left">{t("monthlyPlan.excel.lineCode")}</th>
                    <th className="px-3 py-2 text-center">{t("monthlyPlan.excel.priority")}</th>
                    <th className="px-3 py-2 text-left">{t("monthlyPlan.excel.remark")}</th>
                    <th className="px-3 py-2 text-center">{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className={`border-t border-border ${row.error ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                      <td className="px-3 py-1.5 text-text-muted">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-mono">{row.itemCode || "-"}</td>
                      <td className="px-3 py-1.5">{row.itemType || "-"}</td>
                      <td className="px-3 py-1.5 text-right">{row.planQty?.toLocaleString()}</td>
                      <td className="px-3 py-1.5">{row.customer || "-"}</td>
                      <td className="px-3 py-1.5">{row.lineCode || "-"}</td>
                      <td className="px-3 py-1.5 text-center">{row.priority ?? 5}</td>
                      <td className="px-3 py-1.5">{row.remark || "-"}</td>
                      <td className="px-3 py-1.5 text-center">
                        {row.error ? (
                          <span className="text-red-500 flex items-center gap-1 justify-center">
                            <AlertCircle className="w-3 h-3" />{row.error}
                          </span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 결과 메시지 */}
          {uploadResult && (
            <div className={`p-3 rounded-lg text-sm ${uploadResult.success ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
              {uploadResult.message}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-text-muted">
            {rows.length > 0 && `${validCount}/${rows.length} ${t("monthlyPlan.excel.validRows")}`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { onClose(); setRows([]); setUploadResult(null); }}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || hasErrors || rows.length === 0}
            >
              {uploading ? t("common.uploading") : t("monthlyPlan.excel.upload")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
