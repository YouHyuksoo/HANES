/**
 * @file generate-glossary-docx.js
 * @description HANES MES glossary.md를 전문적인 Word 문서(.docx)로 변환하는 스크립트
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
  TableOfContents,
} = require("docx");

// ?? ?됱긽 ?붾젅????
const COLORS = {
  primary: "1B3A5C",      // 吏꾪븳 ?⑥깋 (?쒕ぉ, ?ㅻ뜑)
  secondary: "2E75B6",    // ?뚮???(?뚯젣紐?
  accent: "4472C4",       // 諛앹? ?뚮???
  headerBg: "1B3A5C",     // ?뚯씠釉??ㅻ뜑 諛곌꼍
  headerText: "FFFFFF",   // ?뚯씠釉??ㅻ뜑 湲??
  rowEvenBg: "F2F7FB",    // 吏앹닔??諛곌꼍
  rowOddBg: "FFFFFF",     // ??섑뻾 諛곌꼍
  borderColor: "B4C6E7",  // ?뚯씠釉??뚮몢由?
  subtitleGray: "666666",
  lightGray: "E8E8E8",
};

// ?? ?뚯씠釉??뚮몢由???
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderColor };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ?? ?섏씠吏 ?ㅼ젙 (A4 媛濡? ??
const PAGE_WIDTH = 16838;  // A4 landscape width (DXA)
const PAGE_HEIGHT = 11906; // A4 landscape height (DXA)
const MARGIN_LR = 1200;    // 醫뚯슦 留덉쭊
const MARGIN_TB = 1000;    // ?곹븯 留덉쭊
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LR * 2; // 14438 DXA

// ?? 而щ읆 ??(4?? ?⑹뼱, ?곷Ц, ?ㅻ챸, 異쒖쿂) ??
const COL_WIDTHS = [2200, 2600, 5638, 4000]; // ?⑷퀎 = 14438

// ?? ?ы띁 ?⑥닔 ??
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
        children: [new TextRun({ text, bold: true, font: "留묒? 怨좊뵓", size: 18, color: COLORS.headerText })],
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
        children: [new TextRun({ text: text || "", font: "留묒? 怨좊뵓", size: 17 })],
      }),
    ],
  });
}

function createTable(rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell("?⑹뼱", COL_WIDTHS[0]),
      headerCell("?곷Ц", COL_WIDTHS[1]),
      headerCell("?ㅻ챸", COL_WIDTHS[2]),
      headerCell("異쒖쿂", COL_WIDTHS[3]),
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
    children: [new TextRun({ text, font: "留묒? 怨좊뵓", size: 28, bold: true, color: COLORS.primary })],
  });
}

function subHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 140 },
    children: [new TextRun({ text, font: "留묒? 怨좊뵓", size: 24, bold: true, color: COLORS.secondary })],
  });
}

function spacer(size = 100) {
  return new Paragraph({ spacing: { before: size, after: 0 }, children: [] });
}

// ?? ?⑹뼱吏??곗씠???뺤쓽 ??
const sections = [
  {
    title: "湲곕낯 ?⑹뼱 (Common Terms)",
    subsections: [
      {
        rows: [
          ["?뚯궗", "Company", "?쒖뒪?????ъ뾽泥?援щ텇 肄붾뱶", "紐⑤뱺 ?뷀떚?곗쓽 company ?꾨뱶"],
          ["怨듭옣", "Plant", "?앹궛 怨듭옣 肄붾뱶 (PLANT_CD)", "紐⑤뱺 ?뷀떚?곗쓽 plant ?꾨뱶"],
          ["?ъ슜?щ?", "Use Y/N", "?대떦 ?곗씠?곗쓽 ?ъ슜 ?щ? (Y: ?ъ슜, N: 誘몄궗??", "useYn ?꾨뱶 (湲곕낯媛?'Y')"],
          ["?앹꽦??, "Created By", "?곗씠???앹꽦??ID", "createdBy ?꾨뱶"],
          ["?섏젙??, "Updated By", "?곗씠??理쒖쥌 ?섏젙??ID", "updatedBy ?꾨뱶"],
          ["?앹꽦?쇱떆", "Created At", "?곗씠???앹꽦 ?쇱떆", "createdAt ?꾨뱶"],
          ["?섏젙?쇱떆", "Updated At", "?곗씠??理쒖쥌 ?섏젙 ?쇱떆", "updatedAt ?꾨뱶"],
          ["??젣?쇱떆", "Deleted At", "?뚰봽????젣 ?쇱떆 (NULL?대㈃ 誘몄궘??", "deletedAt ?꾨뱶"],
        ],
      },
    ],
  },
  {
    title: "?덈ぉ/?먯옱 愿由?(Part/Material Management)",
    subsections: [
      {
        subtitle: "?덈ぉ 留덉뒪??(Part Master)",
        rows: [
          ["?덈ぉ肄붾뱶", "Part Code", "?덈ぉ??怨좎쑀 ?앸퀎 肄붾뱶 (怨좎쑀媛?", "PartMaster.partCode"],
          ["?덈ぉ紐?, "Part Name", "?덈ぉ??紐낆묶", "PartMaster.partName"],
          ["?덈ぉ踰덊샇", "Part No", "?덈ぉ 踰덊샇 (?⑺뭹泥?怨좉컼???⑺뭹??", "PartMaster.partNo"],
          ["怨좉컼?덈쾲", "Customer Part No", "怨좉컼?щ퀎 ?덈ぉ 踰덊샇", "PartMaster.custPartNo"],
          ["?덈ぉ?좏삎", "Part Type", "?덈ぉ 遺꾨쪟 (?먯옄?? 諛섏젣?? ?꾩젣????", "PartMaster.partType"],
          ["?쒗뭹?좏삎", "Product Type", "?쒗뭹蹂??좏삎 遺꾨쪟", "PartMaster.productType"],
          ["洹쒓꺽", "Specification", "?덈ぉ 洹쒓꺽 ?ъ뼇", "PartMaster.spec"],
          ["由щ퉬??, "Revision", "?꾨㈃/?ъ뼇 蹂寃?踰꾩쟾 (REV)", "PartMaster.rev"],
          ["?⑥쐞", "Unit", "?섎웾 ?⑥쐞 (湲곕낯媛? EA)", "PartMaster.unit"],
          ["?꾨㈃踰덊샇", "Drawing No", "?꾨㈃ 踰덊샇", "PartMaster.drawNo"],
          ["怨좉컼??, "Customer", "怨좉컼??肄붾뱶", "PartMaster.customer"],
          ["?묐젰??怨듦툒??, "Vendor", "怨듦툒?낆껜 肄붾뱶", "PartMaster.vendor"],
          ["由щ뱶???, "Lead Time", "諛쒖＜ ???낃퀬源뚯? ?뚯슂?쇱닔 (??", "PartMaster.leadTime"],
          ["?덉쟾?ш퀬", "Safety Stock", "理쒖냼 ?좎??댁빞 ???ш퀬 ?섎웾", "PartMaster.safetyStock"],
          ["濡쒗듃?⑥쐞?섎웾", "Lot Unit Qty", "1媛?LOT??湲곗? ?섎웾", "PartMaster.lotUnitQty"],
          ["諛뺤뒪?섎웾", "Box Qty", "1諛뺤뒪 湲곗? ?ъ옣 ?섎웾", "PartMaster.boxQty"],
          ["IQC ?щ?", "IQC Flag", "?낇븯寃???꾩슂 ?щ? (Y/N)", "PartMaster.iqcYn (湲곕낯媛?'Y')"],
          ["?앺듃???, "Tact Time", "1媛??쒗뭹 ?앹궛 ?뚯슂?쒓컙 (珥?", "PartMaster.tactTime"],
          ["?좏슚湲곌컙", "Expiry Date", "?먯옱 ?좏슚湲곌컙 (??", "PartMaster.expiryDate"],
          ["?ㅼ감?덉슜瑜?, "Tolerance Rate", "PO ?섎웾 ?ㅼ감 ?덉슜瑜?(%)", "PartMaster.toleranceRate (湲곕낯媛?5.0)"],
          ["遺꾪븷媛?μ뿬遺", "Splittable", "?먯옱 LOT 遺꾪븷 媛???щ? (Y/N)", "PartMaster.isSplittable (湲곕낯媛?'Y')"],
          ["?섑뵆?섎웾", "Sample Qty", "?섑뵆寃???섎웾", "PartMaster.sampleQty"],
          ["?ъ옣?⑥쐞", "Pack Unit", "?ъ옣 ?⑥쐞", "PartMaster.packUnit"],
          ["蹂닿??꾩튂", "Storage Location", "李쎄퀬 ??蹂닿? ?꾩튂", "PartMaster.storageLocation"],
        ],
      },
      {
        subtitle: "BOM (Bill of Materials)",
        rows: [
          ["紐⑦뭹紐?, "Parent Part", "?곸쐞 ?꾩젣??諛섏젣???덈ぉ ID", "BomMaster.parentPartId"],
          ["?먰뭹紐?, "Child Part", "?섏쐞 援ъ꽦 ?먯옱 ?덈ぉ ID", "BomMaster.childPartId"],
          ["?뚯슂??, "Qty Per", "1媛?紐⑦뭹紐⑸떦 ?꾩슂 ?먰뭹紐??섎웾", "BomMaster.qtyPer"],
          ["?쒕쾲", "Sequence", "BOM 援ъ꽦 ?쒖꽌", "BomMaster.seq"],
          ["由щ퉬??, "Revision", "BOM 踰꾩쟾 (湲곕낯媛? A)", "BomMaster.revision"],
          ["怨듭젙", "Operation/Process", "?대떦 ?먰뭹紐⑹씠 ?ъ엯?섎뒗 怨듭젙", "BomMaster.processCode"],
          ["硫?, "Side", "SMT 湲곗? TOP/BOTTOM 硫?援щ텇", "BomMaster.side"],
          ["ECO 踰덊샇", "ECO No", "Engineering Change Order 踰덊샇", "BomMaster.ecoNo"],
          ["?좏슚?쒖옉??, "Valid From", "BOM ?곸슜 ?쒖옉??, "BomMaster.validFrom"],
          ["?좏슚醫낅즺??, "Valid To", "BOM ?곸슜 醫낅즺??, "BomMaster.validTo"],
        ],
      },
    ],
  },
  {
    title: "?앹궛 愿由?(Production Management)",
    subsections: [
      {
        subtitle: "?묒뾽吏??(Job Order)",
        rows: [
          ["?묒뾽吏?쒕쾲??, "Order No", "?묒뾽吏??怨좎쑀 踰덊샇 (怨좎쑀媛?", "JobOrder.orderNo"],
          ["?곸쐞?묒뾽吏??, "Parent ID", "?곸쐞 ?섏＜/怨꾪쉷 ?묒뾽吏??ID", "JobOrder.parentId"],
          ["?덈ぉID", "Part ID", "?앹궛 ?덈ぉ ID", "JobOrder.partId"],
          ["?쇱씤肄붾뱶", "Line Code", "?앹궛?쇱씤 肄붾뱶", "JobOrder.lineCode"],
          ["怨꾪쉷?섎웾", "Plan Qty", "?묒뾽吏??怨꾪쉷 ?앹궛 ?섎웾", "JobOrder.planQty"],
          ["?묓뭹?섎웾", "Good Qty", "?앹궛???묓뭹 ?섎웾", "JobOrder.goodQty"],
          ["遺덈웾?섎웾", "Defect Qty", "諛쒖깮 遺덈웾 ?섎웾", "JobOrder.defectQty"],
          ["怨꾪쉷?쇱옄", "Plan Date", "?묒뾽 怨꾪쉷 ?쇱옄", "JobOrder.planDate"],
          ["?곗꽑?쒖쐞", "Priority", "?묒뾽 ?곗꽑?쒖쐞 (1~10, 湲곕낯媛?5)", "JobOrder.priority"],
          ["?곹깭", "Status", "?묒뾽吏???곹깭 (WAITING, RUNNING, COMPLETED, CANCELLED)", "JobOrder.status"],
          ["ERP ?숆린??, "ERP Sync", "ERP ?쒖뒪???숆린???щ? (Y/N)", "JobOrder.erpSyncYn"],
        ],
      },
      {
        subtitle: "?앹궛?ㅼ쟻 (Production Result)",
        rows: [
          ["?묒뾽吏?쏧D", "Job Order ID", "?곌껐???묒뾽吏??ID", "ProdResult.jobOrderId"],
          ["?ㅻ퉬ID", "Equipment ID", "?앹궛???ъ슜???ㅻ퉬 ID", "ProdResult.equipId"],
          ["?묒뾽?륤D", "Worker ID", "?앹궛 ?묒뾽??ID", "ProdResult.workerId"],
          ["LOT 踰덊샇", "Lot No", "?앹궛 LOT 踰덊샇", "ProdResult.lotNo"],
          ["怨듭젙肄붾뱶", "Process Code", "?앹궛 怨듭젙 肄붾뱶", "ProdResult.processCode"],
          ["?묓뭹?섎웾", "Good Qty", "?대떦 ?ㅼ쟻???묓뭹 ?섎웾", "ProdResult.goodQty"],
          ["遺덈웾?섎웾", "Defect Qty", "?대떦 ?ㅼ쟻??遺덈웾 ?섎웾", "ProdResult.defectQty"],
          ["?쒖옉?쒓컙", "Start At", "?앹궛 ?쒖옉 ?쇱떆", "ProdResult.startAt"],
          ["醫낅즺?쒓컙", "End At", "?앹궛 醫낅즺 ?쇱떆", "ProdResult.endAt"],
          ["?ъ씠?댄???, "Cycle Time", "1媛쒕떦 ?앹궛 ?뚯슂?쒓컙 (珥?", "ProdResult.cycleTime"],
          ["?곹깭", "Status", "?ㅼ쟻 ?곹깭 (RUNNING, PAUSED, COMPLETED, CANCELLED)", "ProdResult.status"],
        ],
      },
    ],
  },
  {
    title: "?덉쭏 愿由?(Quality Management)",
    subsections: [
      {
        subtitle: "寃?ъ떎??(Inspection Result)",
        rows: [
          ["?앹궛?ㅼ쟻ID", "Production Result ID", "?곌껐???앹궛?ㅼ쟻 ID", "InspectResult.prodResultId"],
          ["?쒕━?쇰쾲??, "Serial No", "媛쒕퀎 ?쒗뭹 ?쒕━??踰덊샇", "InspectResult.serialNo"],
          ["寃?ъ쑀??, "Inspect Type", "寃???좏삎 (CONTINUITY, VISUAL, DIMENSION, FUNCTION)", "InspectResult.inspectType"],
          ["寃?щ쾾??, "Inspect Scope", "?꾩닔/?섑뵆留?援щ텇 (FULL: ?꾩닔寃?? SAMPLE: ?섑뵆留곴???", "InspectResult.inspectScope"],
          ["?⑷꺽?щ?", "Pass Y/N", "寃???⑷꺽 ?щ? (Y: ?⑷꺽, N: 遺덊빀寃?", "InspectResult.passYn"],
          ["?먮윭肄붾뱶", "Error Code", "遺덊빀寃????ㅻ쪟 肄붾뱶", "InspectResult.errorCode"],
          ["?먮윭?곸꽭", "Error Detail", "遺덊빀寃??곸꽭 ?ъ쑀", "InspectResult.errorDetail"],
          ["寃?щ뜲?댄꽣", "Inspect Data", "寃??痢≪젙 ?곗씠??(JSON)", "InspectResult.inspectData"],
          ["寃?ъ씪??, "Inspect At", "寃???섑뻾 ?쇱떆", "InspectResult.inspectAt"],
          ["寃?ъ옄ID", "Inspector ID", "寃???섑뻾??ID", "InspectResult.inspectorId"],
        ],
      },
      {
        subtitle: "遺덈웾濡쒓렇 (Defect Log)",
        rows: [
          ["?앹궛?ㅼ쟻ID", "Production Result ID", "遺덈웾 諛쒖깮 ?앹궛?ㅼ쟻 ID", "DefectLog.prodResultId"],
          ["遺덈웾肄붾뱶", "Defect Code", "遺덈웾 ?좏삎 肄붾뱶", "DefectLog.defectCode"],
          ["遺덈웾紐?, "Defect Name", "遺덈웾 ?좏삎 紐낆묶", "DefectLog.defectName"],
          ["?섎웾", "Quantity", "遺덈웾 諛쒖깮 ?섎웾", "DefectLog.qty"],
          ["?곹깭", "Status", "遺덈웾 泥섎━ ?곹깭 (WAIT: ?湲? REPAIR: ?섎━以? SCRAP: ?먭린, PASS: ?⑷꺽)", "DefectLog.status"],
          ["諛쒖깮?쒓컙", "Occur At", "遺덈웾 諛쒖깮 ?쇱떆", "DefectLog.occurAt"],
          ["?대?吏URL", "Image URL", "遺덈웾 ?ъ쭊 泥⑤? URL", "DefectLog.imageUrl"],
        ],
      },
      {
        subtitle: "?섎━?대젰 (Repair Log)",
        rows: [
          ["遺덈웾濡쒓렇ID", "Defect Log ID", "?곌껐??遺덈웾濡쒓렇 ID", "RepairLog.defectLogId"],
          ["?묒뾽?륤D", "Worker ID", "?섎━ ?묒뾽??ID", "RepairLog.workerId"],
          ["?섎━議곗튂", "Repair Action", "?섎━ ?댁슜", "RepairLog.repairAction"],
          ["?ъ슜?먯옱", "Material Used", "?섎━ ???ъ슜???먯옱", "RepairLog.materialUsed"],
          ["?섎━?쒓컙", "Repair Time", "?섎━ ?뚯슂?쒓컙 (遺?", "RepairLog.repairTime"],
          ["寃곌낵", "Result", "?섎━ 寃곌낵 (PASS: ?깃났, FAIL: ?ㅽ뙣)", "RepairLog.result"],
        ],
      },
      {
        subtitle: "IQC (Incoming Quality Control)",
        rows: [
          ["LOT ID", "Lot ID", "寃??????먯옱 LOT ID", "IqcLog.lotId"],
          ["LOT 踰덊샇", "Lot No", "?먯옱 LOT 踰덊샇", "IqcLog.lotNo"],
          ["寃?ъ쑀??, "Inspect Type", "IQC 寃???좏삎 (INITIAL: 珥덈Ъ, REGULAR: ?뺢린)", "IqcLog.inspectType"],
          ["寃곌낵", "Result", "寃??寃곌낵 (PASS: ?⑷꺽, FAIL: 遺덊빀寃?", "IqcLog.result"],
          ["寃?ъ씪??, "Inspect Date", "IQC 寃???쇱옄", "IqcLog.inspectDate"],
          ["寃?ъ옄紐?, "Inspector Name", "寃?ъ옄 ?대쫫", "IqcLog.inspectorName"],
          ["IQC ?곹깭", "IQC Status", "LOT蹂?IQC 吏꾪뻾 ?곹깭 (PENDING, PASS, FAIL, HOLD)", "MatLot.iqcStatus"],
        ],
      },
      {
        subtitle: "OQC (Outgoing Quality Control)",
        rows: [
          ["?섎ː踰덊샇", "Request No", "OQC ?섎ː 怨좎쑀 踰덊샇", "OqcRequest.requestNo"],
          ["怨좉컼??, "Customer", "異쒗븯 怨좉컼??, "OqcRequest.customer"],
          ["?섎ː?쇱옄", "Request Date", "OQC ?섎ː ?쇱옄", "OqcRequest.requestDate"],
          ["珥앸컯?ㅼ닔", "Total Box Count", "寃?????珥?諛뺤뒪 ??, "OqcRequest.totalBoxCount"],
          ["珥앹닔??, "Total Qty", "寃?????珥??섎웾", "OqcRequest.totalQty"],
          ["?섑뵆?ш린", "Sample Size", "?섑뵆留?寃?????섑뵆 ?섎웾", "OqcRequest.sampleSize"],
          ["?곹깭", "Status", "OQC 吏꾪뻾 ?곹깭 (PENDING, IN_PROGRESS, PASS, FAIL)", "OqcRequest.status"],
          ["寃곌낵", "Result", "理쒖쥌 寃??寃곌낵 (PASS, FAIL)", "OqcRequest.result"],
          ["寃?ъ씪??, "Inspect Date", "OQC 寃???꾨즺 ?쇱떆", "OqcRequest.inspectDate"],
        ],
      },
    ],
  },
  {
    title: "?먯옱 李쎄퀬 愿由?(Inventory/Warehouse)",
    subsections: [
      {
        subtitle: "?먯옱 LOT (Material Lot)",
        rows: [
          ["LOT 踰덊샇", "Lot No", "?먯옱 LOT 怨좎쑀 踰덊샇 (怨좎쑀媛?", "MatLot.lotNo"],
          ["?덈ぉID", "Part ID", "LOT???덈ぉ ID", "MatLot.partId"],
          ["珥덇린?섎웾", "Init Qty", "LOT ?낃퀬 ??理쒖큹 ?섎웾", "MatLot.initQty"],
          ["?꾩옱?섎웾", "Current Qty", "LOT???꾩옱 媛???섎웾", "MatLot.currentQty"],
          ["?낃퀬?쇱옄", "Receive Date", "LOT ?낃퀬 ?쇱옄", "MatLot.recvDate"],
          ["?쒖“?쇱옄", "Manufacture Date", "?먯옱 ?쒖“ ?쇱옄", "MatLot.manufactureDate"],
          ["留뚮즺?쇱옄", "Expire Date", "?먯옱 留뚮즺(?좏슚湲곌컙) ?쇱옄", "MatLot.expireDate"],
          ["?먯궛吏", "Origin", "?먯옱 ?먯궛吏", "MatLot.origin"],
          ["怨듦툒??, "Vendor", "?먯옱 怨듦툒 ?낆껜", "MatLot.vendor"],
          ["Invoice 踰덊샇", "Invoice No", "怨듦툒???몃낫?댁뒪 踰덊샇", "MatLot.invoiceNo"],
          ["PO 踰덊샇", "PO No", "?곌껐??援щℓ?ㅻ뜑 踰덊샇", "MatLot.poNo"],
          ["?곹깭", "Status", "LOT ?곹깭 (NORMAL, HOLD, SCRAP)", "MatLot.status"],
        ],
      },
      {
        subtitle: "?낃퀬 (Receiving)",
        rows: [
          ["?낃퀬踰덊샇", "Receive No", "?낃퀬 嫄?怨좎쑀 踰덊샇", "MatReceiving.receiveNo"],
          ["LOT ID", "Lot ID", "?낃퀬 ???LOT ID", "MatReceiving.lotId"],
          ["?덈ぉID", "Part ID", "?낃퀬 ?덈ぉ ID", "MatReceiving.partId"],
          ["?섎웾", "Quantity", "?낃퀬 ?섎웾", "MatReceiving.qty"],
          ["李쎄퀬肄붾뱶", "Warehouse Code", "?낃퀬 李쎄퀬 肄붾뱶", "MatReceiving.warehouseCode"],
          ["?낃퀬?쇱옄", "Receive Date", "?낃퀬 ?쇱떆", "MatReceiving.receiveDate"],
          ["?묒뾽?륤D", "Worker ID", "?낃퀬 ?묒뾽??ID", "MatReceiving.workerId"],
        ],
      },
      {
        subtitle: "異쒓퀬/?ъ엯 (Material Issue)",
        rows: [
          ["異쒓퀬踰덊샇", "Issue No", "異쒓퀬 嫄?怨좎쑀 踰덊샇", "MatIssue.issueNo"],
          ["?묒뾽吏?쏧D", "Job Order ID", "?먯옱 ?ъ엯 ????묒뾽吏??ID", "MatIssue.jobOrderId"],
          ["?앹궛?ㅼ쟻ID", "Production Result ID", "?먯옱 ?ъ엯???앹궛?ㅼ쟻 ID", "MatIssue.prodResultId"],
          ["LOT ID", "Lot ID", "異쒓퀬 ???LOT ID", "MatIssue.lotId"],
          ["異쒓퀬?섎웾", "Issue Qty", "異쒓퀬/?ъ엯 ?섎웾", "MatIssue.issueQty"],
          ["異쒓퀬?쇱옄", "Issue Date", "異쒓퀬 ?쇱떆", "MatIssue.issueDate"],
          ["異쒓퀬?좏삎", "Issue Type", "異쒓퀬 ?좏삎 (PROD: ?앹궛?ъ엯, SCRAP: ?먭린, RETURN: 諛섑뭹)", "MatIssue.issueType"],
        ],
      },
      {
        subtitle: "李쎄퀬/?ш퀬 (Warehouse/Stock)",
        rows: [
          ["李쎄퀬肄붾뱶", "Warehouse Code", "李쎄퀬 怨좎쑀 肄붾뱶 (怨좎쑀媛?", "Warehouse.warehouseCode"],
          ["李쎄퀬紐?, "Warehouse Name", "李쎄퀬 紐낆묶", "Warehouse.warehouseName"],
          ["李쎄퀬?좏삎", "Warehouse Type", "李쎄퀬 ?좏삎 (RAW: ?먯옄?? FG: ?꾩젣????", "Warehouse.warehouseType"],
          ["怨듭옣肄붾뱶", "Plant Code", "李쎄퀬 ?뚯냽 怨듭옣 肄붾뱶", "Warehouse.plantCode"],
          ["?쇱씤肄붾뱶", "Line Code", "李쎄퀬 ?곌껐 ?앹궛?쇱씤", "Warehouse.lineCode"],
          ["湲곕낯李쎄퀬", "Default", "?대떦 ?좏삎??湲곕낯 李쎄퀬 ?щ? (Y/N)", "Warehouse.isDefault"],
          ["?꾩튂肄붾뱶", "Location Code", "李쎄퀬 ???곸꽭 ?꾩튂 肄붾뱶", "MatStock.locationCode"],
          ["?ш퀬?섎웾", "Qty", "?꾩옱 ?ш퀬 ?섎웾", "MatStock.qty"],
          ["?덉빟?섎웾", "Reserved Qty", "異쒓퀬 ?덉빟???섎웾", "MatStock.reservedQty"],
          ["媛?⑹닔??, "Available Qty", "異쒓퀬 媛???섎웾 (?ш퀬 - ?덉빟)", "MatStock.availableQty"],
        ],
      },
    ],
  },
  {
    title: "?ㅻ퉬 愿由?(Equipment Management)",
    subsections: [
      {
        subtitle: "?ㅻ퉬 留덉뒪??(Equipment Master)",
        rows: [
          ["?ㅻ퉬肄붾뱶", "Equipment Code", "?ㅻ퉬 怨좎쑀 肄붾뱶 (怨좎쑀媛?", "EquipMaster.equipCode"],
          ["?ㅻ퉬紐?, "Equipment Name", "?ㅻ퉬 紐낆묶", "EquipMaster.equipName"],
          ["?ㅻ퉬?좏삎", "Equipment Type", "?ㅻ퉬 遺꾨쪟", "EquipMaster.equipType"],
          ["紐⑤뜽紐?, "Model Name", "?ㅻ퉬 紐⑤뜽紐?, "EquipMaster.modelName"],
          ["?쒖“??, "Maker", "?ㅻ퉬 ?쒖“??, "EquipMaster.maker"],
          ["?쇱씤肄붾뱶", "Line Code", "?ㅻ퉬媛 ?ㅼ튂???쇱씤", "EquipMaster.lineCode"],
          ["怨듭젙肄붾뱶", "Process Code", "?ㅻ퉬媛 ?랁븳 怨듭젙", "EquipMaster.processCode"],
          ["IP 二쇱냼", "IP Address", "?ㅻ퉬 ?듭떊??IP 二쇱냼", "EquipMaster.ipAddress"],
          ["?ы듃", "Port", "?ㅻ퉬 ?듭떊???ы듃 踰덊샇", "EquipMaster.port"],
          ["?듭떊?좏삎", "Comm Type", "?듭떊 ?꾨줈?좎퐳 ?좏삎", "EquipMaster.commType"],
          ["?듭떊?ㅼ젙", "Comm Config", "JSON ?뺤떇 ?듭떊 ?ㅼ젙", "EquipMaster.commConfig"],
          ["?ㅼ튂?쇱옄", "Install Date", "?ㅻ퉬 ?ㅼ튂 ?쇱옄", "EquipMaster.installDate"],
          ["?곹깭", "Status", "?ㅻ퉬 ?곹깭 (NORMAL, ERROR, MAINTENANCE)", "EquipMaster.status"],
          ["?꾩옱?묒뾽吏??, "Current Job Order ID", "?ㅻ퉬?먯꽌 ?꾩옱 吏꾪뻾 以묒씤 ?묒뾽吏??ID", "EquipMaster.currentJobOrderId"],
        ],
      },
      {
        subtitle: "?ㅻ퉬 BOM (Equipment BOM)",
        rows: [
          ["?ㅻ퉬ID", "Equipment ID", "?곌껐???ㅻ퉬 ID", "EquipBomRel.equipId"],
          ["遺?뉹D", "Part ID", "援먯껜??遺???덈ぉ ID", "EquipBomItem.partId"],
          ["援먯껜二쇨린", "Replace Cycle", "遺??援먯껜 二쇨린", "EquipBomItem.replaceCycle"],
          ["二쇨린?⑥쐞", "Cycle Unit", "援먯껜 二쇨린 ?⑥쐞 (HOUR, DAY, MONTH)", "EquipBomItem.cycleUnit"],
          ["?ㅻ퉬遺?덇?怨?, "Equip-Part Relation", "?ㅻ퉬? ?앹궛?덈ぉ??BOM 愿怨?, "EquipBomRel"],
        ],
      },
      {
        subtitle: "PM (Preventive Maintenance)",
        rows: [
          ["PM 怨꾪쉷肄붾뱶", "Plan Code", "PM 怨꾪쉷 怨좎쑀 肄붾뱶", "PmPlan.planCode"],
          ["PM 怨꾪쉷紐?, "Plan Name", "PM 怨꾪쉷 紐낆묶", "PmPlan.planName"],
          ["PM ?좏삎", "PM Type", "蹂댁쟾 ?좏삎 (TIME_BASED: ?쒓컙湲곕컲, USAGE_BASED: ?ъ슜?됯린諛?", "PmPlan.pmType"],
          ["二쇨린?좏삎", "Cycle Type", "蹂댁쟾 二쇨린 ?좏삎 (DAILY, WEEKLY, MONTHLY, YEARLY)", "PmPlan.cycleType"],
          ["二쇨린媛?, "Cycle Value", "蹂댁쟾 二쇨린 媛?, "PmPlan.cycleValue"],
          ["二쇨린?⑥쐞", "Cycle Unit", "二쇨린 ?⑥쐞", "PmPlan.cycleUnit"],
          ["?쒖쫵??, "Season Month", "?뱀젙 ?붿뿉 ?ㅽ뻾 (1~12, NULL?대㈃ ?대떦?놁쓬)", "PmPlan.seasonMonth"],
          ["?덉긽?뚯슂?쒓컙", "Estimated Time", "PM ?덉긽 ?뚯슂?쒓컙 (?쒓컙)", "PmPlan.estimatedTime"],
          ["理쒖쥌?ㅽ뻾??, "Last Executed At", "留덉?留?PM ?ㅽ뻾 ?쇱떆", "PmPlan.lastExecutedAt"],
          ["?ㅼ쓬?덉젙??, "Next Due At", "?ㅼ쓬 PM ?덉젙 ?쇱떆", "PmPlan.nextDueAt"],
        ],
      },
    ],
  },
  {
    title: "異쒗븯/?⑺뭹 愿由?(Shipping/Delivery)",
    subsections: [
      {
        subtitle: "怨좉컼二쇰Ц (Customer Order)",
        rows: [
          ["二쇰Ц踰덊샇", "Order No", "怨좉컼二쇰Ц 怨좎쑀 踰덊샇 (怨좎쑀媛?", "CustomerOrder.orderNo"],
          ["怨좉컼ID", "Customer ID", "二쇰Ц 怨좉컼??ID", "CustomerOrder.customerId"],
          ["怨좉컼紐?, "Customer Name", "二쇰Ц 怨좉컼??紐낆묶", "CustomerOrder.customerName"],
          ["二쇰Ц?쇱옄", "Order Date", "二쇰Ц ?묒닔 ?쇱옄", "CustomerOrder.orderDate"],
          ["?⑷린?쇱옄", "Due Date", "?⑺뭹 ?덉젙 ?쇱옄", "CustomerOrder.dueDate"],
          ["二쇰Ц?곹깭", "Status", "二쇰Ц ?곹깭 (RECEIVED, CONFIRMED, SHIPPED, CANCELLED)", "CustomerOrder.status"],
          ["珥앷툑??, "Total Amount", "二쇰Ц 珥?湲덉븸", "CustomerOrder.totalAmount"],
          ["?듯솕", "Currency", "?듯솕 ?⑥쐞 (KRW, USD ??", "CustomerOrder.currency"],
        ],
      },
      {
        subtitle: "異쒗븯吏??(Shipment Order)",
        rows: [
          ["異쒗븯吏?쒕쾲??, "Ship Order No", "異쒗븯吏??怨좎쑀 踰덊샇 (怨좎쑀媛?", "ShipmentOrder.shipOrderNo"],
          ["異쒗븯?쇱옄", "Ship Date", "?ㅼ젣 異쒗븯 ?쇱옄", "ShipmentOrder.shipDate"],
          ["?곹깭", "Status", "異쒗븯吏???곹깭 (DRAFT, READY, SHIPPED, CANCELLED)", "ShipmentOrder.status"],
        ],
      },
      {
        subtitle: "諛뺤뒪/?뚮젢??(Box/Pallet)",
        rows: [
          ["諛뺤뒪踰덊샇", "Box No", "諛뺤뒪 怨좎쑀 踰덊샇 (怨좎쑀媛?", "BoxMaster.boxNo"],
          ["?덈ぉID", "Part ID", "諛뺤뒪???닿릿 ?덈ぉ ID", "BoxMaster.partId"],
          ["?섎웾", "Quantity", "諛뺤뒪 ???쒗뭹 ?섎웾", "BoxMaster.qty"],
          ["?쒕━?쇰ぉ濡?, "Serial List", "諛뺤뒪 ???쒗뭹 ?쒕━??踰덊샇 紐⑸줉 (JSON)", "BoxMaster.serialList"],
          ["?뚮젢?퇙D", "Pallet ID", "?곸쐞 ?뚮젢??ID", "BoxMaster.palletId"],
          ["諛뺤뒪?곹깭", "Status", "諛뺤뒪 ?곹깭 (OPEN: ?ъ옣以? CLOSED: ?ъ옣?꾨즺, SHIPPED: 異쒗븯?꾨즺)", "BoxMaster.status"],
          ["OQC ?곹깭", "OQC Status", "異쒗븯寃???곹깭", "BoxMaster.oqcStatus"],
          ["留덇컧?쒓컙", "Close At", "諛뺤뒪 ?ъ옣 ?꾨즺 ?쇱떆", "BoxMaster.closeAt"],
          ["?뚮젢?몃쾲??, "Pallet No", "?뚮젢??怨좎쑀 踰덊샇 (怨좎쑀媛?", "PalletMaster.palletNo"],
          ["諛뺤뒪??, "Box Count", "?뚮젢????諛뺤뒪 ??, "PalletMaster.boxCount"],
          ["珥앹닔??, "Total Qty", "?뚮젢????珥??쒗뭹 ?섎웾", "PalletMaster.totalQty"],
          ["異쒗븯ID", "Shipment ID", "?곌껐??異쒗븯 ID", "PalletMaster.shipmentId"],
        ],
      },
    ],
  },
  {
    title: "?몄＜/?묐젰??愿由?(Outsourcing)",
    subsections: [
      {
        subtitle: "援щℓ?ㅻ뜑 (Purchase Order)",
        rows: [
          ["PO 踰덊샇", "PO No", "援щℓ?ㅻ뜑 怨좎쑀 踰덊샇 (怨좎쑀媛?", "PurchaseOrder.poNo"],
          ["?묐젰?촇D", "Partner ID", "怨듦툒???묐젰??ID", "PurchaseOrder.partnerId"],
          ["?묐젰?щ챸", "Partner Name", "怨듦툒???묐젰??紐낆묶", "PurchaseOrder.partnerName"],
          ["諛쒖＜?쇱옄", "Order Date", "PO 諛쒗뻾 ?쇱옄", "PurchaseOrder.orderDate"],
          ["?⑷린?쇱옄", "Due Date", "?⑺뭹 ?덉젙 ?쇱옄", "PurchaseOrder.dueDate"],
          ["PO ?곹깭", "Status", "PO ?곹깭 (DRAFT, CONFIRMED, RECEIVING, COMPLETED, CANCELLED)", "PurchaseOrder.status"],
          ["珥앷툑??, "Total Amount", "PO 珥?湲덉븸", "PurchaseOrder.totalAmount"],
        ],
      },
      {
        subtitle: "?묐젰??嫄곕옒泥?(Partner/Vendor)",
        rows: [
          ["嫄곕옒泥섏퐫??, "Partner Code", "嫄곕옒泥?怨좎쑀 肄붾뱶", "PartnerMaster.partnerCode"],
          ["嫄곕옒泥섎챸", "Partner Name", "嫄곕옒泥?紐낆묶", "PartnerMaster.partnerName"],
          ["嫄곕옒泥섏쑀??, "Partner Type", "嫄곕옒泥??좏삎 (VENDOR: 怨듦툒?? CUSTOMER: 怨좉컼?? SUBCON: ?몄＜??", "PartnerMaster.partnerType"],
          ["?ъ뾽?먮쾲??, "Business No", "?ъ뾽?먮벑濡앸쾲??, "PartnerMaster.businessNo"],
          ["??쒖옄", "CEO", "??쒖옄紐?, "PartnerMaster.ceo"],
          ["?대떦??, "Contact Person", "?대떦?먮챸", "PartnerMaster.contactPerson"],
          ["?곕씫泥?, "Phone", "?곕씫泥?, "PartnerMaster.phone"],
          ["?대찓??, "Email", "?대찓??二쇱냼", "PartnerMaster.email"],
          ["二쇱냼", "Address", "二쇱냼", "PartnerMaster.address"],
        ],
      },
    ],
  },
  {
    title: "怨듭젙/?쇱씤 愿由?(Process/Line)",
    subsections: [
      {
        subtitle: "怨듭젙 留덉뒪??(Process Master)",
        rows: [
          ["怨듭젙肄붾뱶", "Process Code", "怨듭젙 怨좎쑀 肄붾뱶 (怨좎쑀媛?", "ProcessMaster.processCode"],
          ["怨듭젙紐?, "Process Name", "怨듭젙 紐낆묶", "ProcessMaster.processName"],
          ["怨듭젙?좏삎", "Process Type", "怨듭젙 ?좏삎", "ProcessMaster.processType"],
          ["怨듭젙遺꾨쪟", "Process Category", "怨듭젙 遺꾨쪟", "ProcessMaster.processCategory"],
          ["?섑뵆寃?ъ뿬遺", "Sample Inspect Y/N", "怨듭젙蹂??섑뵆寃???꾩슂 ?щ?", "ProcessMaster.sampleInspectYn"],
          ["?뺣젹?쒖꽌", "Sort Order", "怨듭젙 ?쒖떆 ?쒖꽌", "ProcessMaster.sortOrder"],
        ],
      },
      {
        subtitle: "?앹궛?쇱씤 (Production Line)",
        rows: [
          ["?쇱씤肄붾뱶", "Line Code", "?앹궛?쇱씤 怨좎쑀 肄붾뱶", "ProdLineMaster.lineCode"],
          ["?쇱씤紐?, "Line Name", "?앹궛?쇱씤 紐낆묶", "ProdLineMaster.lineName"],
          ["怨듭옣肄붾뱶", "Plant Code", "?쇱씤 ?뚯냽 怨듭옣", "ProdLineMaster.plantCode"],
          ["怨듭젙肄붾뱶", "Process Code", "?쇱씤??二?怨듭젙", "ProdLineMaster.processCode"],
          ["?대떦??, "Manager", "?쇱씤 ?대떦??, "ProdLineMaster.manager"],
          ["媛?⑹떆?묒떆媛?, "Available From", "?쇱씤 媛???쒖옉 ?쒓컙", "ProdLineMaster.availableFrom"],
          ["媛?⑹쥌猷뚯떆媛?, "Available To", "?쇱씤 媛??醫낅즺 ?쒓컙", "ProdLineMaster.availableTo"],
        ],
      },
    ],
  },
  {
    title: "異붿쟻/?대젰 (Traceability)",
    subsections: [
      {
        subtitle: "異붿쟻濡쒓렇 (Trace Log)",
        rows: [
          ["異붿쟻?쒓컙", "Trace Time", "?대젰 諛쒖깮 ?쇱떆", "TraceLog.traceTime"],
          ["?뚮젢?퇙D", "Pallet ID", "?곌껐???뚮젢??ID", "TraceLog.palletId"],
          ["諛뺤뒪ID", "Box ID", "?곌껐??諛뺤뒪 ID", "TraceLog.boxId"],
          ["LOT ID", "Lot ID", "?곌껐??LOT ID", "TraceLog.lotId"],
          ["?먯옱LOT ID", "Material Lot ID", "?곌껐???먯옱 LOT ID", "TraceLog.matLotId"],
          ["?ㅻ퉬ID", "Equipment ID", "?ъ슜???ㅻ퉬 ID", "TraceLog.equipId"],
          ["?묒뾽?륤D", "Worker ID", "?묒뾽??ID", "TraceLog.workerId"],
          ["怨듭젙肄붾뱶", "Process Code", "諛쒖깮 怨듭젙 肄붾뱶", "TraceLog.processCode"],
          ["?쒕━?쇰쾲??, "Serial No", "?쒗뭹 ?쒕━??踰덊샇", "TraceLog.serialNo"],
          ["?대깽?몄쑀??, "Event Type", "?대깽???좏삎", "TraceLog.eventType"],
          ["?대깽?몃뜲?댄꽣", "Event Data", "?대깽???곸꽭 ?곗씠??(JSON)", "TraceLog.eventData"],
          ["遺紐쭵D", "Parent ID", "?곸쐞(諛섏젣?? ?쒕━??ID", "TraceLog.parentId"],
        ],
      },
    ],
  },
  {
    title: "?묒뾽??愿由?(Worker Management)",
    subsections: [
      {
        rows: [
          ["?묒뾽?먯퐫??, "Worker Code", "?묒뾽??怨좎쑀 肄붾뱶 (怨좎쑀媛?", "WorkerMaster.workerCode"],
          ["?묒뾽?먮챸", "Worker Name", "?묒뾽???대쫫", "WorkerMaster.workerName"],
          ["?곷Ц紐?, "English Name", "?묒뾽???곷Ц ?대쫫", "WorkerMaster.engName"],
          ["遺??, "Department", "?뚯냽 遺??, "WorkerMaster.dept"],
          ["吏곸콉", "Position", "吏곸콉/吏곴툒", "WorkerMaster.position"],
          ["?꾪솕踰덊샇", "Phone", "?곕씫泥?, "WorkerMaster.phone"],
          ["?대찓??, "Email", "?대찓??二쇱냼", "WorkerMaster.email"],
          ["?낆궗??, "Hire Date", "?낆궗 ?쇱옄", "WorkerMaster.hireDate"],
          ["?댁궗??, "Quit Date", "?댁궗 ?쇱옄", "WorkerMaster.quitDate"],
          ["QR肄붾뱶", "QR Code", "?묒뾽???앸퀎??QR 肄붾뱶", "WorkerMaster.qrCode"],
          ["?ъ쭊URL", "Photo URL", "?묒뾽???ъ쭊 URL", "WorkerMaster.photoUrl"],
          ["媛?κ났??, "Process IDs", "?묒뾽 媛??怨듭젙 紐⑸줉 (JSON)", "WorkerMaster.processIds"],
        ],
      },
    ],
  },
  {
    title: "?쒖뒪??怨듯넻 肄붾뱶 (System/Common Code)",
    subsections: [
      {
        subtitle: "怨듯넻肄붾뱶 (Common Code)",
        rows: [
          ["洹몃９肄붾뱶", "Group Code", "怨듯넻肄붾뱶 遺꾨쪟 洹몃９", "ComCode.groupCode"],
          ["肄붾뱶", "Code", "怨듯넻肄붾뱶 媛?, "ComCode.code"],
          ["肄붾뱶紐?, "Code Name", "怨듯넻肄붾뱶 紐낆묶", "ComCode.codeName"],
          ["肄붾뱶?곷Ц紐?, "Code Name EN", "怨듯넻肄붾뱶 ?곷Ц 紐낆묶", "ComCode.codeNameEn"],
          ["?뺣젹?쒖꽌", "Sort Order", "肄붾뱶 ?쒖떆 ?쒖꽌", "ComCode.sortOrder"],
          ["?띿꽦1~5", "Attribute 1~5", "肄붾뱶蹂?異붽? ?띿꽦媛?, "ComCode.attr1 ~ attr5"],
        ],
      },
      {
        subtitle: "?쒖뒪???ㅼ젙 (System Config)",
        rows: [
          ["?ㅼ젙肄붾뱶", "Config Code", "?쒖뒪???ㅼ젙 ??ぉ 肄붾뱶", "SysConfig.configCode"],
          ["?ㅼ젙媛?, "Config Value", "?ㅼ젙 媛?, "SysConfig.configValue"],
          ["?ㅼ젙?좏삎", "Config Type", "?ㅼ젙媛??좏삎 (STRING, NUMBER, BOOLEAN, JSON)", "SysConfig.configType"],
          ["?ㅻ챸", "Description", "?ㅼ젙 ??ぉ ?ㅻ챸", "SysConfig.description"],
        ],
      },
    ],
  },
];

// ?? 珥??⑹뼱 ??移댁슫????
let totalTerms = 0;
sections.forEach((s) => s.subsections.forEach((sub) => (totalTerms += sub.rows.length)));

// ?? 臾몄꽌 ?앹꽦 ??
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "留묒? 怨좊뵓", size: 20 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "留묒? 怨좊뵓", color: COLORS.primary },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "留묒? 怨좊뵓", color: COLORS.secondary },
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
    // ?? ?쒖? ?섏씠吏 ??
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: MARGIN_TB, right: MARGIN_LR, bottom: MARGIN_TB, left: MARGIN_LR },
        },
      },
      children: [
        spacer(3000),
        // ?곷떒 援щ텇??
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
          children: [new TextRun({ text: "HANES MES", font: "留묒? 怨좊뵓", size: 56, bold: true, color: COLORS.primary })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "Manufacturing Execution System", font: "留묒? 怨좊뵓", size: 26, color: COLORS.subtitleGray })],
        }),
        spacer(200),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: "????吏?, font: "留묒? 怨좊뵓", size: 48, bold: true, color: COLORS.primary })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 0 },
          children: [new TextRun({ text: "GLOSSARY", font: "留묒? 怨좊뵓", size: 32, color: COLORS.secondary })],
        }),
        spacer(300),
        // ?섎떒 援щ텇??
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
        // ?뺣낫 ?뚯씠釉?
        new Table({
          width: { size: 6000, type: WidthType.DXA },
          columnWidths: [2000, 4000],
          rows: [
            ["臾몄꽌踰덊샇", "HANES-DOC-GLOSSARY-001"],
            ["踰꾩쟾", "1.0"],
            ["?묒꽦??, "2026-02-24"],
            ["珥??⑹뼱 ??, `${totalTerms}媛?],
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
                      children: [new TextRun({ text: label, font: "留묒? 怨좊뵓", size: 20, bold: true, color: COLORS.subtitleGray })],
                    }),
                  ],
                }),
                new TableCell({
                  borders: noBorders,
                  width: { size: 4000, type: WidthType.DXA },
                  margins: { top: 40, bottom: 40, left: 120, right: 80 },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: value, font: "留묒? 怨좊뵓", size: 20, color: COLORS.primary })],
                    }),
                  ],
                }),
              ],
            })
          ),
        }),
      ],
    },
    // ?? 紐⑹감 + 蹂몃Ц ??
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
                new TextRun({ text: "HANES MES ?⑹뼱吏?, font: "留묒? 怨좊뵓", size: 16, color: COLORS.subtitleGray, italics: true }),
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
                new TextRun({ text: "- ", font: "留묒? 怨좊뵓", size: 16, color: COLORS.subtitleGray }),
                new TextRun({ children: [PageNumber.CURRENT], font: "留묒? 怨좊뵓", size: 16, color: COLORS.subtitleGray }),
                new TextRun({ text: " -", font: "留묒? 怨좊뵓", size: 16, color: COLORS.subtitleGray }),
              ],
            }),
          ],
        }),
      },
      children: [
        // 紐⑹감
        new Paragraph({
          spacing: { before: 0, after: 300 },
          children: [new TextRun({ text: "紐⑹감 (Table of Contents)", font: "留묒? 怨좊뵓", size: 28, bold: true, color: COLORS.primary })],
        }),
        new TableOfContents("紐⑹감", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({ children: [new PageBreak()] }),

        // 蹂몃Ц ?뱀뀡??
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

        // ?? 臾몄꽌 ?대젰 ??
        new Paragraph({ children: [new PageBreak()] }),
        sectionHeading("臾몄꽌 ?대젰"),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [2400, 3000, 9038],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell("?쇱옄", 2400),
                headerCell("?묒꽦??, 3000),
                headerCell("?댁슜", 9038),
              ],
            }),
            new TableRow({
              children: [
                dataCell("2025-02-24", 2400, true),
                dataCell("-", 3000, true),
                dataCell("HANES MES ?꾨줈?앺듃 肄붾뱶 湲곕컲 珥덉븞 ?묒꽦", 9038, true),
              ],
            }),
            new TableRow({
              children: [
                dataCell("2026-02-24", 2400, false),
                dataCell("-", 3000, false),
                dataCell("Word 臾몄꽌(.docx) ?뺤떇?쇰줈 蹂??, 9038, false),
              ],
            }),
          ],
        }),
        spacer(400),
        new Paragraph({
          spacing: { before: 200, after: 0 },
          children: [
            new TextRun({
              text: "蹂??⑹뼱吏묒? apps/backend/src/entities/*.entity.ts ?뚯씪?ㅼ쓽 ?꾨뱶 ?뺤쓽瑜?湲곕컲?쇰줈 ?묒꽦?섏뿀?듬땲??",
              font: "留묒? 怨좊뵓", size: 18, italics: true, color: COLORS.subtitleGray,
            }),
          ],
        }),
      ],
    },
  ],
});

// ?? ?뚯씪 ?????
const outputPath = path.resolve(__dirname, "../exports/all/HANES_MES_GLOSSARY.docx");
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${outputPath}`);
  console.log(`Total terms: ${totalTerms}`);
});

