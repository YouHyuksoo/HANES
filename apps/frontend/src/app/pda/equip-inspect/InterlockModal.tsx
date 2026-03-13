"use client";

/**
 * @file src/app/pda/equip-inspect/InterlockModal.tsx
 * @description 설비 인터락 안내 모달 — FAIL 결과 제출 성공 시 표시
 *
 * 초보자 가이드:
 * - FAIL 점검 결과가 포함된 채로 제출이 성공하면 이 모달이 뜹니다.
 * - 사용자가 "확인"을 누르면 onConfirm 콜백이 호출되고 모달이 닫힙니다.
 * - 배경 클릭으로는 닫히지 않습니다 (의도적 확인 유도).
 */
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";

interface InterlockModalProps {
  /** 확인 버튼 클릭 시 호출 (상태 리셋 처리) */
  onConfirm: () => void;
}

/**
 * 인터락 안내 모달
 *
 * @example
 * {showInterlockModal && <InterlockModal onConfirm={onInterlockConfirm} />}
 */
export default function InterlockModal({ onConfirm }: InterlockModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 space-y-4 shadow-2xl">
        {/* 아이콘 */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-red-500 dark:text-red-400" />
          </div>
        </div>

        {/* 메시지 */}
        <div className="text-center space-y-1">
          <p className="text-base font-bold text-slate-900 dark:text-white">
            {t("pda.equipInspect.inspectSuccess")}
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed">
            {t("pda.equipInspect.interlock")}
          </p>
        </div>

        {/* 확인 버튼 */}
        <button
          type="button"
          onClick={onConfirm}
          className="w-full h-12 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold text-base transition-all"
        >
          {t("common.confirm")}
        </button>
      </div>
    </div>
  );
}
