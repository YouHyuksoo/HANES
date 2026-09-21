"use client";

/**
 * @file src/app/(authenticated)/production/subprocess-kitting-b/page.tsx
 * @description 실적입력(서브공정) 키팅 B 배치 시안 — 작업 순서 스테퍼형 (2026-09-21 시안 B 채택 검토용)
 *
 * 초보자 가이드:
 * 화면 구성:
 *   ① 상단 컨텍스트 띠(어두운 슬레이트): 설비 · 작업지시 · 회로 · 작업자 · 대차 · 초기화
 *   ② 좌측: 작업지도서(가장 넓게) / 아래 참조 영역 좌우 분할(설비 자재 장착 | 이전 공정 SFG 스캔)
 *   ③ 우측: 작업 순서 스테퍼(설비 점검 → 자재 장착 → 이전 공정 SFG → 키팅 실행·확정)
 *   ④ 하단: 지표 띠(CT·UPH·UPPH·계획·투입 SFG, 한 양식)
 *
 * 상태·게이트·모달 로직은 기존 화면과 같은 useSubprocessKittingController 를 쓴다. 이 파일은 배치만 다르다.
 * 기존 /production/subprocess-kitting 은 그대로 두었다. 채택되면 그쪽 배치를 이 구성으로 바꾸고 이 라우트는 정리한다.
 */
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import WorkInstructionView from '../input-kiosk/components/WorkInstructionView';
import SgLabelPrintHost from '../input-kiosk/components/SgLabelPrintHost';
import DailyInspectModal from '../input-kiosk/components/DailyInspectModal';
import WorkerInspectModal from '../input-kiosk/components/WorkerInspectModal';
import EquipActionButtons from '../input-kiosk/components/EquipActionButtons';
import EquipStopModal from '../input-kiosk/components/EquipStopModal';
import ManagerCallModal from '../input-kiosk/components/ManagerCallModal';
import { formatElapsed } from '../input-kiosk/hooks/useEquipStop';
import KittingPrepGuideModal from '../subprocess-kitting/components/KittingPrepGuideModal';
import WorkerSelectModal from '@/components/worker/WorkerSelectModal';
import JobOrderSelectModal, { type JobOrder } from '@/components/production/JobOrderSelectModal';
import {
  toJobOrderPick,
  useSubprocessKittingController,
} from '../subprocess-kitting/hooks/useSubprocessKittingController';
import KitContextBar from './components/KitContextBar';
import KitReferencePanels from './components/KitReferencePanels';
import KitWorkStepper from './components/KitWorkStepper';
import KitMetricsStrip from './components/KitMetricsStrip';

export default function SubprocessKittingBPage() {
  const { t } = useTranslation();
  const c = useSubprocessKittingController();
  const {
    selectedOrder, selectedWorkers, processCode, sgList, productivityRevision,
    orderSearchOpen, setOrderSearchOpen, workerModalOpen, setWorkerModalOpen,
    dailyInspectOpen, setDailyInspectOpen, workerInspectOpen, setWorkerInspectOpen,
    equipCode, equipName, refreshInspectStatus, selectOrder, handleWorkerSelect, sgPrinterRef,
    equipStop, isEquipStopOpen, setIsEquipStopOpen, isManagerCallOpen, setIsManagerCallOpen, guide,
  } = c;

  return (
    <div data-testid="subkit-b-page" className="flex h-full flex-col overflow-hidden bg-background">
      {/* ① 컨텍스트 띠 */}
      <KitContextBar c={c} />

      {/* ② ③ 본문 2열 */}
      <div className="flex min-h-0 flex-1 gap-3 bg-surface p-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {/* 작업지도서 상자 — 참조 상자·스테퍼 상자와 같은 규칙: 굵은 테두리 + 어두운 제목 띠 */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-slate-300 bg-card dark:border-slate-600">
            <div className="flex h-9 shrink-0 items-center gap-2 bg-slate-800 px-3 text-xs font-bold text-white dark:bg-slate-700">
              <BookOpen className="h-3.5 w-3.5 text-slate-300" />
              {t('kiosk.instruction.title', '작업지도서')}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <WorkInstructionView
                itemCode={selectedOrder?.itemCode}
                processCode={processCode || undefined}
              />
            </div>
          </div>
          <KitReferencePanels c={c} />
        </div>
        <div className="w-[440px] shrink-0">
          <KitWorkStepper c={c} />
        </div>
      </div>

      {/* ④ 하단 — 지표 띠(한 양식) + 비상 액션 */}
      <div className="flex h-16 shrink-0 items-stretch border-t border-border bg-card">
        <div className="flex min-w-0 flex-1 items-stretch px-2">
          <KitMetricsStrip
            orderNo={selectedOrder?.orderNo}
            planQty={selectedOrder?.planQty}
            workers={selectedWorkers.length}
            refreshKey={productivityRevision}
            scannedSg={sgList.length}
          />
        </div>
        <div className="w-[464px] shrink-0">
          <EquipActionButtons
            hasEquip={!!equipCode}
            onOpenEquipStop={() => setIsEquipStopOpen(true)}
            onOpenManagerCall={() => setIsManagerCallOpen(true)}
            isStopped={equipStop.isStopped}
            stopElapsed={equipStop.stopElapsed}
            isCalling={equipStop.isCalling}
            callElapsed={equipStop.callElapsed}
          />
        </div>
      </div>

      {/* 설비정지 배너 — 정지 중에는 발행/확정이 막힌다. 눌러서 해제한다(가공 키오스크와 동일). */}
      {equipStop.isStopped && (
        <button
          type="button"
          onClick={() => setIsEquipStopOpen(true)}
          data-testid="subkit-b-stop-banner"
          className="flex w-full items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-bold text-white"
        >
          <span className="animate-pulse">●</span>
          {t('kiosk.equipStop.banner', '설비 정지 중 — 실적 입력이 차단됩니다. 눌러서 해제하세요.')}
          <span className="font-mono tabular-nums">{formatElapsed(equipStop.stopElapsed)}</span>
        </button>
      )}

      {/* 모달 — 설비 선택은 컨텍스트 띠가 직접 연다. 나머지는 A안과 같은 공용 모달. */}
      <JobOrderSelectModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onConfirm={(jo: JobOrder) => {
          selectOrder(toJobOrderPick(jo));
          setOrderSearchOpen(false);
        }}
        filterStatus={['WAITING', 'RUNNING']}
        equipCode={equipCode || undefined}
        processCode={processCode || undefined}
        itemType="SEMI_PRODUCT"
        includeItemOrdersForProcess
      />
      <WorkerSelectModal
        isOpen={workerModalOpen}
        onClose={() => setWorkerModalOpen(false)}
        onConfirm={handleWorkerSelect}
      />
      <DailyInspectModal
        isOpen={dailyInspectOpen}
        onClose={() => setDailyInspectOpen(false)}
        onDone={() => { setDailyInspectOpen(false); void refreshInspectStatus(); }}
      />
      <WorkerInspectModal
        isOpen={workerInspectOpen}
        onClose={() => setWorkerInspectOpen(false)}
        onDone={() => { setWorkerInspectOpen(false); void refreshInspectStatus(); }}
      />

      <EquipStopModal
        isOpen={isEquipStopOpen}
        onClose={() => setIsEquipStopOpen(false)}
        equipCode={equipCode || undefined}
        equipName={equipName || undefined}
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
        isOpen={isManagerCallOpen}
        onClose={() => setIsManagerCallOpen(false)}
        equipCode={equipCode || undefined}
        equipName={equipName || undefined}
        openCall={equipStop.openCall}
        callElapsed={equipStop.callElapsed}
        loading={equipStop.loading}
        onCall={equipStop.createCall}
      />

      <KittingPrepGuideModal
        open={guide.open}
        steps={guide.steps}
        current={guide.current}
        doneCount={guide.doneCount}
        allReady={guide.allReady}
        onClose={guide.closeGuide}
        workerNames={selectedWorkers.map((w) => w.workerName)}
        onOpenEquipSelect={() => c.setEquipModalOpen(true)}
        onOpenJobOrder={() => setOrderSearchOpen(true)}
        onOpenWorker={() => setWorkerModalOpen(true)}
        onOpenDailyInspect={() => setDailyInspectOpen(true)}
        onOpenWorkerInspect={() => setWorkerInspectOpen(true)}
        onFocusCircuit={() => { guide.closeGuide(); setTimeout(() => document.querySelector<HTMLSelectElement>('[data-testid="subkit-b-circuit"]')?.focus(), 0); }}
        onFocusCarrier={() => { guide.closeGuide(); setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="carrier-slot-scan"]')?.focus(), 0); }}
      />

      {/* SFG(반제품) 라벨 자동 출력 호스트 — A안과 동일, 오프스크린 렌더 후 Print Agent 전송 */}
      <SgLabelPrintHost ref={sgPrinterRef} />
    </div>
  );
}
