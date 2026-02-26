/**
 * @file src/app/(authenticated)/master/bom/types.ts
 * @description BOM/Routing 관련 타입 정의 - Oracle TM_BOM + PROCESS_MAPS 기준
 *
 * 초보자 가이드:
 * 1. **ParentPart**: BOM 모품목(부모품목) - API에서 조회
 * 2. **BomTreeItem**: BOM 계층 트리 아이템 - hierarchy API 응답
 * 3. **RoutingItem**: 품목별 공정순서 아이템 - partId 기반 조회
 * 4. **RoutingTarget**: BOM에서 라우팅 탭으로 이동 시 대상 정보
 */

export interface ParentPart {
  id: string;
  itemCode: string;
  itemName: string;
  itemNo?: string;
  itemType: string;
  spec?: string;
  unit?: string;
  customer?: string;
  remark?: string;
  bomCount: number;
}

export interface BomItem {
  id: string;
  childItemCode: string;
  childItemName: string;
  childItemType: string;
  qtyPer: number;
  unit: string;
  revision: string;
  seq: number;
  processCode?: string;
  side?: string;
  useYn: string;
}

/** 트리 구조 BOM 아이템 (API hierarchy 응답) */
export interface BomTreeItem {
  id: string;
  level: number;
  itemCode: string;
  itemNo?: string | null;
  itemName: string;
  itemType: "FG" | "WIP" | "RAW";
  qtyPer: number;
  unit: string;
  revision: string;
  seq: number;
  processCode?: string;
  side?: string;
  validFrom?: string;
  validTo?: string;
  useYn: string;
  childItemCode?: string;
  children?: BomTreeItem[];
}

/** 품목별 공정순서 아이템 (GET /master/routings 응답) */
export interface RoutingItem {
  id: string;
  seq: number;
  processCode: string;
  processName: string;
  processType: string;
  equipType?: string;
  stdTime?: number;
  setupTime?: number;
  wireLength?: number;
  stripLength?: number;
  crimpHeight?: number;
  crimpWidth?: number;
  weldCondition?: string;
  processParams?: string;
  useYn: string;
}

/** BOM에서 라우팅 탭으로 연결할 때 사용하는 타겟 정보 */
export interface RoutingTarget {
  itemCode: string;
  itemName: string;
  itemType: string;
  breadcrumb?: string;
}

/** BOM CRUD 폼 데이터 */
export interface BomFormData {
  parentItemCode: string;
  childItemCode: string;
  qtyPer: number;
  seq?: number;
  revision?: string;
  bomGrp?: string;
  processCode?: string;
  side?: string;
  validFrom?: string;
  validTo?: string;
  remark?: string;
  useYn?: string;
}
