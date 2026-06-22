# Material Lot Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 키오스크 자재리스트 패널을 이미지 설계에 맞게 재구성 — BOM 항목마다 바코드 스캔으로 롯트를 등록하고, 오장착(BOM 미등재 자재)을 방지한다.

**Architecture:**
- 백엔드: `JOB_MATERIAL_LOTS` 테이블 신설, NestJS entity/service/controller 추가
- 프론트엔드: `kioskStore`에 `scannedMaterialLots` 배열 추가, `MaterialListPanel` UI 전면 개편, `EquipHeader` 바코드 핸들러 구현
- 스캔 흐름: 헤더 바코드 입력 → `GET /material/lots/by-uid/:matUid` → BOM 검증 → `POST /production/job-orders/:no/material-lots` 저장

**Tech Stack:** NestJS + TypeORM + Oracle, Next.js 15, Zustand, react-i18next, Tailwind CSS

---

## File Map

| 작업 | 파일 |
|---|---|
| CREATE | `apps/backend/src/entities/job-material-lot.entity.ts` |
| CREATE | `apps/backend/src/modules/production/dto/job-material-lot.dto.ts` |
| CREATE | `apps/backend/src/modules/production/services/job-material-lot.service.ts` |
| CREATE | `apps/backend/src/modules/production/controllers/job-material-lot.controller.ts` |
| MODIFY | `apps/backend/src/modules/production/production.module.ts` |
| MODIFY | `apps/frontend/src/stores/kioskStore.ts` |
| MODIFY | `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialListPanel.tsx` |
| MODIFY | `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipHeader.tsx` |
| MODIFY | `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialScanModal.tsx` |
| MODIFY | `apps/frontend/src/locales/ko.json`, `en.json`, `zh.json`, `vi.json` |

---

## Task 1: Oracle DDL — JOB_MATERIAL_LOTS 테이블 생성

**Files:** 없음 (oracle-db 도구로 직접 실행)

- [ ] **Step 1: DDL 실행** — `oracle-db` 도구로 JSHANES 사이트에 실행

```sql
CREATE TABLE JOB_MATERIAL_LOTS (
  JOB_ORDER_NO  VARCHAR2(50)  NOT NULL,
  ITEM_CODE     VARCHAR2(50)  NOT NULL,
  SEQ           NUMBER        NOT NULL,
  MAT_UID       VARCHAR2(50)  NOT NULL,
  INIT_QTY      NUMBER        DEFAULT 0 NOT NULL,
  SCANNED_BY    VARCHAR2(100),
  SCANNED_AT    TIMESTAMP     DEFAULT SYSTIMESTAMP,
  COMPANY       VARCHAR2(50),
  PLANT_CD      VARCHAR2(50),
  CONSTRAINT PK_JOB_MATERIAL_LOTS PRIMARY KEY (JOB_ORDER_NO, ITEM_CODE, SEQ)
);
CREATE INDEX IDX_JML_JOB_ORDER ON JOB_MATERIAL_LOTS (JOB_ORDER_NO);
CREATE INDEX IDX_JML_MAT_UID   ON JOB_MATERIAL_LOTS (MAT_UID);
```

- [ ] **Step 2: 생성 확인**

```sql
SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME = 'JOB_MATERIAL_LOTS';
```

Expected: 1 row returned

---

## Task 2: Backend — Entity

**Files:**
- Create: `apps/backend/src/entities/job-material-lot.entity.ts`

- [ ] **Step 1: 엔티티 파일 생성**

```typescript
/**
 * @file src/entities/job-material-lot.entity.ts
 * @description 작업지시별 자재 롯트 스캔 등록 엔티티
 */
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'JOB_MATERIAL_LOTS' })
export class JobMaterialLot {
  @PrimaryColumn({ name: 'JOB_ORDER_NO', length: 50 })
  jobOrderNo: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @PrimaryColumn({ name: 'SEQ', type: 'number' })
  seq: number;

  @Column({ name: 'MAT_UID', length: 50 })
  matUid: string;

  @Column({ name: 'INIT_QTY', type: 'number', default: 0 })
  initQty: number;

  @Column({ name: 'SCANNED_BY', length: 100, nullable: true })
  scannedBy: string | null;

  @Column({ name: 'SCANNED_AT', type: 'timestamp', nullable: true })
  scannedAt: Date | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/entities/job-material-lot.entity.ts
git commit -m "feat: add JobMaterialLot entity for material lot scan tracking"
```

---

## Task 3: Backend — DTO

**Files:**
- Create: `apps/backend/src/modules/production/dto/job-material-lot.dto.ts`

- [ ] **Step 1: DTO 파일 생성**

```typescript
/**
 * @file dto/job-material-lot.dto.ts
 * @description 자재 롯트 스캔 등록/조회 DTO
 */
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class RegisterMaterialLotDto {
  @IsString()
  @IsNotEmpty()
  itemCode: string;

  @IsNumber()
  seq: number;

  @IsString()
  @IsNotEmpty()
  matUid: string;

  @IsNumber()
  @IsOptional()
  initQty?: number;

  @IsString()
  @IsOptional()
  scannedBy?: string;
}

export class ScanBarcodeDto {
  @IsString()
  @IsNotEmpty()
  matUid: string;

  @IsString()
  @IsOptional()
  scannedBy?: string;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/dto/job-material-lot.dto.ts
git commit -m "feat: add job-material-lot DTOs"
```

---

## Task 4: Backend — Service

**Files:**
- Create: `apps/backend/src/modules/production/services/job-material-lot.service.ts`

- [ ] **Step 1: 서비스 파일 생성**

```typescript
/**
 * @file services/job-material-lot.service.ts
 * @description 작업지시별 자재 롯트 스캔 등록/조회/삭제
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobMaterialLot } from '../../../entities/job-material-lot.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { RegisterMaterialLotDto, ScanBarcodeDto } from '../dto/job-material-lot.dto';

@Injectable()
export class JobMaterialLotService {
  constructor(
    @InjectRepository(JobMaterialLot)
    private readonly repo: Repository<JobMaterialLot>,
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
  ) {}

  /** 작업지시의 자재 롯트 목록 조회 */
  async findByJobOrder(jobOrderNo: string): Promise<JobMaterialLot[]> {
    return this.repo.find({ where: { jobOrderNo } });
  }

  /**
   * 바코드(matUid) 스캔 후 BOM 항목에 롯트 등록
   * bomItems: 프론트에서 전달한 BOM 항목 [{itemCode, seq}]
   */
  async scanAndRegister(
    jobOrderNo: string,
    dto: ScanBarcodeDto,
    bomItems: { itemCode: string; seq: number }[],
    company?: string,
    plant?: string,
  ): Promise<JobMaterialLot> {
    const matLot = await this.matLotRepo.findOne({ where: { matUid: dto.matUid } });
    if (!matLot) {
      throw new NotFoundException(`LOT를 찾을 수 없습니다: ${dto.matUid}`);
    }

    const matched = bomItems.find(b => b.itemCode === matLot.itemCode);
    if (!matched) {
      throw new BadRequestException(`오장착: BOM에 없는 자재입니다 (${matLot.itemCode})`);
    }

    const existing = await this.repo.findOne({
      where: { jobOrderNo, itemCode: matched.itemCode, seq: matched.seq },
    });
    if (existing) {
      // 같은 LOT면 그대로 반환, 다른 LOT면 업데이트
      if (existing.matUid === dto.matUid) return existing;
      existing.matUid = dto.matUid;
      existing.initQty = matLot.initQty;
      existing.scannedBy = dto.scannedBy ?? null;
      existing.scannedAt = new Date();
      return this.repo.save(existing);
    }

    const record = this.repo.create({
      jobOrderNo,
      itemCode: matched.itemCode,
      seq: matched.seq,
      matUid: dto.matUid,
      initQty: matLot.initQty,
      scannedBy: dto.scannedBy ?? null,
      scannedAt: new Date(),
      company: company ?? null,
      plant: plant ?? null,
    });
    return this.repo.save(record);
  }

  /** 특정 BOM 항목의 롯트 등록 취소 */
  async remove(jobOrderNo: string, itemCode: string, seq: number): Promise<void> {
    await this.repo.delete({ jobOrderNo, itemCode, seq });
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/services/job-material-lot.service.ts
git commit -m "feat: add JobMaterialLotService with scan validation and lot registration"
```

---

## Task 5: Backend — Controller + Module 등록

**Files:**
- Create: `apps/backend/src/modules/production/controllers/job-material-lot.controller.ts`
- Modify: `apps/backend/src/modules/production/production.module.ts`

- [ ] **Step 1: 컨트롤러 생성**

```typescript
/**
 * @file controllers/job-material-lot.controller.ts
 * @description 작업지시 자재 롯트 스캔 API
 */
import {
  Controller, Get, Post, Delete, Param, Body, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JobMaterialLotService } from '../services/job-material-lot.service';
import { ScanBarcodeDto } from '../dto/job-material-lot.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

interface BomItemRef { itemCode: string; seq: number; }

@ApiTags('생산관리 - 자재롯트 스캔')
@Controller('production/job-orders/:orderNo/material-lots')
export class JobMaterialLotController {
  constructor(private readonly svc: JobMaterialLotService) {}

  @Get()
  @ApiOperation({ summary: '작업지시 자재 롯트 목록' })
  async findAll(@Param('orderNo') orderNo: string) {
    const data = await this.svc.findByJobOrder(orderNo);
    return ResponseUtil.success(data);
  }

  @Post('scan')
  @ApiOperation({ summary: '바코드 스캔 — LOT 검증 후 등록' })
  async scan(
    @Param('orderNo') orderNo: string,
    @Body() body: { matUid: string; bomItems: BomItemRef[]; scannedBy?: string },
    @Company() company: string,
    @Plant() plant: string,
    @Request() req: { user?: { username?: string } },
  ) {
    const dto: ScanBarcodeDto = {
      matUid: body.matUid,
      scannedBy: body.scannedBy ?? req.user?.username,
    };
    const data = await this.svc.scanAndRegister(
      orderNo, dto, body.bomItems, company, plant,
    );
    return ResponseUtil.success(data, '자재 롯트가 등록되었습니다.');
  }

  @Delete(':itemCode/:seq')
  @ApiOperation({ summary: '자재 롯트 등록 취소' })
  async remove(
    @Param('orderNo') orderNo: string,
    @Param('itemCode') itemCode: string,
    @Param('seq') seq: string,
  ) {
    await this.svc.remove(orderNo, itemCode, Number(seq));
    return ResponseUtil.success(null, '롯트 등록이 취소되었습니다.');
  }
}
```

- [ ] **Step 2: `production.module.ts` 수정**

`import` 블록 끝에 추가:
```typescript
import { JobMaterialLot } from '../../entities/job-material-lot.entity';
import { JobMaterialLotController } from './controllers/job-material-lot.controller';
import { JobMaterialLotService } from './services/job-material-lot.service';
```

`TypeOrmModule.forFeature([...])` 배열에 `JobMaterialLot` 추가.

`controllers: [...]` 배열에 `JobMaterialLotController` 추가.

`providers: [...]` 배열에 `JobMaterialLotService` 추가.

- [ ] **Step 3: 빌드 확인**

```bash
cd apps/backend && pnpm build
```

Expected: 에러 없이 빌드 완료

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/modules/production/controllers/job-material-lot.controller.ts
git add apps/backend/src/modules/production/production.module.ts
git commit -m "feat: add JobMaterialLotController and register in ProductionModule"
```

---

## Task 6: Frontend — kioskStore 업데이트

**Files:**
- Modify: `apps/frontend/src/stores/kioskStore.ts`

현재 `scannedMaterials: string[]` → `scannedMaterialLots: ScannedMaterialLot[]` 로 교체.

- [ ] **Step 1: `kioskStore.ts` 수정**

파일 상단 인터페이스 블록에 추가:
```typescript
/** 스캔 완료된 자재 롯트 정보 */
export interface ScannedMaterialLot {
  itemCode: string;
  seq: number;
  matUid: string;
  initQty: number;
}
```

`KioskState` 인터페이스에서:
```typescript
// 제거
scannedMaterials: string[];
// 추가
scannedMaterialLots: ScannedMaterialLot[];
```

액션 함수 교체:
```typescript
// 제거
addScannedMaterial: (itemCode: string) => void;
// 추가
addScannedMaterialLot: (lot: ScannedMaterialLot) => void;
removeScannedMaterialLot: (itemCode: string, seq: number) => void;
clearScannedMaterialLots: () => void;
```

`create(...)` 구현부에서 초기값 교체:
```typescript
// 제거
scannedMaterials: [],
// 추가
scannedMaterialLots: [],
```

액션 구현 교체:
```typescript
// 제거
addScannedMaterial: (itemCode) =>
  set(s => ({ scannedMaterials: [...new Set([...s.scannedMaterials, itemCode])] })),
// 추가
addScannedMaterialLot: (lot) =>
  set(s => {
    const filtered = s.scannedMaterialLots.filter(
      l => !(l.itemCode === lot.itemCode && l.seq === lot.seq)
    );
    return { scannedMaterialLots: [...filtered, lot] };
  }),
removeScannedMaterialLot: (itemCode, seq) =>
  set(s => ({
    scannedMaterialLots: s.scannedMaterialLots.filter(
      l => !(l.itemCode === itemCode && l.seq === seq)
    ),
  })),
clearScannedMaterialLots: () => set({ scannedMaterialLots: [] }),
```

`clearAll` 함수 내부에서도 `scannedMaterials: []` → `scannedMaterialLots: []` 로 교체.

- [ ] **Step 2: `MaterialScanModal.tsx` 호환 수정**

`MaterialScanModal.tsx`에서 `scannedMaterials`, `addScannedMaterial` 참조를 새 API로 교체:
- `scannedMaterials` → `scannedMaterialLots.map(l => l.itemCode)` 로 변환하여 기존 로직 유지
- `addScannedMaterial(code)` → `addScannedMaterialLot({ itemCode: code, seq: 0, matUid: code, initQty: 0 })` (임시 — Task 9에서 정식 교체)

- [ ] **Step 3: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

Expected: 타입 에러 없이 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/stores/kioskStore.ts apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialScanModal.tsx
git commit -m "feat: replace scannedMaterials with scannedMaterialLots in kioskStore"
```

---

## Task 7: Frontend — i18n 키 추가

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`, `en.json`, `zh.json`, `vi.json`

- [ ] **Step 1: 4개 파일에 동시 추가**

`kiosk.material` 객체에 다음 키 추가:

**ko.json:**
```json
"lotNo": "롯트번호",
"lotQty": "롯트수량",
"noLot": "롯트 미등록",
"qtyPer": "소요수량",
"scanOk": "자재 롯트 등록 완료",
"wrongItem": "오장착 경고",
"wrongItemMsg": "BOM에 없는 자재입니다",
"lotNotFound": "LOT를 찾을 수 없습니다",
"alreadyScanned": "이미 스캔된 자재입니다 (롯트 교체됨)",
"removeLot": "롯트 취소",
"allLotScanned": "모든 자재 롯트 등록 완료"
```

**en.json:**
```json
"lotNo": "Lot No.",
"lotQty": "Lot Qty",
"noLot": "No Lot Assigned",
"qtyPer": "Req. Qty",
"scanOk": "Material lot registered",
"wrongItem": "Wrong Material",
"wrongItemMsg": "This material is not in the BOM",
"lotNotFound": "LOT not found",
"alreadyScanned": "Already scanned (lot replaced)",
"removeLot": "Remove Lot",
"allLotScanned": "All material lots registered"
```

**zh.json:**
```json
"lotNo": "批次号",
"lotQty": "批次数量",
"noLot": "未登记批次",
"qtyPer": "需求量",
"scanOk": "物料批次登记完成",
"wrongItem": "错误物料警告",
"wrongItemMsg": "BOM中没有该物料",
"lotNotFound": "找不到该LOT",
"alreadyScanned": "已扫描（批次已替换）",
"removeLot": "取消批次",
"allLotScanned": "所有物料批次登记完成"
```

**vi.json:**
```json
"lotNo": "Số lô",
"lotQty": "SL lô",
"noLot": "Chưa đăng ký lô",
"qtyPer": "SL yêu cầu",
"scanOk": "Đã đăng ký lô vật tư",
"wrongItem": "Cảnh báo sai vật tư",
"wrongItemMsg": "Vật tư không có trong BOM",
"lotNotFound": "Không tìm thấy LOT",
"alreadyScanned": "Đã quét (đã thay thế lô)",
"removeLot": "Huỷ lô",
"allLotScanned": "Đã đăng ký đủ lô vật tư"
```

- [ ] **Step 2: Grep으로 4개 파일 모두 수정됐는지 확인**

```bash
grep -l "lotNo" apps/frontend/src/locales/*.json
```

Expected: 4 files listed

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/locales/
git commit -m "feat: add material lot scan i18n keys for ko/en/zh/vi"
```

---

## Task 8: Frontend — MaterialListPanel UI 재구성

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialListPanel.tsx`

이미지 설계 기준 카드 레이아웃:
```
┌─[초록/빨강 테두리]──────────────────────┐
│  [이미지]  TMN-A05          소요: 1     │
│            M200501-00111    1,000      │
└─────────────────────────────────────────┘
```

- [ ] **Step 1: 파일 전체 교체**

```tsx
"use client";

/**
 * @file components/MaterialListPanel.tsx
 * @description 좌측 패널 — BOM 자재리스트(롯트 스캔 현황) + 소모성 설비 부품
 *
 * 초보자 가이드:
 * - 작업지시 선택 시 BOM 항목 자동 로드
 * - 각 카드: 이미지 + 품목코드 + 소요수량 / 롯트번호 + 입고수량
 * - 초록 테두리: 롯트 스캔 완료 / 빨강 테두리: 미스캔
 * - 상단 헤더 바코드 스캔으로 롯트 등록 (EquipHeader에서 처리)
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, AlertTriangle, AlertCircle, X } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

export interface BomItem {
  id: string;
  childItemCode: string;
  childItemName?: string;
  qtyPer: number;
  seq: number;
  processCode?: string;
}

interface ConsumableItem {
  id: string;
  consumableCode: string;
  consumableName: string;
  currentCount: number;
  maxCount: number;
  category: string;
}

function lifeBarColor(current: number, max: number): string {
  if (max <= 0) return 'bg-gray-300';
  const ratio = current / max;
  if (ratio >= 1) return 'bg-red-500';
  if (ratio >= 0.8) return 'bg-orange-400';
  return 'bg-green-500';
}

function lifeTextColor(current: number, max: number): string {
  if (max <= 0) return '';
  const ratio = current / max;
  if (ratio >= 1) return 'text-red-600 dark:text-red-400';
  if (ratio >= 0.8) return 'text-orange-500 dark:text-orange-400';
  return 'text-text-muted';
}

export default function MaterialListPanel() {
  const { t } = useTranslation();
  const { selectedJobOrder, selectedEquip, scannedMaterialLots, removeScannedMaterialLot } = useKioskStore();
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [consumables, setConsumables] = useState<ConsumableItem[]>([]);

  useEffect(() => {
    if (!selectedJobOrder?.itemCode) { setBomItems([]); return; }
    api.get(`/master/boms/parent/${selectedJobOrder.itemCode}`)
      .then(res => setBomItems(res.data?.data ?? []))
      .catch(() => setBomItems([]));
  }, [selectedJobOrder?.itemCode]);

  useEffect(() => {
    if (!selectedEquip?.equipCode) { setConsumables([]); return; }
    api.get(`/equipment/consumables/mounted/${selectedEquip.equipCode}`)
      .then(res => setConsumables(res.data?.data ?? []))
      .catch(() => setConsumables([]));
  }, [selectedEquip?.equipCode]);

  // 작업지시 변경 시 기존 스캔 내역 서버에서 로드
  useEffect(() => {
    if (!selectedJobOrder?.orderNo) return;
    api.get(`/production/job-orders/${selectedJobOrder.orderNo}/material-lots`)
      .then(res => {
        const lots = res.data?.data ?? [];
        lots.forEach((l: { itemCode: string; seq: number; matUid: string; initQty: number }) => {
          useKioskStore.getState().addScannedMaterialLot({
            itemCode: l.itemCode,
            seq: l.seq,
            matUid: l.matUid,
            initQty: l.initQty,
          });
        });
      })
      .catch(() => {});
  }, [selectedJobOrder?.orderNo]);

  const scannedMap = new Map(
    scannedMaterialLots.map(l => [`${l.itemCode}::${l.seq}`, l])
  );

  const handleRemoveLot = async (item: BomItem) => {
    if (!selectedJobOrder?.orderNo) return;
    try {
      await api.delete(
        `/production/job-orders/${selectedJobOrder.orderNo}/material-lots/${item.childItemCode}/${item.seq}`
      );
      removeScannedMaterialLot(item.childItemCode, item.seq);
    } catch {
      // 삭제 실패 시 무시
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* BOM 자재리스트 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="sticky top-0 bg-card px-3 py-2 border-b border-border/50 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-text">{t('kiosk.material.bomList')}</span>
          <span className="ml-auto text-xs text-text-muted">
            {scannedMaterialLots.length}/{bomItems.length}{t('kiosk.material.unit')}
          </span>
        </div>

        {bomItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <Package className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">{t('kiosk.material.noBom')}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/40 p-1.5 space-y-1.5">
            {bomItems.map((item) => {
              const scanned = scannedMap.get(`${item.childItemCode}::${item.seq}`);
              const isScanned = Boolean(scanned);
              return (
                <li
                  key={`${item.childItemCode}-${item.seq}`}
                  className={[
                    'flex items-center gap-2 px-2 py-1.5 rounded border-2 transition-colors',
                    isScanned
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                      : 'border-red-400 bg-red-50 dark:bg-red-900/10',
                  ].join(' ')}
                >
                  {/* 이미지 자리 */}
                  <div className="w-10 h-10 rounded bg-surface border border-border flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-text-muted opacity-40" />
                  </div>

                  {/* 정보 영역 */}
                  <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-2">
                    {/* 품목코드 | 소요수량 */}
                    <span className="text-xs font-bold text-text truncate">{item.childItemCode}</span>
                    <span className="text-xs font-bold text-text tabular-nums">{item.qtyPer}</span>

                    {/* 롯트번호 | 롯트수량 */}
                    {isScanned ? (
                      <>
                        <span className="text-xs text-green-700 dark:text-green-300 truncate font-medium">{scanned!.matUid}</span>
                        <span className="text-xs text-green-700 dark:text-green-300 tabular-nums font-medium">
                          {scanned!.initQty.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-red-500 dark:text-red-400 italic">{t('kiosk.material.noLot')}</span>
                        <span className="text-xs text-red-400">—</span>
                      </>
                    )}
                  </div>

                  {/* 롯트 취소 버튼 (스캔된 경우만) */}
                  {isScanned && (
                    <button
                      onClick={() => handleRemoveLot(item)}
                      className="shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-text-muted hover:text-red-500 transition-colors"
                      title={t('kiosk.material.removeLot')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 소모성 설비 부품 */}
      <div className="border-t border-border flex-1 min-h-0 overflow-y-auto">
        <div className="sticky top-0 bg-card px-3 py-2 border-b border-border/50 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-xs font-semibold text-text">{t('kiosk.material.consumables')}</span>
        </div>
        {consumables.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <span className="text-xs text-text-muted">{t('kiosk.material.noConsumables')}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {consumables.map((item) => {
              const ratio = item.maxCount > 0 ? item.currentCount / item.maxCount : 0;
              const isWarning = ratio >= 0.8;
              return (
                <li key={item.id} className={`px-3 py-2 ${isWarning ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {ratio >= 1 && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
                    {ratio >= 0.8 && ratio < 1 && <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />}
                    <span className="text-xs font-medium text-text truncate flex-1">{item.consumableName}</span>
                    <span className={`text-xs font-bold tabular-nums shrink-0 ${lifeTextColor(item.currentCount, item.maxCount)}`}>
                      {item.currentCount.toLocaleString()} / {item.maxCount.toLocaleString()}
                    </span>
                  </div>
                  {item.maxCount > 0 && (
                    <div className="w-full bg-surface rounded-full h-1">
                      <div
                        className={`h-1 rounded-full transition-all ${lifeBarColor(item.currentCount, item.maxCount)}`}
                        style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: BomItem 타입을 MaterialScanModal에서도 import 가능하도록 확인**

`MaterialScanModal.tsx`에서 `BomItem` interface가 별도 선언돼 있으면 그대로 두기 (충돌 없음).

- [ ] **Step 3: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

Expected: 타입 에러 없이 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialListPanel.tsx
git commit -m "feat: redesign MaterialListPanel with lot scan status cards (green/red border)"
```

---

## Task 9: Frontend — EquipHeader 바코드 스캔 핸들러 구현

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipHeader.tsx`

현재 `handleBarcodeSubmit`은 stub — 실제 스캔 로직 구현.

- [ ] **Step 1: EquipHeader.tsx 수정**

파일 상단 import에 추가:
```tsx
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import type { BomItem } from './MaterialListPanel';
```

`useKioskStore` 구조분해에 추가:
```tsx
const {
  selectedEquip, selectedJobOrder, selectedWorkers,
  setSelectedEquip, removeWorker, addScannedMaterialLot, setInterlock,
} = useKioskStore();
```

컴포넌트 내부에 BOM 항목 상태 추가 (헤더가 스캔 라우팅 기준으로 BOM 알아야 함):
```tsx
const [bomItems, setBomItems] = useState<BomItem[]>([]);

useEffect(() => {
  if (!selectedJobOrder?.itemCode) { setBomItems([]); return; }
  api.get(`/master/boms/parent/${selectedJobOrder.itemCode}`)
    .then(res => setBomItems(res.data?.data ?? []))
    .catch(() => setBomItems([]));
}, [selectedJobOrder?.itemCode]);
```

`handleBarcodeSubmit` 교체:
```tsx
const handleBarcodeSubmit = useCallback(async () => {
  const value = barcodeValue.trim();
  if (!value || !selectedJobOrder?.orderNo) { setBarcodeValue(''); return; }
  setBarcodeValue('');

  // 자재 LOT 스캔 시도
  try {
    const res = await api.post(
      `/production/job-orders/${selectedJobOrder.orderNo}/material-lots/scan`,
      {
        matUid: value,
        bomItems: bomItems.map(b => ({ itemCode: b.childItemCode, seq: b.seq })),
      },
    );
    const lot = res.data?.data as { itemCode: string; seq: number; matUid: string; initQty: number };
    addScannedMaterialLot({ itemCode: lot.itemCode, seq: lot.seq, matUid: lot.matUid, initQty: lot.initQty });
    toast.success(t('kiosk.material.scanOk'));

    // 모든 BOM 항목 스캔 완료 시 인터락 해제
    const currentLots = useKioskStore.getState().scannedMaterialLots;
    const allDone = bomItems.every(b =>
      currentLots.some(l => l.itemCode === b.childItemCode && l.seq === b.seq)
    );
    if (allDone) {
      setInterlock('materialScanDone', true);
      toast.success(t('kiosk.material.allLotScanned'));
    }
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    if (msg?.includes('오장착')) {
      toast.error(`${t('kiosk.material.wrongItem')}: ${msg}`);
    } else if (msg?.includes('LOT를 찾을 수 없습니다')) {
      toast.error(t('kiosk.material.lotNotFound'));
    } else {
      // 자재 LOT가 아닌 다른 바코드 (소모품, 작업자 등) — 무시하고 계속
    }
  }
}, [barcodeValue, selectedJobOrder, bomItems, addScannedMaterialLot, setInterlock, t]);
```

`useState` import에 `useState` 추가 확인 (기존에 없으면):
```tsx
import { useState, useCallback, useEffect } from 'react';
```

- [ ] **Step 2: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

Expected: 에러 없이 통과

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipHeader.tsx
git commit -m "feat: implement barcode scan handler in EquipHeader for material lot registration"
```

---

## Task 10: Frontend — MaterialScanModal 롯트 기반으로 업데이트

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialScanModal.tsx`

현재 모달은 품목코드로 스캔 — 롯트 기반 스캔으로 교체하고 `scannedMaterialLots` 기준으로 상태 표시.

- [ ] **Step 1: MaterialScanModal.tsx 전체 교체**

```tsx
"use client";

/**
 * @file components/MaterialScanModal.tsx
 * @description 자재 바코드 스캔 확인 모달 (롯트 기반)
 *
 * 초보자 가이드:
 * - BOM 자재 목록을 표시하고 바코드 스캔으로 롯트 등록
 * - 스캔된 matUid → GET /material/lots/by-uid → BOM 검증 → POST 등록
 * - 모든 자재 롯트 등록 완료 시 materialScanDone 인터락 해제
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Package, CheckCircle2, ScanLine } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import type { BomItem } from './MaterialListPanel';

interface MaterialScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function MaterialScanModal({ isOpen, onClose, onDone }: MaterialScanModalProps) {
  const { t } = useTranslation();
  const {
    selectedJobOrder, scannedMaterialLots,
    addScannedMaterialLot, setInterlock,
  } = useKioskStore();
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !selectedJobOrder?.itemCode) return;
    api.get(`/master/boms/parent/${selectedJobOrder.itemCode}`)
      .then(res => setBomItems(res.data?.data ?? []))
      .catch(() => setBomItems([]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, selectedJobOrder?.itemCode]);

  const scannedMap = new Map(scannedMaterialLots.map(l => [`${l.itemCode}::${l.seq}`, l]));
  const allScanned = bomItems.length > 0 && bomItems.every(b => scannedMap.has(`${b.childItemCode}::${b.seq}`));
  const unscannedCount = bomItems.filter(b => !scannedMap.has(`${b.childItemCode}::${b.seq}`)).length;

  const handleScan = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const matUid = scanInput.trim();
    if (!matUid || !selectedJobOrder?.orderNo) return;
    setScanInput('');

    try {
      const res = await api.post(
        `/production/job-orders/${selectedJobOrder.orderNo}/material-lots/scan`,
        {
          matUid,
          bomItems: bomItems.map(b => ({ itemCode: b.childItemCode, seq: b.seq })),
        },
      );
      const lot = res.data?.data as { itemCode: string; seq: number; matUid: string; initQty: number };
      addScannedMaterialLot({ itemCode: lot.itemCode, seq: lot.seq, matUid: lot.matUid, initQty: lot.initQty });
      toast.success(t('kiosk.material.scanOk'));

      const currentLots = useKioskStore.getState().scannedMaterialLots;
      const doneAll = bomItems.every(b =>
        currentLots.some(l => l.itemCode === b.childItemCode && l.seq === b.seq)
      );
      if (doneAll) {
        setInterlock('materialScanDone', true);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (msg.includes('오장착')) {
        toast.error(`${t('kiosk.material.wrongItem')}: ${msg}`);
      } else {
        toast.error(msg || t('kiosk.material.lotNotFound'));
      }
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [scanInput, selectedJobOrder, bomItems, addScannedMaterialLot, setInterlock, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.prep.materialScan')} size="lg">
      <div className="space-y-4">
        {/* 스캔 입력 */}
        <div className="flex items-center gap-2 p-3 bg-surface rounded-lg border border-border">
          <ScanLine className="w-5 h-5 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScan}
            placeholder={t('kiosk.material.lotNotFound')}
            className="flex-1 bg-transparent text-sm outline-none text-text placeholder:text-text-muted"
          />
        </div>

        {/* 진행 상황 */}
        <p className="text-sm text-text-muted">
          {unscannedCount > 0
            ? `${unscannedCount}종 미등록`
            : t('kiosk.material.allLotScanned')}
        </p>

        {/* BOM 항목 목록 */}
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {bomItems.map(item => {
            const scanned = scannedMap.get(`${item.childItemCode}::${item.seq}`);
            return (
              <li
                key={`${item.childItemCode}-${item.seq}`}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded border-2',
                  scanned
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                    : 'border-red-400 bg-red-50 dark:bg-red-900/10',
                ].join(' ')}
              >
                <Package className="w-4 h-4 text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text">{item.childItemCode}</p>
                  {scanned
                    ? <p className="text-xs text-green-600 dark:text-green-400">{scanned.matUid}</p>
                    : <p className="text-xs text-red-500 italic">{t('kiosk.material.noLot')}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-text">{item.qtyPer}</p>
                  {scanned && <p className="text-xs text-green-600 dark:text-green-400">{scanned.initQty.toLocaleString()}</p>}
                </div>
                {scanned && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              </li>
            );
          })}
        </ul>

        {/* 완료 버튼 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!allScanned}
            onClick={() => {
              setInterlock('materialScanDone', true);
              onDone();
            }}
          >
            {allScanned ? t('kiosk.material.allLotScanned') : `${unscannedCount}종 남음`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: 빌드 확인 + 완전한 에러 없음 확인**

```bash
cd C:/Project/HANES && pnpm build
```

Expected: 에러 없이 통과

- [ ] **Step 3: 최종 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialScanModal.tsx
git commit -m "feat: update MaterialScanModal to lot-based scanning with BOM validation"
```

---

## 셀프 리뷰 체크리스트

- [x] **스펙 커버리지**: 이미지 레이아웃(Task 8), 바코드 스캔 플로우(Task 9), 오장착 방지(Task 4/9), DB 저장(Task 1-5), kioskStore(Task 6), i18n(Task 7), MaterialScanModal 업데이트(Task 10) — 전부 커버됨
- [x] **플레이스홀더 없음**: 모든 스텝에 실제 코드 포함
- [x] **타입 일관성**: `ScannedMaterialLot`는 Task 6에서 정의 후 Task 8/9/10에서 사용
- [x] **API 경로 일관성**: `POST /production/job-orders/:orderNo/material-lots/scan` (Task 5에서 `/scan` 경로, Task 9/10에서 동일 경로 사용)
