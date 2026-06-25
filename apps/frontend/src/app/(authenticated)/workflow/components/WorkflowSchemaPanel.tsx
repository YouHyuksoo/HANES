"use client";

/**
 * @file src/app/(authenticated)/workflow/components/WorkflowSchemaPanel.tsx
 * @description 워크플로우 가이드 — 데이터 칩 클릭 시 우측에서 열리는 테이블 스키마 패널
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Database, Loader2, X } from "lucide-react";
import api from "@/services/api";

interface ColumnInfo {
  columnId: number;
  columnName: string;
  dataType: string;
  dataLength: number | null;
  dataPrecision: number | null;
  dataScale: number | null;
  nullable: "Y" | "N";
  dataDefault: string | null;
  comments: string | null;
}

interface TableSchemaResult {
  tableName: string;
  tableComment: string | null;
  columns: ColumnInfo[];
}

/** Oracle 컬럼 타입 표기 (VARCHAR2(n), NUMBER(p,s) 등) */
function formatType(col: ColumnInfo): string {
  const t = col.dataType;
  if (t === "VARCHAR2" || t === "CHAR" || t === "NVARCHAR2") {
    return `${t}(${col.dataLength ?? ""})`;
  }
  if (t === "NUMBER") {
    if (col.dataPrecision !== null && col.dataScale !== null) return `NUMBER(${col.dataPrecision},${col.dataScale})`;
    if (col.dataPrecision !== null) return `NUMBER(${col.dataPrecision})`;
    return "NUMBER";
  }
  return t;
}

export default function WorkflowSchemaPanel({
  tableName,
  onClose,
}: {
  tableName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [schema, setSchema] = useState<TableSchemaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 테이블 스키마 조회
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setSchema(null);
    api
      .get<{ data: TableSchemaResult }>(`/system/table-schema?table=${encodeURIComponent(tableName)}`)
      .then((res) => {
        if (!cancelled) setSchema(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tableName]);

  const empty = !loading && !error && schema !== null && schema.columns.length === 0;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9990] bg-black/40" onClick={onClose} aria-hidden />
      <aside className="animate-slide-in-right fixed right-0 top-0 z-[9991] flex h-screen w-[520px] max-w-[95vw] flex-col border-l border-border bg-background shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Database className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-mono text-sm font-bold text-text">{tableName}</h2>
            {schema?.tableComment && (
              <p className="truncate text-xs text-text-muted">{schema.tableComment}</p>
            )}
          </div>
          {schema && (
            <span className="shrink-0 text-xs text-text-muted">
              {schema.columns.length}
              {t("workflowGuide.columnsSuffix", "개 컬럼")}
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-surface"
            aria-label={t("common.close", "닫기")}
          >
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("workflowGuide.schemaLoading", "스키마 불러오는 중…")}
            </div>
          )}
          {error && (
            <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-text-muted">
              {t("workflowGuide.schemaError", "테이블 명세를 불러올 수 없습니다.")}
            </div>
          )}
          {empty && (
            <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-text-muted">
              {t("workflowGuide.schemaEmpty", "컬럼 정보가 없습니다. 테이블명을 확인하세요.")}
            </div>
          )}
          {schema && schema.columns.length > 0 && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-text-muted">
                  <th className="w-8 px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">{t("workflowGuide.colName", "컬럼명")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("workflowGuide.colType", "타입")}</th>
                  <th className="w-12 px-3 py-2 text-center font-medium">NULL</th>
                  <th className="px-3 py-2 text-left font-medium">{t("workflowGuide.colDesc", "설명")}</th>
                </tr>
              </thead>
              <tbody>
                {schema.columns.map((col, idx) => (
                  <tr key={col.columnName} className="border-b border-border/60 hover:bg-surface">
                    <td className="px-3 py-1.5 text-text-muted">{idx + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-text">{col.columnName}</td>
                    <td className="px-3 py-1.5 font-mono text-primary">{formatType(col)}</td>
                    <td className="px-3 py-1.5 text-center">
                      {col.nullable === "Y" ? (
                        <span className="text-text-muted">Y</span>
                      ) : (
                        <span className="font-semibold text-rose-500">N</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-text-muted">{col.comments ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-border px-4 py-2 text-right text-xs text-text-muted">
          ESC to close
        </div>
      </aside>
    </>,
    document.body,
  );
}
