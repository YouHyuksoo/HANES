/**
 * @file components/inspect/types.ts
 * @description 설비·작업자 점검 모달 공용 컨텍스트 타입
 *
 * 초보자 가이드:
 * 1. 모달은 화면 스토어(kioskStore 등)에 의존하지 않고 이 컨텍스트만 받는다.
 * 2. 키오스크(실적입력)와 통전·단자검사가 같은 모달을 쓴다.
 * 3. onInterlock은 점검 결과를 호출 화면의 인터락 상태에 반영하려는 화면만 넘긴다.
 */

export interface InspectModalEquip {
  equipCode: string;
  equipName: string;
  processCode?: string;
  processName?: string;
}

export interface InspectModalJobOrder {
  orderNo: string;
  itemName?: string | null;
}

export interface InspectModalWorker {
  id: string;
  workerName: string;
}

export interface InspectModalContext {
  equip: InspectModalEquip | null;
  jobOrder?: InspectModalJobOrder | null;
  workers: InspectModalWorker[];
  /** 점검 완료 여부를 호출 화면에 알린다 (키오스크 인터락 등) */
  onInterlock?: (key: 'dailyInspectDone' | 'workerInspectDone', value: boolean) => void;
}

export interface InspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
  context: InspectModalContext;
}
