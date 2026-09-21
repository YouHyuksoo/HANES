"use client";

/**
 * @file production/input-assembly-b/components/AsmMaterialMountModal.tsx
 * @description B 배치 ③단계 설비 자재 장착 모달 — 실적입력(가공)의 버튼→모달 방식과 통일 (2026-09-21 지시)
 *
 * 초보자 가이드:
 * - 가공은 MaterialListPanel(목록) + [자재 스캔] 버튼 → MaterialScanModal(스캔) 구조다.
 *   조립도 같은 구조로 맞춘다: 왼쪽 참조 영역은 목록만 보여주고, 스캔은 이 모달에서 한다.
 * - 스캔 로직·API 는 새로 만들지 않고 기존 EquipMaterialMountPanel 을 그대로 띄운다.
 *   A안과 조립(input-assembly) 화면은 지금까지처럼 패널을 인라인으로 쓰므로 영향이 없다.
 * - 모달을 닫을 때 onDone 으로 목록 쪽 갱신을 알린다(두 인스턴스가 같은 서버 상태를 본다).
 */
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui';
import EquipMaterialMountPanel from '../../input-assembly/components/EquipMaterialMountPanel';

interface AsmMaterialMountModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipCode: string;
  orderNo?: string;
  itemCode?: string;
}

export default function AsmMaterialMountModal({ isOpen, onClose, equipCode, orderNo, itemCode }: AsmMaterialMountModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('production.equipMaterial.mountTitle', '설비 자재 장착 (지속)')}
      size="xl"
    >
      {/* 높이를 고정해야 패널 내부의 스크롤 영역(min-h-0)이 동작한다. */}
      <div className="h-[560px] min-h-0" data-testid="asm-b-material-mount-modal">
        <EquipMaterialMountPanel
          equipCode={equipCode}
          orderNo={orderNo}
          itemCode={itemCode}
          expectedItemTypes={["RAW_MATERIAL"]}
          autoFocusKey={isOpen ? `${equipCode}:${orderNo ?? ''}` : undefined}
        />
      </div>
    </Modal>
  );
}
