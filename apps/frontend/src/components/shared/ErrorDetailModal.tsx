"use client";

/**
 * @file src/components/shared/ErrorDetailModal.tsx
 * @description API 에러 상세 모달 - 에러 정보를 사용자에게 보여주고 복사 가능
 *
 * 초보자 가이드:
 * 1. errorStore의 에러가 있으면 자동으로 모달 표시
 * 2. 에러 상세 내용(시간, URL, 상태코드, 메시지)을 보기 쉽게 표시
 * 3. "복사" 버튼으로 에러 정보를 클립보드에 복사 → 개발자에게 전달
 */
import { useCallback, useState } from "react";
import { useErrorStore } from "@/stores/errorStore";
import { Copy, Check, AlertTriangle, X } from "lucide-react";

export default function ErrorDetailModal() {
  const { error, clearError } = useErrorStore();
  const [copied, setCopied] = useState(false);

  const buildCopyText = useCallback(() => {
    if (!error) return "";
    const lines = [
      `[HARNESS MES 에러 리포트]`,
      `시간: ${error.timestamp}`,
      `요청: ${error.method} ${error.url}`,
      `상태: ${error.status}`,
      `메시지: ${error.message}`,
    ];
    if (error.requestBody) {
      lines.push(`요청 데이터: ${error.requestBody}`);
    }
    lines.push(`응답 전문: ${error.responseBody}`);
    return lines.join("\n");
  }, [error]);

  const handleCopy = useCallback(async () => {
    const text = buildCopyText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [buildCopyText]);

  if (!error) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={clearError}
      />

      {/* 모달 */}
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-red-200 dark:border-red-800 w-full max-w-[560px] mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
              오류가 발생했습니다
            </h3>
            <p className="text-xs text-red-500 dark:text-red-400/70 mt-0.5">
              아래 내용을 복사하여 담당자에게 전달해주세요
            </p>
          </div>
          <button
            onClick={clearError}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          >
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>

        {/* 에러 상세 */}
        <div className="px-5 py-4 space-y-3 max-h-[400px] overflow-y-auto">
          <InfoRow label="시간" value={error.timestamp} />
          <InfoRow
            label="요청"
            value={`${error.method} ${error.url}`}
            mono
          />
          <InfoRow
            label="상태코드"
            value={
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                {error.status}
              </span>
            }
          />
          <InfoRow label="에러 메시지" value={error.message} highlight />
          {error.requestBody && (
            <DetailBlock label="요청 데이터" content={error.requestBody} />
          )}
          <DetailBlock label="서버 응답 전문" content={error.responseBody} />
        </div>

        {/* 푸터 - 복사 + 닫기 */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-surface/50">
          <button
            onClick={clearError}
            className="px-4 py-2 text-sm rounded-lg border border-border text-text-muted hover:bg-surface transition-colors"
          >
            닫기
          </button>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copied
                ? "bg-green-600 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> 복사 완료
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> 에러 정보 복사
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 한 줄 정보 표시 */
function InfoRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-20 flex-shrink-0 text-text-muted font-medium">
        {label}
      </span>
      <span
        className={`flex-1 min-w-0 break-all ${
          mono ? "font-mono text-xs" : ""
        } ${highlight ? "text-red-600 dark:text-red-400 font-semibold" : "text-text"}`}
      >
        {value}
      </span>
    </div>
  );
}

/** 접이식 상세 블록 */
function DetailBlock({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  return (
    <div>
      <p className="text-xs text-text-muted font-medium mb-1">{label}</p>
      <pre className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-text rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-[140px] overflow-y-auto border border-border">
        {content}
      </pre>
    </div>
  );
}
