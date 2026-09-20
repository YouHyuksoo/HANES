"use client";

/**
 * @file src/app/(authenticated)/production/input-kiosk/page.tsx
 * @description 생산실적 키오스크 화면 (현장 설비 옆 태블릿/PC용)
 *
 * 초보자 가이드:
 * 화면 구성 (PAGE 10 작업실적 화면):
 *   ① 상단 헤더 2단: 설비ID·바코드·설비일일검사 / 작업지시·작업자·생산실적·작업자설비검사
 *   ② 좌측 패널: BOM 자재리스트 + 소모성 설비부품
 *   ③ 중앙 패널: 작업지도서 + 하단 3칸(자주검사 | 불량 | 실적입력)
 *   ④ 우측 패널: 양품조건 + 작업이력
 *
 * 상태·게이트·모달 제어 로직은 hooks/useInputKioskController.ts 에 있다(같은 로직을 쓰는
 * 배치 시안 input-kiosk-b 와 공유). 이 파일은 3열 배치를 그리는 역할만 한다.
 */
import { useTranslation } from 'react-i18next';
import EquipHeader from './components/EquipHeader';
import MaterialListPanel from './components/MaterialListPanel';
import WorkInstructionView from './components/WorkInstructionView';
import RoutingFlowBar from './components/RoutingFlowBar';
import WorkHistoryPanel from './components/WorkHistoryPanel';
import ProductionInputBar from './components/ProductionInputBar';
import SelfInspectPanel from './components/SelfInspectPanel';
import DefectSummaryPanel from './components/DefectSummaryPanel';
import EquipActionButtons from './components/EquipActionButtons';
import InputKioskModals from './components/InputKioskModals';
import { formatElapsed } from './hooks/useEquipStop';
import { useInputKioskController } from './hooks/useInputKioskController';

export default function InputKioskPage() {
  const { t } = useTranslation();
  const c = useInputKioskController();
  const {
    equips, selectedEquip, hasPendingDelegate, equipStop, historyKey,
    dailyInspectAt, workerInspectAt, dailyInspectResult, workerInspectResult,
    isEquipSelectOpen, setIsEquipSelectOpen, guide, outputCarrier,
    materialScanDisabledReasons, consumableScanDisabledReasons,
    firstInspectDone, lastInspectDone, midNotifyPct, midBlockPct,
    allInterlockDone, submitDisabledReasons, isMidBlock, productionType, handleResultSaved,
  } = c;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ① 상단 헤더 (2단) */}
      <EquipHeader
        equips={equips}
        onOpenJobOrder={() => c.setIsJobOrderOpen(true)}
        onOpenWorker={() => c.setIsWorkerOpen(true)}
        onOpenDailyInspect={() => c.setIsDailyInspectOpen(true)}
        onOpenWorkerInspect={() => c.setIsWorkerInspectOpen(true)}
        onSelectEquip={c.restoreEquipmentCurrentState}
        onRemoveWorker={c.handleRemoveWorker}
        dailyInspectAt={dailyInspectAt}
        workerInspectAt={workerInspectAt}
        dailyInspectResult={dailyInspectResult}
        workerInspectResult={workerInspectResult}
        equipSelectOpen={isEquipSelectOpen}
        onEquipSelectOpenChange={setIsEquipSelectOpen}
        onOpenGuide={guide.openGuide}
        outputCarrier={outputCarrier}
      />

      {/* ② ③ ④ 메인 3패널 */}
      <div className="grid flex-1 min-h-0 overflow-hidden grid-cols-[320px_minmax(0,1fr)_320px] bg-border">
        {/* 좌측: 자재리스트 + 소모성 설비부품 */}
        <div className="min-w-0 overflow-hidden flex flex-col bg-card border-r-2 border-border">
          <MaterialListPanel
            onOpenMaterialScan={() => c.setIsMaterialScanOpen(true)}
            onOpenConsumableScan={() => c.setIsConsumableScanOpen(true)}
            materialScanDisabledReasons={materialScanDisabledReasons}
            consumableScanDisabledReasons={consumableScanDisabledReasons}
          />
        </div>

        {/* 중앙: 라우팅(공정순서) + 작업지도서 + 하단 3칸(자주검사 | 불량 | 실적입력) */}
        <div className="min-w-0 overflow-hidden flex flex-col bg-background border-x border-border">
          <RoutingFlowBar />
          <div className="flex-1 min-h-0 overflow-hidden border-b-2 border-border bg-card">
            <WorkInstructionView />
          </div>
          <div className="grid shrink-0 grid-cols-[1.1fr_1fr_1.2fr] min-h-[150px] bg-card">
            {/* 자주검사 */}
            <div className="min-w-0 border-r-2 border-border">
              <SelfInspectPanel
                onOpenSelfInspect={c.setSelfInspectTiming}
                firstInspectDone={firstInspectDone}
                lastInspectDone={lastInspectDone}
                midNotifyPct={midNotifyPct}
                midBlockPct={midBlockPct}
              />
            </div>

            {/* 불량 */}
            <div className="min-w-0 border-r-2 border-border">
            <DefectSummaryPanel
              onOpenDefect={c.handleOpenDefect}
              disabled={!allInterlockDone || hasPendingDelegate}
              disabledReasons={submitDisabledReasons}
            />
            </div>

            {/* 실적입력 */}
            <div className="min-w-0 overflow-hidden">
              <ProductionInputBar
                onSaved={c.handleSaved}
                onResultSaved={handleResultSaved}
                interlockDone={allInterlockDone && !hasPendingDelegate && !isMidBlock && !equipStop.isStopped}
                disabledReasons={submitDisabledReasons}
                productionType={productionType}
                outputCarrierNo={outputCarrier.carrier?.carrierNo ?? null}
                onCapacityRejected={outputCarrier.onCapacityRejected}
              />
            </div>
          </div>
        </div>

        {/* 우측: 양품조건 + 작업이력 */}
        <div className="min-w-0 overflow-hidden flex flex-col bg-surface border-l-2 border-border">
          {/* WorkHistoryPanel은 h-full이라 형제(액션 버튼)가 있으면 밀어낸다 — flex-1 래퍼로 남는 높이만 준다 */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <WorkHistoryPanel
              key={historyKey}
              stopHistory={equipStop.history}
              stopSummary={equipStop.summary}
              onOpenEquipStop={() => c.setIsEquipStopOpen(true)}
            />
          </div>
          {/* 설비정지 / 관리자호출 — 우측 제일 하단(2026-09-19 지시로 헤더에서 이동) */}
          <EquipActionButtons
            hasEquip={!!selectedEquip}
            onOpenEquipStop={() => c.setIsEquipStopOpen(true)}
            onOpenManagerCall={() => c.setIsManagerCallOpen(true)}
            isStopped={equipStop.isStopped}
            stopElapsed={equipStop.stopElapsed}
            isCalling={equipStop.isCalling}
            callElapsed={equipStop.callElapsed}
          />
        </div>
      </div>

      {/* 의뢰검사 대기 오버레이 배너 */}
      {hasPendingDelegate && (
        <div className="bg-orange-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2">
          <span className="animate-pulse">●</span>
          {t('kiosk.selfInspect.delegateBlocking')}
        </div>
      )}

      {/* 중물 자주검사 차단 배너 */}
      {isMidBlock && (
        <div className="bg-blue-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2">
          <span className="animate-pulse">●</span>
          {t('kiosk.selfInspect.midBlock')}
        </div>
      )}

      {/* 설비정지 배너 — 팝업을 닫아도 정지 중임이 화면에서 사라지지 않게 한다 */}
      {equipStop.isStopped && (
        <button
          type="button"
          onClick={() => c.setIsEquipStopOpen(true)}
          data-testid="kiosk-stop-banner"
          className="flex w-full items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-bold text-white"
        >
          <span className="animate-pulse">●</span>
          {t('kiosk.equipStop.banner', '설비 정지 중 — 실적 입력이 차단됩니다. 눌러서 해제하세요.')}
          <span className="font-mono tabular-nums">{formatElapsed(equipStop.stopElapsed)}</span>
        </button>
      )}

      {/* ── 모달들 (두 배치 공용) ── */}
      <InputKioskModals c={c} />
    </div>
  );
}
