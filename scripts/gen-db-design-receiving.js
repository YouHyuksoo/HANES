/**
 * @file scripts/gen-db-design-receiving.js
 * @description 자재입고(Receiving) DB설계서 Word 문서 생성 스크립트
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents, LevelFormat,
} = require('docx');

// ── 공통 상수 ──
const PAGE_WIDTH = 15840; // A4 landscape width (DXA)
const PAGE_HEIGHT = 11906;
const MARGIN = 1200;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 13440

const COLORS = {
  primary: '2B579A',
  headerBg: 'D5E8F0',
  headerBg2: 'E8F0FE',
  altRow: 'F5F9FC',
  border: 'AAAAAA',
  lightBorder: 'CCCCCC',
  pkYellow: 'FFF2CC',
  fkGreen: 'E2EFDA',
  white: 'FFFFFF',
  coverBg: '2B579A',
  coverText: 'FFFFFF',
};

const border = { style: BorderStyle.SINGLE, size: 1, color: COLORS.border };
const borders = { top: border, bottom: border, left: border, right: border };
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: COLORS.lightBorder };
const thinBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function cell(text, width, opts = {}) {
  const { bold, shading, align, font, size, color, span, rowSpan } = opts;
  return new TableCell({
    borders: opts.borders || thinBorders,
    width: { size: width, type: WidthType.DXA },
    shading: shading ? { fill: shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    columnSpan: span,
    rowSpan: rowSpan,
    verticalAlign: opts.vAlign || 'center',
    children: [
      new Paragraph({
        alignment: align || AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: text || '',
            bold: bold || false,
            font: font || 'Arial',
            size: size || 18,
            color: color || '000000',
          }),
        ],
      }),
    ],
  });
}

// ── 테이블 데이터 ──
const tables = [
  {
    name: 'PURCHASE_ORDERS',
    korean: '발주',
    desc: '구매발주 마스터 정보를 관리한다. 발주번호(PO_NO)를 자연키 PK로 사용하며, 상태는 DRAFT → CONFIRMED → PARTIAL → RECEIVED 순으로 변경된다.',
    pk: ['PO_NO'],
    fk: [],
    indexes: [
      { name: 'IDX_PO_STATUS', columns: ['STATUS'] },
      { name: 'IDX_PO_ORDER_DATE', columns: ['ORDER_DATE'] },
    ],
    columns: [
      ['PO_NO', '발주번호', 'VARCHAR2', '50', 'Y', '-', 'Y', '-', '자동채번'],
      ['PARTNER_ID', '거래처ID', 'VARCHAR2', '255', '-', '-', 'N', '-', '거래처 식별자'],
      ['PARTNER_NAME', '거래처명', 'VARCHAR2', '255', '-', '-', 'N', '-', '거래처 표시명'],
      ['ORDER_DATE', '발주일', 'DATE', '-', '-', '-', 'N', '-', '발주 일자'],
      ['DUE_DATE', '납기일', 'DATE', '-', '-', '-', 'N', '-', '납품 기한'],
      ['STATUS', '상태', 'VARCHAR2', '50', '-', '-', 'Y', 'DRAFT', 'DRAFT/CONFIRMED/PARTIAL/RECEIVED'],
      ['TOTAL_AMOUNT', '총금액', 'NUMBER', '14,2', '-', '-', 'N', '-', '발주 총금액'],
      ['REMARK', '비고', 'VARCHAR2', '500', '-', '-', 'N', '-', ''],
      ['COMPANY', '회사코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['PLANT_CD', '공장코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['CREATED_BY', '생성자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['UPDATED_BY', '수정자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['CREATED_AT', '생성일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동생성'],
      ['UPDATED_AT', '수정일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동갱신'],
    ],
  },
  {
    name: 'PURCHASE_ORDER_ITEMS',
    korean: '발주품목',
    desc: '발주별 품목 내역을 관리한다. PO_ID + SEQ 복합 PK를 사용하며, 입하 시 RECEIVED_QTY가 증가하여 PO 상태 재계산에 사용된다.',
    pk: ['PO_ID', 'SEQ'],
    fk: [{ col: 'PO_ID', ref: 'PURCHASE_ORDERS.PO_NO' }],
    indexes: [
      { name: 'IDX_POI_ITEM_CODE', columns: ['ITEM_CODE'] },
    ],
    columns: [
      ['PO_ID', '발주번호', 'VARCHAR2', '50', 'Y', 'PURCHASE_ORDERS.PO_NO', 'Y', '-', 'PO 참조'],
      ['SEQ', '순번', 'NUMBER', '-', 'Y', '-', 'Y', '-', '품목 순번'],
      ['ITEM_CODE', '품목코드', 'VARCHAR2', '50', '-', '-', 'Y', '-', '품목마스터 참조'],
      ['ORDER_QTY', '발주수량', 'NUMBER', '-', '-', '-', 'Y', '-', '발주 수량'],
      ['RECEIVED_QTY', '수령수량', 'NUMBER', '-', '-', '-', 'Y', '0', '입하 시 증가'],
      ['UNIT_PRICE', '단가', 'NUMBER', '12,4', '-', '-', 'N', '-', '품목 단가'],
      ['REMARK', '비고', 'VARCHAR2', '500', '-', '-', 'N', '-', ''],
      ['COMPANY', '회사코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['PLANT_CD', '공장코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['CREATED_BY', '생성자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['UPDATED_BY', '수정자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['CREATED_AT', '생성일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동생성'],
      ['UPDATED_AT', '수정일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동갱신'],
    ],
  },
  {
    name: 'MAT_ARRIVALS',
    korean: '입하',
    desc: 'PO/수동 입하 시 업무 이력을 기록하는 전용 테이블. ARRIVAL_NO + SEQ 복합 PK를 사용하며, 같은 배치의 입하는 동일한 입하번호를 가진다.',
    pk: ['ARRIVAL_NO', 'SEQ'],
    fk: [{ col: 'PO_NO', ref: 'PURCHASE_ORDERS.PO_NO' }],
    indexes: [
      { name: 'IDX_ARR_ITEM_CODE', columns: ['ITEM_CODE'] },
      { name: 'IDX_ARR_ARRIVAL_DATE', columns: ['ARRIVAL_DATE'] },
      { name: 'IDX_ARR_INVOICE_NO', columns: ['INVOICE_NO'] },
      { name: 'IDX_ARR_VENDOR_ID', columns: ['VENDOR_ID'] },
    ],
    columns: [
      ['ARRIVAL_NO', '입하번호', 'VARCHAR2', '50', 'Y', '-', 'Y', '-', '자동채번'],
      ['SEQ', '순번', 'NUMBER', '-', 'Y', '-', 'Y', '1', '품목 순번'],
      ['INVOICE_NO', '인보이스번호', 'VARCHAR2', '100', '-', '-', 'Y', '-', '공급상 인보이스'],
      ['PO_ID', 'PO ID', 'VARCHAR2', '50', '-', '-', 'N', '-', 'PO 참조'],
      ['PO_ITEM_ID', 'PO 품목ID', 'VARCHAR2', '50', '-', '-', 'N', '-', 'PO 품목 seq'],
      ['PO_NO', 'PO 번호', 'VARCHAR2', '50', '-', 'PURCHASE_ORDERS.PO_NO', 'N', '-', 'PO 번호 참조'],
      ['VENDOR_ID', '공급상ID', 'VARCHAR2', '50', '-', '-', 'Y', '-', '공급상 식별자'],
      ['VENDOR_NAME', '공급상명', 'VARCHAR2', '200', '-', '-', 'Y', '-', '공급상 표시명'],
      ['ITEM_CODE', '품목코드', 'VARCHAR2', '50', '-', '-', 'Y', '-', '품목마스터 참조'],
      ['QTY', '수량', 'NUMBER', '-', '-', '-', 'Y', '-', '입하 수량'],
      ['WAREHOUSE_CODE', '창고코드', 'VARCHAR2', '50', '-', '-', 'Y', '-', '입하 대상 창고'],
      ['ARRIVAL_DATE', '입하일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '입하 일시'],
      ['ARRIVAL_TYPE', '입하유형', 'VARCHAR2', '20', '-', '-', 'Y', 'PO', 'PO/MANUAL'],
      ['WORKER_ID', '작업자ID', 'VARCHAR2', '50', '-', '-', 'N', '-', '입하 처리 작업자'],
      ['REMARK', '비고', 'VARCHAR2', '500', '-', '-', 'N', '-', ''],
      ['IQC_STATUS', 'IQC상태', 'VARCHAR2', '20', '-', '-', 'Y', 'PENDING', 'PENDING/PASS/FAIL'],
      ['SUP_UID', '공급업체UID', 'VARCHAR2', '50', '-', '-', 'N', '-', '공급업체 고유ID'],
      ['STATUS', '상태', 'VARCHAR2', '20', '-', '-', 'Y', 'DONE', 'DONE/CANCELED'],
      ['COMPANY', '회사코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['PLANT_CD', '공장코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['CREATED_BY', '생성자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['UPDATED_BY', '수정자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['CREATED_AT', '생성일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동생성'],
      ['UPDATED_AT', '수정일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동갱신'],
    ],
  },
  {
    name: 'MAT_LOTS',
    korean: '자재LOT',
    desc: '원자재 LOT 단위 추적/관리 테이블. MAT_UID를 자연키 PK로 사용하며, 라벨 발행 시점에 생성된다. 재고수량은 MAT_STOCKS에서만 관리하며 이 테이블에는 초기수량(INIT_QTY)만 보관한다.',
    pk: ['MAT_UID'],
    fk: [],
    indexes: [
      { name: 'IDX_LOT_ITEM_CODE', columns: ['ITEM_CODE'] },
      { name: 'IDX_LOT_STATUS', columns: ['STATUS'] },
      { name: 'IDX_LOT_IQC_STATUS', columns: ['IQC_STATUS'] },
    ],
    columns: [
      ['MAT_UID', '자재UID', 'VARCHAR2', '50', 'Y', '-', 'Y', '-', 'LOT 고유식별자'],
      ['ITEM_CODE', '품목코드', 'VARCHAR2', '50', '-', '-', 'Y', '-', '품목마스터 참조'],
      ['INIT_QTY', '초기수량', 'NUMBER', '-', '-', '-', 'Y', '-', '입고 시 불변값'],
      ['RECV_DATE', '수령일', 'DATE', '-', '-', '-', 'N', '-', '자재 수령일'],
      ['MANUFACTURE_DATE', '제조일자', 'DATE', '-', '-', '-', 'N', '-', '제조일자'],
      ['EXPIRE_DATE', '유효기한', 'DATE', '-', '-', '-', 'N', '-', '제조일+유효기간'],
      ['ORIGIN', '원산지', 'VARCHAR2', '50', '-', '-', 'N', '-', '원산지 정보'],
      ['VENDOR', '공급상', 'VARCHAR2', '50', '-', '-', 'Y', '-', '공급상 코드'],
      ['INVOICE_NO', '인보이스번호', 'VARCHAR2', '50', '-', '-', 'Y', '-', '인보이스 번호'],
      ['PO_NO', 'PO번호', 'VARCHAR2', '50', '-', '-', 'N', '-', '발주번호 참조'],
      ['IQC_STATUS', 'IQC상태', 'VARCHAR2', '20', '-', '-', 'Y', 'PENDING', 'PENDING/PASS/FAIL'],
      ['STATUS', 'LOT상태', 'VARCHAR2', '20', '-', '-', 'Y', 'NORMAL', 'NORMAL/HOLD/SCRAPPED'],
      ['COMPANY', '회사코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['PLANT_CD', '공장코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['CREATED_BY', '생성자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['UPDATED_BY', '수정자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['CREATED_AT', '생성일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동생성'],
      ['UPDATED_AT', '수정일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동갱신'],
    ],
  },
  {
    name: 'MAT_RECEIVINGS',
    korean: '입고',
    desc: 'IQC 합격건의 입고 이력을 관리하는 전용 테이블. RECEIVE_NO + SEQ 복합 PK를 사용하며, 같은 배치의 입고는 동일한 입고번호를 가진다. 분할 입고를 지원한다.',
    pk: ['RECEIVE_NO', 'SEQ'],
    fk: [],
    indexes: [
      { name: 'IDX_RCV_MAT_UID', columns: ['MAT_UID'] },
      { name: 'IDX_RCV_ITEM_CODE', columns: ['ITEM_CODE'] },
      { name: 'IDX_RCV_RECEIVE_DATE', columns: ['RECEIVE_DATE'] },
    ],
    columns: [
      ['RECEIVE_NO', '입고번호', 'VARCHAR2', '50', 'Y', '-', 'Y', '-', '자동채번'],
      ['SEQ', '순번', 'NUMBER', '-', 'Y', '-', 'Y', '1', '품목 순번'],
      ['MAT_UID', '자재UID', 'VARCHAR2', '50', '-', '-', 'Y', '-', 'LOT 식별자'],
      ['ITEM_CODE', '품목코드', 'VARCHAR2', '50', '-', '-', 'Y', '-', '품목마스터 참조'],
      ['QTY', '수량', 'NUMBER', '-', '-', '-', 'Y', '-', '입고 수량'],
      ['WAREHOUSE_CODE', '창고코드', 'VARCHAR2', '50', '-', '-', 'Y', '-', '입고 대상 창고'],
      ['RECEIVE_DATE', '입고일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '입고 일시'],
      ['WORKER_ID', '작업자ID', 'VARCHAR2', '50', '-', '-', 'N', '-', '입고 처리 작업자'],
      ['REMARK', '비고', 'VARCHAR2', '500', '-', '-', 'N', '-', ''],
      ['STATUS', '상태', 'VARCHAR2', '20', '-', '-', 'Y', 'DONE', 'DONE/CANCELED'],
      ['COMPANY', '회사코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['PLANT_CD', '공장코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['CREATED_BY', '생성자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['UPDATED_BY', '수정자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['CREATED_AT', '생성일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동생성'],
      ['UPDATED_AT', '수정일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동갱신'],
    ],
  },
  {
    name: 'MAT_STOCKS',
    korean: '원자재현재고',
    desc: '창고별 원자재 현재고를 관리한다. WAREHOUSE_CODE + ITEM_CODE + MAT_UID 복합 PK를 사용하며, 입고/출고 시 upsert로 갱신된다. 가용수량 = 총수량 - 예약수량.',
    pk: ['WAREHOUSE_CODE', 'ITEM_CODE', 'MAT_UID'],
    fk: [],
    indexes: [
      { name: 'IDX_STK_WAREHOUSE', columns: ['WAREHOUSE_CODE'] },
      { name: 'IDX_STK_ITEM_CODE', columns: ['ITEM_CODE'] },
    ],
    columns: [
      ['WAREHOUSE_CODE', '창고코드', 'VARCHAR2', '50', 'Y', '-', 'Y', '-', '창고 식별자'],
      ['ITEM_CODE', '품목코드', 'VARCHAR2', '50', 'Y', '-', 'Y', '-', '품목 식별자'],
      ['MAT_UID', '자재UID', 'VARCHAR2', '50', 'Y', '-', 'Y', '-', 'LOT 식별자'],
      ['LOCATION_CODE', '로케이션코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '창고 내 위치'],
      ['QTY', '총수량', 'NUMBER', '-', '-', '-', 'Y', '0', '총 재고수량'],
      ['RESERVED_QTY', '예약수량', 'NUMBER', '-', '-', '-', 'Y', '0', '불출 예약 수량'],
      ['AVAILABLE_QTY', '가용수량', 'NUMBER', '-', '-', '-', 'Y', '0', 'QTY - RESERVED_QTY'],
      ['LAST_COUNT', '최종집계일시', 'TIMESTAMP', '-', '-', '-', 'N', '-', '재고실사 일시'],
      ['COMPANY', '회사코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['PLANT_CD', '공장코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['CREATED_BY', '생성자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['UPDATED_BY', '수정자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['CREATED_AT', '생성일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동생성'],
      ['UPDATED_AT', '수정일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동갱신'],
    ],
  },
  {
    name: 'STOCK_TRANSACTIONS',
    korean: '수불원장',
    desc: '모든 원자재 재고 이동을 기록하는 수불원장. TRANS_NO를 자연키 PK로 사용한다. 삭제 금지 원칙이며, 취소 시 역분개(음수 수량) 방식으로 처리한다.',
    pk: ['TRANS_NO'],
    fk: [],
    indexes: [
      { name: 'IDX_TX_TRANS_TYPE', columns: ['TRANS_TYPE'] },
      { name: 'IDX_TX_TRANS_DATE', columns: ['TRANS_DATE'] },
      { name: 'IDX_TX_FROM_WH', columns: ['FROM_WAREHOUSE_ID'] },
      { name: 'IDX_TX_TO_WH', columns: ['TO_WAREHOUSE_ID'] },
      { name: 'IDX_TX_ITEM_CODE', columns: ['ITEM_CODE'] },
      { name: 'IDX_TX_MAT_UID', columns: ['MAT_UID'] },
      { name: 'IDX_TX_REF', columns: ['REF_TYPE', 'REF_ID'] },
      { name: 'IDX_TX_CANCEL_REF', columns: ['CANCEL_REF_ID'] },
    ],
    columns: [
      ['TRANS_NO', '트랜잭션번호', 'VARCHAR2', '50', 'Y', '-', 'Y', '-', '자동채번'],
      ['TRANS_TYPE', '거래유형', 'VARCHAR2', '50', '-', '-', 'Y', '-', 'MAT_IN/MAT_IN_CANCEL/RECEIVE 등'],
      ['TRANS_DATE', '거래일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '거래 발생 일시'],
      ['FROM_WAREHOUSE_ID', '출고창고ID', 'VARCHAR2', '50', '-', '-', 'N', '-', '출고 창고 (입고 시: 입하창고)'],
      ['TO_WAREHOUSE_ID', '입고창고ID', 'VARCHAR2', '50', '-', '-', 'N', '-', '입고 창고 (입고 시: 대상창고)'],
      ['ITEM_CODE', '품목코드', 'VARCHAR2', '50', '-', '-', 'Y', '-', '품목마스터 참조'],
      ['MAT_UID', '자재UID', 'VARCHAR2', '50', '-', '-', 'N', '-', 'LOT 식별자'],
      ['QTY', '수량', 'NUMBER', '-', '-', '-', 'Y', '-', '거래수량 (취소 시 음수)'],
      ['UNIT_PRICE', '단가', 'NUMBER', '12,4', '-', '-', 'N', '-', '품목 단가'],
      ['TOTAL_AMOUNT', '총금액', 'NUMBER', '14,2', '-', '-', 'N', '-', '거래 총금액'],
      ['REF_TYPE', '참조유형', 'VARCHAR2', '50', '-', '-', 'N', '-', 'PO/MANUAL/RECEIVE/CANCEL'],
      ['REF_ID', '참조ID', 'VARCHAR2', '50', '-', '-', 'N', '-', '참조 문서 번호'],
      ['CANCEL_REF_ID', '취소참조ID', 'VARCHAR2', '50', '-', '-', 'N', '-', '역분개 원본 TRANS_NO'],
      ['WORKER_ID', '작업자ID', 'VARCHAR2', '50', '-', '-', 'N', '-', '처리 작업자'],
      ['REMARK', '비고', 'VARCHAR2', '500', '-', '-', 'N', '-', ''],
      ['STATUS', '상태', 'VARCHAR2', '20', '-', '-', 'Y', 'DONE', 'DONE/CANCELED'],
      ['COMPANY', '회사코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['PLANT_CD', '공장코드', 'VARCHAR2', '50', '-', '-', 'N', '-', '멀티테넌시'],
      ['CREATED_BY', '생성자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['UPDATED_BY', '수정자', 'VARCHAR2', '50', '-', '-', 'N', '-', ''],
      ['CREATED_AT', '생성일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동생성'],
      ['UPDATED_AT', '수정일시', 'TIMESTAMP', '-', '-', '-', 'Y', 'CURRENT_TIMESTAMP', '자동갱신'],
    ],
  },
];

// ── 컬럼 정의 테이블 생성 함수 ──
const COL_WIDTHS = [500, 1800, 1400, 1200, 700, 500, 500, 600, 1200, 5040];
const COL_HEADERS = ['No', '컬럼명(물리)', '컬럼명(논리)', '데이터타입', '길이', 'PK', 'FK', 'NOT NULL', '기본값', '설명'];

function makeColumnTable(tbl) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: COL_HEADERS.map((h, i) =>
      cell(h, COL_WIDTHS[i], { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER, size: 16 })
    ),
  });

  const dataRows = tbl.columns.map((col, idx) => {
    const isPk = col[4] === 'Y';
    const isFk = col[5] !== '-';
    const rowShading = isPk ? COLORS.pkYellow : isFk ? COLORS.fkGreen : idx % 2 === 1 ? COLORS.altRow : COLORS.white;
    return new TableRow({
      children: [
        cell(String(idx + 1), COL_WIDTHS[0], { align: AlignmentType.CENTER, shading: rowShading, size: 16 }),
        cell(col[0], COL_WIDTHS[1], { bold: true, shading: rowShading, size: 16 }),
        cell(col[1], COL_WIDTHS[2], { shading: rowShading, size: 16 }),
        cell(col[2], COL_WIDTHS[3], { align: AlignmentType.CENTER, shading: rowShading, size: 16 }),
        cell(col[3], COL_WIDTHS[4], { align: AlignmentType.CENTER, shading: rowShading, size: 16 }),
        cell(col[4], COL_WIDTHS[5], { align: AlignmentType.CENTER, shading: rowShading, size: 16, bold: col[4] === 'Y' }),
        cell(col[5] === '-' ? '-' : 'Y', COL_WIDTHS[6], { align: AlignmentType.CENTER, shading: rowShading, size: 16 }),
        cell(col[6], COL_WIDTHS[7], { align: AlignmentType.CENTER, shading: rowShading, size: 16 }),
        cell(col[7], COL_WIDTHS[8], { align: AlignmentType.CENTER, shading: rowShading, size: 16 }),
        cell(col[8], COL_WIDTHS[9], { shading: rowShading, size: 16 }),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    rows: [headerRow, ...dataRows],
  });
}

// ── PK/FK 제약조건 테이블 ──
function makeConstraintTable(tbl) {
  const rows = [];
  // Header
  rows.push(new TableRow({
    tableHeader: true,
    children: [
      cell('구분', 2000, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER, size: 16 }),
      cell('제약조건명', 3000, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER, size: 16 }),
      cell('컬럼', 3000, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER, size: 16 }),
      cell('참조 테이블.컬럼', 5440, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER, size: 16 }),
    ],
  }));
  // PK
  rows.push(new TableRow({
    children: [
      cell('PK', 2000, { align: AlignmentType.CENTER, shading: COLORS.pkYellow, bold: true, size: 16 }),
      cell(`PK_${tbl.name}`, 3000, { size: 16 }),
      cell(tbl.pk.join(', '), 3000, { bold: true, size: 16 }),
      cell('-', 5440, { align: AlignmentType.CENTER, size: 16 }),
    ],
  }));
  // FK
  tbl.fk.forEach((fk, i) => {
    rows.push(new TableRow({
      children: [
        cell('FK', 2000, { align: AlignmentType.CENTER, shading: COLORS.fkGreen, bold: true, size: 16 }),
        cell(`FK_${tbl.name}_${i + 1}`, 3000, { size: 16 }),
        cell(fk.col, 3000, { size: 16 }),
        cell(fk.ref, 5440, { size: 16 }),
      ],
    }));
  });
  if (tbl.fk.length === 0) {
    rows.push(new TableRow({
      children: [
        cell('FK', 2000, { align: AlignmentType.CENTER, size: 16 }),
        cell('-', 3000, { align: AlignmentType.CENTER, size: 16 }),
        cell('-', 3000, { align: AlignmentType.CENTER, size: 16 }),
        cell('-', 5440, { align: AlignmentType.CENTER, size: 16 }),
      ],
    }));
  }

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [2000, 3000, 3000, 5440],
    rows,
  });
}

// ── 인덱스 테이블 ──
function makeIndexTable(tbl) {
  const rows = [];
  rows.push(new TableRow({
    tableHeader: true,
    children: [
      cell('No', 1000, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER, size: 16 }),
      cell('인덱스명', 4000, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER, size: 16 }),
      cell('컬럼', 4000, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER, size: 16 }),
      cell('유형', 4440, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER, size: 16 }),
    ],
  }));
  tbl.indexes.forEach((idx, i) => {
    const sh = i % 2 === 1 ? COLORS.altRow : COLORS.white;
    rows.push(new TableRow({
      children: [
        cell(String(i + 1), 1000, { align: AlignmentType.CENTER, shading: sh, size: 16 }),
        cell(idx.name, 4000, { shading: sh, size: 16 }),
        cell(idx.columns.join(', '), 4000, { shading: sh, size: 16 }),
        cell('NON-UNIQUE', 4440, { align: AlignmentType.CENTER, shading: sh, size: 16 }),
      ],
    }));
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [1000, 4000, 4000, 4440],
    rows,
  });
}

// ── 문서 생성 ──
function buildDoc() {
  const children = [];

  // ── 표지 (Section 1) ──
  const coverSection = {
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    children: [
      new Paragraph({ spacing: { before: 4000 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'HARNESS MES', font: 'Arial', size: 56, bold: true, color: COLORS.primary })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: 'Manufacturing Execution System', font: 'Arial', size: 28, color: '666666' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'DB\uC124\uACC4\uC11C', font: 'Arial', size: 48, bold: true, color: '333333' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: '\uC790\uC7AC\uC785\uACE0(Receiving) \uBAA8\uB4C8', font: 'Arial', size: 28, color: '666666' })],
      }),
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      // 문서정보 테이블
      new Table({
        width: { size: 5000, type: WidthType.DXA },
        columnWidths: [2000, 3000],
        rows: [
          ['프로젝트명', 'HARNESS MES'],
          ['산출물명', 'DB설계서 - 자재입고'],
          ['버전', 'v1.0'],
          ['작성일', '2026-03-18'],
          ['작성자', 'HANES MES팀'],
        ].map(([k, v]) =>
          new TableRow({
            children: [
              cell(k, 2000, { bold: true, shading: COLORS.headerBg, size: 18, align: AlignmentType.CENTER }),
              cell(v, 3000, { size: 18 }),
            ],
          })
        ),
      }),
    ],
  };

  // ── 본문 (Section 2 - Landscape) ──
  const bodyChildren = [];

  // 개정이력
  bodyChildren.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '\uAC1C\uC815\uC774\uB825', font: 'Arial' })] }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [1500, 1500, 2000, 8440],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell('버전', 1500, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
            cell('일자', 1500, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
            cell('작성자', 2000, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
            cell('변경내용', 8440, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            cell('1.0', 1500, { align: AlignmentType.CENTER }),
            cell('2026-03-18', 1500, { align: AlignmentType.CENTER }),
            cell('HANES MES팀', 2000, { align: AlignmentType.CENTER }),
            cell('최초 작성', 8440),
          ],
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // 목차
  bodyChildren.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '\uBAA9\uCC28', font: 'Arial' })] }),
    new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // 1. 개요
  bodyChildren.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '1. \uAC1C\uC694', font: 'Arial' })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.1 \uBAA9\uC801', font: 'Arial' })] }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: '\uBCF8 \uBB38\uC11C\uB294 HARNESS MES \uC2DC\uC2A4\uD15C\uC758 \uC790\uC7AC\uC785\uACE0(Receiving) \uAE30\uB2A5\uC5D0 \uD544\uC694\uD55C \uB370\uC774\uD130\uBCA0\uC774\uC2A4 \uC124\uACC4\uB97C \uC815\uC758\uD55C\uB2E4. \uBC1C\uC8FC\uBD80\uD130 \uC785\uD558, IQC \uAC80\uC0AC, \uC785\uACE0, \uD604\uC7AC\uACE0 \uBC18\uC601\uAE4C\uC9C0\uC758 \uC804\uCCB4 \uC7AC\uACE0 \uD750\uB984\uC744 \uC9C0\uC6D0\uD558\uB294 \uD14C\uC774\uBE14 \uAD6C\uC870\uB97C \uAE30\uC220\uD55C\uB2E4.', font: 'Arial', size: 20 })],
    }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.2 \uBC94\uC704', font: 'Arial' })] }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: '\uC790\uC7AC\uC785\uACE0 \uAE30\uB2A5 \uAD00\uB828 7\uAC1C \uD14C\uC774\uBE14: PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, MAT_ARRIVALS, MAT_LOTS, MAT_RECEIVINGS, MAT_STOCKS, STOCK_TRANSACTIONS', font: 'Arial', size: 20 })],
    }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: '1.3 \uCC38\uACE0 \uBB38\uC11C', font: 'Arial' })] }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: 'HARNESS MES \uC694\uAD6C\uC0AC\uD56D\uC815\uC758\uC11C, \uAE30\uB2A5\uC124\uACC4\uC11C', font: 'Arial', size: 20 })],
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // 2. 데이터베이스 개요
  bodyChildren.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '2. \uB370\uC774\uD130\uBCA0\uC774\uC2A4 \uAC1C\uC694', font: 'Arial' })] }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [3000, 10440],
      rows: [
        ['DBMS', 'Oracle Database'],
        ['문자셋', 'AL32UTF8'],
        ['정렬 규칙', 'BINARY'],
        ['스키마', 'HANES (멀티테넌시: COMPANY + PLANT_CD)'],
        ['ORM', 'TypeORM (NestJS)'],
        ['PK 전략', '자연키/복합키 (Auto Increment 미사용)'],
      ].map(([k, v]) =>
        new TableRow({
          children: [
            cell(k, 3000, { bold: true, shading: COLORS.headerBg }),
            cell(v, 10440),
          ],
        })
      ),
    }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // 3. 테이블 목록
  bodyChildren.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '3. \uD14C\uC774\uBE14 \uBAA9\uB85D', font: 'Arial' })] }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [600, 3000, 1800, 8040],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell('No', 600, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
            cell('테이블명', 3000, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
            cell('한글명', 1800, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
            cell('설명', 8040, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
          ],
        }),
        ...tables.map((t, i) =>
          new TableRow({
            children: [
              cell(String(i + 1), 600, { align: AlignmentType.CENTER, shading: i % 2 === 1 ? COLORS.altRow : COLORS.white }),
              cell(t.name, 3000, { bold: true, shading: i % 2 === 1 ? COLORS.altRow : COLORS.white }),
              cell(t.korean, 1800, { shading: i % 2 === 1 ? COLORS.altRow : COLORS.white }),
              cell(t.desc.substring(0, 80) + (t.desc.length > 80 ? '...' : ''), 8040, { shading: i % 2 === 1 ? COLORS.altRow : COLORS.white, size: 16 }),
            ],
          })
        ),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // 4. 테이블 정의 (각 테이블별)
  bodyChildren.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '4. \uD14C\uC774\uBE14 \uC815\uC758', font: 'Arial' })] }),
  );

  tables.forEach((tbl, idx) => {
    // 4.N 테이블명
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `4.${idx + 1} ${tbl.name} (${tbl.korean})`, font: 'Arial' })],
      }),
    );

    // 기본 정보
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: `4.${idx + 1}.1 \uD14C\uC774\uBE14 \uAE30\uBCF8 \uC815\uBCF4`, font: 'Arial' })],
      }),
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [3000, 10440],
        rows: [
          ['테이블명(물리)', tbl.name],
          ['테이블명(논리)', tbl.korean],
          ['설명', tbl.desc],
          ['PK', tbl.pk.join(' + ')],
        ].map(([k, v]) =>
          new TableRow({
            children: [
              cell(k, 3000, { bold: true, shading: COLORS.headerBg }),
              cell(v, 10440),
            ],
          })
        ),
      }),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
    );

    // 컬럼 정의
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: `4.${idx + 1}.2 \uCEEC\uB7FC \uC815\uC758`, font: 'Arial' })],
      }),
      makeColumnTable(tbl),
      new Paragraph({ spacing: { after: 100 }, children: [] }),
      // 범례
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: '\u25A0 ', size: 14, color: 'B8860B' }),
          new TextRun({ text: 'PK \uCEEC\uB7FC   ', size: 14 }),
          new TextRun({ text: '\u25A0 ', size: 14, color: '548235' }),
          new TextRun({ text: 'FK \uCEEC\uB7FC', size: 14 }),
        ],
      }),
    );

    // PK/FK 제약조건
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: `4.${idx + 1}.3 PK/FK \uC81C\uC57D\uC870\uAC74`, font: 'Arial' })],
      }),
      makeConstraintTable(tbl),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
    );

    // 인덱스
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: `4.${idx + 1}.4 \uC778\uB371\uC2A4 \uC815\uC758`, font: 'Arial' })],
      }),
      makeIndexTable(tbl),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
    );

    // 페이지 구분 (마지막 테이블 제외)
    if (idx < tables.length - 1) {
      bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  // 5. ERD 요약
  bodyChildren.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '5. \uD14C\uC774\uBE14 \uAD00\uACC4\uB3C4 (ERD \uC694\uC57D)', font: 'Arial' })] }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: '\uC790\uC7AC\uC785\uACE0 \uAE30\uB2A5\uC758 \uD14C\uC774\uBE14 \uAD00\uACC4 \uAD6C\uC870:', font: 'Arial', size: 20 })],
    }),
  );

  // ERD를 텍스트 기반 테이블로 표현
  const erdData = [
    ['PURCHASE_ORDERS', '1 : N', 'PURCHASE_ORDER_ITEMS', 'PO_NO = PO_ID', '발주 → 발주품목'],
    ['PURCHASE_ORDER_ITEMS', '1 : N', 'MAT_ARRIVALS', 'PO_NO 참조', '발주품목 → 입하'],
    ['MAT_ARRIVALS', '→', 'STOCK_TRANSACTIONS', 'MAT_IN 유형', '입하 → 수불원장(입하)'],
    ['MAT_LOTS', '1 : N', 'MAT_RECEIVINGS', 'MAT_UID 참조', 'LOT → 입고'],
    ['MAT_RECEIVINGS', '→', 'STOCK_TRANSACTIONS', 'RECEIVE 유형', '입고 → 수불원장(입고)'],
    ['STOCK_TRANSACTIONS', '→', 'MAT_STOCKS', 'upsert', '수불 → 현재고 반영'],
  ];

  bodyChildren.push(
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [3200, 1000, 3200, 2500, 3540],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell('From 테이블', 3200, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
            cell('관계', 1000, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
            cell('To 테이블', 3200, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
            cell('연결 컬럼', 2500, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
            cell('설명', 3540, { bold: true, shading: COLORS.headerBg, align: AlignmentType.CENTER }),
          ],
        }),
        ...erdData.map((row, i) =>
          new TableRow({
            children: row.map((val, j) =>
              cell(val, [3200, 1000, 3200, 2500, 3540][j], {
                align: j <= 2 ? AlignmentType.CENTER : AlignmentType.LEFT,
                shading: i % 2 === 1 ? COLORS.altRow : COLORS.white,
                size: 16,
              })
            ),
          })
        ),
      ],
    }),
    new Paragraph({ spacing: { after: 400 }, children: [] }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: '\uC7AC\uACE0 \uD750\uB984 (Process Flow):', font: 'Arial', size: 22, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({
        text: 'PO\uBC1C\uC8FC(PURCHASE_ORDERS) \u2192 \uC785\uD558(MAT_ARRIVALS + MAT_IN) \u2192 IQC\uAC80\uC0AC \u2192 \uB77C\uBCA8\uBC1C\uD589(MAT_LOTS \uC0DD\uC131) \u2192 \uC785\uACE0(MAT_RECEIVINGS + RECEIVE) \u2192 \uD604\uC7AC\uACE0\uBC18\uC601(MAT_STOCKS)',
        font: 'Arial', size: 18,
      })],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({
        text: '\uCDE8\uC18C \uCC98\uB9AC: \uC6D0\uBCF8 CANCELED + \uC5ED\uBD84\uAC1C(MAT_IN_CANCEL, \uC74C\uC218 \uC218\uB7C9) \u2192 \uD604\uC7AC\uACE0 \uAC10\uC18C + PO \uC0C1\uD0DC \uC7AC\uACC4\uC0B0',
        font: 'Arial', size: 18,
      })],
    }),
  );

  const bodySection = {
    properties: {
      page: {
        size: {
          width: 11906,
          height: 16838,
          orientation: 'landscape',
        },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'HARNESS MES - DB\uC124\uACC4\uC11C (\uC790\uC7AC\uC785\uACE0)', font: 'Arial', size: 16, color: '999999' })],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: '999999' }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' }),
            ],
          }),
        ],
      }),
    },
    children: bodyChildren,
  };

  return new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial', color: COLORS.primary },
          paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: '333333' },
          paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: '555555' },
          paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [coverSection, bodySection],
  });
}

// ── 실행 ──
async function main() {
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  const outPath = 'exports/material/DB설계서_자재입고_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}

main().catch(console.error);
