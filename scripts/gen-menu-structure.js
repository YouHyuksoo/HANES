/**
 * @file scripts/gen-menu-structure.js
 * @description HARNESS MES 메뉴구성도 Word 문서 생성 (menuConfig.ts + i18n 자동 추출)
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CW = 13440;
const MARGIN = 1200;
const C = { primary: '2B579A', hdr: 'D5E8F0', alt: 'F5F9FC', w: 'FFFFFF', tree: 'E8F0FE', grp: 'FFF2CC' };
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

function dataTbl(headers, data, widths) {
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => c(h, widths[i], { bold: true, shading: C.hdr, align: AlignmentType.CENTER, size: 15 })) }),
      ...data.map((row, idx) => new TableRow({
        children: row.map((val, i) => c(val, widths[i], { size: 15, shading: idx % 2 === 1 ? C.alt : C.w, align: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT, bold: i === 1 && !row[2] })),
      })),
    ],
  });
}

function sp() { return new Paragraph({ spacing: { after: 200 }, children: [] }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }

// ── i18n 한글명 매핑 (menuConfig labelKey → 한글) ──
const labels = {
  'menu.dashboard': '대시보드', 'menu.monitoring': '모니터링', 'menu.equipment.status': '설비현황',
  'menu.master': '기준정보', 'menu.master.part': '품목관리', 'menu.master.bom': 'BOM관리', 'menu.master.partner': '거래처관리',
  'menu.equipment.master': '설비마스터', 'menu.master.process': '공정관리', 'menu.master.prodLine': '생산라인관리',
  'menu.master.routing': '라우팅관리', 'menu.master.worker': '작업자관리', 'menu.master.workInstruction': '작업지도서관리',
  'menu.master.warehouse': '창고관리', 'menu.master.label': '라벨관리', 'menu.master.vendorBarcode': '제조사 바코드 매핑',
  'menu.system.document': '문서관리',
  'menu.matInventory': '자재재고관리', 'menu.inventory.matStock': '자재재고현황조회', 'menu.inventory.transaction': '자재수불이력조회',
  'menu.inventory.matPhysicalInv': '자재재고실사관리', 'menu.inventory.matPhysicalInvHistory': '자재재고실사조회',
  'menu.inventory.arrivalStock': '입하재고현황조회', 'menu.material.hold': '자재재고홀드관리',
  'menu.productInventory': '제품재고관리', 'menu.inventory.productStock': '제품재고현황조회',
  'menu.inventory.productPhysicalInv': '제품재고실사관리', 'menu.inventory.productPhysicalInvHistory': '제품재고실사조회',
  'menu.productInventory.hold': '제품재고홀드관리',
  'menu.productMgmt': '제품수불관리', 'menu.productMgmt.receive': '제품입고관리', 'menu.productMgmt.receiptCancel': '제품입고취소',
  'menu.productMgmt.issue': '제품출고관리', 'menu.productMgmt.issueCancel': '제품출고취소',
  'menu.material': '자재수불관리', 'menu.material.arrival': '입하관리', 'menu.material.receiveLabel': '입고라벨발행',
  'menu.material.receive': '자재입고관리', 'menu.material.receiveHistory': '입고이력조회', 'menu.material.request': '출고요청관리',
  'menu.material.issue': '자재출고관리', 'menu.material.lot': 'LOT관리', 'menu.material.lotSplit': '자재분할관리',
  'menu.material.lotMerge': '자재병합관리', 'menu.material.shelfLife': '자재유수명관리', 'menu.material.scrap': '자재폐기처리',
  'menu.material.adjustment': '재고보정처리', 'menu.material.miscReceipt': '기타입고관리', 'menu.material.receiptCancel': '자재입고취소',
  'menu.purchasing': '자재주문관리', 'menu.purchasing.po': 'PO관리', 'menu.purchasing.poStatus': 'PO현황조회',
  'menu.production': '생산관리', 'menu.production.monthlyPlan': '월간생산계획', 'menu.production.order': '작업지시관리',
  'menu.production.result': '생산실적조회', 'menu.production.progress': '작업지시현황조회',
  'menu.production.inputManual': '실적입력(수작업)', 'menu.production.inputMachine': '실적입력(가공)',
  'menu.production.inputInspect': '실적입력(단순검사)', 'menu.production.inputEquip': '실적입력(검사장비)',
  'menu.production.resultSummary': '작업실적통합조회', 'menu.production.wipStock': '반제품/제품재고조회',
  'menu.quality.rework': '재작업관리', 'menu.quality.reworkHistory': '재작업이력조회', 'menu.production.repair': '수리관리',
  'menu.inspection': '통전검사', 'menu.inspection.result': '통전검사관리', 'menu.inspection.history': '통전검사이력',
  'menu.inspection.protocol': '통전검사 프로토콜',
  'menu.quality': '품질관리', 'menu.master.iqcItem': 'IQC검사항목/그룹', 'menu.material.iqc': '수입검사(IQC)',
  'menu.material.iqcHistory': '수입검사이력조회', 'menu.quality.defect': '불량관리',
  'menu.quality.reworkInspect': '재작업검사', 'menu.quality.inspect': '공정검사',
  'menu.production.sampleInspect': '샘플검사이력조회', 'menu.quality.oqc': '출하검사(OQC)',
  'menu.quality.oqcHistory': '출하검사이력조회', 'menu.quality.trace': '추적관리',
  'menu.quality.changeControl': '변경관리', 'menu.quality.complaint': '고객불만관리',
  'menu.quality.capa': 'CAPA관리', 'menu.quality.fai': 'FAI관리', 'menu.quality.ppap': 'PPAP관리',
  'menu.quality.spc': 'SPC관리', 'menu.quality.controlPlan': 'Control Plan', 'menu.quality.audit': '감사관리',
  'menu.system.training': '교육관리',
  'menu.equipment': '설비관리', 'menu.equipment.mold': '금형관리',
  'menu.equipment.inspectItemMaster': '점검항목마스터', 'menu.master.equipInspect': '설비별 점검항목',
  'menu.equipment.dailyInspectCalendar': '일상점검 캘린더', 'menu.equipment.dailyInspect': '일상점검',
  'menu.equipment.periodicInspectCalendar': '정기점검 캘린더', 'menu.equipment.periodicInspect': '정기점검',
  'menu.equipment.inspectHistory': '점검이력조회',
  'menu.equipment.pmPlan': '예방보전 계획', 'menu.equipment.pmCalendar': '예방보전 캘린더', 'menu.equipment.pmResult': '예방보전 실적',
  'menu.gauge': '계측기관리', 'menu.gauge.master': '계측기마스터', 'menu.gauge.calibration': '교정관리',
  'menu.gauge.calibrationHistory': '교정이력조회',
  'menu.shipping': '출하관리', 'menu.production.packResult': '포장실적조회', 'menu.shipping.pack': '포장관리',
  'menu.shipping.pallet': '팔렛관리', 'menu.shipping.confirm': '출하확정',
  'menu.shipping.order': '출하오더관리', 'menu.shipping.history': '출하이력조회', 'menu.shipping.return': '반품관리',
  'menu.shipping.customerPo': '고객PO관리', 'menu.shipping.customerPoStatus': '고객PO현황',
  'menu.customs': '보세관리', 'menu.customs.entry': '보세반입', 'menu.customs.stock': '보세재고',
  'menu.customs.usage': '보세사용현황',
  'menu.consumables': '소모품관리', 'menu.consumables.master': '소모품마스터', 'menu.consumables.label': '소모품라벨',
  'menu.consumables.receiving': '소모품입고', 'menu.consumables.issuing': '소모품출고',
  'menu.consumables.stock': '소모품재고', 'menu.consumables.life': '소모품수명관리',
  'menu.outsourcing': '외주관리', 'menu.outsourcing.vendor': '외주업체관리', 'menu.outsourcing.order': '외주발주관리',
  'menu.outsourcing.receive': '외주입고관리',
  'menu.interface': '인터페이스', 'menu.interface.dashboard': '연동현황', 'menu.interface.log': '연동로그',
  'menu.interface.manual': '수동연동',
  'menu.system': '시스템관리', 'menu.master.company': '회사관리', 'menu.system.department': '부서관리',
  'menu.system.users': '사용자관리', 'menu.system.roles': '권한관리', 'menu.system.pdaRoles': 'PDA권한관리',
  'menu.system.commConfig': '통신설정', 'menu.system.config': '시스템설정', 'menu.master.code': '코드관리',
  'scheduler.title': '스케줄러 관리',
};

const L = (key) => labels[key] || key;

// ── 메뉴 구조 데이터 ──
const menus = [
  { code: 'DASHBOARD', labelKey: 'menu.dashboard', path: '/dashboard', icon: 'LayoutDashboard', children: [] },
  { code: 'MONITORING', labelKey: 'menu.monitoring', icon: 'Monitor', children: [
    { code: 'MON_EQUIP_STATUS', labelKey: 'menu.equipment.status', path: '/equipment/status' },
  ]},
  { code: 'MASTER', labelKey: 'menu.master', icon: 'Database', children: [
    { code: 'MST_PART', labelKey: 'menu.master.part', path: '/master/part' },
    { code: 'MST_BOM', labelKey: 'menu.master.bom', path: '/master/bom' },
    { code: 'MST_PARTNER', labelKey: 'menu.master.partner', path: '/master/partner' },
    { code: 'EQUIP_MASTER', labelKey: 'menu.equipment.master', path: '/master/equip' },
    { code: 'MST_PROCESS', labelKey: 'menu.master.process', path: '/master/process' },
    { code: 'MST_PROD_LINE', labelKey: 'menu.master.prodLine', path: '/master/prod-line' },
    { code: 'MST_ROUTING', labelKey: 'menu.master.routing', path: '/master/routing' },
    { code: 'MST_WORKER', labelKey: 'menu.master.worker', path: '/master/worker' },
    { code: 'MST_WORK_INST', labelKey: 'menu.master.workInstruction', path: '/master/work-instruction' },
    { code: 'MST_WAREHOUSE', labelKey: 'menu.master.warehouse', path: '/master/warehouse' },
    { code: 'MST_LABEL', labelKey: 'menu.master.label', path: '/master/label' },
    { code: 'MST_VENDOR_BARCODE', labelKey: 'menu.master.vendorBarcode', path: '/master/vendor-barcode' },
    { code: 'SYS_DOCUMENT', labelKey: 'menu.system.document', path: '/system/document' },
  ]},
  { code: 'INVENTORY', labelKey: 'menu.matInventory', icon: 'Warehouse', children: [
    { code: 'INV_MAT_STOCK', labelKey: 'menu.inventory.matStock', path: '/inventory/material-stock' },
    { code: 'INV_TRANSACTION', labelKey: 'menu.inventory.transaction', path: '/inventory/transaction' },
    { code: 'INV_MAT_PHYSICAL_INV', labelKey: 'menu.inventory.matPhysicalInv', path: '/inventory/material-physical-inv' },
    { code: 'INV_MAT_PHYSICAL_INV_HISTORY', labelKey: 'menu.inventory.matPhysicalInvHistory', path: '/inventory/material-physical-inv-history' },
    { code: 'INV_ARRIVAL_STOCK', labelKey: 'menu.inventory.arrivalStock', path: '/material/arrival-stock' },
    { code: 'MAT_HOLD', labelKey: 'menu.material.hold', path: '/material/hold' },
  ]},
  { code: 'PRODUCT_INVENTORY', labelKey: 'menu.productInventory', icon: 'ClipboardCheck', children: [
    { code: 'INV_PRODUCT_STOCK', labelKey: 'menu.inventory.productStock', path: '/inventory/stock' },
    { code: 'INV_PRODUCT_PHYSICAL_INV', labelKey: 'menu.inventory.productPhysicalInv', path: '/inventory/product-physical-inv' },
    { code: 'INV_PRODUCT_PHYSICAL_INV_HISTORY', labelKey: 'menu.inventory.productPhysicalInvHistory', path: '/inventory/product-physical-inv-history' },
    { code: 'PROD_HOLD', labelKey: 'menu.productInventory.hold', path: '/inventory/product-hold' },
  ]},
  { code: 'PRODUCT_MGMT', labelKey: 'menu.productMgmt', icon: 'PackageCheck', children: [
    { code: 'PROD_RECEIVE', labelKey: 'menu.productMgmt.receive', path: '/product/receive' },
    { code: 'PROD_RECEIPT_CANCEL', labelKey: 'menu.productMgmt.receiptCancel', path: '/product/receipt-cancel' },
    { code: 'PROD_ISSUE', labelKey: 'menu.productMgmt.issue', path: '/product/issue' },
    { code: 'PROD_ISSUE_CANCEL', labelKey: 'menu.productMgmt.issueCancel', path: '/product/issue-cancel' },
  ]},
  { code: 'MATERIAL', labelKey: 'menu.material', icon: 'Package', children: [
    { code: 'MAT_ARRIVAL', labelKey: 'menu.material.arrival', path: '/material/arrival' },
    { code: 'MAT_RECEIVE_LABEL', labelKey: 'menu.material.receiveLabel', path: '/material/receive-label' },
    { code: 'MAT_RECEIVE', labelKey: 'menu.material.receive', path: '/material/receive' },
    { code: 'MAT_RECEIVE_HISTORY', labelKey: 'menu.material.receiveHistory', path: '/material/receive-history' },
    { code: 'MAT_REQUEST', labelKey: 'menu.material.request', path: '/material/request' },
    { code: 'MAT_ISSUE', labelKey: 'menu.material.issue', path: '/material/issue' },
    { code: 'MAT_LOT', labelKey: 'menu.material.lot', path: '/material/lot' },
    { code: 'MAT_LOT_SPLIT', labelKey: 'menu.material.lotSplit', path: '/material/lot-split' },
    { code: 'MAT_LOT_MERGE', labelKey: 'menu.material.lotMerge', path: '/material/lot-merge' },
    { code: 'MAT_SHELF_LIFE', labelKey: 'menu.material.shelfLife', path: '/material/shelf-life' },
    { code: 'MAT_SCRAP', labelKey: 'menu.material.scrap', path: '/material/scrap' },
    { code: 'MAT_ADJUSTMENT', labelKey: 'menu.material.adjustment', path: '/material/adjustment' },
    { code: 'MAT_MISC_RECEIPT', labelKey: 'menu.material.miscReceipt', path: '/material/misc-receipt' },
    { code: 'MAT_RECEIPT_CANCEL', labelKey: 'menu.material.receiptCancel', path: '/material/receipt-cancel' },
  ]},
  { code: 'PURCHASING', labelKey: 'menu.purchasing', icon: 'ShoppingCart', children: [
    { code: 'PUR_PO', labelKey: 'menu.purchasing.po', path: '/material/po' },
    { code: 'PUR_PO_STATUS', labelKey: 'menu.purchasing.poStatus', path: '/material/po-status' },
  ]},
  { code: 'PRODUCTION', labelKey: 'menu.production', icon: 'Factory', children: [
    { code: 'PROD_MONTHLY_PLAN', labelKey: 'menu.production.monthlyPlan', path: '/production/monthly-plan' },
    { code: 'PROD_ORDER', labelKey: 'menu.production.order', path: '/production/order' },
    { code: 'PROD_RESULT', labelKey: 'menu.production.result', path: '/production/result' },
    { code: 'PROD_PROGRESS', labelKey: 'menu.production.progress', path: '/production/progress' },
    { code: 'PROD_INPUT_MANUAL', labelKey: 'menu.production.inputManual', path: '/production/input-manual' },
    { code: 'PROD_INPUT_MACHINE', labelKey: 'menu.production.inputMachine', path: '/production/input-machine' },
    { code: 'PROD_INPUT_INSPECT', labelKey: 'menu.production.inputInspect', path: '/production/input-inspect' },
    { code: 'PROD_INPUT_EQUIP', labelKey: 'menu.production.inputEquip', path: '/production/input-equip' },
    { code: 'PROD_RESULT_SUMMARY', labelKey: 'menu.production.resultSummary', path: '/production/result-summary' },
    { code: 'PROD_WIP_STOCK', labelKey: 'menu.production.wipStock', path: '/production/wip-stock' },
    { code: 'QC_REWORK', labelKey: 'menu.quality.rework', path: '/quality/rework' },
    { code: 'QC_REWORK_HISTORY', labelKey: 'menu.quality.reworkHistory', path: '/quality/rework-history' },
    { code: 'PROD_REPAIR', labelKey: 'menu.production.repair', path: '/production/repair' },
  ]},
  { code: 'INSPECTION', labelKey: 'menu.inspection', icon: 'ScanLine', children: [
    { code: 'INSP_RESULT', labelKey: 'menu.inspection.result', path: '/inspection/result' },
    { code: 'INSP_HISTORY', labelKey: 'menu.inspection.history', path: '/inspection/history' },
    { code: 'INSP_PROTOCOL', labelKey: 'menu.inspection.protocol', path: '/inspection/protocol' },
  ]},
  { code: 'QUALITY', labelKey: 'menu.quality', icon: 'Shield', children: [
    { code: 'QC_IQC_ITEM', labelKey: 'menu.master.iqcItem', path: '/master/iqc-item' },
    { code: 'QC_IQC', labelKey: 'menu.material.iqc', path: '/material/iqc' },
    { code: 'QC_IQC_HISTORY', labelKey: 'menu.material.iqcHistory', path: '/material/iqc-history' },
    { code: 'QC_DEFECT', labelKey: 'menu.quality.defect', path: '/quality/defect' },
    { code: 'QC_REWORK_INSPECT', labelKey: 'menu.quality.reworkInspect', path: '/quality/rework-inspect' },
    { code: 'QC_INSPECT', labelKey: 'menu.quality.inspect', path: '/quality/inspect' },
    { code: 'QC_SAMPLE_INSPECT', labelKey: 'menu.production.sampleInspect', path: '/production/sample-inspect' },
    { code: 'QC_OQC', labelKey: 'menu.quality.oqc', path: '/quality/oqc' },
    { code: 'QC_OQC_HISTORY', labelKey: 'menu.quality.oqcHistory', path: '/quality/oqc-history' },
    { code: 'QC_TRACE', labelKey: 'menu.quality.trace', path: '/quality/trace' },
    { code: 'QC_CHANGE', labelKey: 'menu.quality.changeControl', path: '/quality/change-control' },
    { code: 'QC_COMPLAINT', labelKey: 'menu.quality.complaint', path: '/quality/complaint' },
    { code: 'QC_CAPA', labelKey: 'menu.quality.capa', path: '/quality/capa' },
    { code: 'QC_FAI', labelKey: 'menu.quality.fai', path: '/quality/fai' },
    { code: 'QC_PPAP', labelKey: 'menu.quality.ppap', path: '/quality/ppap' },
    { code: 'QC_SPC', labelKey: 'menu.quality.spc', path: '/quality/spc' },
    { code: 'QC_CONTROL_PLAN', labelKey: 'menu.quality.controlPlan', path: '/quality/control-plan' },
    { code: 'QC_AUDIT', labelKey: 'menu.quality.audit', path: '/quality/audit' },
    { code: 'SYS_TRAINING', labelKey: 'menu.system.training', path: '/system/training' },
  ]},
  { code: 'EQUIPMENT', labelKey: 'menu.equipment', icon: 'Wrench', children: [
    { code: 'EQ_MOLD_MGMT', labelKey: 'menu.equipment.mold', path: '/equipment/mold-mgmt' },
    { code: 'EQUIP_INSPECT_ITEM_MASTER', labelKey: 'menu.equipment.inspectItemMaster', path: '/master/equip-inspect-item' },
    { code: 'EQUIP_INSPECT_ITEM', labelKey: 'menu.master.equipInspect', path: '/master/equip-inspect' },
    { code: 'EQUIP_INSPECT_CALENDAR', labelKey: 'menu.equipment.dailyInspectCalendar', path: '/equipment/inspect-calendar' },
    { code: 'EQUIP_DAILY', labelKey: 'menu.equipment.dailyInspect', path: '/equipment/daily-inspect' },
    { code: 'EQUIP_PERIODIC_CALENDAR', labelKey: 'menu.equipment.periodicInspectCalendar', path: '/equipment/periodic-inspect-calendar' },
    { code: 'EQUIP_PERIODIC', labelKey: 'menu.equipment.periodicInspect', path: '/equipment/periodic-inspect' },
    { code: 'EQUIP_HISTORY', labelKey: 'menu.equipment.inspectHistory', path: '/equipment/inspect-history' },
    { code: 'EQUIP_PM_PLAN', labelKey: 'menu.equipment.pmPlan', path: '/equipment/pm-plan' },
    { code: 'EQUIP_PM_CALENDAR', labelKey: 'menu.equipment.pmCalendar', path: '/equipment/pm-calendar' },
    { code: 'EQUIP_PM_RESULT', labelKey: 'menu.equipment.pmResult', path: '/equipment/pm-result' },
  ]},
  { code: 'GAUGE_MGMT', labelKey: 'menu.gauge', icon: 'Ruler', children: [
    { code: 'GAUGE_MASTER', labelKey: 'menu.gauge.master', path: '/master/gauge' },
    { code: 'GAUGE_CALIBRATION', labelKey: 'menu.gauge.calibration', path: '/quality/msa' },
    { code: 'GAUGE_CALIBRATION_HISTORY', labelKey: 'menu.gauge.calibrationHistory', path: '/equipment/calibration-history' },
  ]},
  { code: 'SHIPPING', labelKey: 'menu.shipping', icon: 'Truck', children: [
    { code: 'SHIP_PACK_RESULT', labelKey: 'menu.production.packResult', path: '/production/pack-result' },
    { code: 'SHIP_PACK', labelKey: 'menu.shipping.pack', path: '/shipping/pack' },
    { code: 'SHIP_PALLET', labelKey: 'menu.shipping.pallet', path: '/shipping/pallet' },
    { code: 'SHIP_CONFIRM', labelKey: 'menu.shipping.confirm', path: '/shipping/confirm' },
    { code: 'SHIP_ORDER', labelKey: 'menu.shipping.order', path: '/shipping/order' },
    { code: 'SHIP_HISTORY', labelKey: 'menu.shipping.history', path: '/shipping/history' },
    { code: 'SHIP_RETURN', labelKey: 'menu.shipping.return', path: '/shipping/return' },
    { code: 'SHIP_CUST_PO', labelKey: 'menu.shipping.customerPo', path: '/shipping/customer-po' },
    { code: 'SHIP_CUST_PO_STATUS', labelKey: 'menu.shipping.customerPoStatus', path: '/shipping/customer-po-status' },
  ]},
  { code: 'CUSTOMS', labelKey: 'menu.customs', icon: 'FileBox', children: [
    { code: 'CUST_ENTRY', labelKey: 'menu.customs.entry', path: '/customs/entry' },
    { code: 'CUST_STOCK', labelKey: 'menu.customs.stock', path: '/customs/stock' },
    { code: 'CUST_USAGE', labelKey: 'menu.customs.usage', path: '/customs/usage' },
  ]},
  { code: 'CONSUMABLES', labelKey: 'menu.consumables', icon: 'Cog', children: [
    { code: 'CONS_MASTER', labelKey: 'menu.consumables.master', path: '/consumables/master' },
    { code: 'CONS_LABEL', labelKey: 'menu.consumables.label', path: '/consumables/label' },
    { code: 'CONS_RECEIVING', labelKey: 'menu.consumables.receiving', path: '/consumables/receiving' },
    { code: 'CONS_ISSUING', labelKey: 'menu.consumables.issuing', path: '/consumables/issuing' },
    { code: 'CONS_STOCK', labelKey: 'menu.consumables.stock', path: '/consumables/stock' },
    { code: 'CONS_LIFE', labelKey: 'menu.consumables.life', path: '/consumables/life' },
  ]},
  { code: 'OUTSOURCING', labelKey: 'menu.outsourcing', icon: 'Building2', children: [
    { code: 'OUT_VENDOR', labelKey: 'menu.outsourcing.vendor', path: '/outsourcing/vendor' },
    { code: 'OUT_ORDER', labelKey: 'menu.outsourcing.order', path: '/outsourcing/order' },
    { code: 'OUT_RECEIVE', labelKey: 'menu.outsourcing.receive', path: '/outsourcing/receive' },
  ]},
  { code: 'INTERFACE', labelKey: 'menu.interface', icon: 'ArrowLeftRight', children: [
    { code: 'IF_DASHBOARD', labelKey: 'menu.interface.dashboard', path: '/interface/dashboard' },
    { code: 'IF_LOG', labelKey: 'menu.interface.log', path: '/interface/log' },
    { code: 'IF_MANUAL', labelKey: 'menu.interface.manual', path: '/interface/manual' },
  ]},
  { code: 'SYSTEM', labelKey: 'menu.system', icon: 'UserCog', children: [
    { code: 'SYS_COMPANY', labelKey: 'menu.master.company', path: '/master/company' },
    { code: 'SYS_DEPT', labelKey: 'menu.system.department', path: '/system/department' },
    { code: 'SYS_USER', labelKey: 'menu.system.users', path: '/system/users' },
    { code: 'SYS_ROLE', labelKey: 'menu.system.roles', path: '/system/roles' },
    { code: 'SYS_PDA_ROLE', labelKey: 'menu.system.pdaRoles', path: '/system/pda-roles' },
    { code: 'SYS_COMM', labelKey: 'menu.system.commConfig', path: '/system/comm-config' },
    { code: 'SYS_CONFIG', labelKey: 'menu.system.config', path: '/system/config' },
    { code: 'SYS_CODE', labelKey: 'menu.master.code', path: '/master/code' },
    { code: 'SYS_SCHEDULER', labelKey: 'scheduler.title', path: '/system/scheduler' },
  ]},
];

function buildDoc() {
  const coverSection = {
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ spacing: { before: 4000 }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'HARNESS MES', font: 'Arial', size: 56, bold: true, color: C.primary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Manufacturing Execution System', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '\uBA54\uB274\uAD6C\uC131\uB3C4', font: 'Arial', size: 48, bold: true, color: '333333' })] }),
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      new Table({
        width: { size: 5000, type: WidthType.DXA }, columnWidths: [2000, 3000],
        rows: [['프로젝트명', 'HARNESS MES'], ['산출물명', '메뉴구성도'], ['버전', 'v1.0'], ['작성일', '2026-03-18'], ['작성자', 'HANES MES팀']].map(([k, v]) =>
          new TableRow({ children: [c(k, 2000, { bold: true, shading: C.hdr, align: AlignmentType.CENTER }), c(v, 3000)] })
        ),
      }),
    ],
  };

  const body = [];

  // 개정이력 + 목차
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '\uAC1C\uC815\uC774\uB825', font: 'Arial' })] }),
    dataTbl(['버전', '일자', '작성자', '변경내용'], [['1.0', '2026-03-18', 'HANES MES팀', '최초 작성']], [1500, 1500, 2000, 8440]),
    pb(),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '\uBAA9\uCC28', font: 'Arial' })] }),
    new TableOfContents('TOC', { hyperlink: true, headingStyleRange: '1-3' }),
    pb(),
  );

  // 1. 개요
  body.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '1. \uAC1C\uC694', font: 'Arial' })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '\uBCF8 \uBB38\uC11C\uB294 HARNESS MES \uC2DC\uC2A4\uD15C\uC758 \uC804\uCCB4 \uBA54\uB274 \uAD6C\uC131\uC744 \uC815\uC758\uD55C\uB2E4. \uB300\uBA54\uB274 ' + menus.length + '\uAC1C, \uC18C\uBA54\uB274 ' + menus.reduce((s, m) => s + m.children.length, 0) + '\uAC1C\uB85C \uAD6C\uC131\uB418\uBA70, RBAC \uAD8C\uD55C \uCCB4\uACC4\uC640 \uC5F0\uB3D9\uB41C\uB2E4.', font: 'Arial', size: 20 })] }),
    pb(),
  );

  // 2. 메뉴 트리
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '2. \uBA54\uB274 \uD2B8\uB9AC \uAD6C\uC870', font: 'Arial' })] }));
  menus.forEach(m => {
    const parentLabel = L(m.labelKey);
    body.push(new Paragraph({
      spacing: { before: 120, after: 40 },
      children: [new TextRun({ text: `\u25A0 ${parentLabel}`, font: 'Arial', size: 20, bold: true, color: C.primary })],
    }));
    if (m.path) {
      body.push(new Paragraph({ indent: { left: 500 }, spacing: { after: 20 }, children: [new TextRun({ text: m.path, font: 'Consolas', size: 16, color: '888888' })] }));
    }
    m.children.forEach((ch, i) => {
      const prefix = i === m.children.length - 1 ? '\u2514\u2500 ' : '\u251C\u2500 ';
      body.push(new Paragraph({
        indent: { left: 500 }, spacing: { before: 10, after: 10 },
        children: [
          new TextRun({ text: prefix + L(ch.labelKey), font: 'Arial', size: 17 }),
          new TextRun({ text: '  ' + (ch.path || ''), font: 'Consolas', size: 14, color: '999999' }),
        ],
      }));
    });
  });
  body.push(pb());

  // 3. 메뉴 목록 상세
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '3. \uBA54\uB274 \uBAA9\uB85D \uC0C1\uC138', font: 'Arial' })] }));
  let no = 0;
  const listWidths = [500, 1800, 2200, 2400, 1600, 3000, 1940];
  const listData = [];
  menus.forEach(m => {
    const parentLabel = L(m.labelKey);
    if (m.children.length === 0) {
      no++;
      listData.push([String(no), parentLabel, '-', m.code, m.icon || '-', m.path || '-', '단독 메뉴']);
    } else {
      m.children.forEach(ch => {
        no++;
        listData.push([String(no), parentLabel, L(ch.labelKey), ch.code, '-', ch.path || '-', '']);
      });
    }
  });
  body.push(dataTbl(['No', '대메뉴', '소메뉴', '메뉴코드', '아이콘', '경로', '비고'], listData, listWidths));
  body.push(pb());

  // 4. 통계
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '4. \uBA54\uB274 \uD1B5\uACC4', font: 'Arial' })] }));
  const statsWidths = [500, 2500, 1500, 8940];
  const statsData = menus.map((m, i) => [
    String(i + 1),
    L(m.labelKey),
    m.children.length === 0 ? '1 (단독)' : String(m.children.length),
    m.icon || '-',
  ]);
  statsData.push(['', '합계', String(menus.reduce((s, m) => s + Math.max(m.children.length, 1), 0)), '']);
  body.push(dataTbl(['No', '대메뉴', '소메뉴 수', '아이콘'], statsData, statsWidths));

  const bodySection = {
    properties: { page: { size: { width: 11906, height: 16838, orientation: 'landscape' }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'HARNESS MES - \uBA54\uB274\uAD6C\uC131\uB3C4', font: 'Arial', size: 16, color: '999999' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' })] })] }) },
    children: body,
  };

  return new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: 'Arial', color: C.primary }, paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Arial', color: '333333' }, paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 } },
      ],
    },
    sections: [coverSection, bodySection],
  });
}

async function main() {
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync('docs/deliverables/system', { recursive: true });
  const outPath = 'docs/deliverables/system/메뉴구성도_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);
