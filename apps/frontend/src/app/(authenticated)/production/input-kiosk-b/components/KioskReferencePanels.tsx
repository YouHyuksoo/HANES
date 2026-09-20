"use client";

/**
 * @file production/input-kiosk-b/components/KioskReferencePanels.tsx
 * @description B 배치 좌측 하단 참조 영역 — 자재·소모품(왼쪽) | 양품조건·작업이력·유실 이력(오른쪽) 좌우 분할
 *
 * 초보자 가이드:
 * - 처음엔 탭이었는데 무엇이 어디 있는지 헷갈려서(2026-09-20 지시) 좌우로 나눠 항상 같이 보이게 했다.
 * - 두 패널은 기존 화면(input-kiosk)의 MaterialListPanel, WorkHistoryPanel 을 그대로 쓴다.
 * - 합계 카드(양품/불량/유실)는 페이지 하단 띠에 있으므로 이력 패널에서는 숨긴다(hideSummary).
 * - 최근 실적 목록(history)은 페이지가 한 번 조회해 내려준다(하단 합계 띠와 공유).
 * - 두 상자는 사이를 띄운 별도 카드이고 제목 띠는 어두운 슬레이트다. 안쪽 패널의 소제목 띠(연회색)와
 *   같은 톤이면 띠 6개가 같은 무게로 보여 경계가 안 읽혔다(2026-09-20 지적).
 */
import { useTranslation } from 'react-i18next';
import { Package, History } from 'lucide-react';
import MaterialListPanel from '../../input-kiosk/components/MaterialListPanel';
import WorkHistoryPanel from '../../input-kiosk/components/WorkHistoryPanel';
import type { InputKioskController } from '../../input-kiosk/hooks/useInputKioskController';
import type { HistoryItem } from '../../input-kiosk/hooks/useProdResultHistory';

export default function KioskReferencePanels({ c, history }: { c: InputKioskController; history: HistoryItem[] }) {
  const { t } = useTranslation();
  const { interlock } = c;
  const materialDone = interlock.materialScanDone && interlock.consumableScanDone;
  const head = 'flex h-9 shrink-0 items-center gap-2 bg-slate-800 px-3 text-xs font-bold text-white dark:bg-slate-700';
  const box = 'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border-2 border-slate-300 bg-card dark:border-slate-600';

  return (
    <div data-testid="kiosk-b-reference-panels" className="grid h-[260px] shrink-0 grid-cols-2 gap-3">
      {/* 왼쪽: 자재 · 소모품 */}
      <section className={box}>
        <div className={head}>
          <span className={`h-2 w-2 rounded-full ${materialDone ? 'bg-emerald-400' : 'bg-red-400'}`} aria-hidden="true" />
          <Package className="h-3.5 w-3.5 text-slate-300" />
          {t('kiosk.stepper.tabMaterial', '자재 · 소모품')}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <MaterialListPanel
            onOpenMaterialScan={() => c.setIsMaterialScanOpen(true)}
            onOpenConsumableScan={() => c.setIsConsumableScanOpen(true)}
            materialScanDisabledReasons={c.materialScanDisabledReasons}
            consumableScanDisabledReasons={c.consumableScanDisabledReasons}
          />
        </div>
      </section>

      {/* 오른쪽: 양품조건 · 작업이력 · 유실 이력 */}
      <section className={box}>
        <div className={head}>
          <History className="h-3.5 w-3.5 text-slate-300" />
          {t('kiosk.stepper.tabHistory', '양품조건 · 작업이력')}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <WorkHistoryPanel
            history={history}
            hideSummary
            stopHistory={c.equipStop.history}
            stopSummary={c.equipStop.summary}
            onOpenEquipStop={() => c.setIsEquipStopOpen(true)}
          />
        </div>
      </section>
    </div>
  );
}
