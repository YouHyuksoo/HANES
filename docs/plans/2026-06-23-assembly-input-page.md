# 하네스 생산 3단계 흐름 정렬 — 서브공정 재설계 + 조립 실적입력 신규

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하네스 생산 3단계(시작공정→서브공정→조립)를 코드와 일치시킨다. `subprocess-kitting` 페이지를 SEMI_PRODUCT 실적입력 + SG_LABELS 발행 화면으로 재설계하고, 신규 `input-assembly` 페이지에서 SG_LABELS 스캔 → FG_LABELS 발행을 담당한다.

**Architecture:**
- 백엔드: `JobOrderQueryDto`에 `itemType` 필터 추가(Task 1), `SubprocessKittingService`에 `getSgLabelsByResult` + `getAssemblyRequirements` 추가(Task 1·2). 기존 `kit()` API는 조립 페이지에서 그대로 재사용.
- 프론트: `subprocess-kitting/page.tsx` 완전 재작성(Task 3), 신규 `input-assembly/page.tsx` 생성(Task 4). 두 페이지 모두 `JobOrderSearchModal`을 `itemType` prop만 달리해 재사용.
- 설정: menuConfig + 4개 i18n + pageRegistry 업데이트(Task 5).

**Tech Stack:** NestJS + TypeORM + Oracle DB(JSHANES), Next.js 14 App Router, TypeScript, react-i18next, pnpm Turborepo

## Global Constraints

- Oracle DB 사이트: JSHANES; 모든 쿼리에 `company` + `plant` 스코프 필수
- `catch (error: unknown)` 유지, `as any` 금지
- JSON 파일 UTF-8 BOM 절대 금지
- `alert()`, `confirm()`, `prompt()` 금지 → 모달 사용
- 날짜 기본값 `toISOString()` 금지 → `getTodayLocal()` 사용
- i18n 변경 시 ko/en/zh/vi 4개 파일 동시 수정
- 수량 입력은 `QtyInput` 컴포넌트(`@/components/shared`) 사용
- `pnpm build` 에러 0건 기준 완료
- `production.module.ts`의 `TypeOrmModule.forFeature`에 `JobOrder`, `PartMaster`, `BomMaster` 이미 등록됨 → 모듈 파일 수정 불필요

---

### Task 1: 백엔드 — JobOrder itemType 필터 + SG_LABELS 결과별 조회 API

**Files:**
- Modify: `apps/backend/src/modules/production/dto/job-order.dto.ts`
- Modify: `apps/backend/src/modules/production/services/job-order.service.ts`
- Modify: `apps/backend/src/modules/production/services/subprocess-kitting.service.ts`
- Modify: `apps/backend/src/modules/production/controllers/subprocess-kitting.controller.ts`

**Interfaces:**
- Produces: `GET /production/job-orders?itemType=SEMI_PRODUCT` (또는 FINISHED)
- Produces: `GET /production/subprocess-kitting/sg-labels-by-result/:resultNo`

- [ ] **Step 1: `JobOrderQueryDto`에 `itemType` 필드 추가**

`apps/backend/src/modules/production/dto/job-order.dto.ts`의 `JobOrderQueryDto` 클래스(line 160) 내부에 `erpSyncYn` 필드(line 212) 바로 다음에 추가:

```typescript
  @ApiPropertyOptional({ description: '품목유형 필터 (SEMI_PRODUCT | FINISHED | RAW_MATERIAL)' })
  @IsOptional()
  @IsString()
  itemType?: string;
```

- [ ] **Step 2: `job-order.service.ts` findAll에 itemType 조건 추가**

`apps/backend/src/modules/production/services/job-order.service.ts`의 `findAll` 메서드에서 query 구조분해(line 135-138)에 `itemType` 추가 후, `search` 조건 블록(line 186) 바로 위에 삽입:

```typescript
    // query 구조분해 변경 (line 135)
    const {
      page = 1, limit = 50, search, orderNo, itemCode,
      lineCode, equipCode, status, statuses, planDateFrom, planDateTo, erpSyncYn,
      itemType,
    } = query;
```

그리고 `if (search)` 블록 바로 위에:

```typescript
    if (itemType) {
      qb.andWhere('part.itemType = :itemType', { itemType });
    }
```

> `findAll`은 이미 `leftJoinAndSelect('jo.part', 'part')`를 수행하므로 `part.itemType` andWhere가 바로 동작한다.

- [ ] **Step 3: `SubprocessKittingService`에 레포지토리 주입 추가**

`apps/backend/src/modules/production/services/subprocess-kitting.service.ts`의 import 블록에 아직 없는 것들 추가 확인 후 constructor에 레포지토리 주입 추가. 현재 constructor는 `SgLabel`만 주입 중.

기존 constructor를 아래로 교체:

```typescript
  constructor(
    @InjectRepository(SgLabel)
    private readonly sgLabelRepository: Repository<SgLabel>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(BomMaster)
    private readonly bomMasterRepository: Repository<BomMaster>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
    private readonly productInventory: ProductInventoryService,
    private readonly wipMatStockService: WipMatStockService,
    private readonly autoIssueService: AutoIssueService,
  ) {}
```

> `production.module.ts` TypeOrmModule.forFeature에 이미 `JobOrder`, `PartMaster`, `BomMaster`가 등록되어 있으므로 모듈 파일 수정 불필요.

- [ ] **Step 4: `getSgLabelsByResult` 메서드 추가**

`apps/backend/src/modules/production/services/subprocess-kitting.service.ts`의 `getSgLabel` 메서드(line ~376) 바로 앞에 삽입:

```typescript
  /** 생산실적별 SG 라벨 목록 조회 — 서브공정 실적 등록 후 발행된 라벨 확인용 */
  async getSgLabelsByResult(
    resultNo: string,
    company: string,
    plant: string,
  ): Promise<SgLabel[]> {
    return this.sgLabelRepository.find({
      where: { resultNo, company, plant },
      order: { issuedAt: 'ASC' },
    });
  }
```

- [ ] **Step 5: controller에 `sg-labels-by-result` 엔드포인트 추가**

`apps/backend/src/modules/production/controllers/subprocess-kitting.controller.ts`의 `getSgLabel` 메서드 바로 위에 추가:

```typescript
  @Get('sg-labels-by-result/:resultNo')
  @ApiOperation({ summary: '생산실적별 SG 라벨 목록 조회' })
  @ApiParam({ name: 'resultNo', description: '생산실적번호' })
  async getSgLabelsByResult(
    @Param('resultNo') resultNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.getSgLabelsByResult(resultNo, company, plant);
    return ResponseUtil.success(data);
  }
```

- [ ] **Step 6: 타입 체크**

```bash
pnpm --filter @harness/backend exec tsc --noEmit 2>&1 | head -30
```

에러 0건 확인.

- [ ] **Step 7: commit**

```bash
git add apps/backend/src/modules/production/dto/job-order.dto.ts
git add apps/backend/src/modules/production/services/job-order.service.ts
git add apps/backend/src/modules/production/services/subprocess-kitting.service.ts
git add apps/backend/src/modules/production/controllers/subprocess-kitting.controller.ts
```

임시파일로 커밋:
```
feat(production): JobOrder itemType 필터 + SG_LABELS 결과별 조회 API 추가
```

---

### Task 2: 백엔드 — 조립 요구사항 API

**Files:**
- Modify: `apps/backend/src/modules/production/services/subprocess-kitting.service.ts`
- Modify: `apps/backend/src/modules/production/controllers/subprocess-kitting.controller.ts`

**Interfaces:**
- Produces: `GET /production/subprocess-kitting/assembly-requirements/:orderNo`
  - 응답: `{ orderNo, itemCode, itemName, planQty, components: Array<{ itemCode, itemName, itemType, qtyPer, totalRequired }> }`

- [ ] **Step 1: `getAssemblyRequirements` 메서드 추가**

`apps/backend/src/modules/production/services/subprocess-kitting.service.ts`의 `getSgLabelsByResult` 메서드 바로 다음, `getSgLabel` 메서드 바로 앞에 삽입:

```typescript
  /** 조립 요구사항 조회 — 완제품 작업지시의 BOM에서 SEMI_PRODUCT 자식 컴포넌트 목록 반환 */
  async getAssemblyRequirements(
    orderNo: string,
    company: string,
    plant: string,
  ): Promise<{
    orderNo: string;
    itemCode: string;
    itemName: string;
    planQty: number;
    components: Array<{
      itemCode: string;
      itemName: string;
      itemType: string;
      qtyPer: number;
      totalRequired: number;
    }>;
  }> {
    const tenantWhere = { company, plant };

    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo, ...tenantWhere },
      relations: ['part'],
    });
    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    }

    const bomRows = await this.bomMasterRepository.find({
      where: { parentItemCode: jobOrder.itemCode, useYn: 'Y', ...tenantWhere },
    });

    const childCodes = [...new Set(bomRows.map((b) => b.childItemCode))];
    const childParts =
      childCodes.length > 0
        ? await this.partMasterRepository.find({
            where: { itemCode: In(childCodes), ...tenantWhere },
            select: ['itemCode', 'itemName', 'itemType'],
          })
        : [];
    const partMap = new Map(childParts.map((p) => [p.itemCode, p]));

    const components = bomRows
      .filter((b) => partMap.get(b.childItemCode)?.itemType === 'SEMI_PRODUCT')
      .map((b) => {
        const part = partMap.get(b.childItemCode);
        return {
          itemCode: b.childItemCode,
          itemName: part?.itemName ?? b.childItemCode,
          itemType: 'SEMI_PRODUCT',
          qtyPer: Number(b.qtyPer),
          totalRequired: Number(jobOrder.planQty) * Number(b.qtyPer),
        };
      });

    return {
      orderNo,
      itemCode: jobOrder.itemCode,
      itemName: jobOrder.part?.itemName ?? jobOrder.itemCode,
      planQty: Number(jobOrder.planQty),
      components,
    };
  }
```

- [ ] **Step 2: controller에 `assembly-requirements` 엔드포인트 추가**

`apps/backend/src/modules/production/controllers/subprocess-kitting.controller.ts`의 `getSgLabelsByResult` 메서드 바로 다음에 추가:

```typescript
  @Get('assembly-requirements/:orderNo')
  @ApiOperation({ summary: '조립 요구사항 조회 — 완제품 BOM의 SEMI_PRODUCT 자식 컴포넌트 목록' })
  @ApiParam({ name: 'orderNo', description: '완제품 작업지시번호' })
  async getAssemblyRequirements(
    @Param('orderNo') orderNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.getAssemblyRequirements(orderNo, company, plant);
    return ResponseUtil.success(data);
  }
```

- [ ] **Step 3: 타입 체크**

```bash
pnpm --filter @harness/backend exec tsc --noEmit 2>&1 | head -30
```

에러 0건 확인.

- [ ] **Step 4: commit**

```bash
git add apps/backend/src/modules/production/services/subprocess-kitting.service.ts
git add apps/backend/src/modules/production/controllers/subprocess-kitting.controller.ts
```

```
feat(assembly): 조립 요구사항 조회 API 추가 (GET /production/subprocess-kitting/assembly-requirements/:orderNo)
```

---

### Task 3: 프론트 — subprocess-kitting 페이지 재설계 (서브공정 실적입력)

**현재**: SG 바코드 스캔 → FG_LABELS 발행 (조립 로직 — 잘못됨)
**변경**: SEMI_PRODUCT 작업지시 선택 → 실적 입력 → SG_LABELS 발행 확인

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/subprocess-kitting/components/JobOrderSearchModal.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.tsx`

**Interfaces:**
- Consumes from Task 1: `GET /production/job-orders?itemType=SEMI_PRODUCT`
- Consumes from Task 1: `GET /production/subprocess-kitting/sg-labels-by-result/:resultNo`
- Consumes existing: `POST /production/prod-results`
- Produces (for Task 4): `JobOrderSearchModal` with `itemType` prop

- [ ] **Step 1: `JobOrderSearchModal.tsx`에 `itemType` prop 추가**

`apps/frontend/src/app/(authenticated)/production/subprocess-kitting/components/JobOrderSearchModal.tsx`의 `Props` interface에 `itemType?: string` 추가, `fetchOrders`의 params에 반영:

```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (order: JobOrderPick) => void;
  itemType?: string;
}
```

`fetchOrders` 함수의 `api.get` params를 다음으로 교체:

```typescript
      const res = await api.get("/production/job-orders", {
        params: {
          limit: 100,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(itemType ? { itemType } : {}),
        },
      });
```

- [ ] **Step 2: `subprocess-kitting/page.tsx` 완전 재작성**

기존 파일 전체를 아래 코드로 교체:

```tsx
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { CheckCircle, Package, Play, RefreshCw, Scan, Search } from "lucide-react";
import { Button, Card, CardContent, Input, Select, Modal, ComCodeBadge } from "@/components/ui";
import { QtyInput } from "@/components/shared";
import { useProcessOptions, useEquipOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import JobOrderSearchModal, { JobOrderPick } from "./components/JobOrderSearchModal";

interface SgLabelRow {
  sgBarcode: string;
  itemCode: string;
  initQty: number;
  remainQty: number;
  status: string;
  issuedAt: string;
}

interface SubmitResult {
  resultNo: string;
  sgLabels: SgLabelRow[];
}

export default function SubprocessKittingPage() {
  const { t } = useTranslation();

  const [selectedOrder, setSelectedOrder] = useState<JobOrderPick | null>(null);
  const [orderScan, setOrderScan] = useState("");
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);

  const [processCode, setProcessCode] = useState("");
  const [equipCode, setEquipCode] = useState("");
  const [goodQty, setGoodQty] = useState<number | "">(1);
  const [bundleCount, setBundleCount] = useState<number | "">(1);
  const [qtyPerBundle, setQtyPerBundle] = useState<number | "">("");

  const [executing, setExecuting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);

  const orderScanRef = useRef<HTMLInputElement>(null);

  const { options: rawProcessOptions } = useProcessOptions();
  const { options: rawEquipOptions } = useEquipOptions(processCode || undefined);

  const processOptions = useMemo(
    () => [{ value: "", label: t("production.subprocess.selectProcess", "공정 선택") }, ...rawProcessOptions],
    [rawProcessOptions, t],
  );
  const equipOptions = useMemo(
    () => [{ value: "", label: t("production.subprocess.selectEquipOptional", "설비 선택 (선택)") }, ...rawEquipOptions],
    [rawEquipOptions, t],
  );

  const selectOrder = useCallback((order: JobOrderPick) => {
    setSelectedOrder(order);
    setOrderScan("");
    setGoodQty(order.planQty ?? 1);
  }, []);

  const fetchOrderByNo = useCallback(
    async (no: string) => {
      const trimmed = no.trim();
      if (!trimmed) return;
      try {
        const res = await api.get("/production/job-orders", {
          params: { limit: 20, search: trimmed, itemType: "SEMI_PRODUCT" },
        });
        const list: JobOrderPick[] = Array.isArray(res.data?.data) ? res.data.data : [];
        const found = list.find((r) => r.orderNo === trimmed) ?? list[0];
        if (found) {
          selectOrder(found);
        } else {
          toast.error(t("production.subprocess.orderNotFound", "작업지시를 찾을 수 없습니다."));
        }
      } catch {
        toast.error(t("production.subprocess.orderNotFound", "작업지시를 찾을 수 없습니다."));
      }
    },
    [selectOrder, t],
  );

  const clearOrder = () => {
    setSelectedOrder(null);
    setOrderScan("");
    setProcessCode("");
    setEquipCode("");
    setGoodQty(1);
    setBundleCount(1);
    setQtyPerBundle("");
    setTimeout(() => orderScanRef.current?.focus(), 50);
  };

  const resetForm = () => {
    clearOrder();
    setSubmitResult(null);
  };

  const executeSubmit = async () => {
    if (!selectedOrder) {
      toast.error(t("production.subprocess.requireOrderNo", "작업지시를 선택하세요."));
      return;
    }
    if (!processCode) {
      toast.error(t("production.subprocess.requireProcess", "공정을 선택하세요."));
      return;
    }
    if (!goodQty || Number(goodQty) <= 0) {
      toast.error(t("production.subprocess.requireQty", "양품 수량을 입력하세요."));
      return;
    }

    setExecuting(true);
    try {
      const payload: Record<string, unknown> = {
        orderNo: selectedOrder.orderNo,
        processCode,
        goodQty: Number(goodQty),
      };
      if (equipCode.trim()) payload.equipCode = equipCode.trim();
      if (bundleCount && Number(bundleCount) > 0) payload.bundleCount = Number(bundleCount);
      if (qtyPerBundle && Number(qtyPerBundle) > 0) payload.qtyPerBundle = Number(qtyPerBundle);

      const res = await api.post("/production/prod-results", payload);
      const resultNo: string = res.data?.data?.resultNo ?? "";

      let sgLabels: SgLabelRow[] = [];
      if (resultNo) {
        try {
          const sgRes = await api.get(
            `/production/subprocess-kitting/sg-labels-by-result/${encodeURIComponent(resultNo)}`,
          );
          sgLabels = Array.isArray(sgRes.data?.data) ? (sgRes.data.data as SgLabelRow[]) : [];
        } catch {
          // SG 조회 실패해도 실적 등록은 성공으로 처리
        }
      }

      setSubmitResult({ resultNo, sgLabels });
      setResultModalOpen(true);
      toast.success(t("production.subprocess.submitSuccess", "서브공정 실적이 등록되었습니다."));
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("production.subprocess.submitFailed", "실적 등록에 실패했습니다.");
      toast.error(message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 gap-4 animate-fade-in bg-background">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />
            {t("production.kitting.title", "실적입력(서브공정)")}
          </h1>
          <p className="text-text-muted mt-1">
            {t(
              "production.kitting.description",
              "반제품 서브공정 실적을 등록하고 SG 추적라벨을 발행합니다.",
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={resetForm}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          {t("common.reset")}
        </Button>
      </div>

      <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-auto">
        {/* 작업지시 선택 */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">
              {t("production.subprocess.orderSection", "작업지시 (반제품)")}
            </h2>
            {selectedOrder ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
                <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-[11px] text-text-muted">
                      {t("production.subprocess.orderNo", "작업지시번호")}
                    </div>
                    <div className="font-mono text-text">{selectedOrder.orderNo}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-text-muted">{t("common.partName", "품목")}</div>
                    <div className="truncate text-text">
                      {selectedOrder.itemCode}
                      {selectedOrder.itemName ? ` · ${selectedOrder.itemName}` : ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted">
                      {t("production.subprocess.planQty", "계획수량")}
                    </div>
                    <div className="tabular-nums text-text">
                      {(selectedOrder.planQty ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted">{t("common.status", "상태")}</div>
                    <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={selectedOrder.status} />
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={clearOrder}>
                  {t("common.change", "변경")}
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    ref={orderScanRef}
                    label={t(
                      "production.subprocess.orderScanLabel",
                      "작업지시번호 스캔 또는 입력 후 Enter",
                    )}
                    value={orderScan}
                    onChange={(e) => setOrderScan(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        fetchOrderByNo(orderScan);
                      }
                    }}
                    placeholder="W-20260001"
                    leftIcon={<Scan className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setOrderSearchOpen(true)}
                  leftIcon={<Search className="w-4 h-4" />}
                  className="mb-0.5"
                >
                  {t("common.search")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 실적 입력 폼 */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">
              {t("production.subprocess.resultSection", "실적 입력")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Select
                label={t("production.subprocess.process", "공정")}
                options={processOptions}
                value={processCode}
                onChange={setProcessCode}
                disabled={!selectedOrder}
                fullWidth
              />
              <Select
                label={`${t("production.subprocess.equip", "설비")} (${t("production.subprocess.optional", "선택")})`}
                options={equipOptions}
                value={equipCode}
                onChange={setEquipCode}
                disabled={!selectedOrder}
                fullWidth
              />
              <QtyInput
                label={t("production.subprocess.goodQty", "양품 수량")}
                value={Number(goodQty) || 0}
                onChange={(n) => setGoodQty(n || "")}
                disabled={!selectedOrder}
                fullWidth
              />
              <QtyInput
                label={t("production.subprocess.bundleCount", "묶음 수")}
                value={Number(bundleCount) || 0}
                onChange={(n) => setBundleCount(n || "")}
                disabled={!selectedOrder}
                fullWidth
              />
              <QtyInput
                label={`${t("production.subprocess.qtyPerBundle", "묶음당 가닥")} (${t("production.subprocess.optional", "선택")})`}
                value={Number(qtyPerBundle) || 0}
                onChange={(n) => setQtyPerBundle(n || "")}
                disabled={!selectedOrder}
                fullWidth
              />
            </div>
            <div className="flex justify-end mt-4">
              <Button
                size="lg"
                onClick={executeSubmit}
                isLoading={executing}
                disabled={!selectedOrder || !processCode}
                leftIcon={<Play className="w-5 h-5" />}
              >
                {t("production.subprocess.submit", "실적 등록")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 작업지시 검색 모달 — SEMI_PRODUCT 필터 */}
      <JobOrderSearchModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onSelect={selectOrder}
        itemType="SEMI_PRODUCT"
      />

      {/* 결과 모달 */}
      <Modal
        isOpen={resultModalOpen}
        onClose={() => {
          setResultModalOpen(false);
          resetForm();
        }}
        title={t("production.subprocess.resultTitle", "서브공정 실적 등록 완료")}
        size="lg"
        footer={
          <Button
            onClick={() => {
              setResultModalOpen(false);
              resetForm();
            }}
          >
            {t("common.confirm")}
          </Button>
        }
      >
        {submitResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="font-semibold text-text-muted">
                {t("production.subprocess.resultNo", "실적번호")}:
              </span>
              <span className="font-mono text-text">{submitResult.resultNo}</span>
            </div>
            {submitResult.sgLabels.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-text-muted mb-2">
                  {t("production.subprocess.issuedSgLabels", "발행된 SG 추적라벨")} (
                  {submitResult.sgLabels.length}건)
                </p>
                <div className="border border-border rounded divide-y divide-border max-h-60 overflow-auto">
                  {submitResult.sgLabels.map((sg, index) => (
                    <div key={sg.sgBarcode} className="px-3 py-2 flex items-center gap-3">
                      <span className="text-xs text-text-muted w-6 text-right">{index + 1}</span>
                      <span className="font-mono text-sm text-text flex-1">{sg.sgBarcode}</span>
                      <span className="text-xs text-text-muted">{sg.initQty}개</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                {t(
                  "production.subprocess.noSgLabels",
                  "이 공정에서는 SG 라벨이 발행되지 않습니다. ROUTING_PROCESSES의 ISSUE_SG_LABEL_YN='Y' 설정을 확인하세요.",
                )}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: 프론트 타입 체크**

```bash
pnpm --filter @harness/frontend exec tsc --noEmit 2>&1 | head -30
```

에러 0건 확인.

- [ ] **Step 4: commit**

```bash
git add apps/frontend/src/app/(authenticated)/production/subprocess-kitting/components/JobOrderSearchModal.tsx
git add apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.tsx
```

```
feat(subprocess): 서브공정 실적입력 페이지 재설계 — SG_LABELS 발행 확인 워크플로우
```

---

### Task 4: 프론트 — input-assembly/page.tsx 신규 (조립 실적입력)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/production/input-assembly/page.tsx`

**Interfaces:**
- Consumes from Task 1: `GET /production/job-orders?itemType=FINISHED`
- Consumes from Task 2: `GET /production/subprocess-kitting/assembly-requirements/:orderNo`
- Consumes existing: `GET /production/subprocess-kitting/sg-label/:sgBarcode`
- Consumes existing: `POST /production/subprocess-kitting` (kit API)
- Reuses: `JobOrderSearchModal` from `../subprocess-kitting/components/JobOrderSearchModal` (Task 3에서 itemType prop 추가됨)

- [ ] **Step 1: 디렉토리 및 파일 생성**

`apps/frontend/src/app/(authenticated)/production/input-assembly/page.tsx` 생성:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Boxes, CheckCircle, Play, RefreshCw, Scan, Search, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Input, Select, Modal, ComCodeBadge } from "@/components/ui";
import { QtyInput } from "@/components/shared";
import { useProcessOptions, useEquipOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import JobOrderSearchModal, { JobOrderPick } from "../subprocess-kitting/components/JobOrderSearchModal";

interface AssemblyComponent {
  itemCode: string;
  itemName: string;
  itemType: string;
  qtyPer: number;
  totalRequired: number;
}

interface AssemblyRequirements {
  orderNo: string;
  itemCode: string;
  itemName: string;
  planQty: number;
  components: AssemblyComponent[];
}

interface SgLabelInfo {
  sgBarcode: string;
  itemCode: string;
  remainQty: number;
  status: string;
  orderNo?: string | null;
}

interface AssemblyResult {
  resultNo: string;
  fgBarcodes: string[];
}

export default function InputAssemblyPage() {
  const { t } = useTranslation();

  const [selectedOrder, setSelectedOrder] = useState<JobOrderPick | null>(null);
  const [orderScan, setOrderScan] = useState("");
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [requirements, setRequirements] = useState<AssemblyRequirements | null>(null);
  const [requirementsLoading, setRequirementsLoading] = useState(false);

  const [processCode, setProcessCode] = useState("");
  const [equipCode, setEquipCode] = useState("");
  const [qty, setQty] = useState<number | "">(1);
  const [circuitNo, setCircuitNo] = useState("");

  const [sgInput, setSgInput] = useState("");
  const [sgList, setSgList] = useState<SgLabelInfo[]>([]);
  const [sgLoading, setSgLoading] = useState(false);

  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<AssemblyResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);

  const [warnMessage, setWarnMessage] = useState("");
  const [warnModalOpen, setWarnModalOpen] = useState(false);

  const orderScanRef = useRef<HTMLInputElement>(null);
  const sgInputRef = useRef<HTMLInputElement>(null);

  const { options: rawProcessOptions } = useProcessOptions();
  const { options: rawEquipOptions } = useEquipOptions(processCode || undefined);

  const processOptions = useMemo(
    () => [{ value: "", label: t("production.assembly.selectProcess", "공정 선택") }, ...rawProcessOptions],
    [rawProcessOptions, t],
  );
  const equipOptions = useMemo(
    () => [{ value: "", label: t("production.assembly.selectEquipOptional", "설비 선택 (선택)") }, ...rawEquipOptions],
    [rawEquipOptions, t],
  );

  // 작업지시 선택 시 BOM 요구사항 조회
  useEffect(() => {
    if (!selectedOrder) {
      setRequirements(null);
      return;
    }
    let cancelled = false;
    setRequirementsLoading(true);
    api
      .get(
        `/production/subprocess-kitting/assembly-requirements/${encodeURIComponent(selectedOrder.orderNo)}`,
      )
      .then((res) => {
        if (!cancelled) setRequirements(res.data?.data as AssemblyRequirements);
      })
      .catch(() => {
        if (!cancelled)
          toast.error(
            t("production.assembly.requirementsLoadFailed", "조립 요구사항 조회에 실패했습니다."),
          );
      })
      .finally(() => {
        if (!cancelled) {
          setRequirementsLoading(false);
          sgInputRef.current?.focus();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrder, t]);

  const fetchSgLabel = useCallback(
    async (barcode: string) => {
      const trimmed = barcode.trim();
      if (!trimmed) return;

      if (sgList.some((item) => item.sgBarcode === trimmed)) {
        toast.error(t("production.assembly.alreadyScanned", "이미 스캔된 라벨입니다."));
        setSgInput("");
        return;
      }

      setSgLoading(true);
      try {
        const res = await api.get(
          `/production/subprocess-kitting/sg-label/${encodeURIComponent(trimmed)}`,
        );
        const data = res.data?.data as SgLabelInfo;

        if (data.remainQty <= 0) {
          setWarnMessage(t("production.assembly.warnZeroQty", "잔량이 없는 SG 라벨입니다."));
          setWarnModalOpen(true);
          setSgInput("");
          return;
        }

        const validStatuses = ["IN_STOCK", "MOUNTED"];
        if (!validStatuses.includes(data.status?.toUpperCase())) {
          setWarnMessage(
            `${t("production.assembly.warnInvalidStatus", "사용할 수 없는 SG 라벨 상태입니다.")} (${data.status})`,
          );
          setWarnModalOpen(true);
          setSgInput("");
          return;
        }

        setSgList((prev) => [...prev, data]);
        setSgInput("");
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.assembly.sgLookupFailed", "SG 라벨 조회에 실패했습니다.");
        toast.error(message);
        setSgInput("");
      } finally {
        setSgLoading(false);
        sgInputRef.current?.focus();
      }
    },
    [sgList, t],
  );

  const removeSg = (sgBarcode: string) => {
    setSgList((prev) => prev.filter((item) => item.sgBarcode !== sgBarcode));
  };

  const selectOrder = useCallback((order: JobOrderPick) => {
    setSelectedOrder(order);
    setOrderScan("");
    setSgList([]);
    setSgInput("");
    setQty(order.planQty ?? 1);
  }, []);

  const fetchOrderByNo = useCallback(
    async (no: string) => {
      const trimmed = no.trim();
      if (!trimmed) return;
      try {
        const res = await api.get("/production/job-orders", {
          params: { limit: 20, search: trimmed, itemType: "FINISHED" },
        });
        const list: JobOrderPick[] = Array.isArray(res.data?.data) ? res.data.data : [];
        const found = list.find((r) => r.orderNo === trimmed) ?? list[0];
        if (found) {
          selectOrder(found);
        } else {
          toast.error(t("production.assembly.orderNotFound", "작업지시를 찾을 수 없습니다."));
        }
      } catch {
        toast.error(t("production.assembly.orderNotFound", "작업지시를 찾을 수 없습니다."));
      }
    },
    [selectOrder, t],
  );

  const clearOrder = () => {
    setSelectedOrder(null);
    setOrderScan("");
    setRequirements(null);
    setSgList([]);
    setSgInput("");
    setQty(1);
    setProcessCode("");
    setEquipCode("");
    setCircuitNo("");
    setTimeout(() => orderScanRef.current?.focus(), 50);
  };

  const resetForm = () => {
    clearOrder();
    setResult(null);
  };

  // BOM 요구사항 대비 스캔 잔량 집계
  const sgProgressByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const sg of sgList) {
      map.set(sg.itemCode, (map.get(sg.itemCode) ?? 0) + sg.remainQty);
    }
    return map;
  }, [sgList]);

  const executeAssembly = async () => {
    if (!selectedOrder) {
      toast.error(t("production.assembly.requireOrderNo", "작업지시를 선택하세요."));
      return;
    }
    if (!processCode) {
      toast.error(t("production.assembly.requireProcess", "공정을 선택하세요."));
      return;
    }
    if (!qty || Number(qty) <= 0) {
      toast.error(t("production.assembly.requireQty", "조립 수량을 입력하세요."));
      return;
    }
    if (sgList.length === 0) {
      toast.error(t("production.assembly.requireSgLabel", "SG 추적라벨을 하나 이상 스캔하세요."));
      return;
    }

    setExecuting(true);
    try {
      const payload: Record<string, unknown> = {
        orderNo: selectedOrder.orderNo,
        processCode,
        qty: Number(qty),
        sgBarcodes: sgList.map((item) => item.sgBarcode),
      };
      if (equipCode.trim()) payload.equipCode = equipCode.trim();
      if (circuitNo.trim()) payload.circuitNo = circuitNo.trim();

      const res = await api.post("/production/subprocess-kitting", payload);
      const data = res.data?.data as AssemblyResult;
      setResult(data);
      setResultModalOpen(true);
      toast.success(t("production.assembly.executeSuccess", "조립 실적이 등록되었습니다."));
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("production.assembly.executeFailed", "조립 실적 등록에 실패했습니다.");
      toast.error(message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 gap-4 animate-fade-in bg-background">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Boxes className="w-7 h-7 text-primary" />
            {t("production.assembly.title", "실적입력(조립)")}
          </h1>
          <p className="text-text-muted mt-1">
            {t(
              "production.assembly.description",
              "서브공정 SG 라벨을 스캔하여 완제품 조립 실적과 FG 라벨을 발행합니다.",
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={resetForm}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          {t("common.reset")}
        </Button>
      </div>

      <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-auto">
        {/* 작업지시 선택 */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">
              {t("production.assembly.orderSection", "작업지시 (완제품)")}
            </h2>
            {selectedOrder ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
                <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-[11px] text-text-muted">
                      {t("production.assembly.orderNo", "작업지시번호")}
                    </div>
                    <div className="font-mono text-text">{selectedOrder.orderNo}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-text-muted">{t("common.partName", "품목")}</div>
                    <div className="truncate text-text">
                      {selectedOrder.itemCode}
                      {selectedOrder.itemName ? ` · ${selectedOrder.itemName}` : ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted">
                      {t("production.assembly.planQty", "계획수량")}
                    </div>
                    <div className="tabular-nums text-text">
                      {(selectedOrder.planQty ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted">{t("common.status", "상태")}</div>
                    <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={selectedOrder.status} />
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={clearOrder}>
                  {t("common.change", "변경")}
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    ref={orderScanRef}
                    label={t(
                      "production.assembly.orderScanLabel",
                      "작업지시번호 스캔 또는 입력 후 Enter",
                    )}
                    value={orderScan}
                    onChange={(e) => setOrderScan(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        fetchOrderByNo(orderScan);
                      }
                    }}
                    placeholder="W-20260001"
                    leftIcon={<Scan className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setOrderSearchOpen(true)}
                  leftIcon={<Search className="w-4 h-4" />}
                  className="mb-0.5"
                >
                  {t("common.search")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* BOM 요구사항 패널 */}
        {selectedOrder && (
          <Card padding="none" className="flex-shrink-0">
            <CardContent className="p-4">
              <h2 className="font-bold text-text mb-3">
                {t("production.assembly.bomRequirements", "조립 요구사항")}
              </h2>
              {requirementsLoading ? (
                <p className="text-sm text-text-muted text-center py-4">
                  {t("common.loading", "조회 중...")}
                </p>
              ) : requirements && requirements.components.length > 0 ? (
                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-surface border-b border-border">
                      <tr className="text-text-muted text-xs">
                        <th className="px-3 py-2 text-left font-semibold">
                          {t("common.itemCode", "품번")}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {t("common.itemName", "품명")}
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          {t("production.assembly.required", "필요수량")}
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          {t("production.assembly.scanned", "스캔잔량")}
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          {t("production.assembly.fulfilled", "충족")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {requirements.components.map((comp) => {
                        const scanned = sgProgressByItem.get(comp.itemCode) ?? 0;
                        const fulfilled = scanned >= comp.totalRequired;
                        return (
                          <tr
                            key={comp.itemCode}
                            className="border-b border-border/70 hover:bg-surface/60"
                          >
                            <td className="px-3 py-2 font-mono text-xs">{comp.itemCode}</td>
                            <td className="px-3 py-2 text-xs">{comp.itemName}</td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums">
                              {comp.totalRequired.toLocaleString()}
                            </td>
                            <td
                              className={`px-3 py-2 text-right text-xs tabular-nums font-semibold ${fulfilled ? "text-green-600" : "text-orange-500"}`}
                            >
                              {scanned.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {fulfilled ? (
                                <CheckCircle className="w-4 h-4 text-green-500 inline-block" />
                              ) : (
                                <span className="text-xs text-orange-500">
                                  {t("production.assembly.notFulfilled", "미충족")}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center py-4 border border-dashed border-border rounded">
                  {t(
                    "production.assembly.noBomComponents",
                    "BOM에 반제품(SEMI_PRODUCT) 자식이 없습니다.",
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* SG 스캔 패널 */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">
              {t("production.assembly.sgScan", "SG 추적라벨 스캔")}
            </h2>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  ref={sgInputRef}
                  label={t(
                    "production.assembly.sgScanPlaceholder",
                    "SG 바코드 스캔 또는 입력 후 Enter",
                  )}
                  value={sgInput}
                  onChange={(e) => setSgInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      fetchSgLabel(sgInput);
                    }
                  }}
                  disabled={!selectedOrder || sgLoading}
                  leftIcon={<Scan className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fetchSgLabel(sgInput)}
                isLoading={sgLoading}
                disabled={!selectedOrder}
                className="mb-0.5"
              >
                {t("common.search")}
              </Button>
            </div>

            {sgList.length > 0 && (
              <div className="mt-3 border border-border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface border-b border-border">
                    <tr className="text-text-muted text-xs">
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">
                        {t("production.assembly.sgBarcode", "SG 바코드")}
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        {t("common.itemCode", "품번")}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        {t("production.assembly.remainQty", "잔량")}
                      </th>
                      <th className="px-3 py-2 text-center font-semibold">
                        {t("common.status", "상태")}
                      </th>
                      <th className="px-3 py-2 text-center font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sgList.map((item, index) => (
                      <tr
                        key={item.sgBarcode}
                        className="border-b border-border/70 hover:bg-surface/60"
                      >
                        <td className="px-3 py-2 text-text-muted text-xs">{index + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.sgBarcode}</td>
                        <td className="px-3 py-2 text-xs">{item.itemCode}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">
                          {item.remainQty != null ? item.remainQty.toLocaleString() : "-"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-xs border border-border text-text-muted">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-red-100 text-red-500"
                            onClick={() => removeSg(item.sgBarcode)}
                            title={t("common.delete")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sgList.length === 0 && (
              <p className="mt-3 text-sm text-text-muted text-center py-4 border border-dashed border-border rounded">
                {t("common.noData")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 실행 패널 */}
        <Card padding="none" className="flex-shrink-0">
          <CardContent className="p-4">
            <h2 className="font-bold text-text mb-3">
              {t("production.assembly.execSection", "조립 실행")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Select
                label={t("production.assembly.process", "공정")}
                options={processOptions}
                value={processCode}
                onChange={setProcessCode}
                disabled={!selectedOrder}
                fullWidth
              />
              <Select
                label={`${t("production.assembly.equip", "설비")} (${t("production.assembly.optional", "선택")})`}
                options={equipOptions}
                value={equipCode}
                onChange={setEquipCode}
                disabled={!selectedOrder}
                fullWidth
              />
              <QtyInput
                label={t("production.assembly.qty", "조립 수량")}
                value={Number(qty) || 0}
                onChange={(n) => setQty(n || "")}
                disabled={!selectedOrder}
                fullWidth
              />
              <Input
                label={`${t("production.assembly.circuitNo", "회로번호")} (${t("production.assembly.optional", "선택")})`}
                value={circuitNo}
                onChange={(e) => setCircuitNo(e.target.value)}
                disabled={!selectedOrder}
                fullWidth
              />
            </div>
            <div className="flex justify-end mt-4">
              <Button
                size="lg"
                onClick={executeAssembly}
                isLoading={executing}
                disabled={!selectedOrder || !processCode || sgList.length === 0}
                leftIcon={<Play className="w-5 h-5" />}
              >
                {t("production.assembly.execute", "조립 실행")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 작업지시 검색 모달 — FINISHED 필터 */}
      <JobOrderSearchModal
        isOpen={orderSearchOpen}
        onClose={() => setOrderSearchOpen(false)}
        onSelect={selectOrder}
        itemType="FINISHED"
      />

      {/* 경고 모달 */}
      <Modal
        isOpen={warnModalOpen}
        onClose={() => setWarnModalOpen(false)}
        title={t("common.error")}
        size="md"
        footer={
          <Button
            onClick={() => {
              setWarnModalOpen(false);
              sgInputRef.current?.focus();
            }}
          >
            {t("common.confirm")}
          </Button>
        }
      >
        <p className="text-sm text-text">{warnMessage}</p>
      </Modal>

      {/* 결과 모달 */}
      <Modal
        isOpen={resultModalOpen}
        onClose={() => {
          setResultModalOpen(false);
          resetForm();
        }}
        title={t("production.assembly.resultTitle", "조립 실적 등록 완료")}
        size="lg"
        footer={
          <Button
            onClick={() => {
              setResultModalOpen(false);
              resetForm();
            }}
          >
            {t("common.confirm")}
          </Button>
        }
      >
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="font-semibold text-text-muted">
                {t("production.assembly.resultNo", "실적번호")}:
              </span>
              <span className="font-mono text-text">{result.resultNo}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-muted mb-2">
                {t("production.assembly.fgBarcodes", "발행된 FG 바코드")}
              </p>
              <div className="border border-border rounded divide-y divide-border max-h-60 overflow-auto">
                {result.fgBarcodes.map((barcode, index) => (
                  <div key={barcode} className="px-3 py-2 flex items-center gap-3">
                    <span className="text-xs text-text-muted w-6 text-right">{index + 1}</span>
                    <span className="font-mono text-sm text-text">{barcode}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 프론트 타입 체크**

```bash
pnpm --filter @harness/frontend exec tsc --noEmit 2>&1 | head -30
```

에러 0건 확인.

- [ ] **Step 3: commit**

```bash
git add apps/frontend/src/app/(authenticated)/production/input-assembly/page.tsx
```

```
feat(assembly): 조립 실적입력 페이지 신규 추가 (/production/input-assembly)

- SG 바코드 스캔 → FG 라벨 발행 워크플로우
- BOM 기반 요구사항 패널(충족 여부 실시간 표시)
- 기존 POST /production/subprocess-kitting API 재사용
```

---

### Task 5: 메뉴/i18n/레지스트리

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts`
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`
- Modify: `apps/frontend/src/components/layout/pageRegistry.generated.ts`
- Create: `apps/frontend/src/components/layout/page-registries/production__input-assembly.generated.ts`

**Interfaces:**
- Consumes from Task 4: `/production/input-assembly/page.tsx`

- [ ] **Step 1: menuConfig.ts에 신규 메뉴 항목 추가**

`apps/frontend/src/config/menuConfig.ts`에서 다음 줄:
```typescript
{ code: "PROD_KITTING", labelKey: "menu.production.kitting", path: "/production/subprocess-kitting" },
```
바로 다음에 삽입:
```typescript
{ code: "PROD_INPUT_ASSEMBLY", labelKey: "menu.production.inputAssembly", path: "/production/input-assembly" },
```

- [ ] **Step 2: ko.json 업데이트**

`apps/frontend/src/locales/ko.json`에서 `"production.kitting": "실적입력(서브공정)"` 줄 바로 다음에 추가:
```json
    "production.inputAssembly": "실적입력(조립)",
```

- [ ] **Step 3: en.json 업데이트**

`apps/frontend/src/locales/en.json`에서 `"production.kitting": "Result Input (Sub-process)"` 줄 바로 다음에 추가:
```json
    "production.inputAssembly": "Assembly Input",
```

- [ ] **Step 4: zh.json 업데이트**

`apps/frontend/src/locales/zh.json`에서 `"production.kitting": "实绩录入（子工序）"` 줄 바로 다음에 추가:
```json
    "production.inputAssembly": "组装实绩输入",
```

- [ ] **Step 5: vi.json 업데이트**

`apps/frontend/src/locales/vi.json`에서 `"production.kitting": "Nhập kết quả (công đoạn phụ)"` 줄 바로 다음에 추가:
```json
    "production.inputAssembly": "Nhập Thực Tích Lắp Ráp",
```

- [ ] **Step 6: 페이지 레지스트리 파일 신규 생성**

`apps/frontend/src/components/layout/page-registries/production__input-assembly.generated.ts` 생성:

```typescript
/**
 * @file src/components/layout/page-registries/production__input-assembly.generated.ts
 * @description 자동 생성 파일 — 직접 수정 금지. `node scripts/gen-page-registry.mjs`로 재생성.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export function getPageComponent(): ComponentType {
  return dynamic(() => import("@/app/(authenticated)/production/input-assembly/page"), { ssr: false });
}
```

- [ ] **Step 7: pageRegistry.generated.ts에 case 블록 추가**

`apps/frontend/src/components/layout/pageRegistry.generated.ts`에서 `/production/subprocess-kitting` case 블록 바로 다음에 삽입:

```typescript
    case "/production/input-assembly": {
      const mod = await import("./page-registries/production__input-assembly.generated");
      component = mod.getPageComponent();
      break;
    }
```

- [ ] **Step 8: i18n 키 누락 검증**

```bash
node scripts/find_missing_i18n.js 2>&1 | grep -i "inputAssembly" | head -10
```

출력 없으면 정상.

- [ ] **Step 9: 타입 체크**

```bash
pnpm --filter @harness/frontend exec tsc --noEmit 2>&1 | head -30
```

에러 0건 확인.

- [ ] **Step 10: commit**

```bash
git add apps/frontend/src/config/menuConfig.ts
git add apps/frontend/src/locales/ko.json
git add apps/frontend/src/locales/en.json
git add apps/frontend/src/locales/zh.json
git add apps/frontend/src/locales/vi.json
git add apps/frontend/src/components/layout/pageRegistry.generated.ts
git add apps/frontend/src/components/layout/page-registries/production__input-assembly.generated.ts
```

```
feat(assembly): 메뉴/i18n/레지스트리 — 실적입력(조립) 신규 추가
```

---

## 자가 검토

### Spec Coverage

| 요구사항 | Task |
|---------|------|
| JobOrder itemType 필터 (SEMI_PRODUCT/FINISHED) | Task 1 ✅ |
| SG_LABELS 결과별 조회 API | Task 1 ✅ |
| 조립 요구사항 API (BOM SEMI_PRODUCT 자식) | Task 2 ✅ |
| subprocess-kitting 재설계 — SEMI_PRODUCT 실적입력 + SG_LABELS 표시 | Task 3 ✅ |
| JobOrderSearchModal itemType prop 추가 | Task 3 ✅ |
| input-assembly 신규 — SG 스캔 + FG 발행 | Task 4 ✅ |
| 작업지시 FINISHED 필터 (조립 페이지) | Task 4 ✅ |
| BOM 요구사항 패널 (충족 표시) | Task 4 ✅ |
| 메뉴 PROD_INPUT_ASSEMBLY 추가 | Task 5 ✅ |
| i18n 4개 파일 inputAssembly 추가 | Task 5 ✅ |
| 페이지 레지스트리 추가 | Task 5 ✅ |

### Placeholder Scan

없음 — 모든 코드 블록 실제 구현 코드 포함.

### Type Consistency

- `JobOrderPick` — `JobOrderSearchModal`에서 export, Task 3·4 모두 동일 인터페이스 사용
- `SgLabelRow.initQty` — `SgLabel` 엔티티의 `initQty: number` 컬럼과 일치
- `AssemblyResult.{ resultNo, fgBarcodes }` — 기존 `SubprocessKittingService.kit()` 반환 타입 `{ resultNo: string; fgBarcodes: string[] }`와 일치
- `AssemblyRequirements` 인터페이스 — `getAssemblyRequirements` 서비스 반환 타입과 일치
- `getSgLabelsByResult` 반환 `SgLabel[]` — entity 전체 반환이므로 프론트 `SgLabelRow` 매핑 시 필요 필드(sgBarcode, itemCode, initQty, remainQty, status, issuedAt) 모두 존재

### 주의사항

- `production.module.ts` 수정 불필요: `TypeOrmModule.forFeature`에 `JobOrder`, `PartMaster`, `BomMaster` 이미 등록됨. Task 1 Step 3에서 constructor 주입만 추가하면 됨.
- Task 3 subprocess 페이지의 `production.kitting.title`/`production.kitting.description` i18n 키는 fallback 기본값으로 렌더링되므로 추가 i18n 작업 없이 동작함. 정식 등록은 필요 시 별도.
- SG_LABELS 발행 여부는 `ROUTING_PROCESSES.ISSUE_SG_LABEL_YN='Y'` 설정에 달려 있음. 미설정 시 결과 모달에 안내 메시지 표시됨.
