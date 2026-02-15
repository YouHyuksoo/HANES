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
  // ===== 공정 유형 단축코드 (PROCESS_TYPE) - 생산 작업지시용 =====
  { groupCode: 'PROCESS_TYPE', detailCode: 'CUT', codeName: '절단', sortOrder: 11, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Cutting' },
  { groupCode: 'PROCESS_TYPE', detailCode: 'CRIMP', codeName: '압착', sortOrder: 12, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Crimping' },
  { groupCode: 'PROCESS_TYPE', detailCode: 'ASSY', codeName: '조립', sortOrder: 13, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Assembly' },
  { groupCode: 'PROCESS_TYPE', detailCode: 'INSP', codeName: '검사', sortOrder: 14, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Inspection' },
  { groupCode: 'PROCESS_TYPE', detailCode: 'PACK', codeName: '포장', sortOrder: 15, attr1: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', attr3: 'Packing' },

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

  // ===== 공장/조직 유형 (PLANT_TYPE) =====
  { groupCode: 'PLANT_TYPE', detailCode: 'PLANT', codeName: '공장', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Plant' },
  { groupCode: 'PLANT_TYPE', detailCode: 'SHOP', codeName: '작업장', sortOrder: 2, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Shop' },
  { groupCode: 'PLANT_TYPE', detailCode: 'LINE', codeName: '라인', sortOrder: 3, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Line' },
  { groupCode: 'PLANT_TYPE', detailCode: 'CELL', codeName: '셀', sortOrder: 4, attr1: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', attr3: 'Cell' },

  // ===== 품목 분류 (PART_TYPE) =====
  { groupCode: 'PART_TYPE', detailCode: 'RAW', codeName: '원자재', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Raw Material' },
  { groupCode: 'PART_TYPE', detailCode: 'WIP', codeName: '반제품', sortOrder: 2, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'WIP' },
  { groupCode: 'PART_TYPE', detailCode: 'FG', codeName: '완제품', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Finished Goods' },

  // ===== 거래처 유형 (PARTNER_TYPE) =====
  { groupCode: 'PARTNER_TYPE', detailCode: 'SUPPLIER', codeName: '공급사', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Supplier' },
  { groupCode: 'PARTNER_TYPE', detailCode: 'CUSTOMER', codeName: '고객사', sortOrder: 2, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Customer' },

  // ===== 협력사 유형 (VENDOR_TYPE) =====
  { groupCode: 'VENDOR_TYPE', detailCode: 'SUBCON', codeName: '외주사', sortOrder: 1, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Subcontractor' },
  { groupCode: 'VENDOR_TYPE', detailCode: 'SUPPLIER', codeName: '공급사', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Supplier' },

  // ===== 창고 유형 DTO (WAREHOUSE_TYPE_DTO) =====
  { groupCode: 'WAREHOUSE_TYPE_DTO', detailCode: 'RAW', codeName: '원자재', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Raw Material' },
  { groupCode: 'WAREHOUSE_TYPE_DTO', detailCode: 'WIP', codeName: '반제품', sortOrder: 2, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'WIP' },
  { groupCode: 'WAREHOUSE_TYPE_DTO', detailCode: 'FG', codeName: '완제품', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Finished Goods' },
  { groupCode: 'WAREHOUSE_TYPE_DTO', detailCode: 'FLOOR', codeName: '현장', sortOrder: 4, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Floor' },
  { groupCode: 'WAREHOUSE_TYPE_DTO', detailCode: 'DEFECT', codeName: '불량', sortOrder: 5, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Defect' },
  { groupCode: 'WAREHOUSE_TYPE_DTO', detailCode: 'SCRAP', codeName: '폐기', sortOrder: 6, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Scrap' },
  { groupCode: 'WAREHOUSE_TYPE_DTO', detailCode: 'SUBCON', codeName: '외주', sortOrder: 7, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Subcontractor' },

  // ===== IQC 상태 (IQC_STATUS) =====
  { groupCode: 'IQC_STATUS', detailCode: 'PENDING', codeName: '대기', sortOrder: 1, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Pending' },
  { groupCode: 'IQC_STATUS', detailCode: 'PASS', codeName: '합격', sortOrder: 2, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Pass' },
  { groupCode: 'IQC_STATUS', detailCode: 'FAIL', codeName: '불합격', sortOrder: 3, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Fail' },
  { groupCode: 'IQC_STATUS', detailCode: 'HOLD', codeName: '보류', sortOrder: 4, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Hold' },

  // ===== 자재 LOT 상태 (MAT_LOT_STATUS) =====
  { groupCode: 'MAT_LOT_STATUS', detailCode: 'NORMAL', codeName: '정상', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Normal' },
  { groupCode: 'MAT_LOT_STATUS', detailCode: 'HOLD', codeName: '보류', sortOrder: 2, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Hold' },
  { groupCode: 'MAT_LOT_STATUS', detailCode: 'DEPLETED', codeName: '소진', sortOrder: 3, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Depleted' },

  // ===== 출고 유형 (ISSUE_TYPE) =====
  { groupCode: 'ISSUE_TYPE', detailCode: 'PROD', codeName: '생산', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Production' },
  { groupCode: 'ISSUE_TYPE', detailCode: 'SUBCON', codeName: '외주', sortOrder: 2, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Subcontract' },
  { groupCode: 'ISSUE_TYPE', detailCode: 'SAMPLE', codeName: '샘플', sortOrder: 3, attr1: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300', attr3: 'Sample' },
  { groupCode: 'ISSUE_TYPE', detailCode: 'ADJ', codeName: '조정', sortOrder: 4, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Adjustment' },

  // ===== 재고 트랜잭션 유형 (TRANSACTION_TYPE) =====
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'MAT_IN', codeName: '자재입고', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Material In' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'MAT_IN_CANCEL', codeName: '자재입고취소', sortOrder: 2, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Material In Cancel' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'MAT_OUT', codeName: '자재출고', sortOrder: 3, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Material Out' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'MAT_OUT_CANCEL', codeName: '자재출고취소', sortOrder: 4, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Material Out Cancel' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'WIP_IN', codeName: '반제품입고', sortOrder: 5, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'WIP In' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'WIP_IN_CANCEL', codeName: '반제품입고취소', sortOrder: 6, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'WIP In Cancel' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'WIP_OUT', codeName: '반제품출고', sortOrder: 7, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'WIP Out' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'WIP_OUT_CANCEL', codeName: '반제품출고취소', sortOrder: 8, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'WIP Out Cancel' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'FG_IN', codeName: '완제품입고', sortOrder: 9, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'FG In' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'FG_IN_CANCEL', codeName: '완제품입고취소', sortOrder: 10, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'FG In Cancel' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'FG_OUT', codeName: '완제품출고', sortOrder: 11, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'FG Out' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'FG_OUT_CANCEL', codeName: '완제품출고취소', sortOrder: 12, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'FG Out Cancel' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'SUBCON_OUT', codeName: '외주출고', sortOrder: 13, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Subcon Out' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'SUBCON_OUT_CANCEL', codeName: '외주출고취소', sortOrder: 14, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Subcon Out Cancel' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'SUBCON_IN', codeName: '외주입고', sortOrder: 15, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Subcon In' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'SUBCON_IN_CANCEL', codeName: '외주입고취소', sortOrder: 16, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Subcon In Cancel' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'PROD_CONSUME', codeName: '생산소비', sortOrder: 17, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Production Consume' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'PROD_CONSUME_CANCEL', codeName: '생산소비취소', sortOrder: 18, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Production Consume Cancel' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'TRANSFER', codeName: '이동', sortOrder: 19, attr1: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300', attr3: 'Transfer' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'TRANSFER_CANCEL', codeName: '이동취소', sortOrder: 20, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Transfer Cancel' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'ADJ_PLUS', codeName: '조정(+)', sortOrder: 21, attr1: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', attr3: 'Adjustment Plus' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'ADJ_MINUS', codeName: '조정(-)', sortOrder: 22, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Adjustment Minus' },
  { groupCode: 'TRANSACTION_TYPE', detailCode: 'SCRAP', codeName: '폐기', sortOrder: 23, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Scrap' },

  // ===== 참조 유형 (REF_TYPE) =====
  { groupCode: 'REF_TYPE', detailCode: 'JOB_ORDER', codeName: '작업지시', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Job Order' },
  { groupCode: 'REF_TYPE', detailCode: 'SUBCON_ORDER', codeName: '외주발주', sortOrder: 2, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Subcon Order' },
  { groupCode: 'REF_TYPE', detailCode: 'SHIPMENT', codeName: '출하', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Shipment' },
  { groupCode: 'REF_TYPE', detailCode: 'CUSTOMS', codeName: '통관', sortOrder: 4, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Customs' },
  { groupCode: 'REF_TYPE', detailCode: 'ADJUST', codeName: '조정', sortOrder: 5, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Adjustment' },
  { groupCode: 'REF_TYPE', detailCode: 'PROD_RESULT', codeName: '생산실적', sortOrder: 6, attr1: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', attr3: 'Production Result' },

  // ===== 생산실적 상태 (PROD_RESULT_STATUS) =====
  { groupCode: 'PROD_RESULT_STATUS', detailCode: 'RUNNING', codeName: '진행중', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Running' },
  { groupCode: 'PROD_RESULT_STATUS', detailCode: 'DONE', codeName: '완료', sortOrder: 2, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Done' },
  { groupCode: 'PROD_RESULT_STATUS', detailCode: 'CANCELED', codeName: '취소', sortOrder: 3, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Canceled' },

  // ===== 불량 로그 상태 (DEFECT_LOG_STATUS) =====
  { groupCode: 'DEFECT_LOG_STATUS', detailCode: 'WAIT', codeName: '대기', sortOrder: 1, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Wait' },
  { groupCode: 'DEFECT_LOG_STATUS', detailCode: 'REPAIR', codeName: '수리', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Repair' },
  { groupCode: 'DEFECT_LOG_STATUS', detailCode: 'REWORK', codeName: '재작업', sortOrder: 3, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Rework' },
  { groupCode: 'DEFECT_LOG_STATUS', detailCode: 'SCRAP', codeName: '폐기', sortOrder: 4, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Scrap' },
  { groupCode: 'DEFECT_LOG_STATUS', detailCode: 'DONE', codeName: '완료', sortOrder: 5, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Done' },

  // ===== 수리 결과 (REPAIR_RESULT) =====
  { groupCode: 'REPAIR_RESULT', detailCode: 'PASS', codeName: '합격', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Pass' },
  { groupCode: 'REPAIR_RESULT', detailCode: 'FAIL', codeName: '불합격', sortOrder: 2, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Fail' },
  { groupCode: 'REPAIR_RESULT', detailCode: 'SCRAP', codeName: '폐기', sortOrder: 3, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Scrap' },

  // ===== 설비 유형 (EQUIP_TYPE) =====
  { groupCode: 'EQUIP_TYPE', detailCode: 'CUTTING', codeName: '절단설비', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Cutting Equipment' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'CRIMPING', codeName: '압착설비', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Crimping Equipment' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'ASSEMBLY', codeName: '조립설비', sortOrder: 3, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Assembly Equipment' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'AUTO_CRIMP', codeName: '자동압착기', sortOrder: 4, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Auto Crimper' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'SINGLE_CUT', codeName: '단선절단기', sortOrder: 5, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Single Cutter' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'MULTI_CUT', codeName: '다선절단기', sortOrder: 6, attr1: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', attr3: 'Multi Cutter' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'TWIST', codeName: '트위스트기', sortOrder: 7, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Twister' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'SOLDER', codeName: '솔더링기', sortOrder: 8, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Soldering' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'HOUSING', codeName: '하우징기', sortOrder: 9, attr1: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300', attr3: 'Housing' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'TESTER', codeName: '검사기', sortOrder: 10, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Tester' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'LABEL_PRINTER', codeName: '라벨프린터', sortOrder: 11, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Label Printer' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'INSPECTION', codeName: '검사설비', sortOrder: 12, attr1: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', attr3: 'Inspection' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'PACKING', codeName: '포장기', sortOrder: 13, attr1: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', attr3: 'Packing' },
  { groupCode: 'EQUIP_TYPE', detailCode: 'OTHER', codeName: '기타', sortOrder: 14, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Other' },

  // ===== 소모품 상태 (CONSUMABLE_STATUS) =====
  { groupCode: 'CONSUMABLE_STATUS', detailCode: 'NORMAL', codeName: '정상', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Normal' },
  { groupCode: 'CONSUMABLE_STATUS', detailCode: 'WARNING', codeName: '경고', sortOrder: 2, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Warning' },
  { groupCode: 'CONSUMABLE_STATUS', detailCode: 'REPLACE', codeName: '교체필요', sortOrder: 3, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Replace' },

  // ===== 소모품 카테고리 (CONSUMABLE_CATEGORY) =====
  { groupCode: 'CONSUMABLE_CATEGORY', detailCode: 'MOLD', codeName: '금형', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Mold' },
  { groupCode: 'CONSUMABLE_CATEGORY', detailCode: 'JIG', codeName: '지그', sortOrder: 2, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Jig' },
  { groupCode: 'CONSUMABLE_CATEGORY', detailCode: 'TOOL', codeName: '공구', sortOrder: 3, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Tool' },

  // ===== 소모품 이력 유형 (CONSUMABLE_LOG_TYPE) =====
  { groupCode: 'CONSUMABLE_LOG_TYPE', detailCode: 'IN', codeName: '입고', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'In' },
  { groupCode: 'CONSUMABLE_LOG_TYPE', detailCode: 'IN_RETURN', codeName: '입고반품', sortOrder: 2, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'In Return' },
  { groupCode: 'CONSUMABLE_LOG_TYPE', detailCode: 'OUT', codeName: '출고', sortOrder: 3, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Out' },
  { groupCode: 'CONSUMABLE_LOG_TYPE', detailCode: 'OUT_RETURN', codeName: '출고반품', sortOrder: 4, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Out Return' },

  // ===== 소모품 이력 유형 그룹 (CONSUMABLE_LOG_TYPE_GROUP) =====
  { groupCode: 'CONSUMABLE_LOG_TYPE_GROUP', detailCode: 'RECEIVING', codeName: '입고', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Receiving' },
  { groupCode: 'CONSUMABLE_LOG_TYPE_GROUP', detailCode: 'ISSUING', codeName: '출고', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Issuing' },

  // ===== 소모품 입고 구분 (INCOMING_TYPE) =====
  { groupCode: 'INCOMING_TYPE', detailCode: 'NEW', codeName: '신규', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'New' },
  { groupCode: 'INCOMING_TYPE', detailCode: 'REPLACEMENT', codeName: '교체', sortOrder: 2, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Replacement' },

  // ===== 소모품 출고 사유 (ISSUE_REASON) =====
  { groupCode: 'ISSUE_REASON', detailCode: 'PRODUCTION', codeName: '생산', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Production' },
  { groupCode: 'ISSUE_REASON', detailCode: 'REPAIR', codeName: '수리', sortOrder: 2, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Repair' },
  { groupCode: 'ISSUE_REASON', detailCode: 'OTHER', codeName: '기타', sortOrder: 3, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Other' },

  // ===== 통관 입항 상태 (CUSTOMS_ENTRY_STATUS) =====
  { groupCode: 'CUSTOMS_ENTRY_STATUS', detailCode: 'PENDING', codeName: '대기', sortOrder: 1, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Pending' },
  { groupCode: 'CUSTOMS_ENTRY_STATUS', detailCode: 'CLEARED', codeName: '통관', sortOrder: 2, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Cleared' },
  { groupCode: 'CUSTOMS_ENTRY_STATUS', detailCode: 'RELEASED', codeName: '반출', sortOrder: 3, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Released' },

  // ===== 통관 LOT 상태 (CUSTOMS_LOT_STATUS) =====
  { groupCode: 'CUSTOMS_LOT_STATUS', detailCode: 'BONDED', codeName: '보세', sortOrder: 1, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Bonded' },
  { groupCode: 'CUSTOMS_LOT_STATUS', detailCode: 'PARTIAL', codeName: '일부반출', sortOrder: 2, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Partial' },
  { groupCode: 'CUSTOMS_LOT_STATUS', detailCode: 'RELEASED', codeName: '반출', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Released' },

  // ===== 사용보고서 상태 (USAGE_REPORT_STATUS) =====
  { groupCode: 'USAGE_REPORT_STATUS', detailCode: 'DRAFT', codeName: '초안', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Draft' },
  { groupCode: 'USAGE_REPORT_STATUS', detailCode: 'REPORTED', codeName: '보고', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Reported' },
  { groupCode: 'USAGE_REPORT_STATUS', detailCode: 'CONFIRMED', codeName: '확인', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Confirmed' },

  // ===== 외주 발주 상태 (SUBCON_ORDER_STATUS) =====
  { groupCode: 'SUBCON_ORDER_STATUS', detailCode: 'ORDERED', codeName: '발주', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Ordered' },
  { groupCode: 'SUBCON_ORDER_STATUS', detailCode: 'DELIVERED', codeName: '납품', sortOrder: 2, attr1: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300', attr3: 'Delivered' },
  { groupCode: 'SUBCON_ORDER_STATUS', detailCode: 'PARTIAL_RECV', codeName: '부분입고', sortOrder: 3, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Partial Received' },
  { groupCode: 'SUBCON_ORDER_STATUS', detailCode: 'RECEIVED', codeName: '입고완료', sortOrder: 4, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Received' },
  { groupCode: 'SUBCON_ORDER_STATUS', detailCode: 'CLOSED', codeName: '마감', sortOrder: 5, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Closed' },
  { groupCode: 'SUBCON_ORDER_STATUS', detailCode: 'CANCELED', codeName: '취소', sortOrder: 6, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Canceled' },

  // ===== 외주 검수 결과 (SUBCON_INSPECT_RESULT) =====
  { groupCode: 'SUBCON_INSPECT_RESULT', detailCode: 'PASS', codeName: '합격', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Pass' },
  { groupCode: 'SUBCON_INSPECT_RESULT', detailCode: 'FAIL', codeName: '불합격', sortOrder: 2, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Fail' },
  { groupCode: 'SUBCON_INSPECT_RESULT', detailCode: 'PARTIAL', codeName: '부분합격', sortOrder: 3, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Partial' },

  // ===== 통신 유형 (COMM_TYPE) =====
  { groupCode: 'COMM_TYPE', detailCode: 'MQTT', codeName: 'MQTT', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'MQTT' },
  { groupCode: 'COMM_TYPE', detailCode: 'SERIAL', codeName: '시리얼', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Serial' },
  { groupCode: 'COMM_TYPE', detailCode: 'TCP', codeName: 'TCP/IP', sortOrder: 3, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'TCP' },
  { groupCode: 'COMM_TYPE', detailCode: 'OPC_UA', codeName: 'OPC-UA', sortOrder: 4, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'OPC-UA' },
  { groupCode: 'COMM_TYPE', detailCode: 'MODBUS', codeName: 'Modbus', sortOrder: 5, attr1: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', attr3: 'Modbus' },

  // ===== 보드레이트 (BAUD_RATE) =====
  { groupCode: 'BAUD_RATE', detailCode: '9600', codeName: '9600', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: '9600' },
  { groupCode: 'BAUD_RATE', detailCode: '19200', codeName: '19200', sortOrder: 2, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: '19200' },
  { groupCode: 'BAUD_RATE', detailCode: '38400', codeName: '38400', sortOrder: 3, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: '38400' },
  { groupCode: 'BAUD_RATE', detailCode: '57600', codeName: '57600', sortOrder: 4, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: '57600' },
  { groupCode: 'BAUD_RATE', detailCode: '115200', codeName: '115200', sortOrder: 5, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: '115200' },

  // ===== 데이터비트 (DATA_BITS) =====
  { groupCode: 'DATA_BITS', detailCode: '7', codeName: '7비트', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: '7 bits' },
  { groupCode: 'DATA_BITS', detailCode: '8', codeName: '8비트', sortOrder: 2, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: '8 bits' },

  // ===== 정지비트 (STOP_BITS) =====
  { groupCode: 'STOP_BITS', detailCode: '1', codeName: '1', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: '1' },
  { groupCode: 'STOP_BITS', detailCode: '1.5', codeName: '1.5', sortOrder: 2, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: '1.5' },
  { groupCode: 'STOP_BITS', detailCode: '2', codeName: '2', sortOrder: 3, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: '2' },

  // ===== 패리티 (PARITY) =====
  { groupCode: 'PARITY', detailCode: 'NONE', codeName: '없음', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'None' },
  { groupCode: 'PARITY', detailCode: 'EVEN', codeName: '짝수', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Even' },
  { groupCode: 'PARITY', detailCode: 'ODD', codeName: '홀수', sortOrder: 3, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Odd' },

  // ===== 흐름제어 (FLOW_CONTROL) =====
  { groupCode: 'FLOW_CONTROL', detailCode: 'NONE', codeName: '없음', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'None' },
  { groupCode: 'FLOW_CONTROL', detailCode: 'XONXOFF', codeName: 'XON/XOFF', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'XON/XOFF' },
  { groupCode: 'FLOW_CONTROL', detailCode: 'RTSCTS', codeName: 'RTS/CTS', sortOrder: 3, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'RTS/CTS' },

  // ===== 인터페이스 방향 (INTERFACE_DIRECTION) =====
  { groupCode: 'INTERFACE_DIRECTION', detailCode: 'IN', codeName: '수신', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'In' },
  { groupCode: 'INTERFACE_DIRECTION', detailCode: 'OUT', codeName: '발신', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Out' },

  // ===== 인터페이스 로그 상태 (IF_LOG_STATUS) =====
  { groupCode: 'IF_LOG_STATUS', detailCode: 'PENDING', codeName: '대기', sortOrder: 1, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Pending' },
  { groupCode: 'IF_LOG_STATUS', detailCode: 'SUCCESS', codeName: '성공', sortOrder: 2, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Success' },
  { groupCode: 'IF_LOG_STATUS', detailCode: 'FAIL', codeName: '실패', sortOrder: 3, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Fail' },
  { groupCode: 'IF_LOG_STATUS', detailCode: 'RETRY', codeName: '재시도', sortOrder: 4, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Retry' },

  // ===== 작업자 유형 (WORKER_TYPE) =====
  { groupCode: 'WORKER_TYPE', detailCode: 'CUTTING', codeName: '절단작업자', sortOrder: 1, attr1: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', attr3: 'Cutting Worker' },
  { groupCode: 'WORKER_TYPE', detailCode: 'CRIMPING', codeName: '압착작업자', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Crimping Worker' },
  { groupCode: 'WORKER_TYPE', detailCode: 'ASSEMBLY', codeName: '조립작업자', sortOrder: 3, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Assembly Worker' },
  { groupCode: 'WORKER_TYPE', detailCode: 'INSPECTOR', codeName: '검사원', sortOrder: 4, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Inspector' },
  { groupCode: 'WORKER_TYPE', detailCode: 'PACKING', codeName: '포장작업자', sortOrder: 5, attr1: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', attr3: 'Packing Worker' },
  { groupCode: 'WORKER_TYPE', detailCode: 'LEADER', codeName: '반장', sortOrder: 6, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Team Leader' },

  // ===== 출하지시 상태 (SHIP_ORDER_STATUS) =====
  { groupCode: 'SHIP_ORDER_STATUS', detailCode: 'DRAFT', codeName: '임시저장', sortOrder: 1, attr1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', attr3: 'Draft' },
  { groupCode: 'SHIP_ORDER_STATUS', detailCode: 'CONFIRMED', codeName: '확정', sortOrder: 2, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Confirmed' },
  { groupCode: 'SHIP_ORDER_STATUS', detailCode: 'SHIPPING', codeName: '출하중', sortOrder: 3, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Shipping' },
  { groupCode: 'SHIP_ORDER_STATUS', detailCode: 'SHIPPED', codeName: '출하완료', sortOrder: 4, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Shipped' },

  // ===== 점검유형 (INSPECT_CHECK_TYPE) =====
  { groupCode: 'INSPECT_CHECK_TYPE', detailCode: 'DAILY', codeName: '일상점검', sortOrder: 1, attr1: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', attr3: 'Daily Inspection' },
  { groupCode: 'INSPECT_CHECK_TYPE', detailCode: 'PERIODIC', codeName: '정기점검', sortOrder: 2, attr1: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', attr3: 'Periodic Inspection' },

  // ===== 점검판정 (INSPECT_JUDGE) =====
  { groupCode: 'INSPECT_JUDGE', detailCode: 'PASS', codeName: '합격', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Pass' },
  { groupCode: 'INSPECT_JUDGE', detailCode: 'FAIL', codeName: '불합격', sortOrder: 2, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Fail' },
  { groupCode: 'INSPECT_JUDGE', detailCode: 'CONDITIONAL', codeName: '조건부합격', sortOrder: 3, attr1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', attr3: 'Conditional' },

  // ===== 합격여부 (JUDGE_YN) =====
  { groupCode: 'JUDGE_YN', detailCode: 'Y', codeName: '합격', sortOrder: 1, attr1: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', attr3: 'Pass' },
  { groupCode: 'JUDGE_YN', detailCode: 'N', codeName: '불합격', sortOrder: 2, attr1: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', attr3: 'Fail' },
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
