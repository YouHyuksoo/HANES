# 박스별출하 화면 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/shipping/confirm` 화면을 팔레트 출하에서 **박스 단위 출하** 전용 화면("박스별출하")으로 재구성한다.

**Architecture:** 출하지시(Ship Order) 기준. 좌(출하지시) / 중(출하가능 박스·라인 진행률) / 우(박스 시리얼 상세) 3-컬럼 개요 화면을 만들고, 실제 출하는 **기존 고아 컴포넌트 `BoxScanShipModal`을 재사용**한다(ship-box / cancel-ship-box). 백엔드 변경 없음.

**Tech Stack:** Next.js(App Router) + React + TypeScript, react-i18next, `@tanstack/react-table` 기반 `DataGrid`, axios(`@/services/api`).

## Global Constraints

- 패키지 매니저는 `pnpm`. dev 서버 가동 중이면 `pnpm build` 금지 → 타입체크는 `pnpm --filter @harness/frontend exec tsc --noEmit`.
- i18n는 **ko/en/zh/vi 4파일 동시** 수정. JSON에 UTF-8 BOM 금지.
- `alert()/confirm()/prompt()` 금지(모달 사용). 상태 텍스트·색상 하드코딩 지양(가능하면 배지 컴포넌트).
- `catch (error: unknown)` 유지, `as any` 지양, 에러를 기본값 문자열로 숨기지 않기.
- 라우트 `/shipping/confirm`와 메뉴코드 `SHIP_CONFIRM`는 **유지**(RBAC 보존). 변경하지 않는다.
- LOCKS.md 기준 본 작업 파일(아래)은 shipping 모듈로 현재 잠금 없음. 편집 전 `LOCKS.md`에 클레임 기록.
- 백엔드 변경 없음: `ship-box`, `cancel-ship-box`, `fulfillment`, `box-stock/{boxNo}/serials`는 기존 그대로 사용.

## 파일 구조

- Modify: `apps/frontend/src/locales/ko.json` — 메뉴 라벨 `shipping.confirm` 변경 + `shipping.confirm.*` 페이지 키 + `shipping.boxScan.*` 모달 키.
- Modify: `apps/frontend/src/locales/en.json` / `zh.json` / `vi.json` — 동일 키 동기화.
- Rewrite: `apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx` — 박스별출하 3-컬럼 화면.
- Delete: `apps/frontend/src/app/(authenticated)/shipping/confirm/OrderFulfillmentModal.tsx` — 팔레트 구성 모달(미사용화).
- Create: `apps/frontend/src/app/(authenticated)/shipping/confirm/box-ship-page.structure.test.mjs` — 페이지 구조 회귀 테스트.

재사용(수정 없음): `apps/frontend/src/components/shipping/BoxScanShipModal.tsx`, `StatusBadge.tsx`, `@/components/data-grid/DataGrid`.

참고 스펙: `docs/superpowers/specs/2026-06-22-box-shipping-confirm-design.md`.

---

### Task 1: i18n 키 (메뉴 라벨 변경 + 박스출하 키 추가, 4파일)

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

**Interfaces:**
- Produces: i18n 키 `menu`의 `"shipping.confirm"`(라벨), 중첩 `shipping.confirm.*`(페이지), `shipping.boxScan.*`(모달). Task 2의 `t(...)` 호출이 이 키들을 소비한다.

- [ ] **Step 1: ko.json 메뉴 라벨 변경**

`apps/frontend/src/locales/ko.json`에서 메뉴 평면키(파일 상단 `menu` 블록, "출하작업"으로 검색되는 `"shipping.confirm"`)를 변경:

```json
    "shipping.confirm": "박스별출하",
```

- [ ] **Step 2: ko.json 페이지 키(`shipping.confirm.*`) 갱신/추가**

`shipping.confirm` 중첩 블록(현재 `"title": "출하작업"` 등이 있는 블록)에서 아래 키를 추가/수정한다. 기존 팔레트·Shipment 전용 키는 남겨도 무방하나, 아래 키는 반드시 존재해야 한다:

```json
      "title": "박스별출하",
      "description": "출하지시 기준으로 박스를 스캔하여 박스 단위로 출하합니다.",
      "boxNo": "박스번호",
      "item": "품목",
      "qty": "수량",
      "boxScanShip": "박스출하 스캔",
      "shipOrderList": "출하지시 목록",
      "candidateBoxes": "출하가능 박스",
      "boxDetail": "박스 상세",
      "lineProgress": "품목 진행",
      "selectOrder": "출하지시를 선택하세요",
      "selectBox": "박스를 선택하면 시리얼을 확인할 수 있습니다.",
      "noCandidateBoxes": "출하가능한 박스가 없습니다.",
      "noUnshippedOrders": "미출하 출하지시가 없습니다.",
      "loadOrdersFailed": "출하지시 목록을 불러오지 못했습니다.",
      "loadFulfillmentFailed": "출하정보를 불러오지 못했습니다.",
      "loadSerialsFailed": "박스 시리얼을 불러오지 못했습니다."
```

- [ ] **Step 3: ko.json 모달 키(`shipping.boxScan.*`) 등재**

`BoxScanShipModal`이 사용하는 키를 `shipping` 블록에 `boxScan` 중첩으로 추가(없으면 신설). 이미 존재하면 누락분만 보강:

```json
    "boxScan": {
      "title": "박스 스캔 출하",
      "shipOrderNo": "출하지시번호",
      "scanOrder": "출하지시 바코드 스캔/입력",
      "customer": "고객사",
      "boxNo": "박스 바코드",
      "scanBox": "박스 바코드 스캔",
      "duplicate": "이미 스캔한 박스입니다.",
      "notConfirmed": "확정(CONFIRMED) 상태의 출하지시만 출하할 수 있습니다.",
      "orderNotFound": "출하지시를 찾을 수 없습니다.",
      "shipFailed": "출하 처리에 실패했습니다.",
      "cancelBox": "출하 취소",
      "cancelFailed": "출하 취소에 실패했습니다."
    },
```

- [ ] **Step 4: en.json 동일 키 동기화**

`en.json`에서 메뉴 평면키 변경 및 위 키들 추가:

```json
    "shipping.confirm": "Box Shipping",
```
페이지/모달 값(영문):
```json
      "title": "Box Shipping",
      "description": "Ship by box: scan boxes against a ship order.",
      "boxNo": "Box No",
      "item": "Item",
      "qty": "Qty",
      "boxScanShip": "Scan Box to Ship",
      "shipOrderList": "Ship Orders",
      "candidateBoxes": "Shippable Boxes",
      "boxDetail": "Box Detail",
      "lineProgress": "Item Progress",
      "selectOrder": "Select a ship order",
      "selectBox": "Select a box to view its serials.",
      "noCandidateBoxes": "No shippable boxes.",
      "noUnshippedOrders": "No unshipped ship orders.",
      "loadOrdersFailed": "Failed to load ship orders.",
      "loadFulfillmentFailed": "Failed to load fulfillment info.",
      "loadSerialsFailed": "Failed to load box serials."
```
```json
    "boxScan": {
      "title": "Scan Box to Ship",
      "shipOrderNo": "Ship Order No",
      "scanOrder": "Scan/enter ship order barcode",
      "customer": "Customer",
      "boxNo": "Box Barcode",
      "scanBox": "Scan box barcode",
      "duplicate": "Box already scanned.",
      "notConfirmed": "Only CONFIRMED ship orders can be shipped.",
      "orderNotFound": "Ship order not found.",
      "shipFailed": "Failed to ship.",
      "cancelBox": "Cancel shipment",
      "cancelFailed": "Failed to cancel shipment."
    },
```

- [ ] **Step 5: zh.json 동일 키 동기화**

```json
    "shipping.confirm": "按箱出货",
```
```json
      "title": "按箱出货",
      "description": "按出货指示扫描箱号，以箱为单位出货。",
      "boxNo": "箱号",
      "item": "物料",
      "qty": "数量",
      "boxScanShip": "扫描箱号出货",
      "shipOrderList": "出货指示列表",
      "candidateBoxes": "可出货箱",
      "boxDetail": "箱明细",
      "lineProgress": "物料进度",
      "selectOrder": "请选择出货指示",
      "selectBox": "选择箱号可查看序列号。",
      "noCandidateBoxes": "没有可出货的箱。",
      "noUnshippedOrders": "没有未出货的出货指示。",
      "loadOrdersFailed": "无法加载出货指示列表。",
      "loadFulfillmentFailed": "无法加载出货信息。",
      "loadSerialsFailed": "无法加载箱序列号。"
```
```json
    "boxScan": {
      "title": "扫描箱号出货",
      "shipOrderNo": "出货指示号",
      "scanOrder": "扫描/输入出货指示条码",
      "customer": "客户",
      "boxNo": "箱条码",
      "scanBox": "扫描箱条码",
      "duplicate": "该箱已扫描。",
      "notConfirmed": "只有已确认(CONFIRMED)的出货指示才能出货。",
      "orderNotFound": "未找到出货指示。",
      "shipFailed": "出货处理失败。",
      "cancelBox": "取消出货",
      "cancelFailed": "取消出货失败。"
    },
```

- [ ] **Step 6: vi.json 동일 키 동기화**

```json
    "shipping.confirm": "Xuất hàng theo thùng",
```
```json
      "title": "Xuất hàng theo thùng",
      "description": "Xuất theo thùng: quét thùng theo lệnh xuất hàng.",
      "boxNo": "Số thùng",
      "item": "Mặt hàng",
      "qty": "Số lượng",
      "boxScanShip": "Quét thùng để xuất",
      "shipOrderList": "Danh sách lệnh xuất",
      "candidateBoxes": "Thùng có thể xuất",
      "boxDetail": "Chi tiết thùng",
      "lineProgress": "Tiến độ mặt hàng",
      "selectOrder": "Chọn một lệnh xuất hàng",
      "selectBox": "Chọn thùng để xem số sê-ri.",
      "noCandidateBoxes": "Không có thùng nào để xuất.",
      "noUnshippedOrders": "Không có lệnh xuất hàng chưa xuất.",
      "loadOrdersFailed": "Không tải được danh sách lệnh xuất.",
      "loadFulfillmentFailed": "Không tải được thông tin xuất hàng.",
      "loadSerialsFailed": "Không tải được số sê-ri của thùng."
```
```json
    "boxScan": {
      "title": "Quét thùng để xuất",
      "shipOrderNo": "Số lệnh xuất hàng",
      "scanOrder": "Quét/nhập mã vạch lệnh xuất hàng",
      "customer": "Khách hàng",
      "boxNo": "Mã vạch thùng",
      "scanBox": "Quét mã vạch thùng",
      "duplicate": "Thùng đã được quét.",
      "notConfirmed": "Chỉ lệnh xuất hàng đã xác nhận (CONFIRMED) mới được xuất.",
      "orderNotFound": "Không tìm thấy lệnh xuất hàng.",
      "shipFailed": "Xuất hàng thất bại.",
      "cancelBox": "Hủy xuất hàng",
      "cancelFailed": "Hủy xuất hàng thất bại."
    },
```

> 주의: 각 파일에서 `boxScan` 블록을 추가할 때 JSON 쉼표/중괄호 정합성 유지. 기존에 `boxScan`이 이미 있으면 새로 만들지 말고 누락 키만 보강.

- [ ] **Step 7: 4파일 JSON 유효성 + 키 동기화 검증**

Run:
```bash
cd /c/Project/HANES/apps/frontend/src/locales && for f in ko en zh vi; do node -e "JSON.parse(require('fs').readFileSync('$f.json','utf8')); console.log('$f ok')"; done && grep -l "박스별출하\|Box Shipping\|按箱出货\|Xuất hàng theo thùng" ko.json en.json zh.json vi.json
```
Expected: `ko ok / en ok / zh ok / vi ok` 4줄 + 4개 파일이 각각 매칭. JSON 파싱 에러 0건.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F - <<'EOF'
i18n(shipping): 박스별출하 메뉴 라벨·페이지·박스스캔 키 추가 (ko/en/zh/vi)

menu.shipping.confirm 라벨을 박스별출하로 변경하고 shipping.confirm.*
페이지 키와 shipping.boxScan.* 모달 키를 4개 언어에 등재.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: page.tsx 박스별출하 재구성 + OrderFulfillmentModal 삭제

**Files:**
- Rewrite: `apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx`
- Delete: `apps/frontend/src/app/(authenticated)/shipping/confirm/OrderFulfillmentModal.tsx`
- Test: `apps/frontend/src/app/(authenticated)/shipping/confirm/box-ship-page.structure.test.mjs`

**Interfaces:**
- Consumes: i18n 키(Task 1). `BoxScanShipModal` props `{ isOpen, onClose, onShipped?, initialShipOrderNo? }`(기존). API: `GET /shipping/orders?status=CONFIRMED&limit=200`(응답 `data: ShipOrderSummary[]`, 각 항목 `items: {itemCode,itemName?,orderQty,shippedQty}[]`), `GET /shipping/orders/{id}/fulfillment`(응답 `data: { order, lines: {itemCode,itemName?,orderQty,shippedQty,remainingQty}[], candidateBoxes: {boxNo,itemCode,qty,oqcStatus?}[] }`), `GET /shipping/box-stock/{boxNo}/serials`(응답 `data: {seq,fgBarcode,itemCode,itemName?,status?,inspectPassYn?,issuedAt?,receivedAt?}[]`).
- Produces: 기본 export `BoxShipPage`(React 컴포넌트). 라우트 `/shipping/confirm`.

- [ ] **Step 1: 구조 회귀 테스트 작성(실패 확인용)**

Create `apps/frontend/src/app/(authenticated)/shipping/confirm/box-ship-page.structure.test.mjs`:

```js
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("box ship page reuses BoxScanShipModal and ship-order fulfillment", () => {
  // 박스 스캔 출하 모달 재사용
  assert.match(source, /BoxScanShipModal/);
  assert.match(source, /initialShipOrderNo=\{selectedOrderNo/);
  // 출하지시 기준 데이터 소스
  assert.match(source, /\/shipping\/orders/);
  assert.match(source, /\/fulfillment/);
  assert.match(source, /box-stock\//);
  // 팔레트/Shipment 잔재 제거
  assert.doesNotMatch(source, /OrderFulfillmentModal/);
  assert.doesNotMatch(source, /ShipmentScanModal/);
  assert.doesNotMatch(source, /\/shipping\/shipments/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/box-ship-page.structure.test.mjs"`
Expected: FAIL — 현재 `page.tsx`가 `OrderFulfillmentModal`/`ShipmentScanModal`/`/shipping/shipments`를 포함하고 `BoxScanShipModal`을 포함하지 않으므로 assert 실패.

- [ ] **Step 3: page.tsx 전체 재작성**

`apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx`를 아래 내용으로 **전체 교체**:

```tsx
"use client";

/**
 * @file src/app/(authenticated)/shipping/confirm/page.tsx
 * @description 박스별출하 - 출하지시 기준으로 박스를 스캔하여 박스 단위로 출하 확정
 *
 * 워크플로우:
 * 1. 좌측에서 미출하 출하지시(CONFIRMED, 잔여>0)를 선택한다.
 * 2. 중앙에 라인 진행률과 출하가능 박스(CLOSED+OQC PASS+팔레트 미적재)가 표시된다.
 * 3. "박스출하 스캔" → BoxScanShipModal에서 박스 바코드를 스캔해 박스 단위로 즉시 출하한다.
 *
 * 팔레트 출하는 별도 화면(/shipping/pallet, /shipping/pallet-ship)을 사용한다.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Truck, RefreshCw, Package, ScanLine, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { BoxScanShipModal } from "@/components/shipping";
import api from "@/services/api";

interface ShipOrderLineSummary {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
}
interface ShipOrderSummary {
  shipOrderNo: string;
  customerName?: string | null;
  shipDate?: string | null;
  dueDate?: string | null;
  status: string;
  items: ShipOrderLineSummary[];
}
interface OrderLine {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
  remainingQty: number;
}
interface CandidateBox {
  boxNo: string;
  itemCode: string;
  qty: number;
  oqcStatus?: string | null;
}
interface FulfillmentData {
  order: { shipOrderNo: string; customerName?: string | null; shipDate?: string | null; dueDate?: string | null };
  lines: OrderLine[];
  candidateBoxes: CandidateBox[];
}
interface BoxSerial {
  seq: number;
  fgBarcode: string;
  itemCode: string;
  itemName?: string | null;
  status?: string | null;
  inspectPassYn?: string | null;
  issuedAt?: string | null;
  receivedAt?: string | null;
}

function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function BoxShipPage() {
  const { t } = useTranslation();

  const [orders, setOrders] = useState<ShipOrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentData | null>(null);
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);
  const [selectedBox, setSelectedBox] = useState<CandidateBox | null>(null);
  const [serials, setSerials] = useState<BoxSerial[]>([]);
  const [serialsLoading, setSerialsLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [pageError, setPageError] = useState("");

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await api.get("/shipping/orders", { params: { status: "CONFIRMED", limit: "200" } });
      const list: ShipOrderSummary[] = res.data?.data ?? [];
      const unshipped = list.filter((o) => o.items?.some((it) => it.orderQty > it.shippedQty));
      setOrders(unshipped);
      setSelectedOrderNo((cur) => (cur && unshipped.some((o) => o.shipOrderNo === cur) ? cur : null));
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.confirm.loadOrdersFailed", "출하지시 목록을 불러오지 못했습니다.")));
    } finally {
      setOrdersLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const fetchFulfillment = useCallback(async (orderNo: string) => {
    setFulfillmentLoading(true);
    setFulfillment(null);
    setSelectedBox(null);
    setSerials([]);
    try {
      const res = await api.get(`/shipping/orders/${encodeURIComponent(orderNo)}/fulfillment`);
      setFulfillment(res.data?.data ?? null);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.confirm.loadFulfillmentFailed", "출하정보를 불러오지 못했습니다.")));
    } finally {
      setFulfillmentLoading(false);
    }
  }, [t]);

  const selectOrder = useCallback((orderNo: string) => {
    setSelectedOrderNo(orderNo);
    fetchFulfillment(orderNo);
  }, [fetchFulfillment]);

  const fetchSerials = useCallback(async (box: CandidateBox) => {
    setSelectedBox(box);
    setSerialsLoading(true);
    setSerials([]);
    try {
      const res = await api.get(`/shipping/box-stock/${encodeURIComponent(box.boxNo)}/serials`);
      setSerials(res.data?.data ?? []);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.confirm.loadSerialsFailed", "박스 시리얼을 불러오지 못했습니다.")));
    } finally {
      setSerialsLoading(false);
    }
  }, [t]);

  const handleShipped = useCallback(() => {
    fetchOrders();
    if (selectedOrderNo) fetchFulfillment(selectedOrderNo);
  }, [fetchOrders, fetchFulfillment, selectedOrderNo]);

  const candidateColumns = useMemo<ColumnDef<CandidateBox>[]>(() => [
    { accessorKey: "boxNo", header: t("shipping.confirm.boxNo", "박스번호"), size: 190, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono font-medium">{getValue() as string}</span> },
    { accessorKey: "itemCode", header: t("shipping.confirm.item", "품목"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "qty", header: t("shipping.confirm.qty", "수량"), size: 90, meta: { align: "right" as const, filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "oqcStatus", header: "OQC", size: 80, meta: { align: "center" as const }, cell: ({ getValue }) => <span className="text-xs font-medium text-text">{(getValue() as string) ?? "-"}</span> },
  ], [t]);

  const candidateBoxes = fulfillment?.candidateBoxes ?? [];
  const lines = fulfillment?.lines ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Truck className="w-7 h-7 text-primary" />{t("shipping.confirm.title", "박스별출하")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.confirm.description", "출하지시 기준으로 박스를 스캔하여 박스 단위로 출하합니다.")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleShipped}>
            <RefreshCw className={`w-4 h-4 mr-1 ${ordersLoading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" disabled={!selectedOrderNo} onClick={() => setScanOpen(true)}>
            <ScanLine className="w-4 h-4 mr-1" />{t("shipping.confirm.boxScanShip", "박스출하 스캔")}
          </Button>
        </div>
      </div>

      {pageError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex-shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" /><span className="flex-1">{pageError}</span>
          <button onClick={() => setPageError("")}><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* body: three-column */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_320px] gap-6 flex-1 min-h-0 overflow-hidden">
        {/* left: order list */}
        <Card className="overflow-hidden flex flex-col min-h-0" padding="none">
          <CardContent className="h-full p-3 flex flex-col overflow-hidden">
            <div className="mb-2 flex-shrink-0">
              <h2 className="text-sm font-semibold text-text">{t("shipping.confirm.shipOrderList", "출하지시 목록")}</h2>
              <p className="mt-0.5 text-xs text-text-muted">{ordersLoading ? t("common.loading", "로딩 중...") : `${orders.length}`}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {orders.length === 0 && !ordersLoading ? (
                <div className="text-center py-8 text-text-muted text-sm">{t("shipping.confirm.noUnshippedOrders", "미출하 출하지시가 없습니다.")}</div>
              ) : (
                <div className="space-y-1">
                  {orders.map((o) => {
                    const remaining = o.items.reduce((s, it) => s + Math.max(0, it.orderQty - it.shippedQty), 0);
                    return (
                      <button
                        key={o.shipOrderNo}
                        type="button"
                        onClick={() => selectOrder(o.shipOrderNo)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedOrderNo === o.shipOrderNo
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:bg-background"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-text text-sm truncate">{o.shipOrderNo}</span>
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium border border-primary text-primary bg-primary/5">{o.status}</span>
                        </div>
                        {o.customerName && <p className="text-xs text-text-muted mt-0.5 truncate">{o.customerName}</p>}
                        {o.dueDate && <p className="text-xs text-text-muted mt-0.5">{String(o.dueDate).slice(0, 10)}</p>}
                        <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5">
                          <Package className="w-3 h-3" />{t("shipping.confirm.qty", "수량")} {remaining.toLocaleString()}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* center: line progress + candidate boxes */}
        <Card className="min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-3 flex flex-col gap-3">
          <div className="flex-shrink-0">
            <h2 className="text-sm font-semibold text-text">{t("shipping.confirm.candidateBoxes", "출하가능 박스")}</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {!selectedOrderNo ? t("shipping.confirm.selectOrder", "출하지시를 선택하세요") : fulfillmentLoading ? t("common.loading", "로딩 중...") : `${candidateBoxes.length}`}
            </p>
          </div>

          {/* line progress */}
          {selectedOrderNo && lines.length > 0 && (
            <div className="flex-shrink-0 rounded-lg border border-border p-2 space-y-1">
              <p className="text-xs font-semibold text-text-muted">{t("shipping.confirm.lineProgress", "품목 진행")}</p>
              {lines.map((l) => (
                <div key={l.itemCode} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-text truncate">{l.itemCode}{l.itemName ? ` (${l.itemName})` : ""}</span>
                  <span className={l.remainingQty === 0 ? "text-text-muted" : "text-primary font-medium"}>
                    {l.shippedQty.toLocaleString()} / {l.orderQty.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!selectedOrderNo ? (
            <div className="flex-1 flex items-center justify-center text-text-muted">
              <Package className="w-12 h-12 opacity-50" />
            </div>
          ) : fulfillmentLoading ? (
            <div className="flex-1 flex items-center justify-center text-text-muted">{t("common.loading", "로딩 중...")}</div>
          ) : candidateBoxes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-text-muted text-sm">{t("shipping.confirm.noCandidateBoxes", "출하가능한 박스가 없습니다.")}</div>
          ) : (
            <div className="flex-1 min-h-0">
              <DataGrid
                data={candidateBoxes}
                columns={candidateColumns}
                enableColumnFilter
                enableExport
                exportFileName={`박스출하_${selectedOrderNo}`}
                onRowClick={(row) => fetchSerials(row)}
              />
            </div>
          )}
        </CardContent></Card>

        {/* right: selected box serials */}
        <Card padding="none">
          <CardContent className="p-3 h-full flex flex-col min-h-0">
            <div className="mb-2 flex-shrink-0">
              <h2 className="text-sm font-semibold text-text">{t("shipping.confirm.boxDetail", "박스 상세")}</h2>
              <p className="mt-0.5 text-xs text-text-muted">{selectedBox ? `${selectedBox.boxNo} · ${selectedBox.qty.toLocaleString()}` : ""}</p>
            </div>
            {!selectedBox ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
                <Package className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm text-center">{t("shipping.confirm.selectBox", "박스를 선택하면 시리얼을 확인할 수 있습니다.")}</p>
              </div>
            ) : serialsLoading ? (
              <div className="flex-1 flex items-center justify-center text-text-muted">{t("common.loading", "로딩 중...")}</div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                {serials.map((s) => (
                  <div key={s.fgBarcode} className="flex items-center justify-between p-2 bg-background rounded text-sm">
                    <span className="font-mono text-xs text-text truncate">{s.fgBarcode}</span>
                    <span className="text-xs text-text-muted shrink-0">{s.status ?? "-"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* box scan ship modal (reused) */}
      <BoxScanShipModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        onShipped={handleShipped}
        initialShipOrderNo={selectedOrderNo ?? undefined}
      />
    </div>
  );
}
```

- [ ] **Step 4: OrderFulfillmentModal.tsx 삭제**

Run:
```bash
git rm "apps/frontend/src/app/(authenticated)/shipping/confirm/OrderFulfillmentModal.tsx"
```
Expected: 파일 삭제. (Task 2 Step 3에서 import를 제거했으므로 잔존 참조 없음.)

- [ ] **Step 5: 구조 테스트 통과 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/box-ship-page.structure.test.mjs"`
Expected: PASS — `BoxScanShipModal`/`fulfillment`/`box-stock` 포함, `OrderFulfillmentModal`/`ShipmentScanModal`/`/shipping/shipments` 미포함.

- [ ] **Step 6: 타입체크**

> dev 서버 가동 중이면 `pnpm build` 금지. 타입체크만 수행.

Run: `cd /c/Project/HANES && pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건. (특히 `confirm/page.tsx`, 삭제된 `OrderFulfillmentModal` 잔존 참조 관련 에러 없음.)

- [ ] **Step 7: Commit**

```bash
git add "apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx" "apps/frontend/src/app/(authenticated)/shipping/confirm/box-ship-page.structure.test.mjs"
git add -A "apps/frontend/src/app/(authenticated)/shipping/confirm/"
git commit -F - <<'EOF'
feat(shipping): 출하확정 화면을 박스별출하로 재구성

/shipping/confirm을 출하지시 기준 박스 단위 출하 화면으로 재구성.
좌(출하지시)/중(출하가능 박스·라인 진행률)/우(박스 시리얼) 3-컬럼,
출하는 기존 BoxScanShipModal 재사용(ship-box/cancel-ship-box).
팔레트 구성 모달(OrderFulfillmentModal)·Shipment 패널 제거.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: 통합 검증 + i18n 누락 점검

**Files:** (검증 전용, 코드 변경 없음 — 누락 발견 시 해당 Task로 회귀)

- [ ] **Step 1: i18n 누락 키 전수 점검**

Run: `cd /c/Project/HANES && node scripts/find_missing_i18n.js`
Expected: 본 작업으로 추가한 `shipping.confirm.*` / `shipping.boxScan.*` 키가 4개 언어에서 누락 0건. (누락 보고 시 Task 1로 회귀해 해당 언어 파일 보강.)

- [ ] **Step 2: 메뉴 라벨 노출 확인(소스 레벨)**

Run: `grep -n "박스별출하" apps/frontend/src/locales/ko.json`
Expected: 메뉴 평면키 `"shipping.confirm": "박스별출하"`와 페이지 `"title": "박스별출하"` 매칭. `menuConfig.ts`는 `labelKey: "menu.shipping.confirm"` 그대로(수정 불필요) — 라우트/메뉴코드 유지 확인.

- [ ] **Step 3: 프런트 전체 타입체크 재확인**

Run: `cd /c/Project/HANES && pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 4: 수동 UI 흐름 검증 (dev 서버 :3002)**

> 사용자 환경에서 수행. 체크리스트:
> 1. 좌측 메뉴 "출하관리 > 박스별출하" 라벨 확인, `/shipping/confirm` 진입.
> 2. 좌측 출하지시 목록(CONFIRMED·잔여>0) 표시 → 지시 선택.
> 3. 중앙에 라인 진행률 + 출하가능 박스 목록 표시, 박스 행 클릭 → 우측 시리얼 표시.
> 4. "박스출하 스캔" → 모달에서 박스 바코드 스캔 → 출하 성공, 라인 진행률 증가, 목록/그리드 갱신.
> 5. 모달 내 행 취소 버튼 → 출하 취소, 재고·진행률 복원.
> 6. 전 라인 완출 시 해당 지시가 목록에서 사라짐(지시 CLOSED).

- [ ] **Step 5: 협업 보드 정리 + HANDOFF 갱신**

`.ai-coordination/LOCKS.md`에서 본 작업 lock 제거, `JOURNAL.md`/`ARCHIVE.md`에 결과 한 줄 기록, `HANDOFF/claude.md` 갱신. (별도 커밋: 협업 변경은 기능 커밋과 분리.)

---

## Self-Review

- **Spec coverage:**
  - §1 메뉴/라우트 → Task 1(Step 1 라벨), Task 3(Step 2 라우트 유지 확인). ✅
  - §2 3-컬럼 레이아웃 → Task 2 Step 3. ✅
  - §3 백엔드 계약 재사용 → Task 2(API 호출). ✅
  - §4-1 OQC 불일치(후보 기준 가드, 서버 위임) → 그리드는 정보 표시, 출하는 모달=서버 검증. ✅
  - §4-2 출하완료 박스 조회 불가 → 취소는 모달 세션 행 기반. ✅
  - §5.2 BoxScanShipModal 재사용 → Task 2 Step 3 + 구조 테스트. ✅
  - §5.3 별도 취소 모달 없음 → 모달 내 취소. ✅
  - §7 OrderFulfillmentModal 삭제·Shipment 패널 제거 → Task 2 Step 3/4 + 구조 테스트 doesNotMatch. ✅
  - §8 i18n 4파일 → Task 1, Task 3 Step 1. ✅
  - §9 범위 밖(Shipment 생명주기 UI 이전, OQC 정합화, BoxMaster.shipOrderNo) → 미포함(의도적). ✅
- **Placeholder scan:** TBD/TODO 없음. 모든 코드 스텝에 완전한 코드 포함. ✅
- **Type consistency:** `ShipOrderSummary.items`(목록) vs `FulfillmentData.lines`(상세) 구분, `CandidateBox`/`BoxSerial` 필드가 Task 2 코드와 일치. `BoxScanShipModal` props는 기존 시그니처와 일치. ✅

## Execution Handoff

(스킬 지시에 따라 계획 저장 후 실행 방식 선택을 사용자에게 제시.)
