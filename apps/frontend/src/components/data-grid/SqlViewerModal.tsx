"use client";

/**
 * @file src/components/data-grid/SqlViewerModal.tsx
 * @description DataGrid SQL 뷰어 모달 — SQL 하이라이팅 + 선택형 테이블 컬럼 명세
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Database, TableProperties, Loader2 } from "lucide-react";
import api, { getLatestActualSqlForPreview } from "@/services/api";

interface ColumnInfo {
  columnId: number;
  columnName: string;
  dataType: string;
  dataLength: number | null;
  dataPrecision: number | null;
  dataScale: number | null;
  nullable: "Y" | "N";
  comments: string | null;
}

interface TableSchemaResult {
  tableName: string;
  tableComment: string | null;
  columns: ColumnInfo[];
}

export interface ActiveFilter {
  id: string;
  value: unknown;
  filterType: 'text' | 'select' | 'multi' | 'number' | 'date' | 'none';
  header: string;
}

interface SqlViewerModalProps {
  sql: string;
  activeFilters?: ActiveFilter[];
  onClose: () => void;
}

// ─── SQL 하이라이팅 ────────────────────────────────────────────────────────────

const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|UNION|INSERT|INTO|UPDATE|SET|DELETE|WITH|DISTINCT|LIMIT|OFFSET|CASE|WHEN|THEN|ELSE|END|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|EXISTS|BETWEEN|LIKE|ASC|DESC|COUNT|SUM|AVG|MIN|MAX|COALESCE|NVL|SUBSTR|TRIM|UPPER|LOWER|TO_DATE|TO_CHAR|SYSDATE|ROWNUM|DUAL)\b/g;

function highlightSql(sql: string): ReactNode[] {
  const lines = sql.trim().split("\n");
  return lines.map((line, li) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    SQL_KEYWORDS.lastIndex = 0;
    while ((match = SQL_KEYWORDS.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index));
      parts.push(
        <span key={`kw-${li}-${match.index}`} className="text-blue-400 font-semibold">
          {match[0]}
        </span>
      );
      last = match.index + match[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <div key={li} className="flex">
        <span className="select-none w-8 text-right pr-3 text-slate-600 text-xs leading-6 flex-shrink-0">
          {li + 1}
        </span>
        <span className="leading-6 flex-1">{parts}</span>
      </div>
    );
  });
}

// SQL FROM 절에서 테이블명 추출
function extractTableName(sql: string): string | null {
  const m = sql.match(/\bFROM\s+([A-Z_][A-Z0-9_]*)/i);
  return m ? m[1].toUpperCase() : null;
}

// camelCase → UPPER_SNAKE_CASE
function toSqlCol(id: string): string {
  return id.replace(/([A-Z])/g, "_$1").toUpperCase();
}

// 필터 → SQL WHERE 조건 문자열 배열
function buildFilterConditions(filters: ActiveFilter[]): string[] {
  return filters.flatMap((f) => {
    const col = toSqlCol(f.id);
    const { filterType, value } = f;

    if (filterType === "multi" && Array.isArray(value) && value.length) {
      const list = (value as string[]).map((v) => `'${v}'`).join(", ");
      return [`  AND ${col} IN (${list})`];
    }
    if (filterType === "number" && Array.isArray(value)) {
      const [min, max] = value as [number | null, number | null];
      if (min != null && max != null) return [`  AND ${col} BETWEEN ${min} AND ${max}`];
      if (min != null) return [`  AND ${col} >= ${min}`];
      if (max != null) return [`  AND ${col} <= ${max}`];
    }
    if (filterType === "date" && Array.isArray(value)) {
      const [d1, d2] = value as [string, string];
      if (d1 && d2) return [`  AND ${col} BETWEEN TO_DATE('${d1}', 'YYYY-MM-DD') AND TO_DATE('${d2}', 'YYYY-MM-DD')`];
      if (d1) return [`  AND ${col} >= TO_DATE('${d1}', 'YYYY-MM-DD')`];
    }
    if (filterType === "select" && value) {
      return [`  AND ${col} = '${value}'`];
    }
    if (value && typeof value === "string" && value.trim()) {
      return [`  AND ${col} LIKE '%${value.trim()}%'`];
    }
    return [];
  });
}

// 기본 SQL에 필터 조건 삽입 (ORDER BY 앞)
function buildEffectiveSql(baseSql: string, filters: ActiveFilter[]): string {
  const conditions = buildFilterConditions(filters);
  if (!conditions.length) return baseSql;

  const orderByMatch = baseSql.match(/\n?(ORDER\s+BY\b.*)/is);
  if (orderByMatch && orderByMatch.index !== undefined) {
    return (
      baseSql.slice(0, orderByMatch.index).trimEnd() +
      "\n" + conditions.join("\n") +
      "\n" + orderByMatch[1]
    );
  }
  return baseSql.trimEnd() + "\n" + conditions.join("\n");
}

// 컬럼 타입 표시 (Oracle 형식)
function formatType(col: ColumnInfo): string {
  const t = col.dataType;
  if (t === "VARCHAR2" || t === "CHAR" || t === "NVARCHAR2") {
    return `${t}(${col.dataLength ?? ""})`;
  }
  if (t === "NUMBER") {
    if (col.dataPrecision !== null && col.dataScale !== null)
      return `NUMBER(${col.dataPrecision},${col.dataScale})`;
    if (col.dataPrecision !== null)
      return `NUMBER(${col.dataPrecision})`;
    return "NUMBER";
  }
  return t;
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function SqlViewerModal({ sql, activeFilters = [], onClose }: SqlViewerModalProps) {
  const actualSql = getLatestActualSqlForPreview(sql) ?? sql;
  const effectiveSql = buildEffectiveSql(actualSql, activeFilters);

  const [copied, setCopied] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [schema, setSchema] = useState<TableSchemaResult | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const tableName = extractTableName(actualSql);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // 테이블 명세는 사용자가 요청했을 때만 로드한다.
  useEffect(() => {
    if (!showSchema || !tableName) return;

    setSchemaLoading(true);
    setSchemaError(null);
    api.get<{ data: { tableName: string; tableComment: string | null; columns: ColumnInfo[] } }>(
      `/system/table-schema?table=${tableName}`
    )
      .then((res) => setSchema(res.data.data))
      .catch(() => setSchemaError("테이블 명세를 불러올 수 없습니다"))
      .finally(() => setSchemaLoading(false));
  }, [showSchema, tableName]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(effectiveSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60"
        style={{
          background: "linear-gradient(145deg, #1e2433, #161b27)",
          width: "min(1200px, 96vw)",
          maxHeight: "85vh",
        }}
      >
        {/* ── 헤더 ── */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/60 flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/15">
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-slate-200 tracking-wide">
              SQL 조회문
            </span>
            {tableName && (
              <span className="px-2 py-0.5 rounded-md bg-slate-700/60 text-xs text-slate-400 font-mono">
                {tableName}
                {schema?.tableComment ? ` · ${schema.tableComment}` : ""}
              </span>
            )}
            {activeFilters.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-xs text-amber-400">
                필터 {activeFilters.length}건 적용됨
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSchema((prev) => !prev)}
              disabled={!tableName}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                border border-slate-600/60 text-slate-300 hover:bg-slate-700/60 hover:border-slate-500 hover:text-white
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-300"
              title={tableName ? (showSchema ? "컬럼명세 숨기기" : "컬럼명세 보기") : "SQL에서 테이블명을 찾을 수 없습니다"}
            >
              <TableProperties className="w-3.5 h-3.5" />
              {showSchema ? "컬럼명세 숨기기" : "컬럼명세 보기"}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                border border-slate-600/60 text-slate-300 hover:bg-slate-700/60 hover:border-slate-500 hover:text-white"
            >
              {copied
                ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">복사됨</span></>
                : <><Copy className="w-3.5 h-3.5" />SQL 복사</>}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700/60 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 본문 ── */}
        <div className="flex flex-1 min-h-0">

          {/* 왼쪽: SQL */}
          <div className={`flex flex-col min-h-0 ${showSchema ? "w-[45%] border-r border-slate-700/60" : "w-full"}`}>
            <div className="px-4 py-2 border-b border-slate-700/40 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">SQL</span>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {highlightSql(effectiveSql)}
              </pre>
            </div>
          </div>

          {/* 오른쪽: 테이블 명세 */}
          {showSchema && (
            <div className="flex flex-col flex-1 min-h-0 min-w-0">
              <div className="px-4 py-2 border-b border-slate-700/40 flex-shrink-0 flex items-center gap-2"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <TableProperties className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">컬럼 명세</span>
                {schema && (
                  <span className="text-xs text-slate-600">— {schema.columns.length}개 컬럼</span>
                )}
              </div>

              <div className="overflow-auto flex-1">
                {schemaLoading && (
                  <div className="flex items-center justify-center h-32 gap-2 text-slate-500 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    명세 로딩 중...
                  </div>
                )}
                {schemaError && (
                  <div className="flex items-center justify-center h-32 text-slate-600 text-xs">
                    {schemaError}
                  </div>
                )}
                {schema && !schemaLoading && (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ background: "#1a1f2e" }}>
                      <tr className="border-b border-slate-700/60">
                        <th className="text-left px-3 py-2 text-slate-500 font-medium w-8">#</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">컬럼명</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">타입</th>
                        <th className="text-center px-3 py-2 text-slate-500 font-medium w-12">NULL</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">설명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schema.columns.map((col, idx) => (
                        <tr
                          key={col.columnName}
                          className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-3 py-1.5 text-slate-600">{idx + 1}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-300">{col.columnName}</td>
                          <td className="px-3 py-1.5 font-mono text-amber-400/80">{formatType(col)}</td>
                          <td className="px-3 py-1.5 text-center">
                            {col.nullable === "Y"
                              ? <span className="text-slate-600">Y</span>
                              : <span className="text-rose-400 font-semibold">N</span>}
                          </td>
                          <td className="px-3 py-1.5 text-slate-400">{col.comments ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 푸터 ── */}
        <div
          className="flex items-center justify-end px-5 py-2 border-t border-slate-700/40 flex-shrink-0"
          style={{ background: "rgba(0,0,0,0.2)" }}
        >
          <span className="text-xs text-slate-600">ESC to close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
