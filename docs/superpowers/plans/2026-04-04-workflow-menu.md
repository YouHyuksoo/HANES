# Workflow Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "워크플로우" menu to the sidebar that shows 7 business process flows as interactive cards with real-time counts, node popovers, and navigation to each menu page.

**Architecture:** Frontend config file (`workflowConfig.ts`) defines all 7 workflow structures. A `PKG_WORKFLOW` Oracle package returns per-node counts via a single SP call. The NestJS `WorkflowModule` exposes `GET /workflow/summary`. The React page renders a 2-column grid of `WorkflowCard` components, each containing `WorkflowNode` steps with click-to-popover interaction.

**Tech Stack:** Next.js 14 (App Router), NestJS, Oracle DB (PL/SQL package), Tailwind CSS, lucide-react, react-i18next

---

### Task 1: Create workflowConfig.ts

**Files:**
- Create: `apps/frontend/src/config/workflowConfig.ts`

- [ ] **Step 1: Create the workflow config with types and all 7 definitions**

```typescript
/**
 * @file src/config/workflowConfig.ts
 * @description 워크플로우 정의 — 7개 업무 프로세스의 노드, 분기, 메뉴 경로 설정
 *
 * 초보자 가이드:
 * 1. WorkflowNode: 각 단계 (노드명, 경로, 색상, 역분개 경로)
 * 2. WorkflowBranch: 분기 조건 (합격/불합격 등)
 * 3. WorkflowDefinition: 워크플로우 전체 정의 (노드 배열 + 분기)
 * 4. workflowConfigs: 7개 워크플로우 배열
 */

/** 워크플로우 노드 (단계) */
export interface WorkflowNode {
  /** 노드 고유 ID (WORKFLOW_ID + NODE_ID로 API 매핑) */
  id: string;
  /** 표시명 i18n 키 */
  labelKey: string;
  /** 상태 라벨 i18n 키 */
  statusKey: string;
  /** 메뉴 경로 */
  path: string;
  /** 노드 accent 색상 (Tailwind) */
  color: string;
  /** 역분개 메뉴 경로 (없으면 역분개 불가) */
  reversePath?: string;
  /** 역분개 버튼 라벨 i18n 키 */
  reverseKey?: string;
}

/** 워크플로우 분기 */
export interface WorkflowBranch {
  /** 분기가 발생하는 노드 ID 뒤에 표시 */
  afterNodeId: string;
  /** 분기 조건 배열 */
  conditions: Array<{
    labelKey: string;
    type: "pass" | "fail";
  }>;
}

/** 워크플로우 정의 */
export interface WorkflowDefinition {
  /** 워크플로우 ID (API 매핑용) */
  id: string;
  /** 제목 i18n 키 */
  titleKey: string;
  /** 이모지 아이콘 */
  icon: string;
  /** 카드 accent 색상 (Tailwind border 클래스) */
  accent: string;
  /** 배지 색상 (Tailwind bg 클래스) */
  badgeColor: string;
  /** 노드 배열 (순서대로) */
  nodes: WorkflowNode[];
  /** 분기 정의 */
  branches?: WorkflowBranch[];
  /** 마지막 카드 전체 폭 사용 여부 */
  fullWidth?: boolean;
}

/** 7개 워크플로우 정의 */
export const workflowConfigs: WorkflowDefinition[] = [
  {
    id: "MATERIAL",
    titleKey: "workflow.material.title",
    icon: "📦",
    accent: "border-green-500",
    badgeColor: "bg-green-500",
    nodes: [
      { id: "ARRIVAL", labelKey: "workflow.material.arrival", statusKey: "workflow.status.pending", path: "/material/arrival", color: "text-green-500" },
      { id: "LABEL", labelKey: "workflow.material.label", statusKey: "workflow.status.issuing", path: "/material/receive-label", color: "text-cyan-500" },
      { id: "IQC", labelKey: "workflow.material.iqc", statusKey: "workflow.status.inspecting", path: "/material/iqc", color: "text-blue-500" },
      { id: "RECEIVE", labelKey: "workflow.material.receive", statusKey: "workflow.status.done", path: "/material/receive", color: "text-violet-500", reversePath: "/material/receipt-cancel", reverseKey: "workflow.action.cancelReceipt" },
      { id: "REQUEST", labelKey: "workflow.material.request", statusKey: "workflow.status.requesting", path: "/material/request", color: "text-amber-500" },
      { id: "ISSUE", labelKey: "workflow.material.issue", statusKey: "workflow.status.done", path: "/material/issue", color: "text-purple-500" },
    ],
    branches: [
      { afterNodeId: "IQC", conditions: [{ labelKey: "workflow.branch.pass", type: "pass" }, { labelKey: "workflow.branch.fail", type: "fail" }] },
    ],
  },
  {
    id: "PRODUCTION",
    titleKey: "workflow.production.title",
    icon: "🏭",
    accent: "border-blue-500",
    badgeColor: "bg-blue-500",
    nodes: [
      { id: "PLAN", labelKey: "workflow.production.plan", statusKey: "workflow.status.planning", path: "/production/monthly-plan", color: "text-green-500" },
      { id: "SIMULATION", labelKey: "workflow.production.simulation", statusKey: "workflow.status.simulating", path: "/production/simulation", color: "text-cyan-500" },
      { id: "ORDER", labelKey: "workflow.production.order", statusKey: "workflow.status.active", path: "/production/order", color: "text-amber-500" },
      { id: "RESULT", labelKey: "workflow.production.result", statusKey: "workflow.status.inputting", path: "/production/result", color: "text-blue-500" },
      { id: "INSPECT", labelKey: "workflow.production.inspect", statusKey: "workflow.status.inspecting", path: "/production/input-inspect", color: "text-violet-500" },
      { id: "FG_RECEIVE", labelKey: "workflow.production.fgReceive", statusKey: "workflow.status.done", path: "/product/receive", color: "text-purple-500", reversePath: "/product/receipt-cancel", reverseKey: "workflow.action.cancelReceipt" },
    ],
  },
  {
    id: "QUALITY",
    titleKey: "workflow.quality.title",
    icon: "🛡️",
    accent: "border-amber-500",
    badgeColor: "bg-amber-500",
    nodes: [
      { id: "IQC", labelKey: "workflow.quality.iqc", statusKey: "workflow.status.inspecting", path: "/material/iqc", color: "text-blue-500" },
      { id: "PROCESS_INSPECT", labelKey: "workflow.quality.processInspect", statusKey: "workflow.status.active", path: "/quality/inspect", color: "text-amber-500" },
      { id: "OQC", labelKey: "workflow.quality.oqc", statusKey: "workflow.status.pending", path: "/quality/oqc", color: "text-emerald-500" },
      { id: "DEFECT", labelKey: "workflow.quality.defect", statusKey: "workflow.status.reporting", path: "/quality/defect", color: "text-red-500" },
      { id: "REWORK", labelKey: "workflow.quality.rework", statusKey: "workflow.status.active", path: "/quality/rework", color: "text-orange-500" },
      { id: "REINSPECT", labelKey: "workflow.quality.reinspect", statusKey: "workflow.status.inspecting", path: "/quality/rework-inspect", color: "text-violet-500" },
      { id: "CAPA", labelKey: "workflow.quality.capa", statusKey: "workflow.status.done", path: "/quality/capa", color: "text-purple-500" },
    ],
  },
  {
    id: "SHIPPING",
    titleKey: "workflow.shipping.title",
    icon: "🚛",
    accent: "border-red-500",
    badgeColor: "bg-red-500",
    nodes: [
      { id: "PACK_RESULT", labelKey: "workflow.shipping.packResult", statusKey: "workflow.status.active", path: "/production/pack-result", color: "text-green-500" },
      { id: "PACK", labelKey: "workflow.shipping.pack", statusKey: "workflow.status.packing", path: "/shipping/pack", color: "text-cyan-500" },
      { id: "PALLET", labelKey: "workflow.shipping.pallet", statusKey: "workflow.status.palletizing", path: "/shipping/pallet", color: "text-blue-500" },
      { id: "OQC", labelKey: "workflow.shipping.oqc", statusKey: "workflow.status.inspecting", path: "/quality/oqc", color: "text-amber-500" },
      { id: "CONFIRM", labelKey: "workflow.shipping.confirm", statusKey: "workflow.status.confirming", path: "/shipping/confirm", color: "text-violet-500", reversePath: "/shipping/return", reverseKey: "workflow.action.return" },
      { id: "HISTORY", labelKey: "workflow.shipping.history", statusKey: "workflow.status.done", path: "/shipping/history", color: "text-purple-500" },
    ],
    branches: [
      { afterNodeId: "OQC", conditions: [{ labelKey: "workflow.branch.pass", type: "pass" }, { labelKey: "workflow.branch.fail", type: "fail" }] },
    ],
  },
  {
    id: "EQUIPMENT",
    titleKey: "workflow.equipment.title",
    icon: "🔧",
    accent: "border-violet-500",
    badgeColor: "bg-violet-500",
    nodes: [
      { id: "PM_PLAN", labelKey: "workflow.equipment.pmPlan", statusKey: "workflow.status.planning", path: "/equipment/pm-plan", color: "text-blue-500" },
      { id: "PM_CALENDAR", labelKey: "workflow.equipment.pmCalendar", statusKey: "workflow.status.scheduled", path: "/equipment/pm-calendar", color: "text-amber-500" },
      { id: "PM_RESULT", labelKey: "workflow.equipment.pmResult", statusKey: "workflow.status.executing", path: "/equipment/pm-result", color: "text-green-500" },
      { id: "DAILY", labelKey: "workflow.equipment.daily", statusKey: "workflow.status.inspecting", path: "/equipment/inspect-calendar", color: "text-cyan-500" },
      { id: "PERIODIC", labelKey: "workflow.equipment.periodic", statusKey: "workflow.status.inspecting", path: "/equipment/periodic-inspect-calendar", color: "text-violet-500" },
      { id: "HISTORY", labelKey: "workflow.equipment.history", statusKey: "workflow.status.done", path: "/equipment/inspect-history", color: "text-purple-500" },
    ],
  },
  {
    id: "OUTSOURCING",
    titleKey: "workflow.outsourcing.title",
    icon: "🏢",
    accent: "border-emerald-500",
    badgeColor: "bg-emerald-500",
    nodes: [
      { id: "VENDOR", labelKey: "workflow.outsourcing.vendor", statusKey: "workflow.status.master", path: "/outsourcing/vendor", color: "text-green-500" },
      { id: "ORDER", labelKey: "workflow.outsourcing.order", statusKey: "workflow.status.ordering", path: "/outsourcing/order", color: "text-amber-500" },
      { id: "RECEIVE", labelKey: "workflow.outsourcing.receive", statusKey: "workflow.status.receiving", path: "/outsourcing/receive", color: "text-emerald-500" },
    ],
  },
  {
    id: "CONSUMABLES",
    titleKey: "workflow.consumables.title",
    icon: "⚙️",
    accent: "border-pink-500",
    badgeColor: "bg-pink-500",
    fullWidth: true,
    nodes: [
      { id: "RECEIVING", labelKey: "workflow.consumables.receiving", statusKey: "workflow.status.pending", path: "/consumables/receiving", color: "text-green-500" },
      { id: "LABEL", labelKey: "workflow.consumables.label", statusKey: "workflow.status.issuing", path: "/consumables/label", color: "text-blue-500" },
      { id: "ISSUING", labelKey: "workflow.consumables.issuing", statusKey: "workflow.status.active", path: "/consumables/issuing", color: "text-amber-500" },
      { id: "MOUNT", labelKey: "workflow.consumables.mount", statusKey: "workflow.status.done", path: "/consumables/mount", color: "text-violet-500" },
      { id: "LIFE", labelKey: "workflow.consumables.life", statusKey: "workflow.status.managing", path: "/consumables/life", color: "text-pink-500" },
    ],
  },
];
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd C:/Project/HANES && pnpm --filter frontend exec tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to workflowConfig.ts

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/config/workflowConfig.ts
git commit -m "feat(workflow): add workflowConfig.ts with 7 workflow definitions"
```

---

### Task 2: Add i18n keys for all 4 locales

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: Add workflow i18n block to ko.json**

Add a `"workflow"` key at the top level of the JSON. Insert the following block (merge into existing JSON — do NOT overwrite the file):

```json
"workflow": {
  "title": "워크플로우",
  "subtitle": "업무 프로세스 흐름을 한눈에 파악하고, 각 단계로 바로 이동하세요.",
  "refresh": "새로고침",
  "activeSuffix": "건 진행중",
  "material": { "title": "자재관리", "arrival": "입하", "label": "입고라벨", "iqc": "IQC", "receive": "입고", "request": "출고요청", "issue": "출고" },
  "production": { "title": "생산관리", "plan": "월간계획", "simulation": "시뮬레이션", "order": "작업지시", "result": "생산실적", "inspect": "공정검사", "fgReceive": "완제품입고" },
  "quality": { "title": "품질관리", "iqc": "IQC", "processInspect": "공정검사", "oqc": "OQC", "defect": "불량등록", "rework": "재작업", "reinspect": "재검사", "capa": "CAPA" },
  "shipping": { "title": "출하관리", "packResult": "포장실적", "pack": "포장", "pallet": "파렛트", "oqc": "OQC", "confirm": "출하확정", "history": "출하이력" },
  "equipment": { "title": "설비관리", "pmPlan": "PM계획", "pmCalendar": "PM캘린더", "pmResult": "PM결과", "daily": "일상점검", "periodic": "정기점검", "history": "점검이력" },
  "outsourcing": { "title": "외주관리", "vendor": "외주업체", "order": "외주발주", "receive": "외주입고" },
  "consumables": { "title": "소모품관리", "receiving": "입고", "label": "라벨", "issuing": "출고", "mount": "장착", "life": "수명" },
  "status": { "pending": "대기", "active": "진행", "done": "완료", "inspecting": "검사중", "planning": "수립", "simulating": "시뮬레이션", "inputting": "입력중", "reporting": "등록", "requesting": "요청", "issuing": "발행", "packing": "포장중", "palletizing": "적재중", "confirming": "확정", "scheduled": "예정", "executing": "실행", "ordering": "발주", "receiving": "입고중", "master": "마스터", "managing": "관리" },
  "branch": { "pass": "합격", "fail": "불합격" },
  "action": { "goTo": "바로가기", "cancelReceipt": "입고취소", "return": "반품", "close": "닫기" },
  "popover": { "stats": "현황 통계", "recentHistory": "최근 처리 이력", "pendingCnt": "대기", "activeCnt": "진행", "doneCnt": "완료", "reverseCnt": "취소대기" }
},
"menu.workflow": "워크플로우"
```

Note: `"menu.workflow"` should be added inside the existing `"menu"` object as `"workflow": "워크플로우"`.

- [ ] **Step 2: Add workflow i18n block to en.json**

Same structure, English translations:

```json
"workflow": {
  "title": "Workflow",
  "subtitle": "View business process flows at a glance and navigate to each step.",
  "refresh": "Refresh",
  "activeSuffix": " active",
  "material": { "title": "Material", "arrival": "Arrival", "label": "Label", "iqc": "IQC", "receive": "Receive", "request": "Request", "issue": "Issue" },
  "production": { "title": "Production", "plan": "Plan", "simulation": "Simulation", "order": "Order", "result": "Result", "inspect": "Inspect", "fgReceive": "FG Receive" },
  "quality": { "title": "Quality", "iqc": "IQC", "processInspect": "Process Insp.", "oqc": "OQC", "defect": "Defect", "rework": "Rework", "reinspect": "Re-inspect", "capa": "CAPA" },
  "shipping": { "title": "Shipping", "packResult": "Pack Result", "pack": "Pack", "pallet": "Pallet", "oqc": "OQC", "confirm": "Confirm", "history": "History" },
  "equipment": { "title": "Equipment", "pmPlan": "PM Plan", "pmCalendar": "PM Calendar", "pmResult": "PM Result", "daily": "Daily Insp.", "periodic": "Periodic Insp.", "history": "History" },
  "outsourcing": { "title": "Outsourcing", "vendor": "Vendor", "order": "Order", "receive": "Receive" },
  "consumables": { "title": "Consumables", "receiving": "Receive", "label": "Label", "issuing": "Issue", "mount": "Mount", "life": "Life" },
  "status": { "pending": "Pending", "active": "Active", "done": "Done", "inspecting": "Inspecting", "planning": "Planning", "simulating": "Simulating", "inputting": "Inputting", "reporting": "Reporting", "requesting": "Requesting", "issuing": "Issuing", "packing": "Packing", "palletizing": "Palletizing", "confirming": "Confirming", "scheduled": "Scheduled", "executing": "Executing", "ordering": "Ordering", "receiving": "Receiving", "master": "Master", "managing": "Managing" },
  "branch": { "pass": "Pass", "fail": "Fail" },
  "action": { "goTo": "Go to", "cancelReceipt": "Cancel Receipt", "return": "Return", "close": "Close" },
  "popover": { "stats": "Statistics", "recentHistory": "Recent History", "pendingCnt": "Pending", "activeCnt": "Active", "doneCnt": "Done", "reverseCnt": "Cancel Pending" }
}
```

- [ ] **Step 3: Add workflow i18n block to zh.json**

Same structure, Chinese translations:

```json
"workflow": {
  "title": "工作流程",
  "subtitle": "一目了然地查看业务流程，快速导航到每个步骤。",
  "refresh": "刷新",
  "activeSuffix": "件进行中",
  "material": { "title": "物料管理", "arrival": "到货", "label": "标签", "iqc": "IQC", "receive": "入库", "request": "出库申请", "issue": "出库" },
  "production": { "title": "生产管理", "plan": "月计划", "simulation": "模拟", "order": "工单", "result": "实绩", "inspect": "工序检查", "fgReceive": "成品入库" },
  "quality": { "title": "质量管理", "iqc": "IQC", "processInspect": "工序检查", "oqc": "OQC", "defect": "不良登记", "rework": "返工", "reinspect": "复检", "capa": "CAPA" },
  "shipping": { "title": "出货管理", "packResult": "包装实绩", "pack": "包装", "pallet": "托盘", "oqc": "OQC", "confirm": "出货确认", "history": "出货历史" },
  "equipment": { "title": "设备管理", "pmPlan": "PM计划", "pmCalendar": "PM日历", "pmResult": "PM结果", "daily": "日常点检", "periodic": "定期点检", "history": "点检历史" },
  "outsourcing": { "title": "外协管理", "vendor": "外协商", "order": "外协订单", "receive": "外协入库" },
  "consumables": { "title": "耗材管理", "receiving": "入库", "label": "标签", "issuing": "出库", "mount": "安装", "life": "寿命" },
  "status": { "pending": "待处理", "active": "进行中", "done": "完成", "inspecting": "检查中", "planning": "计划中", "simulating": "模拟中", "inputting": "录入中", "reporting": "登记中", "requesting": "申请中", "issuing": "发行中", "packing": "包装中", "palletizing": "码垛中", "confirming": "确认中", "scheduled": "已安排", "executing": "执行中", "ordering": "订购中", "receiving": "入库中", "master": "主数据", "managing": "管理中" },
  "branch": { "pass": "合格", "fail": "不合格" },
  "action": { "goTo": "前往", "cancelReceipt": "取消入库", "return": "退货", "close": "关闭" },
  "popover": { "stats": "统计", "recentHistory": "最近记录", "pendingCnt": "待处理", "activeCnt": "进行中", "doneCnt": "完成", "reverseCnt": "待取消" }
}
```

- [ ] **Step 4: Add workflow i18n block to vi.json**

Same structure, Vietnamese translations:

```json
"workflow": {
  "title": "Quy trình",
  "subtitle": "Xem luồng quy trình kinh doanh và điều hướng đến từng bước.",
  "refresh": "Làm mới",
  "activeSuffix": " đang xử lý",
  "material": { "title": "Vật tư", "arrival": "Nhập hàng", "label": "Nhãn", "iqc": "IQC", "receive": "Nhập kho", "request": "Yêu cầu xuất", "issue": "Xuất kho" },
  "production": { "title": "Sản xuất", "plan": "Kế hoạch", "simulation": "Mô phỏng", "order": "Lệnh SX", "result": "Kết quả", "inspect": "Kiểm tra", "fgReceive": "Nhập TP" },
  "quality": { "title": "Chất lượng", "iqc": "IQC", "processInspect": "KT công đoạn", "oqc": "OQC", "defect": "Lỗi", "rework": "Sửa chữa", "reinspect": "Tái kiểm", "capa": "CAPA" },
  "shipping": { "title": "Xuất hàng", "packResult": "KQ đóng gói", "pack": "Đóng gói", "pallet": "Pallet", "oqc": "OQC", "confirm": "Xác nhận", "history": "Lịch sử" },
  "equipment": { "title": "Thiết bị", "pmPlan": "KH PM", "pmCalendar": "Lịch PM", "pmResult": "KQ PM", "daily": "KT hàng ngày", "periodic": "KT định kỳ", "history": "Lịch sử" },
  "outsourcing": { "title": "Gia công", "vendor": "Nhà cung cấp", "order": "Đơn hàng", "receive": "Nhận hàng" },
  "consumables": { "title": "Vật tư tiêu hao", "receiving": "Nhập", "label": "Nhãn", "issuing": "Xuất", "mount": "Lắp", "life": "Tuổi thọ" },
  "status": { "pending": "Chờ", "active": "Đang xử lý", "done": "Hoàn thành", "inspecting": "Đang kiểm", "planning": "Lập KH", "simulating": "Mô phỏng", "inputting": "Nhập liệu", "reporting": "Đăng ký", "requesting": "Yêu cầu", "issuing": "Phát hành", "packing": "Đóng gói", "palletizing": "Xếp pallet", "confirming": "Xác nhận", "scheduled": "Đã lên lịch", "executing": "Thực hiện", "ordering": "Đặt hàng", "receiving": "Nhập kho", "master": "Chính", "managing": "Quản lý" },
  "branch": { "pass": "Đạt", "fail": "Không đạt" },
  "action": { "goTo": "Đi đến", "cancelReceipt": "Hủy nhập kho", "return": "Trả hàng", "close": "Đóng" },
  "popover": { "stats": "Thống kê", "recentHistory": "Lịch sử gần đây", "pendingCnt": "Chờ", "activeCnt": "Đang xử lý", "doneCnt": "Hoàn thành", "reverseCnt": "Chờ hủy" }
}
```

- [ ] **Step 5: Add menu.workflow key to each locale's menu object**

In each locale file, find the `"menu"` object and add `"workflow": "<translated>"` right after `"dashboard"`:
- ko.json: `"workflow": "워크플로우"`
- en.json: `"workflow": "Workflow"`
- zh.json: `"workflow": "工作流程"`
- vi.json: `"workflow": "Quy trình"`

- [ ] **Step 6: Verify i18n JSON validity**

Run: `cd C:/Project/HANES && node -e "['ko','en','zh','vi'].forEach(l => { JSON.parse(require('fs').readFileSync('apps/frontend/src/locales/'+l+'.json','utf8')); console.log(l+': OK') })"`
Expected: All 4 print "OK"

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/locales/*.json
git commit -m "feat(workflow): add i18n keys for workflow menu (ko/en/zh/vi)"
```

---

### Task 3: Add sidebar menu entry

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts`

- [ ] **Step 1: Add GitBranch import and WORKFLOW menu item**

In `menuConfig.ts`, add `GitBranch` to the lucide-react import on line 3:

```typescript
import {
  LayoutDashboard, Package, Factory, ScanLine, Shield, Wrench, Truck,
  Database, FileBox, Cog, Building2, ArrowLeftRight, Warehouse, UserCog,
  ClipboardCheck, ShoppingCart, Monitor, PackageCheck, Ruler, GitBranch,
} from "lucide-react";
```

Then add the WORKFLOW menu item right after the DASHBOARD entry (after line 38 in the `menuConfig` array):

```typescript
  {
    code: "WORKFLOW",
    labelKey: "menu.workflow",
    path: "/workflow",
    icon: GitBranch,
  },
```

- [ ] **Step 2: Verify build**

Run: `cd C:/Project/HANES && pnpm --filter frontend exec tsc --noEmit --pretty 2>&1 | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/config/menuConfig.ts
git commit -m "feat(workflow): add Workflow menu to sidebar after Dashboard"
```

---

### Task 4: Create PKG_WORKFLOW Oracle package

**Files:**
- Create: `scripts/oracle/PKG_WORKFLOW.sql`

- [ ] **Step 1: Write the Oracle package SQL**

```sql
/**
 * @file PKG_WORKFLOW.sql
 * @description 워크플로우 페이지에 필요한 단계별 건수 통계를 제공하는 Oracle 패키지.
 *              SP_WORKFLOW_SUMMARY 프로시저로 7개 워크플로우 × N개 노드의 건수를 한번에 반환.
 *
 * @author  지성솔루션컨설팅
 * @created 2026-04-04
 */

--------------------------------------------------------------------------------
-- PACKAGE SPEC
--------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE PKG_WORKFLOW AS

    /**
     * SP_WORKFLOW_SUMMARY - 워크플로우 전체 노드별 건수 조회
     * @param o_cursor OUT SYS_REFCURSOR
     *   WORKFLOW_ID, NODE_ID, PENDING_CNT, ACTIVE_CNT, DONE_CNT, REVERSE_CNT
     */
    PROCEDURE SP_WORKFLOW_SUMMARY(
        o_cursor OUT SYS_REFCURSOR
    );

END PKG_WORKFLOW;
/

--------------------------------------------------------------------------------
-- PACKAGE BODY
--------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE BODY PKG_WORKFLOW AS

    PROCEDURE SP_WORKFLOW_SUMMARY(
        o_cursor OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN o_cursor FOR
        -- 자재관리: 입하
        SELECT 'MATERIAL' AS WORKFLOW_ID, 'ARRIVAL' AS NODE_ID,
               COUNT(CASE WHEN STATUS IN ('ARRIVED','PENDING') THEN 1 END) AS PENDING_CNT,
               COUNT(CASE WHEN STATUS = 'IQC' THEN 1 END) AS ACTIVE_CNT,
               COUNT(CASE WHEN STATUS = 'RECEIVED' THEN 1 END) AS DONE_CNT,
               0 AS REVERSE_CNT
          FROM MAT_ARRIVALS
         WHERE TRUNC(ARRIVAL_DATE) = TRUNC(SYSDATE)

        UNION ALL
        -- 자재관리: IQC
        SELECT 'MATERIAL', 'IQC',
               COUNT(CASE WHEN STATUS = 'PENDING' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'IN_PROGRESS' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'COMPLETED' AND RESULT = 'PASS' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'COMPLETED' AND RESULT = 'FAIL' THEN 1 END)
          FROM IQC_LOGS
         WHERE TRUNC(INSPECT_DATE) = TRUNC(SYSDATE)

        UNION ALL
        -- 자재관리: 입고
        SELECT 'MATERIAL', 'RECEIVE',
               0,
               COUNT(CASE WHEN TRANS_TYPE = 'RECEIVE' AND STATUS = 'PENDING' THEN 1 END),
               COUNT(CASE WHEN TRANS_TYPE = 'RECEIVE' AND STATUS = 'COMPLETED' THEN 1 END),
               COUNT(CASE WHEN TRANS_TYPE = 'CANCEL_RECEIVE' THEN 1 END)
          FROM STOCK_TRANSACTIONS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)

        UNION ALL
        -- 생산관리: 작업지시
        SELECT 'PRODUCTION', 'ORDER',
               COUNT(CASE WHEN STATUS IN ('WAITING','WAIT') THEN 1 END),
               COUNT(CASE WHEN STATUS IN ('START','RUNNING') THEN 1 END),
               COUNT(CASE WHEN STATUS IN ('DONE','COMPLETED') THEN 1 END),
               0
          FROM JOB_ORDERS
         WHERE TRUNC(PLAN_DATE) = TRUNC(SYSDATE)

        UNION ALL
        -- 설비관리: PM
        SELECT 'EQUIPMENT', 'PM_PLAN',
               COUNT(CASE WHEN STATUS = 'PLANNED' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'IN_PROGRESS' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'COMPLETED' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'CANCELLED' THEN 1 END)
          FROM PM_WORK_ORDERS
         WHERE TRUNC(SCHEDULED_DATE) = TRUNC(SYSDATE)

        UNION ALL
        -- 설비관리: 일상점검
        SELECT 'EQUIPMENT', 'DAILY',
               COUNT(CASE WHEN l.OVERALL_RESULT IS NULL THEN 1 END),
               0,
               COUNT(CASE WHEN l.OVERALL_RESULT IS NOT NULL THEN 1 END),
               0
          FROM (SELECT DISTINCT EQUIP_CODE FROM EQUIP_INSPECT_ITEM_MASTERS WHERE INSPECT_TYPE='DAILY' AND USE_YN='Y') t
          LEFT JOIN EQUIP_INSPECT_LOGS l ON t.EQUIP_CODE=l.EQUIP_CODE AND l.INSPECT_TYPE='DAILY' AND TRUNC(l.INSPECT_DATE)=TRUNC(SYSDATE)

        UNION ALL
        -- 설비관리: 정기점검
        SELECT 'EQUIPMENT', 'PERIODIC',
               COUNT(CASE WHEN l.OVERALL_RESULT IS NULL THEN 1 END),
               0,
               COUNT(CASE WHEN l.OVERALL_RESULT IS NOT NULL THEN 1 END),
               0
          FROM (SELECT DISTINCT EQUIP_CODE FROM EQUIP_INSPECT_ITEM_MASTERS WHERE INSPECT_TYPE='PERIODIC' AND USE_YN='Y') t
          LEFT JOIN EQUIP_INSPECT_LOGS l ON t.EQUIP_CODE=l.EQUIP_CODE AND l.INSPECT_TYPE='PERIODIC' AND TRUNC(l.INSPECT_DATE)=TRUNC(SYSDATE)

        UNION ALL
        -- 출하관리: OQC
        SELECT 'SHIPPING', 'OQC',
               COUNT(CASE WHEN STATUS = 'PENDING' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'IN_PROGRESS' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'COMPLETED' THEN 1 END),
               0
          FROM OQC_REQUESTS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)

        UNION ALL
        -- 출하관리: 출하확정
        SELECT 'SHIPPING', 'CONFIRM',
               COUNT(CASE WHEN STATUS = 'PENDING' THEN 1 END),
               0,
               COUNT(CASE WHEN STATUS IN ('SHIPPED','COMPLETED') THEN 1 END),
               0
          FROM SHIPMENT_ORDERS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)

        UNION ALL
        -- 출하관리: 반품
        SELECT 'SHIPPING', 'HISTORY',
               0, 0,
               COUNT(*),
               0
          FROM SHIPMENT_LOGS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)

        UNION ALL
        -- 품질관리: 불량
        SELECT 'QUALITY', 'DEFECT',
               COUNT(CASE WHEN STATUS = 'WAIT' THEN 1 END),
               COUNT(CASE WHEN STATUS IN ('REPAIR','REWORK') THEN 1 END),
               COUNT(CASE WHEN STATUS = 'DONE' THEN 1 END),
               0
          FROM DEFECT_LOGS
         WHERE TRUNC(OCCUR_TIME) = TRUNC(SYSDATE)

        UNION ALL
        -- 소모품: 입출고
        SELECT 'CONSUMABLES', 'RECEIVING',
               0,
               COUNT(CASE WHEN LOG_TYPE = 'IN' THEN 1 END),
               COUNT(CASE WHEN LOG_TYPE = 'OUT' THEN 1 END),
               0
          FROM CONSUMABLE_LOGS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)

        UNION ALL
        -- 소모품: 장착
        SELECT 'CONSUMABLES', 'MOUNT',
               0, 0,
               COUNT(*),
               0
          FROM CONSUMABLE_MOUNT_LOGS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)
        ;

    END SP_WORKFLOW_SUMMARY;

END PKG_WORKFLOW;
/
```

- [ ] **Step 2: Deploy to Oracle**

Run: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/deploy_package.py scripts/oracle/PKG_WORKFLOW.sql --site JSHANES`
Expected: VALID status for both SPEC and BODY

- [ ] **Step 3: Verify the SP returns data**

Run: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT * FROM TABLE(PKG_WORKFLOW.SP_WORKFLOW_SUMMARY)" 2>/dev/null || echo "Use callProc test instead"`

If direct query fails (SP uses OUT cursor), verify via backend API in Task 6.

- [ ] **Step 4: Commit**

```bash
git add scripts/oracle/PKG_WORKFLOW.sql
git commit -m "feat(workflow): add PKG_WORKFLOW Oracle package for summary stats"
```

---

### Task 5: Create backend WorkflowModule

**Files:**
- Create: `apps/backend/src/modules/workflow/workflow.module.ts`
- Create: `apps/backend/src/modules/workflow/workflow.controller.ts`
- Create: `apps/backend/src/modules/workflow/workflow.service.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Create workflow.service.ts**

```typescript
/**
 * @file src/modules/workflow/workflow.service.ts
 * @description 워크플로우 서비스 — PKG_WORKFLOW Oracle 패키지 호출
 *
 * 초보자 가이드:
 * 1. OracleService.callProc()로 PKG_WORKFLOW.SP_WORKFLOW_SUMMARY 호출
 * 2. 결과를 workflowId → nodeId → counts 맵으로 변환하여 프론트엔드에 전달
 */
import { Injectable } from '@nestjs/common';
import { OracleService } from '../../common/services/oracle.service';

const PKG = 'PKG_WORKFLOW';

interface NodeCount {
  pendingCnt: number;
  activeCnt: number;
  doneCnt: number;
  reverseCnt: number;
}

@Injectable()
export class WorkflowService {
  constructor(private readonly oracle: OracleService) {}

  /**
   * 워크플로우 전체 요약 — 노드별 건수
   * @returns { [workflowId]: { [nodeId]: NodeCount } }
   */
  async getSummary(): Promise<Record<string, Record<string, NodeCount>>> {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_WORKFLOW_SUMMARY');

    const result: Record<string, Record<string, NodeCount>> = {};
    for (const row of rows) {
      const wfId = row.workflowId ?? '';
      const nodeId = row.nodeId ?? '';
      if (!result[wfId]) result[wfId] = {};
      result[wfId][nodeId] = {
        pendingCnt: row.pendingCnt ?? 0,
        activeCnt: row.activeCnt ?? 0,
        doneCnt: row.doneCnt ?? 0,
        reverseCnt: row.reverseCnt ?? 0,
      };
    }
    return result;
  }
}
```

- [ ] **Step 2: Create workflow.controller.ts**

```typescript
/**
 * @file src/modules/workflow/workflow.controller.ts
 * @description 워크플로우 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET /workflow/summary — 전체 워크플로우 노드별 건수 반환
 */
import { Controller, Get } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('summary')
  async getSummary() {
    const data = await this.workflowService.getSummary();
    return { success: true, data };
  }
}
```

- [ ] **Step 3: Create workflow.module.ts**

```typescript
/**
 * @file src/modules/workflow/workflow.module.ts
 * @description 워크플로우 모듈
 *
 * 초보자 가이드:
 * 1. OracleModule이 @Global()이므로 별도 import 불필요
 */
import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService],
})
export class WorkflowModule {}
```

- [ ] **Step 4: Register WorkflowModule in app.module.ts**

Add import at top of `apps/backend/src/app.module.ts`:
```typescript
import { WorkflowModule } from './modules/workflow/workflow.module';
```

Add `WorkflowModule` to the `imports` array (after `DashboardModule` on line 103).

- [ ] **Step 5: Verify backend build**

Run: `cd C:/Project/HANES && pnpm --filter backend build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Test API**

Run: `curl -s http://localhost:3003/api/v1/workflow/summary | python -m json.tool | head -20`
Expected: JSON with `success: true` and nested workflow/node counts

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/workflow/ apps/backend/src/app.module.ts
git commit -m "feat(workflow): add WorkflowModule with PKG_WORKFLOW integration"
```

---

### Task 6: Create WorkflowNode component

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/WorkflowNode.tsx`

- [ ] **Step 1: Create the WorkflowNode component**

```typescript
"use client";

/**
 * @file WorkflowNode.tsx
 * @description 워크플로우 노드 — 단계명 + 건수 + 상태 라벨을 표시하는 개별 노드
 *
 * 초보자 가이드:
 * 1. 노드는 카드 안의 각 단계를 나타냄
 * 2. 클릭 시 onNodeClick 콜백으로 팝오버 열기
 * 3. color prop으로 accent 색상 적용
 */
import { useTranslation } from "react-i18next";

interface NodeCounts {
  pendingCnt: number;
  activeCnt: number;
  doneCnt: number;
  reverseCnt: number;
}

interface WorkflowNodeProps {
  labelKey: string;
  statusKey: string;
  color: string;
  counts?: NodeCounts;
  onClick?: () => void;
}

export default function WorkflowNode({
  labelKey, statusKey, color, counts, onClick,
}: WorkflowNodeProps) {
  const { t } = useTranslation();
  const total = counts
    ? counts.pendingCnt + counts.activeCnt + counts.doneCnt
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700
        rounded-lg p-2.5 text-center transition-all hover:border-primary hover:bg-gray-50
        dark:hover:bg-slate-800 cursor-pointer min-w-0"
    >
      <div className={`text-xs font-semibold ${color} truncate`}>
        {t(labelKey)}
      </div>
      <div className="text-xl font-extrabold text-text my-0.5">
        {total}
      </div>
      <div className="text-[10px] text-text-muted truncate">
        {t(statusKey)}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/\(authenticated\)/workflow/components/WorkflowNode.tsx
git commit -m "feat(workflow): add WorkflowNode component"
```

---

### Task 7: Create WorkflowBranch component

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/WorkflowBranch.tsx`

- [ ] **Step 1: Create the WorkflowBranch component**

```typescript
"use client";

/**
 * @file WorkflowBranch.tsx
 * @description 워크플로우 분기 표시 — 합격/불합격 등 분기 배지
 *
 * 초보자 가이드:
 * 1. 노드 사이에 위치하여 분기 조건을 시각적으로 표시
 * 2. pass는 녹색, fail은 빨간색 배지
 */
import { useTranslation } from "react-i18next";
import type { WorkflowBranch as BranchDef } from "@/config/workflowConfig";

interface WorkflowBranchProps {
  branch: BranchDef;
}

export default function WorkflowBranch({ branch }: WorkflowBranchProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col justify-center gap-1 px-1">
      {branch.conditions.map((cond) => (
        <span
          key={cond.type}
          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap ${
            cond.type === "pass"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {t(cond.labelKey)}{cond.type === "pass" ? "→" : "×"}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/\(authenticated\)/workflow/components/WorkflowBranch.tsx
git commit -m "feat(workflow): add WorkflowBranch component"
```

---

### Task 8: Create WorkflowPopover component

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/WorkflowPopover.tsx`

- [ ] **Step 1: Create the WorkflowPopover component**

```typescript
"use client";

/**
 * @file WorkflowPopover.tsx
 * @description 워크플로우 노드 클릭 시 팝오버 — 현황 통계 + 바로가기/역분개 버튼
 *
 * 초보자 가이드:
 * 1. 노드 클릭 시 오버레이 + 팝오버 표시
 * 2. 현황 통계 4칸 (대기/진행/완료/취소대기)
 * 3. 바로가기 버튼: 정방향 메뉴 이동
 * 4. 역분개 버튼: reversePath가 있을 때만 표시
 */
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import type { WorkflowNode } from "@/config/workflowConfig";

interface NodeCounts {
  pendingCnt: number;
  activeCnt: number;
  doneCnt: number;
  reverseCnt: number;
}

interface WorkflowPopoverProps {
  node: WorkflowNode;
  counts: NodeCounts;
  onClose: () => void;
}

export default function WorkflowPopover({ node, counts, onClose }: WorkflowPopoverProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const stats = [
    { value: counts.pendingCnt, labelKey: "workflow.popover.pendingCnt", color: "text-amber-500" },
    { value: counts.activeCnt, labelKey: "workflow.popover.activeCnt", color: "text-blue-500" },
    { value: counts.doneCnt, labelKey: "workflow.popover.doneCnt", color: "text-green-500" },
    { value: counts.reverseCnt, labelKey: "workflow.popover.reverseCnt", color: "text-red-500" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl p-5 w-[360px] border border-gray-200
          dark:border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
          <span className={node.color}>●</span>
          {t(node.labelKey)}
        </h3>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {stats.map((s) => (
            <div key={s.labelKey} className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2.5 text-center">
              <div className={`text-xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-text-muted">{t(s.labelKey)}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-slate-700
              text-text hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            {t("workflow.action.close")}
          </button>
          {node.reversePath && (
            <button
              type="button"
              onClick={() => { onClose(); router.push(node.reversePath!); }}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-red-300 dark:border-red-700
                text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20
                hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              ↩ {t(node.reverseKey!)}
            </button>
          )}
          <button
            type="button"
            onClick={() => { onClose(); router.push(node.path); }}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white
              hover:bg-primary/90 transition-colors"
          >
            {t("workflow.action.goTo")} →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/\(authenticated\)/workflow/components/WorkflowPopover.tsx
git commit -m "feat(workflow): add WorkflowPopover component with stats and reverse action"
```

---

### Task 9: Create WorkflowCard component

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/components/WorkflowCard.tsx`

- [ ] **Step 1: Create the WorkflowCard component**

```typescript
"use client";

/**
 * @file WorkflowCard.tsx
 * @description 워크플로우 카드 — 하나의 업무 프로세스 흐름을 표시하는 카드
 *
 * 초보자 가이드:
 * 1. 카드 헤더: 아이콘 + 제목 + 진행중 건수 배지
 * 2. 카드 본문: WorkflowNode들을 수평으로 배치, 화살표로 연결
 * 3. 분기가 있는 위치에 WorkflowBranch 배지 삽입
 * 4. 노드 클릭 시 WorkflowPopover 표시
 */
import { useState, useCallback, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui";
import type { WorkflowDefinition, WorkflowNode as NodeDef } from "@/config/workflowConfig";
import WorkflowNode from "./WorkflowNode";
import WorkflowBranch from "./WorkflowBranch";
import WorkflowPopover from "./WorkflowPopover";

interface NodeCounts {
  pendingCnt: number;
  activeCnt: number;
  doneCnt: number;
  reverseCnt: number;
}

interface WorkflowCardProps {
  workflow: WorkflowDefinition;
  counts: Record<string, NodeCounts>;
}

const EMPTY_COUNTS: NodeCounts = { pendingCnt: 0, activeCnt: 0, doneCnt: 0, reverseCnt: 0 };

export default function WorkflowCard({ workflow, counts }: WorkflowCardProps) {
  const { t } = useTranslation();
  const [selectedNode, setSelectedNode] = useState<NodeDef | null>(null);

  const totalActive = Object.values(counts).reduce(
    (sum, c) => sum + c.pendingCnt + c.activeCnt, 0,
  );

  const handleNodeClick = useCallback((node: NodeDef) => {
    setSelectedNode(node);
  }, []);

  const branchMap = new Map(
    (workflow.branches ?? []).map((b) => [b.afterNodeId, b]),
  );

  return (
    <>
      <Card
        padding="sm"
        className={`relative overflow-hidden border-l-4 ${workflow.accent}`}
      >
        <CardContent>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{workflow.icon}</span>
              <span className="text-sm font-bold text-text">
                {t(workflow.titleKey)}
              </span>
            </div>
            {totalActive > 0 && (
              <span className={`${workflow.badgeColor} text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full`}>
                {totalActive}{t("workflow.activeSuffix")}
              </span>
            )}
          </div>

          {/* Flow */}
          <div className="flex items-stretch gap-1.5 min-h-0 overflow-x-auto">
            {workflow.nodes.map((node, idx) => (
              <Fragment key={node.id}>
                {idx > 0 && !branchMap.has(workflow.nodes[idx - 1].id) && (
                  <div className="flex items-center text-gray-400 dark:text-slate-600 text-sm shrink-0">→</div>
                )}
                {idx > 0 && branchMap.has(workflow.nodes[idx - 1].id) && (
                  <WorkflowBranch branch={branchMap.get(workflow.nodes[idx - 1].id)!} />
                )}
                <WorkflowNode
                  labelKey={node.labelKey}
                  statusKey={node.statusKey}
                  color={node.color}
                  counts={counts[node.id] ?? EMPTY_COUNTS}
                  onClick={() => handleNodeClick(node)}
                />
              </Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Popover */}
      {selectedNode && (
        <WorkflowPopover
          node={selectedNode}
          counts={counts[selectedNode.id] ?? EMPTY_COUNTS}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/\(authenticated\)/workflow/components/WorkflowCard.tsx
git commit -m "feat(workflow): add WorkflowCard component with flow layout and popover"
```

---

### Task 10: Create workflow page

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/workflow/page.tsx`

- [ ] **Step 1: Create the workflow page**

```typescript
"use client";

/**
 * @file src/app/(authenticated)/workflow/page.tsx
 * @description 워크플로우 페이지 — 7개 업무 프로세스 흐름을 대시보드 그리드로 표시
 *
 * 초보자 가이드:
 * 1. workflowConfigs에서 7개 워크플로우 정의를 로드
 * 2. GET /workflow/summary API로 노드별 건수 조회
 * 3. WorkflowCard 컴포넌트로 각 워크플로우를 2열 그리드에 배치
 * 4. 새로고침 버튼으로 데이터 갱신
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { workflowConfigs } from "@/config/workflowConfig";
import WorkflowCard from "./components/WorkflowCard";
import api from "@/services/api";

interface NodeCounts {
  pendingCnt: number;
  activeCnt: number;
  doneCnt: number;
  reverseCnt: number;
}

type SummaryData = Record<string, Record<string, NodeCounts>>;

export default function WorkflowPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<SummaryData>({});
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/workflow/summary");
      setSummary(res.data?.data ?? {});
    } catch (error: unknown) {
      console.error("Workflow summary fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-primary" />
            {t("workflow.title")}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {t("workflow.subtitle")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchSummary}
          disabled={loading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {t("workflow.refresh")}
        </Button>
      </div>

      {/* Workflow grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {workflowConfigs.map((wf) => (
          <div key={wf.id} className={wf.fullWidth ? "lg:col-span-2" : ""}>
            <WorkflowCard
              workflow={wf}
              counts={summary[wf.id] ?? {}}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend build**

Run: `cd C:/Project/HANES && pnpm build 2>&1 | tail -10`
Expected: Build succeeds with 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/\(authenticated\)/workflow/
git commit -m "feat(workflow): add workflow page with grid layout and API integration"
```

---

### Task 11: Final verification

- [ ] **Step 1: Verify backend API**

Run: `curl -s http://localhost:3003/api/v1/workflow/summary | python -m json.tool | head -30`
Expected: JSON with workflow/node counts

- [ ] **Step 2: Verify frontend build**

Run: `cd C:/Project/HANES && pnpm build 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Verify i18n completeness**

Run: `cd C:/Project/HANES && node -e "['ko','en','zh','vi'].forEach(l => { const d=JSON.parse(require('fs').readFileSync('apps/frontend/src/locales/'+l+'.json','utf8')); console.log(l+':', d.workflow ? 'workflow OK' : 'MISSING', d.menu?.workflow ? 'menu OK' : 'MISSING') })"`
Expected: All 4 show "workflow OK" and "menu OK"

- [ ] **Step 4: Browser test**

Open `http://localhost:3002/workflow` and verify:
1. Sidebar shows "워크플로우" menu after 대시보드
2. 7 cards displayed in 2-column grid
3. Each card shows step flow with node counts
4. Clicking a node opens popover with stats and action buttons
5. "바로가기" button navigates to the correct menu page
6. Reverse button (↩) shows only on nodes with reversePath

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(workflow): complete workflow menu implementation"
```
