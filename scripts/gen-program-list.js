/**
 * @file scripts/gen-program-list.js
 * @description HANES MES 전체프로그램목록표 Word 문서 생성 스크립트
 *
 * 초보자 가이드:
 * 1. 실행: node scripts/gen-program-list.js
 * 2. 출력: docs/deliverables/all/전체프로그램목록표_YYYY-MM-DD.docx
 * 3. menuConfig + 백엔드 컨트롤러/서비스/DTO + PDA 화면 정보를 기반으로 생성
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  TableOfContents,
} = require("docx");

// ── 날짜 ──
const today = new Date().toISOString().slice(0, 10);

// ── 스타일 상수 ──
const FONT = "맑은 고딕";
const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerShading = { fill: "1F4E79", type: ShadingType.CLEAR };
const subHeaderShading = { fill: "D6E4F0", type: ShadingType.CLEAR };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

// ── 페이지 설정 (A4 가로) ──
const PAGE_W = 16838; // A4 height as width (landscape)
const PAGE_H = 11906; // A4 width as height (landscape)
const MARGIN = 1000;
const CONTENT_W = PAGE_W - MARGIN * 2; // 14838

// ── 전체 프로그램 데이터 ──
// 10열: No, 프로그램ID, 프로그램명, 대분류, 소분류, 유형, 화면파일, 컨트롤러, 서비스, 비고
const programs = [];
let seq = 0;

function addProgram(id, name, cat1, cat2, type, frontFile, controller, service, remark) {
  seq++;
  programs.push({
    no: seq, id, name, cat1, cat2, type,
    frontFile: frontFile || "-",
    controller: controller || "-",
    service: service || "-",
    remark: remark || "",
  });
}

// ═══════════════════════════════════════════════════════════════
// 1. 대시보드
// ═══════════════════════════════════════════════════════════════
addProgram("PG-DASH-001", "대시보드", "대시보드", "-", "화면", "dashboard/page.tsx", "dashboard.controller.ts", "dashboard.service.ts", "KPI/요약/최근작업");

// ═══════════════════════════════════════════════════════════════
// 2. 모니터링
// ═══════════════════════════════════════════════════════════════
addProgram("PG-MON-001", "설비 가동현황", "모니터링", "설비현황", "화면", "equipment/status/page.tsx", "equip-master.controller.ts", "equip-master.service.ts", "실시간 모니터링");

// ═══════════════════════════════════════════════════════════════
// 3. 기준정보
// ═══════════════════════════════════════════════════════════════
addProgram("PG-MST-001", "품목관리", "기준정보", "품목", "화면", "master/part/page.tsx", "part.controller.ts", "part.service.ts", "");
addProgram("PG-MST-002", "BOM관리", "기준정보", "BOM", "화면", "master/bom/page.tsx", "bom.controller.ts", "bom.service.ts", "");
addProgram("PG-MST-003", "거래처관리", "기준정보", "거래처", "화면", "master/partner/page.tsx", "partner.controller.ts", "partner.service.ts", "");
addProgram("PG-MST-004", "설비마스터", "기준정보", "설비", "화면", "master/equip/page.tsx", "equip-master.controller.ts", "equip-master.service.ts", "");
addProgram("PG-MST-005", "공정관리", "기준정보", "공정", "화면", "master/process/page.tsx", "process.controller.ts", "process.service.ts", "");
addProgram("PG-MST-006", "생산라인관리", "기준정보", "생산라인", "화면", "master/prod-line/page.tsx", "prod-line.controller.ts", "prod-line.service.ts", "");
addProgram("PG-MST-007", "라우팅관리", "기준정보", "라우팅", "화면", "master/routing/page.tsx", "routing.controller.ts", "routing.service.ts", "");
addProgram("PG-MST-008", "작업자관리", "기준정보", "작업자", "화면", "master/worker/page.tsx", "worker.controller.ts", "worker.service.ts", "");
addProgram("PG-MST-009", "작업지도서관리", "기준정보", "작업지도서", "화면", "master/work-instruction/page.tsx", "work-instruction.controller.ts", "work-instruction.service.ts", "");
addProgram("PG-MST-010", "창고관리", "기준정보", "창고", "화면", "master/warehouse/page.tsx", "warehouse-location.controller.ts", "warehouse-location.service.ts", "");
addProgram("PG-MST-011", "라벨관리", "기준정보", "라벨", "화면", "master/label/page.tsx", "label-template.controller.ts", "label-template.service.ts", "");
addProgram("PG-MST-012", "제조사 바코드 매핑", "기준정보", "바코드", "화면", "master/vendor-barcode/page.tsx", "vendor-barcode-mapping.controller.ts", "vendor-barcode-mapping.service.ts", "");
addProgram("PG-MST-013", "IQC검사항목/그룹", "기준정보", "IQC", "화면", "master/iqc-item/page.tsx", "iqc-item.controller.ts", "iqc-item.service.ts", "");
addProgram("PG-MST-014", "설비별 점검항목", "기준정보", "설비점검", "화면", "master/equip-inspect/page.tsx", "equip-inspect.controller.ts", "equip-inspect.service.ts", "마스터");
addProgram("PG-MST-015", "점검항목마스터", "기준정보", "설비점검", "화면", "master/equip-inspect-item/page.tsx", "equip-inspect.controller.ts", "equip-inspect.service.ts", "");
addProgram("PG-MST-016", "문서관리", "기준정보", "문서", "화면", "system/document/page.tsx", "document.controller.ts", "document.service.ts", "");
addProgram("PG-MST-017", "코드관리", "기준정보", "공통코드", "화면", "master/code/page.tsx", "com-code.controller.ts", "com-code.service.ts", "");
addProgram("PG-MST-018", "계측기마스터", "기준정보", "계측기", "화면", "master/gauge/page.tsx", "msa.controller.ts", "msa.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 4. 자재재고관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-INV-001", "자재재고현황조회", "자재재고관리", "재고현황", "화면", "inventory/material-stock/page.tsx", "mat-stock.controller.ts", "mat-stock.service.ts", "");
addProgram("PG-INV-002", "자재수불이력조회", "자재재고관리", "수불이력", "화면", "inventory/transaction/page.tsx", "inventory.controller.ts", "inventory.service.ts", "");
addProgram("PG-INV-003", "자재재고실사관리", "자재재고관리", "재고실사", "화면", "inventory/material-physical-inv/page.tsx", "physical-inv.controller.ts", "physical-inv.service.ts", "");
addProgram("PG-INV-004", "자재재고실사조회", "자재재고관리", "재고실사", "화면", "inventory/material-physical-inv-history/page.tsx", "physical-inv.controller.ts", "physical-inv.service.ts", "이력조회");
addProgram("PG-INV-005", "입하재고현황조회", "자재재고관리", "입하재고", "화면", "material/arrival-stock/page.tsx", "arrival.controller.ts", "arrival.service.ts", "");
addProgram("PG-INV-006", "자재재고홀드관리", "자재재고관리", "홀드", "화면", "material/hold/page.tsx", "hold.controller.ts", "hold.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 5. 제품재고관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-PINV-001", "제품재고현황조회", "제품재고관리", "재고현황", "화면", "inventory/stock/page.tsx", "inventory.controller.ts", "product-inventory.service.ts", "");
addProgram("PG-PINV-002", "제품재고실사관리", "제품재고관리", "재고실사", "화면", "inventory/product-physical-inv/page.tsx", "product-physical-inv.controller.ts", "product-physical-inv.service.ts", "");
addProgram("PG-PINV-003", "제품재고실사조회", "제품재고관리", "재고실사", "화면", "inventory/product-physical-inv-history/page.tsx", "product-physical-inv.controller.ts", "product-physical-inv.service.ts", "이력조회");
addProgram("PG-PINV-004", "제품재고홀드관리", "제품재고관리", "홀드", "화면", "inventory/product-hold/page.tsx", "product-hold.controller.ts", "product-hold.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 6. 제품수불관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-PMGT-001", "제품입고관리", "제품수불관리", "입고", "화면", "product/receive/page.tsx", "production-views.controller.ts", "production-views.service.ts", "");
addProgram("PG-PMGT-002", "제품입고취소", "제품수불관리", "입고취소", "화면", "product/receipt-cancel/page.tsx", "production-views.controller.ts", "production-views.service.ts", "");
addProgram("PG-PMGT-003", "제품출고관리", "제품수불관리", "출고", "화면", "product/issue/page.tsx", "production-views.controller.ts", "production-views.service.ts", "");
addProgram("PG-PMGT-004", "제품출고취소", "제품수불관리", "출고취소", "화면", "product/issue-cancel/page.tsx", "production-views.controller.ts", "production-views.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 7. 자재수불관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-MAT-001", "입하관리", "자재수불관리", "입하", "화면", "material/arrival/page.tsx", "arrival.controller.ts", "arrival.service.ts", "");
addProgram("PG-MAT-002", "입고라벨발행", "자재수불관리", "라벨", "화면", "material/receive-label/page.tsx", "receive-label.controller.ts", "receive-label.service.ts", "");
addProgram("PG-MAT-003", "자재입고관리", "자재수불관리", "입고", "화면", "material/receive/page.tsx", "receiving.controller.ts", "receiving.service.ts", "");
addProgram("PG-MAT-004", "입고이력조회", "자재수불관리", "입고", "화면", "material/receive-history/page.tsx", "receiving.controller.ts", "receiving.service.ts", "이력조회");
addProgram("PG-MAT-005", "출고요청관리", "자재수불관리", "출고요청", "화면", "material/request/page.tsx", "issue-request.controller.ts", "issue-request.service.ts", "");
addProgram("PG-MAT-006", "자재출고관리", "자재수불관리", "출고", "화면", "material/issue/page.tsx", "mat-issue.controller.ts", "mat-issue.service.ts", "");
addProgram("PG-MAT-007", "LOT관리", "자재수불관리", "LOT", "화면", "material/lot/page.tsx", "mat-lot.controller.ts", "mat-lot.service.ts", "");
addProgram("PG-MAT-008", "자재분할관리", "자재수불관리", "LOT분할", "화면", "material/lot-split/page.tsx", "lot-split.controller.ts", "lot-split.service.ts", "");
addProgram("PG-MAT-009", "자재병합관리", "자재수불관리", "LOT병합", "화면", "material/lot-merge/page.tsx", "lot-merge.controller.ts", "lot-merge.service.ts", "");
addProgram("PG-MAT-010", "자재유수명관리", "자재수불관리", "유수명", "화면", "material/shelf-life/page.tsx", "shelf-life.controller.ts", "shelf-life.service.ts", "");
addProgram("PG-MAT-011", "자재폐기처리", "자재수불관리", "폐기", "화면", "material/scrap/page.tsx", "scrap.controller.ts", "scrap.service.ts", "");
addProgram("PG-MAT-012", "재고보정처리", "자재수불관리", "보정", "화면", "material/adjustment/page.tsx", "adjustment.controller.ts", "adjustment.service.ts", "");
addProgram("PG-MAT-013", "기타입고관리", "자재수불관리", "기타입고", "화면", "material/misc-receipt/page.tsx", "misc-receipt.controller.ts", "misc-receipt.service.ts", "");
addProgram("PG-MAT-014", "자재입고취소", "자재수불관리", "입고취소", "화면", "material/receipt-cancel/page.tsx", "receipt-cancel.controller.ts", "receipt-cancel.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 8. 자재주문관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-PUR-001", "PO관리", "자재주문관리", "PO", "화면", "material/po/page.tsx", "purchase-order.controller.ts", "purchase-order.service.ts", "");
addProgram("PG-PUR-002", "PO현황조회", "자재주문관리", "PO현황", "화면", "material/po-status/page.tsx", "po-status.controller.ts", "po-status.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 9. 생산관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-PRD-001", "월간생산계획", "생산관리", "생산계획", "화면", "production/monthly-plan/page.tsx", "prod-plan.controller.ts", "prod-plan.service.ts", "");
addProgram("PG-PRD-002", "작업지시관리", "생산관리", "작업지시", "화면", "production/order/page.tsx", "job-order.controller.ts", "job-order.service.ts", "");
addProgram("PG-PRD-003", "생산실적조회", "생산관리", "실적", "화면", "production/result/page.tsx", "prod-result.controller.ts", "prod-result.service.ts", "");
addProgram("PG-PRD-004", "작업지시현황조회", "생산관리", "진행현황", "화면", "production/progress/page.tsx", "production-views.controller.ts", "production-views.service.ts", "");
addProgram("PG-PRD-005", "실적입력(수작업)", "생산관리", "실적입력", "화면", "production/input-manual/page.tsx", "prod-result.controller.ts", "prod-result.service.ts", "");
addProgram("PG-PRD-006", "실적입력(가공)", "생산관리", "실적입력", "화면", "production/input-machine/page.tsx", "prod-result.controller.ts", "prod-result.service.ts", "");
addProgram("PG-PRD-007", "실적입력(단순검사)", "생산관리", "실적입력", "화면", "production/input-inspect/page.tsx", "prod-result.controller.ts", "prod-result.service.ts", "");
addProgram("PG-PRD-008", "실적입력(검사장비)", "생산관리", "실적입력", "화면", "production/input-equip/page.tsx", "prod-result.controller.ts", "prod-result.service.ts", "");
addProgram("PG-PRD-009", "작업실적통합조회", "생산관리", "실적통합", "화면", "production/result-summary/page.tsx", "prod-result.controller.ts", "prod-result.service.ts", "");
addProgram("PG-PRD-010", "반제품/제품재고조회", "생산관리", "WIP재고", "화면", "production/wip-stock/page.tsx", "production-views.controller.ts", "production-views.service.ts", "");
addProgram("PG-PRD-011", "재작업 지시", "생산관리", "재작업", "화면", "quality/rework/page.tsx", "rework.controller.ts", "rework.service.ts", "");
addProgram("PG-PRD-012", "재작업 현황", "생산관리", "재작업", "화면", "quality/rework-history/page.tsx", "rework.controller.ts", "rework.service.ts", "이력조회");
addProgram("PG-PRD-013", "수리관리", "생산관리", "수리", "화면", "production/repair/page.tsx", "repair.controller.ts", "repair.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 10. 통전검사
// ═══════════════════════════════════════════════════════════════
addProgram("PG-INSP-001", "통전검사관리", "통전검사", "검사", "화면", "inspection/result/page.tsx", "continuity-inspect.controller.ts", "continuity-inspect.service.ts", "");
addProgram("PG-INSP-002", "통전검사이력", "통전검사", "이력", "화면", "inspection/history/page.tsx", "continuity-inspect.controller.ts", "continuity-inspect.service.ts", "");
addProgram("PG-INSP-003", "검사기프로토콜", "통전검사", "프로토콜", "화면", "inspection/protocol/page.tsx", "continuity-inspect.controller.ts", "continuity-inspect.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 11. 품질관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-QC-001", "수입검사(IQC)", "품질관리", "IQC", "화면", "material/iqc/page.tsx", "iqc-history.controller.ts", "iqc-history.service.ts", "");
addProgram("PG-QC-002", "수입검사이력조회", "품질관리", "IQC이력", "화면", "material/iqc-history/page.tsx", "iqc-history.controller.ts", "iqc-history.service.ts", "");
addProgram("PG-QC-003", "불량등록관리", "품질관리", "불량", "화면", "quality/defect/page.tsx", "defect-log.controller.ts", "defect-log.service.ts", "");
addProgram("PG-QC-004", "재작업 후 검사", "품질관리", "재작업검사", "화면", "quality/rework-inspect/page.tsx", "rework.controller.ts", "rework.service.ts", "");
addProgram("PG-QC-005", "외관검사", "품질관리", "외관검사", "화면", "quality/inspect/page.tsx", "inspect-result.controller.ts", "inspect-result.service.ts", "");
addProgram("PG-QC-006", "샘플검사이력조회", "품질관리", "샘플검사", "화면", "production/sample-inspect/page.tsx", "sample-inspect.controller.ts", "sample-inspect.service.ts", "");
addProgram("PG-QC-007", "출하검사(OQC)", "품질관리", "OQC", "화면", "quality/oqc/page.tsx", "oqc.controller.ts", "oqc.service.ts", "");
addProgram("PG-QC-008", "출하검사이력조회", "품질관리", "OQC이력", "화면", "quality/oqc-history/page.tsx", "oqc.controller.ts", "oqc.service.ts", "");
addProgram("PG-QC-009", "추적성조회", "품질관리", "추적", "화면", "quality/trace/page.tsx", "-", "-", "프론트 only");
addProgram("PG-QC-010", "변경점관리", "품질관리", "변경점", "화면", "quality/change-control/page.tsx", "change-order.controller.ts", "change-order.service.ts", "");
addProgram("PG-QC-011", "고객클레임", "품질관리", "클레임", "화면", "quality/complaint/page.tsx", "complaint.controller.ts", "complaint.service.ts", "");
addProgram("PG-QC-012", "CAPA관리", "품질관리", "CAPA", "화면", "quality/capa/page.tsx", "capa.controller.ts", "capa.service.ts", "");
addProgram("PG-QC-013", "초물검사", "품질관리", "FAI", "화면", "quality/fai/page.tsx", "fai.controller.ts", "fai.service.ts", "");
addProgram("PG-QC-014", "PPAP관리", "품질관리", "PPAP", "화면", "quality/ppap/page.tsx", "ppap.controller.ts", "ppap.service.ts", "");
addProgram("PG-QC-015", "SPC관리", "품질관리", "SPC", "화면", "quality/spc/page.tsx", "-", "-", "");
addProgram("PG-QC-016", "관리계획서", "품질관리", "CP", "화면", "quality/control-plan/page.tsx", "control-plan.controller.ts", "control-plan.service.ts", "");
addProgram("PG-QC-017", "내부심사", "품질관리", "심사", "화면", "quality/audit/page.tsx", "audit.controller.ts", "audit.service.ts", "");
addProgram("PG-QC-018", "교육훈련", "품질관리", "교육", "화면", "system/training/page.tsx", "training.controller.ts", "training.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 12. 설비관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-EQ-001", "금형관리", "설비관리", "금형", "화면", "equipment/mold-mgmt/page.tsx", "mold.controller.ts", "mold.service.ts", "");
addProgram("PG-EQ-002", "일상점검 캘린더", "설비관리", "일상점검", "화면", "equipment/inspect-calendar/page.tsx", "daily-inspect.controller.ts", "equip-inspect.service.ts", "");
addProgram("PG-EQ-003", "일상점검 결과", "설비관리", "일상점검", "화면", "equipment/daily-inspect/page.tsx", "daily-inspect.controller.ts", "equip-inspect.service.ts", "");
addProgram("PG-EQ-004", "정기점검 캘린더", "설비관리", "정기점검", "화면", "equipment/periodic-inspect-calendar/page.tsx", "periodic-inspect.controller.ts", "equip-inspect.service.ts", "");
addProgram("PG-EQ-005", "정기점검 결과", "설비관리", "정기점검", "화면", "equipment/periodic-inspect/page.tsx", "periodic-inspect.controller.ts", "equip-inspect.service.ts", "");
addProgram("PG-EQ-006", "점검이력 조회", "설비관리", "점검이력", "화면", "equipment/inspect-history/page.tsx", "inspect-history.controller.ts", "equip-inspect.service.ts", "");
addProgram("PG-EQ-007", "PM 계획", "설비관리", "예방보전", "화면", "equipment/pm-plan/page.tsx", "pm-plan.controller.ts", "pm-plan.service.ts", "");
addProgram("PG-EQ-008", "PM 캘린더", "설비관리", "예방보전", "화면", "equipment/pm-calendar/page.tsx", "pm-plan.controller.ts", "pm-plan.service.ts", "");
addProgram("PG-EQ-009", "PM 보전결과", "설비관리", "예방보전", "화면", "equipment/pm-result/page.tsx", "pm-plan.controller.ts", "pm-plan.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 13. 계측기관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-GAU-001", "계측기 교정관리", "계측기관리", "교정", "화면", "quality/msa/page.tsx", "msa.controller.ts", "msa.service.ts", "");
addProgram("PG-GAU-002", "교정이력 조회", "계측기관리", "이력", "화면", "equipment/calibration-history/page.tsx", "msa.controller.ts", "msa.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 14. 출하관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-SHP-001", "포장실적조회", "출하관리", "포장", "화면", "production/pack-result/page.tsx", "production-views.controller.ts", "production-views.service.ts", "");
addProgram("PG-SHP-002", "제품포장관리", "출하관리", "포장", "화면", "shipping/pack/page.tsx", "box.controller.ts", "box.service.ts", "");
addProgram("PG-SHP-003", "팔레트적재관리", "출하관리", "팔레트", "화면", "shipping/pallet/page.tsx", "pallet.controller.ts", "pallet.service.ts", "");
addProgram("PG-SHP-004", "출하확정처리", "출하관리", "출하확정", "화면", "shipping/confirm/page.tsx", "shipment.controller.ts", "shipment.service.ts", "");
addProgram("PG-SHP-005", "출하지시등록", "출하관리", "출하지시", "화면", "shipping/order/page.tsx", "ship-order.controller.ts", "ship-order.service.ts", "");
addProgram("PG-SHP-006", "출하이력조회", "출하관리", "이력", "화면", "shipping/history/page.tsx", "ship-history.controller.ts", "ship-history.service.ts", "");
addProgram("PG-SHP-007", "출하반품등록", "출하관리", "반품", "화면", "shipping/return/page.tsx", "ship-return.controller.ts", "ship-return.service.ts", "");
addProgram("PG-SHP-008", "고객발주관리", "출하관리", "고객PO", "화면", "shipping/customer-po/page.tsx", "customer-order.controller.ts", "customer-order.service.ts", "");
addProgram("PG-SHP-009", "고객발주현황조회", "출하관리", "고객PO현황", "화면", "shipping/customer-po-status/page.tsx", "customer-order.controller.ts", "customer-order.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 15. 보세관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-CUS-001", "수입신고관리", "보세관리", "수입신고", "화면", "customs/entry/page.tsx", "customs.controller.ts", "customs.service.ts", "");
addProgram("PG-CUS-002", "보세재고조회", "보세관리", "재고", "화면", "customs/stock/page.tsx", "customs.controller.ts", "customs.service.ts", "");
addProgram("PG-CUS-003", "사용신고관리", "보세관리", "사용신고", "화면", "customs/usage/page.tsx", "customs.controller.ts", "customs.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 16. 소모품관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-CON-001", "소모품관리", "소모품관리", "마스터", "화면", "consumables/master/page.tsx", "consumables.controller.ts", "consumables.service.ts", "");
addProgram("PG-CON-002", "소모품라벨발행", "소모품관리", "라벨", "화면", "consumables/label/page.tsx", "consumable-label.controller.ts", "consumable-label.service.ts", "");
addProgram("PG-CON-003", "소모품입고관리", "소모품관리", "입고", "화면", "consumables/receiving/page.tsx", "consumables.controller.ts", "consumables.service.ts", "");
addProgram("PG-CON-004", "소모품출고관리", "소모품관리", "출고", "화면", "consumables/issuing/page.tsx", "consumables.controller.ts", "consumables.service.ts", "");
addProgram("PG-CON-005", "소모품재고현황조회", "소모품관리", "재고", "화면", "consumables/stock/page.tsx", "consumable-stock.controller.ts", "consumables.service.ts", "");
addProgram("PG-CON-006", "소모품수명현황조회", "소모품관리", "수명", "화면", "consumables/life/page.tsx", "consumables.controller.ts", "consumables.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 17. 외주관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-OUT-001", "외주처관리", "외주관리", "외주처", "화면", "outsourcing/vendor/page.tsx", "outsourcing.controller.ts", "outsourcing.service.ts", "");
addProgram("PG-OUT-002", "외주발주관리", "외주관리", "발주", "화면", "outsourcing/order/page.tsx", "outsourcing.controller.ts", "outsourcing.service.ts", "");
addProgram("PG-OUT-003", "외주입고관리", "외주관리", "입고", "화면", "outsourcing/receive/page.tsx", "outsourcing.controller.ts", "outsourcing.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 18. 인터페이스
// ═══════════════════════════════════════════════════════════════
addProgram("PG-IF-001", "ERP연동현황조회", "인터페이스", "현황", "화면", "interface/dashboard/page.tsx", "interface.controller.ts", "interface.service.ts", "");
addProgram("PG-IF-002", "전송이력조회", "인터페이스", "이력", "화면", "interface/log/page.tsx", "interface.controller.ts", "interface.service.ts", "");
addProgram("PG-IF-003", "수동전송처리", "인터페이스", "수동전송", "화면", "interface/manual/page.tsx", "interface.controller.ts", "interface.service.ts", "");
addProgram("PG-IF-004", "작업지시 수신(ERP→MES)", "인터페이스", "Inbound", "I/F", "-", "interface.controller.ts", "interface.service.ts", "ERP 연동");
addProgram("PG-IF-005", "BOM 동기화(ERP→MES)", "인터페이스", "Inbound", "I/F", "-", "interface.controller.ts", "interface.service.ts", "ERP 연동");
addProgram("PG-IF-006", "품목마스터 동기화(ERP→MES)", "인터페이스", "Inbound", "I/F", "-", "interface.controller.ts", "interface.service.ts", "ERP 연동");
addProgram("PG-IF-007", "생산실적 전송(MES→ERP)", "인터페이스", "Outbound", "I/F", "-", "interface.controller.ts", "interface.service.ts", "ERP 연동");

// ═══════════════════════════════════════════════════════════════
// 19. 시스템관리
// ═══════════════════════════════════════════════════════════════
addProgram("PG-SYS-001", "회사관리", "시스템관리", "회사", "화면", "master/company/page.tsx", "company.controller.ts", "company.service.ts", "");
addProgram("PG-SYS-002", "부서관리", "시스템관리", "부서", "화면", "system/department/page.tsx", "department.controller.ts", "department.service.ts", "");
addProgram("PG-SYS-003", "사용자관리", "시스템관리", "사용자", "화면", "system/users/page.tsx", "user.controller.ts", "user.service.ts", "");
addProgram("PG-SYS-004", "역할관리", "시스템관리", "역할", "화면", "system/roles/page.tsx", "role.controller.ts", "role.service.ts", "");
addProgram("PG-SYS-005", "PDA 역할관리", "시스템관리", "PDA역할", "화면", "system/pda-roles/page.tsx", "pda-role.controller.ts", "pda-role.service.ts", "");
addProgram("PG-SYS-006", "통신설정관리", "시스템관리", "통신", "화면", "system/comm-config/page.tsx", "comm-config.controller.ts", "comm-config.service.ts", "");
addProgram("PG-SYS-007", "환경설정", "시스템관리", "설정", "화면", "system/config/page.tsx", "sys-config.controller.ts", "sys-config.service.ts", "");
addProgram("PG-SYS-008", "스케줄러관리", "시스템관리", "스케줄러", "화면", "system/scheduler/page.tsx", "scheduler-job.controller.ts", "scheduler-job.service.ts", "");

// ═══════════════════════════════════════════════════════════════
// 20. PDA 화면
// ═══════════════════════════════════════════════════════════════
addProgram("PG-PDA-001", "PDA 로그인", "PDA", "인증", "화면", "pda/login/page.tsx", "auth.controller.ts", "auth.service.ts", "모바일");
addProgram("PG-PDA-002", "PDA 메인메뉴", "PDA", "메뉴", "화면", "pda/menu/page.tsx", "-", "-", "모바일");
addProgram("PG-PDA-003", "PDA 자재입고", "PDA", "자재관리", "화면", "pda/material/receiving/page.tsx", "receiving.controller.ts", "receiving.service.ts", "모바일");
addProgram("PG-PDA-004", "PDA 자재출고", "PDA", "자재관리", "화면", "pda/material/issuing/page.tsx", "mat-issue.controller.ts", "mat-issue.service.ts", "모바일");
addProgram("PG-PDA-005", "PDA 재고조정", "PDA", "자재관리", "화면", "pda/material/adjustment/page.tsx", "adjustment.controller.ts", "adjustment.service.ts", "모바일");
addProgram("PG-PDA-006", "PDA 자재재고실사", "PDA", "자재관리", "화면", "pda/material/inventory-count/page.tsx", "physical-inv.controller.ts", "physical-inv.service.ts", "모바일");
addProgram("PG-PDA-007", "PDA 제품재고실사", "PDA", "제품관리", "화면", "pda/product/inventory-count/page.tsx", "product-physical-inv.controller.ts", "product-physical-inv.service.ts", "모바일");
addProgram("PG-PDA-008", "PDA 출하등록", "PDA", "출하", "화면", "pda/shipping/page.tsx", "shipment.controller.ts", "shipment.service.ts", "모바일");
addProgram("PG-PDA-009", "PDA 설비일상점검", "PDA", "설비", "화면", "pda/equip-inspect/page.tsx", "daily-inspect.controller.ts", "equip-inspect.service.ts", "모바일");
addProgram("PG-PDA-010", "PDA 설정", "PDA", "설정", "화면", "pda/settings/page.tsx", "-", "-", "모바일");

// ═══════════════════════════════════════════════════════════════
// 21. 배치/스케줄러
// ═══════════════════════════════════════════════════════════════
addProgram("PG-BAT-001", "Script Executor", "배치", "스케줄러", "배치", "-", "-", "scheduler-runner.service.ts", "스크립트 실행");
addProgram("PG-BAT-002", "HTTP Executor", "배치", "스케줄러", "배치", "-", "-", "scheduler-runner.service.ts", "HTTP 호출");
addProgram("PG-BAT-003", "SQL Executor", "배치", "스케줄러", "배치", "-", "-", "scheduler-runner.service.ts", "SQL 실행");
addProgram("PG-BAT-004", "Procedure Executor", "배치", "스케줄러", "배치", "-", "-", "scheduler-runner.service.ts", "프로시저 실행");
addProgram("PG-BAT-005", "Service Executor", "배치", "스케줄러", "배치", "-", "-", "scheduler-runner.service.ts", "서비스 호출");

// ═══════════════════════════════════════════════════════════════
// 22. 공통 프로그램
// ═══════════════════════════════════════════════════════════════
addProgram("PG-COM-001", "사용자 인증(JWT)", "공통", "인증", "공통", "-", "auth.controller.ts", "auth.service.ts", "로그인/회원가입");
addProgram("PG-COM-002", "채번 서비스", "공통", "채번", "공통", "-", "-", "num-rule.service.ts", "자동채번 생성");
addProgram("PG-COM-003", "라벨 인쇄(ZPL)", "공통", "라벨", "공통", "-", "label-print.controller.ts", "label-print.service.ts", "TCP 프린터");
addProgram("PG-COM-004", "자재 자동출고", "공통", "자동출고", "공통", "-", "-", "auto-issue.service.ts", "생산 연동");
addProgram("PG-COM-005", "활동 로그", "공통", "로그", "공통", "-", "activity-log.controller.ts", "activity-log.service.ts", "감사추적");
addProgram("PG-COM-006", "알림 서비스", "공통", "알림", "공통", "-", "scheduler-noti.controller.ts", "scheduler-noti.service.ts", "벨 알림");

// ═══════════════════════════════════════════════════════════════
// 통계 계산
// ═══════════════════════════════════════════════════════════════
const stats = { "화면": 0, "배치": 0, "I/F": 0, "공통": 0 };
programs.forEach(p => { if (stats[p.type] !== undefined) stats[p.type]++; });

// ── 테이블 헬퍼 ──
const COL_WIDTHS = [550, 1200, 2200, 1300, 1100, 650, 2700, 2600, 2538];
// No, ID, 프로그램명, 대분류, 소분류, 유형, 화면파일, 컨트롤러, 서비스

function headerCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: headerShading, margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: "FFFFFF", font: FONT, size: 18 })],
    })],
  });
}

function dataCell(text, width, opts = {}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    shading: opts.shading,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), font: FONT, size: 16, ...opts.run })],
    })],
  });
}

function statCell(label, value, width, isHeader) {
  if (isHeader) return headerCell(label, width);
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: String(value), font: FONT, size: 20, bold: true })],
    })],
  });
}

// ── 통계 테이블 ──
const statTableW = 8000;
const statColW = statTableW / 5;
const statsTable = new Table({
  width: { size: statTableW, type: WidthType.DXA },
  columnWidths: Array(5).fill(statColW),
  rows: [
    new TableRow({ children: [
      headerCell("화면", statColW), headerCell("배치", statColW),
      headerCell("I/F", statColW), headerCell("공통", statColW),
      headerCell("합계", statColW),
    ]}),
    new TableRow({ children: [
      statCell("", stats["화면"], statColW), statCell("", stats["배치"], statColW),
      statCell("", stats["I/F"], statColW), statCell("", stats["공통"], statColW),
      statCell("", programs.length, statColW),
    ]}),
  ],
});

// ── 프로그램 목록 테이블 ──
const TABLE_W = CONTENT_W;
const headerRow = new TableRow({
  tableHeader: true,
  children: [
    headerCell("No", COL_WIDTHS[0]),
    headerCell("프로그램ID", COL_WIDTHS[1]),
    headerCell("프로그램명", COL_WIDTHS[2]),
    headerCell("대분류", COL_WIDTHS[3]),
    headerCell("소분류", COL_WIDTHS[4]),
    headerCell("유형", COL_WIDTHS[5]),
    headerCell("화면파일(프론트)", COL_WIDTHS[6]),
    headerCell("컨트롤러(백엔드)", COL_WIDTHS[7]),
    headerCell("서비스(백엔드)", COL_WIDTHS[8]),
  ],
});

let prevCat1 = "";
const dataRows = [];
programs.forEach((p) => {
  const isNewCat = p.cat1 !== prevCat1;
  prevCat1 = p.cat1;
  const rowShading = isNewCat ? { fill: "F2F7FB", type: ShadingType.CLEAR } : undefined;

  dataRows.push(new TableRow({
    children: [
      dataCell(p.no, COL_WIDTHS[0], { center: true, shading: rowShading }),
      dataCell(p.id, COL_WIDTHS[1], { center: true, shading: rowShading, run: { size: 15 } }),
      dataCell(p.name, COL_WIDTHS[2], { shading: rowShading }),
      dataCell(p.cat1, COL_WIDTHS[3], { center: true, shading: rowShading }),
      dataCell(p.cat2, COL_WIDTHS[4], { center: true, shading: rowShading }),
      dataCell(p.type, COL_WIDTHS[5], { center: true, shading: rowShading }),
      dataCell(p.frontFile, COL_WIDTHS[6], { shading: rowShading, run: { size: 14 } }),
      dataCell(p.controller, COL_WIDTHS[7], { shading: rowShading, run: { size: 14 } }),
      dataCell(p.service, COL_WIDTHS[8], { shading: rowShading, run: { size: 14 } }),
    ],
  }));
});

const mainTable = new Table({
  width: { size: TABLE_W, type: WidthType.DXA },
  columnWidths: COL_WIDTHS,
  rows: [headerRow, ...dataRows],
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
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [new TextRun({ text: "HANES MES", font: FONT, size: 60, bold: true, color: "1F4E79" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "전체 프로그램 목록표", font: FONT, size: 48, bold: true, color: "2E75B6" })],
        }),
        new Paragraph({ spacing: { before: 1200 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `프로젝트명: HANES MES (Manufacturing Execution System)`, font: FONT, size: 24, color: "444444" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120 },
          children: [new TextRun({ text: `작성일: ${today}`, font: FONT, size: 24, color: "444444" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120 },
          children: [new TextRun({ text: `버전: 1.0`, font: FONT, size: 24, color: "444444" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120 },
          children: [new TextRun({ text: `기술스택: NestJS + Next.js + Oracle DB`, font: FONT, size: 24, color: "444444" })],
        }),
      ],
    },
    // ── 개정이력 + 목차 + 본문 ──
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
            children: [new TextRun({ text: "HANES MES - 전체 프로그램 목록표", font: FONT, size: 16, color: "888888", italics: true })],
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
        // ── 개정이력 ──
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("개정이력")] }),
        new Table({
          width: { size: 10000, type: WidthType.DXA },
          columnWidths: [1500, 1000, 2000, 5500],
          rows: [
            new TableRow({ children: [
              headerCell("날짜", 1500), headerCell("버전", 1000),
              headerCell("작성자", 2000), headerCell("변경내용", 5500),
            ]}),
            new TableRow({ children: [
              dataCell(today, 1500, { center: true }),
              dataCell("1.0", 1000, { center: true }),
              dataCell("시스템 자동생성", 2000, { center: true }),
              dataCell("초기 작성 - 코드 자동 추출", 5500),
            ]}),
          ],
        }),

        // ── 목차 ──
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("목차")] }),
        new TableOfContents("목차", { hyperlink: true, headingStyleRange: "1-3" }),

        // ── 1. 개요 ──
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. 개요")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.1 목적")] }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({
            text: "본 문서는 HANES MES(Manufacturing Execution System) 시스템을 구성하는 전체 프로그램의 목록을 정의한다. 화면(PC Web/PDA), 배치, 인터페이스, 공통 프로그램을 포함하며, 각 프로그램의 프론트엔드/백엔드 구성 파일을 매핑하여 개발 및 유지보수 시 참조 자료로 활용한다.",
            font: FONT, size: 22,
          })],
        }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.2 범위")] }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({
            text: "HANES MES 전체 모듈 (기준정보, 자재관리, 생산관리, 품질관리, 설비관리, 출하관리, 보세관리, 소모품관리, 외주관리, 인터페이스, 시스템관리, PDA)을 대상으로 한다.",
            font: FONT, size: 22,
          })],
        }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.3 프로그램 분류 체계")] }),
        new Table({
          width: { size: 10000, type: WidthType.DXA },
          columnWidths: [1500, 1000, 7500],
          rows: [
            new TableRow({ children: [
              headerCell("유형", 1500), headerCell("코드", 1000), headerCell("설명", 7500),
            ]}),
            ...([
              ["화면", "화면", "사용자 UI가 있는 프로그램 (PC Web, PDA)"],
              ["배치", "배치", "스케줄러/배치로 자동 실행되는 프로그램"],
              ["인터페이스", "I/F", "외부 시스템(ERP) 연동 프로그램"],
              ["공통", "공통", "여러 모듈에서 공유하는 서비스/유틸리티"],
            ].map(([t, c, d]) => new TableRow({ children: [
              dataCell(t, 1500, { center: true }), dataCell(c, 1000, { center: true }), dataCell(d, 7500),
            ]}))),
          ],
        }),

        // ── 2. 프로그램 목록 요약 ──
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. 프로그램 목록 요약")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 유형별 통계")] }),
        statsTable,
        new Paragraph({ spacing: { before: 200 }, children: [] }),

        // ── 3. 프로그램 목록 상세 ──
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. 프로그램 목록 상세")] }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({
            text: `총 ${programs.length}개 프로그램이 등록되어 있으며, 대분류별로 정렬되어 있다.`,
            font: FONT, size: 20,
          })],
        }),
        mainTable,
      ],
    },
  ],
});

// ── 파일 출력 ──
const outDir = path.join(__dirname, "..", "docs", "deliverables", "all");
const outFile = path.join(outDir, `전체프로그램목록표_${today}.docx`);

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outFile, buffer);
  console.log(`✅ 생성 완료: ${outFile}`);
  console.log(`   총 프로그램: ${programs.length}개`);
  console.log(`   - 화면: ${stats["화면"]}개 (PC Web + PDA)`);
  console.log(`   - 배치: ${stats["배치"]}개`);
  console.log(`   - I/F: ${stats["I/F"]}개`);
  console.log(`   - 공통: ${stats["공통"]}개`);
}).catch(err => {
  console.error("❌ 생성 실패:", err);
  process.exit(1);
});
