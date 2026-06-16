"use client";

/**
 * @file src/app/(authenticated)/equipment/status/components/EquipStatusCard.tsx
 * @description 설비 가동현황 카드 — 모니터링 그리드 한 셀을 채우는 설비 상태 카드
 *
 * 초보자 가이드:
 * - 한 카드 = 한 설비. 셀 높이가 작아도 글자가 잘리지 않도록 모든 영역을 flex 비율로 배분하고
 *   텍스트는 truncate 한다(가로/세로 모두 overflow 안전).
 * - 상단: 설비코드 + 상태배지 / 설비명 / TYPE·공정 / 하단: 작업중 모델 + 계획·실적 진행바(없으면 대기)
 */
import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";

export interface EquipCard {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: string | null;
  lineCode: string | null;
  processCode: string | null;
  processName: string | null;
  status: string;
  ipAddress: string | null;
  modelName: string | null;
  maker: string | null;
  currentJobOrderId: string | null;
}

/** 해당 설비에서 현재 작업(RUNNING) 중인 작업지시 요약 */
export interface RunningJob {
  orderNo: string;
  itemName: string | null;
  planQty: number;
  goodQty: number;
  defectQty: number;
}

const statusStyle: Record<string, { pill: string; dot: string; pulse: boolean; bar: string }> = {
  NORMAL: { pill: "bg-sky-600 text-white dark:bg-sky-500", dot: "bg-white", pulse: true, bar: "bg-sky-500" },
  MAINT: { pill: "bg-amber-500 text-white", dot: "bg-white", pulse: false, bar: "bg-amber-500" },
  STOP: { pill: "bg-rose-600 text-white dark:bg-rose-500", dot: "bg-white", pulse: false, bar: "bg-rose-500" },
  INTERLOCK: { pill: "bg-gray-700 text-white dark:bg-gray-600", dot: "bg-red-400", pulse: true, bar: "bg-gray-500" },
};
const defaultStyle = statusStyle.NORMAL;

export default function EquipStatusCard({ equip, job }: { equip: EquipCard; job?: RunningJob | null }) {
  const { t } = useTranslation();
  const s = statusStyle[equip.status] || defaultStyle;
  const statusLabel = t(`comCode.EQUIP_STATUS.${equip.status}`, { defaultValue: equip.status });
  const typeLabel = equip.equipType
    ? t(`comCode.EQUIP_TYPE.${equip.equipType}`, { defaultValue: equip.equipType })
    : "—";
  const processLabel = equip.processName || equip.processCode || "—";
  const rate = job && job.planQty > 0 ? Math.round((job.goodQty / job.planQty) * 100) : 0;

  return (
    <div className="group h-full w-full flex flex-col overflow-hidden rounded-lg border
      bg-white border-slate-200/80 hover:shadow-md
      dark:bg-slate-900 dark:border-slate-700/40 dark:hover:border-slate-600/60 transition-shadow">
      {/* 상단: 좌측 색상바 + 본문 */}
      <div className="flex-1 min-h-0 flex">
        <div className={`w-1 shrink-0 ${s.bar}`} />
        <div className="flex-1 min-w-0 flex flex-col gap-1 px-2.5 py-2">
          {/* 코드 + 상태배지 */}
          <div className="flex items-center justify-between gap-1.5">
            <h3 className="text-sm font-bold tracking-tight truncate text-slate-900 dark:text-white">
              {equip.equipCode}
            </h3>
            <span className={`inline-flex items-center gap-1 px-1.5 py-px shrink-0 rounded text-[10px] font-semibold ${s.pill}`}>
              <span className="relative flex h-1.5 w-1.5">
                {s.pulse && <span className={`animate-ping absolute h-full w-full rounded-full ${s.dot} opacity-60`} />}
                <span className={`relative rounded-full h-1.5 w-1.5 ${s.dot}`} />
              </span>
              {statusLabel}
            </span>
          </div>

          {/* 설비명 */}
          <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400 truncate" title={equip.equipName}>
            {equip.equipName}
          </p>

          {/* TYPE / 공정 */}
          <div className="grid grid-cols-2 gap-1">
            <div className="rounded bg-slate-50 dark:bg-slate-800/60 px-1.5 py-1 min-w-0">
              <span className="block text-[8px] uppercase tracking-wider leading-none text-slate-400 dark:text-slate-500">TYPE</span>
              <span className="block text-[11px] font-medium leading-tight truncate text-slate-700 dark:text-slate-200">{typeLabel}</span>
            </div>
            <div className="rounded bg-slate-50 dark:bg-slate-800/60 px-1.5 py-1 min-w-0">
              <span className="block text-[8px] uppercase tracking-wider leading-none text-slate-400 dark:text-slate-500">
                {t("master.equip.process", "공정")}
              </span>
              <span className="block text-[11px] font-medium leading-tight truncate text-slate-700 dark:text-slate-200" title={processLabel}>
                {processLabel}
              </span>
            </div>
          </div>

          {/* 작업 영역 — 모델 + 계획/실적 또는 대기 */}
          <div className="flex-1 min-h-0 min-w-0 mt-0.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex flex-col justify-center gap-1">
            {job ? (
              <>
                <div className="flex items-center gap-1 min-w-0">
                  <Package className="w-3 h-3 shrink-0 text-blue-500 dark:text-blue-400" />
                  <span className="text-[11px] font-semibold leading-tight truncate text-slate-800 dark:text-slate-100"
                    title={job.itemName ?? job.orderNo}>
                    {job.itemName || job.orderNo}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 text-[10px] leading-none">
                  <span className="text-slate-500 dark:text-slate-400 truncate">
                    {t("equipment.status.plan", "계획")} <b className="text-slate-700 dark:text-slate-200 tabular-nums">{job.planQty}</b>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 truncate">
                    {t("equipment.status.actual", "실적")} <b className="text-emerald-600 dark:text-emerald-400 tabular-nums">{job.goodQty}</b>
                  </span>
                  <span className="font-bold text-slate-600 dark:text-slate-300 tabular-nums shrink-0">{rate}%</span>
                </div>
                <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, rate)}%` }} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-300 dark:text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                {t("equipment.status.noJob", "작업 대기")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
