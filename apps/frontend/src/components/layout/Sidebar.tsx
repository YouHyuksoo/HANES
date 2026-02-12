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
  label: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { id: string; label: string; path: string }[];
}

const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "대시보드",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    id: "master",
    label: "기준정보",
    icon: Database,
    children: [
      { id: "mst-part", label: "품목마스터", path: "/master/part" },
      { id: "mst-bom", label: "BOM관리", path: "/master/bom" },
      { id: "mst-equip", label: "설비마스터", path: "/master/equip" },
      { id: "mst-code", label: "코드관리", path: "/master/code" },
      { id: "mst-partner", label: "거래처관리", path: "/master/partner" },
    ],
  },
  {
    id: "inventory",
    label: "재고관리",
    icon: Warehouse,
    children: [
      { id: "inv-warehouse", label: "창고관리", path: "/inventory/warehouse" },
      { id: "inv-stock", label: "재고현황", path: "/inventory/stock" },
      { id: "inv-transaction", label: "수불이력", path: "/inventory/transaction" },
      { id: "inv-lot", label: "LOT관리", path: "/inventory/lot" },
    ],
  },
  {
    id: "material",
    label: "자재관리",
    icon: Package,
    children: [
      { id: "mat-arrival", label: "입하관리", path: "/material/arrival" },
      { id: "mat-iqc", label: "수입검사(IQC)", path: "/material/iqc" },
      { id: "mat-receive", label: "입고관리", path: "/material/receive" },
      { id: "mat-request", label: "출고요청", path: "/material/request" },
      { id: "mat-issue", label: "출고관리", path: "/material/issue" },
      { id: "mat-stock", label: "재고현황", path: "/material/stock" },
      { id: "mat-lot", label: "LOT관리", path: "/material/lot" },
    ],
  },
  {
    id: "cutting",
    label: "절단공정",
    icon: Scissors,
    children: [
      { id: "cut-order", label: "작업지시", path: "/cutting/order" },
      { id: "cut-result", label: "작업실적", path: "/cutting/result" },
    ],
  },
  {
    id: "crimping",
    label: "압착공정",
    icon: Plug,
    children: [
      { id: "crimp-order", label: "작업지시", path: "/crimping/order" },
      { id: "crimp-result", label: "작업실적", path: "/crimping/result" },
      { id: "crimp-mold", label: "금형관리", path: "/crimping/mold" },
    ],
  },
  {
    id: "production",
    label: "생산관리",
    icon: Factory,
    children: [
      { id: "prod-order", label: "작업지시", path: "/production/order" },
      { id: "prod-result", label: "생산실적", path: "/production/result" },
      { id: "prod-semi", label: "반제품관리", path: "/production/semi" },
    ],
  },
  {
    id: "inspection",
    label: "통전검사",
    icon: ScanLine,
    children: [
      { id: "insp-result", label: "검사실적", path: "/inspection/result" },
      { id: "insp-equip", label: "검사기연동", path: "/inspection/equip" },
    ],
  },
  {
    id: "quality",
    label: "품질관리",
    icon: Shield,
    children: [
      { id: "qc-defect", label: "불량관리", path: "/quality/defect" },
      { id: "qc-inspect", label: "검사관리", path: "/quality/inspect" },
      { id: "qc-trace", label: "추적성조회", path: "/quality/trace" },
    ],
  },
  {
    id: "equipment",
    label: "설비관리",
    icon: Wrench,
    children: [
      { id: "equip-status", label: "가동현황", path: "/equipment/status" },
      { id: "equip-pm", label: "예방보전", path: "/equipment/pm" },
    ],
  },
  {
    id: "shipping",
    label: "출하관리",
    icon: Truck,
    children: [
      { id: "ship-pack", label: "포장관리", path: "/shipping/pack" },
      { id: "ship-pallet", label: "팔레트적재", path: "/shipping/pallet" },
      { id: "ship-confirm", label: "출하확정", path: "/shipping/confirm" },
    ],
  },
  {
    id: "customs",
    label: "보세관리",
    icon: FileBox,
    children: [
      { id: "cust-entry", label: "수입신고", path: "/customs/entry" },
      { id: "cust-stock", label: "보세재고", path: "/customs/stock" },
      { id: "cust-usage", label: "사용신고", path: "/customs/usage" },
    ],
  },
  {
    id: "consumables",
    label: "소모품관리",
    icon: Cog,
    children: [
      { id: "cons-master", label: "소모품마스터", path: "/consumables/master" },
      { id: "cons-receiving", label: "입고관리", path: "/consumables/receiving" },
      { id: "cons-issuing", label: "출고관리", path: "/consumables/issuing" },
      { id: "cons-stock", label: "재고현황", path: "/consumables/stock" },
      { id: "cons-life", label: "수명현황", path: "/consumables/life" },
    ],
  },
  {
    id: "outsourcing",
    label: "외주관리",
    icon: Building2,
    children: [
      { id: "out-vendor", label: "외주처관리", path: "/outsourcing/vendor" },
      { id: "out-order", label: "외주발주", path: "/outsourcing/order" },
      { id: "out-receive", label: "외주입고", path: "/outsourcing/receive" },
    ],
  },
  {
    id: "interface",
    label: "인터페이스",
    icon: ArrowLeftRight,
    children: [
      { id: "if-dashboard", label: "ERP연동현황", path: "/interface/dashboard" },
      { id: "if-log", label: "전송이력", path: "/interface/log" },
      { id: "if-manual", label: "수동전송", path: "/interface/manual" },
    ],
  },
  {
    id: "system",
    label: "시스템관리",
    icon: UserCog,
    children: [
      { id: "sys-user", label: "사용자관리", path: "/system/users" },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
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
                    {item.label}
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
                        {item.label}
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
                              {child.label}
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
