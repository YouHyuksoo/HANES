"use client";

import type { Worker } from "@/components/worker/WorkerSelector";
import KioskProductivity from "./KioskProductivity";
import WorkerSlot from "./WorkerSlot";

/**
 * 서브조립·조립 화면의 작업자 + 생산실적 행. 가공 키오스크 헤더 Row2와 같은 WorkerSlot을 쓴다.
 * Column tracks must match each screen's material / instruction / scan panels.
 */
export default function AssemblyResultRow({ orderNo, planQty, workers, hasEquip, locked = false, onSelectWorkers, onRemoveWorker, refreshKey, responsive = false }: {
  orderNo?: string; planQty?: number; workers: Worker[]; hasEquip: boolean; locked?: boolean;
  onSelectWorkers: () => void; onRemoveWorker: (workerId: string) => void; refreshKey: number; responsive?: boolean;
}) {
  return <div data-testid="kiosk-result-row" className={`grid shrink-0 items-center bg-surface py-3 border-t border-border ${responsive
    ? 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_340px] gap-3'
    : 'grid-cols-[300px_minmax(0,1fr)_340px] gap-px'}`}>
    <div className="min-w-0 px-4">
      <WorkerSlot workers={workers} hasEquip={hasEquip} locked={locked} onOpenWorker={onSelectWorkers} onRemoveWorker={onRemoveWorker} />
    </div>
    <KioskProductivity orderNo={orderNo} workers={workers.length} refreshKey={refreshKey} showTotal planQty={planQty} />
  </div>;
}
