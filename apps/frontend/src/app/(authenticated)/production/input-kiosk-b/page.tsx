"use client";

/**
 * @file src/app/(authenticated)/production/input-kiosk-b/page.tsx
 * @description 생산실적 키오스크 B 배치 시안 — 작업 순서 스테퍼형 (2026-09-20 시안 B 채택 검토용)
 *
 * 초보자 가이드:
 * 화면 구성:
 *   ① 상단 컨텍스트 띠(어두운 슬레이트): 설비 · 작업지시 · 작업자 · 대차 · 준비 안내 · 전체화면
 *   ② 좌측: 라우팅 + 작업지도서(가장 넓게) / 아래 참조 영역 좌우 분할(자재·소모품 | 양품조건·작업이력)
 *   ③ 우측: 작업 순서 스테퍼(설비 점검 → 자재 로트 → 공정샘플검사 → 실적입력)
 *   ④ 하단: 지표 띠(CT·UPH·UPPH·양품·불량·유실 합계, 한 양식) + 설비정지/관리자호출
 *
 * 상태·게이트·모달 로직은 기존 화면과 같은 useInputKioskController 를 쓴다. 이 파일은 배치만 다르다.
 * 기존 /production/input-kiosk 는 그대로 두었다. 채택되면 그쪽 배치를 이 구성으로 바꾸고 이 라우트는 정리한다.
 */
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import RoutingFlowBar from '../input-kiosk/components/RoutingFlowBar';
import WorkInstructionView from '../input-kiosk/components/WorkInstructionView';
import EquipActionButtons from '../input-kiosk/components/EquipActionButtons';
import InputKioskModals from '../input-kiosk/components/InputKioskModals';
import { formatElapsed } from '../input-kiosk/hooks/useEquipStop';
import { useProdResultHistory } from '../input-kiosk/hooks/useProdResultHistory';
import { useInputKioskController } from '../input-kiosk/hooks/useInputKioskController';
import KioskContextBar from './components/KioskContextBar';
import KioskReferencePanels from './components/KioskReferencePanels';
import KioskWorkStepper from './components/KioskWorkStepper';
import KioskMetricsStrip from './components/KioskMetricsStrip';

export default function InputKioskBPage() {
  const { t } = useTranslation();
  const c = useInputKioskController();
  const { selectedEquip, selectedJobOrder, selectedWorkers, savedResultCount, hasPendingDelegate, isMidBlock, equipStop } = c;
  // 최근 실적 목록은 한 번만 조회해 참조 탭(이력)과 하단 합계 띠가 함께 쓴다. 실적 저장 시 historyKey 로 재조회.
  const resultHistory = useProdResultHistory(selectedEquip?.equipCode, selectedJobOrder?.orderNo, { refreshKey: c.historyKey });

  return (
    <div data-testid="kiosk-b-page" className="flex h-full flex-col overflow-hidden bg-background">
      {/* ① 컨텍스트 띠 */}
      <KioskContextBar c={c} />

      {/* ② ③ 본문 2열 */}
      <div className="flex min-h-0 flex-1 gap-3 bg-surface p-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {/* 작업지도서 상자 — 참조 상자·오늘의 작업 상자와 같은 규칙: 굵은 테두리 + 어두운 제목 띠 */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-slate-300 bg-card dark:border-slate-600">
            <div className="flex h-9 shrink-0 items-center gap-2 bg-slate-800 px-3 text-xs font-bold text-white dark:bg-slate-700">
              <BookOpen className="h-3.5 w-3.5 text-slate-300" />
              {t('kiosk.instruction.title', '작업지도서')}
            </div>
            <RoutingFlowBar />
            <div className="min-h-0 flex-1 overflow-hidden">
              <WorkInstructionView />
            </div>
          </div>
          <KioskReferencePanels c={c} history={resultHistory.history} />
        </div>
        <div className="w-[440px] shrink-0">
          <KioskWorkStepper c={c} />
        </div>
      </div>

      {/* ④ 하단 — 지표 띠(한 양식) + 비상 액션 */}
      <div className="flex h-16 shrink-0 items-stretch border-t border-border bg-card">
        <div className="flex min-w-0 flex-1 items-stretch px-2">
          <KioskMetricsStrip
            orderNo={selectedJobOrder?.orderNo}
            workers={selectedWorkers.length}
            refreshKey={savedResultCount}
            totalGood={resultHistory.totalGood}
            totalDefect={resultHistory.totalDefect}
            stopSummary={equipStop.summary}
          />
        </div>
        <div className="w-[464px] shrink-0">
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

      {/* 배너 — 기존 화면과 같은 세 가지 */}
      {hasPendingDelegate && (
        <div className="flex items-center justify-center gap-2 bg-orange-500 px-4 py-2 text-sm font-medium text-white">
          <span className="animate-pulse">●</span>
          {t('kiosk.selfInspect.delegateBlocking')}
        </div>
      )}
      {isMidBlock && (
        <div className="flex items-center justify-center gap-2 bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          <span className="animate-pulse">●</span>
          {t('kiosk.selfInspect.midBlock')}
        </div>
      )}
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

      <InputKioskModals c={c} />
    </div>
  );
}
