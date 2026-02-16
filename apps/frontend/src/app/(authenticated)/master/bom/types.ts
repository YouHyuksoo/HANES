/**
 * @file src/app/(authenticated)/master/bom/types.ts
 * @description BOM/Routing 관련 타입 정의 - Oracle TM_BOM 기준 보강
 *
 * 초보자 가이드:
 * 1. **ParentPart**: BOM 모품목(부모품목) - API에서 조회
 * 2. **BomTreeItem**: BOM 계층 트리 아이템 - hierarchy API 응답
 * 3. **RoutingGroup/RoutingItem**: 라우팅 관련 (별도 관리)
 */

export interface ParentPart {
  id: string;
  partCode: string;
  partName: string;
  partNo?: string;
  partType: string;
  bomCount: number;
}

export interface BomItem {
  id: string;
  childPartCode: string;
  childPartName: string;
  childPartType: string;
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
  partCode: string;
  partNo?: string | null;
  partName: string;
  partType: "FG" | "WIP" | "RAW";
  qtyPer: number;
  unit: string;
  revision: string;
  seq: number;
  processCode?: string;
  side?: string;
  validFrom?: string;
  validTo?: string;
  useYn: string;
  childPartId?: string;
  children?: BomTreeItem[];
}

/** 라우팅 그룹 내 개별 공정 단계 */
export interface RoutingItem {
  id: string;
  seq: number;
  processCode: string;
  processName: string;
  processType: string;
  equipType?: string;
  stdTime?: number;
  setupTime?: number;
  useYn: string;
}

/** 라우팅 그룹 (공정들의 묶음) - BOM 아이템에 이 그룹을 연결 */
export interface RoutingGroup {
  id: string;
  routingCode: string;
  routingName: string;
  steps: RoutingItem[];
  useYn: string;
}

/** BOM에서 라우팅 탭으로 연결할 때 사용하는 타겟 정보 */
export interface RoutingTarget {
  partCode: string;
  partName: string;
  partType: string;
  breadcrumb?: string;
}
