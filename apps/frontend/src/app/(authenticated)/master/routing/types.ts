/**
 * @file src/app/(authenticated)/master/routing/types.ts
 * @description 라우팅 그룹 관리 페이지 타입 정의
 *
 * 초보자 가이드:
 * 1. RoutingGroupItem: 라우팅 그룹 마스터
 * 2. RoutingProcessItem: 그룹 내 공정순서
 * 3. QualityCondition: 양품조건
 */

/** 라우팅 그룹 */
export interface RoutingGroupItem {
  routingCode: string;
  routingName: string;
  itemCode: string | null;
  itemName?: string | null;
  itemType?: string | null;
  description: string | null;
  useYn: string;
}

/** 공정순서 */
export interface RoutingProcessItem {
  routingCode: string;
  seq: number;
  processCode: string;
  processName: string;
  processType: string | null;
  equipType: string | null;
  executionType: "IN_HOUSE" | "SUBCON";
  jobOrderYn: string;
  subconVendorCode: string | null;
  stdTime: number | null;
  setupTime: number | null;
  sampleInspectYn: string;
  issueLabelType: string;
  useYn: string;
}

/** 양품조건 */
export interface QualityCondition {
  routingCode: string;
  seq: number;
  conditionSeq: number;
  conditionCode: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  equipInterfaceYn: string;
  useYn: string;
}

/** 편집 중인 양품조건 */
export interface EditableCondition {
  tempId: string;
  conditionSeq: number;
  conditionCode: string;
  minValue: string;
  maxValue: string;
  unit: string;
  equipInterfaceYn: string;
}

/** 선택된 공정 */
export interface RoutingMaterial {
  routingCode: string;
  seq: number;
  childItemCode: string;
  childItemName: string | null;
  childItemNo: string | null;
  childItemType: string | null;
  unit: string | null;
  qtyPer: number;
  selected: boolean;
  circuitId: number | null;
  circuitNo: string | null;
  lengthMm: number | null;
  stripA: number | null;
  stripB: number | null;
  circuitOptions?: RoutingMaterialCircuitOption[];
  allocQty: number | null;
  issueMethod: string;
  useYn: string;
}

export interface RoutingMaterialCircuitOption {
  circuitId: number;
  circuitNo: string;
  wireItemCode: string;
  lengthMm: number | null;
  stripA: number | null;
  stripB: number | null;
}

export interface EditableRoutingMaterial {
  childItemCode: string;
  childItemName: string;
  childItemNo: string;
  unit: string;
  qtyPer: number;
  selected: boolean;
  circuitId: string;
  circuitNo: string;
  lengthMm: number | null;
  stripA: number | null;
  stripB: number | null;
  circuitOptions: RoutingMaterialCircuitOption[];
  allocQty: string;
  issueMethod: string;
}

export interface SelectedProcess {
  routingCode: string;
  routingName: string;
  seq: number;
  processCode: string;
  processName: string;
}
