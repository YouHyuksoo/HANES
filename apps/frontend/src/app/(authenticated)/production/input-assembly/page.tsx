"use client";

/**
 * @file production/input-assembly/page.tsx
 * @description 실적입력(조립) — 반제품 SFG 스캔으로 완제품 FG 를 만든다 (A안 배치).
 *
 * 상태·게이트·저장 로직은 hooks/useInputAssemblyController.ts 에 있다(같은 로직을 쓰는
 * 배치 시안 input-assembly-b 와 공유). 이 파일은 배치와 전체화면(view=full) 토글만 담당한다.
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";
import { Maximize2, Minimize2, RefreshCw, Sparkles } from "lucide-react";
import AssemblyResultRow from "../input-kiosk/components/AssemblyResultRow";
import { Button } from "@/components/ui";
import JobOrderSelectModal, { type JobOrder } from "@/components/production/JobOrderSelectModal";
import JobOrderSelectTrigger from "@/components/production/JobOrderSelectTrigger";
import EquipSelectTrigger from "@/components/production/EquipSelectTrigger";
import { OutputCarrierSlot } from "@/components/shared/carrier";
import EquipMaterialMountPanel from "./components/EquipMaterialMountPanel";
import SgScanPanel from "./components/SgScanPanel";
import AssemblyActionBar from "./components/AssemblyActionBar";
import AssemblyPrepGuideModal from "./components/AssemblyPrepGuideModal";
import WorkInstructionView from "../input-kiosk/components/WorkInstructionView";
import EquipSelectModal from "../input-kiosk/components/EquipSelectModal";
import FgLabelPrintHost from "../input-kiosk/components/FgLabelPrintHost";
import WorkerSelectModal from "@/components/worker/WorkerSelectModal";
import DailyInspectModal from "../input-kiosk/components/DailyInspectModal";
import WorkerInspectModal from "../input-kiosk/components/WorkerInspectModal";
import { HeaderCheckItem } from "@/components/inspect";
import EquipActionButtons from "../input-kiosk/components/EquipActionButtons";
import EquipStopModal from "../input-kiosk/components/EquipStopModal";
import ManagerCallModal from "../input-kiosk/components/ManagerCallModal";
import { formatElapsed } from "../input-kiosk/hooks/useEquipStop";
import { toJobOrderPick, useInputAssemblyController } from "./hooks/useInputAssemblyController";

export default function InputAssemblyPage() {
  const { t } = useTranslation();
  const c = useInputAssemblyController();
  const {
    selectedOrder, selectedWorkers, removeWorker, workerNames,
    processCode, processName, equipCode, equipName, equips,
    equipModalOpen, setEquipModalOpen, workerModalOpen, setWorkerModalOpen,
    dailyInspectOpen, setDailyInspectOpen, workerInspectOpen, setWorkerInspectOpen,
    orderSearchOpen, setOrderSearchOpen,
    interlock, dailyInspectRequired, workerInspectRequired,
    dailyInspectResult, workerInspectResult, inspectDoneDetail, inspectNgDetail, refreshInspectStatus,
    requirements, sgList, setSgList, addSg, removeSg, continuous, setContinuous, sgReady,
    issuedFg, productivityRevision, carrierFlags, outputCarrier, guide,
    equipStop, isEquipStopOpen, setIsEquipStopOpen, isManagerCallOpen, setIsManagerCallOpen,
    selectOrder, resetAll, handleEquipSelect, handleWorkerSelect,
    canIssue, issuing, onIssue, confirming, onConfirmScan, onResetIssued,
    contextLocked, issueDisabledReason,
    fgPrinterRef,
  } = c;

  // 전체화면(view=full) — 라우트 경로가 화면마다 달라 훅에 넣지 않는다.
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFullView = searchParams.get("view") === "full";
  const toggleFullView = useCallback(() => {
    if (isFullView) {
      router.push("/production/input-assembly");
      if (document.fullscreenElement) void document.exitFullscreen();
      return;
    }
    router.push("/production/input-assembly?view=full");
    void document.documentElement.requestFullscreen?.();
  }, [isFullView, router]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* 상단 고정 바(input-kiosk EquipHeader 형식): 설비(=공정) + 작업지시 + 작업자/점검 + 초기화/전체화면. 페이지 타이틀은 두지 않는다. */}
      <div className="flex-shrink-0 border-b border-border bg-card overflow-x-auto">
          <div className="flex h-14 min-w-[980px] flex-nowrap items-center gap-3 whitespace-nowrap bg-surface/50 px-3">
            {/* 1) 설비 — 가장 먼저 선택. 설비가 공정을 결정(설비→공정)하고 작업지시 조회조건이 된다. */}
            <div className="w-52 shrink-0">
              {/* 1) 설비 — 가공 키오스크와 같은 공용 트리거(2026-09-19 세 화면 통일). 목록·스캔은 EquipSelectModal이 맡는다. */}
              <EquipSelectTrigger
                equipCode={equipCode}
                equipName={equipName}
                processCode={processCode}
                processName={processName}
                disabled={contextLocked}
                onOpen={() => setEquipModalOpen(true)}
                testId="assembly-equip-open"
                className="w-full"
              />
            </div>

            {/* 2) 작업지시 — 가공 키오스크와 같은 공용 트리거(2026-09-19 세 화면 통일). 조회·스캔은 JobOrderSelectModal이 맡는다. */}
            <div className="w-80 shrink-0">
              <JobOrderSelectTrigger
                orderNo={selectedOrder?.orderNo}
                itemName={selectedOrder?.itemName ?? selectedOrder?.itemCode}
                hasEquip={!!equipCode}
                disabled={contextLocked}
                onOpen={() => setOrderSearchOpen(true)}
                testId="assembly-joborder-open"
              />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <HeaderCheckItem
                label="설비 일상점검"
                done={!dailyInspectRequired || interlock.dailyInspectDone}
                doneDetail={inspectDoneDetail(dailyInspectResult)}
                notDoneDetail={inspectNgDetail(dailyInspectResult)}
                disabled={!dailyInspectRequired || !equipCode || contextLocked}
                disabledReason={!dailyInspectRequired ? '환경설정에서 필수 점검이 아닙니다.' : !equipCode ? '설비를 먼저 선택하세요.' : '처리 중입니다.'}
                onInput={() => setDailyInspectOpen(true)}
                wide
              />
              <HeaderCheckItem
                label="작업자설비점검"
                done={!workerInspectRequired || interlock.workerInspectDone}
                doneDetail={inspectDoneDetail(workerInspectResult)}
                notDoneDetail={inspectNgDetail(workerInspectResult)}
                disabled={!workerInspectRequired || (dailyInspectRequired && !interlock.dailyInspectDone) || !selectedOrder || selectedWorkers.length === 0 || contextLocked}
                disabledReason={!workerInspectRequired ? '환경설정에서 필수 점검이 아닙니다.' : dailyInspectRequired && !interlock.dailyInspectDone ? '설비 일상점검을 먼저 완료하세요.' : !selectedOrder ? '작업지시를 먼저 선택하세요.' : selectedWorkers.length === 0 ? '작업자를 먼저 선택하세요.' : '처리 중입니다.'}
                onInput={() => setWorkerInspectOpen(true)}
                wide
              />
              <OutputCarrierSlot state={outputCarrier} compact />
              <button
                type="button"
                data-testid="assembly-guide-open"
                onClick={guide.openGuide}
                title={t("prepGuide.reopen", "준비 안내")}
                aria-label={t("prepGuide.reopen", "준비 안내")}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-primary transition-colors hover:border-primary 2xl:w-auto 2xl:px-3"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="hidden whitespace-nowrap text-sm font-bold 2xl:inline">{t("prepGuide.reopen", "준비 안내")}</span>
              </button>
              <button
                type="button"
                onClick={resetAll}
                disabled={contextLocked}
                title={t("common.reset")}
                aria-label={t("common.reset")}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleFullView}
                title={isFullView ? t("fab.exitFullscreen", "전체화면 종료") : t("fab.fullscreen", "전체화면 보기")}
                aria-label={isFullView ? t("fab.exitFullscreen", "전체화면 종료") : t("fab.fullscreen", "전체화면 보기")}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary hover:text-primary"
              >
                {isFullView ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
      </div>

      <AssemblyResultRow orderNo={selectedOrder?.orderNo} planQty={selectedOrder?.planQty}
        workers={selectedWorkers} hasEquip={Boolean(equipCode)} locked={contextLocked}
        onSelectWorkers={() => setWorkerModalOpen(true)} onRemoveWorker={(id) => void removeWorker(id)}
        refreshKey={productivityRevision} />

      {/* 본문 3영역 — input-kiosk 스타일: 좌(설비 자재 장착) | 중앙(작업지도서) | 우(반제품 SFG 스캔).
          좌·우는 고정폭, 중앙 작업지도서를 넓게. 각 패널은 내부에서 스크롤하며 바깥으로 넘치지 않는다. */}
      <div className="grid flex-1 min-h-0 overflow-hidden grid-cols-[300px_minmax(0,1fr)_340px] bg-border gap-px">
        <div className="min-w-0 min-h-0 overflow-hidden flex flex-col bg-card">
          <EquipMaterialMountPanel
            equipCode={equipCode}
            orderNo={selectedOrder?.orderNo}
            itemCode={selectedOrder?.itemCode}
            expectedItemTypes={["RAW_MATERIAL"]}
            autoFocusKey={selectedOrder?.orderNo}
          />
        </div>
        {/* 중앙: 작업지도서 — 선택된 작업지시 품목 + 공정 기준 조회 */}
        <div className="min-w-0 min-h-0 overflow-hidden flex flex-col bg-card">
          <WorkInstructionView
            itemCode={selectedOrder?.itemCode}
            processCode={processCode || undefined}
          />
        </div>
        <div className="min-w-0 min-h-0 overflow-hidden flex flex-col bg-surface">
        <SgScanPanel
          key={`${equipCode}:${selectedOrder?.orderNo ?? ""}`}
          orderNo={selectedOrder?.orderNo}
          sgList={sgList}
          components={requirements?.components ?? []}
          onAdd={addSg}
          onRemove={removeSg}
          continuous={continuous}
          onContinuousChange={setContinuous}
          onReset={() => setSgList([])}
          disabled={issuing || confirming}
          ready={sgReady}
          equipCode={equipCode}
          carrierAutoInputYn={carrierFlags?.carrierAutoInputYn === "Y"}
        />
        </div>
      </div>

      {/* 하단 액션 바 */}
      <div className="flex-shrink-0 border-t border-border bg-card px-3 py-2">
        {equipStop.isStopped && (
          <button
            type="button"
            onClick={() => setIsEquipStopOpen(true)}
            data-testid="asm-stop-banner"
            className="mb-2 flex w-full items-center justify-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-bold text-white"
          >
            <span className="animate-pulse">●</span>
            {t("kiosk.equipStop.banner", "설비 정지 중 — 실적 입력이 차단됩니다. 눌러서 해제하세요.")}
            <span className="font-mono tabular-nums">{formatElapsed(equipStop.stopElapsed)}</span>
          </button>
        )}
        <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-1">
        <AssemblyActionBar
          canIssue={canIssue}
          issueDisabledReason={issueDisabledReason}
          issuing={issuing}
          issuedFg={issuedFg}
          onIssue={onIssue}
          confirming={confirming}
          canConfirm={sgReady}
          onConfirmScan={onConfirmScan}
          onResetIssued={onResetIssued}
        />
        </div>
        <div className="flex w-[464px] shrink-0 items-end pb-1">
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
      </div>

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

      <AssemblyPrepGuideModal
        open={guide.open}
        steps={guide.steps}
        current={guide.current}
        doneCount={guide.doneCount}
        allReady={guide.allReady}
        onClose={guide.closeGuide}
        workerNames={workerNames}
        onOpenEquipSelect={() => setEquipModalOpen(true)}
        onOpenJobOrder={() => setOrderSearchOpen(true)}
        onOpenWorker={() => setWorkerModalOpen(true)}
        onOpenDailyInspect={() => setDailyInspectOpen(true)}
        onOpenWorkerInspect={() => setWorkerInspectOpen(true)}
        onFocusCarrier={() => { guide.closeGuide(); setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="carrier-slot-scan"]')?.focus(), 0); }}
      />

      {/* 작업지시 선택 모달 — 공용 모달. 선택 공정 + FINISHED 조회조건. */}
      <JobOrderSelectModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onConfirm={(jo) => {
          selectOrder(toJobOrderPick(jo));
          setOrderSearchOpen(false);
        }}
        processCode={processCode || undefined}
        filterStatus={['WAITING', 'RUNNING']}
        equipCode={equipCode || undefined}
        itemType="FINISHED"
        orderKind="OPERATION"
      />

      {/* 설비 선택 모달 — input-kiosk 공용. 설비 선택 시 공정 자동 도출. */}
      <EquipSelectModal
        isOpen={equipModalOpen}
        onClose={() => setEquipModalOpen(false)}
        equips={equips}
        onSelect={handleEquipSelect}
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

      {/* FG 라벨 자동 출력 호스트(오프스크린). 조립 확정 시 printFg=true면 출력. */}
      <FgLabelPrintHost ref={fgPrinterRef} />
    </div>
  );
}
