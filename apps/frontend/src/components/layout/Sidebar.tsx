"use client";

/**
 * @file src/components/layout/Sidebar.tsx
 * @description 사이드바 네비게이션 컴포넌트
 *
 * 초보자 가이드:
 * 1. **메뉴 구조**: 대시보드 -> 기준정보 -> 8대 공정 순서
 * 2. **하위 메뉴**: 클릭 시 펼침/접힘
 * 3. **활성 상태**: 현재 페이지 하이라이트
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Package,
  Scissors,
  Plug,
  Factory,
  ScanLine,
  Shield,
  Wrench,
  Truck,
  Database,
  ChevronDown,
  ChevronRight,
  FileBox,
  Cog,
  Building2,
  ArrowLeftRight,
  Warehouse,
  UserCog,
} from "lucide-react";

interface MenuItem {
  id: string;
  labelKey: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { id: string; labelKey: string; path: string }[];
}

const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    labelKey: "menu.dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "master",
    labelKey: "menu.master",
    icon: Database,
    children: [
      { id: "mst-part", labelKey: "menu.master.part", path: "/master/part" },
      { id: "mst-bom", labelKey: "menu.master.bom", path: "/master/bom" },
      { id: "mst-equip", labelKey: "menu.master.equip", path: "/master/equip" },
      { id: "mst-code", labelKey: "menu.master.code", path: "/master/code" },
      { id: "mst-partner", labelKey: "menu.master.partner", path: "/master/partner" },
      { id: "mst-process", labelKey: "menu.master.process", path: "/master/process" },
      { id: "mst-routing", labelKey: "menu.master.routing", path: "/master/routing" },
      { id: "mst-worker", labelKey: "menu.master.worker", path: "/master/worker" },
      { id: "mst-iqc-item", labelKey: "menu.master.iqcItem", path: "/master/iqc-item" },
      { id: "mst-equip-inspect", labelKey: "menu.master.equipInspect", path: "/master/equip-inspect" },
      { id: "mst-box", labelKey: "menu.master.box", path: "/master/box" },
      { id: "mst-work-inst", labelKey: "menu.master.workInstruction", path: "/master/work-instruction" },
      { id: "mst-transfer-rule", labelKey: "menu.master.transferRule", path: "/master/transfer-rule" },
      { id: "mst-model-suffix", labelKey: "menu.master.modelSuffix", path: "/master/model-suffix" },
    ],
  },
  {
    id: "inventory",
    labelKey: "menu.inventory",
    icon: Warehouse,
    children: [
      { id: "inv-warehouse", labelKey: "menu.inventory.warehouse", path: "/inventory/warehouse" },
      { id: "inv-stock", labelKey: "menu.inventory.stock", path: "/inventory/stock" },
      { id: "inv-transaction", labelKey: "menu.inventory.transaction", path: "/inventory/transaction" },
      { id: "inv-lot", labelKey: "menu.inventory.lot", path: "/inventory/lot" },
    ],
  },
  {
    id: "material",
    labelKey: "menu.material",
    icon: Package,
    children: [
      { id: "mat-arrival", labelKey: "menu.material.arrival", path: "/material/arrival" },
      { id: "mat-iqc", labelKey: "menu.material.iqc", path: "/material/iqc" },
      { id: "mat-receive", labelKey: "menu.material.receive", path: "/material/receive" },
      { id: "mat-request", labelKey: "menu.material.request", path: "/material/request" },
      { id: "mat-issue", labelKey: "menu.material.issue", path: "/material/issue" },
      { id: "mat-stock", labelKey: "menu.material.stock", path: "/material/stock" },
      { id: "mat-lot", labelKey: "menu.material.lot", path: "/material/lot" },
      { id: "mat-po", labelKey: "menu.material.po", path: "/material/po" },
      { id: "mat-po-status", labelKey: "menu.material.poStatus", path: "/material/po-status" },
      { id: "mat-iqc-history", labelKey: "menu.material.iqcHistory", path: "/material/iqc-history" },
      { id: "mat-lot-split", labelKey: "menu.material.lotSplit", path: "/material/lot-split" },
      { id: "mat-shelf-life", labelKey: "menu.material.shelfLife", path: "/material/shelf-life" },
      { id: "mat-hold", labelKey: "menu.material.hold", path: "/material/hold" },
      { id: "mat-scrap", labelKey: "menu.material.scrap", path: "/material/scrap" },
      { id: "mat-adjustment", labelKey: "menu.material.adjustment", path: "/material/adjustment" },
      { id: "mat-misc-receipt", labelKey: "menu.material.miscReceipt", path: "/material/misc-receipt" },
      { id: "mat-physical-inv", labelKey: "menu.material.physicalInv", path: "/material/physical-inv" },
      { id: "mat-receipt-cancel", labelKey: "menu.material.receiptCancel", path: "/material/receipt-cancel" },
    ],
  },
  {
    id: "cutting",
    labelKey: "menu.cutting",
    icon: Scissors,
    children: [
      { id: "cut-order", labelKey: "menu.cutting.order", path: "/cutting/order" },
      { id: "cut-result", labelKey: "menu.cutting.result", path: "/cutting/result" },
    ],
  },
  {
    id: "crimping",
    labelKey: "menu.crimping",
    icon: Plug,
    children: [
      { id: "crimp-order", labelKey: "menu.crimping.order", path: "/crimping/order" },
      { id: "crimp-result", labelKey: "menu.crimping.result", path: "/crimping/result" },
      { id: "crimp-mold", labelKey: "menu.crimping.mold", path: "/crimping/mold" },
    ],
  },
  {
    id: "production",
    labelKey: "menu.production",
    icon: Factory,
    children: [
      { id: "prod-order", labelKey: "menu.production.order", path: "/production/order" },
      { id: "prod-result", labelKey: "menu.production.result", path: "/production/result" },
      { id: "prod-semi", labelKey: "menu.production.semi", path: "/production/semi" },
      { id: "prod-progress", labelKey: "menu.production.progress", path: "/production/progress" },
      { id: "prod-input-manual", labelKey: "menu.production.inputManual", path: "/production/input-manual" },
      { id: "prod-input-machine", labelKey: "menu.production.inputMachine", path: "/production/input-machine" },
      { id: "prod-input-inspect", labelKey: "menu.production.inputInspect", path: "/production/input-inspect" },
      { id: "prod-input-equip", labelKey: "menu.production.inputEquip", path: "/production/input-equip" },
      { id: "prod-sample-inspect", labelKey: "menu.production.sampleInspect", path: "/production/sample-inspect" },
      { id: "prod-pack-result", labelKey: "menu.production.packResult", path: "/production/pack-result" },
      { id: "prod-wip-stock", labelKey: "menu.production.wipStock", path: "/production/wip-stock" },
    ],
  },
  {
    id: "inspection",
    labelKey: "menu.inspection",
    icon: ScanLine,
    children: [
      { id: "insp-result", labelKey: "menu.inspection.result", path: "/inspection/result" },
      { id: "insp-equip", labelKey: "menu.inspection.equip", path: "/inspection/equip" },
    ],
  },
  {
    id: "quality",
    labelKey: "menu.quality",
    icon: Shield,
    children: [
      { id: "qc-defect", labelKey: "menu.quality.defect", path: "/quality/defect" },
      { id: "qc-inspect", labelKey: "menu.quality.inspect", path: "/quality/inspect" },
      { id: "qc-trace", labelKey: "menu.quality.trace", path: "/quality/trace" },
    ],
  },
  {
    id: "equipment",
    labelKey: "menu.equipment",
    icon: Wrench,
    children: [
      { id: "equip-status", labelKey: "menu.equipment.status", path: "/equipment/status" },
      { id: "equip-pm", labelKey: "menu.equipment.pm", path: "/equipment/pm" },
      { id: "equip-daily", labelKey: "menu.equipment.dailyInspect", path: "/equipment/daily-inspect" },
      { id: "equip-periodic", labelKey: "menu.equipment.periodicInspect", path: "/equipment/periodic-inspect" },
      { id: "equip-history", labelKey: "menu.equipment.inspectHistory", path: "/equipment/inspect-history" },
    ],
  },
  {
    id: "shipping",
    labelKey: "menu.shipping",
    icon: Truck,
    children: [
      { id: "ship-pack", labelKey: "menu.shipping.pack", path: "/shipping/pack" },
      { id: "ship-pallet", labelKey: "menu.shipping.pallet", path: "/shipping/pallet" },
      { id: "ship-confirm", labelKey: "menu.shipping.confirm", path: "/shipping/confirm" },
      { id: "ship-order", labelKey: "menu.shipping.order", path: "/shipping/order" },
      { id: "ship-history", labelKey: "menu.shipping.history", path: "/shipping/history" },
      { id: "ship-return", labelKey: "menu.shipping.return", path: "/shipping/return" },
    ],
  },
  {
    id: "customs",
    labelKey: "menu.customs",
    icon: FileBox,
    children: [
      { id: "cust-entry", labelKey: "menu.customs.entry", path: "/customs/entry" },
      { id: "cust-stock", labelKey: "menu.customs.stock", path: "/customs/stock" },
      { id: "cust-usage", labelKey: "menu.customs.usage", path: "/customs/usage" },
    ],
  },
  {
    id: "consumables",
    labelKey: "menu.consumables",
    icon: Cog,
    children: [
      { id: "cons-master", labelKey: "menu.consumables.master", path: "/consumables/master" },
      { id: "cons-receiving", labelKey: "menu.consumables.receiving", path: "/consumables/receiving" },
      { id: "cons-issuing", labelKey: "menu.consumables.issuing", path: "/consumables/issuing" },
      { id: "cons-stock", labelKey: "menu.consumables.stock", path: "/consumables/stock" },
      { id: "cons-life", labelKey: "menu.consumables.life", path: "/consumables/life" },
    ],
  },
  {
    id: "outsourcing",
    labelKey: "menu.outsourcing",
    icon: Building2,
    children: [
      { id: "out-vendor", labelKey: "menu.outsourcing.vendor", path: "/outsourcing/vendor" },
      { id: "out-order", labelKey: "menu.outsourcing.order", path: "/outsourcing/order" },
      { id: "out-receive", labelKey: "menu.outsourcing.receive", path: "/outsourcing/receive" },
    ],
  },
  {
    id: "interface",
    labelKey: "menu.interface",
    icon: ArrowLeftRight,
    children: [
      { id: "if-dashboard", labelKey: "menu.interface.dashboard", path: "/interface/dashboard" },
      { id: "if-log", labelKey: "menu.interface.log", path: "/interface/log" },
      { id: "if-manual", labelKey: "menu.interface.manual", path: "/interface/manual" },
    ],
  },
  {
    id: "system",
    labelKey: "menu.system",
    icon: UserCog,
    children: [
      { id: "sys-user", labelKey: "menu.system.users", path: "/system/users" },
      { id: "sys-comm", labelKey: "menu.system.commConfig", path: "/system/comm-config" },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["dashboard"]);

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    );
  };

  const isMenuActive = (item: MenuItem) => {
    if (item.path) {
      return pathname === item.path;
    }
    return item.children?.some((child) => pathname === child.path);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-[var(--header-height)] left-0 z-30
          w-[var(--sidebar-width)] h-[calc(100vh-var(--header-height))]
          bg-surface border-r border-border
          overflow-y-auto
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <nav className="p-3">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                {/* 단일 메뉴 (하위 없음) */}
                {item.path && !item.children ? (
                  <Link
                    href={item.path}
                    onClick={onClose}
                    className={`
                      flex items-center gap-3 px-3 py-2.5
                      rounded-[var(--radius)]
                      text-sm font-medium
                      transition-colors duration-200
                      ${
                        pathname === item.path
                          ? "bg-primary text-white"
                          : "text-text hover:bg-background"
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    {t(item.labelKey)}
                  </Link>
                ) : (
                  /* 하위 메뉴가 있는 경우 */
                  <>
                    <button
                      onClick={() => toggleMenu(item.id)}
                      className={`
                        w-full flex items-center justify-between
                        px-3 py-2.5 rounded-[var(--radius)]
                        text-sm font-medium
                        transition-colors duration-200
                        ${
                          isMenuActive(item)
                            ? "bg-primary/10 text-primary"
                            : "text-text hover:bg-background"
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5" />
                        {t(item.labelKey)}
                      </div>
                      {expandedMenus.includes(item.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {/* 하위 메뉴 리스트 */}
                    {expandedMenus.includes(item.id) && item.children && (
                      <ul className="mt-1 ml-4 pl-4 border-l border-border space-y-1">
                        {item.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={child.path}
                              onClick={onClose}
                              className={`
                                block px-3 py-2 rounded-[var(--radius)]
                                text-sm
                                transition-colors duration-200
                                ${
                                  pathname === child.path
                                    ? "bg-primary text-white"
                                    : "text-text-muted hover:text-text hover:bg-background"
                                }
                              `}
                            >
                              {t(child.labelKey)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
