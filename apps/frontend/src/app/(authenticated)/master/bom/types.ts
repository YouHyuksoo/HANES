/**
 * @file src/app/(authenticated)/master/bom/types.ts
 * @description BOM 관련 타입 정의 - Oracle TM_BOM 기준
 *
 * 초보자 가이드:
 * 1. **ParentPart**: BOM 모품목(부모품목) - API에서 조회
 * 2. **BomTreeItem**: BOM 계층 트리 아이템 - hierarchy API 응답
 * 3. **RoutingTarget**: BOM에서 라우팅관리 화면으로 이동 시 대상 정보
 */

export interface ParentPart {
  itemCode: string;
  itemName: string;
  itemNo?: string;
  itemType: string;
  spec?: string;
  unit?: string;
  customer?: string;
  remark?: string;
  bomCount: number;
  validFrom?: string | null;
  validTo?: string | null;
  /** 해당 모품목의 BOM 리비전 목록 (예: ['A', 'B']) */
  revisions: string[];
}

export interface BomItem {
  bomKey: string;
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
  bomKey: string;
  level: number;
  parentItemCode?: string;
  itemCode: string;
  itemNo?: string | null;
  itemName: string;
  itemType: string;
  qtyPer: number;
  unit: string;
  revision: string;
  seq: number;
  processCode?: string;
  processName?: string | null;
  side?: string;
  validFrom?: string;
  validTo?: string;
  useYn: string;
  childItemCode?: string;
  children?: BomTreeItem[];
  isRoot?: boolean;
}

import { formatDateOnly } from "@/utils/date";

/** BOM 복합키: parent::child::validFrom(YYYY-MM-DD) — DB PK(모+자+적용일자)와 동일 */
export const getBomKey = (
  item: Pick<BomTreeItem, "bomKey" | "parentItemCode" | "itemCode" | "childItemCode" | "validFrom" | "isRoot">,
) =>
  item.bomKey || (item.isRoot ? `ROOT::${item.itemCode}` : `${item.parentItemCode || item.itemCode}::${item.childItemCode || item.itemCode}::${formatDateOnly(item.validFrom)}`);

/** BOM에서 라우팅관리 화면으로 연결할 때 사용하는 타겟 정보 */
export interface RoutingTarget {
  itemCode: string;
  itemName: string;
  itemType: string;
  breadcrumb?: string;
}

export interface BomRoutingProcess {
  routingCode: string;
  seq: number;
  processCode: string;
  processName: string;
  processType?: string | null;
  equipType?: string | null;
  stdTime?: number | null;
  setupTime?: number | null;
  useYn: string;
}

export interface BomRoutingInfo {
  routingCode: string;
  routingName: string;
  itemCode: string | null;
  description?: string | null;
  useYn: string;
  processes?: BomRoutingProcess[];
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
