/**
 * @file src/components/layout/Sidebar.tsx
 * @description 사이드바 네비게이션 컴포넌트
 *
 * 초보자 가이드:
 * 1. **메뉴 구조**: 대시보드 -> 8대 공정 -> 기준정보 순서
 * 2. **하위 메뉴**: 클릭 시 펼침/접힘
 * 3. **활성 상태**: 현재 페이지 하이라이트
 */
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { id: string; label: string; path: string }[];
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: '대시보드',
    path: '/',
    icon: LayoutDashboard,
  },
  {
    id: 'material',
    label: '자재관리',
    icon: Package,
    children: [
      { id: 'mat-receive', label: '입하/IQC', path: '/material/receive' },
      { id: 'mat-stock', label: '재고현황', path: '/material/stock' },
      { id: 'mat-issue', label: '출고관리', path: '/material/issue' },
    ],
  },
  {
    id: 'cutting',
    label: '절단공정',
    icon: Scissors,
    children: [
      { id: 'cut-order', label: '작업지시', path: '/cutting/order' },
      { id: 'cut-result', label: '작업실적', path: '/cutting/result' },
    ],
  },
  {
    id: 'crimping',
    label: '압착공정',
    icon: Plug,
    children: [
      { id: 'crimp-order', label: '작업지시', path: '/crimping/order' },
      { id: 'crimp-result', label: '작업실적', path: '/crimping/result' },
      { id: 'crimp-mold', label: '금형관리', path: '/crimping/mold' },
    ],
  },
  {
    id: 'production',
    label: '생산관리',
    icon: Factory,
    children: [
      { id: 'prod-order', label: '작업지시', path: '/production/order' },
      { id: 'prod-result', label: '생산실적', path: '/production/result' },
      { id: 'prod-semi', label: '반제품관리', path: '/production/semi' },
    ],
  },
  {
    id: 'inspection',
    label: '통전검사',
    icon: ScanLine,
    children: [
      { id: 'insp-result', label: '검사실적', path: '/inspection/result' },
      { id: 'insp-equip', label: '검사기연동', path: '/inspection/equip' },
    ],
  },
  {
    id: 'quality',
    label: '품질관리',
    icon: Shield,
    children: [
      { id: 'qc-defect', label: '불량관리', path: '/quality/defect' },
      { id: 'qc-repair', label: '수리관리', path: '/quality/repair' },
      { id: 'qc-trace', label: '추적성조회', path: '/quality/trace' },
    ],
  },
  {
    id: 'equipment',
    label: '설비관리',
    icon: Wrench,
    children: [
      { id: 'equip-status', label: '가동현황', path: '/equipment/status' },
      { id: 'equip-pm', label: '예방보전', path: '/equipment/pm' },
    ],
  },
  {
    id: 'shipping',
    label: '출하관리',
    icon: Truck,
    children: [
      { id: 'ship-pack', label: '포장관리', path: '/shipping/pack' },
      { id: 'ship-pallet', label: '팔레트적재', path: '/shipping/pallet' },
      { id: 'ship-confirm', label: '출하확정', path: '/shipping/confirm' },
    ],
  },
  {
    id: 'master',
    label: '기준정보',
    icon: Database,
    children: [
      { id: 'mst-part', label: '품목마스터', path: '/master/part' },
      { id: 'mst-bom', label: 'BOM관리', path: '/master/bom' },
      { id: 'mst-equip', label: '설비마스터', path: '/master/equip' },
      { id: 'mst-code', label: '코드관리', path: '/master/code' },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['dashboard']);

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    );
  };

  const isMenuActive = (item: MenuItem) => {
    if (item.path) {
      return location.pathname === item.path;
    }
    return item.children?.some((child) => location.pathname === child.path);
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
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <nav className="p-3">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                {/* 단일 메뉴 (하위 없음) */}
                {item.path && !item.children ? (
                  <NavLink
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5
                      rounded-[var(--radius)]
                      text-sm font-medium
                      transition-colors duration-200
                      ${
                        isActive
                          ? 'bg-primary text-white'
                          : 'text-text hover:bg-background'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
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
                            ? 'bg-primary/10 text-primary'
                            : 'text-text hover:bg-background'
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
                            <NavLink
                              to={child.path}
                              onClick={onClose}
                              className={({ isActive }) => `
                                block px-3 py-2 rounded-[var(--radius)]
                                text-sm
                                transition-colors duration-200
                                ${
                                  isActive
                                    ? 'bg-primary text-white'
                                    : 'text-text-muted hover:text-text hover:bg-background'
                                }
                              `}
                            >
                              {child.label}
                            </NavLink>
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
