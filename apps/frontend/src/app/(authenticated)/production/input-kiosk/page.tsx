"use client";

/**
 * @file src/app/(authenticated)/production/input-kiosk/page.tsx
 * @description 생산실적 키오스크 화면 (현장 설비 옆 태블릿/PC용)
 *
 * 초보자 가이드:
 * 화면 구성 (6영역):
 *   ① 상단 헤더: 설비/작업지시/작업자 선택
 *   ② 준비체크 바: 인터락 4단계 (일일점검·작업자점검·자재스캔·소모품스캔)
 *   ③ 좌측 패널: BOM 자재리스트 + 소모성 부품
 *   ④ 중앙 패널: 작업지도서 이미지
 *   ⑤ 우측 패널: 양품조건 + 작업이력
 *   ⑥ 하단 바: 자주검사·불량입력·실적입력
 *
 * 자주검사 트리거:
 *   - FIRST(초물): savedResultCount === 0 (첫 실적 저장 전)
 *   - MID(중물): 자주검사 버튼 수동 클릭
 *   - LAST(종물): 작업지시 종료 시 (별도 처리)
 */
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { FlaskConical, AlertOctagon } from 'lucide-react';
import { useKioskStore, isAllInterlockDone, type InspectTiming } from '@/stores/kioskStore';
import { useComCodeMap } from '@/hooks/useComCode';
import api from '@/services/api';
import WorkerSelectModal from '@/components/worker/WorkerSelectModal';
import JobOrderSelectModal, { JobOrder } from '@/components/production/JobOrderSelectModal';
import type { Worker } from '@/components/worker/WorkerSelector';
import EquipHeader from './components/EquipHeader';
import PrepCheckBar from './components/PrepCheckBar';
import MaterialListPanel from './components/MaterialListPanel';
import WorkInstructionView from './components/WorkInstructionView';
import WorkHistoryPanel from './components/WorkHistoryPanel';
import ProductionInputBar from './components/ProductionInputBar';
import DailyInspectModal from './components/DailyInspectModal';
import WorkerInspectModal from './components/WorkerInspectModal';
import MaterialScanModal from './components/MaterialScanModal';
import ConsumableScanModal from './components/ConsumableScanModal';
import DefectInputModal from './components/DefectInputModal';
import SelfInspectModal from './components/SelfInspectModal';

interface EquipOption { equipCode: string; equipName: string; }

export default function InputKioskPage() {
  const { t } = useTranslation();
  const {
    selectedEquip, selectedJobOrder, interlock, savedResultCount, hasPendingDelegate,
    pendingDefects, midInspectDone,
    addWorker, setSelectedJobOrder, setInterlock, incrementResultCount, setHasPendingDelegate,
  } = useKioskStore();

  const [equips, setEquips] = useState<EquipOption[]>([]);
  const [historyKey, setHistoryKey] = useState(0);

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
      .then(res => setEquips(res.data?.data ?? []))
      .catch(() => setEquips([]));
  }, []);

  // 설비 선택 시 → 오늘 일일점검 완료 여부 자동 체크
  useEffect(() => {
    if (!selectedEquip?.equipCode) return;
    const today = new Date().toISOString().split('T')[0];
    api.get('/equipment/daily-inspect/check', {
      params: { equipCode: selectedEquip.equipCode, inspectDate: today },
    }).then(res => {
      if (res.data?.data?.alreadyInspected) {
        setInterlock('dailyInspectDone', true);
      }
    }).catch(() => {});
  }, [selectedEquip?.equipCode, setInterlock]);

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
        });
      } catch (e: unknown) {
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

  // 실적 저장 후 처리 — 초물 자주검사 트리거
  const handleSaved = useCallback(() => {
    incrementResultCount();
    setHistoryKey(k => k + 1);
    // 첫 번째 실적 저장(초물) 후 자주검사 권장
    if (savedResultCount === 0) {
      setSelfInspectTiming('FIRST');
    }
  }, [savedResultCount, incrementResultCount]);

  // 자주검사 버튼 클릭 (수동 — 중물)
  const handleOpenSelfInspect = useCallback(() => {
    setSelfInspectTiming('MID');
  }, []);

  // 불량입력
  const handleOpenDefect = useCallback(() => {
    setIsDefectOpen(true);
  }, []);

  const allInterlockDone = isAllInterlockDone(interlock);

  // 중물 알림/차단 임계값 (QC_SELF 공통코드; 없으면 40%/60% fallback)
  const qcSelfMap = useComCodeMap('QC_SELF');
  const midNotifyPct = Number(qcSelfMap['QC_MID_NOTIFY_PCT']?.codeDesc ?? 40);
  const midBlockPct  = Number(qcSelfMap['QC_MID_BLOCK_PCT']?.codeDesc  ?? 60);
  const progressPct  = selectedJobOrder?.planQty
    ? (savedResultCount / selectedJobOrder.planQty) * 100
    : 0;
  const isMidNotify = progressPct >= midNotifyPct && !midInspectDone;
  const isMidBlock  = progressPct >= midBlockPct  && !midInspectDone;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ① 상단 헤더 */}
      <EquipHeader
        equips={equips}
        onOpenJobOrder={() => setIsJobOrderOpen(true)}
        onOpenWorker={() => setIsWorkerOpen(true)}
      />

      {/* ② 준비체크 바 */}
      <PrepCheckBar
        onOpenDailyInspect={() => setIsDailyInspectOpen(true)}
        onOpenWorkerInspect={() => setIsWorkerInspectOpen(true)}
        onOpenMaterialScan={() => setIsMaterialScanOpen(true)}
        onOpenConsumableScan={() => setIsConsumableScanOpen(true)}
      />

      {/* ③ ④ ⑤ 메인 3패널 */}
      <div className="grid flex-1 min-h-0 overflow-hidden grid-cols-[320px_minmax(0,1fr)_300px] bg-border">
        {/* 좌측: 자재리스트 */}
        <div className="min-w-0 overflow-hidden flex flex-col bg-card border-r-2 border-border">
          <MaterialListPanel />
        </div>

        {/* 중앙: 작업지도서 + 자주검사/불량입력 버튼 */}
        <div className="min-w-0 overflow-hidden flex flex-col bg-background border-x border-border">
          <div className="flex-1 min-h-0 overflow-hidden border-b-2 border-border bg-card">
            <WorkInstructionView />
          </div>
          {/* 자주검사 / 불량입력 버튼 영역 */}
          <div className="grid shrink-0 grid-cols-[140px_140px_minmax(0,1fr)] min-h-[124px] bg-card">
            <div className="min-w-0 border-r border-border p-2">
              <button
                onClick={handleOpenSelfInspect}
                disabled={!allInterlockDone || hasPendingDelegate}
                className={`h-full w-full rounded border border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 transition-colors group flex flex-col items-center justify-center gap-2 ${
                  isMidNotify ? 'animate-pulse ring-2 ring-blue-400' : ''
                }`}
              >
                <FlaskConical className="w-6 h-6 text-blue-600 dark:text-blue-400 group-disabled:text-text-muted" />
                <span className="text-sm font-semibold group-disabled:text-text-muted whitespace-nowrap">
                  {t('kiosk.input.selfInspect')}
                </span>
              </button>
            </div>
            <div className="min-w-0 border-r-2 border-border p-2">
              <button
                onClick={handleOpenDefect}
                disabled={!allInterlockDone || hasPendingDelegate}
                className="relative h-full w-full rounded border border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 transition-colors group flex flex-col items-center justify-center gap-2"
              >
                <AlertOctagon className="w-6 h-6 text-red-600 dark:text-red-400 group-disabled:text-text-muted" />
                <span className="text-sm font-semibold group-disabled:text-text-muted whitespace-nowrap">
                  {t('kiosk.input.defect')}
                </span>
                {pendingDefects.length > 0 && (
                  <span className="absolute top-2 right-2 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5">
                    {pendingDefects.reduce((s, d) => s + d.qty, 0)}
                  </span>
                )}
              </button>
            </div>
            <div className="min-w-0 overflow-hidden">
              <ProductionInputBar
                onSaved={handleSaved}
                interlockDone={allInterlockDone && !hasPendingDelegate && !isMidBlock}
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

      {/* ⑥ 하단 실적입력 바 */}
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
          onDone={() => setSelfInspectTiming(null)}
        />
      )}
    </div>
  );
}
