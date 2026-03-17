"use client";

/**
 * @file system/scheduler/components/LogDetailModal.tsx
 * @description 스케줄러 실행 로그 상세 모달 (md 사이즈)
 *
 * 초보자 가이드:
 * 1. FAIL/TIMEOUT 상태 로그의 상세 정보 표시
 * 2. 에러 메시지는 monospace + pre-wrap + 스크롤
 * 3. 상태 배지는 ComCodeBadge 사용
 */
import { useTranslation } from "react-i18next";
import { Modal, ComCodeBadge } from "@/components/ui";

interface SchedulerLog {
  logId: number;
  jobCode: string;
  jobName?: string;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  status: string;
  affectedRows: number | null;
  retryCount: number;
  resultMsg: string | null;
  errorMsg: string | null;
}

interface Props {
  log: SchedulerLog;
  onClose: () => void;
}

export default function LogDetailModal({ log, onClose }: Props) {
  const { t } = useTranslation();

  const fmtDt = (v: string | null) => v ? v.replace("T", " ").slice(0, 19) : "-";
  const fmtDuration = (ms: number | null) => {
    if (ms == null) return "-";
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  };

  return (
    <Modal isOpen onClose={onClose} size="md" title={`Log #${log.logId}`}>
      <div className="space-y-4 text-xs">
        {/* 작업 정보 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-text-muted">{t("scheduler.jobCode")}</span>
            <p className="font-medium text-text">{log.jobCode}</p>
          </div>
          {log.jobName && (
            <div>
              <span className="text-text-muted">{t("scheduler.jobName")}</span>
              <p className="font-medium text-text">{log.jobName}</p>
            </div>
          )}
        </div>

        {/* 상태 */}
        <div>
          <span className="text-text-muted">{t("common.status")}</span>
          <div className="mt-1">
            <ComCodeBadge groupCode="SCHED_STATUS" code={log.status} />
          </div>
        </div>

        {/* 시간 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <span className="text-text-muted">{t("scheduler.startTime")}</span>
            <p className="text-text">{fmtDt(log.startTime)}</p>
          </div>
          <div>
            <span className="text-text-muted">{t("scheduler.endTime")}</span>
            <p className="text-text">{fmtDt(log.endTime)}</p>
          </div>
          <div>
            <span className="text-text-muted">{t("scheduler.duration")}</span>
            <p className="text-text font-mono">{fmtDuration(log.durationMs)}</p>
          </div>
        </div>

        {/* 결과 메시지 */}
        {log.resultMsg && (
          <div>
            <span className="text-text-muted">{t("scheduler.resultMsg")}</span>
            <p className="mt-1 text-text bg-surface rounded p-2">{log.resultMsg}</p>
          </div>
        )}

        {/* 에러 메시지 */}
        {log.errorMsg && (
          <div>
            <span className="text-text-muted">{t("scheduler.errorMsg")}</span>
            <pre className="mt-1 max-h-48 overflow-y-auto text-[11px] font-mono whitespace-pre-wrap break-all bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded p-3">
              {log.errorMsg}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}
