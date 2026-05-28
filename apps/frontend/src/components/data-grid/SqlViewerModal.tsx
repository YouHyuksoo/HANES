"use client";

/**
 * @file src/components/data-grid/SqlViewerModal.tsx
 * @description DataGrid SQL 조회 모달 — SQL 키워드 하이라이팅 + 다크 코드 에디터 스타일
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Database } from "lucide-react";

interface SqlViewerModalProps {
  sql: string;
  onClose: () => void;
}

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

export function SqlViewerModal({ sql, onClose }: SqlViewerModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col w-[820px] max-w-[95vw] max-h-[75vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60"
        style={{ background: "linear-gradient(145deg, #1e2433, #161b27)" }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/60 flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/15">
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-slate-200 tracking-wide">SQL 조회문</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                border border-slate-600/60 text-slate-300 hover:bg-slate-700/60 hover:border-slate-500 hover:text-white"
              title="클립보드에 복사"
            >
              {copied
                ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">복사됨</span></>
                : <><Copy className="w-3.5 h-3.5" />복사</>}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700/60 hover:text-white transition-all duration-150"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 라인 넘버 구분선 */}
        <div className="overflow-auto flex-1 p-4">
          <pre className="font-mono text-xs text-slate-300 leading-relaxed">
            {highlightSql(sql)}
          </pre>
        </div>

        {/* 푸터 힌트 */}
        <div className="flex items-center justify-end px-5 py-2 border-t border-slate-700/40 flex-shrink-0"
          style={{ background: "rgba(0,0,0,0.2)" }}>
          <span className="text-xs text-slate-600">ESC to close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
