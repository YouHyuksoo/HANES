"use client";

/**
 * @file production/input-assembly-b/components/AsmReferencePanels.tsx
 * @description B 배치 좌측 하단 참조 영역 — 설비 자재 장착(왼쪽) | 반제품 SFG 스캔(오른쪽) 좌우 분할
 *
 * 초보자 가이드:
 * - 두 패널 모두 스캔 입력을 품고 있어 항상 같이 보여야 한다. 탭으로 감추면 "자재를 물렸는지"와
 *   "SFG를 몇 개 담았는지"를 번갈아 확인해야 해서 현장에서 손이 멈춘다(input-kiosk-b 와 같은 판단).
 * - 두 패널은 기존 화면(A안)의 EquipMaterialMountPanel, SgScanPanel 을 그대로 쓴다.
 *   B 안은 배치만 다르고 스캔 규칙·API는 A안과 동일하다.
 * - 자재 장착은 여기서 현황을 보고, 스캔은 스테퍼 ③단계의 [자재 스캔] 버튼 → 모달에서 한다.
 *   가공 B안이 MaterialListPanel(목록) + 버튼→MaterialScanModal(스캔) 로 나눈 것과 같은 구조다(2026-09-21 지시).
 * - 상자 규칙은 input-kiosk-b 와 같다: 굵은 테두리 + 어두운 슬레이트 제목 띠. 파스텔 배경은 쓰지 않는다.
 */
import { useTranslation } from 'react-i18next';
import { Package, Scan } from 'lucide-react';
import EquipMaterialMountPanel from '../../input-assembly/components/EquipMaterialMountPanel';
import SgScanPanel from '../../input-assembly/components/SgScanPanel';
import type { InputAssemblyController } from '../../input-assembly/hooks/useInputAssemblyController';

export default function AsmReferencePanels({ c }: { c: InputAssemblyController }) {
  const { t } = useTranslation();
  const { selectedOrder, equipCode, sgList, requirements, carrierFlags } = c;

  const head = 'flex h-9 shrink-0 items-center gap-2 bg-slate-800 px-3 text-xs font-bold text-white dark:bg-slate-700';
  const box = 'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border-2 border-slate-300 bg-card dark:border-slate-600';

  return (
    <div data-testid="asm-b-reference-panels" className="grid h-[300px] shrink-0 grid-cols-2 gap-3">
      {/* 왼쪽: 설비 자재 장착 */}
      <section className={box}>
        <div className={head}>
          <Package className="h-3.5 w-3.5 text-slate-300" />
          {t('production.inputAssembly.equipMaterialMount', '설비 자재 장착')}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <EquipMaterialMountPanel
            equipCode={equipCode}
            orderNo={selectedOrder?.orderNo}
            itemCode={selectedOrder?.itemCode}
            expectedItemTypes={["RAW_MATERIAL"]}
            autoFocusKey={selectedOrder?.orderNo}
          />
        </div>
      </section>

      {/* 오른쪽: 반제품 SFG 스캔 */}
      <section className={box}>
        <div className={head}>
          <span className={`h-2 w-2 rounded-full ${sgList.length > 0 ? 'bg-emerald-400' : 'bg-red-400'}`} aria-hidden="true" />
          <Scan className="h-3.5 w-3.5 text-slate-300" />
          {t('production.inputAssembly.sgScan', '반제품 SFG 스캔')}
          <span className="ml-auto font-mono tabular-nums text-slate-300">{sgList.length.toLocaleString()}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SgScanPanel
            key={`${equipCode}:${selectedOrder?.orderNo ?? ""}`}
            orderNo={selectedOrder?.orderNo}
            sgList={sgList}
            components={requirements?.components ?? []}
            onAdd={c.addSg}
            onRemove={c.removeSg}
            continuous={c.continuous}
            onContinuousChange={c.setContinuous}
            onReset={() => c.setSgList([])}
            disabled={c.issuing || c.confirming}
            ready={c.sgReady}
            equipCode={equipCode}
            carrierAutoInputYn={carrierFlags?.carrierAutoInputYn === "Y"}
          />
        </div>
      </section>
    </div>
  );
}
