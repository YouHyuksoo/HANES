# PDA 팔레트 출하 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDA에 "팔레트 출하" 화면을 추가해, 데스크톱과 동일한 프로세스(출하지시 스캔 → 팔레트 생성 → 박스 스캔 적재 → 마감 → 출하)를 스캔/선택 위주 UI로 처리한다.

**Architecture:** 백엔드는 기존 ship-order 팔레트 엔드포인트를 그대로 재사용(변경 0, 단 RBAC 상수 1줄 추가). PDA 프론트는 phase 상태머신 훅 `usePalletShipScan` + 페이지 `app/pda/shipping-pallet`로 구성하며, 지시별 상태는 `GET /shipping/orders/:id/fulfillment` 단일 응답(order/lines/candidateBoxes/pallets)으로 동기화한다.

**Tech Stack:** Next.js(App Router) PDA PWA, react-i18next, axios(`@/services/api`), 기존 PDA 공통 위젯(PdaHeader/ScanInput/ScanResultCard/ScanHistoryList/PdaActionButton/useBarcodeDetector/useSoundFeedback). NestJS 백엔드 상수.

## Global Constraints

- 패키지 매니저 pnpm. 프론트 타입체크 `pnpm --filter @harness/frontend exec tsc --noEmit` 0. 백엔드 `pnpm --filter @harness/backend exec tsc --noEmit` 0.
- 개발 서버 구동 중이면 `pnpm build` 금지(타입체크만).
- `alert()/confirm()/prompt()` 금지. `as any` 금지. `catch (error: unknown)` 유지.
- UI 라벨은 `t("pda.palletShip.*", "한국어 fallback")` 패턴. locale JSON은 타 세션 락 가능 → **JSON 미수정, fallback 한국어로 동작**.
- 멀티테넌시: company/PLANT_CD는 백엔드가 헤더에서 스코프(프론트는 신경 안 씀).
- 커밋은 파일 단위 git add. 멀티라인 메시지는 임시파일 + `git commit -F`. push 금지. 브랜치 `feature/pda-pallet-ship`.
- 동일 프로세스/검증은 데스크톱과 같음 — 서버 검증 메시지를 그대로 표시. 새 비즈니스 로직/엔드포인트를 만들지 않는다.
- 출하지시당 팔레트 1개 모델(v1). 멀티팔레트/PDA 라벨출력/reopen은 비범위.

---

### Task 1: PDA 메뉴 등록 (RBAC 상수 + PDA 메뉴 항목)

**Files:**
- Modify: `apps/backend/src/modules/system/services/pda-role.service.ts` (PDA_MENU_CODES 상수)
- Modify: `apps/frontend/src/components/pda/pdaMenuConfig.ts` (pdaMainMenuItems)

**Interfaces:**
- Produces: 메뉴 코드 문자열 `"PDA_PALLET_SHIP"`, 경로 `/pda/shipping-pallet`, i18n 키 `pda.menu.palletShip`.

- [ ] **Step 1: 백엔드 PDA_MENU_CODES에 코드 추가**

`pda-role.service.ts`에서 `PDA_MENU_CODES` 배열/상수를 찾아 `'PDA_PALLET_SHIP'`을 추가한다. 먼저 현재 정의를 확인:

Run: `grep -n "PDA_MENU_CODES\|PDA_SHIPPING" apps/backend/src/modules/system/services/pda-role.service.ts`

배열에 기존 `'PDA_SHIPPING'` 항목 바로 뒤에 `'PDA_PALLET_SHIP',`를 추가한다(배열 리터럴 형식 유지). 예:

```ts
  'PDA_SHIPPING',
  'PDA_PALLET_SHIP',
```

- [ ] **Step 2: 백엔드 타입체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 3: 프론트 PDA 메뉴 항목 추가**

`apps/frontend/src/components/pda/pdaMenuConfig.ts`의 `pdaMainMenuItems` 배열에서 `PDA_SHIPPING`(출하) 항목 바로 뒤에 팔레트 출하 항목을 추가한다. 상단 import에 `Boxes` 아이콘을 추가한다(`lucide-react`).

import 수정:
```ts
import {
  Package,
  Truck,
  Boxes,
  Wrench,
  ClipboardCheck,
  PackagePlus,
  LogOut,
  Download,
  Upload,
  Settings2,
  FileSearch,
  type LucideIcon,
} from "lucide-react";
```

`pdaMainMenuItems`에서 shipping 항목 뒤에 추가:
```ts
  {
    labelKey: "pda.menu.palletShip",
    path: "/pda/shipping-pallet",
    icon: Boxes,
    borderClass: "border-emerald-200 dark:border-emerald-800",
    iconColorClass: "text-emerald-600 dark:text-emerald-400",
    menuCode: "PDA_PALLET_SHIP",
  },
```

- [ ] **Step 4: 프론트 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/modules/system/services/pda-role.service.ts apps/frontend/src/components/pda/pdaMenuConfig.ts
git commit -F <임시파일>
# 메시지: "feat(pda): 팔레트 출하 메뉴 등록(PDA_PALLET_SHIP) + RBAC 코드"
```

---

### Task 2: usePalletShipScan 훅 + 타입

**Files:**
- Create: `apps/frontend/src/hooks/pda/usePalletShipScan.types.ts`
- Create: `apps/frontend/src/hooks/pda/usePalletShipScan.ts`

**Interfaces:**
- Consumes: `@/services/api` (named `api`, axios 인스턴스, 응답 envelope `res.data.data`).
- Produces: `usePalletShipScan(): UsePalletShipScanReturn` 및 아래 타입들.

- [ ] **Step 1: 타입 파일 작성**

Create `apps/frontend/src/hooks/pda/usePalletShipScan.types.ts`:

```ts
/**
 * @file src/hooks/pda/usePalletShipScan.types.ts
 * @description PDA 팔레트 출하 스캔 워크플로우 타입
 */

export type PalletShipPhase = "SCAN_ORDER" | "SCAN_WORKER" | "BUILD_PALLET";

export interface PalletShipOrderLine {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
  remainingQty: number;
}

export interface PalletShipOrderData {
  shipOrderNo: string;
  customerName?: string;
  status: string;
  lines: PalletShipOrderLine[];
  orderQty: number;
  shippedQty: number;
}

export interface PalletWorkerInfo {
  workerCode: string;
  workerName?: string;
}

export interface PalletLoadedBox {
  boxNo: string;
  itemCode: string;
  qty: number;
}

export interface CurrentPallet {
  palletNo: string;
  status: string; // OPEN | CLOSED | LOADED | SHIPPED
  boxes: PalletLoadedBox[];
  boxCount: number;
  totalQty: number;
}

export interface PalletShipHistoryItem {
  shipOrderNo: string;
  palletNo: string;
  boxCount: number;
  totalQty: number;
  timestamp: string;
}

export interface UsePalletShipScanReturn {
  phase: PalletShipPhase;
  order: PalletShipOrderData | null;
  worker: PalletWorkerInfo | null;
  pallet: CurrentPallet | null;
  candidateCount: number;
  isScanning: boolean;
  isBusy: boolean;
  error: string | null;
  history: PalletShipHistoryItem[];
  handleScanOrder: (barcode: string) => Promise<void>;
  handleScanWorker: (qr: string) => Promise<void>;
  handleCreatePallet: () => Promise<void>;
  handleScanBox: (barcode: string) => Promise<void>;
  handleRemoveBox: (boxNo: string) => Promise<void>;
  handleClosePallet: () => Promise<void>;
  handleShipPallet: () => Promise<boolean>;
  handleReset: () => void;
}
```

- [ ] **Step 2: 훅 구현 작성**

Create `apps/frontend/src/hooks/pda/usePalletShipScan.ts`:

```ts
/**
 * @file src/hooks/pda/usePalletShipScan.ts
 * @description PDA 팔레트 출하 워크플로우 훅
 *
 * 흐름: SCAN_ORDER(출하지시,CONFIRMED) → SCAN_WORKER(작업자 QR)
 *      → BUILD_PALLET(팔레트 생성/이어서 + 박스 스캔 적재 + 마감 + 출하)
 * 지시별 상태는 GET /shipping/orders/:no/fulfillment 단일 응답으로 동기화.
 * 비즈니스 검증은 모두 서버(데스크톱과 동일 엔드포인트)에서 수행.
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";
import type {
  PalletShipPhase,
  PalletShipOrderData,
  PalletShipOrderLine,
  PalletWorkerInfo,
  CurrentPallet,
  PalletLoadedBox,
  PalletShipHistoryItem,
  UsePalletShipScanReturn,
} from "./usePalletShipScan.types";

export type {
  PalletShipPhase,
  PalletShipOrderData,
  PalletShipHistoryItem,
} from "./usePalletShipScan.types";

interface FulfillmentBox {
  boxNo: string;
  itemCode: string;
  qty: number;
}
interface FulfillmentPallet {
  palletNo: string;
  status: string;
  boxCount?: number;
  totalQty?: number;
  boxes?: FulfillmentBox[];
}
interface FulfillmentResponse {
  order: { shipOrderNo: string; customerName?: string; status: string };
  lines: PalletShipOrderLine[];
  candidateBoxes: FulfillmentBox[];
  pallets: FulfillmentPallet[];
}

const extractErrMsg = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/** fulfillment 응답에서 진행 중(미출하) 팔레트 1개 선택 */
function pickActivePallet(pallets: FulfillmentPallet[]): CurrentPallet | null {
  const active = pallets.find((p) => p.status === "OPEN" || p.status === "CLOSED");
  if (!active) return null;
  const boxes: PalletLoadedBox[] = (active.boxes ?? []).map((b) => ({
    boxNo: b.boxNo,
    itemCode: b.itemCode,
    qty: b.qty,
  }));
  return {
    palletNo: active.palletNo,
    status: active.status,
    boxes,
    boxCount: boxes.length,
    totalQty: boxes.reduce((s, b) => s + b.qty, 0),
  };
}

export function usePalletShipScan(): UsePalletShipScanReturn {
  const [phase, setPhase] = useState<PalletShipPhase>("SCAN_ORDER");
  const [order, setOrder] = useState<PalletShipOrderData | null>(null);
  const [worker, setWorker] = useState<PalletWorkerInfo | null>(null);
  const [pallet, setPallet] = useState<CurrentPallet | null>(null);
  const [candidateBoxNos, setCandidateBoxNos] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PalletShipHistoryItem[]>([]);

  /** fulfillment 조회 → order/pallet/candidate 동기화. 반환: 응답 데이터 */
  const refresh = useCallback(async (shipOrderNo: string): Promise<FulfillmentResponse | null> => {
    const { data } = await api.get(`/shipping/orders/${encodeURIComponent(shipOrderNo)}/fulfillment`);
    const f = (data?.data ?? null) as FulfillmentResponse | null;
    if (!f) return null;
    const orderQty = f.lines.reduce((s, l) => s + l.orderQty, 0);
    const shippedQty = f.lines.reduce((s, l) => s + l.shippedQty, 0);
    setOrder({
      shipOrderNo: f.order.shipOrderNo,
      customerName: f.order.customerName,
      status: f.order.status,
      lines: f.lines,
      orderQty,
      shippedQty,
    });
    setPallet(pickActivePallet(f.pallets));
    setCandidateBoxNos(new Set(f.candidateBoxes.map((b) => b.boxNo)));
    return f;
  }, []);

  // ── Phase 1: 출하지시 스캔 ───────────────────────────
  const handleScanOrder = useCallback(async (barcode: string): Promise<void> => {
    const code = barcode.trim();
    if (!code) return;
    setIsScanning(true);
    setError(null);
    try {
      const f = await refresh(code);
      if (!f) {
        setError("ORDER_NOT_FOUND");
        return;
      }
      if (f.order.status !== "CONFIRMED") {
        setError("NOT_CONFIRMED");
        setOrder(null);
        setPallet(null);
        return;
      }
      setPhase("SCAN_WORKER");
    } catch (err) {
      setError(extractErrMsg(err, "ORDER_NOT_FOUND"));
    } finally {
      setIsScanning(false);
    }
  }, [refresh]);

  // ── Phase 2: 작업자 스캔 ─────────────────────────────
  const handleScanWorker = useCallback(async (qr: string): Promise<void> => {
    if (!qr.trim()) return;
    setIsScanning(true);
    setError(null);
    try {
      const { data } = await api.get(`/master/workers/by-qr/${encodeURIComponent(qr.trim())}`);
      const w = (data?.data ?? data) as { workerCode?: string; workerName?: string };
      if (!w?.workerCode) {
        setError("WORKER_NOT_FOUND");
        return;
      }
      setWorker({ workerCode: w.workerCode, workerName: w.workerName });
      setPhase("BUILD_PALLET");
    } catch (err) {
      setError(extractErrMsg(err, "WORKER_NOT_FOUND"));
    } finally {
      setIsScanning(false);
    }
  }, []);

  // ── Phase 3: 팔레트 생성 ─────────────────────────────
  const handleCreatePallet = useCallback(async (): Promise<void> => {
    if (!order) return;
    setIsBusy(true);
    setError(null);
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/pallets`, {});
      await refresh(order.shipOrderNo);
    } catch (err) {
      setError(extractErrMsg(err, "PALLET_CREATE_FAILED"));
    } finally {
      setIsBusy(false);
    }
  }, [order, refresh]);

  // ── Phase 3: 박스 스캔 적재 ──────────────────────────
  const handleScanBox = useCallback(async (barcode: string): Promise<void> => {
    const boxNo = barcode.trim();
    if (!boxNo || !order || !pallet) return;
    if (pallet.status !== "OPEN") {
      setError("PALLET_NOT_OPEN");
      return;
    }
    if (pallet.boxes.some((b) => b.boxNo === boxNo)) {
      setError("DUPLICATE");
      return;
    }
    if (!candidateBoxNos.has(boxNo)) {
      setError("BOX_NOT_LOADABLE");
      return;
    }
    setIsScanning(true);
    setError(null);
    try {
      await api.post(
        `/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/pallets/${encodeURIComponent(pallet.palletNo)}/boxes`,
        { boxIds: [boxNo] },
      );
      await refresh(order.shipOrderNo);
    } catch (err) {
      setError(extractErrMsg(err, "BOX_ADD_FAILED"));
    } finally {
      setIsScanning(false);
    }
  }, [order, pallet, candidateBoxNos, refresh]);

  // ── Phase 3: 박스 제거 ───────────────────────────────
  const handleRemoveBox = useCallback(async (boxNo: string): Promise<void> => {
    if (!order || !pallet) return;
    setIsBusy(true);
    setError(null);
    try {
      await api.delete(
        `/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/pallets/${encodeURIComponent(pallet.palletNo)}/boxes`,
        { data: { boxIds: [boxNo] } },
      );
      await refresh(order.shipOrderNo);
    } catch (err) {
      setError(extractErrMsg(err, "BOX_REMOVE_FAILED"));
    } finally {
      setIsBusy(false);
    }
  }, [order, pallet, refresh]);

  // ── Phase 3: 팔레트 마감 ─────────────────────────────
  const handleClosePallet = useCallback(async (): Promise<void> => {
    if (!order || !pallet) return;
    if (pallet.boxes.length === 0) {
      setError("EMPTY_PALLET");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await api.post(
        `/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/pallets/${encodeURIComponent(pallet.palletNo)}/close`,
      );
      await refresh(order.shipOrderNo);
    } catch (err) {
      setError(extractErrMsg(err, "CLOSE_FAILED"));
    } finally {
      setIsBusy(false);
    }
  }, [order, pallet, refresh]);

  // ── Phase 3: 출하 ────────────────────────────────────
  const handleShipPallet = useCallback(async (): Promise<boolean> => {
    if (!order || !pallet) return false;
    if (pallet.status !== "CLOSED") {
      setError("NOT_CLOSED");
      return false;
    }
    setIsBusy(true);
    setError(null);
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/ship-pallets`, {
        palletNos: [pallet.palletNo],
        workerId: worker?.workerCode || undefined,
      });
      setHistory((prev) => [
        {
          shipOrderNo: order.shipOrderNo,
          palletNo: pallet.palletNo,
          boxCount: pallet.boxCount,
          totalQty: pallet.totalQty,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      setPhase("SCAN_ORDER");
      setOrder(null);
      setWorker(null);
      setPallet(null);
      setCandidateBoxNos(new Set());
      return true;
    } catch (err) {
      setError(extractErrMsg(err, "SHIP_FAILED"));
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [order, pallet, worker]);

  const handleReset = useCallback(() => {
    setPhase("SCAN_ORDER");
    setOrder(null);
    setWorker(null);
    setPallet(null);
    setCandidateBoxNos(new Set());
    setError(null);
  }, []);

  return {
    phase, order, worker, pallet,
    candidateCount: candidateBoxNos.size,
    isScanning, isBusy, error, history,
    handleScanOrder, handleScanWorker, handleCreatePallet,
    handleScanBox, handleRemoveBox, handleClosePallet, handleShipPallet, handleReset,
  };
}
```

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0. (만약 `import { api }`가 named export가 아니라는 에러가 나면, 기존 PDA 훅 `useShippingScan.ts`와 동일하게 `import { api } from "@/services/api";`가 유효함을 확인 — 동일 파일에서 사용 중이므로 정상.)

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/hooks/pda/usePalletShipScan.types.ts apps/frontend/src/hooks/pda/usePalletShipScan.ts
git commit -F <임시파일>
# 메시지: "feat(pda): 팔레트 출하 워크플로우 훅 usePalletShipScan 추가"
```

---

### Task 3: PDA 화면 + 구성 패널

**Files:**
- Create: `apps/frontend/src/app/pda/shipping-pallet/page.tsx`
- Create: `apps/frontend/src/app/pda/shipping-pallet/components/PalletBuildPanel.tsx`

**Interfaces:**
- Consumes: `usePalletShipScan` (Task 2), 공통 PDA 위젯들, `CurrentPallet`/`PalletShipHistoryItem` 타입.

- [ ] **Step 1: 구성 패널 컴포넌트 작성**

Create `apps/frontend/src/app/pda/shipping-pallet/components/PalletBuildPanel.tsx`:

```tsx
"use client";

/**
 * @file src/app/pda/shipping-pallet/components/PalletBuildPanel.tsx
 * @description 팔레트 구성 패널 — 현재 팔레트/적재 박스 목록/수량 표시 + 박스 제거
 */
import { useTranslation } from "react-i18next";
import { Boxes, Package, X } from "lucide-react";
import type { CurrentPallet } from "@/hooks/pda/usePalletShipScan.types";

export function PalletBuildPanel({
  pallet,
  onRemoveBox,
  disabled,
}: {
  pallet: CurrentPallet;
  onRemoveBox: (boxNo: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const isOpen = pallet.status === "OPEN";
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{pallet.palletNo}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {pallet.status}
          </span>
        </div>
        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          <span className="mr-2">{t("pda.palletShip.boxCount", "박스")} {pallet.boxCount}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{pallet.totalQty.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-3 space-y-2 max-h-[40vh] overflow-y-auto">
        {pallet.boxes.length === 0 ? (
          <div className="py-6 text-center text-slate-400 dark:text-slate-500">
            <Package className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p className="text-sm">{t("pda.palletShip.noBoxes", "박스를 스캔해 적재하세요.")}</p>
          </div>
        ) : (
          pallet.boxes.map((box) => (
            <div key={box.boxNo} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div>
                <p className="font-mono text-sm text-slate-800 dark:text-slate-200">{box.boxNo}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{box.itemCode}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{box.qty.toLocaleString()}</span>
                {isOpen && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemoveBox(box.boxNo)}
                    className="rounded p-1 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                    aria-label={t("pda.palletShip.removeBox", "박스 제거")}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 페이지 작성**

Create `apps/frontend/src/app/pda/shipping-pallet/page.tsx`:

```tsx
"use client";

/**
 * @file src/app/pda/shipping-pallet/page.tsx
 * @description 팔레트 출하 PDA 페이지 — 데스크톱 팔레트적재+출하와 동일 프로세스, 스캔 위주 UI
 *
 * SCAN_ORDER → SCAN_WORKER → BUILD_PALLET(팔레트 생성/이어서 + 박스 스캔 적재 + 마감 + 출하)
 */
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, Truck, UserCheck } from "lucide-react";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import ScanResultCard from "@/components/pda/ScanResultCard";
import type { ScanResultField } from "@/components/pda/ScanResultCard";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import PdaActionButton from "@/components/pda/PdaActionButton";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import { usePalletShipScan, type PalletShipHistoryItem } from "@/hooks/pda/usePalletShipScan";
import { PalletBuildPanel } from "./components/PalletBuildPanel";

export default function PalletShipPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const {
    phase, order, worker, pallet, isScanning, isBusy, error, history,
    handleScanOrder, handleScanWorker, handleCreatePallet,
    handleScanBox, handleRemoveBox, handleClosePallet, handleShipPallet, handleReset,
  } = usePalletShipScan();

  const onScan = useCallback(async (barcode: string) => {
    if (phase === "SCAN_ORDER") await handleScanOrder(barcode);
    else if (phase === "SCAN_WORKER") await handleScanWorker(barcode);
    else if (phase === "BUILD_PALLET") await handleScanBox(barcode);
  }, [phase, handleScanOrder, handleScanWorker, handleScanBox]);

  useBarcodeDetector({ onScan });

  const errorMessage = useMemo(() => {
    if (!error) return undefined;
    switch (error) {
      case "ORDER_NOT_FOUND": return t("pda.palletShip.orderNotFound", "출하지시를 찾을 수 없습니다.");
      case "NOT_CONFIRMED": return t("pda.palletShip.notConfirmed", "확정(CONFIRMED) 출하지시만 가능합니다.");
      case "WORKER_NOT_FOUND": return t("pda.palletShip.workerNotFound", "작업자를 찾을 수 없습니다.");
      case "DUPLICATE": return t("pda.palletShip.duplicate", "이미 적재된 박스입니다.");
      case "BOX_NOT_LOADABLE": return t("pda.palletShip.boxNotLoadable", "적재 가능한 박스가 아닙니다(마감·OQC합격·미할당 확인).");
      case "PALLET_NOT_OPEN": return t("pda.palletShip.palletNotOpen", "구성 중(OPEN) 팔레트가 아닙니다.");
      case "EMPTY_PALLET": return t("pda.palletShip.emptyPallet", "박스가 없는 팔레트는 마감할 수 없습니다.");
      case "NOT_CLOSED": return t("pda.palletShip.notClosed", "마감(CLOSED) 팔레트만 출하할 수 있습니다.");
      default: return error;
    }
  }, [error, t]);

  const scanPlaceholderKey = useMemo(() => {
    switch (phase) {
      case "SCAN_ORDER": return "pda.palletShip.scanOrder";
      case "SCAN_WORKER": return "pda.palletShip.scanWorker";
      case "BUILD_PALLET": return "pda.palletShip.scanBox";
    }
  }, [phase]);

  const orderFields: ScanResultField[] = useMemo(() => {
    if (!order) return [];
    return [
      { label: t("pda.palletShip.shipOrderNo", "출하지시"), value: order.shipOrderNo, highlight: true },
      { label: t("pda.palletShip.customer", "고객"), value: order.customerName ?? "-" },
      { label: t("pda.palletShip.orderQty", "지시수량"), value: order.orderQty },
      { label: t("pda.palletShip.shippedQty", "기출하"), value: order.shippedQty },
    ];
  }, [order, t]);

  const onShip = useCallback(async () => {
    const ok = await handleShipPallet();
    if (ok) playSuccess(); else playError();
  }, [handleShipPallet, playSuccess, playError]);

  const renderHistoryItem = useCallback((item: PalletShipHistoryItem) => (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.shipOrderNo}</p>
        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.palletNo}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {item.boxCount} / {item.totalQty}
        </p>
        <p className="text-xs text-slate-400">{item.timestamp}</p>
      </div>
    </div>
  ), []);

  const noPallet = !pallet;
  const isOpenPallet = pallet?.status === "OPEN";
  const isClosedPallet = pallet?.status === "CLOSED";

  return (
    <>
      <PdaHeader titleKey="pda.palletShip.title" backPath="/pda/menu" />

      {/* 단계 배지 */}
      {phase !== "SCAN_ORDER" && (
        <div className="mx-4 mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Truck className="h-3 w-3" /><span>{order?.shipOrderNo}</span>
          </div>
          {phase === "BUILD_PALLET" && worker && (
            <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <UserCheck className="h-3 w-3" /><span>{worker.workerName}</span>
            </div>
          )}
        </div>
      )}

      <ScanInput onScan={onScan} placeholderKey={scanPlaceholderKey} isLoading={isScanning} />

      {errorMessage && <ScanResultCard fields={[]} errorMessage={errorMessage} />}

      {/* Phase 1 안내 */}
      {phase === "SCAN_ORDER" && !error && !isScanning && (
        <div className="mx-4 mt-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-600 dark:bg-slate-900">
          <Boxes className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("pda.palletShip.scanOrder", "출하지시를 스캔하세요")}</p>
        </div>
      )}

      {/* Phase 2 안내 */}
      {phase === "SCAN_WORKER" && !error && !isScanning && (
        <>
          <ScanResultCard fields={orderFields} variant="success" title={t("pda.palletShip.orderLoaded", "출하지시 확인")} />
          <div className="mx-4 mt-3 rounded-2xl border-2 border-dashed border-blue-300 bg-white p-6 text-center dark:border-blue-700 dark:bg-slate-900">
            <UserCheck className="mx-auto mb-2 h-10 w-10 text-blue-400 dark:text-blue-500" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("pda.palletShip.scanWorker", "작업자 QR을 스캔하세요")}</p>
          </div>
        </>
      )}

      {/* Phase 3: 팔레트 구성 */}
      {phase === "BUILD_PALLET" && (
        <>
          <ScanResultCard fields={orderFields} variant="success" title={t("pda.palletShip.orderLoaded", "출하지시 확인")} />
          {pallet ? (
            <PalletBuildPanel pallet={pallet} onRemoveBox={handleRemoveBox} disabled={isBusy} />
          ) : (
            <div className="mx-4 mt-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-white p-6 text-center dark:border-emerald-700 dark:bg-slate-900">
              <Boxes className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("pda.palletShip.noPalletHint", "새 팔레트를 생성하세요")}</p>
            </div>
          )}
        </>
      )}

      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, idx) => `${item.palletNo}-${idx}`}
      />

      {/* 하단 버튼 */}
      {phase === "BUILD_PALLET" && (
        <PdaActionButton
          buttons={[
            ...(noPallet ? [{
              label: t("pda.palletShip.createPallet", "새 팔레트"),
              onClick: handleCreatePallet,
              variant: "primary" as const,
              isLoading: isBusy,
            }] : []),
            ...(isOpenPallet ? [{
              label: t("pda.palletShip.closePallet", "팔레트 마감"),
              onClick: handleClosePallet,
              variant: "primary" as const,
              isLoading: isBusy,
              disabled: (pallet?.boxes.length ?? 0) === 0,
              disabledReason: (pallet?.boxes.length ?? 0) === 0 ? t("pda.palletShip.emptyPallet", "박스가 없는 팔레트는 마감할 수 없습니다.") : undefined,
            }] : []),
            ...(isClosedPallet ? [{
              label: t("pda.palletShip.ship", "출하"),
              onClick: onShip,
              variant: "primary" as const,
              isLoading: isBusy,
            }] : []),
            { label: t("common.reset", "초기화"), onClick: handleReset, variant: "secondary" as const },
          ]}
        />
      )}

      {phase === "SCAN_WORKER" && (
        <PdaActionButton buttons={[{ label: t("common.reset", "초기화"), onClick: handleReset, variant: "secondary" }]} />
      )}
    </>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 4: 구조 테스트(경량) 작성 + 실행**

Create `apps/frontend/src/app/pda/shipping-pallet/pda-pallet-ship.structure.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("apps/frontend/src/app/pda/shipping-pallet/page.tsx", "utf8");
const hook = fs.readFileSync("apps/frontend/src/hooks/pda/usePalletShipScan.ts", "utf8");
const menu = fs.readFileSync("apps/frontend/src/components/pda/pdaMenuConfig.ts", "utf8");

test("PDA pallet ship page wires the scan workflow", () => {
  assert.match(page, /usePalletShipScan/);
  assert.match(page, /useBarcodeDetector/);
  assert.match(page, /handleScanBox/);
  assert.match(page, /handleClosePallet/);
  assert.match(page, /handleShipPallet/);
});

test("hook calls the existing desktop pallet endpoints (no new backend)", () => {
  assert.match(hook, /\/fulfillment/);
  assert.match(hook, /\/pallets`/);
  assert.match(hook, /\/pallets\/\$\{encodeURIComponent\(pallet\.palletNo\)\}\/boxes/);
  assert.match(hook, /\/close`/);
  assert.match(hook, /\/ship-pallets`/);
});

test("PDA menu registers the pallet ship entry", () => {
  assert.match(menu, /PDA_PALLET_SHIP/);
  assert.match(menu, /\/pda\/shipping-pallet/);
});
```

Run: `node --test "apps/frontend/src/app/pda/shipping-pallet/pda-pallet-ship.structure.test.mjs"`
Expected: 3 tests pass.

- [ ] **Step 5: 브라우저 수동 확인(선택, 사용자 환경)**

PDA(`/pda/shipping-pallet`)에서: 출하지시 스캔(CONFIRMED) → 작업자 스캔 → [새 팔레트] → 박스 스캔 적재(목록/수량 증가) → [팔레트 마감] → [출하] → 이력 기록·리셋. 데스크톱 `/shipping/pallet`·`/shipping/history`에서 동일 결과 확인.

- [ ] **Step 6: 커밋**

```bash
git add "apps/frontend/src/app/pda/shipping-pallet/page.tsx" "apps/frontend/src/app/pda/shipping-pallet/components/PalletBuildPanel.tsx" "apps/frontend/src/app/pda/shipping-pallet/pda-pallet-ship.structure.test.mjs"
git commit -F <임시파일>
# 메시지: "feat(pda): 팔레트 출하 화면 + 구성 패널 추가"
```

---

## 참고: 데스크톱과의 계약 일치

- 박스 적재 시 `boxIds` 필드에 **박스번호(boxNo)**를 보낸다(데스크톱 `/shipping/pallet` 화면도 동일하게 boxNo를 boxIds로 전송).
- 적재 가능 후보는 fulfillment의 `candidateBoxes`(CLOSED·OQC PASS·미할당) 기준으로 검증한다.
- `ship-pallets`는 항상 OQC PASS를 요구한다(데스크톱 동일). OQC 미사용 플랜트면 박스가 OQC PASS가 아닐 수 있어 출하가 막힐 수 있음 — 이는 기존 데스크톱 동작과 동일하므로 본 작업 범위에서 바꾸지 않는다(발견 시 사용자 보고).

## 검증 요약

- 각 태스크 `tsc --noEmit` 0(프론트/백엔드).
- Task 3 구조 테스트 3건 pass.
- 실DB E2E(선택): 지시→생성→적재→마감→출하 1건 정상.
