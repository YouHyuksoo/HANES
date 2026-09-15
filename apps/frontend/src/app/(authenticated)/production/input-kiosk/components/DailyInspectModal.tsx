"use client";

/**
 * @file components/DailyInspectModal.tsx
 * @description 키오스크용 설비 일일점검 모달 래퍼 — 스토어 값을 공용 모달(@/components/inspect)에 전달한다.
 *
 * 초보자 가이드:
 * 1. 점검 UI와 저장 로직은 공용 모달이 갖고 있다. 여기서는 kioskStore 값을 컨텍스트로 넘기기만 한다.
 * 2. 통전·단자검사 화면도 같은 공용 모달을 쓴다. 로직을 복제하지 않는다.
 */
import { DailyInspectModal as SharedDailyInspectModal } from '@/components/inspect';
import { useKioskStore } from '@/stores/kioskStore';

interface DailyInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function DailyInspectModal({ isOpen, onClose, onDone }: DailyInspectModalProps) {
  const { selectedEquip, selectedJobOrder, selectedWorkers, setInterlock } = useKioskStore();

  return (
    <SharedDailyInspectModal
      isOpen={isOpen}
      onClose={onClose}
      onDone={onDone}
      context={{
        equip: selectedEquip,
        jobOrder: selectedJobOrder
          ? { orderNo: selectedJobOrder.orderNo, itemName: selectedJobOrder.itemName }
          : null,
        workers: selectedWorkers.map(w => ({ id: w.id, workerName: w.workerName })),
        onInterlock: setInterlock,
      }}
    />
  );
}
