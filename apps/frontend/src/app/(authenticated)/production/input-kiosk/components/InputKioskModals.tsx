"use client";

/**
 * @file components/InputKioskModals.tsx
 * @description 실적입력(가공) 키오스크 모달 묶음 — 두 배치(input-kiosk, input-kiosk-b)가 같은 모달을 쓴다
 *
 * 초보자 가이드:
 * - 모달 열림 상태와 핸들러는 useInputKioskController 가 갖고, 여기서는 그리기만 한다.
 * - SFG 라벨 자동 출력 호스트(SgLabelPrintHost)도 화면에 안 보이는 요소라 여기에 함께 둔다.
 */
import WorkerSelectModal from '@/components/worker/WorkerSelectModal';
import JobOrderSelectModal from '@/components/production/JobOrderSelectModal';
import KioskPrepGuideModal from './KioskPrepGuideModal';
import DailyInspectModal from './DailyInspectModal';
import WorkerInspectModal from './WorkerInspectModal';
import MaterialScanModal from './MaterialScanModal';
import ConsumableScanModal from './ConsumableScanModal';
import DefectInputModal from './DefectInputModal';
import SelfInspectModal from './SelfInspectModal';
import SgLabelPrintHost from './SgLabelPrintHost';
import EquipStopModal from './EquipStopModal';
import ManagerCallModal from './ManagerCallModal';
import type { InputKioskController } from '../hooks/useInputKioskController';

export default function InputKioskModals({ c }: { c: InputKioskController }) {
  const { guide, equipStop, selectedEquip, sgPrinterRef } = c;
  return (
    <>
      <KioskPrepGuideModal
        open={guide.open}
        steps={guide.steps}
        current={guide.current}
        doneCount={guide.doneCount}
        allReady={guide.allReady}
        onClose={guide.closeGuide}
        workerNames={c.workerNames}
        onOpenEquipSelect={() => c.setIsEquipSelectOpen(true)}
        onOpenJobOrder={() => c.setIsJobOrderOpen(true)}
        onOpenWorker={() => c.setIsWorkerOpen(true)}
        onOpenDailyInspect={() => c.setIsDailyInspectOpen(true)}
        onOpenWorkerInspect={() => c.setIsWorkerInspectOpen(true)}
        onOpenMaterialScan={() => c.setIsMaterialScanOpen(true)}
        onOpenConsumableScan={() => c.setIsConsumableScanOpen(true)}
        onFocusCarrier={() => { guide.closeGuide(); setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="carrier-slot-scan"]')?.focus(), 0); }}
      />
      <JobOrderSelectModal
        isOpen={c.isJobOrderOpen}
        onClose={() => c.setIsJobOrderOpen(false)}
        onConfirm={c.handleJobOrderConfirm}
        filterStatus={['WAITING', 'RUNNING']}
        equipCode={selectedEquip?.equipCode}
        orderKind="OPERATION"
      />
      <WorkerSelectModal
        isOpen={c.isWorkerOpen}
        onClose={() => c.setIsWorkerOpen(false)}
        onConfirm={(worker) => { c.setIsWorkerOpen(false); void c.handleWorkerConfirm(worker); }}
      />
      <DailyInspectModal
        isOpen={c.isDailyInspectOpen}
        onClose={() => c.setIsDailyInspectOpen(false)}
        onDone={() => { c.setIsDailyInspectOpen(false); void c.refreshDailyInspect(); }}
      />
      <WorkerInspectModal
        isOpen={c.isWorkerInspectOpen}
        onClose={() => c.setIsWorkerInspectOpen(false)}
        onDone={() => { c.setIsWorkerInspectOpen(false); void c.refreshWorkerInspect(); }}
      />
      <MaterialScanModal
        isOpen={c.isMaterialScanOpen}
        onClose={() => c.setIsMaterialScanOpen(false)}
        onDone={() => c.setIsMaterialScanOpen(false)}
        equipCode={selectedEquip?.equipCode ?? null}
        carrierAutoInputYn={c.carrierFlags?.carrierAutoInputYn === "Y"}
      />
      <ConsumableScanModal
        isOpen={c.isConsumableScanOpen}
        onClose={() => c.setIsConsumableScanOpen(false)}
        onDone={() => c.setIsConsumableScanOpen(false)}
      />
      <DefectInputModal
        isOpen={c.isDefectOpen}
        onClose={() => c.setIsDefectOpen(false)}
      />
      <EquipStopModal
        isOpen={c.isEquipStopOpen}
        onClose={() => c.setIsEquipStopOpen(false)}
        equipCode={selectedEquip?.equipCode}
        equipName={selectedEquip?.equipName}
        openStop={equipStop.openStop}
        stopElapsed={equipStop.stopElapsed}
        history={equipStop.history}
        summary={equipStop.summary}
        loading={equipStop.loading}
        onStart={equipStop.startStop}
        onUpdateReason={equipStop.updateReason}
        onRelease={equipStop.releaseStop}
        onRefreshHistory={() => void equipStop.refreshHistory()}
      />
      <ManagerCallModal
        isOpen={c.isManagerCallOpen}
        onClose={() => c.setIsManagerCallOpen(false)}
        equipCode={selectedEquip?.equipCode}
        equipName={selectedEquip?.equipName}
        openCall={equipStop.openCall}
        callElapsed={equipStop.callElapsed}
        loading={equipStop.loading}
        onCall={equipStop.createCall}
      />
      {c.selfInspectTiming && (
        <SelfInspectModal
          isOpen={!!c.selfInspectTiming}
          timing={c.selfInspectTiming}
          onClose={() => c.setSelfInspectTiming(null)}
          onDone={c.handleSelfInspectDone}
        />
      )}

      {/* SFG(반제품) 라벨 자동 출력 호스트 — 오프스크린 렌더 후 Print Agent 전송 */}
      <SgLabelPrintHost ref={sgPrinterRef} />
    </>
  );
}
