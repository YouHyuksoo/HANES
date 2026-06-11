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
 * 자주검사 트리거 (SelfInspectPanel + 본 페이지 로직):
 *   - FIRST(초물): savedResultCount === 0 이후 첫 저장 → 자동 오픈
 *   - MID(중물): 패널 버튼 클릭 또는 진행률 60% 차단
 *   - LAST(종물): 패널 버튼 클릭
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useKioskStore, isAllInterlockDone, type InspectTiming } from '@/stores/kioskStore';
import { useComCodeMap } from '@/hooks/useComCode';
import api from '@/services/api';
import WorkerSelectModal from '@/components/worker/WorkerSelectModal';
import JobOrderSelectModal, { JobOrder } from '@/components/production/JobOrderSelectModal';
import type { Worker } from '@/components/worker/WorkerSelector';
import EquipHeader from './components/EquipHeader';
import MaterialListPanel from './components/MaterialListPanel';
import WorkInstructionView from './components/WorkInstructionView';
import WorkHistoryPanel from './components/WorkHistoryPanel';
import ProductionInputBar from './components/ProductionInputBar';
import SelfInspectPanel from './components/SelfInspectPanel';
import DefectSummaryPanel from './components/DefectSummaryPanel';
import DailyInspectModal from './components/DailyInspectModal';
import WorkerInspectModal from './components/WorkerInspectModal';
import MaterialScanModal from './components/MaterialScanModal';
import ConsumableScanModal from './components/ConsumableScanModal';
import DefectInputModal from './components/DefectInputModal';
import SelfInspectModal from './components/SelfInspectModal';
import { normalizeEquipOptions, type EquipOption } from './utils/equipOptions';

export default function InputKioskPage() {
  const { t } = useTranslation();
  const {
    selectedEquip, selectedJobOrder, interlock, savedResultCount, hasPendingDelegate,
    selectedWorkers, midInspectDone,
    addWorker, setSelectedJobOrder, setInterlock, setSavedResultCount, setHasPendingDelegate,
  } = useKioskStore();

  const [equips, setEquips] = useState<EquipOption[]>([]);
  const [historyKey, setHistoryKey] = useState(0);
  const [firstInspectDone, setFirstInspectDone] = useState(false);
  const [lastInspectDone, setLastInspectDone] = useState(false);

  // 모달 상태
  const [isJobOrderOpen, setIsJobOrderOpen] = useState(false);
  const [isWorkerOpen, setIsWorkerOpen] = useState(false);
  const [isDailyInspectOpen, setIsDailyInspectOpen] = useState(false);
  const [isWorkerInspectOpen, setIsWorkerInspectOpen] = useState(false);
  const [isMaterialScanOpen, setIsMaterialScanOpen] = useState(false);
  const [isConsumableScanOpen, setIsConsumableScanOpen] = useState(false);
  const [isDefectOpen, setIsDefectOpen] = useState(false);
  const [selfInspectTiming, setSelfInspectTiming] = useState<InspectTiming | null>(null);

  // 설비 목록 로드
  useEffect(() => {
    api.get('/equipment/equips', { params: { limit: '500' } })
      .then(res => setEquips(normalizeEquipOptions(res.data)))
      .catch(() => setEquips([]));
  }, []);

  // 설비 선택 시 → 오늘 일일점검 완료 여부 자동 체크
  useEffect(() => {
    if (!selectedEquip?.equipCode) return;
    const today = new Date().toISOString().split('T')[0];
    api.get('/equipment/daily-inspect/check', {
      params: { equipCode: selectedEquip.equipCode, inspectDate: today },
    }).then(res => {
      if (res.data?.data?.alreadyInspected) setInterlock('dailyInspectDone', true);
    }).catch(() => {});
  }, [selectedEquip?.equipCode, setInterlock]);

  // 작업지시 변경 시 자주검사 완료 상태 초기화
  useEffect(() => {
    setFirstInspectDone(false);
    setLastInspectDone(false);
  }, [selectedJobOrder?.orderNo]);

  // 진행수량을 서버 실적(PROD_RESULTS 집계) 기준으로 동기화
  // — 새로고침/재진입/다른 단말 실적이 있어도 진행률·중물 차단이 실제 생산량을 따른다.
  const refreshProgress = useCallback(async () => {
    if (!selectedJobOrder?.orderNo) return;
    try {
      const res = await api.get(
        `/production/job-orders/order-no/${encodeURIComponent(selectedJobOrder.orderNo)}`,
      );
      const jo = res.data?.data;
      if (jo) setSavedResultCount((jo.goodQty ?? 0) + (jo.defectQty ?? 0));
    } catch {
      // 조회 실패 시 기존(persist) 값 유지
    }
  }, [selectedJobOrder?.orderNo, setSavedResultCount]);

  // 작업지시 선택/재진입 시 서버 기준으로 초기 동기화
  useEffect(() => { refreshProgress(); }, [refreshProgress]);

  // 의뢰검사 대기 여부 주기적 체크 (10초 간격)
  useEffect(() => {
    if (!selectedJobOrder?.orderNo || !hasPendingDelegate) return;
    const check = () => {
      api.get(`/production/self-inspect/pending/${selectedJobOrder.orderNo}`)
        .then(res => setHasPendingDelegate(res.data?.data?.hasPending ?? false))
        .catch(() => {});
    };
    const timer = setInterval(check, 10000);
    return () => clearInterval(timer);
  }, [selectedJobOrder?.orderNo, hasPendingDelegate, setHasPendingDelegate]);

  // 작업지시 선택 → 설비에 할당
  const handleJobOrderConfirm = useCallback(async (jobOrder: JobOrder) => {
    setSelectedJobOrder(jobOrder);
    setIsJobOrderOpen(false);
    if (selectedEquip) {
      try {
        await api.patch(`/equipment/equips/${selectedEquip.equipCode}/job-order`, {
          orderNo: jobOrder.orderNo,
        }, { suppressErrorModal: true });
      } catch (e: unknown) {
        // 설비 STOP 등 할당 실패는 전역 모달 대신 인라인 toast로 안내(화면 차단 방지).
        // 작업지시 자체는 위에서 이미 선택되어 자재리스트/작업지도서는 정상 표시됨.
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? t('kiosk.jobOrder.assignError');
        toast.error(msg);
      }
    }
  }, [selectedEquip, setSelectedJobOrder, t]);

  const handleWorkerConfirm = useCallback((worker: Worker) => {
    addWorker(worker);
    setIsWorkerOpen(false);
  }, [addWorker]);

  // 실적 저장 후 처리 — 서버 기준 진행수량 재동기화 + 초물 자주검사 자동 트리거
  const handleSaved = useCallback(() => {
    // 이번 저장 전 누적 생산수량이 0이었으면 초물 검사 트리거 (서버 집계 기준)
    if (savedResultCount === 0 && !firstInspectDone) {
      setSelfInspectTiming('FIRST');
    }
    refreshProgress();
    setHistoryKey(k => k + 1);
  }, [savedResultCount, firstInspectDone, refreshProgress]);

  // 자주검사 모달 완료 처리
  const handleSelfInspectDone = useCallback(() => {
    if (selfInspectTiming === 'FIRST') setFirstInspectDone(true);
    if (selfInspectTiming === 'LAST') setLastInspectDone(true);
    setSelfInspectTiming(null);
  }, [selfInspectTiming]);

  const handleOpenDefect = useCallback(() => setIsDefectOpen(true), []);

  const allInterlockDone = isAllInterlockDone(interlock);

  // 중물 알림/차단 임계값 (QC_SELF 공통코드)
  const qcSelfMap = useComCodeMap('QC_SELF');
  const midNotifyPct = Number(qcSelfMap['QC_MID_NOTIFY_PCT']?.codeDesc ?? 40);
  const midBlockPct  = Number(qcSelfMap['QC_MID_BLOCK_PCT']?.codeDesc  ?? 60);
  const progressPct  = selectedJobOrder?.planQty
    ? (savedResultCount / selectedJobOrder.planQty) * 100
    : 0;
  const isMidBlock = progressPct >= midBlockPct && !midInspectDone;

  const submitDisabledReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!selectedEquip) reasons.push(t('kiosk.input.disabledReasons.noEquip'));
    if (!selectedJobOrder) reasons.push(t('kiosk.input.disabledReasons.noJobOrder'));
    if (selectedWorkers.length === 0) reasons.push(t('kiosk.input.disabledReasons.noWorker'));
    if (!interlock.dailyInspectDone) reasons.push(t('kiosk.input.disabledReasons.dailyInspect'));
    if (!interlock.workerInspectDone) reasons.push(t('kiosk.input.disabledReasons.workerInspect'));
    if (!interlock.materialScanDone) reasons.push(t('kiosk.input.disabledReasons.materialScan'));
    if (!interlock.consumableScanDone) reasons.push(t('kiosk.input.disabledReasons.consumableScan'));
    if (hasPendingDelegate) reasons.push(t('kiosk.selfInspect.delegateBlocking'));
    if (isMidBlock) reasons.push(t('kiosk.selfInspect.midBlock'));
    return reasons;
  }, [
    selectedEquip,
    selectedJobOrder,
    selectedWorkers.length,
    interlock.dailyInspectDone,
    interlock.workerInspectDone,
    interlock.materialScanDone,
    interlock.consumableScanDone,
    hasPendingDelegate,
    isMidBlock,
    t,
  ]);

  const materialScanDisabledReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!interlock.dailyInspectDone) reasons.push(t('kiosk.input.disabledReasons.dailyInspect'));
    if (!interlock.workerInspectDone) reasons.push(t('kiosk.input.disabledReasons.workerInspect'));
    if (!selectedJobOrder) reasons.push(t('kiosk.input.disabledReasons.noJobOrder'));
    return reasons;
  }, [interlock.dailyInspectDone, interlock.workerInspectDone, selectedJobOrder, t]);

  // 소모품 스캔은 자재 스캔과 독립(순서 무관). 설비가 선택돼 있어야 한다는 전제만 둔다.
  const consumableScanDisabledReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!selectedEquip) reasons.push(t('kiosk.input.disabledReasons.noEquip'));
    return reasons;
  }, [selectedEquip, t]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ① 상단 헤더 (2단) */}
      <EquipHeader
        equips={equips}
        onOpenJobOrder={() => setIsJobOrderOpen(true)}
        onOpenWorker={() => setIsWorkerOpen(true)}
        onOpenDailyInspect={() => setIsDailyInspectOpen(true)}
        onOpenWorkerInspect={() => setIsWorkerInspectOpen(true)}
      />

      {/* ② ③ ④ 메인 3패널 */}
      <div className="grid flex-1 min-h-0 overflow-hidden grid-cols-[320px_minmax(0,1fr)_320px] bg-border">
        {/* 좌측: 자재리스트 + 소모성 설비부품 */}
        <div className="min-w-0 overflow-hidden flex flex-col bg-card border-r-2 border-border">
          <MaterialListPanel
            onOpenMaterialScan={() => setIsMaterialScanOpen(true)}
            onOpenConsumableScan={() => setIsConsumableScanOpen(true)}
            materialScanDisabledReasons={materialScanDisabledReasons}
            consumableScanDisabledReasons={consumableScanDisabledReasons}
          />
        </div>

        {/* 중앙: 작업지도서 + 하단 3칸(자주검사 | 불량 | 실적입력) */}
        <div className="min-w-0 overflow-hidden flex flex-col bg-background border-x border-border">
          <div className="flex-1 min-h-0 overflow-hidden border-b-2 border-border bg-card">
            <WorkInstructionView />
          </div>
          <div className="grid shrink-0 grid-cols-[1.1fr_1fr_1.2fr] min-h-[150px] bg-card">
            {/* 자주검사 */}
            <div className="min-w-0 border-r-2 border-border">
              <SelfInspectPanel
                onOpenSelfInspect={setSelfInspectTiming}
                firstInspectDone={firstInspectDone}
                lastInspectDone={lastInspectDone}
                midNotifyPct={midNotifyPct}
                midBlockPct={midBlockPct}
              />
            </div>

            {/* 불량 */}
            <div className="min-w-0 border-r-2 border-border">
            <DefectSummaryPanel
              onOpenDefect={handleOpenDefect}
              disabled={!allInterlockDone || hasPendingDelegate}
              disabledReasons={submitDisabledReasons}
            />
            </div>

            {/* 실적입력 */}
            <div className="min-w-0 overflow-hidden">
              <ProductionInputBar
                onSaved={handleSaved}
                interlockDone={allInterlockDone && !hasPendingDelegate && !isMidBlock}
                disabledReasons={submitDisabledReasons}
              />
            </div>
          </div>
        </div>

        {/* 우측: 양품조건 + 작업이력 */}
        <div className="min-w-0 overflow-hidden flex flex-col bg-card border-l-2 border-border">
          <WorkHistoryPanel key={historyKey} />
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

      {/* ── 모달들 ── */}
      <JobOrderSelectModal
        isOpen={isJobOrderOpen}
        onClose={() => setIsJobOrderOpen(false)}
        onConfirm={handleJobOrderConfirm}
        filterStatus={['WAITING', 'RUNNING']}
      />
      <WorkerSelectModal
        isOpen={isWorkerOpen}
        onClose={() => setIsWorkerOpen(false)}
        onConfirm={handleWorkerConfirm}
      />
      <DailyInspectModal
        isOpen={isDailyInspectOpen}
        onClose={() => setIsDailyInspectOpen(false)}
        onDone={() => setIsDailyInspectOpen(false)}
      />
      <WorkerInspectModal
        isOpen={isWorkerInspectOpen}
        onClose={() => setIsWorkerInspectOpen(false)}
        onDone={() => setIsWorkerInspectOpen(false)}
      />
      <MaterialScanModal
        isOpen={isMaterialScanOpen}
        onClose={() => setIsMaterialScanOpen(false)}
        onDone={() => setIsMaterialScanOpen(false)}
      />
      <ConsumableScanModal
        isOpen={isConsumableScanOpen}
        onClose={() => setIsConsumableScanOpen(false)}
        onDone={() => setIsConsumableScanOpen(false)}
      />
      <DefectInputModal
        isOpen={isDefectOpen}
        onClose={() => setIsDefectOpen(false)}
      />
      {selfInspectTiming && (
        <SelfInspectModal
          isOpen={!!selfInspectTiming}
          timing={selfInspectTiming}
          onClose={() => setSelfInspectTiming(null)}
          onDone={handleSelfInspectDone}
        />
      )}
    </div>
  );
}
