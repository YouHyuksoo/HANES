"use client";

/**
 * @file production/subprocess-kitting/page.tsx
 * @description 실적입력(서브공정) — 2영역 스캔 키팅 (A안 배치).
 *   키오스크 공정에서 부착되어 온 이전 공정 SFG 라벨을 스캔해 회로별 새 SFG(반제품 서브)를 만든다.
 *   input-assembly의 거울상(완제품 FG가 아니라 한 단계 아래 반제품 SFG를 만든다).
 *   흐름: 작업지시·공정·설비·회로 선택 → (좌)설비 자재 장착 + (우)이전 공정 SFG 스캔
 *        → "키팅 실행"으로 새 SFG 발행+자동출력 → 실물 새 SFG 스캔으로 확정.
 *
 * 상태·게이트·저장 로직은 hooks/useSubprocessKittingController.ts 에 있다(같은 로직을 쓰는
 * 배치 시안 subprocess-kitting-b 와 공유). 이 파일은 배치를 그리는 역할만 한다.
 */
import { useTranslation } from "react-i18next";
import { Package, RefreshCw } from "lucide-react";
import AssemblyResultRow from "../input-kiosk/components/AssemblyResultRow";
import { Button, Card, CardContent, Select } from "@/components/ui";
import JobOrderSelectModal, { type JobOrder } from "@/components/production/JobOrderSelectModal";
import JobOrderSelectTrigger from "@/components/production/JobOrderSelectTrigger";
import EquipSelectTrigger from "@/components/production/EquipSelectTrigger";
import { OutputCarrierSlot } from "@/components/shared/carrier";
import InputSgScanPanel from "./components/InputSgScanPanel";
import SubKitActionBar from "./components/SubKitActionBar";
import EquipMaterialMountPanel from "../input-assembly/components/EquipMaterialMountPanel";
import SgLabelPrintHost from "../input-kiosk/components/SgLabelPrintHost";
import WorkInstructionView from "../input-kiosk/components/WorkInstructionView";
import EquipSelectModal from "../input-kiosk/components/EquipSelectModal";
import WorkerSelectModal from "@/components/worker/WorkerSelectModal";
import DailyInspectModal from "../input-kiosk/components/DailyInspectModal";
import WorkerInspectModal from "../input-kiosk/components/WorkerInspectModal";
import { HeaderCheckItem } from "@/components/inspect";
import {
  getOrderKindMeta,
  toJobOrderPick,
  useSubprocessKittingController,
} from "./hooks/useSubprocessKittingController";

export default function SubprocessKittingPage() {
  const { t } = useTranslation();
  const c = useSubprocessKittingController();
  const {
    selectedOrder, selectedWorkers, removeWorker,
    processCode, processName, equipCode, equipName, equips,
    circuitNo, setCircuitNo, circuits, circuitOptions,
    equipModalOpen, setEquipModalOpen, workerModalOpen, setWorkerModalOpen,
    dailyInspectOpen, setDailyInspectOpen, workerInspectOpen, setWorkerInspectOpen,
    orderSearchOpen, setOrderSearchOpen,
    interlock, dailyInspectRequired, workerInspectRequired,
    dailyInspectResult, workerInspectResult, inspectDoneDetail, inspectNgDetail, refreshInspectStatus,
    requirements, sgList, addSg, removeSg, issuedSg,
    resultQuality, setResultQuality, productivityRevision,
    carrierFlags, outputCarrier,
    selectOrder, resetAll, handleEquipSelect, handleWorkerSelect,
    canIssue, issuing, onIssue, confirming, onConfirmScan, onResetIssued,
    sgPrinterRef,
  } = c;

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 gap-3 animate-fade-in bg-background">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />
            {t("production.kitting.title", "실적입력(서브공정)")}
          </h1>
          <p className="text-text-muted mt-1">
            {t(
              "production.subprocess.scanDescription",
              "이전 공정 SFG 라벨을 스캔하여 회로별 반제품 서브를 만듭니다.",
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={resetAll}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          {t("common.reset")}
        </Button>
      </div>

      {/* 상단 고정 바: 설비(=공정) + 작업지시 + 회로 */}
      <Card padding="none" className="min-w-0 flex-shrink-0 overflow-x-auto">
        <CardContent className="!p-0">
          <div className="flex h-14 min-w-[980px] flex-nowrap items-center gap-3 whitespace-nowrap bg-surface/50 px-4">
            {/* 1) 설비 — 가장 먼저 선택. 설비가 공정을 결정(설비→공정)하고 작업지시 조회조건이 된다. */}
            <div className="w-52 shrink-0">
              {/* 1) 설비 — 가공 키오스크와 같은 공용 트리거(2026-09-19 세 화면 통일). 목록·스캔은 EquipSelectModal이 맡는다. */}
              <EquipSelectTrigger
                equipCode={equipCode}
                equipName={equipName}
                processCode={processCode}
                processName={processName}
                onOpen={() => setEquipModalOpen(true)}
                testId="subkit-equip-open"
                className="w-full"
              />
            </div>

            {/* 2) 작업지시 — 가공 키오스크와 같은 공용 트리거(2026-09-19 세 화면 통일). 조회·스캔은 JobOrderSelectModal이 맡는다. */}
            <div className="w-80 shrink-0">
              <JobOrderSelectTrigger
                orderNo={selectedOrder?.orderNo}
                itemName={selectedOrder?.itemName ?? selectedOrder?.itemCode}
                processType={selectedOrder ? getOrderKindMeta(selectedOrder.orderKind).label : null}
                hasEquip={!!equipCode}
                onOpen={() => setOrderSearchOpen(true)}
                testId="subkit-joborder-open"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <OutputCarrierSlot state={outputCarrier} />
              <HeaderCheckItem
                label="설비 일상점검"
                done={!dailyInspectRequired || interlock.dailyInspectDone}
                doneDetail={inspectDoneDetail(dailyInspectResult)}
                notDoneDetail={inspectNgDetail(dailyInspectResult)}
                disabled={!dailyInspectRequired || !equipCode}
                disabledReason={!dailyInspectRequired ? '환경설정에서 필수 점검이 아닙니다.' : '설비를 먼저 선택하세요.'}
                onInput={() => setDailyInspectOpen(true)}
                testId="kiosk-daily-inspect-open"
                wide
              />
              <HeaderCheckItem
                label="작업자설비점검"
                done={!workerInspectRequired || interlock.workerInspectDone}
                doneDetail={inspectDoneDetail(workerInspectResult)}
                notDoneDetail={inspectNgDetail(workerInspectResult)}
                disabled={!workerInspectRequired || (dailyInspectRequired && !interlock.dailyInspectDone) || !selectedOrder || selectedWorkers.length === 0}
                disabledReason={!workerInspectRequired ? '환경설정에서 필수 점검이 아닙니다.' : dailyInspectRequired && !interlock.dailyInspectDone ? '설비 일상점검을 먼저 완료하세요.' : !selectedOrder ? '작업지시를 먼저 선택하세요.' : '작업자를 먼저 선택하세요.'}
                onInput={() => setWorkerInspectOpen(true)}
                testId="kiosk-worker-inspect-open"
                wide
              />
            </div>

            {/* 3) 회로 */}
            <div className="w-36 shrink-0">
              <Select
                aria-label={t("production.subprocess.circuit", "회로")}
                className="!h-11 !text-xs"
                options={circuitOptions}
                value={circuitNo}
                onChange={setCircuitNo}
                disabled={circuits.length === 0}
                fullWidth
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <AssemblyResultRow orderNo={selectedOrder?.orderNo} planQty={selectedOrder?.planQty}
        workers={selectedWorkers} hasEquip={Boolean(equipCode)}
        onSelectWorkers={() => setWorkerModalOpen(true)} onRemoveWorker={(id) => void removeWorker(id)}
        refreshKey={productivityRevision} responsive />

      {/* 본문 3영역 — input-kiosk 스타일: 좌(설비 자재 장착) | 중앙(작업지도서) | 우(이전 공정 SFG 스캔).
          좌·우는 고정폭으로 축소하고 중앙 작업지도서를 넓게 둔다. */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_340px] gap-3 flex-1 min-h-0">
        <EquipMaterialMountPanel
          equipCode={equipCode}
          orderNo={selectedOrder?.orderNo}
          itemCode={selectedOrder?.itemCode}
          expectedItemTypes={["RAW_MATERIAL"]}
          autoFocusKey={selectedOrder?.orderNo}
        />
        {/* 중앙: 작업지도서 — 선택된 작업지시 품목 + 공정 기준 조회 */}
        <div className="flex flex-col h-full min-h-0 overflow-hidden rounded border border-border bg-card">
          <WorkInstructionView
            itemCode={selectedOrder?.itemCode}
            processCode={processCode || undefined}
          />
        </div>
        <InputSgScanPanel
          orderNo={selectedOrder?.orderNo}
          sgList={sgList}
          components={requirements?.components ?? []}
          onAdd={addSg}
          onRemove={removeSg}
          equipCode={equipCode}
          carrierAutoInputYn={carrierFlags?.carrierAutoInputYn === "Y"}
        />
      </div>

      {/* 하단 액션 바 */}
      <div className="flex-shrink-0">
        <SubKitActionBar
          canIssue={canIssue}
          issuing={issuing}
          issuedSg={issuedSg}
          onIssue={onIssue}
          confirming={confirming}
          onConfirmScan={onConfirmScan}
          onResetIssued={onResetIssued}
          resultQuality={resultQuality}
          onResultQualityChange={setResultQuality}
        />
      </div>

      {/* 작업지시 선택 모달 — 공용 모달. 선택 공정 + SEMI_PRODUCT 조회조건. */}
      <JobOrderSelectModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onConfirm={(jo) => {
          selectOrder(toJobOrderPick(jo));
          setOrderSearchOpen(false);
        }}
        filterStatus={['WAITING', 'RUNNING']}
        equipCode={equipCode || undefined}
        processCode={processCode || undefined}
        itemType="SEMI_PRODUCT"
        includeItemOrdersForProcess
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

      {/* SFG(반제품) 라벨 자동 출력 호스트 — 키오스크와 동일, 오프스크린 렌더 후 Print Agent 전송 */}
      <SgLabelPrintHost ref={sgPrinterRef} />
    </div>
  );
}
