/**
 * @file generate-glossary-docx.js
 * @description HANES MES 용어집 GLOSSARY.md를 전문적인 Word 문서(.docx)로 변환하는 스크립트
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
  TableOfContents,
} = require("docx");

// ── 색상 팔레트 ──
const COLORS = {
  primary: "1B3A5C",      // 진한 남색 (제목, 헤더)
  secondary: "2E75B6",    // 파란색 (소제목)
  accent: "4472C4",       // 밝은 파란색
  headerBg: "1B3A5C",     // 테이블 헤더 배경
  headerText: "FFFFFF",   // 테이블 헤더 글자
  rowEvenBg: "F2F7FB",    // 짝수행 배경
  rowOddBg: "FFFFFF",     // 홀수행 배경
  borderColor: "B4C6E7",  // 테이블 테두리
  subtitleGray: "666666",
  lightGray: "E8E8E8",
};

// ── 테이블 테두리 ──
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderColor };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ── 페이지 설정 (A4 가로) ──
const PAGE_WIDTH = 16838;  // A4 landscape width (DXA)
const PAGE_HEIGHT = 11906; // A4 landscape height (DXA)
const MARGIN_LR = 1200;    // 좌우 마진
const MARGIN_TB = 1000;    // 상하 마진
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LR * 2; // 14438 DXA

// ── 컬럼 폭 (4열: 용어, 영문, 설명, 출처) ──
const COL_WIDTHS = [2200, 2600, 5638, 4000]; // 합계 = 14438

// ── 헬퍼 함수 ──
function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
    verticalAlign: "center",
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text, bold: true, font: "맑은 고딕", size: 18, color: COLORS.headerText })],
      }),
    ],
  });
}

function dataCell(text, width, isEven) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: isEven ? COLORS.rowEvenBg : COLORS.rowOddBg, type: ShadingType.CLEAR },
    verticalAlign: "center",
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: text || "", font: "맑은 고딕", size: 17 })],
      }),
    ],
  });
}

function createTable(rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell("용어", COL_WIDTHS[0]),
      headerCell("영문", COL_WIDTHS[1]),
      headerCell("설명", COL_WIDTHS[2]),
      headerCell("출처", COL_WIDTHS[3]),
    ],
  });

  const dataRows = rows.map((row, idx) =>
    new TableRow({
      children: row.map((cell, colIdx) => dataCell(cell, COL_WIDTHS[colIdx], idx % 2 === 0)),
    })
  );

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    rows: [headerRow, ...dataRows],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, font: "맑은 고딕", size: 28, bold: true, color: COLORS.primary })],
  });
}

function subHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 140 },
    children: [new TextRun({ text, font: "맑은 고딕", size: 24, bold: true, color: COLORS.secondary })],
  });
}

function spacer(size = 100) {
  return new Paragraph({ spacing: { before: size, after: 0 }, children: [] });
}

// ── 용어집 데이터 정의 ──
const sections = [
  {
    title: "기본 용어 (Common Terms)",
    subsections: [
      {
        rows: [
          ["회사", "Company", "시스템 내 사업체 구분 코드", "모든 엔티티의 company 필드"],
          ["공장", "Plant", "생산 공장 코드 (PLANT_CD)", "모든 엔티티의 plant 필드"],
          ["사용여부", "Use Y/N", "해당 데이터의 사용 여부 (Y: 사용, N: 미사용)", "useYn 필드 (기본값 'Y')"],
          ["생성자", "Created By", "데이터 생성자 ID", "createdBy 필드"],
          ["수정자", "Updated By", "데이터 최종 수정자 ID", "updatedBy 필드"],
          ["생성일시", "Created At", "데이터 생성 일시", "createdAt 필드"],
          ["수정일시", "Updated At", "데이터 최종 수정 일시", "updatedAt 필드"],
          ["삭제일시", "Deleted At", "소프트 삭제 일시 (NULL이면 미삭제)", "deletedAt 필드"],
        ],
      },
    ],
  },
  {
    title: "품목/자재 관리 (Part/Material Management)",
    subsections: [
      {
        subtitle: "품목 마스터 (Part Master)",
        rows: [
          ["품목코드", "Part Code", "품목의 고유 식별 코드 (고유값)", "PartMaster.partCode"],
          ["품목명", "Part Name", "품목의 명칭", "PartMaster.partName"],
          ["품목번호", "Part No", "품목 번호 (납품처/고객사 납품용)", "PartMaster.partNo"],
          ["고객품번", "Customer Part No", "고객사별 품목 번호", "PartMaster.custPartNo"],
          ["품목유형", "Part Type", "품목 분류 (원자재, 반제품, 완제품 등)", "PartMaster.partType"],
          ["제품유형", "Product Type", "제품별 유형 분류", "PartMaster.productType"],
          ["규격", "Specification", "품목 규격 사양", "PartMaster.spec"],
          ["리비전", "Revision", "도면/사양 변경 버전 (REV)", "PartMaster.rev"],
          ["단위", "Unit", "수량 단위 (기본값: EA)", "PartMaster.unit"],
          ["도면번호", "Drawing No", "도면 번호", "PartMaster.drawNo"],
          ["고객사", "Customer", "고객사 코드", "PartMaster.customer"],
          ["협력사/공급사", "Vendor", "공급업체 코드", "PartMaster.vendor"],
          ["리드타임", "Lead Time", "발주 후 입고까지 소요일수 (일)", "PartMaster.leadTime"],
          ["안전재고", "Safety Stock", "최소 유지해야 할 재고 수량", "PartMaster.safetyStock"],
          ["로트단위수량", "Lot Unit Qty", "1개 LOT의 기준 수량", "PartMaster.lotUnitQty"],
          ["박스수량", "Box Qty", "1박스 기준 포장 수량", "PartMaster.boxQty"],
          ["IQC 여부", "IQC Flag", "입하검사 필요 여부 (Y/N)", "PartMaster.iqcYn (기본값 'Y')"],
          ["택트타임", "Tact Time", "1개 제품 생산 소요시간 (초)", "PartMaster.tactTime"],
          ["유효기간", "Expiry Date", "자재 유효기간 (일)", "PartMaster.expiryDate"],
          ["오차허용률", "Tolerance Rate", "PO 수량 오차 허용률 (%)", "PartMaster.toleranceRate (기본값 5.0)"],
          ["분할가능여부", "Splittable", "자재 LOT 분할 가능 여부 (Y/N)", "PartMaster.isSplittable (기본값 'Y')"],
          ["샘플수량", "Sample Qty", "샘플검사 수량", "PartMaster.sampleQty"],
          ["포장단위", "Pack Unit", "포장 단위", "PartMaster.packUnit"],
          ["보관위치", "Storage Location", "창고 내 보관 위치", "PartMaster.storageLocation"],
        ],
      },
      {
        subtitle: "BOM (Bill of Materials)",
        rows: [
          ["모품목", "Parent Part", "상위 완제품/반제품 품목 ID", "BomMaster.parentPartId"],
          ["자품목", "Child Part", "하위 구성 자재 품목 ID", "BomMaster.childPartId"],
          ["소요량", "Qty Per", "1개 모품목당 필요 자품목 수량", "BomMaster.qtyPer"],
          ["순번", "Sequence", "BOM 구성 순서", "BomMaster.seq"],
          ["리비전", "Revision", "BOM 버전 (기본값: A)", "BomMaster.revision"],
          ["공정", "Operation/Process", "해당 자품목이 투입되는 공정", "BomMaster.processCode"],
          ["면", "Side", "SMT 기준 TOP/BOTTOM 면 구분", "BomMaster.side"],
          ["ECO 번호", "ECO No", "Engineering Change Order 번호", "BomMaster.ecoNo"],
          ["유효시작일", "Valid From", "BOM 적용 시작일", "BomMaster.validFrom"],
          ["유효종료일", "Valid To", "BOM 적용 종료일", "BomMaster.validTo"],
        ],
      },
    ],
  },
  {
    title: "생산 관리 (Production Management)",
    subsections: [
      {
        subtitle: "작업지시 (Job Order)",
        rows: [
          ["작업지시번호", "Order No", "작업지시 고유 번호 (고유값)", "JobOrder.orderNo"],
          ["상위작업지시", "Parent ID", "상위 수주/계획 작업지시 ID", "JobOrder.parentId"],
          ["품목ID", "Part ID", "생산 품목 ID", "JobOrder.partId"],
          ["라인코드", "Line Code", "생산라인 코드", "JobOrder.lineCode"],
          ["계획수량", "Plan Qty", "작업지시 계획 생산 수량", "JobOrder.planQty"],
          ["양품수량", "Good Qty", "생산된 양품 수량", "JobOrder.goodQty"],
          ["불량수량", "Defect Qty", "발생 불량 수량", "JobOrder.defectQty"],
          ["계획일자", "Plan Date", "작업 계획 일자", "JobOrder.planDate"],
          ["우선순위", "Priority", "작업 우선순위 (1~10, 기본값 5)", "JobOrder.priority"],
          ["상태", "Status", "작업지시 상태 (WAITING, RUNNING, COMPLETED, CANCELLED)", "JobOrder.status"],
          ["ERP 동기화", "ERP Sync", "ERP 시스템 동기화 여부 (Y/N)", "JobOrder.erpSyncYn"],
        ],
      },
      {
        subtitle: "생산실적 (Production Result)",
        rows: [
          ["작업지시ID", "Job Order ID", "연결된 작업지시 ID", "ProdResult.jobOrderId"],
          ["설비ID", "Equipment ID", "생산에 사용된 설비 ID", "ProdResult.equipId"],
          ["작업자ID", "Worker ID", "생산 작업자 ID", "ProdResult.workerId"],
          ["LOT 번호", "Lot No", "생산 LOT 번호", "ProdResult.lotNo"],
          ["공정코드", "Process Code", "생산 공정 코드", "ProdResult.processCode"],
          ["양품수량", "Good Qty", "해당 실적의 양품 수량", "ProdResult.goodQty"],
          ["불량수량", "Defect Qty", "해당 실적의 불량 수량", "ProdResult.defectQty"],
          ["시작시간", "Start At", "생산 시작 일시", "ProdResult.startAt"],
          ["종료시간", "End At", "생산 종료 일시", "ProdResult.endAt"],
          ["사이클타임", "Cycle Time", "1개당 생산 소요시간 (초)", "ProdResult.cycleTime"],
          ["상태", "Status", "실적 상태 (RUNNING, PAUSED, COMPLETED, CANCELLED)", "ProdResult.status"],
        ],
      },
    ],
  },
  {
    title: "품질 관리 (Quality Management)",
    subsections: [
      {
        subtitle: "검사실적 (Inspection Result)",
        rows: [
          ["생산실적ID", "Production Result ID", "연결된 생산실적 ID", "InspectResult.prodResultId"],
          ["시리얼번호", "Serial No", "개별 제품 시리얼 번호", "InspectResult.serialNo"],
          ["검사유형", "Inspect Type", "검사 유형 (CONTINUITY, VISUAL, DIMENSION, FUNCTION)", "InspectResult.inspectType"],
          ["검사범위", "Inspect Scope", "전수/샘플링 구분 (FULL: 전수검사, SAMPLE: 샘플링검사)", "InspectResult.inspectScope"],
          ["합격여부", "Pass Y/N", "검사 합격 여부 (Y: 합격, N: 불합격)", "InspectResult.passYn"],
          ["에러코드", "Error Code", "불합격 시 오류 코드", "InspectResult.errorCode"],
          ["에러상세", "Error Detail", "불합격 상세 사유", "InspectResult.errorDetail"],
          ["검사데이터", "Inspect Data", "검사 측정 데이터 (JSON)", "InspectResult.inspectData"],
          ["검사일시", "Inspect At", "검사 수행 일시", "InspectResult.inspectAt"],
          ["검사자ID", "Inspector ID", "검사 수행자 ID", "InspectResult.inspectorId"],
        ],
      },
      {
        subtitle: "불량로그 (Defect Log)",
        rows: [
          ["생산실적ID", "Production Result ID", "불량 발생 생산실적 ID", "DefectLog.prodResultId"],
          ["불량코드", "Defect Code", "불량 유형 코드", "DefectLog.defectCode"],
          ["불량명", "Defect Name", "불량 유형 명칭", "DefectLog.defectName"],
          ["수량", "Quantity", "불량 발생 수량", "DefectLog.qty"],
          ["상태", "Status", "불량 처리 상태 (WAIT: 대기, REPAIR: 수리중, SCRAP: 폐기, PASS: 합격)", "DefectLog.status"],
          ["발생시간", "Occur At", "불량 발생 일시", "DefectLog.occurAt"],
          ["이미지URL", "Image URL", "불량 사진 첨부 URL", "DefectLog.imageUrl"],
        ],
      },
      {
        subtitle: "수리이력 (Repair Log)",
        rows: [
          ["불량로그ID", "Defect Log ID", "연결된 불량로그 ID", "RepairLog.defectLogId"],
          ["작업자ID", "Worker ID", "수리 작업자 ID", "RepairLog.workerId"],
          ["수리조치", "Repair Action", "수리 내용", "RepairLog.repairAction"],
          ["사용자재", "Material Used", "수리 시 사용된 자재", "RepairLog.materialUsed"],
          ["수리시간", "Repair Time", "수리 소요시간 (분)", "RepairLog.repairTime"],
          ["결과", "Result", "수리 결과 (PASS: 성공, FAIL: 실패)", "RepairLog.result"],
        ],
      },
      {
        subtitle: "IQC (Incoming Quality Control)",
        rows: [
          ["LOT ID", "Lot ID", "검사 대상 자재 LOT ID", "IqcLog.lotId"],
          ["LOT 번호", "Lot No", "자재 LOT 번호", "IqcLog.lotNo"],
          ["검사유형", "Inspect Type", "IQC 검사 유형 (INITIAL: 초물, REGULAR: 정기)", "IqcLog.inspectType"],
          ["결과", "Result", "검사 결과 (PASS: 합격, FAIL: 불합격)", "IqcLog.result"],
          ["검사일자", "Inspect Date", "IQC 검사 일자", "IqcLog.inspectDate"],
          ["검사자명", "Inspector Name", "검사자 이름", "IqcLog.inspectorName"],
          ["IQC 상태", "IQC Status", "LOT별 IQC 진행 상태 (PENDING, PASS, FAIL, HOLD)", "MatLot.iqcStatus"],
        ],
      },
      {
        subtitle: "OQC (Outgoing Quality Control)",
        rows: [
          ["의뢰번호", "Request No", "OQC 의뢰 고유 번호", "OqcRequest.requestNo"],
          ["고객사", "Customer", "출하 고객사", "OqcRequest.customer"],
          ["의뢰일자", "Request Date", "OQC 의뢰 일자", "OqcRequest.requestDate"],
          ["총박스수", "Total Box Count", "검사 대상 총 박스 수", "OqcRequest.totalBoxCount"],
          ["총수량", "Total Qty", "검사 대상 총 수량", "OqcRequest.totalQty"],
          ["샘플크기", "Sample Size", "샘플링 검사 시 샘플 수량", "OqcRequest.sampleSize"],
          ["상태", "Status", "OQC 진행 상태 (PENDING, IN_PROGRESS, PASS, FAIL)", "OqcRequest.status"],
          ["결과", "Result", "최종 검사 결과 (PASS, FAIL)", "OqcRequest.result"],
          ["검사일시", "Inspect Date", "OQC 검사 완료 일시", "OqcRequest.inspectDate"],
        ],
      },
    ],
  },
  {
    title: "자재 창고 관리 (Inventory/Warehouse)",
    subsections: [
      {
        subtitle: "자재 LOT (Material Lot)",
        rows: [
          ["LOT 번호", "Lot No", "자재 LOT 고유 번호 (고유값)", "MatLot.lotNo"],
          ["품목ID", "Part ID", "LOT의 품목 ID", "MatLot.partId"],
          ["초기수량", "Init Qty", "LOT 입고 시 최초 수량", "MatLot.initQty"],
          ["현재수량", "Current Qty", "LOT의 현재 가용 수량", "MatLot.currentQty"],
          ["입고일자", "Receive Date", "LOT 입고 일자", "MatLot.recvDate"],
          ["제조일자", "Manufacture Date", "자재 제조 일자", "MatLot.manufactureDate"],
          ["만료일자", "Expire Date", "자재 만료(유효기간) 일자", "MatLot.expireDate"],
          ["원산지", "Origin", "자재 원산지", "MatLot.origin"],
          ["공급사", "Vendor", "자재 공급 업체", "MatLot.vendor"],
          ["Invoice 번호", "Invoice No", "공급사 인보이스 번호", "MatLot.invoiceNo"],
          ["PO 번호", "PO No", "연결된 구매오더 번호", "MatLot.poNo"],
          ["상태", "Status", "LOT 상태 (NORMAL, HOLD, SCRAP)", "MatLot.status"],
        ],
      },
      {
        subtitle: "입고 (Receiving)",
        rows: [
          ["입고번호", "Receive No", "입고 건 고유 번호", "MatReceiving.receiveNo"],
          ["LOT ID", "Lot ID", "입고 대상 LOT ID", "MatReceiving.lotId"],
          ["품목ID", "Part ID", "입고 품목 ID", "MatReceiving.partId"],
          ["수량", "Quantity", "입고 수량", "MatReceiving.qty"],
          ["창고코드", "Warehouse Code", "입고 창고 코드", "MatReceiving.warehouseCode"],
          ["입고일자", "Receive Date", "입고 일시", "MatReceiving.receiveDate"],
          ["작업자ID", "Worker ID", "입고 작업자 ID", "MatReceiving.workerId"],
        ],
      },
      {
        subtitle: "출고/투입 (Material Issue)",
        rows: [
          ["출고번호", "Issue No", "출고 건 고유 번호", "MatIssue.issueNo"],
          ["작업지시ID", "Job Order ID", "자재 투입 대상 작업지시 ID", "MatIssue.jobOrderId"],
          ["생산실적ID", "Production Result ID", "자재 투입된 생산실적 ID", "MatIssue.prodResultId"],
          ["LOT ID", "Lot ID", "출고 대상 LOT ID", "MatIssue.lotId"],
          ["출고수량", "Issue Qty", "출고/투입 수량", "MatIssue.issueQty"],
          ["출고일자", "Issue Date", "출고 일시", "MatIssue.issueDate"],
          ["출고유형", "Issue Type", "출고 유형 (PROD: 생산투입, SCRAP: 폐기, RETURN: 반품)", "MatIssue.issueType"],
        ],
      },
      {
        subtitle: "창고/재고 (Warehouse/Stock)",
        rows: [
          ["창고코드", "Warehouse Code", "창고 고유 코드 (고유값)", "Warehouse.warehouseCode"],
          ["창고명", "Warehouse Name", "창고 명칭", "Warehouse.warehouseName"],
          ["창고유형", "Warehouse Type", "창고 유형 (RAW: 원자재, FG: 완제품 등)", "Warehouse.warehouseType"],
          ["공장코드", "Plant Code", "창고 소속 공장 코드", "Warehouse.plantCode"],
          ["라인코드", "Line Code", "창고 연결 생산라인", "Warehouse.lineCode"],
          ["기본창고", "Default", "해당 유형의 기본 창고 여부 (Y/N)", "Warehouse.isDefault"],
          ["위치코드", "Location Code", "창고 내 상세 위치 코드", "MatStock.locationCode"],
          ["재고수량", "Qty", "현재 재고 수량", "MatStock.qty"],
          ["예약수량", "Reserved Qty", "출고 예약된 수량", "MatStock.reservedQty"],
          ["가용수량", "Available Qty", "출고 가능 수량 (재고 - 예약)", "MatStock.availableQty"],
        ],
      },
    ],
  },
  {
    title: "설비 관리 (Equipment Management)",
    subsections: [
      {
        subtitle: "설비 마스터 (Equipment Master)",
        rows: [
          ["설비코드", "Equipment Code", "설비 고유 코드 (고유값)", "EquipMaster.equipCode"],
          ["설비명", "Equipment Name", "설비 명칭", "EquipMaster.equipName"],
          ["설비유형", "Equipment Type", "설비 분류", "EquipMaster.equipType"],
          ["모델명", "Model Name", "설비 모델명", "EquipMaster.modelName"],
          ["제조사", "Maker", "설비 제조사", "EquipMaster.maker"],
          ["라인코드", "Line Code", "설비가 설치된 라인", "EquipMaster.lineCode"],
          ["공정코드", "Process Code", "설비가 속한 공정", "EquipMaster.processCode"],
          ["IP 주소", "IP Address", "설비 통신용 IP 주소", "EquipMaster.ipAddress"],
          ["포트", "Port", "설비 통신용 포트 번호", "EquipMaster.port"],
          ["통신유형", "Comm Type", "통신 프로토콜 유형", "EquipMaster.commType"],
          ["통신설정", "Comm Config", "JSON 형식 통신 설정", "EquipMaster.commConfig"],
          ["설치일자", "Install Date", "설비 설치 일자", "EquipMaster.installDate"],
          ["상태", "Status", "설비 상태 (NORMAL, ERROR, MAINTENANCE)", "EquipMaster.status"],
          ["현재작업지시", "Current Job Order ID", "설비에서 현재 진행 중인 작업지시 ID", "EquipMaster.currentJobOrderId"],
        ],
      },
      {
        subtitle: "설비 BOM (Equipment BOM)",
        rows: [
          ["설비ID", "Equipment ID", "연결된 설비 ID", "EquipBomRel.equipId"],
          ["부품ID", "Part ID", "교체용 부품 품목 ID", "EquipBomItem.partId"],
          ["교체주기", "Replace Cycle", "부품 교체 주기", "EquipBomItem.replaceCycle"],
          ["주기단위", "Cycle Unit", "교체 주기 단위 (HOUR, DAY, MONTH)", "EquipBomItem.cycleUnit"],
          ["설비부품관계", "Equip-Part Relation", "설비와 생산품목의 BOM 관계", "EquipBomRel"],
        ],
      },
      {
        subtitle: "PM (Preventive Maintenance)",
        rows: [
          ["PM 계획코드", "Plan Code", "PM 계획 고유 코드", "PmPlan.planCode"],
          ["PM 계획명", "Plan Name", "PM 계획 명칭", "PmPlan.planName"],
          ["PM 유형", "PM Type", "보전 유형 (TIME_BASED: 시간기반, USAGE_BASED: 사용량기반)", "PmPlan.pmType"],
          ["주기유형", "Cycle Type", "보전 주기 유형 (DAILY, WEEKLY, MONTHLY, YEARLY)", "PmPlan.cycleType"],
          ["주기값", "Cycle Value", "보전 주기 값", "PmPlan.cycleValue"],
          ["주기단위", "Cycle Unit", "주기 단위", "PmPlan.cycleUnit"],
          ["시즌월", "Season Month", "특정 월에 실행 (1~12, NULL이면 해당없음)", "PmPlan.seasonMonth"],
          ["예상소요시간", "Estimated Time", "PM 예상 소요시간 (시간)", "PmPlan.estimatedTime"],
          ["최종실행일", "Last Executed At", "마지막 PM 실행 일시", "PmPlan.lastExecutedAt"],
          ["다음예정일", "Next Due At", "다음 PM 예정 일시", "PmPlan.nextDueAt"],
        ],
      },
    ],
  },
  {
    title: "출하/납품 관리 (Shipping/Delivery)",
    subsections: [
      {
        subtitle: "고객주문 (Customer Order)",
        rows: [
          ["주문번호", "Order No", "고객주문 고유 번호 (고유값)", "CustomerOrder.orderNo"],
          ["고객ID", "Customer ID", "주문 고객사 ID", "CustomerOrder.customerId"],
          ["고객명", "Customer Name", "주문 고객사 명칭", "CustomerOrder.customerName"],
          ["주문일자", "Order Date", "주문 접수 일자", "CustomerOrder.orderDate"],
          ["납기일자", "Due Date", "납품 예정 일자", "CustomerOrder.dueDate"],
          ["주문상태", "Status", "주문 상태 (RECEIVED, CONFIRMED, SHIPPED, CANCELLED)", "CustomerOrder.status"],
          ["총금액", "Total Amount", "주문 총 금액", "CustomerOrder.totalAmount"],
          ["통화", "Currency", "통화 단위 (KRW, USD 등)", "CustomerOrder.currency"],
        ],
      },
      {
        subtitle: "출하지시 (Shipment Order)",
        rows: [
          ["출하지시번호", "Ship Order No", "출하지시 고유 번호 (고유값)", "ShipmentOrder.shipOrderNo"],
          ["출하일자", "Ship Date", "실제 출하 일자", "ShipmentOrder.shipDate"],
          ["상태", "Status", "출하지시 상태 (DRAFT, READY, SHIPPED, CANCELLED)", "ShipmentOrder.status"],
        ],
      },
      {
        subtitle: "박스/파렛트 (Box/Pallet)",
        rows: [
          ["박스번호", "Box No", "박스 고유 번호 (고유값)", "BoxMaster.boxNo"],
          ["품목ID", "Part ID", "박스에 담긴 품목 ID", "BoxMaster.partId"],
          ["수량", "Quantity", "박스 내 제품 수량", "BoxMaster.qty"],
          ["시리얼목록", "Serial List", "박스 내 제품 시리얼 번호 목록 (JSON)", "BoxMaster.serialList"],
          ["파렛트ID", "Pallet ID", "상위 파렛트 ID", "BoxMaster.palletId"],
          ["박스상태", "Status", "박스 상태 (OPEN: 포장중, CLOSED: 포장완료, SHIPPED: 출하완료)", "BoxMaster.status"],
          ["OQC 상태", "OQC Status", "출하검사 상태", "BoxMaster.oqcStatus"],
          ["마감시간", "Close At", "박스 포장 완료 일시", "BoxMaster.closeAt"],
          ["파렛트번호", "Pallet No", "파렛트 고유 번호 (고유값)", "PalletMaster.palletNo"],
          ["박스수", "Box Count", "파렛트 내 박스 수", "PalletMaster.boxCount"],
          ["총수량", "Total Qty", "파렛트 내 총 제품 수량", "PalletMaster.totalQty"],
          ["출하ID", "Shipment ID", "연결된 출하 ID", "PalletMaster.shipmentId"],
        ],
      },
    ],
  },
  {
    title: "외주/협력사 관리 (Outsourcing)",
    subsections: [
      {
        subtitle: "구매오더 (Purchase Order)",
        rows: [
          ["PO 번호", "PO No", "구매오더 고유 번호 (고유값)", "PurchaseOrder.poNo"],
          ["협력사ID", "Partner ID", "공급사/협력사 ID", "PurchaseOrder.partnerId"],
          ["협력사명", "Partner Name", "공급사/협력사 명칭", "PurchaseOrder.partnerName"],
          ["발주일자", "Order Date", "PO 발행 일자", "PurchaseOrder.orderDate"],
          ["납기일자", "Due Date", "납품 예정 일자", "PurchaseOrder.dueDate"],
          ["PO 상태", "Status", "PO 상태 (DRAFT, CONFIRMED, RECEIVING, COMPLETED, CANCELLED)", "PurchaseOrder.status"],
          ["총금액", "Total Amount", "PO 총 금액", "PurchaseOrder.totalAmount"],
        ],
      },
      {
        subtitle: "협력사/거래처 (Partner/Vendor)",
        rows: [
          ["거래처코드", "Partner Code", "거래처 고유 코드", "PartnerMaster.partnerCode"],
          ["거래처명", "Partner Name", "거래처 명칭", "PartnerMaster.partnerName"],
          ["거래처유형", "Partner Type", "거래처 유형 (VENDOR: 공급사, CUSTOMER: 고객사, SUBCON: 외주사)", "PartnerMaster.partnerType"],
          ["사업자번호", "Business No", "사업자등록번호", "PartnerMaster.businessNo"],
          ["대표자", "CEO", "대표자명", "PartnerMaster.ceo"],
          ["담당자", "Contact Person", "담당자명", "PartnerMaster.contactPerson"],
          ["연락처", "Phone", "연락처", "PartnerMaster.phone"],
          ["이메일", "Email", "이메일 주소", "PartnerMaster.email"],
          ["주소", "Address", "주소", "PartnerMaster.address"],
        ],
      },
    ],
  },
  {
    title: "공정/라인 관리 (Process/Line)",
    subsections: [
      {
        subtitle: "공정 마스터 (Process Master)",
        rows: [
          ["공정코드", "Process Code", "공정 고유 코드 (고유값)", "ProcessMaster.processCode"],
          ["공정명", "Process Name", "공정 명칭", "ProcessMaster.processName"],
          ["공정유형", "Process Type", "공정 유형", "ProcessMaster.processType"],
          ["공정분류", "Process Category", "공정 분류", "ProcessMaster.processCategory"],
          ["샘플검사여부", "Sample Inspect Y/N", "공정별 샘플검사 필요 여부", "ProcessMaster.sampleInspectYn"],
          ["정렬순서", "Sort Order", "공정 표시 순서", "ProcessMaster.sortOrder"],
        ],
      },
      {
        subtitle: "생산라인 (Production Line)",
        rows: [
          ["라인코드", "Line Code", "생산라인 고유 코드", "ProdLineMaster.lineCode"],
          ["라인명", "Line Name", "생산라인 명칭", "ProdLineMaster.lineName"],
          ["공장코드", "Plant Code", "라인 소속 공장", "ProdLineMaster.plantCode"],
          ["공정코드", "Process Code", "라인의 주 공정", "ProdLineMaster.processCode"],
          ["담당자", "Manager", "라인 담당자", "ProdLineMaster.manager"],
          ["가용시작시간", "Available From", "라인 가용 시작 시간", "ProdLineMaster.availableFrom"],
          ["가용종료시간", "Available To", "라인 가용 종료 시간", "ProdLineMaster.availableTo"],
        ],
      },
    ],
  },
  {
    title: "추적/이력 (Traceability)",
    subsections: [
      {
        subtitle: "추적로그 (Trace Log)",
        rows: [
          ["추적시간", "Trace Time", "이력 발생 일시", "TraceLog.traceTime"],
          ["파렛트ID", "Pallet ID", "연결된 파렛트 ID", "TraceLog.palletId"],
          ["박스ID", "Box ID", "연결된 박스 ID", "TraceLog.boxId"],
          ["LOT ID", "Lot ID", "연결된 LOT ID", "TraceLog.lotId"],
          ["자재LOT ID", "Material Lot ID", "연결된 자재 LOT ID", "TraceLog.matLotId"],
          ["설비ID", "Equipment ID", "사용된 설비 ID", "TraceLog.equipId"],
          ["작업자ID", "Worker ID", "작업자 ID", "TraceLog.workerId"],
          ["공정코드", "Process Code", "발생 공정 코드", "TraceLog.processCode"],
          ["시리얼번호", "Serial No", "제품 시리얼 번호", "TraceLog.serialNo"],
          ["이벤트유형", "Event Type", "이벤트 유형", "TraceLog.eventType"],
          ["이벤트데이터", "Event Data", "이벤트 상세 데이터 (JSON)", "TraceLog.eventData"],
          ["부모ID", "Parent ID", "상위(반제품) 시리얼 ID", "TraceLog.parentId"],
        ],
      },
    ],
  },
  {
    title: "작업자 관리 (Worker Management)",
    subsections: [
      {
        rows: [
          ["작업자코드", "Worker Code", "작업자 고유 코드 (고유값)", "WorkerMaster.workerCode"],
          ["작업자명", "Worker Name", "작업자 이름", "WorkerMaster.workerName"],
          ["영문명", "English Name", "작업자 영문 이름", "WorkerMaster.engName"],
          ["부서", "Department", "소속 부서", "WorkerMaster.dept"],
          ["직책", "Position", "직책/직급", "WorkerMaster.position"],
          ["전화번호", "Phone", "연락처", "WorkerMaster.phone"],
          ["이메일", "Email", "이메일 주소", "WorkerMaster.email"],
          ["입사일", "Hire Date", "입사 일자", "WorkerMaster.hireDate"],
          ["퇴사일", "Quit Date", "퇴사 일자", "WorkerMaster.quitDate"],
          ["QR코드", "QR Code", "작업자 식별용 QR 코드", "WorkerMaster.qrCode"],
          ["사진URL", "Photo URL", "작업자 사진 URL", "WorkerMaster.photoUrl"],
          ["가능공정", "Process IDs", "작업 가능 공정 목록 (JSON)", "WorkerMaster.processIds"],
        ],
      },
    ],
  },
  {
    title: "시스템/공통 코드 (System/Common Code)",
    subsections: [
      {
        subtitle: "공통코드 (Common Code)",
        rows: [
          ["그룹코드", "Group Code", "공통코드 분류 그룹", "ComCode.groupCode"],
          ["코드", "Code", "공통코드 값", "ComCode.code"],
          ["코드명", "Code Name", "공통코드 명칭", "ComCode.codeName"],
          ["코드영문명", "Code Name EN", "공통코드 영문 명칭", "ComCode.codeNameEn"],
          ["정렬순서", "Sort Order", "코드 표시 순서", "ComCode.sortOrder"],
          ["속성1~5", "Attribute 1~5", "코드별 추가 속성값", "ComCode.attr1 ~ attr5"],
        ],
      },
      {
        subtitle: "시스템 설정 (System Config)",
        rows: [
          ["설정코드", "Config Code", "시스템 설정 항목 코드", "SysConfig.configCode"],
          ["설정값", "Config Value", "설정 값", "SysConfig.configValue"],
          ["설정유형", "Config Type", "설정값 유형 (STRING, NUMBER, BOOLEAN, JSON)", "SysConfig.configType"],
          ["설명", "Description", "설정 항목 설명", "SysConfig.description"],
        ],
      },
    ],
  },
];

// ── 총 용어 수 카운트 ──
let totalTerms = 0;
sections.forEach((s) => s.subsections.forEach((sub) => (totalTerms += sub.rows.length)));

// ── 문서 생성 ──
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "맑은 고딕", size: 20 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "맑은 고딕", color: COLORS.primary },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "맑은 고딕", color: COLORS.secondary },
        paragraph: { spacing: { before: 240, after: 140 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "toc-bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u25CF", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [
    // ── 표지 페이지 ──
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: MARGIN_TB, right: MARGIN_LR, bottom: MARGIN_TB, left: MARGIN_LR },
        },
      },
      children: [
        spacer(3000),
        // 상단 구분선
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [CONTENT_WIDTH],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: {
                    top: noBorder, left: noBorder, right: noBorder,
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary },
                  },
                  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                  children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
                }),
              ],
            }),
          ],
        }),
        spacer(300),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 100 },
          children: [new TextRun({ text: "HANES MES", font: "맑은 고딕", size: 56, bold: true, color: COLORS.primary })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "Manufacturing Execution System", font: "맑은 고딕", size: 26, color: COLORS.subtitleGray })],
        }),
        spacer(200),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: "용 어 집", font: "맑은 고딕", size: 48, bold: true, color: COLORS.primary })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 0 },
          children: [new TextRun({ text: "GLOSSARY", font: "맑은 고딕", size: 32, color: COLORS.secondary })],
        }),
        spacer(300),
        // 하단 구분선
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [CONTENT_WIDTH],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: {
                    bottom: noBorder, left: noBorder, right: noBorder,
                    top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary },
                  },
                  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                  children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
                }),
              ],
            }),
          ],
        }),
        spacer(400),
        // 정보 테이블
        new Table({
          width: { size: 6000, type: WidthType.DXA },
          columnWidths: [2000, 4000],
          rows: [
            ["문서번호", "HANES-DOC-GLOSSARY-001"],
            ["버전", "1.0"],
            ["작성일", "2026-02-24"],
            ["총 용어 수", `${totalTerms}개`],
          ].map(([label, value]) =>
            new TableRow({
              children: [
                new TableCell({
                  borders: noBorders,
                  width: { size: 2000, type: WidthType.DXA },
                  margins: { top: 40, bottom: 40, left: 80, right: 80 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [new TextRun({ text: label, font: "맑은 고딕", size: 20, bold: true, color: COLORS.subtitleGray })],
                    }),
                  ],
                }),
                new TableCell({
                  borders: noBorders,
                  width: { size: 4000, type: WidthType.DXA },
                  margins: { top: 40, bottom: 40, left: 120, right: 80 },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: value, font: "맑은 고딕", size: 20, color: COLORS.primary })],
                    }),
                  ],
                }),
              ],
            })
          ),
        }),
      ],
    },
    // ── 목차 + 본문 ──
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: MARGIN_TB, right: MARGIN_LR, bottom: MARGIN_TB, left: MARGIN_LR },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({ text: "HANES MES 용어집", font: "맑은 고딕", size: 16, color: COLORS.subtitleGray, italics: true }),
              ],
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
                new TextRun({ text: "- ", font: "맑은 고딕", size: 16, color: COLORS.subtitleGray }),
                new TextRun({ children: [PageNumber.CURRENT], font: "맑은 고딕", size: 16, color: COLORS.subtitleGray }),
                new TextRun({ text: " -", font: "맑은 고딕", size: 16, color: COLORS.subtitleGray }),
              ],
            }),
          ],
        }),
      },
      children: [
        // 목차
        new Paragraph({
          spacing: { before: 0, after: 300 },
          children: [new TextRun({ text: "목차 (Table of Contents)", font: "맑은 고딕", size: 28, bold: true, color: COLORS.primary })],
        }),
        new TableOfContents("목차", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({ children: [new PageBreak()] }),

        // 본문 섹션들
        ...sections.flatMap((section, sIdx) => {
          const children = [];
          if (sIdx > 0) {
            children.push(new Paragraph({ children: [new PageBreak()] }));
          }
          children.push(sectionHeading(section.title));

          section.subsections.forEach((sub) => {
            if (sub.subtitle) {
              children.push(subHeading(sub.subtitle));
            }
            children.push(createTable(sub.rows));
            children.push(spacer(200));
          });

          return children;
        }),

        // ── 문서 이력 ──
        new Paragraph({ children: [new PageBreak()] }),
        sectionHeading("문서 이력"),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [2400, 3000, 9038],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell("일자", 2400),
                headerCell("작성자", 3000),
                headerCell("내용", 9038),
              ],
            }),
            new TableRow({
              children: [
                dataCell("2025-02-24", 2400, true),
                dataCell("-", 3000, true),
                dataCell("HANES MES 프로젝트 코드 기반 초안 작성", 9038, true),
              ],
            }),
            new TableRow({
              children: [
                dataCell("2026-02-24", 2400, false),
                dataCell("-", 3000, false),
                dataCell("Word 문서(.docx) 형식으로 변환", 9038, false),
              ],
            }),
          ],
        }),
        spacer(400),
        new Paragraph({
          spacing: { before: 200, after: 0 },
          children: [
            new TextRun({
              text: "본 용어집은 apps/backend/src/entities/*.entity.ts 파일들의 필드 정의를 기반으로 작성되었습니다.",
              font: "맑은 고딕", size: 18, italics: true, color: COLORS.subtitleGray,
            }),
          ],
        }),
      ],
    },
  ],
});

// ── 파일 저장 ──
const outputPath = path.resolve(__dirname, "../docs/HANES_MES_GLOSSARY.docx");
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${outputPath}`);
  console.log(`Total terms: ${totalTerms}`);
});
