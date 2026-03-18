/**
 * @file scripts/gen-screen-design-receiving.js
 * @description 자재입고(Receiving) 화면설계서 Word 문서 생성 스크립트
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CW = 13440;
const MARGIN = 1200;
const C = {
  primary: '2B579A', hdr: 'D5E8F0', hdr2: 'E8F0FE',
  alt: 'F5F9FC', w: 'FFFFFF', search: 'E8F0FE', grid: 'F0F4F8',
  form: 'FFF8E1', btn: 'FCE4EC', modal: 'E8F5E9',
};
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const tbs = { top: tb, bottom: tb, left: tb, right: tb };

function c(text, width, opts = {}) {
  return new TableCell({
    borders: tbs, width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    columnSpan: opts.span, verticalAlign: 'center',
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT, spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: text || '', bold: opts.bold || false, font: 'Arial', size: opts.size || 17, color: opts.color || '000000' })],
    })],
  });
}

function multiCell(lines, width, opts = {}) {
  return new TableCell({
    borders: tbs, width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    columnSpan: opts.span, verticalAlign: 'top',
    children: lines.map(l => new Paragraph({ spacing: { before: 20, after: 20 }, children: [new TextRun({ text: l, font: 'Arial', size: 16 })] })),
  });
}

function infoTbl(rows) {
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [3000, 10440],
    rows: rows.map(([k, v]) => new TableRow({ children: [c(k, 3000, { bold: true, shading: C.hdr }), c(v, 10440)] })),
  });
}

function dataTbl(headers, data, widths) {
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => c(h, widths[i], { bold: true, shading: C.hdr, align: AlignmentType.CENTER, size: 15 })) }),
      ...data.map((row, idx) => new TableRow({
        children: row.map((val, i) => c(val, widths[i], { size: 15, shading: idx % 2 === 1 ? C.alt : C.w, align: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT })),
      })),
    ],
  });
}

function layoutTbl(rows) {
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [2000, 11440],
    rows: rows.map(([area, desc, bg]) => new TableRow({
      children: [
        c(area, 2000, { bold: true, shading: bg || C.hdr, align: AlignmentType.CENTER }),
        multiCell(desc, 11440),
      ],
    })),
  });
}

function sp(n = 200) { return new Paragraph({ spacing: { after: n }, children: [] }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }

// ── 화면 데이터 ──
const screens = [
  {
    id: 'SC-MAT-ARR', name: '입하관리', menu: '자재관리 > 입하관리',
    type: '조회/등록', apis: 'GET/POST /material/arrivals, GET /material/arrivals/stats, receivable-pos',
    layout: [
      ['헤더 영역', ['아이콘: Truck + 제목: "입하관리"', '설명: "PO 기반/수동 입하 등록 및 이력 관리"', '버튼: [새로고침] [PO 입하 등록] [수동 입하 등록]'], C.hdr2],
      ['통계 카드', ['4열 StatCard 배치:', '  금일 입하건수 (PackageCheck, blue)', '  금일 입하수량 (Package, green)', '  미입하 PO 수 (AlertTriangle, orange)', '  전체 입하건수 (Hash, gray)'], C.hdr],
      ['필터 영역', ['검색: 트랜잭션번호/품목코드/PO번호 (텍스트 입력)', '상태 필터: 전체 / 완료(DONE) / 취소(CANCELED) (Select)'], C.search],
      ['데이터 그리드', ['ArrivalHistoryTable (DataGrid)', '컬럼: 트랜잭션번호, 입하일, PO번호, 품목코드, 품목명, 자재시리얼, 수량(+/- 색상), 창고, 상태(배지), 취소버튼', '페이지네이션: 10건/페이지, 컬럼필터, 엑셀내보내기'], C.grid],
    ],
    items: [
      ['1', 'searchText', '검색어', '필터', '텍스트', 'N', '-', '-', 'Y', 'transNo, itemCode, poNo'],
      ['2', 'statusFilter', '상태', '필터', '셀렉트', 'N', '-', '전체', 'Y', 'DONE/CANCELED'],
      ['3', 'transNo', '트랜잭션번호', '그리드', '텍스트', '-', '180px', '-', 'N', ''],
      ['4', 'transDate', '입하일', '그리드', '날짜', '-', '100px', '-', 'N', '.slice(0,10)'],
      ['5', 'lot.poNo', 'PO번호', '그리드', '텍스트', '-', '130px', '-', 'N', "null → '-'"],
      ['6', 'part.itemCode', '품목코드', '그리드', '텍스트', '-', '110px', '-', 'N', ''],
      ['7', 'part.itemName', '품목명', '그리드', '텍스트', '-', '130px', '-', 'N', ''],
      ['8', 'lot.matUid', '자재시리얼', '그리드', '텍스트', '-', '150px', '-', 'N', ''],
      ['9', 'qty', '수량', '그리드', '숫자', '-', '100px', '-', 'N', '양수=녹색, 음수=빨강'],
      ['10', 'toWarehouse', '창고', '그리드', '텍스트', '-', '100px', '-', 'N', 'warehouseName'],
      ['11', 'status', '상태', '그리드', '배지', '-', '90px', '-', 'N', 'DONE=녹색, CANCELED=빨강'],
      ['12', 'actions', '액션', '그리드', '버튼', '-', '70px', '-', '-', 'MAT_IN+DONE만 표시'],
    ],
    buttons: [
      ['1', '새로고침', '헤더', 'RefreshCw', '통계+이력 재조회', '-', '-', '항상', ''],
      ['2', 'PO 입하 등록', '헤더', 'Plus', 'PO 입하 모달 열기', '-', '-', '항상', 'PoArrivalModal'],
      ['3', '수동 입하 등록', '헤더', 'Plus', '수동 입하 모달 열기', '-', '-', '항상', 'ManualArrivalModal'],
      ['4', '취소', '그리드 행', 'XCircle', '입하 취소 모달 열기', 'POST /material/arrivals/cancel', '-', 'MAT_IN+DONE', 'ArrivalCancelModal'],
    ],
    flow: [
      '페이지 로드 → GET stats + GET arrivals',
      'PO 입하 → GET receivable-pos → PO 선택 → GET po/:poId/items → 수량 입력 → POST po → 새로고침',
      '수동 입하 → 폼 입력 → POST manual → 새로고침',
      '입하 취소 → 취소 사유 입력 → POST cancel → 새로고침',
    ],
    rules: [
      '입하 취소는 MAT_IN 유형 + DONE 상태인 건만 가능',
      '수량 표시: 양수(+녹색), 음수(-빨강) + 단위 표시',
      '상태 배지: DONE=녹색, CANCELED=빨강',
    ],
  },
  {
    id: 'SC-MAT-ARR-PO', name: 'PO 입하 모달', menu: '입하관리 > PO 입하 등록 버튼',
    type: '등록 (모달)', apis: 'GET /material/arrivals/receivable-pos, GET /po/:poId/items, POST /material/arrivals/po',
    layout: [
      ['Step 1', ['PO 선택 화면:', '  PO 목록 DataGrid (6컬럼)', '  행 클릭 → Step 2 전환'], C.hdr2],
      ['Step 2', ['품목별 입하 수량 입력:', '  PO 품목 DataGrid (8컬럼)', '  인라인 편집: 수량, 제조일자, 창고', '  뒤로가기 버튼 (Step 1 복귀)', '  등록 버튼'], C.form],
    ],
    items: [
      ['1', 'poNo', 'PO번호', 'Step1 그리드', '텍스트', '-', '140px', '-', 'N', ''],
      ['2', 'partnerName', '공급처', 'Step1 그리드', '텍스트', '-', '120px', '-', 'N', ''],
      ['3', 'orderDate', '발주일', 'Step1 그리드', '날짜', '-', '100px', '-', 'N', ''],
      ['4', 'dueDate', '납기일', 'Step1 그리드', '날짜', '-', '100px', '-', 'N', ''],
      ['5', 'status', '상태', 'Step1 그리드', '배지', '-', '90px', '-', 'N', 'PARTIAL=노랑, 기타=파랑'],
      ['6', 'remaining', '잔량', 'Step1 그리드', '숫자', '-', '100px', '-', 'N', 'totalRemainingQty'],
      ['7', 'partCode', '품목코드', 'Step2 그리드', '텍스트', '-', '110px', '-', 'N', ''],
      ['8', 'partName', '품목명', 'Step2 그리드', '텍스트', '-', '130px', '-', 'N', ''],
      ['9', 'orderQty', '발주수량', 'Step2 그리드', '숫자', '-', '80px', '-', 'N', ''],
      ['10', 'receivedQty', '기입하수량', 'Step2 그리드', '숫자', '-', '80px', '-', 'N', ''],
      ['11', 'remainingQty', '잔량', 'Step2 그리드', '숫자', '-', '80px', '-', 'N', '주황색'],
      ['12', 'inputQty', '이번 수량', 'Step2 그리드', '숫자 입력', 'Y', '100px', '0', 'Y', 'max=remainingQty'],
      ['13', 'manufactureDate', '제조일자', 'Step2 그리드', '날짜 입력', 'N', '140px', '-', 'Y', ''],
      ['14', 'warehouse', '창고', 'Step2 그리드', '셀렉트', 'Y', '130px', '첫번째', 'Y', 'useWarehouseOptions'],
    ],
    buttons: [
      ['1', '뒤로', 'Step2 상단', 'ArrowLeft', 'Step 1로 복귀', '-', '-', 'Step2', ''],
      ['2', '등록', 'Step2 하단', '-', 'PO 입하 등록', 'POST /material/arrivals/po', '-', 'inputQty>0 존재', ''],
    ],
    flow: [
      'Step 1: receivable-pos 조회 → PO 목록 표시',
      'PO 행 클릭 → po/:poId/items 조회 → Step 2 전환',
      'Step 2: 품목별 수량/창고 입력 → 등록 → 모달 닫기 + 새로고침',
    ],
    rules: [
      'inputQty: 0 ~ remainingQty 범위 강제',
      'inputQty > 0인 품목만 제출',
      '창고 필수 선택',
    ],
  },
  {
    id: 'SC-MAT-ARR-MAN', name: '수동 입하 모달', menu: '입하관리 > 수동 입하 등록 버튼',
    type: '등록 (모달)', apis: 'POST /material/arrivals/manual',
    layout: [
      ['폼 영역', ['품목코드: 읽기전용 + 검색버튼 (PartSearchModal)', '창고(50%) + 수량(50%)', '공급업체UID(50%) + 제조일자(50%)', '공급처: PartnerSelect (SUPPLIER 타입)', '비고: 텍스트 입력', '등록 버튼'], C.form],
    ],
    items: [
      ['1', 'itemCode', '품목코드', '폼', '검색 입력', 'Y', '-', '-', 'Y', 'PartSearchModal'],
      ['2', 'itemName', '품목명', '폼', '텍스트', '-', '-', '-', 'N', '자동 표시'],
      ['3', 'warehouseCode', '창고', '폼', '셀렉트', 'Y', '-', '-', 'Y', 'WarehouseSelect'],
      ['4', 'qty', '수량', '폼', '숫자 입력', 'Y', '-', '-', 'Y', 'min=1'],
      ['5', 'supUid', '공급업체UID', '폼', '텍스트', 'N', '-', '-', 'Y', ''],
      ['6', 'manufactureDate', '제조일자', '폼', '날짜 입력', 'N', '-', '-', 'Y', ''],
      ['7', 'vendor', '공급처', '폼', '셀렉트', 'N', '-', '-', 'Y', 'PartnerSelect'],
      ['8', 'remark', '비고', '폼', '텍스트', 'N', '-', '-', 'Y', ''],
    ],
    buttons: [
      ['1', '등록', '하단', '-', '수동 입하 등록', 'POST /material/arrivals/manual', '-', '필수값 입력', ''],
      ['2', '취소', '하단', '-', '모달 닫기', '-', '-', '항상', ''],
    ],
    flow: ['품목 검색 → 창고/수량 입력 → 등록 → 모달 닫기 + 새로고침'],
    rules: ['필수: itemCode + warehouseCode + qty > 0', '품목코드는 PartSearchModal로만 입력'],
  },
  {
    id: 'SC-MAT-ARR-CANCEL', name: '입하 취소 모달', menu: '입하관리 > 그리드 행 취소 버튼',
    type: '취소 (모달)', apis: 'POST /material/arrivals/cancel',
    layout: [
      ['정보 표시', ['대상 기록: 트랜잭션번호, 품목명, 수량+단위', '경고 배너 (빨강 배경)'], C.btn],
      ['입력 영역', ['취소 사유: 텍스트 입력 (필수)'], C.form],
    ],
    items: [
      ['1', 'transNo', '트랜잭션번호', '정보', '텍스트', '-', '-', '-', 'N', '읽기전용'],
      ['2', 'partName', '품목명', '정보', '텍스트', '-', '-', '-', 'N', '읽기전용'],
      ['3', 'qty', '수량', '정보', '숫자', '-', '-', '-', 'N', '읽기전용 + 단위'],
      ['4', 'reason', '취소 사유', '입력', '텍스트', 'Y', '-', '-', 'Y', '필수 입력'],
    ],
    buttons: [
      ['1', '취소 확인', '하단', '-', '입하 취소 처리', 'POST /material/arrivals/cancel', '-', 'reason 입력', 'variant=danger'],
      ['2', '닫기', '하단', '-', '모달 닫기', '-', '-', '항상', ''],
    ],
    flow: ['대상 정보 확인 → 취소 사유 입력 → 취소 확인 → 모달 닫기 + 새로고침'],
    rules: ['취소 사유 필수 (trim 후 빈값 불가)', '역분개 처리: 원본 CANCELED + 음수 트랜잭션 생성'],
  },
  {
    id: 'SC-MAT-RCV', name: '자재입고관리', menu: '자재관리 > 자재입고관리',
    type: '조회/등록', apis: 'GET /material/receiving/receivable, stats, POST /material/receiving',
    layout: [
      ['헤더 영역', ['아이콘: PackagePlus + 제목: "자재입고관리"', '설명: "IQC 합격건을 선택하여 일괄/분할 입고 처리"', '버튼: [일괄입고(N건)] (선택 시만 표시)'], C.hdr2],
      ['통계 카드', ['4열 StatCard:', '  입고대기 (Clock, yellow)', '  대기수량 (Package, blue)', '  금일 입고건수 (CheckCircle, green)', '  금일 입고수량 (Hash, purple)'], C.hdr],
      ['검색 영역', ['검색: 자재시리얼/품목코드/품목명/공급처 (텍스트 입력)'], C.search],
      ['데이터 그리드', ['ReceivableTable (DataGrid)', '체크박스 선택 + 인라인 편집', '컬럼: 체크박스, 자재시리얼, PO번호, 품목코드, 품목명, 공급처, 입하일자, 초기수량, 기입고(파랑), 잔량(주황), 제조일자입력, 입고수량입력, 창고선택', '20건/페이지, 컬럼필터, 엑셀내보내기'], C.grid],
    ],
    items: [
      ['1', 'searchText', '검색어', '필터', '텍스트', 'N', '-', '-', 'Y', '자재시리얼/품목/공급처'],
      ['2', 'select', '선택', '그리드', '체크박스', '-', '40px', '-', 'Y', '전체선택 포함'],
      ['3', 'matUid', '자재시리얼', '그리드', '텍스트', '-', '150px', '-', 'N', ''],
      ['4', 'poNo', 'PO번호', '그리드', '텍스트', '-', '120px', '-', 'N', "null → '-'"],
      ['5', 'partCode', '품목코드', '그리드', '텍스트', '-', '100px', '-', 'N', ''],
      ['6', 'partName', '품목명', '그리드', '텍스트', '-', '130px', '-', 'N', ''],
      ['7', 'vendor', '공급처', '그리드', '텍스트', '-', '100px', '-', 'N', ''],
      ['8', 'recvDate', '입하일자', '그리드', '날짜', '-', '110px', '-', 'N', '.slice(0,10)'],
      ['9', 'initQty', '초기수량', '그리드', '숫자', '-', '80px', '-', 'N', ''],
      ['10', 'receivedQty', '기입고수량', '그리드', '숫자', '-', '80px', '-', 'N', '파랑(blue-600)'],
      ['11', 'remainingQty', '잔량', '그리드', '숫자', '-', '80px', '-', 'N', '주황(orange-600)'],
      ['12', 'manufactureDate', '제조일자', '그리드', '날짜 입력', 'N', '140px', 'LOT 제조일', 'Y', '입고 시 LOT 수정'],
      ['13', 'inputQty', '입고수량', '그리드', '숫자 입력', 'Y', '100px', 'remainingQty', 'Y', '0~잔량 범위'],
      ['14', 'warehouse', '창고', '그리드', '셀렉트', 'Y', '140px', '입하창고', 'Y', 'useWarehouseOptions'],
    ],
    buttons: [
      ['1', '일괄입고(N건)', '헤더', 'PackagePlus', '선택 LOT 일괄 입고', 'POST /material/receiving', '-', '선택 1건+', '선택 건수 표시'],
      ['2', '새로고침', '헤더', 'RefreshCw', '데이터 재조회', '-', '-', '항상', ''],
    ],
    flow: [
      '페이지 로드 → GET receivable + GET stats',
      '체크박스 선택 → [일괄입고] 버튼 활성화',
      '수량/창고 인라인 수정 가능',
      '일괄입고 클릭 → POST receiving (선택 항목) → 새로고침',
    ],
    rules: [
      '입고수량: 0 ~ remainingQty 범위 자동 제한',
      '초기값: qty = remainingQty, warehouse = 입하창고',
      '전체선택: 필터링된 행만 선택',
      'IQC PASS + 잔량 > 0인 LOT만 표시',
      'InventoryFreezeGuard: 재고동결 기간 차단',
    ],
  },
  {
    id: 'SC-MAT-RCV-H', name: '입고이력조회', menu: '자재관리 > 입고이력조회',
    type: '조회', apis: 'GET /material/receiving, GET /material/receiving/stats',
    layout: [
      ['헤더 영역', ['아이콘: ClipboardList + 제목: "입고이력조회"', '새로고침 버튼'], C.hdr2],
      ['통계 카드', ['2열 StatCard:', '  금일 입고건수 (CheckCircle, green)', '  금일 입고수량 (Hash, purple)'], C.hdr],
      ['데이터 그리드', ['ReceivingHistoryTable (DataGrid)', '컬럼: 입고번호, 입고일, 자재시리얼, PO번호, 품목코드, 품목명, 수량(녹색), 창고, 비고', '10건/페이지, 컬럼필터'], C.grid],
    ],
    items: [
      ['1', 'receiveNo', '입고번호', '그리드', '텍스트', '-', '180px', '-', 'N', ''],
      ['2', 'transDate', '입고일', '그리드', '날짜', '-', '100px', '-', 'N', '.slice(0,10)'],
      ['3', 'lot.matUid', '자재시리얼', '그리드', '텍스트', '-', '150px', '-', 'N', ''],
      ['4', 'lot.poNo', 'PO번호', '그리드', '텍스트', '-', '120px', '-', 'N', ''],
      ['5', 'part.itemCode', '품목코드', '그리드', '텍스트', '-', '100px', '-', 'N', ''],
      ['6', 'part.itemName', '품목명', '그리드', '텍스트', '-', '130px', '-', 'N', ''],
      ['7', 'qty', '수량', '그리드', '숫자', '-', '100px', '-', 'N', '녹색 + 단위'],
      ['8', 'toWarehouse', '창고', '그리드', '텍스트', '-', '100px', '-', 'N', 'warehouseName'],
      ['9', 'remark', '비고', '그리드', '텍스트', '-', '120px', '-', 'N', '회색(muted)'],
    ],
    buttons: [
      ['1', '새로고침', '헤더', 'RefreshCw', '데이터 재조회', '-', '-', '항상', ''],
    ],
    flow: ['페이지 로드 → GET receiving(limit=50) + GET stats'],
    rules: ['조회 전용 화면 (등록/수정/삭제 없음)'],
  },
];

function buildDoc() {
  const coverSection = {
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ spacing: { before: 4000 }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'HARNESS MES', font: 'Arial', size: 56, bold: true, color: C.primary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Manufacturing Execution System', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '\uD654\uBA74\uC124\uACC4\uC11C', font: 'Arial', size: 48, bold: true, color: '333333' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: '\uC790\uC7AC\uC785\uACE0(Receiving) \uBAA8\uB4C8', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      new Table({
        width: { size: 5000, type: WidthType.DXA }, columnWidths: [2000, 3000],
        rows: [['프로젝트명', 'HARNESS MES'], ['산출물명', '화면설계서 - 자재입고'], ['버전', 'v1.0'], ['작성일', '2026-03-18'], ['작성자', 'HANES MES팀']].map(([k, v]) =>
          new TableRow({ children: [c(k, 2000, { bold: true, shading: C.hdr, align: AlignmentType.CENTER }), c(v, 3000)] })
        ),
      }),
    ],
  };

  const body = [];

  // 개정이력
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '\uAC1C\uC815\uC774\uB825', font: 'Arial' })] }),
    new Table({
      width: { size: CW, type: WidthType.DXA }, columnWidths: [1500, 1500, 2000, 8440],
      rows: [
        new TableRow({ tableHeader: true, children: ['버전', '일자', '작성자', '변경내용'].map((h, i) => c(h, [1500, 1500, 2000, 8440][i], { bold: true, shading: C.hdr, align: AlignmentType.CENTER })) }),
        new TableRow({ children: [c('1.0', 1500, { align: AlignmentType.CENTER }), c('2026-03-18', 1500, { align: AlignmentType.CENTER }), c('HANES MES팀', 2000, { align: AlignmentType.CENTER }), c('최초 작성', 8440)] }),
      ],
    }), pb(),
  );

  // 목차
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '\uBAA9\uCC28', font: 'Arial' })] }),
    new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }), pb(),
  );

  // 1. 개요
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '1. \uAC1C\uC694', font: 'Arial' })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.1 \uBAA9\uC801', font: 'Arial' })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '\uBCF8 \uBB38\uC11C\uB294 HARNESS MES \uC2DC\uC2A4\uD15C\uC758 \uC790\uC7AC\uC785\uACE0(Receiving) \uAE30\uB2A5\uC758 \uD654\uBA74 \uC124\uACC4\uB97C \uC815\uC758\uD55C\uB2E4. \uAC01 \uD654\uBA74\uC758 \uB808\uC774\uC544\uC6C3, \uD56D\uBAA9 \uC815\uC758, \uAE30\uB2A5\uBC84\uD2BC, \uD654\uBA74 \uC804\uD658 \uD750\uB984, \uC5C5\uBB34 \uADDC\uCE59\uC744 \uAE30\uC220\uD55C\uB2E4.', font: 'Arial', size: 20 })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.2 \uBC94\uC704', font: 'Arial' })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '\uC785\uD558\uAD00\uB9AC(SC-MAT-ARR), PO\uC785\uD558\uBAA8\uB2EC, \uC218\uB3D9\uC785\uD558\uBAA8\uB2EC, \uCDE8\uC18C\uBAA8\uB2EC, \uC790\uC7AC\uC785\uACE0\uAD00\uB9AC(SC-MAT-RCV), \uC785\uACE0\uC774\uB825\uC870\uD68C(SC-MAT-RCV-H) \uCD1D 6\uAC1C \uD654\uBA74', font: 'Arial', size: 20 })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.3 \uD654\uBA74 \uC124\uACC4 \uADDC\uCE59', font: 'Arial' })] }),
    dataTbl(['항목', '규칙'], [
      ['UI 프레임워크', 'Next.js + React + TailwindCSS'],
      ['데이터 그리드', 'DataGrid (TanStack React Table 기반)'],
      ['아이콘', 'Lucide React'],
      ['다크 모드', 'dark: 클래스 지원 (기본값 동시 지정)'],
      ['통계 카드', 'StatCard 공용 컴포넌트'],
      ['모달', 'Modal 공용 컴포넌트 (alert/confirm 미사용)'],
      ['i18n', '한국어/영어/중국어/베트남어 4개 언어 지원'],
    ], [3000, 10440]),
    pb(),
  );

  // 2. 화면 목록
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '2. \uD654\uBA74 \uBAA9\uB85D', font: 'Arial' })] }));
  const slWidths = [600, 2000, 2000, 3000, 1500, 4340];
  body.push(dataTbl(['No', '화면ID', '화면명', '메뉴 경로', '유형', '비고'],
    screens.map((s, i) => [String(i + 1), s.id, s.name, s.menu, s.type, '']), slWidths), pb());

  // 3. 화면별 상세
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '3. \uD654\uBA74\uBCC4 \uC0C1\uC138', font: 'Arial' })] }));

  screens.forEach((scr, idx) => {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `3.${idx + 1} ${scr.name} (${scr.id})`, font: 'Arial' })] }));

    // 기본 정보
    body.push(
      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `3.${idx + 1}.1 \uAE30\uBCF8 \uC815\uBCF4`, font: 'Arial' })] }),
      infoTbl([['화면 ID', scr.id], ['화면명', scr.name], ['메뉴 경로', scr.menu], ['화면 유형', scr.type], ['관련 API', scr.apis]]),
      sp(),
    );

    // 레이아웃
    body.push(
      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `3.${idx + 1}.2 \uD654\uBA74 \uB808\uC774\uC544\uC6C3`, font: 'Arial' })] }),
      layoutTbl(scr.layout),
      sp(),
    );

    // 항목 정의
    const itemWidths = [500, 1600, 1200, 1200, 1200, 500, 700, 900, 500, 5140];
    body.push(
      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `3.${idx + 1}.3 \uD56D\uBAA9 \uC815\uC758`, font: 'Arial' })] }),
      dataTbl(['No', '항목ID', '항목명', '영역', '유형', '필수', '길이', '기본값', '편집', '비고'], scr.items, itemWidths),
      sp(),
    );

    // 기능버튼
    if (scr.buttons.length > 0) {
      const btnWidths = [500, 1600, 1200, 1000, 3000, 2800, 700, 1200, 1440];
      body.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `3.${idx + 1}.4 \uAE30\uB2A5\uBC84\uD2BC \uC815\uC758`, font: 'Arial' })] }),
        dataTbl(['No', '버튼명', '위치', '아이콘', '동작 설명', '호출 API', '권한', '활성 조건', '비고'], scr.buttons, btnWidths),
        sp(),
      );
    }

    // 화면 전환 흐름
    body.push(
      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `3.${idx + 1}.5 \uD654\uBA74 \uC804\uD658 \uD750\uB984`, font: 'Arial' })] }),
      ...scr.flow.map(f => new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 360 }, children: [new TextRun({ text: `\u2022 ${f}`, font: 'Arial', size: 17 })] })),
      sp(),
    );

    // 업무 규칙
    body.push(
      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `3.${idx + 1}.6 \uC5C5\uBB34 \uADDC\uCE59`, font: 'Arial' })] }),
      ...scr.rules.map(r => new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 360 }, children: [new TextRun({ text: `\u2022 ${r}`, font: 'Arial', size: 17 })] })),
      sp(),
    );

    if (idx < screens.length - 1) body.push(pb());
  });

  const bodySection = {
    properties: { page: { size: { width: 11906, height: 16838, orientation: 'landscape' }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'HARNESS MES - \uD654\uBA74\uC124\uACC4\uC11C (\uC790\uC7AC\uC785\uACE0)', font: 'Arial', size: 16, color: '999999' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' })] })] }) },
    children: body,
  };

  return new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: 'Arial', color: C.primary }, paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Arial', color: '333333' }, paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, font: 'Arial', color: '555555' }, paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 } },
      ],
    },
    sections: [coverSection, bodySection],
  });
}

async function main() {
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  const outPath = 'docs/deliverables/material/화면설계서_자재입고_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);
