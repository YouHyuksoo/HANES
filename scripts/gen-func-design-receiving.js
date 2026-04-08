/**
 * @file scripts/gen-func-design-receiving.js
 * @description 자재입고(Receiving) 기능설계서 Word 문서 생성 스크립트
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CONTENT_WIDTH = 13440;
const MARGIN = 1200;
const C = {
  primary: '2B579A', headerBg: 'D5E8F0', headerBg2: 'E8F0FE',
  altRow: 'F5F9FC', border: 'AAAAAA', white: 'FFFFFF',
  getOk: 'E2EFDA', postOk: 'FFF2CC', deleteOk: 'FCE4EC',
};

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const thinBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function cell(text, width, opts = {}) {
  const { bold, shading, align, size, color, span } = opts;
  return new TableCell({
    borders: thinBorders, width: { size: width, type: WidthType.DXA },
    shading: shading ? { fill: shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    columnSpan: span, verticalAlign: 'center',
    children: [new Paragraph({
      alignment: align || AlignmentType.LEFT, spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: text || '', bold: bold || false, font: 'Arial', size: size || 18, color: color || '000000' })],
    })],
  });
}

function multiLineCell(lines, width, opts = {}) {
  const { shading } = opts;
  return new TableCell({
    borders: thinBorders, width: { size: width, type: WidthType.DXA },
    shading: shading ? { fill: shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: 'top',
    children: lines.map(l => new Paragraph({
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: l, font: 'Arial', size: 17 })],
    })),
  });
}

function infoTable(rows) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 10440],
    rows: rows.map(([k, v]) => new TableRow({
      children: [
        cell(k, 3000, { bold: true, shading: C.headerBg }),
        cell(v, 10440),
      ],
    })),
  });
}

function paramTable(headers, data, colWidths) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, colWidths[i], { bold: true, shading: C.headerBg, align: AlignmentType.CENTER, size: 16 })) }),
      ...data.map((row, idx) => new TableRow({
        children: row.map((val, i) => cell(val, colWidths[i], { size: 16, shading: idx % 2 === 1 ? C.altRow : C.white, align: i <= 0 ? AlignmentType.CENTER : AlignmentType.LEFT })),
      })),
    ],
  });
}

function logicBlock(lines) {
  return lines.map(l => new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: 360 },
    children: [new TextRun({ text: l, font: 'Consolas', size: 17 })],
  }));
}

// ── 기능 데이터 ──
const functions = [
  {
    id: 'FD-MAT-ARR-001', name: 'PO 기반 입하 등록', type: '등록',
    screen: 'SC-MAT-ARR (입하관리)', api: 'POST /material/arrivals/po',
    tables: 'MAT_ARRIVALS, STOCK_TRANSACTIONS, MAT_STOCKS, PURCHASE_ORDER_ITEMS, PURCHASE_ORDERS',
    transaction: '필요 (다중 테이블 변경)',
    inputs: [
      ['1', 'poId', 'PO ID', 'string', 'Y', '@IsString', '발주번호'],
      ['2', 'invoiceNo', '인보이스번호', 'string', 'Y', '@IsString, @MaxLength(100)', '공급상 인보이스'],
      ['3', 'items', '입하 품목 목록', 'Array', 'Y', '@IsArray, @ValidateNested', '최소 1건'],
      ['3.1', 'items[].poItemId', 'PO 품목ID', 'string', 'Y', '@IsString', 'PO 품목 seq'],
      ['3.2', 'items[].itemCode', '품목코드', 'string', 'Y', '@IsString', '품목마스터 참조'],
      ['3.3', 'items[].receivedQty', '입하수량', 'int', 'Y', '@IsInt, @Min(1)', '1 이상'],
      ['3.4', 'items[].warehouseId', '창고ID', 'string', 'Y', '@IsString', '입하 대상 창고'],
      ['3.5', 'items[].supUid', '공급업체UID', 'string', 'N', '@IsOptional', ''],
      ['3.6', 'items[].invoiceNo', '품목 인보이스', 'string', 'Y', '@IsString', '품목별 인보이스'],
      ['3.7', 'items[].manufactureDate', '제조일자', 'string', 'N', '@IsDateString', 'YYYY-MM-DD'],
      ['3.8', 'items[].remark', '비고', 'string', 'N', '@MaxLength(500)', ''],
      ['4', 'workerId', '작업자ID', 'string', 'N', '@IsOptional', ''],
      ['5', 'remark', '비고', 'string', 'N', '@MaxLength(500)', ''],
    ],
    logic: [
      '1. 입력 데이터 유효성 검증 (class-validator)',
      '2. PO 검증',
      '   2.1 PO 존재 여부 확인 (PURCHASE_ORDERS)',
      '   2.2 PO 상태 확인 (CONFIRMED 또는 PARTIAL만 허용)',
      '3. 각 품목별 잔량 검증',
      '   3.1 PO 품목 조회 (PURCHASE_ORDER_ITEMS)',
      '   3.2 잔량 = orderQty - receivedQty',
      '   3.3 receivedQty <= 잔량 확인',
      '4. 트랜잭션 시작 (queryRunner)',
      '5. 입하번호 채번 (ARRIVAL prefix)',
      '6. 각 품목별 반복 처리:',
      '   6.1 MAT_ARRIVALS INSERT (arrivalNo, seq, iqcStatus=PENDING)',
      '   6.2 STOCK_TRANSACTIONS INSERT (transType=MAT_IN)',
      '   6.3 MAT_STOCKS UPSERT (warehouseCode=입고창고, qty 증가)',
      '   6.4 PURCHASE_ORDER_ITEMS.receivedQty 증가',
      '7. PO 상태 재계산',
      '   7.1 모든 품목 receivedQty >= orderQty → RECEIVED',
      '   7.2 일부만 received → PARTIAL',
      '   7.3 미수령 → CONFIRMED 유지',
      '8. 트랜잭션 커밋',
      '9. 생성된 STOCK_TRANSACTION 목록 + 부가정보 반환',
    ],
    exceptions: [
      ['1', 'PO 미존재', '404', 'PO를 찾을 수 없습니다', '에러 반환'],
      ['2', 'PO 상태 부적합', '400', '입하할 수 없는 PO 상태입니다', 'CONFIRMED/PARTIAL만 허용'],
      ['3', '잔량 초과', '400', '입하 수량이 잔량을 초과합니다', '품목별 검증'],
      ['4', '채번 실패', '500', '번호 생성에 실패했습니다', '트랜잭션 롤백'],
    ],
  },
  {
    id: 'FD-MAT-ARR-002', name: '수동 입하 등록', type: '등록',
    screen: 'SC-MAT-ARR (입하관리)', api: 'POST /material/arrivals/manual',
    tables: 'MAT_ARRIVALS, STOCK_TRANSACTIONS, MAT_STOCKS',
    transaction: '필요 (다중 테이블 변경)',
    inputs: [
      ['1', 'itemCode', '품목코드', 'string', 'Y', '@IsString', '품목마스터 참조'],
      ['2', 'vendorId', '공급업체ID', 'string', 'Y', '@IsString', '공급상 식별자'],
      ['3', 'vendor', '공급업체명', 'string', 'Y', '@MaxLength(200)', '표시명'],
      ['4', 'warehouseId', '창고ID', 'string', 'Y', '@IsString', '입하 대상 창고'],
      ['5', 'invoiceNo', '인보이스번호', 'string', 'Y', '@MaxLength(100)', ''],
      ['6', 'qty', '수량', 'int', 'Y', '@IsInt, @Min(1)', '1 이상'],
      ['7', 'supUid', '공급업체UID', 'string', 'N', '@IsOptional', ''],
      ['8', 'manufactureDate', '제조일자', 'string', 'N', '@IsDateString', 'YYYY-MM-DD'],
      ['9', 'remark', '비고', 'string', 'N', '@MaxLength(500)', ''],
      ['10', 'workerId', '작업자ID', 'string', 'N', '@IsOptional', ''],
    ],
    logic: [
      '1. 입력 데이터 유효성 검증 (class-validator)',
      '2. 트랜잭션 시작',
      '3. 입하번호 채번 (ARRIVAL prefix)',
      '4. MAT_ARRIVALS INSERT (arrivalType=MANUAL, PO 참조 없음)',
      '5. STOCK_TRANSACTIONS INSERT (transType=MAT_IN, refType=MANUAL)',
      '6. MAT_STOCKS UPSERT (현재고 증가)',
      '7. 트랜잭션 커밋',
      '8. 결과 반환',
    ],
    exceptions: [
      ['1', '채번 실패', '500', '번호 생성에 실패했습니다', '트랜잭션 롤백'],
    ],
  },
  {
    id: 'FD-MAT-ARR-003', name: '입하 취소 (역분개)', type: '취소',
    screen: 'SC-MAT-ARR (입하관리)', api: 'POST /material/arrivals/cancel',
    tables: 'STOCK_TRANSACTIONS, MAT_ARRIVALS, MAT_STOCKS, PURCHASE_ORDER_ITEMS, PURCHASE_ORDERS',
    transaction: '필요 (다중 테이블 변경)',
    inputs: [
      ['1', 'transactionId', '트랜잭션ID', 'string', 'Y', '@IsString', '취소 대상 TRANS_NO'],
      ['2', 'reason', '취소사유', 'string', 'Y', '@MaxLength(500)', '필수 입력'],
      ['3', 'workerId', '작업자ID', 'string', 'N', '@IsOptional', ''],
    ],
    logic: [
      '1. 원본 STOCK_TRANSACTION 조회 (transNo)',
      '2. 검증',
      '   2.1 존재 여부 확인',
      '   2.2 상태 확인 (CANCELED이면 재취소 불가)',
      '   2.3 transType 확인 (MAT_IN만 취소 가능)',
      '3. 트랜잭션 시작',
      '4. 원본 STOCK_TRANSACTION STATUS = CANCELED',
      '5. MAT_ARRIVALS STATUS = CANCELED (itemCode 기준 최신)',
      '6. 역분개 STOCK_TRANSACTION 생성',
      '   6.1 transNo = "원본-C"',
      '   6.2 transType = MAT_IN_CANCEL',
      '   6.3 fromWarehouse = 원본.toWarehouse',
      '   6.4 qty = -원본.qty (음수)',
      '   6.5 cancelRefId = 원본.transNo',
      '7. MAT_STOCKS 감소 (역분개 반영)',
      '8. PO 참조 시 (refType=PO):',
      '   8.1 PURCHASE_ORDER_ITEMS.receivedQty 감소',
      '   8.2 PO 상태 재계산',
      '9. 트랜잭션 커밋',
      '10. 역분개 트랜잭션 반환',
    ],
    exceptions: [
      ['1', '트랜잭션 미존재', '404', '트랜잭션을 찾을 수 없습니다', '에러 반환'],
      ['2', '이미 취소됨', '400', '이미 취소된 트랜잭션입니다', '재취소 차단'],
      ['3', 'MAT_IN 아님', '400', 'MAT_IN 유형만 취소 가능합니다', '유형 검증'],
    ],
  },
  {
    id: 'FD-MAT-ARR-004', name: '입하 이력 조회', type: '조회',
    screen: 'SC-MAT-ARR (입하관리)', api: 'GET /material/arrivals',
    tables: 'STOCK_TRANSACTIONS, ITEM_MASTERS, MAT_LOTS, WAREHOUSES',
    transaction: '불필요 (조회)',
    inputs: [
      ['1', 'page', '페이지', 'int', 'N', '@Min(1), default=1', ''],
      ['2', 'limit', '건수', 'int', 'N', '@Min(1), @Max(10000), default=50', ''],
      ['3', 'search', '검색어', 'string', 'N', '', 'transNo, itemCode, itemName'],
      ['4', 'fromDate', '시작일', 'string', 'N', '@IsDateString', 'ISO 형식'],
      ['5', 'toDate', '종료일', 'string', 'N', '@IsDateString', 'ISO 형식'],
      ['6', 'status', '상태', 'string', 'N', '', 'DONE / CANCELED'],
    ],
    logic: [
      '1. STOCK_TRANSACTIONS 조회 (transType IN [MAT_IN, MAT_IN_CANCEL])',
      '2. 필터 적용 (검색어, 일자, 상태)',
      '3. ITEM_MASTERS LEFT JOIN (품목명, 단위)',
      '4. MAT_LOTS LEFT JOIN (matUid, poNo)',
      '5. WAREHOUSES LEFT JOIN (창고명)',
      '6. 페이지네이션 적용',
      '7. 결과 반환 (data + meta)',
    ],
    exceptions: [],
  },
  {
    id: 'FD-MAT-ARR-005', name: '입하 통계 조회', type: '조회',
    screen: 'SC-MAT-ARR (입하관리)', api: 'GET /material/arrivals/stats',
    tables: 'STOCK_TRANSACTIONS, PURCHASE_ORDERS',
    transaction: '불필요 (조회)',
    inputs: [],
    logic: [
      '1. 오늘 입하건수 (MAT_IN, status=DONE, 오늘 날짜)',
      '2. 오늘 입하수량 (MAT_IN, status=DONE, qty 합계)',
      '3. 미입하 PO 수 (status IN [CONFIRMED, PARTIAL])',
      '4. 전체 입하건수 (MAT_IN, status=DONE 전체)',
      '5. 결과 반환 { todayCount, todayQty, unrecevedPoCount, totalCount }',
    ],
    exceptions: [],
  },
  {
    id: 'FD-MAT-ARR-006', name: '입하 가능 PO 목록 조회', type: '조회',
    screen: 'SC-MAT-ARR (입하관리)', api: 'GET /material/arrivals/receivable-pos',
    tables: 'PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, ITEM_MASTERS',
    transaction: '불필요 (조회)',
    inputs: [],
    logic: [
      '1. PO 조회 (status IN [CONFIRMED, PARTIAL])',
      '2. 각 PO의 품목별 잔량 계산 (orderQty - receivedQty)',
      '3. 품목 부가정보 JOIN (품목명, 단위 등)',
      '4. 통계 포함 (totalOrderQty, totalReceivedQty, totalRemainingQty)',
      '5. 결과 반환',
    ],
    exceptions: [],
  },
  {
    id: 'FD-MAT-ARR-007', name: '바코드 입하 정보 조회', type: '조회',
    screen: 'PDA 스캔', api: 'GET /material/arrivals/by-barcode/:barcode',
    tables: 'MAT_ARRIVALS, VENDOR_BARCODE_MAPPINGS, IQC_LOGS, ITEM_MASTERS',
    transaction: '불필요 (조회)',
    inputs: [
      ['1', 'barcode', '바코드', 'string', 'Y', 'URL Path Param', '스캔값'],
    ],
    logic: [
      '1. MAT_ARRIVALS에서 arrivalNo 또는 poNo로 직접 조회',
      '2. 실패 시 → VENDOR_BARCODE_MAPPINGS에서 itemCode 매핑',
      '   2.1 매핑된 itemCode로 최신 입하 조회',
      '3. 실패 시 → 404 반환',
      '4. IQC 상태 결정:',
      '   4.1 part.iqcYn = N → NONE',
      '   4.2 part.iqcYn = Y → IQC_LOGS 최신 결과 확인',
      '5. 입하정보 + IQC상태 반환',
    ],
    exceptions: [
      ['1', '바코드 매칭 실패', '404', '입하 정보를 찾을 수 없습니다', '3단계 조회 실패'],
    ],
  },
  {
    id: 'FD-MAT-RCV-001', name: '일괄/분할 입고 등록', type: '등록',
    screen: 'SC-MAT-RCV (입고관리)', api: 'POST /material/receiving',
    tables: 'MAT_RECEIVINGS, STOCK_TRANSACTIONS, MAT_LOTS, MAT_STOCKS, MAT_ARRIVALS',
    transaction: '필요 (다중 테이블 변경)',
    inputs: [
      ['1', 'items', '입고 품목 목록', 'Array', 'Y', '@IsArray, @ValidateNested', '최소 1건'],
      ['1.1', 'items[].matUid', '자재UID', 'string', 'Y', '@IsString', 'LOT 식별자'],
      ['1.2', 'items[].qty', '입고수량', 'int', 'Y', '@IsInt, @Min(1)', '잔량 이하'],
      ['1.3', 'items[].warehouseId', '입고창고', 'string', 'Y', '@IsString', '대상 창고'],
      ['1.4', 'items[].manufactureDate', '제조일자', 'string', 'N', '@IsDateString', '수정 시 유효기한 재계산'],
      ['1.5', 'items[].remark', '비고', 'string', 'N', '@MaxLength(500)', ''],
      ['2', 'workerId', '작업자ID', 'string', 'N', '@IsOptional', ''],
    ],
    logic: [
      '1. 모든 아이템 검증:',
      '   1.1 MAT_LOTS 존재 확인',
      '   1.2 iqcStatus = PASS 확인',
      '   1.3 기입고수량 계산 (RECEIVE 트랜잭션 qty 합계)',
      '   1.4 잔량(initQty - 기입고) >= 입고수량 확인',
      '   1.5 PO 오차율 체크 (poNo 존재 시)',
      '2. 트랜잭션 시작',
      '3. 입고번호(receiveNo) 채번 (같은 배치 동일)',
      '4. 각 아이템별 반복 처리:',
      '   4.1 MAT_LOTS manufactureDate/expireDate 수정 (선택)',
      '   4.2 MAT_RECEIVINGS INSERT (receiveNo, seq)',
      '   4.3 STOCK_TRANSACTIONS INSERT (transType=RECEIVE)',
      '       from: 입하창고(MAT_ARRIVALS.warehouseCode)',
      '       to: 입고창고(dto.warehouseId)',
      '   4.4 MAT_STOCKS: 입하창고 차감 + 입고창고 증가',
      '5. 트랜잭션 커밋',
      '6. 생성된 STOCK_TRANSACTION 목록 반환',
    ],
    exceptions: [
      ['1', 'LOT 미존재', '404', '자재 LOT을 찾을 수 없습니다', '에러 반환'],
      ['2', 'IQC 미합격', '400', 'IQC 합격(PASS)된 자재만 입고 가능합니다', 'iqcStatus 검증'],
      ['3', '잔량 초과', '400', '입고 수량이 잔량을 초과합니다', '분할입고 잔량 검증'],
      ['4', 'PO 오차율 초과', '400', 'PO 수량 허용 오차를 초과합니다', 'toleranceRate% 검증'],
      ['5', '재고동결 기간', '403', '재고동결 기간에는 입고할 수 없습니다', 'InventoryFreezeGuard'],
    ],
  },
  {
    id: 'FD-MAT-RCV-002', name: '자동입고 처리', type: '자동처리',
    screen: '라벨 발행 연동', api: 'POST /material/receiving/auto',
    tables: 'MAT_RECEIVINGS, STOCK_TRANSACTIONS, MAT_LOTS, MAT_STOCKS',
    transaction: '필요',
    inputs: [
      ['1', 'matUids', '자재UID목록', 'string[]', 'Y', '@IsArray, @IsString({each})', 'LOT UID 배열'],
      ['2', 'workerId', '작업자ID', 'string', 'N', '@IsOptional', ''],
    ],
    logic: [
      '1. IQC_AUTO_RECEIVE 시스템 설정 확인',
      '2. 기본 창고(isDefault=1) 조회',
      '3. 각 LOT별 반복:',
      '   3.1 MAT_RECEIVINGS에 기록 존재 확인 (재발행 판별)',
      '   3.2 기록 있으면 → skipped[]에 추가 (스킵)',
      '   3.3 기록 없으면 → 입고 처리 (createBulkReceive 호출)',
      '4. { received[], skipped[] } 반환',
    ],
    exceptions: [
      ['1', '자동입고 미설정', '-', '스킵 (에러 아님)', '설정 OFF 시 전체 스킵'],
      ['2', '기본 창고 미존재', '500', '기본 창고가 설정되지 않았습니다', '사전 설정 필요'],
    ],
  },
  {
    id: 'FD-MAT-RCV-003', name: '입고 가능 LOT 조회', type: '조회',
    screen: 'SC-MAT-RCV (입고관리)', api: 'GET /material/receiving/receivable',
    tables: 'MAT_LOTS, STOCK_TRANSACTIONS, MAT_ARRIVALS, ITEM_MASTERS, WAREHOUSES, LABEL_PRINT_LOGS',
    transaction: '불필요 (조회)',
    inputs: [],
    logic: [
      '1. MAT_LOTS 조회 (iqcStatus=PASS, status IN [NORMAL,HOLD], initQty > 0)',
      '2. 각 LOT의 기입고수량 계산 (RECEIVE tx qty 합계)',
      '3. MAT_ARRIVALS에서 입하창고 정보 (itemCode 기준)',
      '4. 기본 창고(isDefault=1) 조회',
      '5. ITEM_MASTERS JOIN (품목명, 단위, toleranceRate)',
      '6. LABEL_PRINT_LOGS 확인 (라벨 발행 여부)',
      '7. 유효기간일 계산 (expireDate - today)',
      '8. remainingQty > 0인 LOT만 필터',
      '9. 결과 반환',
    ],
    exceptions: [],
  },
  {
    id: 'FD-MAT-RCV-004', name: '입고 이력 조회', type: '조회',
    screen: 'SC-MAT-RCV-H (입고이력)', api: 'GET /material/receiving',
    tables: 'MAT_RECEIVINGS, ITEM_MASTERS, MAT_LOTS, WAREHOUSES',
    transaction: '불필요 (조회)',
    inputs: [
      ['1', 'page', '페이지', 'int', 'N', '@Min(1), default=1', ''],
      ['2', 'limit', '건수', 'int', 'N', '@Max(10000), default=50', ''],
      ['3', 'search', '검색어', 'string', 'N', '', 'receiveNo, itemCode, itemName'],
      ['4', 'fromDate', '시작일', 'string', 'N', '@IsDateString', ''],
      ['5', 'toDate', '종료일', 'string', 'N', '@IsDateString', ''],
    ],
    logic: [
      '1. MAT_RECEIVINGS 조회',
      '2. 필터 적용 (검색어, 일자)',
      '3. ITEM_MASTERS LEFT JOIN (품목명, 단위)',
      '4. MAT_LOTS LEFT JOIN (matUid, poNo)',
      '5. WAREHOUSES LEFT JOIN (창고명)',
      '6. 페이지네이션 적용',
      '7. 결과 반환 (data + meta)',
    ],
    exceptions: [],
  },
  {
    id: 'FD-MAT-RCV-005', name: '입고 통계 조회', type: '조회',
    screen: 'SC-MAT-RCV (입고관리)', api: 'GET /material/receiving/stats',
    tables: 'MAT_LOTS, STOCK_TRANSACTIONS, MAT_RECEIVINGS',
    transaction: '불필요 (조회)',
    inputs: [],
    logic: [
      '1. 입고대기 건수 (IQC=PASS + 미입고 LOT 수)',
      '2. 입고대기 수량 (대기 LOT initQty 합계)',
      '3. 금일 입고건수 (오늘 MAT_RECEIVINGS 건수)',
      '4. 금일 입고수량 (오늘 MAT_RECEIVINGS qty 합계)',
      '5. 결과 반환 { pendingCount, pendingQty, todayReceivedCount, todayReceivedQty }',
    ],
    exceptions: [],
  },
];

// ── API 명세 데이터 ──
const apis = [
  { method: 'GET', url: '/material/arrivals', desc: '입하 이력 조회', funcRef: 'FD-MAT-ARR-004',
    reqParams: 'page, limit, search, fromDate, toDate, status (Query)',
    resOk: '{ data: ArrivalRecord[], meta: { total, page, limit } }', resErr: '-' },
  { method: 'GET', url: '/material/arrivals/stats', desc: '입하 통계', funcRef: 'FD-MAT-ARR-005',
    reqParams: '-', resOk: '{ todayCount, todayQty, unrecevedPoCount, totalCount }', resErr: '-' },
  { method: 'GET', url: '/material/arrivals/receivable-pos', desc: '입하 가능 PO 목록', funcRef: 'FD-MAT-ARR-006',
    reqParams: '-', resOk: 'PO[] + items[] (잔량 포함)', resErr: '-' },
  { method: 'GET', url: '/material/arrivals/stock-status', desc: '입하재고현황', funcRef: '-',
    reqParams: 'page, limit, search, fromDate, toDate (Query)', resOk: '{ data: StockStatusRecord[] }', resErr: '-' },
  { method: 'GET', url: '/material/arrivals/by-barcode/:barcode', desc: '바코드 입하 조회', funcRef: 'FD-MAT-ARR-007',
    reqParams: 'barcode (Path)', resOk: '입하정보 + IQC상태', resErr: '404 Not Found' },
  { method: 'GET', url: '/material/arrivals/po/:poId/items', desc: 'PO 품목 상세', funcRef: '-',
    reqParams: 'poId (Path)', resOk: 'PO 품목 목록 (잔량 포함)', resErr: '-' },
  { method: 'POST', url: '/material/arrivals/po', desc: 'PO 기반 입하 등록', funcRef: 'FD-MAT-ARR-001',
    reqParams: 'CreatePoArrivalDto (Body)', resOk: '201 Created + StockTransaction[]', resErr: '400/404' },
  { method: 'POST', url: '/material/arrivals/manual', desc: '수동 입하 등록', funcRef: 'FD-MAT-ARR-002',
    reqParams: 'CreateManualArrivalDto (Body)', resOk: '201 Created + StockTransaction[]', resErr: '400/500' },
  { method: 'POST', url: '/material/arrivals/cancel', desc: '입하 취소 (역분개)', funcRef: 'FD-MAT-ARR-003',
    reqParams: 'CancelArrivalDto (Body)', resOk: '200 OK + 역분개 tx', resErr: '400/404' },
  { method: 'GET', url: '/material/receiving', desc: '입고 이력 조회', funcRef: 'FD-MAT-RCV-004',
    reqParams: 'page, limit, search, fromDate, toDate (Query)', resOk: '{ data: ReceivingRecord[], meta }', resErr: '-' },
  { method: 'GET', url: '/material/receiving/stats', desc: '입고 통계', funcRef: 'FD-MAT-RCV-005',
    reqParams: '-', resOk: '{ pendingCount, pendingQty, todayReceivedCount, todayReceivedQty }', resErr: '-' },
  { method: 'GET', url: '/material/receiving/receivable', desc: '입고 가능 LOT 목록', funcRef: 'FD-MAT-RCV-003',
    reqParams: '-', resOk: '{ data: ReceivableLot[] }', resErr: '-' },
  { method: 'POST', url: '/material/receiving', desc: '일괄/분할 입고 등록', funcRef: 'FD-MAT-RCV-001',
    reqParams: 'CreateBulkReceiveDto (Body)', resOk: '201 Created + StockTransaction[]', resErr: '400/403/404' },
  { method: 'POST', url: '/material/receiving/auto', desc: '자동입고 (라벨 발행 시)', funcRef: 'FD-MAT-RCV-002',
    reqParams: 'AutoReceiveDto (Body)', resOk: '{ received[], skipped[] }', resErr: '403/500' },
];

function buildDoc() {
  // ── 표지 ──
  const coverSection = {
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ spacing: { before: 4000 }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'HARNESS MES', font: 'Arial', size: 56, bold: true, color: C.primary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Manufacturing Execution System', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '\uAE30\uB2A5\uC124\uACC4\uC11C', font: 'Arial', size: 48, bold: true, color: '333333' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: '\uC790\uC7AC\uC785\uACE0(Receiving) \uBAA8\uB4C8', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      new Table({
        width: { size: 5000, type: WidthType.DXA }, columnWidths: [2000, 3000],
        rows: [['프로젝트명', 'HARNESS MES'], ['산출물명', '기능설계서 - 자재입고'], ['버전', 'v1.0'], ['작성일', '2026-03-18'], ['작성자', 'HANES MES팀']].map(([k, v]) =>
          new TableRow({ children: [cell(k, 2000, { bold: true, shading: C.headerBg, align: AlignmentType.CENTER }), cell(v, 3000)] })
        ),
      }),
    ],
  };

  // ── 본문 (Landscape) ──
  const body = [];

  // 개정이력
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '\uAC1C\uC815\uC774\uB825', font: 'Arial' })] }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: [1500, 1500, 2000, 8440],
      rows: [
        new TableRow({ tableHeader: true, children: ['버전', '일자', '작성자', '변경내용'].map((h, i) => cell(h, [1500, 1500, 2000, 8440][i], { bold: true, shading: C.headerBg, align: AlignmentType.CENTER })) }),
        new TableRow({ children: [cell('1.0', 1500, { align: AlignmentType.CENTER }), cell('2026-03-18', 1500, { align: AlignmentType.CENTER }), cell('HANES MES팀', 2000, { align: AlignmentType.CENTER }), cell('최초 작성', 8440)] }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // 목차
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '\uBAA9\uCC28', font: 'Arial' })] }),
    new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // 1. 개요
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '1. \uAC1C\uC694', font: 'Arial' })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.1 \uBAA9\uC801', font: 'Arial' })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '\uBCF8 \uBB38\uC11C\uB294 HARNESS MES \uC2DC\uC2A4\uD15C\uC758 \uC790\uC7AC\uC785\uACE0(Receiving) \uAE30\uB2A5\uC5D0 \uB300\uD55C \uC0C1\uC138 \uC124\uACC4\uB97C \uAE30\uC220\uD55C\uB2E4. \uAC01 \uAE30\uB2A5\uC758 \uC785\uB825 \uB370\uC774\uD130, \uCC98\uB9AC \uB85C\uC9C1, \uCD9C\uB825 \uB370\uC774\uD130, \uC720\uD6A8\uC131 \uAC80\uC99D \uADDC\uCE59, \uC608\uC678 \uCC98\uB9AC\uB97C \uC815\uC758\uD55C\uB2E4.', font: 'Arial', size: 20 })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.2 \uBC94\uC704', font: 'Arial' })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '\uC785\uD558(Arrival) 7\uAC1C \uAE30\uB2A5 + \uC785\uACE0(Receiving) 5\uAC1C \uAE30\uB2A5, \uCD1D 12\uAC1C \uAE30\uB2A5 \uBC0F 14\uAC1C API \uC5D4\uB4DC\uD3EC\uC778\uD2B8', font: 'Arial', size: 20 })] }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // 2. 기능 목록
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '2. \uAE30\uB2A5 \uBAA9\uB85D', font: 'Arial' })] }),
  );
  const funcListWidths = [600, 1800, 2400, 1000, 2400, 5240];
  body.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: funcListWidths,
    rows: [
      new TableRow({ tableHeader: true, children: ['No', '기능ID', '기능명', '유형', '관련화면', 'API'].map((h, i) => cell(h, funcListWidths[i], { bold: true, shading: C.headerBg, align: AlignmentType.CENTER, size: 16 })) }),
      ...functions.map((f, i) => new TableRow({
        children: [
          cell(String(i + 1), funcListWidths[0], { align: AlignmentType.CENTER, shading: i % 2 === 1 ? C.altRow : C.white, size: 16 }),
          cell(f.id, funcListWidths[1], { bold: true, shading: i % 2 === 1 ? C.altRow : C.white, size: 16 }),
          cell(f.name, funcListWidths[2], { shading: i % 2 === 1 ? C.altRow : C.white, size: 16 }),
          cell(f.type, funcListWidths[3], { align: AlignmentType.CENTER, shading: i % 2 === 1 ? C.altRow : C.white, size: 16 }),
          cell(f.screen, funcListWidths[4], { shading: i % 2 === 1 ? C.altRow : C.white, size: 16 }),
          cell(f.api, funcListWidths[5], { shading: i % 2 === 1 ? C.altRow : C.white, size: 15 }),
        ],
      })),
    ],
  }));
  body.push(new Paragraph({ children: [new PageBreak()] }));

  // 3. 기능별 상세
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '3. \uAE30\uB2A5\uBCC4 \uC0C1\uC138', font: 'Arial' })] }));

  functions.forEach((f, idx) => {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `3.${idx + 1} ${f.name} (${f.id})`, font: 'Arial' })] }));

    // 기본 정보
    body.push(
      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `3.${idx + 1}.1 \uAE30\uBCF8 \uC815\uBCF4`, font: 'Arial' })] }),
      infoTable([
        ['기능 ID', f.id], ['기능명', f.name], ['기능 유형', f.type],
        ['관련 화면', f.screen], ['관련 테이블', f.tables],
        ['트랜잭션', f.transaction], ['호출 API', f.api],
      ]),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
    );

    // 입력 데이터
    if (f.inputs.length > 0) {
      const inputWidths = [600, 2200, 1600, 1000, 600, 3000, 4440];
      body.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `3.${idx + 1}.2 \uC785\uB825 \uB370\uC774\uD130`, font: 'Arial' })] }),
        paramTable(['No', '파라미터명', '한글명', '타입', '필수', '유효성 규칙', '비고'], f.inputs, inputWidths),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
      );
    }

    // 처리 로직
    body.push(
      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `3.${idx + 1}.3 \uCC98\uB9AC \uB85C\uC9C1`, font: 'Arial' })] }),
      ...logicBlock(f.logic),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
    );

    // 예외 처리
    if (f.exceptions.length > 0) {
      const excWidths = [600, 2500, 1000, 4500, 4840];
      body.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `3.${idx + 1}.4 \uC608\uC678 \uCC98\uB9AC`, font: 'Arial' })] }),
        paramTable(['No', '예외 상황', '코드', '에러 메시지', '처리 방식'], f.exceptions, excWidths),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
      );
    }

    if (idx < functions.length - 1) body.push(new Paragraph({ children: [new PageBreak()] }));
  });

  // 4. API 명세
  body.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '4. API \uBA85\uC138', font: 'Arial' })] }),
  );

  const apiWidths = [800, 1200, 3200, 2000, 1800, 2440, 2000];
  body.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: apiWidths,
    rows: [
      new TableRow({ tableHeader: true, children: ['No', 'Method', 'URL', '설명', '기능 참조', 'Response (성공)', 'Response (에러)'].map((h, i) => cell(h, apiWidths[i], { bold: true, shading: C.headerBg, align: AlignmentType.CENTER, size: 15 })) }),
      ...apis.map((a, i) => {
        const methodColor = a.method === 'GET' ? C.getOk : a.method === 'POST' ? C.postOk : C.deleteOk;
        return new TableRow({
          children: [
            cell(String(i + 1), apiWidths[0], { align: AlignmentType.CENTER, size: 15, shading: i % 2 === 1 ? C.altRow : C.white }),
            cell(a.method, apiWidths[1], { bold: true, align: AlignmentType.CENTER, size: 15, shading: methodColor }),
            cell(a.url, apiWidths[2], { size: 14, shading: i % 2 === 1 ? C.altRow : C.white }),
            cell(a.desc, apiWidths[3], { size: 15, shading: i % 2 === 1 ? C.altRow : C.white }),
            cell(a.funcRef, apiWidths[4], { size: 14, align: AlignmentType.CENTER, shading: i % 2 === 1 ? C.altRow : C.white }),
            cell(a.resOk, apiWidths[5], { size: 14, shading: i % 2 === 1 ? C.altRow : C.white }),
            cell(a.resErr, apiWidths[6], { size: 14, align: AlignmentType.CENTER, shading: i % 2 === 1 ? C.altRow : C.white }),
          ],
        });
      }),
    ],
  }));

  // 공통 헤더
  body.push(
    new Paragraph({ spacing: { before: 400, after: 200 }, children: [new TextRun({ text: '\uACF5\uD1B5 Request Headers', font: 'Arial', size: 22, bold: true })] }),
    new Table({
      width: { size: 8000, type: WidthType.DXA }, columnWidths: [2500, 4000, 1500],
      rows: [
        new TableRow({ tableHeader: true, children: ['헤더', '값', '필수'].map((h, i) => cell(h, [2500, 4000, 1500][i], { bold: true, shading: C.headerBg, align: AlignmentType.CENTER })) }),
        new TableRow({ children: [cell('Authorization', 2500), cell('Bearer {JWT token}', 4000), cell('Y', 1500, { align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell('Content-Type', 2500), cell('application/json', 4000), cell('Y (POST)', 1500, { align: AlignmentType.CENTER })] }),
      ],
    }),
  );

  const bodySection = {
    properties: {
      page: { size: { width: 11906, height: 16838, orientation: 'landscape' }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
    },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'HARNESS MES - \uAE30\uB2A5\uC124\uACC4\uC11C (\uC790\uC7AC\uC785\uACE0)', font: 'Arial', size: 16, color: '999999' })] })] }) },
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
  const outPath = 'exports/material/기능설계서_자재입고_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);
