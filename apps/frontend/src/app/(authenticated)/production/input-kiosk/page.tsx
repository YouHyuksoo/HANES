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
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import RoutingFlowBar from './components/RoutingFlowBar';
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
import SgLabelPrintHost, { type SgLabelPrintHandle } from './components/SgLabelPrintHost';
import { normalizeEquipOptions, type EquipOption } from './utils/equipOptions';

const SELF_INSPECT_BATCH_WINDOW_MS = 10_000;

type SelfInspectRow = {
  timing?: string;
  status?: string;
  createdAt?: string;
};

function latestFirstInspectBatchPassed(rows: SelfInspectRow[]): boolean {
  const firstRows = rows
    .filter(row => row.timing === 'FIRST' && row.status && row.createdAt)
    .sort((a, b) => new Date(b.createdAt ?? '').getTime() - new Date(a.createdAt ?? '').getTime());
  if (firstRows.length === 0) return false;

  const latestAt = new Date(firstRows[0].createdAt ?? '').getTime();
  if (!Number.isFinite(latestAt)) return false;

  const latestBatch = firstRows.filter((row) => {
    const rowAt = new Date(row.createdAt ?? '').getTime();
    return Number.isFinite(rowAt) && Math.abs(latestAt - rowAt) <= SELF_INSPECT_BATCH_WINDOW_MS;
  });

  return latestBatch.length > 0 && latestBatch.every(row => row.status === 'PASS');
}

export default function InputKioskPage() {
  const { t } = useTranslation();
  const {
    selectedEquip, selectedJobOrder, interlock, savedResultCount, hasPendingDelegate,
    selectedWorkers, midInspectDone,
    addWorker, removeWorker, setSelectedEquip, setSelectedJobOrder, setSelectedWorkers,
    setInterlock, setSavedResultCount, setHasPendingDelegate, setMidInspectDone,
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
  const restoredEquipRef = useRef<string | null>(null);

  // 설비 목록 로드
  useEffect(() => {
    api.get('/equipment/equips', { params: { limit: '500' } })
      .then(res => setEquips(normalizeEquipOptions(res.data)))
      .catch(() => setEquips([]));
  }, []);

  const parseCurrentWorkerCodes = useCallback((value?: string | null) => {
    return [...new Set((value ?? '').split(',').map(code => code.trim()).filter(Boolean))];
  }, []);

  const loadCurrentWorkers = useCallback(async (currentWorkerCodes?: string | null): Promise<Worker[]> => {
    const codes = parseCurrentWorkerCodes(currentWorkerCodes);
    const workers = await Promise.all(codes.map(async (code) => {
      const res = await api.get(`/master/workers/${encodeURIComponent(code)}`);
      const worker = res.data?.data;
      return {
        id: worker?.workerCode ?? code,
        workerCode: worker?.workerCode ?? code,
        workerName: worker?.workerName ?? code,
        dept: worker?.dept,
      } as Worker;
    }));
    return workers;
  }, [parseCurrentWorkerCodes]);

  const persistCurrentWorkerCodes = useCallback(async (workers: Worker[]) => {
    if (!selectedEquip?.equipCode) return;
    await api.patch(
      `/equipment/equips/${selectedEquip.equipCode}/workers`,
      { workerCodes: workers.map(worker => worker.id) },
      { suppressErrorModal: true },
    );
  }, [selectedEquip?.equipCode]);

  const restoreEquipmentCurrentState = useCallback(async (equip: EquipOption) => {
    restoredEquipRef.current = equip.equipCode;
    setSelectedEquip({
      equipCode: equip.equipCode,
      equipName: equip.equipName,
      processCode: equip.processCode,
      processName: equip.processName,
    });
    try {
      const equipRes = await api.get(`/equipment/equips/${encodeURIComponent(equip.equipCode)}`);
      const current = equipRes.data?.data ?? {};
      const currentJobOrderId = current.currentJobOrderId ?? equip.currentJobOrderId ?? null;
      const currentWorkerCodes = current.currentWorkerCodes ?? equip.currentWorkerCodes ?? null;

      if (currentJobOrderId) {
        const orderRes = await api.get(
          `/production/job-orders/order-no/${encodeURIComponent(currentJobOrderId)}`,
        );
        setSelectedJobOrder(orderRes.data?.data ?? null);
      } else {
        setSelectedJobOrder(null);
      }

      const workers = await loadCurrentWorkers(currentWorkerCodes);
      setSelectedWorkers(workers);
    } catch {
      setSelectedJobOrder(null);
      setSelectedWorkers([]);
      toast.error(t('kiosk.header.restoreError', '설비 현재 상태를 불러오지 못했습니다.'));
    }
  }, [loadCurrentWorkers, setSelectedEquip, setSelectedJobOrder, setSelectedWorkers, t]);

  useEffect(() => {
    if (!selectedEquip?.equipCode) {
      restoredEquipRef.current = null;
      return;
    }
    if (restoredEquipRef.current === selectedEquip.equipCode) return;
    restoredEquipRef.current = selectedEquip.equipCode;
    void restoreEquipmentCurrentState({
      equipCode: selectedEquip.equipCode,
      equipName: selectedEquip.equipName,
      processCode: selectedEquip.processCode,
      processName: selectedEquip.processName,
    });
  }, [
    selectedEquip?.equipCode,
    selectedEquip?.equipName,
    selectedEquip?.processCode,
    selectedEquip?.processName,
    restoreEquipmentCurrentState,
  ]);

  // 설비일일점검 / 작업자설비점검 완료 시각(헤더 "완료 HH:mm" 표시용)
  const [dailyInspectAt, setDailyInspectAt] = useState<string | null>(null);
  const [workerInspectAt, setWorkerInspectAt] = useState<string | null>(null);

  // 설비 선택 시 → 서버 조업일 기준 일일점검 완료 여부+시각 자동 체크
  const refreshDailyInspect = useCallback(async () => {
    if (!selectedEquip?.equipCode) { setDailyInspectAt(null); return; }
    try {
      const res = await api.get('/equipment/daily-inspect/check', {
        params: { equipCode: selectedEquip.equipCode, inspectType: 'DAILY' },
      });
      const d = res.data?.data;
      setInterlock('dailyInspectDone', Boolean(d?.alreadyInspected));
      setDailyInspectAt(d?.inspectedAt ?? null);
    } catch {
      setInterlock('dailyInspectDone', false);
      setDailyInspectAt(null);
    }
  }, [selectedEquip?.equipCode, setInterlock]);
  useEffect(() => { void refreshDailyInspect(); }, [refreshDailyInspect]);

  // 작업지시 선택/변경 시 → 작업지시별 작업자설비점검 완료 여부+시각 자동 체크
  const refreshWorkerInspect = useCallback(async () => {
    if (!selectedEquip?.equipCode || !selectedJobOrder?.orderNo) {
      setInterlock('workerInspectDone', false);
      setWorkerInspectAt(null);
      return;
    }
    try {
      const res = await api.get('/equipment/daily-inspect/check', {
        params: {
          equipCode: selectedEquip.equipCode,
          inspectType: 'WORKER',
          orderNo: selectedJobOrder.orderNo,
        },
      });
      const d = res.data?.data;
      setInterlock('workerInspectDone', Boolean(d?.alreadyInspected));
      setWorkerInspectAt(d?.inspectedAt ?? null);
    } catch {
      setInterlock('workerInspectDone', false);
      setWorkerInspectAt(null);
    }
  }, [selectedEquip?.equipCode, selectedJobOrder?.orderNo, setInterlock]);
  useEffect(() => { void refreshWorkerInspect(); }, [refreshWorkerInspect]);

  const refreshSelfInspectStatus = useCallback(async () => {
    if (!selectedJobOrder?.orderNo) {
      setFirstInspectDone(false);
      setMidInspectDone(false);
      setLastInspectDone(false);
      setHasPendingDelegate(false);
      return;
    }
    try {
      const res = await api.get(
        `/production/self-inspect/results/${encodeURIComponent(selectedJobOrder.orderNo)}`,
      );
      const rows: SelfInspectRow[] = Array.isArray(res.data?.data) ? res.data.data : [];
      const firstInspectPassed = latestFirstInspectBatchPassed(rows);
      const doneTimings = new Set(
        rows
          .filter((row: { status?: string }) => row.status && row.status !== 'PENDING')
          .map((row: { timing?: string }) => row.timing)
          .filter(Boolean),
      );
      setFirstInspectDone(firstInspectPassed);
      setMidInspectDone(doneTimings.has('MID'));
      setLastInspectDone(doneTimings.has('LAST'));
      setHasPendingDelegate(rows.some((row: SelfInspectRow) => row.status === 'PENDING' && row.timing !== 'FIRST'));
    } catch {
      setFirstInspectDone(false);
      setMidInspectDone(false);
      setLastInspectDone(false);
    }
  }, [selectedJobOrder?.orderNo, setHasPendingDelegate, setMidInspectDone]);

  useEffect(() => { void refreshSelfInspectStatus(); }, [refreshSelfInspectStatus]);

  useEffect(() => {
    if (!selectedJobOrder?.orderNo || firstInspectDone) return;
    const timer = setInterval(() => {
      void refreshSelfInspectStatus();
    }, 10000);
    return () => clearInterval(timer);
  }, [firstInspectDone, refreshSelfInspectStatus, selectedJobOrder?.orderNo]);

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

  const handleWorkerConfirm = useCallback(async (worker: Worker) => {
    const nextWorkers = selectedWorkers.some(w => w.id === worker.id)
      ? selectedWorkers
      : [...selectedWorkers, worker];
    addWorker(worker);
    setIsWorkerOpen(false);
    try {
      await persistCurrentWorkerCodes(nextWorkers);
    } catch {
      setSelectedWorkers(selectedWorkers);
      toast.error(t('kiosk.header.workerAssignError', '현재 작업자 저장에 실패했습니다.'));
    }
  }, [addWorker, persistCurrentWorkerCodes, selectedWorkers, setSelectedWorkers, t]);

  const handleRemoveWorker = useCallback(async (workerId: string) => {
    const nextWorkers = selectedWorkers.filter(worker => worker.id !== workerId);
    removeWorker(workerId);
    try {
      await persistCurrentWorkerCodes(nextWorkers);
    } catch {
      setSelectedWorkers(selectedWorkers);
      toast.error(t('kiosk.header.workerAssignError', '현재 작업자 저장에 실패했습니다.'));
    }
  }, [persistCurrentWorkerCodes, removeWorker, selectedWorkers, setSelectedWorkers, t]);

  // 실적 저장 후 처리 — 서버 기준 진행수량 재동기화 + 초물 자주검사 자동 트리거
  const handleSaved = useCallback(() => {
    // 초물 전체 PASS 전까지는 시생산이며, 실적 저장 후 초물검사를 계속 유도한다.
    if (!firstInspectDone) {
      setSelfInspectTiming('FIRST');
    }
    refreshProgress();
    setHistoryKey(k => k + 1);
  }, [firstInspectDone, refreshProgress]);

  // 실적 저장 성공 시: 라우팅 발행공정이면 백엔드가 발행한 SFG 라벨을 조회해 Print Agent로 자동 출력.
  const sgPrinterRef = useRef<SgLabelPrintHandle>(null);
  const handleResultSaved = useCallback((resultNo: string) => {
    void sgPrinterRef.current?.printByResultNo(resultNo);
  }, []);

  // 자주검사 모달 완료 처리
  const handleSelfInspectDone = useCallback(() => {
    if (selfInspectTiming === 'FIRST') setFirstInspectDone(true);
    if (selfInspectTiming === 'MID') setMidInspectDone(true);
    if (selfInspectTiming === 'LAST') setLastInspectDone(true);
    setSelfInspectTiming(null);
    void refreshSelfInspectStatus();
  }, [refreshSelfInspectStatus, selfInspectTiming, setMidInspectDone]);

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
  const productionType = firstInspectDone ? 'MASS' : 'TRIAL';

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

  // 자재 스캔은 선행 점검(설비점검/작업자점검)과 무관 — 자재목록이 로딩(작업지시 선택)되면 스캔 가능.
  const materialScanDisabledReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!selectedJobOrder) reasons.push(t('kiosk.input.disabledReasons.noJobOrder'));
    return reasons;
  }, [selectedJobOrder, t]);

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
        onSelectEquip={restoreEquipmentCurrentState}
        onRemoveWorker={handleRemoveWorker}
        dailyInspectAt={dailyInspectAt}
        workerInspectAt={workerInspectAt}
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
                onResultSaved={handleResultSaved}
                interlockDone={allInterlockDone && !hasPendingDelegate && !isMidBlock}
                disabledReasons={submitDisabledReasons}
                productionType={productionType}
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
        equipCode={selectedEquip?.equipCode}
        orderKind="OPERATION"
      />
      <WorkerSelectModal
        isOpen={isWorkerOpen}
        onClose={() => setIsWorkerOpen(false)}
        onConfirm={handleWorkerConfirm}
      />
      <DailyInspectModal
        isOpen={isDailyInspectOpen}
        onClose={() => setIsDailyInspectOpen(false)}
        onDone={() => { setIsDailyInspectOpen(false); void refreshDailyInspect(); }}
      />
      <WorkerInspectModal
        isOpen={isWorkerInspectOpen}
        onClose={() => setIsWorkerInspectOpen(false)}
        onDone={() => { setIsWorkerInspectOpen(false); void refreshWorkerInspect(); }}
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

      {/* SFG(반제품) 라벨 자동 출력 호스트 — 오프스크린 렌더 후 Print Agent 전송 */}
      <SgLabelPrintHost ref={sgPrinterRef} />
    </div>
  );
}
