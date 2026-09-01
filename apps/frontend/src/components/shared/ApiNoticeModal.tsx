"use client";

/**
 * @file src/components/shared/ApiNoticeModal.tsx
 * @description 업무 안내 창 - 입력 확인/권한/중복 등 사용자가 조치할 수 있는 응답을 표시
 *
 * 초보자 가이드:
 * 1. 시스템 오류 창(ErrorDetailModal)과 톤·색·정보량을 의도적으로 다르게 만든 창이다.
 * 2. URL/상태코드/응답 전문/복사 버튼을 두지 않는다. 사용자가 "장애"로 오해하는 원인이므로.
 * 3. 원인 추적이 필요할 때만 "상세 보기"를 펼쳐 개발자용 정보를 확인한다.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, X } from "lucide-react";
import type { ApiErrorDetail } from "@/stores/errorStore";
import { getNoticeHintKey, getNoticeTitleKey } from "@/services/api-error-severity";

interface ApiNoticeModalProps {
  notice: ApiErrorDetail;
  onClose: () => void;
}

export default function ApiNoticeModal({ notice, onClose }: ApiNoticeModalProps) {
  const { t } = useTranslation();
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* 배경 오버레이 - 시스템 오류 창보다 옅게 (경고 강도 차이) */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* 모달 - 파스텔 배경 없이 테두리/텍스트 색으로만 구분 */}
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-amber-400 dark:border-amber-600 w-full max-w-[520px] mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t(getNoticeTitleKey(notice.status))}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t(getNoticeHintKey(notice.status))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("apiNotice.close")}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* 본문 - 서버 메시지 그대로. class-validator 다중 메시지는 개행 유지 */}
        <div className="px-5 py-5">
          <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line break-words leading-relaxed">
            {notice.message}
          </p>

          {showDetail && (
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1">
              <p className="text-[11px] text-slate-400 font-mono break-all">
                {notice.method} {notice.url} · {notice.status}
                {notice.errorCode ? ` · ${notice.errorCode}` : ""}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">{notice.timestamp}</p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {showDetail ? t("apiNotice.hideDetail") : t("apiNotice.showDetail")}
          </button>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
          >
            {t("apiNotice.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
