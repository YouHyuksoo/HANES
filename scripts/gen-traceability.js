/**
 * @file scripts/gen-traceability.js
 * @description HANES MES 요구사항 추적표 (Traceability Matrix) Word 문서 생성
 *
 * 초보자 가이드:
 * 1. 실행: node scripts/gen-traceability.js
 * 2. 출력: docs/deliverables/all/추적표_YYYY-MM-DD.docx
 * 3. 요구사항 ↔ As-Is/To-Be ↔ 기능 ↔ 테이블 ↔ 화면 ↔ 프로그램 매핑
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  TableOfContents,
} = require("docx");

const today = new Date().toISOString().slice(0, 10);
const FONT = "맑은 고딕";
const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerShading = { fill: "1F4E79", type: ShadingType.CLEAR };
const cellMargins = { top: 50, bottom: 50, left: 80, right: 80 };

const PAGE_W = 16838;
const PAGE_H = 11906;
const MARGIN = 800;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── 헬퍼 ──
function hCell(text, width, opts = {}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: headerShading, margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: "FFFFFF", font: FONT, size: opts.size || 16 })],
    })],
  });
}

function dCell(text, width, opts = {}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    shading: opts.shading,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), font: FONT, size: opts.size || 15, ...opts.run })],
    })],
  });
}

// ═══════════════════════════════════════════════════════════════
// As-Is ↔ To-Be 매핑 데이터
// ═══════════════════════════════════════════════════════════════
const asIsToBeData = [
  // 기준정보
  { no: 1, asId: "AS-MST-01", asName: "Excel 품목대장 관리", gap: "수작업 등록, 변경이력 미관리, 중복 우려", tbId: "TB-MST-01", tbName: "품목마스터 시스템 관리 (CRUD + 이력)", reqId: "REQ-MST-001" },
  { no: 2, asId: "AS-MST-02", asName: "Excel BOM 관리", gap: "버전관리 어려움, 공정라우팅 연결 불가", tbId: "TB-MST-02", tbName: "BOM/라우팅 시스템 관리", reqId: "REQ-MST-002" },
  { no: 3, asId: "AS-MST-03", asName: "수기 설비대장", gap: "설비 상태 실시간 파악 불가", tbId: "TB-MST-03", tbName: "설비마스터 + 실시간 상태관리", reqId: "REQ-MST-003" },
  // 자재관리
  { no: 4, asId: "AS-MAT-01", asName: "수기 입고대장 기록", gap: "수작업, 오류 빈번, 실시간 추적 불가", tbId: "TB-MAT-01", tbName: "바코드 스캔 입하/입고 등록", reqId: "REQ-MAT-001" },
  { no: 5, asId: "AS-MAT-02", asName: "IQC 결과 수기 기록", gap: "검사 누락, 이력 관리 어려움", tbId: "TB-MAT-02", tbName: "시스템 IQC 등록 + 자동 판정", reqId: "REQ-MAT-002" },
  { no: 6, asId: "AS-MAT-03", asName: "Excel 재고 관리", gap: "실시간 재고 불일치, 수불 추적 불가", tbId: "TB-MAT-03", tbName: "실시간 재고 자동계산 + LOT추적", reqId: "REQ-MAT-003" },
  { no: 7, asId: "AS-MAT-04", asName: "수기 출고전표", gap: "선입선출 미준수, 출고 누락", tbId: "TB-MAT-04", tbName: "바코드 스캔 출고 + FIFO 자동적용", reqId: "REQ-MAT-004" },
  // 생산관리
  { no: 8, asId: "AS-PRD-01", asName: "수기 작업지시서", gap: "배포 지연, 변경 추적 불가", tbId: "TB-PRD-01", tbName: "시스템 작업지시 + ERP 연동", reqId: "REQ-PRD-001" },
  { no: 9, asId: "AS-PRD-02", asName: "수기 생산일보", gap: "실시간 실적 파악 불가, 집계 오류", tbId: "TB-PRD-02", tbName: "실시간 실적 등록 + 자동 집계", reqId: "REQ-PRD-002" },
  { no: 10, asId: "AS-PRD-03", asName: "수기 생산계획", gap: "계획 대비 실적 비교 어려움", tbId: "TB-PRD-03", tbName: "월간생산계획 + 진행률 모니터링", reqId: "REQ-PRD-003" },
  // 품질관리
  { no: 11, asId: "AS-QC-01", asName: "수기 불량기록", gap: "불량 유형별 통계 불가, 추적 어려움", tbId: "TB-QC-01", tbName: "불량 등록 + 유형별 통계 + 추적", reqId: "REQ-QC-001" },
  { no: 12, asId: "AS-QC-02", asName: "수기 검사성적서", gap: "시리얼별 검사이력 미관리", tbId: "TB-QC-02", tbName: "외관/통전검사 + 시리얼 추적", reqId: "REQ-QC-002" },
  { no: 13, asId: "AS-QC-03", asName: "수기 출하검사 기록", gap: "출하 전 검사 누락 위험", tbId: "TB-QC-03", tbName: "OQC 의뢰/실행 + 자동판정", reqId: "REQ-QC-003" },
  { no: 14, asId: "-", asName: "(신규)", gap: "-", tbId: "TB-QC-04", tbName: "CAPA/변경점/클레임 체계적 관리", reqId: "REQ-QC-004" },
  { no: 15, asId: "-", asName: "(신규)", gap: "-", tbId: "TB-QC-05", tbName: "SPC/관리계획서/PPAP/FAI/내부심사", reqId: "REQ-QC-005" },
  // 설비관리
  { no: 16, asId: "AS-EQ-01", asName: "수기 점검일지", gap: "점검 누락, 이력 추적 불가", tbId: "TB-EQ-01", tbName: "일상/정기점검 + 캘린더 관리", reqId: "REQ-EQ-001" },
  { no: 17, asId: "AS-EQ-02", asName: "수기 보전일보", gap: "예방보전 계획 수립 어려움", tbId: "TB-EQ-02", tbName: "PM 계획/실행/이력 체계화", reqId: "REQ-EQ-002" },
  // 출하관리
  { no: 18, asId: "AS-SHP-01", asName: "수기 출하전표", gap: "포장/팔레트 추적 불가, 오출하 위험", tbId: "TB-SHP-01", tbName: "박스/팔레트 바코드 관리 + 출하확정", reqId: "REQ-SHP-001" },
  { no: 19, asId: "-", asName: "(신규)", gap: "-", tbId: "TB-SHP-02", tbName: "고객발주 관리 + 출하지시", reqId: "REQ-SHP-002" },
  // 보세/소모품/외주
  { no: 20, asId: "AS-CUS-01", asName: "수기 보세대장", gap: "수입/사용신고 관리 어려움", tbId: "TB-CUS-01", tbName: "보세 수입/사용신고 시스템 관리", reqId: "REQ-CUS-001" },
  { no: 21, asId: "AS-CON-01", asName: "수기 소모품 대장", gap: "수명/교체시기 관리 불가", tbId: "TB-CON-01", tbName: "소모품 입출고/수명/재고 관리", reqId: "REQ-CON-001" },
  { no: 22, asId: "AS-OUT-01", asName: "수기 외주 발주서", gap: "외주 진행현황 파악 어려움", tbId: "TB-OUT-01", tbName: "외주 발주/출고/입고 시스템 관리", reqId: "REQ-OUT-001" },
  // 인터페이스
  { no: 23, asId: "AS-IF-01", asName: "수동 ERP 데이터 입력", gap: "이중입력, 동기화 지연", tbId: "TB-IF-01", tbName: "ERP 자동 연동 (작업지시/BOM/품목/실적)", reqId: "REQ-IF-001" },
  // 시스템
  { no: 24, asId: "-", asName: "(신규)", gap: "-", tbId: "TB-SYS-01", tbName: "RBAC 역할 기반 접근제어 + 활동로그", reqId: "REQ-SYS-001" },
  { no: 25, asId: "-", asName: "(신규)", gap: "-", tbId: "TB-SYS-02", tbName: "PDA 모바일 앱 (입고/출고/실사/출하/점검)", reqId: "REQ-SYS-002" },
];

// ═══════════════════════════════════════════════════════════════
// 요구사항 추적 매트릭스 데이터
// ═══════════════════════════════════════════════════════════════
const traceData = [
  // ── 기준정보 ──
  { reqId: "REQ-MST-001", reqName: "품목마스터 관리", asId: "AS-MST-01", gap: "Excel→시스템", tbId: "TB-MST-01", funcId: "FD-MST-001", tables: "ITEM_MASTERS", screenId: "SC-MST-001", ifId: "IF-ERP-003", pgId: "PG-MST-001", status: "완료" },
  { reqId: "REQ-MST-002", reqName: "BOM/라우팅 관리", asId: "AS-MST-02", gap: "Excel→시스템", tbId: "TB-MST-02", funcId: "FD-MST-002, FD-MST-003", tables: "BOM_MASTERS, PROCESS_MAPS, ROUTING_GROUPS", screenId: "SC-MST-002, SC-MST-007", ifId: "IF-ERP-002", pgId: "PG-MST-002, PG-MST-007", status: "완료" },
  { reqId: "REQ-MST-003", reqName: "설비/금형/계측기 마스터", asId: "AS-MST-03", gap: "수기→시스템", tbId: "TB-MST-03", funcId: "FD-MST-004, FD-MST-005", tables: "EQUIP_MASTERS, MOLD_MASTERS, GAUGE_MASTERS", screenId: "SC-MST-004, SC-EQ-001, SC-GAU-001", ifId: "-", pgId: "PG-MST-004, PG-EQ-001, PG-MST-018", status: "완료" },
  { reqId: "REQ-MST-004", reqName: "거래처/작업자/창고 관리", asId: "AS-MST-01", gap: "Excel→시스템", tbId: "TB-MST-01", funcId: "FD-MST-006~008", tables: "PARTNER_MASTERS, WORKER_MASTERS, WAREHOUSES, WAREHOUSE_LOCATIONS", screenId: "SC-MST-003,008,010", ifId: "-", pgId: "PG-MST-003,008,010", status: "완료" },
  { reqId: "REQ-MST-005", reqName: "공통코드/라벨/문서 관리", asId: "-", gap: "신규", tbId: "TB-MST-01", funcId: "FD-MST-009~011", tables: "COM_CODES, LABEL_TEMPLATES, DOCUMENT_MASTERS", screenId: "SC-MST-011,016,017", ifId: "-", pgId: "PG-MST-011,016,017", status: "완료" },

  // ── 자재관리 ──
  { reqId: "REQ-MAT-001", reqName: "입하/입고 관리", asId: "AS-MAT-01", gap: "수기→바코드", tbId: "TB-MAT-01", funcId: "FD-MAT-001~003", tables: "MAT_ARRIVALS, MAT_RECEIVINGS, MAT_STOCKS, STOCK_TRANSACTIONS", screenId: "SC-MAT-001~004", ifId: "IF-ERP-001", pgId: "PG-MAT-001~004, PG-PDA-003", status: "완료" },
  { reqId: "REQ-MAT-002", reqName: "수입검사(IQC)", asId: "AS-MAT-02", gap: "수기→시스템", tbId: "TB-MAT-02", funcId: "FD-MAT-004", tables: "IQC_ITEM_MASTERS, IQC_GROUPS, IQC_ITEM_POOL, MAT_STOCKS", screenId: "SC-QC-001~002", ifId: "-", pgId: "PG-QC-001~002, PG-MST-013", status: "완료" },
  { reqId: "REQ-MAT-003", reqName: "재고관리/LOT추적", asId: "AS-MAT-03", gap: "Excel→실시간", tbId: "TB-MAT-03", funcId: "FD-MAT-005~008", tables: "MAT_STOCKS, STOCK_TRANSACTIONS, INV_ADJ_LOGS", screenId: "SC-INV-001~006", ifId: "-", pgId: "PG-INV-001~006, PG-MAT-007~013", status: "완료" },
  { reqId: "REQ-MAT-004", reqName: "출고/출고요청 관리", asId: "AS-MAT-04", gap: "수기→FIFO", tbId: "TB-MAT-04", funcId: "FD-MAT-009~010", tables: "MAT_ISSUES, MAT_ISSUE_REQUESTS, MAT_ISSUE_REQUEST_ITEMS", screenId: "SC-MAT-005~006", ifId: "-", pgId: "PG-MAT-005~006, PG-PDA-004", status: "완료" },
  { reqId: "REQ-MAT-005", reqName: "PO관리/발주현황", asId: "-", gap: "신규", tbId: "TB-MAT-05", funcId: "FD-MAT-011", tables: "PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS", screenId: "SC-PUR-001~002", ifId: "-", pgId: "PG-PUR-001~002", status: "완료" },

  // ── 생산관리 ──
  { reqId: "REQ-PRD-001", reqName: "작업지시 관리", asId: "AS-PRD-01", gap: "수기→시스템", tbId: "TB-PRD-01", funcId: "FD-PRD-001", tables: "JOB_ORDERS, PROD_PLANS", screenId: "SC-PRD-001~002", ifId: "IF-ERP-001", pgId: "PG-PRD-001~002", status: "완료" },
  { reqId: "REQ-PRD-002", reqName: "생산실적 등록/조회", asId: "AS-PRD-02", gap: "수기→실시간", tbId: "TB-PRD-02", funcId: "FD-PRD-002~005", tables: "PROD_RESULTS, FG_LABELS, PRODUCT_STOCKS", screenId: "SC-PRD-003~009", ifId: "IF-ERP-004", pgId: "PG-PRD-003~010", status: "완료" },
  { reqId: "REQ-PRD-003", reqName: "월간생산계획", asId: "AS-PRD-03", gap: "수기→시스템", tbId: "TB-PRD-03", funcId: "FD-PRD-006", tables: "PROD_PLANS", screenId: "SC-PRD-001", ifId: "-", pgId: "PG-PRD-001", status: "완료" },
  { reqId: "REQ-PRD-004", reqName: "재작업/수리 관리", asId: "-", gap: "신규", tbId: "TB-PRD-04", funcId: "FD-PRD-007~008", tables: "REWORK_ORDERS, REWORK_PROCESSES, REWORK_RESULTS, REWORK_INSPECTS", screenId: "SC-PRD-011~013", ifId: "-", pgId: "PG-PRD-011~013", status: "완료" },

  // ── 품질관리 ──
  { reqId: "REQ-QC-001", reqName: "불량등록/통계", asId: "AS-QC-01", gap: "수기→시스템", tbId: "TB-QC-01", funcId: "FD-QC-001", tables: "DEFECT_LOGS", screenId: "SC-QC-003", ifId: "-", pgId: "PG-QC-003", status: "완료" },
  { reqId: "REQ-QC-002", reqName: "외관/통전검사", asId: "AS-QC-02", gap: "수기→시스템", tbId: "TB-QC-02", funcId: "FD-QC-002~003", tables: "INSPECT_RESULTS, SAMPLE_INSPECT_RESULTS", screenId: "SC-QC-005~006, SC-INSP-001~003", ifId: "-", pgId: "PG-QC-005~006, PG-INSP-001~003", status: "완료" },
  { reqId: "REQ-QC-003", reqName: "출하검사(OQC)", asId: "AS-QC-03", gap: "수기→시스템", tbId: "TB-QC-03", funcId: "FD-QC-004", tables: "OQC_REQUESTS, OQC_REQUEST_BOXES", screenId: "SC-QC-007~008", ifId: "-", pgId: "PG-QC-007~008", status: "완료" },
  { reqId: "REQ-QC-004", reqName: "CAPA/변경점/클레임", asId: "-", gap: "신규", tbId: "TB-QC-04", funcId: "FD-QC-005~007", tables: "CAPA_REQUESTS, CAPA_ACTIONS, CHANGE_ORDERS, CUSTOMER_COMPLAINTS", screenId: "SC-QC-010~012", ifId: "-", pgId: "PG-QC-010~012", status: "완료" },
  { reqId: "REQ-QC-005", reqName: "SPC/CP/PPAP/FAI/심사", asId: "-", gap: "신규", tbId: "TB-QC-05", funcId: "FD-QC-008~012", tables: "SPC_CHARTS, SPC_DATA, CONTROL_PLANS, CONTROL_PLAN_ITEMS, PPAP_SUBMISSIONS, FAI_REQUESTS, FAI_ITEMS, AUDIT_PLANS, AUDIT_FINDINGS", screenId: "SC-QC-013~017", ifId: "-", pgId: "PG-QC-013~017", status: "완료" },
  { reqId: "REQ-QC-006", reqName: "추적성 조회", asId: "-", gap: "신규", tbId: "TB-QC-06", funcId: "FD-QC-013", tables: "전 테이블 연계", screenId: "SC-QC-009", ifId: "-", pgId: "PG-QC-009", status: "완료" },
  { reqId: "REQ-QC-007", reqName: "교육훈련 관리", asId: "-", gap: "신규", tbId: "TB-QC-07", funcId: "FD-QC-014", tables: "TRAINING_PLANS, TRAINING_RESULTS", screenId: "SC-QC-018", ifId: "-", pgId: "PG-QC-018", status: "완료" },

  // ── 설비관리 ──
  { reqId: "REQ-EQ-001", reqName: "일상/정기점검", asId: "AS-EQ-01", gap: "수기→시스템", tbId: "TB-EQ-01", funcId: "FD-EQ-001~003", tables: "EQUIP_INSPECT_LOGS, EQUIP_MASTERS", screenId: "SC-EQ-002~006", ifId: "-", pgId: "PG-EQ-002~006, PG-PDA-009", status: "완료" },
  { reqId: "REQ-EQ-002", reqName: "예방보전(PM)", asId: "AS-EQ-02", gap: "수기→체계화", tbId: "TB-EQ-02", funcId: "FD-EQ-004~005", tables: "PM_PLANS, PM_PLAN_ITEMS, PM_WORK_ORDERS, PM_WO_RESULTS", screenId: "SC-EQ-007~009", ifId: "-", pgId: "PG-EQ-007~009", status: "완료" },
  { reqId: "REQ-EQ-003", reqName: "계측기 교정관리", asId: "-", gap: "신규", tbId: "TB-EQ-03", funcId: "FD-EQ-006", tables: "GAUGE_MASTERS, CALIBRATION_LOGS", screenId: "SC-GAU-001~002", ifId: "-", pgId: "PG-GAU-001~002", status: "완료" },

  // ── 출하관리 ──
  { reqId: "REQ-SHP-001", reqName: "포장/팔레트/출하 관리", asId: "AS-SHP-01", gap: "수기→바코드", tbId: "TB-SHP-01", funcId: "FD-SHP-001~004", tables: "BOX_MASTERS, PALLET_MASTERS, SHIPMENT_LOGS, FG_LABELS", screenId: "SC-SHP-001~006", ifId: "-", pgId: "PG-SHP-001~007, PG-PDA-008", status: "완료" },
  { reqId: "REQ-SHP-002", reqName: "고객발주/출하지시", asId: "-", gap: "신규", tbId: "TB-SHP-02", funcId: "FD-SHP-005~006", tables: "CUSTOMER_ORDERS, CUSTOMER_ORDER_ITEMS, SHIPMENT_ORDERS, SHIPMENT_ORDER_ITEMS", screenId: "SC-SHP-005,008~009", ifId: "-", pgId: "PG-SHP-005,008~009", status: "완료" },
  { reqId: "REQ-SHP-003", reqName: "출하반품 관리", asId: "-", gap: "신규", tbId: "TB-SHP-03", funcId: "FD-SHP-007", tables: "SHIPMENT_RETURNS, SHIPMENT_RETURN_ITEMS", screenId: "SC-SHP-007", ifId: "-", pgId: "PG-SHP-007", status: "완료" },

  // ── 제품재고관리 ──
  { reqId: "REQ-PINV-001", reqName: "제품입출고/재고/실사", asId: "-", gap: "신규", tbId: "TB-PINV-01", funcId: "FD-PINV-001~004", tables: "PRODUCT_STOCKS, PRODUCT_TRANSACTIONS", screenId: "SC-PINV-001~004, SC-PMGT-001~004", ifId: "-", pgId: "PG-PINV-001~004, PG-PMGT-001~004, PG-PDA-007", status: "완료" },

  // ── 보세관리 ──
  { reqId: "REQ-CUS-001", reqName: "보세 수입/사용신고", asId: "AS-CUS-01", gap: "수기→시스템", tbId: "TB-CUS-01", funcId: "FD-CUS-001~003", tables: "CUSTOMS_ENTRIES, CUSTOMS_LOTS, CUSTOMS_USAGE_REPORTS", screenId: "SC-CUS-001~003", ifId: "-", pgId: "PG-CUS-001~003", status: "완료" },

  // ── 소모품관리 ──
  { reqId: "REQ-CON-001", reqName: "소모품 입출고/수명/재고", asId: "AS-CON-01", gap: "수기→시스템", tbId: "TB-CON-01", funcId: "FD-CON-001~004", tables: "CONSUMABLE_MASTERS, CONSUMABLE_STOCKS", screenId: "SC-CON-001~006", ifId: "-", pgId: "PG-CON-001~006", status: "완료" },

  // ── 외주관리 ──
  { reqId: "REQ-OUT-001", reqName: "외주 발주/출고/입고", asId: "AS-OUT-01", gap: "수기→시스템", tbId: "TB-OUT-01", funcId: "FD-OUT-001~003", tables: "VENDOR_MASTERS, SUBCON_ORDERS, SUBCON_DELIVERIES, SUBCON_RECEIVES", screenId: "SC-OUT-001~003", ifId: "-", pgId: "PG-OUT-001~003", status: "완료" },

  // ── 인터페이스 ──
  { reqId: "REQ-IF-001", reqName: "ERP 연동", asId: "AS-IF-01", gap: "수동→자동", tbId: "TB-IF-01", funcId: "FD-IF-001~004", tables: "INTER_LOGS", screenId: "SC-IF-001~003", ifId: "IF-ERP-001~004", pgId: "PG-IF-001~007", status: "완료" },

  // ── 시스템관리 ──
  { reqId: "REQ-SYS-001", reqName: "RBAC/사용자/역할/로그", asId: "-", gap: "신규", tbId: "TB-SYS-01", funcId: "FD-SYS-001~005", tables: "USERS, USER_AUTHS, ROLES, ROLE_MENU_PERMISSIONS, PDA_ROLE", screenId: "SC-SYS-001~008", ifId: "-", pgId: "PG-SYS-001~008, PG-COM-001,005", status: "완료" },
  { reqId: "REQ-SYS-002", reqName: "PDA 모바일 앱", asId: "-", gap: "신규", tbId: "TB-SYS-02", funcId: "FD-SYS-006", tables: "(PC Web과 동일 API 공유)", screenId: "SC-PDA-001~010", ifId: "-", pgId: "PG-PDA-001~010", status: "완료" },

  // ── 배치/공통 ──
  { reqId: "REQ-BAT-001", reqName: "스케줄러/배치 실행", asId: "-", gap: "신규", tbId: "TB-BAT-01", funcId: "FD-BAT-001~005", tables: "SYS_CONFIGS", screenId: "SC-SYS-008", ifId: "-", pgId: "PG-BAT-001~005, PG-SYS-008", status: "완료" },
  { reqId: "REQ-COM-001", reqName: "채번/라벨인쇄/자동출고", asId: "-", gap: "신규", tbId: "TB-COM-01", funcId: "FD-COM-001~004", tables: "NUM_RULE_MASTERS, SEQ_RULES, LABEL_TEMPLATES", screenId: "-", ifId: "-", pgId: "PG-COM-001~006", status: "완료" },
];

// ═══════════════════════════════════════════════════════════════
// 커버리지 통계 계산
// ═══════════════════════════════════════════════════════════════
const totalReq = traceData.length;
const reqToFunc = traceData.filter(r => r.funcId !== "-").length;
const reqToScreen = traceData.filter(r => r.screenId !== "-").length;
const reqToTable = traceData.filter(r => r.tables !== "-").length;
const reqToIf = traceData.filter(r => r.ifId !== "-").length;
const reqToPg = traceData.filter(r => r.pgId !== "-").length;

const coverageData = [
  { item: "요구사항 → 기능", total: totalReq, mapped: reqToFunc, coverage: ((reqToFunc/totalReq)*100).toFixed(0) },
  { item: "요구사항 → 화면", total: totalReq, mapped: reqToScreen, coverage: ((reqToScreen/totalReq)*100).toFixed(0) },
  { item: "요구사항 → 테이블", total: totalReq, mapped: reqToTable, coverage: ((reqToTable/totalReq)*100).toFixed(0) },
  { item: "요구사항 → 인터페이스", total: totalReq, mapped: reqToIf, coverage: ((reqToIf/totalReq)*100).toFixed(0) },
  { item: "요구사항 → 프로그램", total: totalReq, mapped: reqToPg, coverage: ((reqToPg/totalReq)*100).toFixed(0) },
];

// ═══════════════════════════════════════════════════════════════
// 테이블 빌드
// ═══════════════════════════════════════════════════════════════

// ── As-Is ↔ To-Be 매핑 테이블 ──
const asIsColW = [500, 1200, 2500, 3300, 1200, 3200, 1500];
const asIsTableW = asIsColW.reduce((a,b)=>a+b, 0);
const asIsTable = new Table({
  width: { size: asIsTableW, type: WidthType.DXA },
  columnWidths: asIsColW,
  rows: [
    new TableRow({ tableHeader: true, children: [
      hCell("No", asIsColW[0]), hCell("As-Is ID", asIsColW[1]), hCell("As-Is 프로세스명", asIsColW[2]),
      hCell("문제점/Gap", asIsColW[3]), hCell("To-Be ID", asIsColW[4]),
      hCell("To-Be 프로세스명", asIsColW[5]), hCell("요구사항ID", asIsColW[6]),
    ]}),
    ...asIsToBeData.map(r => new TableRow({ children: [
      dCell(r.no, asIsColW[0], { center: true }),
      dCell(r.asId, asIsColW[1], { center: true }),
      dCell(r.asName, asIsColW[2]),
      dCell(r.gap, asIsColW[3]),
      dCell(r.tbId, asIsColW[4], { center: true }),
      dCell(r.tbName, asIsColW[5]),
      dCell(r.reqId, asIsColW[6], { center: true }),
    ]})),
  ],
});

// ── 요구사항 추적 매트릭스 ──
const trColW = [550, 1200, 1800, 900, 800, 900, 1200, 2400, 1000, 1000, 1300, 500];
const trTableW = trColW.reduce((a,b)=>a+b, 0);
const traceTable = new Table({
  width: { size: trTableW, type: WidthType.DXA },
  columnWidths: trColW,
  rows: [
    new TableRow({ tableHeader: true, children: [
      hCell("No", trColW[0], { size: 14 }), hCell("요구사항ID", trColW[1], { size: 14 }),
      hCell("요구사항명", trColW[2], { size: 14 }), hCell("As-Is", trColW[3], { size: 14 }),
      hCell("Gap", trColW[4], { size: 14 }), hCell("To-Be", trColW[5], { size: 14 }),
      hCell("기능ID", trColW[6], { size: 14 }), hCell("관련 테이블", trColW[7], { size: 14 }),
      hCell("화면ID", trColW[8], { size: 14 }), hCell("I/F ID", trColW[9], { size: 14 }),
      hCell("프로그램ID", trColW[10], { size: 14 }), hCell("상태", trColW[11], { size: 14 }),
    ]}),
    ...traceData.map((r, i) => new TableRow({ children: [
      dCell(i+1, trColW[0], { center: true, size: 13 }),
      dCell(r.reqId, trColW[1], { center: true, size: 13 }),
      dCell(r.reqName, trColW[2], { size: 13 }),
      dCell(r.asId, trColW[3], { center: true, size: 13 }),
      dCell(r.gap, trColW[4], { center: true, size: 13 }),
      dCell(r.tbId, trColW[5], { center: true, size: 13 }),
      dCell(r.funcId, trColW[6], { size: 12 }),
      dCell(r.tables, trColW[7], { size: 11 }),
      dCell(r.screenId, trColW[8], { size: 12 }),
      dCell(r.ifId, trColW[9], { center: true, size: 12 }),
      dCell(r.pgId, trColW[10], { size: 12 }),
      dCell(r.status, trColW[11], { center: true, size: 13 }),
    ]})),
  ],
});

// ── 커버리지 통계 테이블 ──
const cvColW = [3000, 1500, 1500, 1500, 1500];
const cvTableW = cvColW.reduce((a,b)=>a+b, 0);
const coverageTable = new Table({
  width: { size: cvTableW, type: WidthType.DXA },
  columnWidths: cvColW,
  rows: [
    new TableRow({ tableHeader: true, children: [
      hCell("항목", cvColW[0]), hCell("전체", cvColW[1]),
      hCell("매핑됨", cvColW[2]), hCell("미매핑", cvColW[3]), hCell("커버리지", cvColW[4]),
    ]}),
    ...coverageData.map(c => new TableRow({ children: [
      dCell(c.item, cvColW[0]),
      dCell(c.total, cvColW[1], { center: true }),
      dCell(c.mapped, cvColW[2], { center: true }),
      dCell(c.total - c.mapped, cvColW[3], { center: true }),
      dCell(c.coverage + "%", cvColW[4], { center: true, run: { bold: true } }),
    ]})),
  ],
});

// ── 미매핑 사유 테이블 ──
const unmappedData = [
  { no: 1, item: "REQ-COM-001", target: "화면 없음", reason: "공통 서비스 (채번/라벨인쇄/자동출고) - 화면 없이 API로 동작" },
  { no: 2, item: "REQ-QC-006 (추적성)", target: "테이블 특정 불가", reason: "전 모듈 테이블 연계 조회 - 특정 테이블 지정 불가" },
  { no: 3, item: "인터페이스 미연결 항목", target: "I/F ID 없음", reason: "ERP 연동 불필요한 내부 관리 기능 (설비점검, 소모품 등)" },
];
const umColW = [600, 2000, 2500, 5500];
const umTableW = umColW.reduce((a,b)=>a+b, 0);
const unmappedTable = new Table({
  width: { size: umTableW, type: WidthType.DXA },
  columnWidths: umColW,
  rows: [
    new TableRow({ tableHeader: true, children: [
      hCell("No", umColW[0]), hCell("항목", umColW[1]),
      hCell("미매핑 대상", umColW[2]), hCell("사유", umColW[3]),
    ]}),
    ...unmappedData.map(u => new TableRow({ children: [
      dCell(u.no, umColW[0], { center: true }),
      dCell(u.item, umColW[1], { center: true }),
      dCell(u.target, umColW[2]),
      dCell(u.reason, umColW[3]),
    ]})),
  ],
});

// ═══════════════════════════════════════════════════════════════
// 문서 생성
// ═══════════════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: FONT, color: "1F4E79" },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: "2E75B6" },
        paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: FONT },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 } },
    ],
  },
  sections: [
    // ── 표지 ──
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H, orientation: PageOrientation.LANDSCAPE },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children: [
        new Paragraph({ spacing: { before: 3000 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 600 },
          children: [new TextRun({ text: "HANES MES", font: FONT, size: 60, bold: true, color: "1F4E79" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 400 },
          children: [new TextRun({ text: "요구사항 추적표", font: FONT, size: 48, bold: true, color: "2E75B6" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 200 },
          children: [new TextRun({ text: "(Traceability Matrix)", font: FONT, size: 28, color: "666666", italics: true })],
        }),
        new Paragraph({ spacing: { before: 1200 }, children: [] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `프로젝트명: HANES MES (Manufacturing Execution System)`, font: FONT, size: 24, color: "444444" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: `작성일: ${today}`, font: FONT, size: 24, color: "444444" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: `버전: 1.0`, font: FONT, size: 24, color: "444444" })] }),
      ],
    },
    // ── 본문 ──
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H, orientation: PageOrientation.LANDSCAPE },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "HANES MES - 요구사항 추적표", font: FONT, size: 16, color: "888888", italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "- ", font: FONT, size: 16, color: "888888" }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "888888" }),
              new TextRun({ text: " -", font: FONT, size: 16, color: "888888" }),
            ],
          })],
        }),
      },
      children: [
        // 개정이력
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("개정이력")] }),
        new Table({
          width: { size: 10000, type: WidthType.DXA },
          columnWidths: [1500, 1000, 2000, 5500],
          rows: [
            new TableRow({ children: [
              hCell("날짜", 1500), hCell("버전", 1000), hCell("작성자", 2000), hCell("변경내용", 5500),
            ]}),
            new TableRow({ children: [
              dCell(today, 1500, { center: true }), dCell("1.0", 1000, { center: true }),
              dCell("시스템 자동생성", 2000, { center: true }),
              dCell("초기 작성 - 코드 분석 기반 자동 추출 + As-Is/To-Be 매핑", 5500),
            ]}),
          ],
        }),

        // 목차
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("목차")] }),
        new TableOfContents("목차", { hyperlink: true, headingStyleRange: "1-3" }),

        // 1. 개요
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. 개요")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.1 목적")] }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({
          text: "본 문서는 HANES MES 시스템의 요구사항부터 설계, 구현, 테스트에 이르는 전 과정의 추적성(Traceability)을 확보하기 위한 추적표이다. As-Is 현행 프로세스에서 도출된 Gap을 기반으로 To-Be 요구사항을 정의하고, 각 요구사항이 기능설계, DB설계, 화면설계, 프로그램에 어떻게 매핑되는지 추적한다.",
          font: FONT, size: 22,
        })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.2 범위")] }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({
          text: "HANES MES 전체 모듈 (기준정보, 자재관리, 생산관리, 품질관리, 설비관리, 출하관리, 보세관리, 소모품관리, 외주관리, 인터페이스, 시스템관리, PDA)을 대상으로 하며, 총 " + totalReq + "개 요구사항의 추적 관계를 정의한다.",
          font: FONT, size: 22,
        })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.3 추적 체계")] }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({
          text: "As-Is(현행) → Gap 분석 → 요구사항(REQ) → To-Be(목표) → 기능설계(FD) → DB설계(테이블) → 화면설계(SC) → 인터페이스(IF) → 프로그램(PG)",
          font: FONT, size: 22,
        })] }),

        // 2. ID 체계
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. ID 체계")] }),
        new Table({
          width: { size: 10000, type: WidthType.DXA },
          columnWidths: [2000, 2500, 2500, 3000],
          rows: [
            new TableRow({ children: [
              hCell("산출물", 2000), hCell("ID 패턴", 2500), hCell("예시", 2500), hCell("설명", 3000),
            ]}),
            ...([
              ["As-Is 프로세스", "AS-{모듈}-{순번}", "AS-MAT-01", "현행 업무 프로세스"],
              ["To-Be 프로세스", "TB-{모듈}-{순번}", "TB-MAT-01", "목표 프로세스"],
              ["요구사항", "REQ-{모듈}-{순번}", "REQ-MAT-001", "기능 요구사항"],
              ["기능설계", "FD-{모듈}-{순번}", "FD-MAT-001", "기능설계서 항목"],
              ["화면설계", "SC-{모듈}-{순번}", "SC-MAT-001", "화면설계서 항목"],
              ["인터페이스", "IF-{대상}-{순번}", "IF-ERP-001", "외부 연동"],
              ["프로그램", "PG-{모듈}-{순번}", "PG-MAT-001", "프로그램목록 항목"],
              ["테이블", "실제 테이블명", "MAT_ARRIVALS", "DB 테이블명"],
            ].map(([s,p,e,d]) => new TableRow({ children: [
              dCell(s, 2000, { center: true }), dCell(p, 2500, { center: true }),
              dCell(e, 2500, { center: true }), dCell(d, 3000),
            ]}))),
          ],
        }),

        // 3. As-Is ↔ To-Be 매핑표
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. As-Is ↔ To-Be 매핑표")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({
          text: `총 ${asIsToBeData.length}개 프로세스 매핑 (As-Is ${asIsToBeData.filter(r=>r.asId!=="-").length}개 + 신규 ${asIsToBeData.filter(r=>r.asId==="-").length}개)`,
          font: FONT, size: 20,
        })] }),
        asIsTable,

        // 4. 요구사항 추적 매트릭스
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. 요구사항 추적 매트릭스")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({
          text: `총 ${totalReq}개 요구사항에 대한 전체 산출물 매핑 현황`,
          font: FONT, size: 20,
        })] }),
        traceTable,

        // 5. 추적 검증 결과
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. 추적 검증 결과")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.1 커버리지 통계")] }),
        coverageTable,
        new Paragraph({ spacing: { before: 200 }, children: [] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.2 미매핑 항목 사유")] }),
        unmappedTable,
      ],
    },
  ],
});

// ── 파일 출력 ──
const outDir = path.join(__dirname, "..", "docs", "deliverables", "all");
const outFile = path.join(outDir, `추적표_${today}.docx`);

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outFile, buffer);
  console.log(`생성 완료: ${outFile}`);
  console.log(`  총 요구사항: ${totalReq}개`);
  console.log(`  As-Is/To-Be 매핑: ${asIsToBeData.length}개`);
  console.log(`  커버리지: 기능 ${coverageData[0].coverage}%, 화면 ${coverageData[1].coverage}%, 테이블 ${coverageData[2].coverage}%`);
}).catch(err => {
  console.error("생성 실패:", err);
  process.exit(1);
});
