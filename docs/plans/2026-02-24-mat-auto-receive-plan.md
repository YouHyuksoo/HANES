# 자재 자동입고 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** IQC 합격품 라벨 최초 발행 시 기본창고에 자동 입고 처리하는 환경설정 기반 분기 기능 추가

**Architecture:** SYS_CONFIGS에 MAT_AUTO_RECEIVE(BOOLEAN) 설정 추가. receiving.service.ts에 autoReceive() 메서드 추가하여 기본창고 자동 입고. 프론트엔드 receive-label 페이지에서 라벨 인쇄 시 자동입고 설정이면 API 호출 후 인쇄.

**Tech Stack:** NestJS, TypeORM, Next.js, React, i18next

---

### Task 1: SYS_CONFIGS에 MAT_AUTO_RECEIVE 설정 추가

**Files:**
- Modify: `apps/backend/src/seeds/seed-sys-configs.ts` (또는 SQL INSERT)

**Step 1: oracle-db 스킬로 SYS_CONFIGS 테이블에 직접 INSERT**

```sql
INSERT INTO SYS_CONFIGS (
  ID, CONFIG_GROUP, CONFIG_KEY, CONFIG_VALUE, CONFIG_TYPE,
  LABEL, DESCRIPTION, SORT_ORDER, IS_ACTIVE,
  COMPANY, PLANT, CREATED_AT
) VALUES (
  SYS_GUID(), 'MATERIAL', 'MAT_AUTO_RECEIVE', 'N', 'BOOLEAN',
  '자재 자동입고', 'IQC 합격품 라벨 최초 발행 시 기본창고에 자동 입고 처리',
  50, 'Y',
  '40', 'VNHNS', SYSDATE
);
COMMIT;
```

**검증:** 환경설정 페이지(MATERIAL 탭)에서 "자재 자동입고" 토글이 표시되는지 확인

---

### Task 2: MaterialModule에 SystemModule 의존성 추가

**Files:**
- Modify: `apps/backend/src/modules/material/material.module.ts`

**Step 1: SystemModule import 추가**

material.module.ts 상단에 import 추가:
```typescript
import { SystemModule } from '../system/system.module';
```

imports 배열에 `SystemModule` 추가 (InventoryModule, NumRuleModule 옆):
```typescript
imports: [
  InventoryModule,
  NumRuleModule,
  SystemModule,  // ← 추가
  TypeOrmModule.forFeature([...]),
],
```

이로써 ReceivingService에서 SysConfigService를 주입할 수 있음.

---

### Task 3: receiving.dto.ts에 AutoReceiveDto 추가

**Files:**
- Modify: `apps/backend/src/modules/material/dto/receiving.dto.ts`

**Step 1: AutoReceiveDto 추가**

파일 끝에 추가:
```typescript
/** 자동입고 요청 DTO (라벨 발행 시 호출) */
export class AutoReceiveDto {
  @ApiProperty({ description: '입고 대상 LOT ID 목록' })
  @IsArray()
  @IsString({ each: true })
  lotIds: string[];

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;
}
```

---

### Task 4: receiving.service.ts에 autoReceive() 메서드 추가

**Files:**
- Modify: `apps/backend/src/modules/material/services/receiving.service.ts`

**Step 1: SysConfigService 주입 추가**

constructor에 SysConfigService 주입:
```typescript
import { SysConfigService } from '../../system/services/sys-config.service';

constructor(
  // ... 기존 주입들 ...
  private readonly numRuleService: NumRuleService,
  private readonly sysConfigService: SysConfigService,  // ← 추가
) {}
```

**Step 2: autoReceive() 메서드 추가**

클래스 내 `createBulkReceive()` 아래에 추가:

```typescript
/**
 * 자동입고 처리 - 라벨 최초 발행 시 기본창고로 자동 입고
 *
 * 로직:
 * 1. MAT_AUTO_RECEIVE 설정 확인
 * 2. 각 LOT의 기입고 여부 확인 (재발행 판별)
 * 3. 기본 창고(isDefault='Y') 조회
 * 4. 미입고 LOT만 createBulkReceive()로 입고 처리
 */
async autoReceive(lotIds: string[], workerId?: string) {
  // 1. 설정 확인
  const isAutoEnabled = await this.sysConfigService.isEnabled('MAT_AUTO_RECEIVE');
  if (!isAutoEnabled) {
    return { autoReceiveEnabled: false, received: [], skipped: lotIds };
  }

  // 2. 기본 창고 조회
  const defaultWarehouse = await this.warehouseRepository.findOne({
    where: { isDefault: 'Y' },
  });
  if (!defaultWarehouse) {
    return {
      autoReceiveEnabled: true,
      received: [],
      skipped: lotIds,
      error: '기본 창고가 설정되지 않았습니다.',
    };
  }

  // 3. 각 LOT별 기입고 여부 확인 (재발행 판별)
  const received: string[] = [];
  const skipped: string[] = [];
  const receiveItems: { lotId: string; qty: number; warehouseId: string }[] = [];

  for (const lotId of lotIds) {
    // MAT_RECEIVINGS에 해당 LOT 기록이 있으면 재발행 → 스킵
    const existingReceiving = await this.matReceivingRepository.findOne({
      where: { lotId, status: 'DONE' },
    });
    if (existingReceiving) {
      skipped.push(lotId);
      continue;
    }

    // LOT 검증 (IQC 합격 + 잔량)
    const lot = await this.matLotRepository.findOne({
      where: { id: lotId },
    });
    if (!lot || lot.iqcStatus !== 'PASS') {
      skipped.push(lotId);
      continue;
    }

    // 기입고수량 확인
    const receivedAgg = await this.stockTransactionRepository
      .createQueryBuilder('tx')
      .select('SUM(tx.qty)', 'sumQty')
      .where('tx.lotId = :lotId', { lotId })
      .andWhere('tx.transType = :transType', { transType: 'RECEIVE' })
      .andWhere('tx.status = :status', { status: 'DONE' })
      .getRawOne();

    const receivedQty = parseInt(receivedAgg?.sumQty) || 0;
    const remaining = lot.initQty - receivedQty;

    if (remaining <= 0) {
      skipped.push(lotId);
      continue;
    }

    receiveItems.push({
      lotId,
      qty: remaining,
      warehouseId: defaultWarehouse.warehouseCode,
    });
  }

  // 4. 미입고 건이 있으면 일괄 입고
  if (receiveItems.length > 0) {
    await this.createBulkReceive({
      items: receiveItems,
      workerId,
    });
    received.push(...receiveItems.map((i) => i.lotId));
  }

  return {
    autoReceiveEnabled: true,
    received,
    skipped,
    warehouseCode: defaultWarehouse.warehouseCode,
    warehouseName: defaultWarehouse.warehouseName,
  };
}
```

---

### Task 5: receiving.controller.ts에 자동입고 엔드포인트 추가

**Files:**
- Modify: `apps/backend/src/modules/material/controllers/receiving.controller.ts`

**Step 1: POST /material/receiving/auto 엔드포인트 추가**

import에 AutoReceiveDto 추가 후 엔드포인트 추가:

```typescript
import { CreateBulkReceiveDto, ReceivingQueryDto, AutoReceiveDto } from '../dto/receiving.dto';

// ... 기존 엔드포인트들 아래에 추가 ...

@Post('auto')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: '자동입고 처리 (라벨 발행 시)' })
async autoReceive(@Body() dto: AutoReceiveDto) {
  const data = await this.receivingService.autoReceive(dto.lotIds, dto.workerId);
  return ResponseUtil.success(data);
}
```

주의: `@Post('auto')` 는 반드시 `@Post()` 보다 **위에** 배치해야 라우트 충돌 방지

---

### Task 6: 프론트엔드 receive-label 페이지에 자동입고 연동

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/material/receive-label/page.tsx`

**Step 1: useSysConfigStore import 및 자동입고 로직 추가**

handlePrint 함수 수정 — 인쇄 전 자동입고 API 호출:

```typescript
// 기존 import에 추가
import { useSysConfigStore } from "@/stores/sysConfigStore";

// 컴포넌트 내부에서
const { configs } = useSysConfigStore();
const isAutoReceive = configs['MAT_AUTO_RECEIVE'] === 'Y';
```

handlePrint를 수정:
```typescript
const handlePrint = useCallback(async () => {
  const selected = filteredLots.filter((l) => selectedIds.has(l.id));
  if (selected.length === 0) return;

  // 자동입고 처리 (설정 활성 시)
  if (isAutoReceive) {
    try {
      const res = await api.post("/material/receiving/auto", {
        lotIds: selected.map((l) => l.id),
      });
      const result = res.data?.data;
      if (result?.received?.length > 0) {
        // 자동입고 성공 메시지
        alert 대신 toast 또는 console (프로젝트 규칙에 따라)
      }
    } catch (err) {
      console.error("자동입고 실패:", err);
      // 자동입고 실패해도 라벨 인쇄는 계속 진행
    }
  }

  // 기존 인쇄 로직 유지
  setPrinting(true);
  // ... (기존 코드 그대로)
}, [filteredLots, selectedIds, labelDesign, t, isAutoReceive]);
```

실제 구현 시:
1. `isAutoReceive` 확인
2. 선택된 LOT ID 배열로 POST /material/receiving/auto 호출
3. 결과에서 received/skipped 카운트를 토스트로 표시
4. 자동입고 성공 여부와 무관하게 라벨 인쇄 진행
5. 인쇄 후 데이터 새로고침 (fetchData)

---

### Task 7: i18n 4개 언어 파일에 자동입고 메시지 추가

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

material.receiveLabel 섹션 내에 추가:

**ko.json:**
```json
"autoReceive": {
  "success": "자동입고 완료: {{count}}건이 기본창고({{warehouse}})에 입고되었습니다",
  "skipped": "재발행 {{count}}건은 입고를 건너뛰었습니다",
  "noDefaultWarehouse": "기본 창고가 설정되지 않아 자동입고를 건너뛰었습니다",
  "failed": "자동입고 처리 중 오류가 발생했습니다"
}
```

**en.json:**
```json
"autoReceive": {
  "success": "Auto receiving complete: {{count}} lot(s) received to default warehouse ({{warehouse}})",
  "skipped": "{{count}} reprint lot(s) skipped",
  "noDefaultWarehouse": "Auto receiving skipped: no default warehouse configured",
  "failed": "Error occurred during auto receiving"
}
```

**zh.json:**
```json
"autoReceive": {
  "success": "自动入库完成：{{count}}批次已入库至默认仓库（{{warehouse}}）",
  "skipped": "{{count}}批次重新打印已跳过",
  "noDefaultWarehouse": "未设置默认仓库，已跳过自动入库",
  "failed": "自动入库处理中发生错误"
}
```

**vi.json:**
```json
"autoReceive": {
  "success": "Nhập kho tự động hoàn tất: {{count}} lô đã nhập vào kho mặc định ({{warehouse}})",
  "skipped": "{{count}} lô in lại đã bỏ qua",
  "noDefaultWarehouse": "Bỏ qua nhập kho tự động: chưa cấu hình kho mặc định",
  "failed": "Lỗi xảy ra trong quá trình nhập kho tự động"
}
```
