"use client";

import { UserRound } from "lucide-react";
import { Button } from "@/components/ui";
import KioskProductivity from "./KioskProductivity";

/** Column tracks must match each screen's material / instruction / scan panels. */
export default function AssemblyResultRow({ orderNo, planQty, workerNames, disabled, onSelectWorkers, refreshKey, responsive = false }: {
  orderNo?: string; planQty?: number; workerNames: string[]; disabled: boolean;
  onSelectWorkers: () => void; refreshKey: number; responsive?: boolean;
}) {
  return <div data-testid="kiosk-result-row" className={`grid shrink-0 items-center bg-surface py-3 border-t border-border ${responsive
    ? 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_340px] gap-3'
    : 'grid-cols-[300px_minmax(0,1fr)_340px] gap-px'}`}>
    <div className="min-w-0 px-4" data-testid="kiosk-worker-region">
      <div className="flex min-h-11 min-w-0 items-center rounded-lg border border-border bg-card px-3">
        <Button data-testid="kiosk-worker-open" className="!h-7 min-w-0 max-w-full !rounded !px-2.5 !text-xs [&>span]:truncate" size="sm" onClick={onSelectWorkers} disabled={disabled} leftIcon={<UserRound className="h-4 w-4 shrink-0" />}>
          <span className="truncate" title={workerNames.join(', ')}>{workerNames.length ? `${workerNames[0]}${workerNames.length > 1 ? ` 외 ${workerNames.length - 1}` : ''}` : '작업자 선택'}</span>
        </Button>
      </div>
    </div>
    <KioskProductivity orderNo={orderNo} workers={workerNames.length} refreshKey={refreshKey} showTotal planQty={planQty} />
  </div>;
}
