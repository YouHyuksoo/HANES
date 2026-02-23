/**
 * @file src/config/menuConfig.ts
 * @description 사이드바 메뉴 설정 - RBAC 권한 관리용 고유 코드 포함
 *
 * 초보자 가이드:
 * 1. **MenuConfigItem**: 메뉴 항목 인터페이스 (code, labelKey, path, icon, children)
 * 2. **code**: RBAC 권한 체크에 사용되는 고유 코드 (대문자_언더스코어)
 * 3. **유틸 함수**: getAllMenuCodes, findMenuCodeByPath, getParentCodes
 * 4. 새 메뉴 추가 시 반드시 고유 code를 부여할 것
 */
import {
  LayoutDashboard, Package, Factory, ScanLine, Shield, Wrench, Truck,
  Database, FileBox, Cog, Building2, ArrowLeftRight, Warehouse, UserCog,
  ClipboardCheck, ShoppingCart, Monitor, PackageCheck,
} from "lucide-react";

/** 메뉴 설정 항목 인터페이스 */
export interface MenuConfigItem {
  /** RBAC 권한 체크용 고유 코드 (대문자_언더스코어) */
  code: string;
  /** i18n 번역 키 */
  labelKey: string;
  /** 라우트 경로 (하위 메뉴가 있는 경우 생략 가능) */
  path?: string;
  /** 아이콘 컴포넌트 (최상위 메뉴만 사용) */
  icon?: React.ComponentType<{ className?: string }>;
  /** 하위 메뉴 항목 */
  children?: MenuConfigItem[];
}

/** 사이드바 메뉴 설정 배열 */
export const menuConfig: MenuConfigItem[] = [
  {
    code: "DASHBOARD",
    labelKey: "menu.dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    code: "MONITORING",
    labelKey: "menu.monitoring",
    icon: Monitor,
    children: [
      { code: "MON_EQUIP_STATUS", labelKey: "menu.equipment.status", path: "/equipment/status" },
    ],
  },
  {
    code: "MASTER",
    labelKey: "menu.master",
    icon: Database,
    children: [
      { code: "MST_PART", labelKey: "menu.master.part", path: "/master/part" },
      { code: "MST_BOM", labelKey: "menu.master.bom", path: "/master/bom" },
      { code: "MST_PARTNER", labelKey: "menu.master.partner", path: "/master/partner" },
      { code: "MST_PROD_LINE", labelKey: "menu.master.prodLine", path: "/master/prod-line" },
      { code: "MST_WORKER", labelKey: "menu.master.worker", path: "/master/worker" },
      { code: "MST_WORK_INST", labelKey: "menu.master.workInstruction", path: "/master/work-instruction" },
      { code: "MST_WAREHOUSE", labelKey: "menu.master.warehouse", path: "/master/warehouse" },
      { code: "MST_LABEL", labelKey: "menu.master.label", path: "/master/label" },
      { code: "MST_VENDOR_BARCODE", labelKey: "menu.master.vendorBarcode", path: "/master/vendor-barcode" },
    ],
  },
  {
    code: "INVENTORY",
    labelKey: "menu.matInventory",
    icon: Warehouse,
    children: [
      { code: "INV_MAT_STOCK", labelKey: "menu.inventory.matStock", path: "/inventory/material-stock" },
      { code: "INV_TRANSACTION", labelKey: "menu.inventory.transaction", path: "/inventory/transaction" },
      { code: "INV_LOT", labelKey: "menu.inventory.lot", path: "/inventory/lot" },
      { code: "INV_MAT_PHYSICAL_INV", labelKey: "menu.inventory.matPhysicalInv", path: "/inventory/material-physical-inv" },
      { code: "INV_MAT_PHYSICAL_INV_HISTORY", labelKey: "menu.inventory.matPhysicalInvHistory", path: "/inventory/material-physical-inv-history" },
      { code: "INV_ARRIVAL_STOCK", labelKey: "menu.inventory.arrivalStock", path: "/material/arrival-stock" },
      { code: "MAT_HOLD", labelKey: "menu.material.hold", path: "/material/hold" },
    ],
  },
  {
    code: "PRODUCT_INVENTORY",
    labelKey: "menu.productInventory",
    icon: ClipboardCheck,
    children: [
      { code: "INV_PRODUCT_STOCK", labelKey: "menu.inventory.productStock", path: "/inventory/stock" },
      { code: "INV_PRODUCT_PHYSICAL_INV", labelKey: "menu.inventory.productPhysicalInv", path: "/inventory/product-physical-inv" },
      { code: "INV_PRODUCT_PHYSICAL_INV_HISTORY", labelKey: "menu.inventory.productPhysicalInvHistory", path: "/inventory/product-physical-inv-history" },
      { code: "PROD_HOLD", labelKey: "menu.productInventory.hold", path: "/inventory/product-hold" },
    ],
  },
  {
    code: "PRODUCT_MGMT",
    labelKey: "menu.productMgmt",
    icon: PackageCheck,
    children: [
      { code: "PROD_RECEIVE", labelKey: "menu.productMgmt.receive", path: "/product/receive" },
      { code: "PROD_RECEIPT_CANCEL", labelKey: "menu.productMgmt.receiptCancel", path: "/product/receipt-cancel" },
    ],
  },
  {
    code: "MATERIAL",
    labelKey: "menu.material",
    icon: Package,
    children: [
      { code: "MAT_ARRIVAL", labelKey: "menu.material.arrival", path: "/material/arrival" },
      { code: "MAT_RECEIVE_LABEL", labelKey: "menu.material.receiveLabel", path: "/material/receive-label" },
      { code: "MAT_RECEIVE", labelKey: "menu.material.receive", path: "/material/receive" },
      { code: "MAT_REQUEST", labelKey: "menu.material.request", path: "/material/request" },
      { code: "MAT_ISSUE", labelKey: "menu.material.issue", path: "/material/issue" },
      { code: "MAT_LOT", labelKey: "menu.material.lot", path: "/material/lot" },
      { code: "MAT_LOT_SPLIT", labelKey: "menu.material.lotSplit", path: "/material/lot-split" },
      { code: "MAT_LOT_MERGE", labelKey: "menu.material.lotMerge", path: "/material/lot-merge" },
      { code: "MAT_SHELF_LIFE", labelKey: "menu.material.shelfLife", path: "/material/shelf-life" },
      { code: "MAT_SCRAP", labelKey: "menu.material.scrap", path: "/material/scrap" },
      { code: "MAT_ADJUSTMENT", labelKey: "menu.material.adjustment", path: "/material/adjustment" },
      { code: "MAT_MISC_RECEIPT", labelKey: "menu.material.miscReceipt", path: "/material/misc-receipt" },
      { code: "MAT_RECEIPT_CANCEL", labelKey: "menu.material.receiptCancel", path: "/material/receipt-cancel" },
    ],
  },
  {
    code: "PURCHASING",
    labelKey: "menu.purchasing",
    icon: ShoppingCart,
    children: [
      { code: "PUR_PO", labelKey: "menu.purchasing.po", path: "/material/po" },
      { code: "PUR_PO_STATUS", labelKey: "menu.purchasing.poStatus", path: "/material/po-status" },
    ],
  },
  {
    code: "PRODUCTION",
    labelKey: "menu.production",
    icon: Factory,
    children: [
      { code: "PROD_ORDER", labelKey: "menu.production.order", path: "/production/order" },
      { code: "PROD_RESULT", labelKey: "menu.production.result", path: "/production/result" },
      { code: "PROD_PROGRESS", labelKey: "menu.production.progress", path: "/production/progress" },
      { code: "PROD_INPUT_MANUAL", labelKey: "menu.production.inputManual", path: "/production/input-manual" },
      { code: "PROD_INPUT_MACHINE", labelKey: "menu.production.inputMachine", path: "/production/input-machine" },
      { code: "PROD_INPUT_INSPECT", labelKey: "menu.production.inputInspect", path: "/production/input-inspect" },
      { code: "PROD_INPUT_EQUIP", labelKey: "menu.production.inputEquip", path: "/production/input-equip" },
      { code: "PROD_RESULT_SUMMARY", labelKey: "menu.production.resultSummary", path: "/production/result-summary" },
      { code: "PROD_WIP_STOCK", labelKey: "menu.production.wipStock", path: "/production/wip-stock" },
    ],
  },
  {
    code: "INSPECTION",
    labelKey: "menu.inspection",
    icon: ScanLine,
    children: [
      { code: "INSP_RESULT", labelKey: "menu.inspection.result", path: "/inspection/result" },
      { code: "INSP_EQUIP", labelKey: "menu.inspection.equip", path: "/inspection/equip" },
    ],
  },
  {
    code: "QUALITY",
    labelKey: "menu.quality",
    icon: Shield,
    children: [
      { code: "QC_IQC_ITEM", labelKey: "menu.master.iqcItem", path: "/master/iqc-item" },
      { code: "QC_IQC", labelKey: "menu.material.iqc", path: "/material/iqc" },
      { code: "QC_IQC_HISTORY", labelKey: "menu.material.iqcHistory", path: "/material/iqc-history" },
      { code: "QC_DEFECT", labelKey: "menu.quality.defect", path: "/quality/defect" },
      { code: "QC_INSPECT", labelKey: "menu.quality.inspect", path: "/quality/inspect" },
      { code: "QC_SAMPLE_INSPECT", labelKey: "menu.production.sampleInspect", path: "/production/sample-inspect" },
      { code: "QC_OQC", labelKey: "menu.quality.oqc", path: "/quality/oqc" },
      { code: "QC_OQC_HISTORY", labelKey: "menu.quality.oqcHistory", path: "/quality/oqc-history" },
      { code: "QC_TRACE", labelKey: "menu.quality.trace", path: "/quality/trace" },
    ],
  },
  {
    code: "EQUIPMENT",
    labelKey: "menu.equipment",
    icon: Wrench,
    children: [
      { code: "EQUIP_MASTER", labelKey: "menu.equipment.master", path: "/master/equip" },
      { code: "EQUIP_PM_PLAN", labelKey: "menu.equipment.pmPlan", path: "/equipment/pm-plan" },
      { code: "EQUIP_PM", labelKey: "menu.equipment.pm", path: "/equipment/pm" },
      { code: "EQUIP_PM_CALENDAR", labelKey: "menu.equipment.pmCalendar", path: "/equipment/pm-calendar" },
      { code: "EQUIP_INSPECT_CALENDAR", labelKey: "menu.equipment.dailyInspectCalendar", path: "/equipment/inspect-calendar" },
      { code: "EQUIP_PERIODIC_CALENDAR", labelKey: "menu.equipment.periodicInspectCalendar", path: "/equipment/periodic-inspect-calendar" },
      { code: "EQUIP_DAILY", labelKey: "menu.equipment.dailyInspect", path: "/equipment/daily-inspect" },
      { code: "EQUIP_PERIODIC", labelKey: "menu.equipment.periodicInspect", path: "/equipment/periodic-inspect" },
      { code: "EQUIP_HISTORY", labelKey: "menu.equipment.inspectHistory", path: "/equipment/inspect-history" },
      { code: "EQUIP_MOLD", labelKey: "menu.equipment.mold", path: "/equipment/mold" },
      { code: "EQUIP_INSPECT_ITEM", labelKey: "menu.master.equipInspect", path: "/master/equip-inspect" },
    ],
  },
  {
    code: "SHIPPING",
    labelKey: "menu.shipping",
    icon: Truck,
    children: [
      { code: "SHIP_PACK_RESULT", labelKey: "menu.production.packResult", path: "/production/pack-result" },
      { code: "SHIP_PACK", labelKey: "menu.shipping.pack", path: "/shipping/pack" },
      { code: "SHIP_PALLET", labelKey: "menu.shipping.pallet", path: "/shipping/pallet" },
      { code: "SHIP_CONFIRM", labelKey: "menu.shipping.confirm", path: "/shipping/confirm" },
      { code: "SHIP_ORDER", labelKey: "menu.shipping.order", path: "/shipping/order" },
      { code: "SHIP_HISTORY", labelKey: "menu.shipping.history", path: "/shipping/history" },
      { code: "SHIP_RETURN", labelKey: "menu.shipping.return", path: "/shipping/return" },
      { code: "SHIP_CUST_PO", labelKey: "menu.shipping.customerPo", path: "/shipping/customer-po" },
      { code: "SHIP_CUST_PO_STATUS", labelKey: "menu.shipping.customerPoStatus", path: "/shipping/customer-po-status" },
    ],
  },
  {
    code: "CUSTOMS",
    labelKey: "menu.customs",
    icon: FileBox,
    children: [
      { code: "CUST_ENTRY", labelKey: "menu.customs.entry", path: "/customs/entry" },
      { code: "CUST_STOCK", labelKey: "menu.customs.stock", path: "/customs/stock" },
      { code: "CUST_USAGE", labelKey: "menu.customs.usage", path: "/customs/usage" },
    ],
  },
  {
    code: "CONSUMABLES",
    labelKey: "menu.consumables",
    icon: Cog,
    children: [
      { code: "CONS_MASTER", labelKey: "menu.consumables.master", path: "/consumables/master" },
      { code: "CONS_RECEIVING", labelKey: "menu.consumables.receiving", path: "/consumables/receiving" },
      { code: "CONS_ISSUING", labelKey: "menu.consumables.issuing", path: "/consumables/issuing" },
      { code: "CONS_STOCK", labelKey: "menu.consumables.stock", path: "/consumables/stock" },
      { code: "CONS_LIFE", labelKey: "menu.consumables.life", path: "/consumables/life" },
    ],
  },
  {
    code: "OUTSOURCING",
    labelKey: "menu.outsourcing",
    icon: Building2,
    children: [
      { code: "OUT_VENDOR", labelKey: "menu.outsourcing.vendor", path: "/outsourcing/vendor" },
      { code: "OUT_ORDER", labelKey: "menu.outsourcing.order", path: "/outsourcing/order" },
      { code: "OUT_RECEIVE", labelKey: "menu.outsourcing.receive", path: "/outsourcing/receive" },
    ],
  },
  {
    code: "INTERFACE",
    labelKey: "menu.interface",
    icon: ArrowLeftRight,
    children: [
      { code: "IF_DASHBOARD", labelKey: "menu.interface.dashboard", path: "/interface/dashboard" },
      { code: "IF_LOG", labelKey: "menu.interface.log", path: "/interface/log" },
      { code: "IF_MANUAL", labelKey: "menu.interface.manual", path: "/interface/manual" },
    ],
  },
  {
    code: "SYSTEM",
    labelKey: "menu.system",
    icon: UserCog,
    children: [
      { code: "SYS_COMPANY", labelKey: "menu.master.company", path: "/master/company" },
      { code: "SYS_DEPT", labelKey: "menu.system.department", path: "/system/department" },
      { code: "SYS_USER", labelKey: "menu.system.users", path: "/system/users" },
      { code: "SYS_ROLE", labelKey: "menu.system.roles", path: "/system/roles" },
      { code: "SYS_COMM", labelKey: "menu.system.commConfig", path: "/system/comm-config" },
      { code: "SYS_CONFIG", labelKey: "menu.system.config", path: "/system/config" },
      { code: "SYS_CODE", labelKey: "menu.master.code", path: "/master/code" },
    ],
  },
];

// ---------------------------------------------------------------------------
// 유틸리티 함수
// ---------------------------------------------------------------------------

/**
 * 모든 메뉴 코드를 플랫하게 추출
 * @returns 최상위 + 하위 메뉴의 code 배열
 */
export function getAllMenuCodes(): string[] {
  const codes: string[] = [];
  for (const item of menuConfig) {
    codes.push(item.code);
    if (item.children) {
      for (const child of item.children) {
        codes.push(child.code);
      }
    }
  }
  return codes;
}

/**
 * path로 메뉴 코드를 찾기
 * @param path - 라우트 경로 (예: "/production/order")
 * @returns 해당 경로의 메뉴 code 또는 undefined
 */
export function findMenuCodeByPath(path: string): string | undefined {
  for (const item of menuConfig) {
    if (item.path === path) return item.code;
    if (item.children) {
      for (const child of item.children) {
        if (child.path === path) return child.code;
      }
    }
  }
  return undefined;
}

/**
 * 허용된 하위 메뉴 코드로부터 부모 코드를 자동 추출
 * @param allowedCodes - 사용자에게 허용된 메뉴 코드 배열
 * @returns 부모 메뉴 코드 배열 (중복 제거)
 */
export function getParentCodes(allowedCodes: string[]): string[] {
  const parentCodes = new Set<string>();
  const codeSet = new Set(allowedCodes);

  for (const item of menuConfig) {
    // 최상위 메뉴 자체가 허용된 경우
    if (codeSet.has(item.code)) {
      parentCodes.add(item.code);
      continue;
    }
    // 하위 메뉴 중 하나라도 허용된 경우 부모 코드 추가
    if (item.children?.some((child) => codeSet.has(child.code))) {
      parentCodes.add(item.code);
    }
  }

  return Array.from(parentCodes);
}
