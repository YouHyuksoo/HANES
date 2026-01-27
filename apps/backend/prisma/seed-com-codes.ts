/**
 * @file prisma/seed-com-codes.ts
 * @description ComCode 테이블 시드 데이터 - 모든 모듈의 상태/유형 코드를 중앙 관리
 *
 * 초보자 가이드:
 * 1. **실행 방법**: `pnpm db:seed` 또는 `npx prisma db seed`
 * 2. **구조**: groupCode(대분류) + detailCode(상세코드)
 * 3. **attr1**: Tailwind CSS 배지 색상 클래스
 * 4. **attr3**: 영어 라벨
 * 5. **확장 시**: codes 배열에 새 항목 추가 후 seed 재실행
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedCode {
  groupCode: string;
  detailCode: string;
  codeName: string;
  codeDesc?: string;
  sortOrder: number;
  attr1?: string; // Tailwind CSS 색상 클래스
  attr2?: string; // 아이콘 이름 (lucide-react)
  attr3?: string; // 영어 라벨
}

const codes: SeedCode[] = [
  // ===== 작업지시 상태 (JOB_ORDER_STATUS) =====
  { groupCode: 'JOB_ORDER_STATUS', detailCode: 'WAITING', codeName: '대기', sortOrder: 1, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr2: 'Clock', attr3: 'Waiting' },
  { groupCode: 'JOB_ORDER_STATUS', detailCode: 'RUNNING', codeName: '진행중', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr2: 'PlayCircle', attr3: 'Running' },
  { groupCode: 'JOB_ORDER_STATUS', detailCode: 'PAUSED', codeName: '일시정지', sortOrder: 3, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr2: 'PauseCircle', attr3: 'Paused' },
  { groupCode: 'JOB_ORDER_STATUS', detailCode: 'DONE', codeName: '완료', sortOrder: 4, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr2: 'CheckCircle', attr3: 'Done' },
  { groupCode: 'JOB_ORDER_STATUS', detailCode: 'CANCELED', codeName: '취소', sortOrder: 5, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr2: 'XCircle', attr3: 'Canceled' },

  // ===== 작업지시 유형 (JOB_ORDER_TYPE) =====
  { groupCode: 'JOB_ORDER_TYPE', detailCode: 'NORMAL', codeName: '일반', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Normal' },
  { groupCode: 'JOB_ORDER_TYPE', detailCode: 'REWORK', codeName: '재작업', sortOrder: 2, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Rework' },
  { groupCode: 'JOB_ORDER_TYPE', detailCode: 'SAMPLE', codeName: '샘플', sortOrder: 3, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Sample' },
  { groupCode: 'JOB_ORDER_TYPE', detailCode: 'TRIAL', codeName: '시험', sortOrder: 4, attr1: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300', attr3: 'Trial' },

  // ===== 반제품 상태 (SEMI_PRODUCT_STATUS) =====
  { groupCode: 'SEMI_PRODUCT_STATUS', detailCode: 'WAITING', codeName: '대기', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr2: 'Clock', attr3: 'Waiting' },
  { groupCode: 'SEMI_PRODUCT_STATUS', detailCode: 'IN_PROGRESS', codeName: '진행중', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr2: 'PlayCircle', attr3: 'In Progress' },
  { groupCode: 'SEMI_PRODUCT_STATUS', detailCode: 'COMPLETED', codeName: '완료', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr2: 'CheckCircle', attr3: 'Completed' },
  { groupCode: 'SEMI_PRODUCT_STATUS', detailCode: 'MOVED', codeName: '이동완료', sortOrder: 4, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr2: 'ArrowRight', attr3: 'Moved' },

  // ===== BOX 상태 (BOX_STATUS) =====
  { groupCode: 'BOX_STATUS', detailCode: 'OPEN', codeName: '진행중', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Open' },
  { groupCode: 'BOX_STATUS', detailCode: 'CLOSED', codeName: '마감', sortOrder: 2, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Closed' },
  { groupCode: 'BOX_STATUS', detailCode: 'SHIPPED', codeName: '출하', sortOrder: 3, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Shipped' },

  // ===== 팔레트 상태 (PALLET_STATUS) =====
  { groupCode: 'PALLET_STATUS', detailCode: 'OPEN', codeName: '진행중', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Open' },
  { groupCode: 'PALLET_STATUS', detailCode: 'CLOSED', codeName: '마감', sortOrder: 2, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Closed' },
  { groupCode: 'PALLET_STATUS', detailCode: 'LOADED', codeName: '적재', sortOrder: 3, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Loaded' },
  { groupCode: 'PALLET_STATUS', detailCode: 'SHIPPED', codeName: '출하', sortOrder: 4, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Shipped' },

  // ===== 출하 상태 (SHIPMENT_STATUS) =====
  { groupCode: 'SHIPMENT_STATUS', detailCode: 'PREPARING', codeName: '준비중', sortOrder: 1, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Preparing' },
  { groupCode: 'SHIPMENT_STATUS', detailCode: 'LOADED', codeName: '상차', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Loaded' },
  { groupCode: 'SHIPMENT_STATUS', detailCode: 'SHIPPED', codeName: '출하', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Shipped' },
  { groupCode: 'SHIPMENT_STATUS', detailCode: 'DELIVERED', codeName: '배송완료', sortOrder: 4, attr1: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', attr3: 'Delivered' },
  { groupCode: 'SHIPMENT_STATUS', detailCode: 'CANCELED', codeName: '취소', sortOrder: 5, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Canceled' },

  // ===== 입하 상태 (RECEIVE_STATUS) =====
  { groupCode: 'RECEIVE_STATUS', detailCode: 'PENDING', codeName: '입하대기', sortOrder: 1, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Pending' },
  { groupCode: 'RECEIVE_STATUS', detailCode: 'IQC_IN_PROGRESS', codeName: 'IQC진행', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'IQC In Progress' },
  { groupCode: 'RECEIVE_STATUS', detailCode: 'PASSED', codeName: '합격', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Passed' },
  { groupCode: 'RECEIVE_STATUS', detailCode: 'FAILED', codeName: '불합격', sortOrder: 4, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Failed' },

  // ===== 출고 상태 (ISSUE_STATUS) =====
  { groupCode: 'ISSUE_STATUS', detailCode: 'PENDING', codeName: '대기', sortOrder: 1, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Pending' },
  { groupCode: 'ISSUE_STATUS', detailCode: 'IN_PROGRESS', codeName: '진행중', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'In Progress' },
  { groupCode: 'ISSUE_STATUS', detailCode: 'COMPLETED', codeName: '완료', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Completed' },

  // ===== 설비 상태 (EQUIP_STATUS) =====
  { groupCode: 'EQUIP_STATUS', detailCode: 'NORMAL', codeName: '정상', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr2: 'CheckCircle', attr3: 'Normal' },
  { groupCode: 'EQUIP_STATUS', detailCode: 'MAINT', codeName: '점검', sortOrder: 2, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr2: 'AlertTriangle', attr3: 'Maintenance' },
  { groupCode: 'EQUIP_STATUS', detailCode: 'STOP', codeName: '정지', sortOrder: 3, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr2: 'XCircle', attr3: 'Stopped' },

  // ===== 설비 PM 상태 (PM_STATUS) =====
  { groupCode: 'PM_STATUS', detailCode: 'SCHEDULED', codeName: '예정', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Scheduled' },
  { groupCode: 'PM_STATUS', detailCode: 'IN_PROGRESS', codeName: '진행중', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'In Progress' },
  { groupCode: 'PM_STATUS', detailCode: 'COMPLETED', codeName: '완료', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Completed' },
  { groupCode: 'PM_STATUS', detailCode: 'OVERDUE', codeName: '지연', sortOrder: 4, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Overdue' },

  // ===== 불량 상태 (DEFECT_STATUS) =====
  { groupCode: 'DEFECT_STATUS', detailCode: 'PENDING', codeName: '수리대기', sortOrder: 1, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr2: 'AlertTriangle', attr3: 'Pending' },
  { groupCode: 'DEFECT_STATUS', detailCode: 'REPAIRING', codeName: '수리중', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr2: 'Wrench', attr3: 'Repairing' },
  { groupCode: 'DEFECT_STATUS', detailCode: 'COMPLETED', codeName: '완료', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr2: 'CheckCircle', attr3: 'Completed' },
  { groupCode: 'DEFECT_STATUS', detailCode: 'SCRAPPED', codeName: '폐기', sortOrder: 4, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr2: 'Trash2', attr3: 'Scrapped' },

  // ===== 불량 처리 유형 (DEFECT_DISPOSITION) =====
  { groupCode: 'DEFECT_DISPOSITION', detailCode: 'REPAIR', codeName: '수리', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Repair' },
  { groupCode: 'DEFECT_DISPOSITION', detailCode: 'REWORK', codeName: '재작업', sortOrder: 2, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Rework' },
  { groupCode: 'DEFECT_DISPOSITION', detailCode: 'SCRAP', codeName: '폐기', sortOrder: 3, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Scrap' },
  { groupCode: 'DEFECT_DISPOSITION', detailCode: 'CONCESSION', codeName: '특채', sortOrder: 4, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Concession' },

  // ===== 검사 결과 (INSPECT_RESULT) =====
  { groupCode: 'INSPECT_RESULT', detailCode: 'PASS', codeName: '합격', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr2: 'CheckCircle', attr3: 'Pass' },
  { groupCode: 'INSPECT_RESULT', detailCode: 'FAIL', codeName: '불합격', sortOrder: 2, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr2: 'XCircle', attr3: 'Fail' },

  // ===== 검사 유형 (INSPECT_TYPE) =====
  { groupCode: 'INSPECT_TYPE', detailCode: 'CONTINUITY', codeName: '도통', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Continuity' },
  { groupCode: 'INSPECT_TYPE', detailCode: 'INSULATION', codeName: '절연', sortOrder: 2, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Insulation' },
  { groupCode: 'INSPECT_TYPE', detailCode: 'HI_POT', codeName: '내압', sortOrder: 3, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Hi-Pot' },
  { groupCode: 'INSPECT_TYPE', detailCode: 'VISUAL', codeName: '외관', sortOrder: 4, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Visual' },

  // ===== IQC 검사 유형 (IQC_TYPE) =====
  { groupCode: 'IQC_TYPE', detailCode: 'IQC', codeName: '수입검사', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'IQC' },
  { groupCode: 'IQC_TYPE', detailCode: 'PQC', codeName: '공정검사', sortOrder: 2, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'PQC' },
  { groupCode: 'IQC_TYPE', detailCode: 'FQC', codeName: '최종검사', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'FQC' },
  { groupCode: 'IQC_TYPE', detailCode: 'OQC', codeName: '출하검사', sortOrder: 4, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'OQC' },

  // ===== 품질 판정 (QUALITY_JUDGMENT) =====
  { groupCode: 'QUALITY_JUDGMENT', detailCode: 'PASS', codeName: '합격', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Pass' },
  { groupCode: 'QUALITY_JUDGMENT', detailCode: 'FAIL', codeName: '불합격', sortOrder: 2, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Fail' },
  { groupCode: 'QUALITY_JUDGMENT', detailCode: 'PENDING', codeName: '판정대기', sortOrder: 3, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Pending' },
  { groupCode: 'QUALITY_JUDGMENT', detailCode: 'CONDITIONAL', codeName: '조건부합격', sortOrder: 4, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Conditional' },

  // ===== 승인 상태 (APPROVAL_STATUS) =====
  { groupCode: 'APPROVAL_STATUS', detailCode: 'PENDING', codeName: '승인대기', sortOrder: 1, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Pending' },
  { groupCode: 'APPROVAL_STATUS', detailCode: 'APPROVED', codeName: '승인', sortOrder: 2, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Approved' },
  { groupCode: 'APPROVAL_STATUS', detailCode: 'REJECTED', codeName: '반려', sortOrder: 3, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Rejected' },

  // ===== 인터페이스 상태 (INTERFACE_STATUS) =====
  { groupCode: 'INTERFACE_STATUS', detailCode: 'PENDING', codeName: '전송대기', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Pending' },
  { groupCode: 'INTERFACE_STATUS', detailCode: 'SENT', codeName: '전송완료', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Sent' },
  { groupCode: 'INTERFACE_STATUS', detailCode: 'FAILED', codeName: '전송실패', sortOrder: 3, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Failed' },
  { groupCode: 'INTERFACE_STATUS', detailCode: 'CONFIRMED', codeName: '확인완료', sortOrder: 4, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Confirmed' },

  // ===== 검사기 연결 상태 (CONNECTION_STATUS) =====
  { groupCode: 'CONNECTION_STATUS', detailCode: 'CONNECTED', codeName: '연결됨', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr2: 'Wifi', attr3: 'Connected' },
  { groupCode: 'CONNECTION_STATUS', detailCode: 'DISCONNECTED', codeName: '연결끊김', sortOrder: 2, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr2: 'WifiOff', attr3: 'Disconnected' },
  { groupCode: 'CONNECTION_STATUS', detailCode: 'ERROR', codeName: '오류', sortOrder: 3, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr2: 'AlertTriangle', attr3: 'Error' },

  // ===== 공정 유형 (PROCESS_TYPE) =====
  { groupCode: 'PROCESS_TYPE', detailCode: 'CUTTING', codeName: '절단', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Cutting' },
  { groupCode: 'PROCESS_TYPE', detailCode: 'CRIMPING', codeName: '압착', sortOrder: 2, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Crimping' },
  { groupCode: 'PROCESS_TYPE', detailCode: 'ASSEMBLY', codeName: '조립', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Assembly' },
  { groupCode: 'PROCESS_TYPE', detailCode: 'INSPECTION', codeName: '검사', sortOrder: 4, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Inspection' },
  { groupCode: 'PROCESS_TYPE', detailCode: 'PACKING', codeName: '포장', sortOrder: 5, attr1: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', attr3: 'Packing' },

  // ===== 품목 유형 (ITEM_TYPE) =====
  { groupCode: 'ITEM_TYPE', detailCode: 'RAW_MATERIAL', codeName: '원자재', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Raw Material' },
  { groupCode: 'ITEM_TYPE', detailCode: 'SEMI_PRODUCT', codeName: '반제품', sortOrder: 2, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Semi Product' },
  { groupCode: 'ITEM_TYPE', detailCode: 'FINISHED', codeName: '완제품', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Finished' },
  { groupCode: 'ITEM_TYPE', detailCode: 'CONSUMABLE', codeName: '소모품', sortOrder: 4, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Consumable' },

  // ===== BOM 유형 (BOM_TYPE) =====
  { groupCode: 'BOM_TYPE', detailCode: 'PRODUCTION', codeName: '생산용', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Production' },
  { groupCode: 'BOM_TYPE', detailCode: 'STANDARD', codeName: '표준', sortOrder: 2, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Standard' },
  { groupCode: 'BOM_TYPE', detailCode: 'ENGINEERING', codeName: '설계용', sortOrder: 3, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Engineering' },

  // ===== 창고 유형 (WAREHOUSE_TYPE) =====
  { groupCode: 'WAREHOUSE_TYPE', detailCode: 'RAW_MATERIAL', codeName: '원자재', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Raw Material' },
  { groupCode: 'WAREHOUSE_TYPE', detailCode: 'WIP', codeName: '재공품', sortOrder: 2, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'WIP' },
  { groupCode: 'WAREHOUSE_TYPE', detailCode: 'FINISHED', codeName: '완제품', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Finished' },
  { groupCode: 'WAREHOUSE_TYPE', detailCode: 'MRB', codeName: '불량품 격리', sortOrder: 4, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'MRB' },
  { groupCode: 'WAREHOUSE_TYPE', detailCode: 'HOLD', codeName: '보류', sortOrder: 5, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Hold' },

  // ===== 재고 이동 유형 (INVENTORY_MOVE_TYPE) =====
  { groupCode: 'INVENTORY_MOVE_TYPE', detailCode: 'RECEIPT', codeName: '입고', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Receipt' },
  { groupCode: 'INVENTORY_MOVE_TYPE', detailCode: 'ISSUE', codeName: '출고', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Issue' },
  { groupCode: 'INVENTORY_MOVE_TYPE', detailCode: 'TRANSFER', codeName: '이동', sortOrder: 3, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Transfer' },
  { groupCode: 'INVENTORY_MOVE_TYPE', detailCode: 'ADJUSTMENT', codeName: '조정', sortOrder: 4, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Adjustment' },
  { groupCode: 'INVENTORY_MOVE_TYPE', detailCode: 'SCRAP', codeName: '폐기', sortOrder: 5, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Scrap' },

  // ===== 금형 상태 (MOLD_STATUS) =====
  { groupCode: 'MOLD_STATUS', detailCode: 'ACTIVE', codeName: '사용중', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Active' },
  { groupCode: 'MOLD_STATUS', detailCode: 'INACTIVE', codeName: '미사용', sortOrder: 2, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Inactive' },
  { groupCode: 'MOLD_STATUS', detailCode: 'REPAIR', codeName: '수리중', sortOrder: 3, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Under Repair' },
  { groupCode: 'MOLD_STATUS', detailCode: 'SCRAPPED', codeName: '폐기', sortOrder: 4, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Scrapped' },

  // ===== 일반 상태 (GENERAL_STATUS) =====
  { groupCode: 'GENERAL_STATUS', detailCode: 'ACTIVE', codeName: '활성', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Active' },
  { groupCode: 'GENERAL_STATUS', detailCode: 'INACTIVE', codeName: '비활성', sortOrder: 2, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Inactive' },

  // ===== 사용여부 (USE_YN) =====
  { groupCode: 'USE_YN', detailCode: 'Y', codeName: '사용', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Yes' },
  { groupCode: 'USE_YN', detailCode: 'N', codeName: '미사용', sortOrder: 2, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'No' },
];

async function seedComCodes() {
  console.log('공통코드 시드 데이터 삽입을 시작합니다...');

  let created = 0;
  let skipped = 0;

  for (const code of codes) {
    try {
      await prisma.comCode.upsert({
        where: {
          groupCode_detailCode: {
            groupCode: code.groupCode,
            detailCode: code.detailCode,
          },
        },
        update: {
          codeName: code.codeName,
          codeDesc: code.codeDesc,
          sortOrder: code.sortOrder,
          attr1: code.attr1,
          attr2: code.attr2,
          attr3: code.attr3,
          useYn: 'Y',
        },
        create: {
          groupCode: code.groupCode,
          detailCode: code.detailCode,
          codeName: code.codeName,
          codeDesc: code.codeDesc,
          sortOrder: code.sortOrder,
          useYn: 'Y',
          attr1: code.attr1,
          attr2: code.attr2,
          attr3: code.attr3,
        },
      });
      created++;
    } catch (error) {
      console.error(`[SKIP] ${code.groupCode}.${code.detailCode}: ${error}`);
      skipped++;
    }
  }

  console.log(`공통코드 시드 완료: ${created}개 생성/업데이트, ${skipped}개 스킵`);
}

export { seedComCodes };
