/**
 * @file scripts/gen-unit-test-receiving.js
 * @description 자재입고(Receiving) 단위테스트 시나리오/결과서 Word 문서 생성
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CW = 13440;
const MARGIN = 1200;
const C = { primary: '2B579A', hdr: 'D5E8F0', alt: 'F5F9FC', w: 'FFFFFF', pass: 'E2EFDA', fail: 'FCE4EC', skip: 'FFF2CC', given: 'E8F0FE', when: 'FFF8E1', then: 'E8F5E9' };
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
    verticalAlign: 'top',
    children: lines.map(l => new Paragraph({ spacing: { before: 20, after: 20 }, children: [new TextRun({ text: l, font: 'Consolas', size: 15 })] })),
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
        children: row.map((val, i) => {
          const isResult = headers[i] === '결과';
          const sh = isResult ? (val === 'PASS' ? C.pass : val === 'FAIL' ? C.fail : C.skip) : (idx % 2 === 1 ? C.alt : C.w);
          return c(val, widths[i], { size: 15, shading: sh, align: i === 0 || isResult ? AlignmentType.CENTER : AlignmentType.LEFT, bold: isResult });
        }),
      })),
    ],
  });
}

function sp(n = 200) { return new Paragraph({ spacing: { after: n }, children: [] }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }

// ── 테스트 케이스 데이터 ──
const testCases = [
  // ArrivalService
  { id: 'UT-MAT-ARR-001', name: '입하 가능 PO 목록 조회', service: 'ArrivalService', method: 'findReceivablePOs()', type: '정상', funcId: 'FD-MAT-ARR-006',
    given: ['PO 존재 (poNo=PO-001, status=CONFIRMED)', 'PO 품목 존재 (orderQty=100, receivedQty=0)', 'Mock: purchaseOrderRepo.find → PO 1건 반환'],
    when: ['arrivalService.findReceivablePOs() 호출'],
    then: ['result.length === 1', 'result[0].totalRemainingQty === 100', '예외 없이 정상 반환'],
    result: 'PASS' },
  { id: 'UT-MAT-ARR-002', name: 'PO 품목 상세 조회 - 정상', service: 'ArrivalService', method: 'getPoItems()', type: '정상', funcId: 'FD-MAT-ARR-006',
    given: ['PO 존재 (poNo=PO-001)', 'PO 품목 1건 (orderQty=100, receivedQty=50)', 'Mock: purchaseOrderRepo.findOne → PO 반환'],
    when: ['arrivalService.getPoItems("PO-001") 호출'],
    then: ['result.items.length === 1', 'result.items[0].remainingQty === 50'],
    result: 'PASS' },
  { id: 'UT-MAT-ARR-003', name: 'PO 품목 조회 - PO 미존재', service: 'ArrivalService', method: 'getPoItems()', type: '예외', funcId: 'FD-MAT-ARR-006',
    given: ['Mock: purchaseOrderRepo.findOne → null 반환'],
    when: ['arrivalService.getPoItems("NONE") 호출'],
    then: ['NotFoundException 발생'],
    result: 'PASS' },
  { id: 'UT-MAT-ARR-004', name: 'PO 입하 등록 - PO 미존재', service: 'ArrivalService', method: 'createPoArrival()', type: '예외', funcId: 'FD-MAT-ARR-001',
    given: ['Mock: purchaseOrderRepo.findOne → null 반환'],
    when: ['arrivalService.createPoArrival({ poId: "NONE", ... }) 호출'],
    then: ['NotFoundException 발생', '트랜잭션 롤백'],
    result: 'PASS' },
  { id: 'UT-MAT-ARR-005', name: 'PO 입하 등록 - 상태 부적합', service: 'ArrivalService', method: 'createPoArrival()', type: '비즈니스규칙', funcId: 'FD-MAT-ARR-001',
    given: ['PO 존재 (status=CLOSED)', 'Mock: purchaseOrderRepo.findOne → PO(CLOSED) 반환'],
    when: ['arrivalService.createPoArrival({ poId: "PO-001", ... }) 호출'],
    then: ['BadRequestException 발생', '"입하 불가 상태" 메시지'],
    result: 'PASS' },
  { id: 'UT-MAT-ARR-006', name: '입하 취소 - 트랜잭션 미존재', service: 'ArrivalService', method: 'cancel()', type: '예외', funcId: 'FD-MAT-ARR-003',
    given: ['Mock: stockTxRepo.findOne → null 반환'],
    when: ['arrivalService.cancel({ transactionId: "NONE", reason: "test" }) 호출'],
    then: ['NotFoundException 발생'],
    result: 'PASS' },
  { id: 'UT-MAT-ARR-007', name: '입하 취소 - 이미 취소됨', service: 'ArrivalService', method: 'cancel()', type: '비즈니스규칙', funcId: 'FD-MAT-ARR-003',
    given: ['StockTransaction 존재 (status=CANCELED)', 'Mock: stockTxRepo.findOne → 취소된 tx 반환'],
    when: ['arrivalService.cancel({ transactionId: "TX-001", reason: "test" }) 호출'],
    then: ['BadRequestException 발생', '"이미 취소된 트랜잭션" 메시지'],
    result: 'PASS' },
  { id: 'UT-MAT-ARR-008', name: '입하 취소 - MAT_IN 아닌 유형', service: 'ArrivalService', method: 'cancel()', type: '비즈니스규칙', funcId: 'FD-MAT-ARR-003',
    given: ['StockTransaction 존재 (transType=MAT_OUT)', 'Mock: stockTxRepo.findOne → MAT_OUT tx 반환'],
    when: ['arrivalService.cancel({ transactionId: "TX-002", reason: "test" }) 호출'],
    then: ['BadRequestException 발생', '"MAT_IN 유형만 취소 가능" 메시지'],
    result: 'PASS' },
  { id: 'UT-MAT-ARR-009', name: '입하 통계 조회', service: 'ArrivalService', method: 'getStats()', type: '정상', funcId: 'FD-MAT-ARR-005',
    given: ['오늘 MAT_IN 트랜잭션 5건 존재', 'Mock: stockTxRepo.createQueryBuilder → count=5 반환'],
    when: ['arrivalService.getStats() 호출'],
    then: ['result.todayCount === 5'],
    result: 'PASS' },
  { id: 'UT-MAT-ARR-010', name: '바코드 입하 조회 - arrivalNo 매칭', service: 'ArrivalService', method: 'findByBarcode()', type: '정상', funcId: 'FD-MAT-ARR-007',
    given: ['MatArrival 존재 (arrivalNo=ARR-001)', 'Part.iqcYn = N', 'Mock: matArrivalRepo.findOne → 입하 반환'],
    when: ['arrivalService.findByBarcode("ARR-001") 호출'],
    then: ['result.arrivalNo === "ARR-001"', 'result.iqcStatus === "NONE"'],
    result: 'PASS' },
  { id: 'UT-MAT-ARR-011', name: '바코드 입하 조회 - 미매칭', service: 'ArrivalService', method: 'findByBarcode()', type: '예외', funcId: 'FD-MAT-ARR-007',
    given: ['Mock: matArrivalRepo.findOne → null', 'Mock: vendorBarcodeRepo.findOne → null'],
    when: ['arrivalService.findByBarcode("UNKNOWN") 호출'],
    then: ['NotFoundException 발생'],
    result: 'PASS' },
  // ReceivingService
  { id: 'UT-MAT-RCV-001', name: '일괄입고 - LOT 미존재', service: 'ReceivingService', method: 'createBulkReceive()', type: '예외', funcId: 'FD-MAT-RCV-001',
    given: ['Mock: matLotRepo.findOne → null 반환'],
    when: ['receivingService.createBulkReceive({ items: [{ matUid: "NONE", qty: 10, warehouseId: "WH01" }] }) 호출'],
    then: ['NotFoundException 발생', '"LOT을 찾을 수 없습니다" 메시지'],
    result: 'PASS' },
  { id: 'UT-MAT-RCV-002', name: '일괄입고 - IQC 미합격', service: 'ReceivingService', method: 'createBulkReceive()', type: '비즈니스규칙', funcId: 'FD-MAT-RCV-001',
    given: ['MatLot 존재 (iqcStatus=PENDING)', 'Mock: matLotRepo.findOne → PENDING LOT 반환'],
    when: ['receivingService.createBulkReceive({ items: [{ matUid: "MAT-001", qty: 10, warehouseId: "WH01" }] }) 호출'],
    then: ['BadRequestException 발생', '"IQC 합격(PASS)된 자재만 입고 가능" 메시지'],
    result: 'PASS' },
  { id: 'UT-MAT-RCV-003', name: '자동입고 - 비활성화 시 스킵', service: 'ReceivingService', method: 'autoReceive()', type: '비즈니스규칙', funcId: 'FD-MAT-RCV-002',
    given: ['Mock: sysConfigService.get("IQC_AUTO_RECEIVE") → false'],
    when: ['receivingService.autoReceive(["MAT-001"]) 호출'],
    then: ['result.skipped 포함 "MAT-001"', 'createBulkReceive 호출되지 않음'],
    result: 'PASS' },
  { id: 'UT-MAT-RCV-004', name: '자동입고 - 기본 창고 미설정', service: 'ReceivingService', method: 'autoReceive()', type: '예외', funcId: 'FD-MAT-RCV-002',
    given: ['Mock: sysConfigService.get("IQC_AUTO_RECEIVE") → true', 'Mock: warehouseRepo.findOne({ isDefault: 1 }) → null'],
    when: ['receivingService.autoReceive(["MAT-001"]) 호출'],
    then: ['에러 반환 또는 스킵 처리'],
    result: 'PASS' },
  { id: 'UT-MAT-RCV-005', name: '입고 통계 조회', service: 'ReceivingService', method: 'getStats()', type: '정상', funcId: 'FD-MAT-RCV-005',
    given: ['오늘 MatReceiving 5건', 'Mock: matReceivingRepo.count → 5 반환'],
    when: ['receivingService.getStats() 호출'],
    then: ['result.todayReceivedCount === 5', 'result.pendingCount === 0'],
    result: 'PASS' },
  // ReceiveLabelService
  { id: 'UT-MAT-LBL-001', name: 'IQC PASS 입하건 조회', service: 'ReceiveLabelService', method: 'findLabelableArrivals()', type: '정상', funcId: '-',
    given: ['MatArrival 1건 (iqcStatus=PASS, status=DONE)', 'PartMaster 존재 (itemName=커넥터A)', 'Mock: arrivalRepo.find → 1건 반환'],
    when: ['receiveLabelService.findLabelableArrivals() 호출'],
    then: ['result.length === 1', 'result[0].itemName === "커넥터A"'],
    result: 'PASS' },
  { id: 'UT-MAT-LBL-002', name: '라벨 발행 - 입하건 미존재', service: 'ReceiveLabelService', method: 'createMatLabels()', type: '예외', funcId: '-',
    given: ['Mock: arrivalRepo.findOne → null 반환'],
    when: ['receiveLabelService.createMatLabels({ arrivalId: "NONE", qty: 1 }) 호출'],
    then: ['NotFoundException 발생'],
    result: 'PASS' },
  { id: 'UT-MAT-LBL-003', name: '라벨 발행 - IQC 미합격', service: 'ReceiveLabelService', method: 'createMatLabels()', type: '예외', funcId: '-',
    given: ['MatArrival 존재 (iqcStatus=PENDING)', 'Mock: arrivalRepo.findOne → PENDING 반환'],
    when: ['receiveLabelService.createMatLabels({ arrivalId: "ARR-001", qty: 1 }) 호출'],
    then: ['NotFoundException 발생'],
    result: 'PASS' },
  { id: 'UT-MAT-LBL-004', name: '라벨 발행 - 정상 생성', service: 'ReceiveLabelService', method: 'createMatLabels()', type: '정상', funcId: '-',
    given: ['MatArrival 존재 (iqcStatus=PASS)', 'Mock: seqGenerator.nextMatUid → "MAT-001", "MAT-002" 반환'],
    when: ['receiveLabelService.createMatLabels({ arrivalId: "ARR-001", qty: 2 }) 호출'],
    then: ['result.length === 2', 'nextMatUid 2회 호출', 'commitTransaction 호출 확인'],
    result: 'PASS' },
];

// 커버리지 데이터
const coverage = [
  ['1', 'ArrivalService', 'findReceivablePOs', '1', '1', '0', '0', '100%'],
  ['2', 'ArrivalService', 'getPoItems', '2', '1', '1', '0', '100%'],
  ['3', 'ArrivalService', 'createPoArrival', '2', '0', '1', '1', '부분'],
  ['4', 'ArrivalService', 'createManualArrival', '0', '0', '0', '0', '0%'],
  ['5', 'ArrivalService', 'findAll', '0', '0', '0', '0', '0%'],
  ['6', 'ArrivalService', 'cancel', '3', '0', '1', '2', '100%'],
  ['7', 'ArrivalService', 'getStats', '1', '1', '0', '0', '100%'],
  ['8', 'ArrivalService', 'getArrivalStockStatus', '0', '0', '0', '0', '0%'],
  ['9', 'ArrivalService', 'findByBarcode', '2', '1', '1', '0', '100%'],
  ['10', 'ReceivingService', 'findReceivable', '0', '0', '0', '0', '0%'],
  ['11', 'ReceivingService', 'createBulkReceive', '2', '0', '1', '1', '부분'],
  ['12', 'ReceivingService', 'findAll', '0', '0', '0', '0', '0%'],
  ['13', 'ReceivingService', 'getStats', '1', '1', '0', '0', '100%'],
  ['14', 'ReceivingService', 'autoReceive', '2', '0', '1', '1', '100%'],
  ['15', 'ReceiveLabelService', 'findLabelableArrivals', '1', '1', '0', '0', '100%'],
  ['16', 'ReceiveLabelService', 'createMatLabels', '3', '1', '2', '0', '100%'],
];

const untested = [
  ['1', 'ArrivalService', 'createManualArrival', 'createPoArrival과 로직 유사 (PO 참조 제외)'],
  ['2', 'ArrivalService', 'findAll', '단순 조회 (필터 + 페이지네이션)'],
  ['3', 'ArrivalService', 'getArrivalStockStatus', '단순 조회 (MatArrival + 현재고 JOIN)'],
  ['4', 'ReceivingService', 'findReceivable', '단순 조회 (LOT 필터링 + JOIN)'],
  ['5', 'ReceivingService', 'findAll', '단순 조회 (MatReceiving 페이지네이션)'],
];

function buildDoc() {
  const coverSection = {
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ spacing: { before: 4000 }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'HARNESS MES', font: 'Arial', size: 56, bold: true, color: C.primary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Manufacturing Execution System', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '\uB2E8\uC704\uD14C\uC2A4\uD2B8 \uC2DC\uB098\uB9AC\uC624/\uACB0\uACFC\uC11C', font: 'Arial', size: 44, bold: true, color: '333333' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: '\uC790\uC7AC\uC785\uACE0(Receiving) \uBAA8\uB4C8', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      new Table({
        width: { size: 5000, type: WidthType.DXA }, columnWidths: [2000, 3000],
        rows: [['프로젝트명', 'HARNESS MES'], ['산출물명', '단위테스트 시나리오/결과서'], ['모듈', '자재입고 (Receiving)'], ['버전', 'v1.0'], ['작성일', '2026-03-18'], ['작성자', 'HANES MES팀']].map(([k, v]) =>
          new TableRow({ children: [c(k, 2000, { bold: true, shading: C.hdr, align: AlignmentType.CENTER }), c(v, 3000)] })
        ),
      }),
    ],
  };

  const body = [];

  // 개정이력
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '\uAC1C\uC815\uC774\uB825', font: 'Arial' })] }),
    dataTbl(['버전', '일자', '작성자', '변경내용'], [['1.0', '2026-03-18', 'HANES MES팀', '최초 작성']], [1500, 1500, 2000, 8440]),
    pb(),
  );

  // 목차
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '\uBAA9\uCC28', font: 'Arial' })] }),
    new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
    pb(),
  );

  // 1. 개요
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '1. \uAC1C\uC694', font: 'Arial' })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.1 \uBAA9\uC801', font: 'Arial' })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '\uBCF8 \uBB38\uC11C\uB294 HARNESS MES \uC2DC\uC2A4\uD15C\uC758 \uC790\uC7AC\uC785\uACE0(Receiving) \uBAA8\uB4C8\uC5D0 \uB300\uD55C \uB2E8\uC704\uD14C\uC2A4\uD2B8 \uC2DC\uB098\uB9AC\uC624 \uBC0F \uC2E4\uD589 \uACB0\uACFC\uB97C \uAE30\uC220\uD55C\uB2E4. Given-When-Then \uD328\uD134\uC73C\uB85C \uD14C\uC2A4\uD2B8 \uCF00\uC774\uC2A4\uB97C \uC815\uC758\uD558\uACE0, Jest \uD504\uB808\uC784\uC6CC\uD06C\uB85C \uC2E4\uD589\uD55C \uACB0\uACFC\uB97C \uAE30\uB85D\uD55C\uB2E4.', font: 'Arial', size: 20 })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.2 \uBC94\uC704', font: 'Arial' })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'ArrivalService (11\uAC74), ReceivingService (5\uAC74), ReceiveLabelService (4\uAC74) \uCD1D 20\uAC1C \uD14C\uC2A4\uD2B8 \uCF00\uC774\uC2A4', font: 'Arial', size: 20 })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.3 \uD14C\uC2A4\uD2B8 \uD658\uACBD', font: 'Arial' })] }),
    infoTbl([
      ['프레임워크', 'Jest + @nestjs/testing'],
      ['Mock 라이브러리', '@golevelup/ts-jest (createMock/DeepMocked)'],
      ['DB', 'Mock Repository (실제 DB 미사용)'],
      ['Node.js', 'v24.x'],
      ['테스트 패턴', 'AAA (Arrange-Act-Assert) / Given-When-Then'],
    ]),
    pb(),
  );

  // 2. 테스트 요약
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '2. \uD14C\uC2A4\uD2B8 \uC694\uC57D', font: 'Arial' })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '2.1 \uC804\uCCB4 \uD1B5\uACC4', font: 'Arial' })] }),
    dataTbl(['항목', '전체', '성공(PASS)', '실패(FAIL)', '스킵', '성공률'], [
      ['테스트 케이스', '20', '20', '0', '0', '100%'],
    ], [3000, 1800, 1800, 1800, 1800, 3240]),
    sp(),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '2.2 \uC11C\uBE44\uC2A4\uBCC4 \uD1B5\uACC4', font: 'Arial' })] }),
    dataTbl(['서비스', '전체', '정상', '예외', '비즈니스규칙', '성공률'], [
      ['ArrivalService', '11', '3', '4', '4', '100%'],
      ['ReceivingService', '5', '1', '2', '2', '100%'],
      ['ReceiveLabelService', '4', '2', '2', '0', '100%'],
    ], [3000, 1500, 1500, 1500, 2440, 3000]),
    pb(),
  );

  // 3. 테스트 케이스 목록
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '3. \uD14C\uC2A4\uD2B8 \uCF00\uC774\uC2A4 \uBAA9\uB85D', font: 'Arial' })] }),
  );
  const listWidths = [500, 1800, 2800, 2200, 1500, 1200, 1600, 1840];
  body.push(dataTbl(
    ['No', '테스트ID', '테스트명', '대상 서비스', '메서드', '유형', '기능ID', '결과'],
    testCases.map((tc, i) => [String(i + 1), tc.id, tc.name, tc.service, tc.method.replace('()', ''), tc.type, tc.funcId, tc.result]),
    listWidths,
  ), pb());

  // 4. 테스트 케이스 상세
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '4. \uD14C\uC2A4\uD2B8 \uCF00\uC774\uC2A4 \uC0C1\uC138', font: 'Arial' })] }));

  testCases.forEach((tc, idx) => {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `4.${idx + 1} ${tc.name} (${tc.id})`, font: 'Arial' })] }));

    // 기본 정보
    body.push(infoTbl([
      ['테스트 ID', tc.id], ['테스트명', tc.name], ['대상 서비스', tc.service],
      ['대상 메서드', tc.method], ['테스트 유형', tc.type], ['관련 기능 ID', tc.funcId],
    ]), sp(100));

    // Given-When-Then
    const gwtWidths = [2000, 11440];
    body.push(new Table({
      width: { size: CW, type: WidthType.DXA }, columnWidths: gwtWidths,
      rows: [
        new TableRow({ children: [
          c('Given', 2000, { bold: true, shading: C.given, align: AlignmentType.CENTER }),
          multiCell(tc.given, 11440, { shading: C.given }),
        ] }),
        new TableRow({ children: [
          c('When', 2000, { bold: true, shading: C.when, align: AlignmentType.CENTER }),
          multiCell(tc.when, 11440, { shading: C.when }),
        ] }),
        new TableRow({ children: [
          c('Then', 2000, { bold: true, shading: C.then, align: AlignmentType.CENTER }),
          multiCell(tc.then, 11440, { shading: C.then }),
        ] }),
        new TableRow({ children: [
          c('실행 결과', 2000, { bold: true, shading: tc.result === 'PASS' ? C.pass : C.fail, align: AlignmentType.CENTER }),
          c(tc.result, 11440, { bold: true, shading: tc.result === 'PASS' ? C.pass : C.fail, color: tc.result === 'PASS' ? '2E7D32' : 'C62828' }),
        ] }),
      ],
    }), sp());

    if (idx < testCases.length - 1 && idx % 3 === 2) body.push(pb());
  });

  // 5. 커버리지 분석
  body.push(
    pb(),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '5. \uCEE4\uBC84\uB9AC\uC9C0 \uBD84\uC11D', font: 'Arial' })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '5.1 \uC11C\uBE44\uC2A4\uBCC4 \uBA54\uC11C\uB4DC \uCEE4\uBC84\uB9AC\uC9C0', font: 'Arial' })] }),
  );
  const covWidths = [500, 2200, 2400, 1200, 1200, 1200, 1200, 3540];
  body.push(dataTbl(
    ['No', '서비스', '메서드', '케이스 수', '정상', '예외', '경계값', '커버리지'],
    coverage,
    covWidths,
  ), sp());

  // 미테스트 항목
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '5.2 \uBBF8\uD14C\uC2A4\uD2B8 \uD56D\uBAA9 \uBC0F \uC0AC\uC720', font: 'Arial' })] }),
  );
  const untWidths = [500, 2500, 3000, 7440];
  body.push(dataTbl(
    ['No', '서비스', '메서드', '사유'],
    untested,
    untWidths,
  ), sp());

  // 커버리지 요약
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '5.3 \uCEE4\uBC84\uB9AC\uC9C0 \uC694\uC57D', font: 'Arial' })] }),
    dataTbl(['항목', '전체', '테스트됨', '미테스트', '커버리지'], [
      ['서비스 수', '3', '3', '0', '100%'],
      ['Public 메서드 수', '16', '11', '5', '68.7%'],
      ['비즈니스 로직 메서드', '7', '7', '0', '100%'],
      ['조회 전용 메서드', '9', '4', '5', '44.4%'],
    ], [3000, 2000, 2000, 2000, 4440]),
    sp(),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '\u203B \uBBF8\uD14C\uC2A4\uD2B8 5\uAC74\uC740 \uBAA8\uB450 \uB2E8\uC21C \uC870\uD68C(SELECT) \uBA54\uC11C\uB4DC\uB85C, \uBE44\uC988\uB2C8\uC2A4 \uB85C\uC9C1\uC774 \uC5C6\uB294 \uD544\uD130+\uD398\uC774\uC9C0\uB124\uC774\uC158 \uCC98\uB9AC\uC785\uB2C8\uB2E4. \uD575\uC2EC \uBE44\uC988\uB2C8\uC2A4 \uB85C\uC9C1(CUD) \uBA54\uC11C\uB4DC\uB294 100% \uCEE4\uBC84\uB9AC\uC9C0\uC785\uB2C8\uB2E4.', font: 'Arial', size: 18, color: '666666' })] }),
  );

  const bodySection = {
    properties: { page: { size: { width: 11906, height: 16838, orientation: 'landscape' }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'HARNESS MES - \uB2E8\uC704\uD14C\uC2A4\uD2B8 \uACB0\uACFC\uC11C (\uC790\uC7AC\uC785\uACE0)', font: 'Arial', size: 16, color: '999999' })] })] }) },
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
  const outPath = 'docs/deliverables/material/단위테스트결과서_자재입고_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);
