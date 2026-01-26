/**
 * @file packages/shared/src/constants/menu.ts
 * @description 메뉴 구조 상수 정의
 *
 * 초보자 가이드:
 * 1. **icon**: Lucide React 아이콘 이름 (실제 렌더링은 프론트엔드에서)
 * 2. **children**: 하위 메뉴가 있는 경우
 * 3. **permission**: 해당 메뉴에 접근 가능한 권한
 */

/** 메뉴 아이템 타입 */
export interface MenuItem {
  key: string;
  label: string;
  labelEn?: string;
  labelVi?: string;
  icon: string;
  path?: string;
  permission?: string[];
  children?: MenuItem[];
}

/** 메인 메뉴 구조 */
export const MENU_ITEMS: MenuItem[] = [
  {
    key: 'dashboard',
    label: '대시보드',
    labelEn: 'Dashboard',
    labelVi: 'Bảng điều khiển',
    icon: 'LayoutDashboard',
    path: '/dashboard',
  },
  {
    key: 'material',
    label: '자재관리',
    labelEn: 'Material Management',
    labelVi: 'Quản lý vật tư',
    icon: 'Package',
    children: [
      { key: 'material-receipt', label: '자재입고', icon: 'PackagePlus', path: '/material/receipt' },
      { key: 'material-issue', label: '자재출고', icon: 'PackageMinus', path: '/material/issue' },
      { key: 'material-stock', label: '재고현황', icon: 'Boxes', path: '/material/stock' },
      { key: 'material-lot', label: 'LOT관리', icon: 'QrCode', path: '/material/lot' },
      { key: 'material-adjust', label: '재고조정', icon: 'ClipboardEdit', path: '/material/adjust' },
    ],
  },
  {
    key: 'customs',
    label: '보세관리',
    labelEn: 'Bonded Management',
    labelVi: 'Quản lý kho ngoại quan',
    icon: 'FileCheck',
    children: [
      { key: 'customs-import', label: '수입관리', icon: 'Import', path: '/customs/import' },
      { key: 'customs-usage', label: '사용현황', icon: 'FileSpreadsheet', path: '/customs/usage' },
      { key: 'customs-export', label: '수출관리', icon: 'FileOutput', path: '/customs/export' },
    ],
  },
  {
    key: 'cutting',
    label: '절단공정',
    labelEn: 'Cutting Process',
    labelVi: 'Công đoạn cắt',
    icon: 'Scissors',
    children: [
      { key: 'cutting-work', label: '절단작업', icon: 'Play', path: '/cutting/work' },
      { key: 'cutting-result', label: '실적조회', icon: 'FileText', path: '/cutting/result' },
    ],
  },
  {
    key: 'crimping',
    label: '압착공정',
    labelEn: 'Crimping Process',
    labelVi: 'Công đoạn ép',
    icon: 'Hammer',
    children: [
      { key: 'crimping-work', label: '압착작업', icon: 'Play', path: '/crimping/work' },
      { key: 'crimping-result', label: '실적조회', icon: 'FileText', path: '/crimping/result' },
    ],
  },
  {
    key: 'production',
    label: '생산관리',
    labelEn: 'Production Management',
    labelVi: 'Quản lý sản xuất',
    icon: 'Factory',
    children: [
      { key: 'production-order', label: '작업지시', icon: 'ClipboardList', path: '/production/order' },
      { key: 'production-work', label: '생산실적', icon: 'FileBarChart', path: '/production/work' },
      { key: 'production-monitor', label: '현황모니터', icon: 'Monitor', path: '/production/monitor' },
    ],
  },
  {
    key: 'inspection',
    label: '통전검사',
    labelEn: 'Electrical Inspection',
    labelVi: 'Kiểm tra điện',
    icon: 'Zap',
    children: [
      { key: 'inspection-work', label: '검사수행', icon: 'Play', path: '/inspection/work' },
      { key: 'inspection-result', label: '검사결과', icon: 'FileCheck', path: '/inspection/result' },
    ],
  },
  {
    key: 'quality',
    label: '품질관리',
    labelEn: 'Quality Management',
    labelVi: 'Quản lý chất lượng',
    icon: 'ShieldCheck',
    children: [
      { key: 'quality-iqc', label: '수입검사', icon: 'PackageSearch', path: '/quality/iqc' },
      { key: 'quality-defect', label: '불량관리', icon: 'AlertTriangle', path: '/quality/defect' },
      { key: 'quality-repair', label: '수리관리', icon: 'Wrench', path: '/quality/repair' },
      { key: 'quality-mrb', label: 'MRB심의', icon: 'Users', path: '/quality/mrb' },
    ],
  },
  {
    key: 'consumables',
    label: '소모품관리',
    labelEn: 'Consumables Management',
    labelVi: 'Quản lý vật tư tiêu hao',
    icon: 'Wrench',
    children: [
      { key: 'consumables-blade', label: '날관리', icon: 'Slice', path: '/consumables/blade' },
      { key: 'consumables-applicator', label: '어플리케이터', icon: 'Cpu', path: '/consumables/applicator' },
      { key: 'consumables-stock', label: '재고현황', icon: 'Boxes', path: '/consumables/stock' },
    ],
  },
  {
    key: 'equipment',
    label: '설비관리',
    labelEn: 'Equipment Management',
    labelVi: 'Quản lý thiết bị',
    icon: 'Settings',
    children: [
      { key: 'equipment-list', label: '설비현황', icon: 'List', path: '/equipment/list' },
      { key: 'equipment-maintenance', label: '보전관리', icon: 'Wrench', path: '/equipment/maintenance' },
      { key: 'equipment-history', label: '이력조회', icon: 'History', path: '/equipment/history' },
    ],
  },
  {
    key: 'outsourcing',
    label: '외주관리',
    labelEn: 'Outsourcing Management',
    labelVi: 'Quản lý gia công',
    icon: 'Truck',
    children: [
      { key: 'outsourcing-order', label: '외주발주', icon: 'FileOutput', path: '/outsourcing/order' },
      { key: 'outsourcing-receipt', label: '외주입고', icon: 'FileInput', path: '/outsourcing/receipt' },
    ],
  },
  {
    key: 'shipping',
    label: '출하관리',
    labelEn: 'Shipping Management',
    labelVi: 'Quản lý xuất hàng',
    icon: 'Ship',
    children: [
      { key: 'shipping-packing', label: '포장', icon: 'Package', path: '/shipping/packing' },
      { key: 'shipping-pallet', label: '팔레트', icon: 'Layers', path: '/shipping/pallet' },
      { key: 'shipping-order', label: '출하지시', icon: 'ClipboardList', path: '/shipping/order' },
      { key: 'shipping-history', label: '출하이력', icon: 'History', path: '/shipping/history' },
    ],
  },
  {
    key: 'interface',
    label: '인터페이스관리',
    labelEn: 'Interface Management',
    labelVi: 'Quản lý giao diện',
    icon: 'Link',
    children: [
      { key: 'interface-erp', label: 'ERP연동', icon: 'ArrowLeftRight', path: '/interface/erp' },
      { key: 'interface-log', label: '전송로그', icon: 'ScrollText', path: '/interface/log' },
    ],
  },
  {
    key: 'master',
    label: '기준정보',
    labelEn: 'Master Data',
    labelVi: 'Dữ liệu cơ sở',
    icon: 'Database',
    children: [
      { key: 'master-item', label: '품목관리', icon: 'Box', path: '/master/item' },
      { key: 'master-bom', label: 'BOM관리', icon: 'GitBranch', path: '/master/bom' },
      { key: 'master-process', label: '공정관리', icon: 'Workflow', path: '/master/process' },
      { key: 'master-partner', label: '거래처관리', icon: 'Building', path: '/master/partner' },
      { key: 'master-user', label: '사용자관리', icon: 'Users', path: '/master/user' },
      { key: 'master-code', label: '공통코드', icon: 'Tags', path: '/master/code' },
    ],
  },
] as const;

/** 메뉴 키로 메뉴 아이템 찾기 */
export function findMenuByKey(key: string, items: MenuItem[] = MENU_ITEMS): MenuItem | undefined {
  for (const item of items) {
    if (item.key === key) return item;
    if (item.children) {
      const found = findMenuByKey(key, item.children);
      if (found) return found;
    }
  }
  return undefined;
}

/** 경로로 메뉴 아이템 찾기 */
export function findMenuByPath(path: string, items: MenuItem[] = MENU_ITEMS): MenuItem | undefined {
  for (const item of items) {
    if (item.path === path) return item;
    if (item.children) {
      const found = findMenuByPath(path, item.children);
      if (found) return found;
    }
  }
  return undefined;
}
