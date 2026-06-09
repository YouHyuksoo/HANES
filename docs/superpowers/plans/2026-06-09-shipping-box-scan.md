# 출하지시 기반 박스 스캔 출하 + 입고창고 단순화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출하지시 번호를 스캔/입력해 해당 지시에 대해 박스를 개별 스캔하면 즉시 출하 처리(박스 SHIPPED + FG_MAIN 재고 차감 + 출하지시 진행 갱신)되도록 웹·PDA에 구현하고, 완제품 박스 입고를 FG_MAIN으로 단순화한다.

**Architecture:** 백엔드에 단일 트랜잭션 엔드포인트 `POST /shipping/orders/:shipOrderNo/ship-box`를 신설하여 웹 모달과 PDA가 공용한다. 기존 `ProductInventoryService.issueStockInTx`를 재사용해 FG_MAIN(`IS_DEFAULT='Y'` FG 창고)에서 차감한다. 완제품 입고(`fg/receive`)는 백엔드에서 FG 기본창고로 강제한다.

**Tech Stack:** NestJS + TypeORM(Oracle), Jest(백엔드 단위테스트), Next.js + React + Zustand, react-i18next.

**참고 스펙:** `docs/superpowers/specs/2026-06-09-shipping-box-scan-design.md`

**실행 전 필수:** `.ai-coordination/LOCKS.md`에 lock 등록.
```
- T-SHIP-BOX-SCAN (claude, 2026-06-09): 출하지시 기반 박스 스캔 출하 + 입고 FG_MAIN 단순화.
  파일: shipping/services/ship-order.service.ts, ship-order.controller.ts, dto/ship-box.dto.ts,
        shipping.module.ts, inventory.controller.ts, components/shipping/BoxScanShipModal.tsx,
        shipping/confirm/page.tsx, hooks/pda/useShippingScan.ts(.types.ts),
        pda/shipping/page.tsx, pda/product/receiving/page.tsx, locales 4.
```

---

## File Structure

**백엔드 (생성)**
- `apps/backend/src/modules/shipping/dto/ship-box.dto.ts` — ship-box 요청 DTO

**백엔드 (수정)**
- `apps/backend/src/modules/shipping/services/ship-order.service.ts` — `shipBox()` 메서드 + 의존성 주입
- `apps/backend/src/modules/shipping/services/ship-order.service.spec.ts` — `shipBox` 단위테스트 (없으면 생성)
- `apps/backend/src/modules/shipping/controllers/ship-order.controller.ts` — `POST :id/ship-box`
- `apps/backend/src/modules/shipping/shipping.module.ts` — InventoryModule import, Warehouse/BoxMaster repo 등록
- `apps/backend/src/modules/inventory/inventory.controller.ts` — `receiveFg`를 FG 기본창고로 강제

**프론트 (생성)**
- `apps/frontend/src/components/shipping/BoxScanShipModal.tsx` — 웹 박스 스캔 출하 모달

**프론트 (수정)**
- `apps/frontend/src/components/shipping/index.ts` — BoxScanShipModal export
- `apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx` — 버튼 + 모달 연결
- `apps/frontend/src/hooks/pda/useShippingScan.ts` / `.types.ts` — 미구현 API 교체, 다중라인 진행률
- `apps/frontend/src/app/pda/shipping/page.tsx` — 다중라인 표시 보정(필요 시)
- `apps/frontend/src/app/pda/product/receiving/page.tsx` — 완제품 창고선택 제거(FG_MAIN 고정 표시)
- `apps/frontend/src/locales/{ko,en,zh,vi}/translation.json` — i18n

---

## Task 1: ship-box 요청 DTO

**Files:**
- Create: `apps/backend/src/modules/shipping/dto/ship-box.dto.ts`

- [ ] **Step 1: DTO 작성**

```typescript
import { IsString, IsOptional } from 'class-validator';

/** 출하지시 기반 박스 단건 출하 요청 */
export class ShipBoxDto {
  /** 출하할 박스 번호 (스캔값) */
  @IsString()
  boxNo: string;

  /** 작업자 ID (PDA: 작업자 QR, 웹: 로그인 사용자) */
  @IsOptional()
  @IsString()
  workerId?: string;
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 신규 파일로 인한 에러 0건 (미사용 경고 없음 — 다음 태스크에서 사용)

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/shipping/dto/ship-box.dto.ts
git commit -m "feat(shipping): add ShipBoxDto for box-scan shipping"
```

---

## Task 2: ShipOrderService.shipBox + 모듈 와이어링 (TDD)

**Files:**
- Modify: `apps/backend/src/modules/shipping/shipping.module.ts`
- Modify: `apps/backend/src/modules/shipping/services/ship-order.service.ts`
- Test: `apps/backend/src/modules/shipping/services/ship-order.service.spec.ts`

- [ ] **Step 1: InventoryModule이 ProductInventoryService를 export하는지 확인**

Run: `grep -n "ProductInventoryService" apps/backend/src/modules/inventory/inventory.module.ts`
Expected: `exports` 배열에 `ProductInventoryService` 포함. 없으면 exports에 추가하고 커밋.

- [ ] **Step 2: 모듈 와이어링 — shipping.module.ts 수정**

`shipping.module.ts`의 imports에 InventoryModule, TypeOrmModule.forFeature에 Warehouse·BoxMaster 추가(이미 등록된 것은 중복 추가 금지).

```typescript
// 상단 import 추가
import { InventoryModule } from '../inventory/inventory.module';
import { Warehouse } from '../../entities/warehouse.entity';
import { BoxMaster } from '../../entities/box-master.entity';

// @Module({ imports: [...] }) 안에서
//   TypeOrmModule.forFeature([... 기존, Warehouse, BoxMaster])  // 중복 시 생략
//   InventoryModule,  // 추가
```

확인: `grep -n "forFeature" apps/backend/src/modules/shipping/shipping.module.ts` 로 기존 등록 엔티티를 보고 Warehouse/BoxMaster가 없으면 추가.

- [ ] **Step 3: 실패하는 테스트 작성**

`ship-order.service.spec.ts`가 없으면 생성. 있으면 describe 블록 추가. TypeORM repository/QueryRunner는 mock으로 구성한다. 기존 `shipment.service.spec.ts`의 mock 패턴을 참고.

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShipOrderService } from './ship-order.service';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ShipmentOrderItem } from '../../../entities/shipment-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';

describe('ShipOrderService.shipBox', () => {
  let service: ShipOrderService;
  let issueStockInTx: jest.Mock;
  let managed: Record<string, any>;

  // qr.manager.findOne/find/update 를 엔티티별로 제어
  const makeManager = (overrides: Partial<Record<string, any>>) => ({
    findOne: jest.fn((entity: any, opts: any) => {
      if (entity === ShipmentOrder) return overrides.order ?? null;
      if (entity === BoxMaster) return overrides.box ?? null;
      if (entity === ShipmentOrderItem) return overrides.line ?? null;
      if (entity === Warehouse) return overrides.warehouse ?? null;
      return null;
    }),
    find: jest.fn((entity: any) => {
      if (entity === ShipmentOrderItem) return overrides.allLines ?? [];
      return [];
    }),
    update: jest.fn(),
  });

  const buildService = async (overrides: Partial<Record<string, any>>) => {
    managed = makeManager(overrides);
    issueStockInTx = jest.fn().mockResolvedValue({ transNo: 'PTX_TEST' });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ShipOrderService,
        { provide: getRepositoryToken(ShipmentOrder), useValue: {} },
        { provide: getRepositoryToken(ShipmentOrderItem), useValue: {} },
        { provide: getRepositoryToken(PartMaster), useValue: {} },
        { provide: getRepositoryToken(Warehouse), useValue: {} },
        { provide: getRepositoryToken(BoxMaster), useValue: {} },
        { provide: TransactionService, useValue: { run: (cb: any) => cb({ manager: managed }) } },
        { provide: ProductInventoryService, useValue: { issueStockInTx } },
      ],
    }).compile();
    service = moduleRef.get(ShipOrderService);
  };

  it('정상 출하: 박스 SHIPPED + 재고차감 + shippedQty 증가', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 5, status: 'CLOSED', oqcStatus: 'PASS' },
      line: { shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 },
      warehouse: { warehouseCode: 'FG_MAIN' },
      allLines: [{ shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 }],
    });
    const res = await service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000');
    expect(issueStockInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ warehouseId: 'FG_MAIN', itemCode: 'HNS01', qty: 5, transType: 'FG_OUT', prdUid: '*', refType: 'SHIP_ORDER', refId: 'SO1' }),
    );
    expect(managed.update).toHaveBeenCalledWith(BoxMaster, expect.objectContaining({ boxNo: 'BX1' }), { status: 'SHIPPED' });
    expect(res.lineShippedQty).toBe(5);
    expect(res.fullyShipped).toBe(false);
  });

  it('CONFIRMED 아니면 거부', async () => {
    await buildService({ order: { shipOrderNo: 'SO1', status: 'DRAFT' } });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('이미 SHIPPED 박스 거부', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 5, status: 'SHIPPED', oqcStatus: 'PASS' },
    });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('OQC 미합격 박스 거부', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 5, status: 'CLOSED', oqcStatus: 'PENDING' },
    });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('지시에 없는 품목 거부', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'OTHER', qty: 5, status: 'CLOSED', oqcStatus: 'PASS' },
      line: null,
    });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('초과 출하 거부', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 7, status: 'CLOSED', oqcStatus: 'PASS' },
      line: { shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 5 },
    });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('전 라인 완출 시 지시 CLOSED', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 10, status: 'CLOSED', oqcStatus: 'PASS' },
      line: { shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 },
      warehouse: { warehouseCode: 'FG_MAIN' },
      allLines: [{ shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 }],
    });
    const res = await service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000');
    expect(res.fullyShipped).toBe(true);
    expect(managed.update).toHaveBeenCalledWith(ShipmentOrder, expect.objectContaining({ shipOrderNo: 'SO1' }), { status: 'CLOSED' });
  });
});
```

- [ ] **Step 4: 테스트 실행해 실패 확인**

Run: `pnpm --filter @harness/backend exec jest ship-order.service.spec --silent`
Expected: FAIL — `service.shipBox is not a function` (또는 컴파일 에러)

- [ ] **Step 5: shipBox 구현 + 의존성 주입**

`ship-order.service.ts` 상단 import에 추가:
```typescript
import { Warehouse } from '../../../entities/warehouse.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { ShipBoxDto } from '../dto/ship-box.dto';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
```

생성자에 주입 추가(기존 주입 뒤에):
```typescript
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(BoxMaster)
    private readonly boxRepository: Repository<BoxMaster>,
    private readonly productInventory: ProductInventoryService,
```

`confirm()` 메서드 아래에 추가:
```typescript
  /**
   * 출하지시 기반 박스 단건 출하 (웹 모달 / PDA 공용)
   * 단일 트랜잭션: 박스 SHIPPED + FG_MAIN 재고차감 + 라인 shippedQty 증가 + 완출 시 지시 CLOSED
   */
  async shipBox(shipOrderNo: string, dto: ShipBoxDto, company?: string, plant?: string) {
    return this.tx.run(async (qr) => {
      const where = this.tenantWhere(company, plant);

      // 1. 출하지시 (CONFIRMED만)
      const order = await qr.manager.findOne(ShipmentOrder, { where: { shipOrderNo, ...where } });
      if (!order) throw new NotFoundException(`출하지시를 찾을 수 없습니다: ${shipOrderNo}`);
      if (order.status !== 'CONFIRMED') {
        throw new BadRequestException(`확정(CONFIRMED) 상태의 출하지시만 출하할 수 있습니다. 현재: ${order.status}`);
      }

      // 2. 박스 재조회 (CLOSED + OQC PASS + 미출하)
      const box = await qr.manager.findOne(BoxMaster, { where: { boxNo: dto.boxNo, ...where } });
      if (!box) throw new NotFoundException(`박스를 찾을 수 없습니다: ${dto.boxNo}`);
      if (box.status === 'SHIPPED') throw new BadRequestException(`이미 출하된 박스입니다: ${dto.boxNo}`);
      if (box.status !== 'CLOSED') throw new BadRequestException(`마감(CLOSED)된 박스만 출하할 수 있습니다: ${dto.boxNo}`);
      if (box.oqcStatus !== 'PASS') throw new BadRequestException(`OQC 합격(PASS) 박스만 출하할 수 있습니다: ${dto.boxNo}`);

      // 3. 지시 라인 매칭
      const line = await qr.manager.findOne(ShipmentOrderItem, { where: { shipOrderNo, itemCode: box.itemCode, ...where } });
      if (!line) throw new BadRequestException(`출하지시에 없는 품목입니다: ${box.itemCode}`);

      // 4. 초과 출하 차단
      if (line.shippedQty + box.qty > line.orderQty) {
        throw new BadRequestException(`출하수량 초과: 지시 ${line.orderQty}, 기출하 ${line.shippedQty}, 요청 ${box.qty}`);
      }

      // 5. FG 기본창고
      const warehouse = await qr.manager.findOne(Warehouse, { where: { warehouseType: 'FG', isDefault: 'Y', ...where } });
      if (!warehouse) throw new BadRequestException('FG 기본창고(IS_DEFAULT=Y)가 설정되어 있지 않습니다.');

      // 6. FG_MAIN 재고 차감 (메모리: PRD_UID 센티넬 '*')
      await this.productInventory.issueStockInTx(qr, {
        warehouseId: warehouse.warehouseCode,
        itemCode: box.itemCode,
        itemType: 'FINISHED',
        prdUid: '*',
        qty: box.qty,
        transType: 'FG_OUT',
        refType: 'SHIP_ORDER',
        refId: shipOrderNo,
        workerId: dto.workerId,
        remark: `출하지시 박스출하:${dto.boxNo}`,
        company,
        plant,
      });

      // 7. 박스 SHIPPED
      await qr.manager.update(BoxMaster, { boxNo: box.boxNo, ...where }, { status: 'SHIPPED' });

      // 8. 라인 shippedQty 증가
      const newShipped = line.shippedQty + box.qty;
      await qr.manager.update(ShipmentOrderItem, { shipOrderNo, seq: line.seq, ...where }, { shippedQty: newShipped });

      // 9. 전 라인 완출 시 지시 CLOSED
      const allLines = await qr.manager.find(ShipmentOrderItem, { where: { shipOrderNo, ...where } });
      const fullyShipped = allLines.every((l) =>
        (l.seq === line.seq ? newShipped : l.shippedQty) >= l.orderQty,
      );
      if (fullyShipped) {
        await qr.manager.update(ShipmentOrder, { shipOrderNo, ...where }, { status: 'CLOSED' });
      }

      return {
        shipOrderNo,
        boxNo: box.boxNo,
        itemCode: box.itemCode,
        qty: box.qty,
        lineShippedQty: newShipped,
        lineOrderQty: line.orderQty,
        orderStatus: fullyShipped ? 'CLOSED' : 'CONFIRMED',
        fullyShipped,
      };
    });
  }
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm --filter @harness/backend exec jest ship-order.service.spec --silent`
Expected: PASS (7 케이스)

- [ ] **Step 7: 백엔드 타입체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/shipping/shipping.module.ts apps/backend/src/modules/shipping/services/ship-order.service.ts apps/backend/src/modules/shipping/services/ship-order.service.spec.ts apps/backend/src/modules/inventory/inventory.module.ts
git commit -m "feat(shipping): ShipOrderService.shipBox single-tx box shipping"
```

---

## Task 3: ship-box 엔드포인트

**Files:**
- Modify: `apps/backend/src/modules/shipping/controllers/ship-order.controller.ts`

- [ ] **Step 1: 엔드포인트 추가**

import에 `ShipBoxDto` 추가:
```typescript
import { CreateShipOrderDto, UpdateShipOrderDto, ShipOrderQueryDto } from '../dto/ship-order.dto';
import { ShipBoxDto } from '../dto/ship-box.dto';
```

`confirm` 핸들러 아래에 추가:
```typescript
  @Post(':id/ship-box')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '박스 단건 출하 (출하지시 기반)', description: '박스를 스캔해 즉시 출하 처리(SHIPPED + FG_MAIN 차감 + shippedQty 갱신)' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async shipBox(@Param('id') id: string, @Body() dto: ShipBoxDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.shipBox(id, dto, company, plant);
    return ResponseUtil.success(data, '박스가 출하되었습니다.');
  }
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/shipping/controllers/ship-order.controller.ts
git commit -m "feat(shipping): add POST /shipping/orders/:id/ship-box endpoint"
```

---

## Task 4: 완제품 입고를 FG 기본창고로 강제

**Files:**
- Modify: `apps/backend/src/modules/inventory/inventory.controller.ts:373-378` (`receiveFg`)

**배경:** 박스 제품입고가 화면 선택 창고로 들어가 출고창고(FG_MAIN)와 어긋남. 백엔드에서 FG 기본창고로 강제한다.

- [ ] **Step 1: Warehouse repo 주입 확인**

Run: `grep -n "Warehouse\b\|InjectRepository\|constructor" apps/backend/src/modules/inventory/inventory.controller.ts`
Expected: 주입 형태 파악. Warehouse repo가 없으면 컨트롤러 생성자에 추가하고, `inventory.module.ts` forFeature에 Warehouse 등록 여부 확인(없으면 추가).

- [ ] **Step 2: receiveFg 수정 — FG 기본창고 강제**

`receiveFg`를 다음으로 교체. 생성자에 `@InjectRepository(Warehouse) private readonly warehouseRepository: Repository<Warehouse>` 가 없으면 추가(상단 `import { Warehouse } from '../../entities/warehouse.entity';` 포함).

```typescript
  @Post('fg/receive')
  async receiveFg(@Body() dto: ProductReceiveStockDto, @Company() company: string, @Plant() plant: string) {
    const fg = await this.warehouseRepository.findOne({
      where: { warehouseType: 'FG', isDefault: 'Y', company, plant },
    });
    if (!fg) {
      throw new BadRequestException('FG 기본창고(IS_DEFAULT=Y)가 설정되어 있지 않습니다.');
    }
    return this.productInventoryService.receiveStock(
      this.productReceivePayload({ ...dto, warehouseId: fg.warehouseCode }, 'FINISHED', 'FG_IN', company, plant),
    );
  }
```

`BadRequestException`이 import되어 있지 않으면 `@nestjs/common`에서 추가.

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/inventory/inventory.controller.ts apps/backend/src/modules/inventory/inventory.module.ts
git commit -m "fix(inventory): force fg/receive into FG default warehouse"
```

---

## Task 5: 웹 박스 스캔 출하 모달

**Files:**
- Create: `apps/frontend/src/components/shipping/BoxScanShipModal.tsx`
- Modify: `apps/frontend/src/components/shipping/index.ts`

- [ ] **Step 1: 모달 컴포넌트 작성**

```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input } from '@/components/ui';
import { Package, ScanLine, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';

interface OrderLine {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
}
interface OrderData {
  shipOrderNo: string;
  customerName?: string;
  status: string;
  items: OrderLine[];
}
interface ShippedRow {
  boxNo: string;
  itemCode: string;
  qty: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onShipped?: () => void; // 출하 1건 성공 시 부모 목록 갱신
}

export default function BoxScanShipModal({ isOpen, onClose, onShipped }: Props) {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);

  const [orderNoInput, setOrderNoInput] = useState('');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [boxInput, setBoxInput] = useState('');
  const [rows, setRows] = useState<ShippedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [shipping, setShipping] = useState(false);
  const boxRef = useRef<HTMLInputElement>(null);

  // 모달 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setOrderNoInput(''); setOrder(null); setBoxInput(''); setRows([]); setError(null);
    }
  }, [isOpen]);

  const loadOrder = useCallback(async (no: string) => {
    const code = no.trim();
    if (!code) return;
    setLoadingOrder(true); setError(null);
    try {
      const res = await api.get(`/shipping/orders/${encodeURIComponent(code)}`);
      const data = res.data?.data as OrderData;
      if (data.status !== 'CONFIRMED') {
        setError(t('shipping.boxScan.notConfirmed', '확정(CONFIRMED) 상태의 출하지시만 출하할 수 있습니다.'));
        setOrder(null);
        return;
      }
      setOrder(data); setRows([]);
      setTimeout(() => boxRef.current?.focus(), 50);
    } catch {
      setError(t('shipping.boxScan.orderNotFound', '출하지시를 찾을 수 없습니다.'));
      setOrder(null);
    } finally {
      setLoadingOrder(false);
    }
  }, [t]);

  const shipBox = useCallback(async (box: string) => {
    const boxNo = box.trim();
    if (!boxNo || !order) return;
    if (rows.some((r) => r.boxNo === boxNo)) {
      setError(t('shipping.boxScan.duplicate', '이미 스캔한 박스입니다.'));
      setBoxInput(''); return;
    }
    setShipping(true); setError(null);
    try {
      const res = await api.post(`/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/ship-box`, {
        boxNo,
        workerId: userId,
      });
      const d = res.data?.data as { itemCode: string; qty: number; lineShippedQty: number; orderStatus: string };
      setRows((prev) => [{ boxNo, itemCode: d.itemCode, qty: d.qty }, ...prev]);
      // 라인 진행 갱신
      setOrder((prev) => prev && ({
        ...prev,
        status: d.orderStatus,
        items: prev.items.map((it) => it.itemCode === d.itemCode ? { ...it, shippedQty: d.lineShippedQty } : it),
      }));
      onShipped?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('shipping.boxScan.shipFailed', '출하 처리에 실패했습니다.'));
    } finally {
      setBoxInput('');
      setShipping(false);
      setTimeout(() => boxRef.current?.focus(), 50);
    }
  }, [order, rows, userId, t, onShipped]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('shipping.boxScan.title', '박스 스캔 출하')} size="xl">
      <div className="space-y-4">
        {/* 1. 출하지시 스캔/입력 */}
        <div className="flex gap-2 items-end">
          <Input
            label={t('shipping.boxScan.shipOrderNo', '출하지시번호')}
            placeholder={t('shipping.boxScan.scanOrder', '출하지시 바코드 스캔/입력')}
            value={orderNoInput}
            onChange={(e) => setOrderNoInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadOrder(orderNoInput); }}
            leftIcon={<ScanLine className="w-4 h-4" />}
            fullWidth
          />
          <Button onClick={() => loadOrder(orderNoInput)} disabled={loadingOrder}>
            {t('common.search', '조회')}
          </Button>
        </div>

        {/* 2. 지시 정보 + 라인 진행률 */}
        {order && (
          <div className="p-3 bg-surface-secondary rounded-lg space-y-2 text-sm">
            <div className="flex gap-4">
              <span><span className="text-text-muted">{t('shipping.boxScan.customer', '고객사')}:</span> {order.customerName ?? '-'}</span>
              <span><span className="text-text-muted">{t('common.status', '상태')}:</span> {order.status}</span>
            </div>
            <div className="space-y-1">
              {order.items.map((it) => (
                <div key={it.itemCode} className="flex items-center justify-between">
                  <span className="font-mono">{it.itemCode} {it.itemName ? `(${it.itemName})` : ''}</span>
                  <span className={it.shippedQty >= it.orderQty ? 'text-green-600 font-medium' : ''}>
                    {it.shippedQty} / {it.orderQty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. 박스 스캔 */}
        {order && order.status === 'CONFIRMED' && (
          <Input
            ref={boxRef}
            label={t('shipping.boxScan.boxNo', '박스 바코드')}
            placeholder={t('shipping.boxScan.scanBox', '박스 바코드 스캔')}
            value={boxInput}
            onChange={(e) => setBoxInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !shipping) shipBox(boxInput); }}
            leftIcon={<Package className="w-4 h-4" />}
            disabled={shipping}
            fullWidth
          />
        )}

        {/* 4. 오류 */}
        {error && (
          <div className="flex items-center gap-2 p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded">
            <XCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* 5. 출하된 박스 목록 */}
        {rows.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border max-h-60 overflow-y-auto">
            {rows.map((r) => (
              <div key={r.boxNo} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /><span className="font-mono">{r.boxNo}</span></span>
                <span className="text-text-muted">{r.itemCode}</span>
                <span className="font-medium">{r.qty}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.close', '닫기')}</Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: index.ts에 export 추가**

`apps/frontend/src/components/shipping/index.ts`에 추가:
```typescript
export { default as BoxScanShipModal } from './BoxScanShipModal';
```

확인: `Input`이 `ref` forwarding을 지원하는지 `grep -n "forwardRef" apps/frontend/src/components/ui/Input.tsx`. 지원하지 않으면 박스 입력은 일반 `<input>` + 직접 ref로 대체(같은 onKeyDown/Enter 처리 유지).

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/shipping/BoxScanShipModal.tsx apps/frontend/src/components/shipping/index.ts
git commit -m "feat(shipping): web BoxScanShipModal for ship-order box scanning"
```

---

## Task 6: /shipping/confirm 버튼 + 모달 연결

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx`

- [ ] **Step 1: import + 상태 추가**

상단 import 수정:
```typescript
import { ShipmentStatusBadge, ShipmentScanModal, BoxScanShipModal } from '@/components/shipping';
import { Truck, Plus, Search, RefreshCw, CheckCircle, Package, Clock, MapPin, Upload, ArrowRight, XCircle, ScanLine } from 'lucide-react';
```

`ShipmentPage` 컴포넌트 내 상태 추가(기존 useState들 옆):
```typescript
  const [isBoxScanOpen, setIsBoxScanOpen] = useState(false);
```

- [ ] **Step 2: 헤더 버튼 추가**

헤더의 버튼 그룹(`<div className="flex gap-2">` 안, "출하 등록" 버튼 앞)에 추가:
```tsx
          <Button variant="secondary" size="sm" onClick={() => setIsBoxScanOpen(true)}>
            <ScanLine className="w-4 h-4 mr-1" /> {t('shipping.boxScan.title', '박스 스캔 출하')}
          </Button>
```

- [ ] **Step 3: 모달 렌더링 추가**

기존 `ShipmentScanModal` 렌더링 블록 아래(컴포넌트 return 닫기 `</div>` 직전)에 추가:
```tsx
      <BoxScanShipModal
        isOpen={isBoxScanOpen}
        onClose={() => { setIsBoxScanOpen(false); fetchData(); }}
        onShipped={fetchData}
      />
```

- [ ] **Step 4: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 5: Commit**

```bash
git add "apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx"
git commit -m "feat(shipping): wire BoxScanShipModal into confirm page"
```

---

## Task 7: i18n — 웹 모달 문자열 (4파일)

**Files:**
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}/translation.json`

**주의(메모리):** JSON에 UTF-8 BOM 절대 금지.

- [ ] **Step 1: 4개 파일 `shipping` 객체에 `boxScan` 키 추가**

ko:
```json
"boxScan": {
  "title": "박스 스캔 출하",
  "shipOrderNo": "출하지시번호",
  "scanOrder": "출하지시 바코드 스캔/입력",
  "customer": "고객사",
  "boxNo": "박스 바코드",
  "scanBox": "박스 바코드 스캔",
  "notConfirmed": "확정(CONFIRMED) 상태의 출하지시만 출하할 수 있습니다.",
  "orderNotFound": "출하지시를 찾을 수 없습니다.",
  "duplicate": "이미 스캔한 박스입니다.",
  "shipFailed": "출하 처리에 실패했습니다."
}
```
en:
```json
"boxScan": {
  "title": "Ship by Box Scan",
  "shipOrderNo": "Ship Order No.",
  "scanOrder": "Scan/enter ship order barcode",
  "customer": "Customer",
  "boxNo": "Box Barcode",
  "scanBox": "Scan box barcode",
  "notConfirmed": "Only CONFIRMED ship orders can be shipped.",
  "orderNotFound": "Ship order not found.",
  "duplicate": "Box already scanned.",
  "shipFailed": "Failed to ship the box."
}
```
zh:
```json
"boxScan": {
  "title": "扫描装箱出货",
  "shipOrderNo": "出货指示单号",
  "scanOrder": "扫描/输入出货指示条码",
  "customer": "客户",
  "boxNo": "箱条码",
  "scanBox": "扫描箱条码",
  "notConfirmed": "仅可出货已确认(CONFIRMED)的出货指示。",
  "orderNotFound": "未找到出货指示。",
  "duplicate": "该箱已扫描。",
  "shipFailed": "出货处理失败。"
}
```
vi:
```json
"boxScan": {
  "title": "Xuất hàng theo quét thùng",
  "shipOrderNo": "Số lệnh xuất hàng",
  "scanOrder": "Quét/nhập mã vạch lệnh xuất hàng",
  "customer": "Khách hàng",
  "boxNo": "Mã vạch thùng",
  "scanBox": "Quét mã vạch thùng",
  "notConfirmed": "Chỉ lệnh xuất hàng đã xác nhận (CONFIRMED) mới được xuất.",
  "orderNotFound": "Không tìm thấy lệnh xuất hàng.",
  "duplicate": "Thùng đã được quét.",
  "shipFailed": "Xử lý xuất hàng thất bại."
}
```

- [ ] **Step 2: 4파일 키 존재 검증**

Run: `grep -l "\"boxScan\"" apps/frontend/src/locales/ko/translation.json apps/frontend/src/locales/en/translation.json apps/frontend/src/locales/zh/translation.json apps/frontend/src/locales/vi/translation.json`
Expected: 4개 파일 모두 출력

- [ ] **Step 3: BOM 미존재 확인**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건 (JSON 파싱 정상)

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/locales/ko/translation.json apps/frontend/src/locales/en/translation.json apps/frontend/src/locales/zh/translation.json apps/frontend/src/locales/vi/translation.json
git commit -m "i18n(shipping): add boxScan strings (ko/en/zh/vi)"
```

---

## Task 8: PDA useShippingScan 수리

**Files:**
- Modify: `apps/frontend/src/hooks/pda/useShippingScan.ts`
- Modify: `apps/frontend/src/hooks/pda/useShippingScan.types.ts`

**배경:** 기존 훅이 미구현 API(`/shipping/orders/by-barcode`, `/shipping/register`)를 호출. 구현된 `GET /shipping/orders/:id` + 신규 `ship-box`로 교체. 출하지시 다중 라인 지원.

- [ ] **Step 1: types — 다중 라인 지원으로 ShipOrderData 보정**

`useShippingScan.types.ts`의 `ShipOrderData`를 다중 라인 합계 기준으로 변경(기존 단일 itemCode 가정 제거):
```typescript
export interface ShipOrderLine {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
}
export interface ShipOrderData {
  shipOrderNo: string;
  customerName: string;
  status: string;
  items: ShipOrderLine[];
  orderQty: number;   // 전 라인 orderQty 합계 (진행률용)
  shippedQty: number; // 전 라인 shippedQty 합계
}
```

`BoxResponse`는 유지. `register` 관련 사용처는 Step 2에서 교체.

- [ ] **Step 2: 훅 로직 교체**

`handleScanShipOrder`의 API를 `:id` 조회로 교체하고 합계를 계산:
```typescript
const handleScanShipOrder = useCallback(async (barcode: string): Promise<void> => {
  const code = barcode.trim();
  if (!code) return;
  setIsScanning(true); setError(null);
  try {
    const { data } = await api.get(`/shipping/orders/${encodeURIComponent(code)}`);
    const o = data?.data;
    if (o.status !== 'CONFIRMED') { setError('NOT_CONFIRMED'); return; }
    const items = (o.items ?? []).map((it: any) => ({
      itemCode: it.itemCode, itemName: it.itemName, orderQty: it.orderQty, shippedQty: it.shippedQty ?? 0,
    }));
    const orderQty = items.reduce((s: number, it: any) => s + it.orderQty, 0);
    const shippedQty = items.reduce((s: number, it: any) => s + it.shippedQty, 0);
    setScannedOrder({ shipOrderNo: o.shipOrderNo, customerName: o.customerName, status: o.status, items, orderQty, shippedQty });
    setPhase('SCAN_WORKER');
  } catch {
    setError('ORDER_NOT_FOUND');
  } finally {
    setIsScanning(false);
  }
}, []);
```

`handleScanProduct`를 박스 스캔 즉시 `ship-box` 호출로 교체(팔레트 분기 유지하되 박스별 1건 호출):
```typescript
const handleScanProduct = useCallback(async (barcode: string): Promise<void> => {
  const code = barcode.trim();
  if (!code || !scannedOrder) return;
  setIsScanning(true); setError(null);
  try {
    // 박스 번호 목록 결정 (팔레트면 하위 박스 일괄)
    let boxNos: string[] = [];
    if (code.startsWith('PLT-')) {
      const { data } = await api.get(`/shipping/pallets/barcode/${encodeURIComponent(code)}/boxes`);
      boxNos = (data?.boxes ?? data?.data?.boxes ?? []).map((b: any) => b.boxNo);
    } else {
      boxNos = [code];
    }
    for (const boxNo of boxNos) {
      if (scannedItems.some((i) => i.boxNo === boxNo)) { setError('DUPLICATE'); continue; }
      const res = await api.post(`/shipping/orders/${encodeURIComponent(scannedOrder.shipOrderNo)}/ship-box`, {
        boxNo, workerId: worker?.id != null ? String(worker.id) : undefined,
      });
      const d = res.data?.data;
      setScannedItems((prev) => [{ boxNo, itemCode: d.itemCode, qty: d.qty }, ...prev]);
      setScannedOrder((prev) => prev && ({
        ...prev,
        status: d.orderStatus,
        items: prev.items.map((it) => it.itemCode === d.itemCode ? { ...it, shippedQty: d.lineShippedQty } : it),
        shippedQty: prev.shippedQty + d.qty,
      }));
    }
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    setError(msg ?? 'SHIP_FAILED');
  } finally {
    setIsScanning(false);
  }
}, [scannedOrder, scannedItems, worker]);
```

`handleConfirmShip`은 즉시 출하 방식에서 불필요 → "완료/초기화" 동작으로 축소하거나 제거. 호출처(page.tsx)에서 버튼 라벨을 "완료"로 바꾸고 `handleReset` 호출하도록 Step은 Task 8 Step 3에서 처리. 훅에서는 `handleConfirmShip`을 유지하되 내부를 `return true`만 하도록 단순화(반환타입 호환):
```typescript
const handleConfirmShip = useCallback(async (): Promise<boolean> => true, []);
```

`scannedQty`/`progress` 계산은 `scannedOrder.shippedQty` 기준으로 일관 유지(기존 reduce가 scannedItems 기준이면 그대로 두되, 진행률 표시는 scannedOrder 합계 사용).

- [ ] **Step 3: page.tsx 에러 메시지 키 보강**

`apps/frontend/src/app/pda/shipping/page.tsx`의 `errorMessage` switch에 케이스 추가:
```typescript
      case "NOT_CONFIRMED": return t("pda.shipping.notConfirmed");
      case "ORDER_NOT_FOUND": return t("pda.shipping.orderNotFound");
      case "SHIP_FAILED": return t("pda.shipping.shipFailed");
```
출하지시 표시 필드(`orderFields`)가 단일 itemCode를 참조하던 부분을 다중 라인 합계/요약으로 보정:
```typescript
  const orderFields: ScanResultField[] = [
    { label: t("pda.shipping.shipOrderNo"), value: scannedOrder.shipOrderNo, highlight: true },
    { label: t("pda.shipping.customer"), value: scannedOrder.customerName },
    { label: t("pda.shipping.itemCount", "품목수"), value: scannedOrder.items.length },
    { label: t("pda.shipping.orderQty"), value: scannedOrder.orderQty },
  ];
```

- [ ] **Step 4: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건 (ShipOrderData 변경에 따른 잔여 참조 모두 수정)

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/hooks/pda/useShippingScan.ts apps/frontend/src/hooks/pda/useShippingScan.types.ts "apps/frontend/src/app/pda/shipping/page.tsx"
git commit -m "fix(pda): repair shipping scan to use ship-box endpoint + multi-line orders"
```

---

## Task 9: PDA 제품입고 — 완제품 창고선택 제거

**Files:**
- Modify: `apps/frontend/src/app/pda/product/receiving/page.tsx`

**배경:** 완제품 입고가 FG 기본창고로 백엔드 강제되므로, 완제품(FINISHED)일 때 창고 선택 UI를 숨기고 안내 표시. 반제품(SEMI_PRODUCT, wip/receive)은 기존 유지.

- [ ] **Step 1: 완제품일 때 WarehouseSelect 숨김 + 입고 가드 완화**

`handleReceive`의 `if (!box || !warehouseCode) return;` 가드를 완제품일 때 창고 불필요하도록 수정:
```typescript
    if (!box) return;
    if (itemType === 'SEMI_PRODUCT' && !warehouseCode) return;
```
`fg/receive` 호출 시 `warehouseId`는 백엔드가 무시하고 FG 기본창고로 강제하므로, 완제품은 `warehouseId`를 빈 문자열로 보내도 무방(백엔드가 덮어씀). 단 DTO가 `@IsString()`이므로 빈 문자열 허용. 안전하게:
```typescript
      warehouseId: itemType === 'SEMI_PRODUCT' ? warehouseCode : (warehouseCode || 'FG_MAIN'),
```

창고 선택 UI 블록을 반제품일 때만 노출:
```tsx
{box && itemType === 'SEMI_PRODUCT' && (
  /* 기존 WarehouseSelect 블록 그대로 */
)}
{box && itemType !== 'SEMI_PRODUCT' && (
  <div className="px-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
    {t('pda.productReceiving.fgAutoWarehouse', '완제품은 양품창고(FG 기본창고)로 자동 입고됩니다.')}
  </div>
)}
```

- [ ] **Step 2: i18n — `pda.productReceiving.fgAutoWarehouse` 4파일 추가**

ko: `"fgAutoWarehouse": "완제품은 양품창고(FG 기본창고)로 자동 입고됩니다."`
en: `"fgAutoWarehouse": "Finished goods are auto-received into the default FG warehouse."`
zh: `"fgAutoWarehouse": "成品自动入库至良品仓库(FG 默认仓库)。"`
vi: `"fgAutoWarehouse": "Thành phẩm được tự động nhập vào kho FG mặc định."`

- [ ] **Step 3: 타입체크 + i18n 검증**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Run: `grep -l "fgAutoWarehouse" apps/frontend/src/locales/ko/translation.json apps/frontend/src/locales/en/translation.json apps/frontend/src/locales/zh/translation.json apps/frontend/src/locales/vi/translation.json`
Expected: tsc 0건, 4파일 모두 출력

- [ ] **Step 4: Commit**

```bash
git add "apps/frontend/src/app/pda/product/receiving/page.tsx" apps/frontend/src/locales/ko/translation.json apps/frontend/src/locales/en/translation.json apps/frontend/src/locales/zh/translation.json apps/frontend/src/locales/vi/translation.json
git commit -m "feat(pda): hide warehouse select for FG receive (auto FG_MAIN)"
```

---

## Task 10: PDA i18n — 출하 에러 문자열 (4파일)

**Files:**
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}/translation.json`

- [ ] **Step 1: `pda.shipping`에 키 추가 (없는 것만)**

ko:
```json
"notConfirmed": "확정(CONFIRMED) 출하지시만 출하할 수 있습니다.",
"orderNotFound": "출하지시를 찾을 수 없습니다.",
"shipFailed": "출하 처리에 실패했습니다.",
"itemCount": "품목수"
```
en:
```json
"notConfirmed": "Only CONFIRMED ship orders can be shipped.",
"orderNotFound": "Ship order not found.",
"shipFailed": "Failed to ship.",
"itemCount": "Items"
```
zh:
```json
"notConfirmed": "仅可出货已确认(CONFIRMED)的出货指示。",
"orderNotFound": "未找到出货指示。",
"shipFailed": "出货处理失败。",
"itemCount": "品项数"
```
vi:
```json
"notConfirmed": "Chỉ lệnh xuất hàng đã xác nhận (CONFIRMED) mới được xuất.",
"orderNotFound": "Không tìm thấy lệnh xuất hàng.",
"shipFailed": "Xử lý xuất hàng thất bại.",
"itemCount": "Số mặt hàng"
```

- [ ] **Step 2: 검증**

Run: `grep -l "notConfirmed" apps/frontend/src/locales/ko/translation.json apps/frontend/src/locales/en/translation.json apps/frontend/src/locales/zh/translation.json apps/frontend/src/locales/vi/translation.json`
Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 4파일 출력, tsc 0건

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/locales/ko/translation.json apps/frontend/src/locales/en/translation.json apps/frontend/src/locales/zh/translation.json apps/frontend/src/locales/vi/translation.json
git commit -m "i18n(pda): add shipping error strings (ko/en/zh/vi)"
```

---

## Task 11: 이중 차감 가드 점검

**Files:**
- Inspect: `apps/backend/src/modules/shipping/services/shipment.service.ts`
- Inspect: `apps/backend/src/modules/shipping/services/box.service.ts`

**배경:** 기존 팔레트 `markAsShipped`도 FG_OUT을 차감한다. 박스스캔으로 `SHIPPED`된 박스가 팔레트 적재/출하 경로로 재차감되면 안 된다.

- [ ] **Step 1: 차감/적재 경로의 박스 상태 가드 확인**

Run: `grep -n "SHIPPED\|status\|FG_OUT\|markAsShipped\|loadPallets\|assignToPallet" apps/backend/src/modules/shipping/services/shipment.service.ts apps/backend/src/modules/shipping/services/box.service.ts`

확인 사항:
- `assignToPallet`/`loadPallets`가 `status==='CLOSED'` 박스만 받는가 (SHIPPED 박스 거부?)
- `markAsShipped`가 박스를 다시 차감하는 경로에 이미 SHIPPED된 박스를 제외하는가

- [ ] **Step 2: 가드 누락 시 추가**

`box.service.ts`의 `assignToPallet`에 SHIPPED 거부 가드가 없으면 추가:
```typescript
    if (box.status === 'SHIPPED') {
      throw new BadRequestException(`이미 출하된 박스는 팔레트에 적재할 수 없습니다: ${box.boxNo}`);
    }
```
가드가 이미 충분하면(예: `status !== 'CLOSED'` 거부) **수정하지 말고** 점검 결과만 기록.

- [ ] **Step 3: 타입체크 (변경한 경우만)**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 4: Commit (변경한 경우만)**

```bash
git add apps/backend/src/modules/shipping/services/box.service.ts
git commit -m "fix(shipping): guard SHIPPED box from pallet assignment (double-issue)"
```

변경이 없으면 커밋 없이 점검 결과를 `.ai-coordination/JOURNAL.md`에 한 줄 기록.

---

## Task 12: 실DB End-to-End 검증 + 데이터 정리

**Files:** 없음 (검증 전용)

**전제:** 사용자가 dev 서버(3002)를 띄운 상태면 `pnpm build` 금지. tsc + API/DB로만 검증.

- [ ] **Step 1: 백엔드 전체 타입체크 + 단위테스트**

Run: `pnpm --filter @harness/backend exec tsc --noEmit && pnpm --filter @harness/backend exec jest ship-order.service.spec --silent`
Expected: 모두 통과

- [ ] **Step 2: 테스트 데이터 준비 (실DB JSHANES)**

확인 쿼리로 현재 상태 파악:
```
SELECT BOX_NO, ITEM_CODE, QTY, STATUS, OQC_STATUS FROM BOX_MASTERS WHERE COMPANY='40' AND PLANT_CD='1000' AND STATUS='CLOSED';
SELECT WAREHOUSE_CODE, ITEM_CODE, PRD_UID, QTY, AVAILABLE_QTY FROM PRODUCT_STOCKS WHERE COMPANY='40' AND PLANT_CD='1000';
SELECT SHIP_ORDER_NO, STATUS FROM SHIPMENT_ORDERS WHERE COMPANY='40' AND PLANT_CD='1000';
```
필요 시: OQC PASS·CLOSED 박스 1건, 해당 itemCode를 라인으로 가진 CONFIRMED 출하지시 1건, FG_MAIN(또는 현 보유 창고를 FG_MAIN으로 이행)에 충분한 FINISHED 재고(prdUid='*')를 준비.
> 주의: 현재 재고는 `WH-FG`에 있음. Task 4로 신규 입고는 FG_MAIN으로 가지만, 기존 WH-FG 재고는 검증을 위해 FG_MAIN으로 이행하거나 FG_MAIN에 신규 입고. 운영 데이터 이행은 범위 밖.

- [ ] **Step 3: API 풀사이클 검증 (dev 서버 경유 또는 직접)**

1. `GET /shipping/orders/:no` → 라인·상태 확인
2. `POST /shipping/orders/:no/ship-box { boxNo }` → 200, 응답 `lineShippedQty` 증가, `orderStatus`
3. DB 확인:
   - `BOX_MASTERS.STATUS = 'SHIPPED'`
   - `PRODUCT_STOCKS.QTY` 차감(FG_MAIN)
   - `PRODUCT_TRANSACTIONS`에 `FG_OUT`, `REF_TYPE='SHIP_ORDER'`, `REF_ID=:no` 1건
   - `SHIPMENT_ORDER_ITEMS.SHIPPED_QTY` 증가
   - 전량 시 `SHIPMENT_ORDERS.STATUS='CLOSED'`
4. 동일 박스 재출하 시도 → 400 "이미 출하된 박스"

- [ ] **Step 4: 검증 후 테스트 데이터 원복**

출하 처리한 박스/재고/지시 상태를 검증 전 상태로 되돌리는 SQL 실행(트랜잭션 역분개 또는 UPDATE 원복). 원복 결과 재확인.

- [ ] **Step 5: 협업 보드 갱신 + lock 해제**

`.ai-coordination/JOURNAL.md`에 구현·검증 내역 기록, `.ai-coordination/ARCHIVE.md`에 한 줄, `LOCKS.md`에서 T-SHIP-BOX-SCAN 해제. (협업 변경은 기능 커밋과 분리)

```bash
git add .ai-coordination/
git commit -m "chore(ai-coordination): T-SHIP-BOX-SCAN done + board update"
```

---

## 완료 기준 (Definition of Done)

- 백엔드 `tsc` 0건, `ship-order.service.spec` 7케이스 통과
- 프론트 `tsc --noEmit` 0건
- 웹 `/shipping/confirm` "박스 스캔 출하" 모달에서 지시 스캔 → 박스 스캔 → 즉시 출하 동작
- PDA `/pda/shipping`이 `ship-box`로 정상 출하(작업자 QR 기록)
- 완제품 박스 입고가 FG_MAIN으로 입고됨
- 실DB end-to-end 1건 출하 검증 후 데이터 원복
- i18n 4파일 동기화(boxScan, pda.shipping 에러, fgAutoWarehouse)
- LOCKS.md 해제, JOURNAL/ARCHIVE 갱신
