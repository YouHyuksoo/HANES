"use client";

/**
 * @file src/components/layout/Sidebar.tsx
 * @description 사이드바 네비게이션 - 접기/펴기 핸들 포함
 *
 * 초보자 가이드:
 * 1. **메뉴 구조**: 대시보드 → 기준정보 → 8대 공정 순서
 * 2. **접기/펴기**: 우측 가장자리 핸들로 사이드바 축소/확장
 * 3. **접힌 상태**: 아이콘만 표시, 호버 시 툴팁
 */
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Package, Factory, ScanLine, Shield, Wrench, Truck, Database,
  FileBox, Cog, Building2, ArrowLeftRight, Warehouse, UserCog, ClipboardCheck,
  ShoppingCart,
} from "lucide-react";
import SidebarMenu from "./SidebarMenu";

export interface MenuItem {
  id: string;
  labelKey: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { id: string; labelKey: string; path: string }[];
}

export const menuItems: MenuItem[] = [
  { id: "dashboard", labelKey: "menu.dashboard", path: "/dashboard", icon: LayoutDashboard },
  {
    id: "master", labelKey: "menu.master", icon: Database,
    children: [
      { id: "mst-part", labelKey: "menu.master.part", path: "/master/part" },
      { id: "mst-bom", labelKey: "menu.master.bom", path: "/master/bom" },

      { id: "mst-partner", labelKey: "menu.master.partner", path: "/master/partner" },
      { id: "mst-prod-line", labelKey: "menu.master.prodLine", path: "/master/prod-line" },
      { id: "mst-worker", labelKey: "menu.master.worker", path: "/master/worker" },


      { id: "mst-work-inst", labelKey: "menu.master.workInstruction", path: "/master/work-instruction" },
      { id: "mst-warehouse", labelKey: "menu.master.warehouse", path: "/master/warehouse" },

      { id: "mst-label", labelKey: "menu.master.label", path: "/master/label" },
      { id: "mst-vendor-barcode", labelKey: "menu.master.vendorBarcode", path: "/master/vendor-barcode" },
    ],
  },
  {
    id: "inventory", labelKey: "menu.matInventory", icon: Warehouse,
    children: [
      { id: "inv-mat-stock", labelKey: "menu.inventory.matStock", path: "/inventory/material-stock" },
      { id: "inv-transaction", labelKey: "menu.inventory.transaction", path: "/inventory/transaction" },
      { id: "inv-lot", labelKey: "menu.inventory.lot", path: "/inventory/lot" },
      { id: "inv-mat-physical-inv", labelKey: "menu.inventory.matPhysicalInv", path: "/inventory/material-physical-inv" },
      { id: "inv-mat-physical-inv-history", labelKey: "menu.inventory.matPhysicalInvHistory", path: "/inventory/material-physical-inv-history" },
      { id: "inv-arrival-stock", labelKey: "menu.inventory.arrivalStock", path: "/material/arrival-stock" },
    ],
  },
  {
    id: "product-inventory", labelKey: "menu.productInventory", icon: ClipboardCheck,
    children: [
      { id: "inv-stock", labelKey: "menu.inventory.productStock", path: "/inventory/stock" },
      { id: "inv-product-physical-inv", labelKey: "menu.inventory.productPhysicalInv", path: "/inventory/product-physical-inv" },
      { id: "inv-product-physical-inv-history", labelKey: "menu.inventory.productPhysicalInvHistory", path: "/inventory/product-physical-inv-history" },
    ],
  },
  {
    id: "material", labelKey: "menu.material", icon: Package,
    children: [
      { id: "mat-arrival", labelKey: "menu.material.arrival", path: "/material/arrival" },
      { id: "mat-receive-label", labelKey: "menu.material.receiveLabel", path: "/material/receive-label" },
      { id: "mat-receive", labelKey: "menu.material.receive", path: "/material/receive" },
      { id: "mat-request", labelKey: "menu.material.request", path: "/material/request" },
      { id: "mat-issue", labelKey: "menu.material.issue", path: "/material/issue" },
      { id: "mat-lot", labelKey: "menu.material.lot", path: "/material/lot" },
      { id: "mat-lot-split", labelKey: "menu.material.lotSplit", path: "/material/lot-split" },
      { id: "mat-lot-merge", labelKey: "menu.material.lotMerge", path: "/material/lot-merge" },
      { id: "mat-shelf-life", labelKey: "menu.material.shelfLife", path: "/material/shelf-life" },
      { id: "mat-hold", labelKey: "menu.material.hold", path: "/material/hold" },
      { id: "mat-scrap", labelKey: "menu.material.scrap", path: "/material/scrap" },
      { id: "mat-adjustment", labelKey: "menu.material.adjustment", path: "/material/adjustment" },
      { id: "mat-misc-receipt", labelKey: "menu.material.miscReceipt", path: "/material/misc-receipt" },
      { id: "mat-receipt-cancel", labelKey: "menu.material.receiptCancel", path: "/material/receipt-cancel" },
    ],
  },
  {
    id: "purchasing", labelKey: "menu.purchasing", icon: ShoppingCart,
    children: [
      { id: "pur-po", labelKey: "menu.purchasing.po", path: "/material/po" },
      { id: "pur-po-status", labelKey: "menu.purchasing.poStatus", path: "/material/po-status" },
    ],
  },
  {
    id: "production", labelKey: "menu.production", icon: Factory,
    children: [
      { id: "prod-order", labelKey: "menu.production.order", path: "/production/order" },
      { id: "prod-result", labelKey: "menu.production.result", path: "/production/result" },
      { id: "prod-progress", labelKey: "menu.production.progress", path: "/production/progress" },
      { id: "prod-input-manual", labelKey: "menu.production.inputManual", path: "/production/input-manual" },
      { id: "prod-input-machine", labelKey: "menu.production.inputMachine", path: "/production/input-machine" },
      { id: "prod-input-inspect", labelKey: "menu.production.inputInspect", path: "/production/input-inspect" },
      { id: "prod-input-equip", labelKey: "menu.production.inputEquip", path: "/production/input-equip" },
      { id: "prod-sample-inspect", labelKey: "menu.production.sampleInspect", path: "/production/sample-inspect" },
      { id: "prod-result-summary", labelKey: "menu.production.resultSummary", path: "/production/result-summary" },
      { id: "prod-pack-result", labelKey: "menu.production.packResult", path: "/production/pack-result" },
      { id: "prod-wip-stock", labelKey: "menu.production.wipStock", path: "/production/wip-stock" },
    ],
  },
  {
    id: "inspection", labelKey: "menu.inspection", icon: ScanLine,
    children: [
      { id: "insp-result", labelKey: "menu.inspection.result", path: "/inspection/result" },
      { id: "insp-equip", labelKey: "menu.inspection.equip", path: "/inspection/equip" },
    ],
  },
  {
    id: "quality", labelKey: "menu.quality", icon: Shield,
    children: [
      { id: "qc-iqc", labelKey: "menu.material.iqc", path: "/material/iqc" },
      { id: "qc-iqc-history", labelKey: "menu.material.iqcHistory", path: "/material/iqc-history" },
      { id: "qc-defect", labelKey: "menu.quality.defect", path: "/quality/defect" },
      { id: "qc-inspect", labelKey: "menu.quality.inspect", path: "/quality/inspect" },
      { id: "qc-trace", labelKey: "menu.quality.trace", path: "/quality/trace" },
      { id: "qc-iqc-item", labelKey: "menu.master.iqcItem", path: "/master/iqc-item" },
      { id: "qc-oqc", labelKey: "menu.quality.oqc", path: "/quality/oqc" },
      { id: "qc-oqc-history", labelKey: "menu.quality.oqcHistory", path: "/quality/oqc-history" },
    ],
  },
  {
    id: "equipment", labelKey: "menu.equipment", icon: Wrench,
    children: [
      { id: "equip-master", labelKey: "menu.equipment.master", path: "/master/equip" },
      { id: "equip-status", labelKey: "menu.equipment.status", path: "/equipment/status" },
      { id: "equip-pm", labelKey: "menu.equipment.pm", path: "/equipment/pm" },
      { id: "equip-daily", labelKey: "menu.equipment.dailyInspect", path: "/equipment/daily-inspect" },
      { id: "equip-periodic", labelKey: "menu.equipment.periodicInspect", path: "/equipment/periodic-inspect" },
      { id: "equip-history", labelKey: "menu.equipment.inspectHistory", path: "/equipment/inspect-history" },
      { id: "equip-mold", labelKey: "menu.equipment.mold", path: "/equipment/mold" },
      { id: "equip-inspect-item", labelKey: "menu.master.equipInspect", path: "/master/equip-inspect" },
    ],
  },
  {
    id: "shipping", labelKey: "menu.shipping", icon: Truck,
    children: [
      { id: "ship-pack", labelKey: "menu.shipping.pack", path: "/shipping/pack" },
      { id: "ship-pallet", labelKey: "menu.shipping.pallet", path: "/shipping/pallet" },
      { id: "ship-confirm", labelKey: "menu.shipping.confirm", path: "/shipping/confirm" },
      { id: "ship-order", labelKey: "menu.shipping.order", path: "/shipping/order" },
      { id: "ship-history", labelKey: "menu.shipping.history", path: "/shipping/history" },
      { id: "ship-return", labelKey: "menu.shipping.return", path: "/shipping/return" },
      { id: "ship-cust-po", labelKey: "menu.shipping.customerPo", path: "/shipping/customer-po" },
      { id: "ship-cust-po-status", labelKey: "menu.shipping.customerPoStatus", path: "/shipping/customer-po-status" },
    ],
  },
  {
    id: "customs", labelKey: "menu.customs", icon: FileBox,
    children: [
      { id: "cust-entry", labelKey: "menu.customs.entry", path: "/customs/entry" },
      { id: "cust-stock", labelKey: "menu.customs.stock", path: "/customs/stock" },
      { id: "cust-usage", labelKey: "menu.customs.usage", path: "/customs/usage" },
    ],
  },
  {
    id: "consumables", labelKey: "menu.consumables", icon: Cog,
    children: [
      { id: "cons-master", labelKey: "menu.consumables.master", path: "/consumables/master" },
      { id: "cons-receiving", labelKey: "menu.consumables.receiving", path: "/consumables/receiving" },
      { id: "cons-issuing", labelKey: "menu.consumables.issuing", path: "/consumables/issuing" },
      { id: "cons-stock", labelKey: "menu.consumables.stock", path: "/consumables/stock" },
      { id: "cons-life", labelKey: "menu.consumables.life", path: "/consumables/life" },
    ],
  },
  {
    id: "outsourcing", labelKey: "menu.outsourcing", icon: Building2,
    children: [
      { id: "out-vendor", labelKey: "menu.outsourcing.vendor", path: "/outsourcing/vendor" },
      { id: "out-order", labelKey: "menu.outsourcing.order", path: "/outsourcing/order" },
      { id: "out-receive", labelKey: "menu.outsourcing.receive", path: "/outsourcing/receive" },
    ],
  },
  {
    id: "interface", labelKey: "menu.interface", icon: ArrowLeftRight,
    children: [
      { id: "if-dashboard", labelKey: "menu.interface.dashboard", path: "/interface/dashboard" },
      { id: "if-log", labelKey: "menu.interface.log", path: "/interface/log" },
      { id: "if-manual", labelKey: "menu.interface.manual", path: "/interface/manual" },
    ],
  },
  {
    id: "system", labelKey: "menu.system", icon: UserCog,
    children: [
      { id: "sys-company", labelKey: "menu.master.company", path: "/master/company" },
      { id: "sys-dept", labelKey: "menu.system.department", path: "/system/department" },
      { id: "sys-user", labelKey: "menu.system.users", path: "/system/users" },
      { id: "sys-comm", labelKey: "menu.system.commConfig", path: "/system/comm-config" },
      { id: "sys-config", labelKey: "menu.system.config", path: "/system/config" },
      { id: "sys-code", labelKey: "menu.master.code", path: "/master/code" },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["dashboard"]);

  const toggleMenu = (menuId: string) => {
    if (collapsed) return;
    setExpandedMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  };

  const isMenuActive = (item: MenuItem) => {
    if (item.path) return pathname === item.path;
    return item.children?.some((child) => pathname === child.path);
  };

  const sidebarWidth = collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)";

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-[var(--header-height)] left-0 z-30
          h-[calc(100vh-var(--header-height))]
          bg-surface border-r border-border
          overflow-y-auto overflow-x-hidden
          transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ width: sidebarWidth }}
      >
        <nav className="p-3">
          <SidebarMenu
            items={menuItems}
            collapsed={collapsed}
            pathname={pathname}
            expandedMenus={expandedMenus}
            onToggleMenu={toggleMenu}
            isMenuActive={isMenuActive}
            onClose={onClose}
            t={t}
          />
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
