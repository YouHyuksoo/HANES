# Input-Kiosk 설비점검·자주검사 세부 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DailyInspectModal(MEASURE/VISUAL 분기), WorkerInspectModal(API+QR), SelfInspectModal(시료탭+NG재검사), 중물 알림/차단을 완성한다.

**Architecture:** DB 컬럼 추가 → 백엔드 엔티티/DTO/서비스 수정 → 프론트엔드 컴포넌트 재작성 순서로 진행. 기존 API 경로는 유지하고 body/response 필드만 확장한다.

**Tech Stack:** Oracle DB (ALTER TABLE), NestJS+TypeORM (backend), Next.js+Zustand+react-i18next (frontend), pnpm monorepo

---

## 파일 구조

| 역할 | 파일 |
|---|---|
| DB 마이그레이션 | `apps/backend/src/migrations/2026-05-21_add_inspect_item_type_columns.sql` (새 파일) |
| 백엔드 엔티티 | `apps/backend/src/entities/equip-inspect-item-master.entity.ts` |
| 백엔드 엔티티 | `apps/backend/src/entities/self-inspect-item.entity.ts` |
| 백엔드 엔티티 | `apps/backend/src/entities/self-inspect-result.entity.ts` |
| 백엔드 DTO | `apps/backend/src/modules/master/dto/equip-inspect.dto.ts` |
| 백엔드 서비스 | `apps/backend/src/modules/production/services/self-inspect.service.ts` |
| 백엔드 컨트롤러 | `apps/backend/src/modules/production/controllers/self-inspect.controller.ts` |
| 프론트 스토어 | `apps/frontend/src/stores/kioskStore.ts` |
| 프론트 컴포넌트 | `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx` |
| 프론트 컴포넌트 | `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx` |
| 프론트 컴포넌트(새) | `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/SelfInspectItemRow.tsx` |
| 프론트 컴포넌트 | `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/SelfInspectModal.tsx` |
| 프론트 페이지 | `apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx` |
| i18n | `apps/frontend/src/locales/ko.json`, `en.json`, `zh.json`, `vi.json` |

---

## Task 1: DB 마이그레이션 SQL 작성

**Files:**
- Create: `apps/backend/src/migrations/2026-05-21_add_inspect_item_type_columns.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 2026-05-21: 설비점검·자주검사 MEASURE/VISUAL 구분 컬럼 추가

-- 1. EQUIP_INSPECT_ITEM_MASTERS: 점검 유형, 측정단위, LSL/USL, 작업자QR
ALTER TABLE EQUIP_INSPECT_ITEM_MASTERS ADD (
  ITEM_TYPE      VARCHAR2(20)  DEFAULT 'VISUAL',
  UNIT           VARCHAR2(20),
  LSL_VALUE      NUMBER,
  USL_VALUE      NUMBER,
  WORKER_QR_CODE VARCHAR2(50)
);

-- 2. SELF_INSPECT_ITEMS: 검사 유형, 측정단위, LSL/USL, 시료수
ALTER TABLE SELF_INSPECT_ITEMS ADD (
  ITEM_TYPE    VARCHAR2(20)  DEFAULT 'VISUAL',
  UNIT         VARCHAR2(20),
  LSL_VALUE    NUMBER,
  USL_VALUE    NUMBER,
  SAMPLE_COUNT NUMBER        DEFAULT 1
);

-- 3. SELF_INSPECT_RESULTS: 시료번호, 측정값
ALTER TABLE SELF_INSPECT_RESULTS ADD (
  SAMPLE_NO     NUMBER  DEFAULT 1,
  MEASURE_VALUE NUMBER
);

COMMIT;
```

- [ ] **Step 2: oracle-db 도구로 마이그레이션 실행 (JSHANES 사이트)**

마이그레이션 SQL 파일을 oracle-db 도구로 실행한다.

- [ ] **Step 3: 컬럼 추가 확인**

```sql
SELECT COLUMN_NAME, DATA_TYPE, DATA_DEFAULT
FROM USER_TAB_COLUMNS
WHERE TABLE_NAME IN (
  'EQUIP_INSPECT_ITEM_MASTERS',
  'SELF_INSPECT_ITEMS',
  'SELF_INSPECT_RESULTS'
)
AND COLUMN_NAME IN (
  'ITEM_TYPE','UNIT','LSL_VALUE','USL_VALUE',
  'WORKER_QR_CODE','SAMPLE_COUNT','SAMPLE_NO','MEASURE_VALUE'
)
ORDER BY TABLE_NAME, COLUMN_NAME;
```

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/migrations/2026-05-21_add_inspect_item_type_columns.sql
git commit -m "db: add ITEM_TYPE/LSL/USL/SAMPLE_NO columns to inspect tables"
```

---

## Task 2: EquipInspectItemMaster 엔티티 + DTO 수정

**Files:**
- Modify: `apps/backend/src/entities/equip-inspect-item-master.entity.ts`
- Modify: `apps/backend/src/modules/master/dto/equip-inspect.dto.ts`

- [ ] **Step 1: 엔티티에 5개 컬럼 추가**

`apps/backend/src/entities/equip-inspect-item-master.entity.ts` 의 `useYn` 컬럼 아래에 추가:

```typescript
  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  /** MEASURE(측정형) | VISUAL(판정형) */
  @Column({ name: 'ITEM_TYPE', length: 20, default: 'VISUAL' })
  itemType: string;

  @Column({ type: 'varchar2', name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'LSL_VALUE', type: 'number', nullable: true })
  lslValue: number | null;

  @Column({ name: 'USL_VALUE', type: 'number', nullable: true })
  uslValue: number | null;

  /** 작업자점검 QR 코드 페이로드 (INSPECT_TYPE='WORKER' 항목에만 사용) */
  @Column({ type: 'varchar2', name: 'WORKER_QR_CODE', length: 50, nullable: true })
  workerQrCode: string | null;
```

- [ ] **Step 2: DTO에 신규 필드 추가 + WORKER 타입 허용**

`apps/backend/src/modules/master/dto/equip-inspect.dto.ts` 의 `CreateEquipInspectItemDto` 수정:

`useYn` 필드 아래에 추가:
```typescript
  @ApiPropertyOptional({ description: '점검 유형 (MEASURE|VISUAL)', default: 'VISUAL' })
  @IsOptional()
  @IsString()
  @IsIn(['MEASURE', 'VISUAL'])
  itemType?: string;

  @ApiPropertyOptional({ description: '측정 단위 (bar, ℃, mm 등)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: '하한값 (측정형만)' })
  @IsOptional()
  @Type(() => Number)
  lslValue?: number;

  @ApiPropertyOptional({ description: '상한값 (측정형만)' })
  @IsOptional()
  @Type(() => Number)
  uslValue?: number;

  @ApiPropertyOptional({ description: '작업자점검 QR 코드값' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerQrCode?: string;
```

`EquipInspectItemQueryDto` 의 `inspectType` 필드 유효성 검사 값에 `'WORKER'` 추가:
```typescript
  @IsIn(['DAILY', 'PERIODIC', 'PM', 'WORKER'])
  inspectType?: string;
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter backend build
```

Expected: `Build complete` (에러 없음)

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/entities/equip-inspect-item-master.entity.ts \
        apps/backend/src/modules/master/dto/equip-inspect.dto.ts
git commit -m "feat: add itemType/unit/lsl/usl/workerQrCode to EquipInspectItemMaster"
```

---

## Task 3: SelfInspectItem 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/self-inspect-item.entity.ts`

- [ ] **Step 1: 5개 컬럼 추가**

`apps/backend/src/entities/self-inspect-item.entity.ts` 의 `useYn` 컬럼 아래에 추가:

```typescript
  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  /** MEASURE(측정형) | VISUAL(판정형) */
  @Column({ name: 'ITEM_TYPE', length: 20, default: 'VISUAL' })
  itemType: string;

  @Column({ type: 'varchar2', name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'LSL_VALUE', type: 'number', nullable: true })
  lslValue: number | null;

  @Column({ name: 'USL_VALUE', type: 'number', nullable: true })
  uslValue: number | null;

  /** 초물 시료 수 (FIRST 시점에만 적용, MID/LAST는 항상 1) */
  @Column({ name: 'SAMPLE_COUNT', type: 'number', default: 1 })
  sampleCount: number;
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm --filter backend build
```

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/entities/self-inspect-item.entity.ts
git commit -m "feat: add itemType/unit/lsl/usl/sampleCount to SelfInspectItem"
```

---

## Task 4: SelfInspectResult 엔티티 + 서비스/컨트롤러 수정

**Files:**
- Modify: `apps/backend/src/entities/self-inspect-result.entity.ts`
- Modify: `apps/backend/src/modules/production/services/self-inspect.service.ts`
- Modify: `apps/backend/src/modules/production/controllers/self-inspect.controller.ts`

- [ ] **Step 1: SelfInspectResult 엔티티에 sampleNo, measureValue 추가**

`apps/backend/src/entities/self-inspect-result.entity.ts` 의 `remark` 컬럼 아래에 추가:

```typescript
  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  /** 시료 번호 (1부터 시작; FIRST 초물 N개 시료, MID/LAST는 1) */
  @Column({ name: 'SAMPLE_NO', type: 'number', default: 1 })
  sampleNo: number;

  /** 측정값 (MEASURE 타입 항목만; VISUAL은 null) */
  @Column({ name: 'MEASURE_VALUE', type: 'number', nullable: true })
  measureValue: number | null;
```

- [ ] **Step 2: self-inspect.service.ts createResult 메서드에 sampleNo/measureValue 추가**

`apps/backend/src/modules/production/services/self-inspect.service.ts` 의 `createResult` 메서드 DTO 타입 및 본문 수정:

```typescript
  async createResult(
    dto: {
      orderNo: string;
      equipCode?: string;
      processCode?: string;
      inspectItemId?: string;
      itemName: string;
      timing: string;
      inspectMethod: string;
      status: string;
      prodQtyAtInspect?: number;
      inspectorId?: string;
      remark?: string;
      sampleNo?: number;
      measureValue?: number;
    },
    company: string,
    plant: string,
  ) {
    const result = this.resultRepo.create({
      ...dto,
      sampleNo: dto.sampleNo ?? 1,
      measureValue: dto.measureValue ?? null,
      company,
      plant,
      inspectedAt: dto.status !== 'PENDING' ? new Date() : null,
    });
    return this.resultRepo.save(result);
  }
```

- [ ] **Step 3: self-inspect.controller.ts createResult body에 필드 추가**

`apps/backend/src/modules/production/controllers/self-inspect.controller.ts` 의 `createResult` 메서드 body 타입 수정:

```typescript
  @Post('results')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '자주검사 결과 저장' })
  async createResult(
    @Body() dto: {
      orderNo: string;
      equipCode?: string;
      processCode?: string;
      inspectItemId?: string;
      itemName: string;
      timing: string;
      inspectMethod: string;
      status: string;
      prodQtyAtInspect?: number;
      inspectorId?: string;
      remark?: string;
      sampleNo?: number;
      measureValue?: number;
    },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.createResult(dto, company, plant);
    return ResponseUtil.success(data, '자주검사 결과가 저장되었습니다');
  }
```

- [ ] **Step 4: 빌드 확인**

```bash
pnpm --filter backend build
```

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/entities/self-inspect-result.entity.ts \
        apps/backend/src/modules/production/services/self-inspect.service.ts \
        apps/backend/src/modules/production/controllers/self-inspect.controller.ts
git commit -m "feat: add sampleNo/measureValue to SelfInspectResult"
```

---

## Task 5: kioskStore — midInspectDone 상태 추가

**Files:**
- Modify: `apps/frontend/src/stores/kioskStore.ts`

- [ ] **Step 1: KioskState에 midInspectDone 추가**

`apps/frontend/src/stores/kioskStore.ts` 수정:

`hasPendingDelegate: boolean;` 아래에 추가:
```typescript
  /** 중물 자주검사 완료 여부 (진행률 차단 해제용) */
  midInspectDone: boolean;
```

`setHasPendingDelegate` 아래에 추가:
```typescript
  setMidInspectDone: (value: boolean) => void;
```

- [ ] **Step 2: 초기값 + 구현 추가**

`hasPendingDelegate: false,` 아래에 추가:
```typescript
      midInspectDone: false,
```

`setHasPendingDelegate` 구현 아래에 추가:
```typescript
      setMidInspectDone: (value) => set({ midInspectDone: value }),
```

- [ ] **Step 3: setSelectedEquip / setSelectedJobOrder 리셋 핸들러에 midInspectDone: false 추가**

`setSelectedEquip` 핸들러 내 set 객체에:
```typescript
      setSelectedEquip: (equip) => set({
        // ... 기존 필드들 ...
        hasPendingDelegate: false,
        midInspectDone: false,  // 추가
      }),
```

`setSelectedJobOrder` 핸들러 내 set 객체에:
```typescript
      setSelectedJobOrder: (jobOrder) => set({
        // ... 기존 필드들 ...
        midInspectDone: false,  // 추가
      }),
```

`clearAll` 핸들러 내 set 객체에도 `midInspectDone: false` 추가.

- [ ] **Step 4: 빌드 확인**

```bash
pnpm --filter frontend build
```

- [ ] **Step 5: 커밋**

```bash
git add apps/frontend/src/stores/kioskStore.ts
git commit -m "feat: add midInspectDone state to kioskStore"
```

---

## Task 6: i18n 4개 파일 새 키 추가

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: ko.json — kiosk.prep 에 키 추가**

`kiosk.prep` 객체에 추가:
```json
"measureValue": "측정값",
"unit": "단위",
"lsl": "하한(LSL)",
"usl": "상한(USL)",
"workerQrScanner": "QR 스캔",
"workerQrPlaceholder": "QR 코드를 스캔하세요...",
"workerQrNotFound": "미등록 QR: {{code}}",
"workerInspectProgress": "OK {{ok}} / NG {{ng}} / 미완료 {{pending}}",
"workerInspectSaved": "작업자점검이 저장되었습니다",
"workerInspectSaveError": "작업자점검 저장에 실패했습니다"
```

`kiosk.selfInspect` 객체에 추가:
```json
"sampleTab": "시료 {{n}}",
"allSamplesRequired": "모든 시료의 항목을 입력하세요",
"reInspect": "NG 재검사",
"reInspectTitle": "재검사 ({{n}}차)",
"overallPass": "종합 PASS",
"overallFail": "종합 FAIL — {{count}}개 항목 불합격",
"midNotify": "중물 자주검사 시점입니다",
"midBlock": "중물 자주검사 완료 후 실적입력 가능합니다"
```

- [ ] **Step 2: en.json 동일 키 영문 추가**

`kiosk.prep`:
```json
"measureValue": "Measured Value",
"unit": "Unit",
"lsl": "LSL",
"usl": "USL",
"workerQrScanner": "QR Scan",
"workerQrPlaceholder": "Scan QR code...",
"workerQrNotFound": "Unregistered QR: {{code}}",
"workerInspectProgress": "OK {{ok}} / NG {{ng}} / Pending {{pending}}",
"workerInspectSaved": "Worker inspection saved",
"workerInspectSaveError": "Failed to save worker inspection"
```

`kiosk.selfInspect`:
```json
"sampleTab": "Sample {{n}}",
"allSamplesRequired": "Complete all items for every sample",
"reInspect": "NG Re-Inspect",
"reInspectTitle": "Re-inspect ({{n}})",
"overallPass": "Overall PASS",
"overallFail": "Overall FAIL — {{count}} items failed",
"midNotify": "Time for mid-lot inspection",
"midBlock": "Complete mid-lot inspection to continue"
```

- [ ] **Step 3: zh.json 동일 키 중문 추가**

`kiosk.prep`:
```json
"measureValue": "测量值",
"unit": "单位",
"lsl": "下限(LSL)",
"usl": "上限(USL)",
"workerQrScanner": "QR扫描",
"workerQrPlaceholder": "请扫描QR码...",
"workerQrNotFound": "未注册QR: {{code}}",
"workerInspectProgress": "OK {{ok}} / NG {{ng}} / 待检 {{pending}}",
"workerInspectSaved": "作业者设备点检已保存",
"workerInspectSaveError": "作业者设备点检保存失败"
```

`kiosk.selfInspect`:
```json
"sampleTab": "样品 {{n}}",
"allSamplesRequired": "请完成所有样品的检查项目",
"reInspect": "NG复检",
"reInspectTitle": "复检 (第{{n}}次)",
"overallPass": "综合PASS",
"overallFail": "综合FAIL — {{count}}项不合格",
"midNotify": "到中间自主检查时间",
"midBlock": "完成中间检查后可继续投入"
```

- [ ] **Step 4: vi.json 동일 키 베트남어 추가**

`kiosk.prep`:
```json
"measureValue": "Giá trị đo",
"unit": "Đơn vị",
"lsl": "Giới hạn dưới (LSL)",
"usl": "Giới hạn trên (USL)",
"workerQrScanner": "Quét QR",
"workerQrPlaceholder": "Quét mã QR...",
"workerQrNotFound": "QR chưa đăng ký: {{code}}",
"workerInspectProgress": "OK {{ok}} / NG {{ng}} / Chờ {{pending}}",
"workerInspectSaved": "Đã lưu kiểm tra thiết bị",
"workerInspectSaveError": "Lỗi lưu kiểm tra thiết bị"
```

`kiosk.selfInspect`:
```json
"sampleTab": "Mẫu {{n}}",
"allSamplesRequired": "Hoàn thành tất cả hạng mục cho mọi mẫu",
"reInspect": "Kiểm tra lại NG",
"reInspectTitle": "Kiểm tra lại (lần {{n}})",
"overallPass": "Tổng hợp PASS",
"overallFail": "Tổng hợp FAIL — {{count}} hạng mục không đạt",
"midNotify": "Đến thời điểm kiểm tra giữa lô",
"midBlock": "Hoàn thành kiểm tra giữa lô để tiếp tục"
```

- [ ] **Step 5: i18n 키 누락 검증**

```bash
node -e "
const ko = require('./apps/frontend/src/locales/ko.json');
const en = require('./apps/frontend/src/locales/en.json');
const keys = ['midNotify','midBlock','reInspect','sampleTab','workerQrScanner'];
keys.forEach(k => {
  const koVal = ko.kiosk?.selfInspect?.[k] || ko.kiosk?.prep?.[k];
  const enVal = en.kiosk?.selfInspect?.[k] || en.kiosk?.prep?.[k];
  console.log(k, koVal ? 'OK' : 'MISSING in ko', enVal ? 'OK' : 'MISSING in en');
});
"
```

- [ ] **Step 6: 커밋**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json \
        apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -m "feat: add i18n keys for inspect MEASURE/VISUAL, sample tabs, mid-block"
```

---

## Task 7: DailyInspectModal 수정 (MEASURE/VISUAL 분기 + 항목별 비고 + 종합판정 배너)

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx`

- [ ] **Step 1: 파일 전체 교체**

`DailyInspectModal.tsx` 전체를 아래 코드로 교체:

```tsx
"use client";

/**
 * @file components/DailyInspectModal.tsx
 * @description 설비 일일점검 입력 모달
 *
 * 초보자 가이드:
 * - MEASURE(측정형): 숫자 입력 → LSL/USL 비교 → PASS/FAIL 자동 판정
 * - VISUAL(판정형): OK/NG 버튼 직접 선택
 * - 항목별 비고 입력 지원
 * - 종합 판정 배너: 전항목 PASS=초록, NG 있음=빨간 깜빡임
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, ClipboardCheck, Save, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

interface InspectItem {
  seq: number;
  itemName: string;
  criteria?: string;
  itemType: 'MEASURE' | 'VISUAL';
  unit?: string | null;
  lslValue?: number | null;
  uslValue?: number | null;
}

type ItemResult = 'PASS' | 'FAIL' | '';

interface DailyInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

function judgeByRange(
  value: string,
  lsl: number | null | undefined,
  usl: number | null | undefined,
): 'PASS' | 'FAIL' | '' {
  if (!value.trim()) return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  if (lsl != null && num < lsl) return 'FAIL';
  if (usl != null && num > usl) return 'FAIL';
  return 'PASS';
}

export default function DailyInspectModal({ isOpen, onClose, onDone }: DailyInspectModalProps) {
  const { t } = useTranslation();
  const { selectedEquip, selectedWorkers, setInterlock } = useKioskStore();
  const [items, setItems] = useState<InspectItem[]>([]);
  const [results, setResults] = useState<Record<number, ItemResult>>({});
  const [measureValues, setMeasureValues] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!isOpen || !selectedEquip) return;
    api.get('/equipment/daily-inspect/check', {
      params: { equipCode: selectedEquip.equipCode, inspectDate: today },
    }).then(res => {
      if (res.data?.data?.alreadyInspected) {
        setAlreadyDone(true);
        setInterlock('dailyInspectDone', true);
        return;
      }
      setAlreadyDone(false);
    }).catch(() => {});

    api.get('/master/equip-inspect-items', {
      params: { equipCode: selectedEquip.equipCode, inspectType: 'DAILY', limit: '100' },
    }).then(res => {
      const data: InspectItem[] = (res.data?.data ?? []).map((i: InspectItem) => ({
        ...i,
        itemType: i.itemType || 'VISUAL',
      }));
      setItems(data);
      const initResults: Record<number, ItemResult> = {};
      data.forEach(i => { initResults[i.seq] = ''; });
      setResults(initResults);
      setMeasureValues({});
      setRemarks({});
    }).catch(() => setItems([]));
  }, [isOpen, selectedEquip, today, setInterlock]);

  const handleVisualResult = useCallback((seq: number, val: 'PASS' | 'FAIL') => {
    setResults(prev => ({ ...prev, [seq]: val }));
  }, []);

  const handleMeasureChange = useCallback((seq: number, value: string, item: InspectItem) => {
    setMeasureValues(prev => ({ ...prev, [seq]: value }));
    setResults(prev => ({
      ...prev,
      [seq]: judgeByRange(value, item.lslValue, item.uslValue),
    }));
  }, []);

  const allAnswered = items.length > 0 && items.every(i => results[i.seq] !== '');
  const anyFail = items.some(i => results[i.seq] === 'FAIL');
  const inspectorName = selectedWorkers[0]?.workerName ?? '';

  const handleSave = useCallback(async () => {
    if (!selectedEquip) return;
    setSaving(true);
    try {
      const details: Record<string, string> = {};
      items.forEach(i => {
        const base = `${i.seq}_${i.itemName}`;
        details[base] = results[i.seq] || 'PASS';
        if (i.itemType === 'MEASURE' && measureValues[i.seq]) {
          details[`${base}_value`] = measureValues[i.seq];
        }
        if (remarks[i.seq]) details[`${base}_remark`] = remarks[i.seq];
      });

      await api.post('/equipment/daily-inspect', {
        equipCode: selectedEquip.equipCode,
        inspectDate: today,
        inspectorName,
        overallResult: anyFail ? 'FAIL' : 'PASS',
        details,
      });

      setInterlock('dailyInspectDone', true);
      toast.success(t('kiosk.prep.dailyInspectSaved'));
      onDone();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? t('kiosk.prep.dailyInspectError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [selectedEquip, items, results, measureValues, remarks, today, inspectorName,
      anyFail, setInterlock, onDone, t]);

  const handleSkip = useCallback(async () => {
    if (!selectedEquip) return;
    setSaving(true);
    try {
      await api.post('/equipment/daily-inspect', {
        equipCode: selectedEquip.equipCode,
        inspectDate: today,
        inspectorName,
        overallResult: 'PASS',
        remark: '항목 없음 - 자동완료',
      });
      setInterlock('dailyInspectDone', true);
      toast.success(t('kiosk.prep.dailyInspectSaved'));
      onDone();
    } catch {
      setInterlock('dailyInspectDone', true);
      onDone();
    } finally {
      setSaving(false);
    }
  }, [selectedEquip, today, inspectorName, setInterlock, onDone, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.prep.dailyInspectTitle')} size="xl">
      {alreadyDone ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
          <p className="text-lg font-bold text-text">{t('kiosk.prep.alreadyInspected')}</p>
          <p className="text-sm text-text-muted">{today}</p>
          <Button onClick={onDone}>{t('common.confirm')}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 설비 정보 */}
          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <span className="font-medium">{selectedEquip?.equipName}</span>
            <span className="text-text-muted">({selectedEquip?.equipCode})</span>
            <span className="ml-auto text-text-muted">{today}</span>
          </div>

          {/* 종합 판정 배너 (항목 있고 전부 답변된 경우) */}
          {items.length > 0 && allAnswered && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium ${
              anyFail
                ? 'animate-pulse bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                : 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
            }`}>
              {anyFail
                ? <><XCircle className="w-4 h-4 shrink-0" /> {t('kiosk.prep.failWarning')}</>
                : <><CheckCircle2 className="w-4 h-4 shrink-0" /> {t('kiosk.prep.allDone') || '전항목 이상 없음'}</>
              }
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-text-muted">
              <AlertTriangle className="w-10 h-10 opacity-40" />
              <p className="text-sm">{t('kiosk.prep.noInspectItems')}</p>
              <Button onClick={handleSkip} disabled={saving}>
                {t('kiosk.prep.confirmWithoutItems')}
              </Button>
            </div>
          ) : (
            <>
              <div className="max-h-[50vh] overflow-y-auto space-y-2">
                {items.map(item => {
                  const r = results[item.seq];
                  const isFail = r === 'FAIL';
                  return (
                    <div key={item.seq}
                      className={`p-3 border rounded-lg transition-colors ${
                        isFail
                          ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                          : r === 'PASS'
                          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {item.seq}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text">{item.itemName}</p>
                          {item.criteria && (
                            <p className="text-xs text-text-muted">{t('kiosk.prep.standard')}: {item.criteria}</p>
                          )}
                          {item.itemType === 'MEASURE' && (item.lslValue != null || item.uslValue != null) && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              {item.lslValue != null && `${t('kiosk.prep.lsl')}: ${item.lslValue}`}
                              {item.lslValue != null && item.uslValue != null && ' ~ '}
                              {item.uslValue != null && `${t('kiosk.prep.usl')}: ${item.uslValue}`}
                              {item.unit && ` (${item.unit})`}
                            </p>
                          )}
                        </div>

                        {/* 결과 입력 */}
                        {item.itemType === 'MEASURE' ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="number"
                              value={measureValues[item.seq] ?? ''}
                              onChange={e => handleMeasureChange(item.seq, e.target.value, item)}
                              placeholder={item.unit ?? '값'}
                              className="w-24 px-2 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            {r === 'PASS' && <span className="text-xs font-bold text-green-600">PASS</span>}
                            {r === 'FAIL' && <span className="text-xs font-bold text-red-600">FAIL</span>}
                          </div>
                        ) : (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleVisualResult(item.seq, 'PASS')}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                                r === 'PASS'
                                  ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                                  : 'border-border text-text-muted hover:bg-green-50 dark:hover:bg-green-900/10'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" /> OK
                            </button>
                            <button
                              onClick={() => handleVisualResult(item.seq, 'FAIL')}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                                r === 'FAIL'
                                  ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                                  : 'border-border text-text-muted hover:bg-red-50 dark:hover:bg-red-900/10'
                              }`}
                            >
                              <XCircle className="w-4 h-4" /> NG
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 항목별 비고 */}
                      <div className="mt-2 pl-10">
                        <input
                          type="text"
                          value={remarks[item.seq] ?? ''}
                          onChange={e => setRemarks(prev => ({ ...prev, [item.seq]: e.target.value }))}
                          placeholder={t('kiosk.prep.remark')}
                          className="w-full px-2 py-1 text-xs border border-border rounded bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
                <Button onClick={handleSave} disabled={!allAnswered || saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? t('common.saving') : t('kiosk.prep.saveInspect')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm --filter frontend build
```

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/production/input-kiosk/components/DailyInspectModal.tsx
git commit -m "feat: DailyInspectModal - MEASURE/VISUAL branching, per-item remark, verdict banner"
```

---

## Task 8: WorkerInspectModal 수정 (API 연동 + QR 스캐너)

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx`

- [ ] **Step 1: 파일 전체 교체**

```tsx
"use client";

/**
 * @file components/WorkerInspectModal.tsx
 * @description 작업자 설비 자가점검 모달
 *
 * 초보자 가이드:
 * - 항목: GET /master/equip-inspect-items?inspectType=WORKER (API 연동)
 * - QR 스캔: workerQrCode 매칭 → 해당 항목 OK/NG 활성화
 * - 종합 판정: NG 있으면 작업 시작 차단
 * - 저장: POST /equipment/daily-inspect (inspectType=WORKER)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, QrCode, Wrench, User } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

interface WorkerInspectItem {
  seq: number;
  itemName: string;
  criteria?: string | null;
  workerQrCode?: string | null;
}

type ItemResult = 'OK' | 'NG' | '';

interface WorkerInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function WorkerInspectModal({ isOpen, onClose, onDone }: WorkerInspectModalProps) {
  const { t } = useTranslation();
  const { selectedEquip, selectedJobOrder, selectedWorkers, setInterlock } = useKioskStore();
  const [items, setItems] = useState<WorkerInspectItem[]>([]);
  const [results, setResults] = useState<Record<number, ItemResult>>({});
  const [qrInput, setQrInput] = useState('');
  const [activeSeq, setActiveSeq] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !selectedEquip) return;
    setLoading(true);
    setResults({});
    setQrInput('');
    setActiveSeq(null);
    api.get('/master/equip-inspect-items', {
      params: { equipCode: selectedEquip.equipCode, inspectType: 'WORKER', limit: '100' },
    }).then(res => {
      const data: WorkerInspectItem[] = res.data?.data ?? [];
      setItems(data);
      const init: Record<number, ItemResult> = {};
      data.forEach(i => { init[i.seq] = ''; });
      setResults(init);
    }).catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isOpen, selectedEquip]);

  // 모달 오픈 시 QR 입력 자동 포커스
  useEffect(() => {
    if (isOpen) setTimeout(() => qrRef.current?.focus(), 100);
  }, [isOpen]);

  const handleQrScan = useCallback((code: string) => {
    const matched = items.find(i => i.workerQrCode && i.workerQrCode === code.trim());
    if (!matched) {
      toast.error(t('kiosk.prep.workerQrNotFound', { code }));
      setQrInput('');
      return;
    }
    setActiveSeq(matched.seq);
    setQrInput('');
  }, [items, t]);

  const handleQrKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && qrInput.trim()) {
      handleQrScan(qrInput);
    }
  }, [qrInput, handleQrScan]);

  const handleResult = useCallback((seq: number, val: 'OK' | 'NG') => {
    setResults(prev => ({ ...prev, [seq]: val }));
    setActiveSeq(null);
    setTimeout(() => qrRef.current?.focus(), 50);
  }, []);

  const okCount = items.filter(i => results[i.seq] === 'OK').length;
  const ngCount = items.filter(i => results[i.seq] === 'NG').length;
  const pendingCount = items.filter(i => results[i.seq] === '').length;
  const allAnswered = items.length > 0 && pendingCount === 0;
  const anyNg = ngCount > 0;

  const handleSave = useCallback(async () => {
    if (!selectedEquip || !allAnswered) return;
    setSaving(true);
    try {
      const details: Record<string, string> = {};
      items.forEach(i => { details[`${i.seq}_${i.itemName}`] = results[i.seq]; });
      await api.post('/equipment/daily-inspect', {
        equipCode: selectedEquip.equipCode,
        inspectDate: new Date().toISOString().split('T')[0],
        inspectorName: selectedWorkers[0]?.workerName ?? '',
        inspectType: 'WORKER',
        overallResult: anyNg ? 'FAIL' : 'PASS',
        details,
      });
      setInterlock('workerInspectDone', !anyNg);
      toast.success(t('kiosk.prep.workerInspectSaved'));
      if (!anyNg) onDone();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? t('kiosk.prep.workerInspectSaveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [selectedEquip, allAnswered, items, results, selectedWorkers, anyNg, setInterlock, onDone, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.prep.workerInspectTitle')} size="lg">
      <div className="space-y-4">
        {/* 설비 + 작업지시 + 작업자 */}
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm space-y-1">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            <span className="font-medium">{selectedEquip?.equipName}</span>
            <span className="text-text-muted text-xs">({selectedEquip?.equipCode})</span>
          </div>
          {selectedJobOrder && (
            <div className="flex items-center gap-2 pl-6 text-xs text-text-muted">
              {t('kiosk.prep.jobOrder')}: <span className="font-mono text-primary">{selectedJobOrder.orderNo}</span>
            </div>
          )}
          {selectedWorkers.length > 0 && (
            <div className="flex items-center gap-2 pl-6 text-xs">
              <User className="w-3.5 h-3.5 text-primary" />
              <span className="text-text-muted">{t('kiosk.prep.inspector')}:</span>
              <span className="font-medium">{selectedWorkers.map(w => w.workerName).join(', ')}</span>
            </div>
          )}
        </div>

        {/* QR 스캐너 입력 */}
        {items.some(i => i.workerQrCode) && (
          <div className="flex items-center gap-2 p-2 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/40 dark:bg-blue-900/10">
            <QrCode className="w-4 h-4 text-blue-500 shrink-0" />
            <input
              ref={qrRef}
              type="text"
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              onKeyDown={handleQrKeyDown}
              placeholder={t('kiosk.prep.workerQrPlaceholder')}
              className="flex-1 text-sm bg-transparent focus:outline-none"
            />
          </div>
        )}

        {/* 진행 현황 */}
        {items.length > 0 && (
          <p className="text-xs text-text-muted text-right">
            {t('kiosk.prep.workerInspectProgress', { ok: okCount, ng: ngCount, pending: pendingCount })}
          </p>
        )}

        {/* 종합 판정 배너 (전부 답변 후) */}
        {allAnswered && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium ${
            anyNg
              ? 'animate-pulse bg-red-50 dark:bg-red-950 border-red-300 text-red-700 dark:text-red-300'
              : 'bg-green-50 dark:bg-green-950 border-green-300 text-green-700 dark:text-green-300'
          }`}>
            {anyNg
              ? <><XCircle className="w-4 h-4" /> {t('kiosk.prep.failWarning')}</>
              : <><CheckCircle2 className="w-4 h-4" /> {t('kiosk.selfInspect.overallPass')}</>
            }
          </div>
        )}

        {/* 항목 목록 */}
        {loading ? (
          <div className="py-6 text-center text-text-muted text-sm">{t('common.loading')}</div>
        ) : (
          <div className="max-h-[40vh] overflow-y-auto space-y-2">
            {items.map(item => {
              const r = results[item.seq];
              const isActive = activeSeq === item.seq;
              return (
                <div key={item.seq}
                  className={`p-3 border rounded-lg transition-colors ${
                    r === 'OK' ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                    : r === 'NG' ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                    : isActive ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-900/10'
                    : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {item.seq}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text">{item.itemName}</p>
                      {item.criteria && (
                        <p className="text-xs text-text-muted">{item.criteria}</p>
                      )}
                    </div>
                    {(isActive || !item.workerQrCode) ? (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleResult(item.seq, 'OK')}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            r === 'OK'
                              ? 'bg-green-500 text-white border-green-500'
                              : 'border-border text-text-muted hover:bg-green-50 hover:border-green-400 hover:text-green-700'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" /> OK
                        </button>
                        <button onClick={() => handleResult(item.seq, 'NG')}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            r === 'NG'
                              ? 'bg-red-500 text-white border-red-500'
                              : 'border-border text-text-muted hover:bg-red-50 hover:border-red-400 hover:text-red-700'
                          }`}
                        >
                          <XCircle className="w-4 h-4" /> NG
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">QR 스캔 필요</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={!allAnswered || saving}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            {saving ? t('common.saving') : t('kiosk.prep.confirmInspect')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm --filter frontend build
```

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/production/input-kiosk/components/WorkerInspectModal.tsx
git commit -m "feat: WorkerInspectModal - API integration, QR scanner, OK/NG per item, verdict banner"
```

---

## Task 9: SelfInspectItemRow 신규 컴포넌트 작성

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/SelfInspectItemRow.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
"use client";

/**
 * @file components/SelfInspectItemRow.tsx
 * @description 자주검사 항목 한 행 컴포넌트
 *
 * 초보자 가이드:
 * - MEASURE: 숫자 입력 → LSL/USL 자동 판정
 * - VISUAL: PASS/FAIL 버튼
 * - DELEGATE: 의뢰검사 버튼 (PENDING 처리)
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Send, ChevronRight } from 'lucide-react';

export interface SelfInspectItem {
  id: string;
  itemName: string;
  standard: string | null;
  inspectMethod: 'DIRECT' | 'DELEGATE';
  timing: string;
  isDestructive: boolean;
  itemType: 'MEASURE' | 'VISUAL';
  unit?: string | null;
  lslValue?: number | null;
  uslValue?: number | null;
  sampleCount: number;
}

export interface SampleItemResult {
  value?: string;
  result: 'PASS' | 'FAIL' | 'PENDING' | null;
  remark?: string;
}

interface Props {
  item: SelfInspectItem;
  result: SampleItemResult | undefined;
  onChange: (itemId: string, next: SampleItemResult) => void;
}

function autoJudge(
  value: string,
  lsl: number | null | undefined,
  usl: number | null | undefined,
): 'PASS' | 'FAIL' | null {
  if (!value.trim()) return null;
  const num = Number(value);
  if (isNaN(num)) return null;
  if (lsl != null && num < lsl) return 'FAIL';
  if (usl != null && num > usl) return 'FAIL';
  return 'PASS';
}

export default function SelfInspectItemRow({ item, result, onChange }: Props) {
  const { t } = useTranslation();
  const r = result?.result ?? null;

  const handleMeasureChange = useCallback((value: string) => {
    onChange(item.id, {
      value,
      result: autoJudge(value, item.lslValue, item.uslValue),
      remark: result?.remark,
    });
  }, [item, result, onChange]);

  const handleSetResult = useCallback((next: 'PASS' | 'FAIL' | 'PENDING') => {
    onChange(item.id, { ...result, result: next, value: result?.value });
  }, [item.id, result, onChange]);

  const handleRemark = useCallback((remark: string) => {
    onChange(item.id, { ...result, result: r, remark });
  }, [item.id, result, r, onChange]);

  const rowBg = r === 'PASS'
    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
    : r === 'FAIL'
    ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
    : r === 'PENDING'
    ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
    : 'bg-surface border-border';

  return (
    <div className={`p-3 border rounded-lg transition-colors ${rowBg}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text">{item.itemName}</span>
            {item.isDestructive && (
              <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                {t('kiosk.selfInspect.destructive')}
              </span>
            )}
            {item.inspectMethod === 'DELEGATE' && (
              <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">
                {t('kiosk.selfInspect.delegate')}
              </span>
            )}
          </div>
          {item.standard && (
            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
              <ChevronRight className="w-3 h-3 shrink-0" />{item.standard}
            </p>
          )}
          {item.itemType === 'MEASURE' && (item.lslValue != null || item.uslValue != null) && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              {item.lslValue != null && `${t('kiosk.prep.lsl')}: ${item.lslValue}`}
              {item.lslValue != null && item.uslValue != null && ' ~ '}
              {item.uslValue != null && `${t('kiosk.prep.usl')}: ${item.uslValue}`}
              {item.unit && ` (${item.unit})`}
            </p>
          )}
        </div>

        {/* 결과 입력 */}
        {item.inspectMethod === 'DELEGATE' ? (
          <button
            onClick={() => handleSetResult('PENDING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0 ${
              r === 'PENDING'
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-surface border-border text-text-muted hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            {t('kiosk.selfInspect.requestDelegate')}
          </button>
        ) : item.itemType === 'MEASURE' ? (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              value={result?.value ?? ''}
              onChange={e => handleMeasureChange(e.target.value)}
              placeholder={item.unit ?? t('kiosk.prep.measureValue')}
              className="w-24 px-2 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {r === 'PASS' && <span className="text-xs font-bold text-green-600">PASS</span>}
            {r === 'FAIL' && <span className="text-xs font-bold text-red-600">FAIL</span>}
          </div>
        ) : (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleSetResult('PASS')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                r === 'PASS'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-surface border-border text-text-muted hover:bg-green-50 hover:border-green-400 hover:text-green-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> PASS
            </button>
            <button
              onClick={() => handleSetResult('FAIL')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                r === 'FAIL'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-surface border-border text-text-muted hover:bg-red-50 hover:border-red-400 hover:text-red-700'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" /> FAIL
            </button>
          </div>
        )}
      </div>

      {/* 항목별 비고 */}
      <div className="mt-2 pl-0">
        <input
          type="text"
          value={result?.remark ?? ''}
          onChange={e => handleRemark(e.target.value)}
          placeholder={t('kiosk.prep.remark')}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm --filter frontend build
```

- [ ] **Step 3: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/SelfInspectItemRow.tsx"
git commit -m "feat: add SelfInspectItemRow subcomponent for MEASURE/VISUAL self-inspect items"
```

---

## Task 10: SelfInspectModal 전면 재작성 (시료 탭 + NG 재검사)

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/SelfInspectModal.tsx`

- [ ] **Step 1: 파일 전체 교체**

```tsx
"use client";

/**
 * @file components/SelfInspectModal.tsx
 * @description 자주검사 모달 (시료 탭 + MEASURE/VISUAL + NG 재검사)
 *
 * 초보자 가이드:
 * - FIRST: sampleCount개 탭 (각 탭 = 시료 1개)
 * - MID/LAST: 탭 1개 (시료 1개)
 * - 측정형(MEASURE): 숫자 입력 → LSL/USL 자동 판정
 * - 판정형(VISUAL): PASS/FAIL 버튼
 * - 종합 FAIL 시 NG 재검사 버튼 표시 → 새 sampleNo로 재저장
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FlaskConical, CheckCircle2, XCircle, Clock, AlertTriangle, RotateCcw } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore, type InspectTiming } from '@/stores/kioskStore';
import SelfInspectItemRow, {
  type SelfInspectItem,
  type SampleItemResult,
} from './SelfInspectItemRow';

type ResultMap = Record<number, Record<string, SampleItemResult>>;

interface SelfInspectModalProps {
  isOpen: boolean;
  timing: InspectTiming;
  onClose: () => void;
  onDone: () => void;
}

export default function SelfInspectModal({ isOpen, timing, onClose, onDone }: SelfInspectModalProps) {
  const { t } = useTranslation();
  const {
    selectedEquip, selectedJobOrder, selectedWorkers,
    savedResultCount, setHasPendingDelegate, setMidInspectDone,
  } = useKioskStore();

  const [items, setItems] = useState<SelfInspectItem[]>([]);
  const [results, setResults] = useState<ResultMap>({});
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  // 재검사 모드: 해당 탭 인덱스에서 FAIL인 항목 ID 목록 + 사용할 sampleNo 오프셋
  const [reInspectMode, setReInspectMode] = useState(false);
  const [reInspectRound, setReInspectRound] = useState(1);
  const [baseSampleCount, setBaseSampleCount] = useState(1);

  const sampleCount = timing === 'FIRST' ? Math.max(1, items[0]?.sampleCount ?? 1) : 1;

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setResults({});
    setActiveTab(0);
    setReInspectMode(false);
    setReInspectRound(1);
    api.get('/production/self-inspect/items', {
      params: {
        processCode: selectedEquip?.processCode ?? selectedJobOrder?.processCode ?? '',
        timing,
      },
    })
      .then(res => {
        const data: SelfInspectItem[] = (res.data?.data ?? []).map((i: SelfInspectItem) => ({
          ...i,
          itemType: i.itemType || 'VISUAL',
          sampleCount: i.sampleCount || 1,
        }));
        setItems(data);
        const count = timing === 'FIRST' ? Math.max(1, data[0]?.sampleCount ?? 1) : 1;
        setBaseSampleCount(count);
        // 탭별 결과 초기화
        const init: ResultMap = {};
        for (let s = 0; s < count; s++) {
          init[s] = {};
        }
        setResults(init);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isOpen, timing, selectedEquip, selectedJobOrder]);

  const handleResultChange = useCallback((sampleIdx: number, itemId: string, next: SampleItemResult) => {
    setResults(prev => ({
      ...prev,
      [sampleIdx]: { ...prev[sampleIdx], [itemId]: next },
    }));
  }, []);

  const isTabComplete = useCallback((sampleIdx: number, targetItems: SelfInspectItem[]) => {
    return targetItems.every(item => {
      const r = results[sampleIdx]?.[item.id]?.result;
      return r !== null && r !== undefined;
    });
  }, [results]);

  const displayItems = reInspectMode
    ? items.filter(item => {
        // 재검사: 어느 탭에서든 FAIL인 항목만 표시
        for (let s = 0; s < baseSampleCount; s++) {
          if (results[s]?.[item.id]?.result === 'FAIL') return true;
        }
        return false;
      })
    : items;

  const allTabsComplete = !reInspectMode
    ? Array.from({ length: sampleCount }, (_, i) => i).every(i => isTabComplete(i, items))
    : isTabComplete(activeTab, displayItems);

  const hasDelegates = items.some(i => i.inspectMethod === 'DELEGATE');

  const timingLabel: Record<InspectTiming, string> = {
    FIRST: t('kiosk.selfInspect.first'),
    MID: t('kiosk.selfInspect.mid'),
    LAST: t('kiosk.selfInspect.last'),
  };

  const handleSubmit = useCallback(async () => {
    if (!allTabsComplete) {
      toast.error(t('kiosk.selfInspect.allSamplesRequired'));
      return;
    }
    setSaving(true);
    try {
      const targetItems = reInspectMode ? displayItems : items;
      const tabCount = reInspectMode ? 1 : sampleCount;
      const sampleNoOffset = reInspectMode ? baseSampleCount * reInspectRound : 0;

      const promises: Promise<unknown>[] = [];
      for (let s = 0; s < tabCount; s++) {
        const sampleNo = s + 1 + sampleNoOffset;
        for (const item of targetItems) {
          const r = results[s]?.[item.id];
          const status = item.inspectMethod === 'DELEGATE' ? 'PENDING' : (r?.result ?? 'PASS');
          promises.push(api.post('/production/self-inspect/results', {
            orderNo: selectedJobOrder?.orderNo,
            equipCode: selectedEquip?.equipCode,
            processCode: selectedEquip?.processCode ?? selectedJobOrder?.processCode,
            inspectItemId: item.id,
            itemName: item.itemName,
            timing,
            inspectMethod: item.inspectMethod,
            status,
            prodQtyAtInspect: savedResultCount,
            inspectorId: selectedWorkers[0]?.id,
            remark: r?.remark,
            sampleNo,
            measureValue: item.itemType === 'MEASURE' && r?.value ? Number(r.value) : undefined,
          }));
        }
      }
      await Promise.all(promises);

      if (hasDelegates && selectedJobOrder) {
        const res = await api.get(`/production/self-inspect/pending/${selectedJobOrder.orderNo}`);
        setHasPendingDelegate(res.data?.data?.hasPending ?? false);
      }

      // 중물 완료 처리
      if (timing === 'MID') setMidInspectDone(true);

      // 종합 판정
      const failItems = displayItems.filter(item => {
        for (let s = 0; s < tabCount; s++) {
          if (results[s]?.[item.id]?.result === 'FAIL') return true;
        }
        return false;
      });

      if (failItems.length > 0) {
        toast.error(t('kiosk.selfInspect.savedWithFail', { count: failItems.length }), { duration: 5000 });
        // NG 재검사 모드로 전환
        if (!reInspectMode) {
          setReInspectMode(true);
          setReInspectRound(prev => prev + 1);
          setActiveTab(0);
          // 재검사용 결과 탭 초기화 (탭 0만 사용)
          setResults(prev => ({ ...prev, 0: {} }));
        } else {
          setReInspectRound(prev => prev + 1);
          setResults(prev => ({ ...prev, 0: {} }));
        }
      } else {
        const delegateCount = items.filter(i => i.inspectMethod === 'DELEGATE').length;
        if (delegateCount > 0) {
          toast(t('kiosk.selfInspect.delegatePending', { count: delegateCount }), { icon: '📋', duration: 4000 });
        } else {
          toast.success(t('kiosk.selfInspect.allPass'));
        }
        onDone();
      }
    } catch {
      toast.error(t('kiosk.selfInspect.saveError'));
    } finally {
      setSaving(false);
    }
  }, [allTabsComplete, reInspectMode, displayItems, items, sampleCount, baseSampleCount,
      reInspectRound, results, timing, selectedJobOrder, selectedEquip, selectedWorkers,
      savedResultCount, hasDelegates, setHasPendingDelegate, setMidInspectDone, onDone, t]);

  const title = reInspectMode
    ? t('kiosk.selfInspect.reInspectTitle', { n: reInspectRound })
    : `${timingLabel[timing]} ${t('kiosk.selfInspect.title')}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          <FlaskConical className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-blue-700 dark:text-blue-300">{timingLabel[timing]}</span>
            {selectedJobOrder && (
              <span className="ml-2 text-blue-500 font-mono text-xs">{selectedJobOrder.orderNo}</span>
            )}
          </div>
          <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">
            {t('kiosk.selfInspect.resultCount', { count: savedResultCount })}
          </span>
        </div>

        {/* 시료 탭 (FIRST + sampleCount>1인 경우만) */}
        {!reInspectMode && sampleCount > 1 && (
          <div className="flex gap-1 border-b border-border">
            {Array.from({ length: sampleCount }, (_, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === i
                    ? 'bg-primary text-white'
                    : isTabComplete(i, items)
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'text-text-muted hover:bg-surface'
                }`}
              >
                {t('kiosk.selfInspect.sampleTab', { n: i + 1 })}
                {isTabComplete(i, items) && <span className="ml-1 text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* 항목 목록 */}
        {loading ? (
          <div className="py-8 text-center text-text-muted text-sm">{t('common.loading')}</div>
        ) : displayItems.length === 0 && !reInspectMode ? (
          <div className="py-8 flex flex-col items-center gap-3 text-text-muted">
            <AlertTriangle className="w-10 h-10 opacity-40" />
            <p className="text-sm">{t('kiosk.selfInspect.noItems')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {displayItems.map(item => (
              <SelfInspectItemRow
                key={item.id}
                item={item}
                result={results[activeTab]?.[item.id]}
                onChange={(itemId, next) => handleResultChange(activeTab, itemId, next)}
              />
            ))}
          </div>
        )}

        {/* 의뢰검사 안내 */}
        {hasDelegates && !reInspectMode && (
          <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
            <Clock className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700 dark:text-orange-300">
              {t('kiosk.selfInspect.delegateWarning')}
            </p>
          </div>
        )}

        {/* 재검사 모드 안내 */}
        {reInspectMode && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700 rounded-lg text-sm">
            <RotateCcw className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-red-700 dark:text-red-300">
              {t('kiosk.selfInspect.reInspectTitle', { n: reInspectRound })} — {t('kiosk.selfInspect.allSamplesRequired')}
            </p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          {displayItems.length === 0 && !reInspectMode ? (
            <Button onClick={onDone}>{t('common.close')}</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!allTabsComplete || saving}>
              {reInspectMode
                ? <><RotateCcw className="w-4 h-4 mr-1" />{t('kiosk.selfInspect.reInspect')}</>
                : <><CheckCircle2 className="w-4 h-4 mr-1" />{saving ? t('common.saving') : t('kiosk.selfInspect.save')}</>
              }
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm --filter frontend build
```

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/production/input-kiosk/components/SelfInspectModal.tsx
git commit -m "feat: SelfInspectModal - sample tabs, MEASURE/VISUAL, NG re-inspect flow"
```

---

## Task 11: page.tsx — 중물 알림/차단 로직 추가

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx`

- [ ] **Step 1: import에 useComCodeMap 추가**

파일 상단 import 섹션에 추가:
```typescript
import { useComCodeMap } from '@/hooks/useComCode';
```

- [ ] **Step 2: InputKioskPage 함수 안에 ComCode 읽기 + 중물 진행률 계산 추가**

`useKioskStore` 구조분해에 `midInspectDone, setMidInspectDone` 추가:

```typescript
  const {
    selectedEquip, selectedJobOrder, interlock, savedResultCount, hasPendingDelegate,
    pendingDefects, midInspectDone,
    addWorker, setSelectedJobOrder, setInterlock, incrementResultCount, setHasPendingDelegate,
  } = useKioskStore();
```

`const [selfInspectTiming, ...]` 바로 아래에 추가:

```typescript
  // 중물 알림/차단 임계값 (QC_SELF 공통코드; 없으면 40%/60% fallback)
  const qcSelfMap = useComCodeMap('QC_SELF');
  const midNotifyPct = Number(qcSelfMap['QC_MID_NOTIFY_PCT']?.codeDesc ?? 40);
  const midBlockPct  = Number(qcSelfMap['QC_MID_BLOCK_PCT']?.codeDesc  ?? 60);
  const progressPct  = selectedJobOrder?.orderQty
    ? (savedResultCount / selectedJobOrder.orderQty) * 100
    : 0;
  const isMidNotify = progressPct >= midNotifyPct && !midInspectDone;
  const isMidBlock  = progressPct >= midBlockPct  && !midInspectDone;
```

- [ ] **Step 3: 자주검사 버튼에 animate-pulse 추가**

자주검사 버튼 className에 `isMidNotify && !isMidBlock` 조건 pulse 추가:

```tsx
                className={`h-full w-full rounded border border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 transition-colors group flex flex-col items-center justify-center gap-2 ${
                  isMidNotify ? 'animate-pulse ring-2 ring-blue-400' : ''
                }`}
```

- [ ] **Step 4: ProductionInputBar에 midBlock 전달**

```tsx
              <ProductionInputBar
                onSaved={handleSaved}
                interlockDone={allInterlockDone && !hasPendingDelegate && !isMidBlock}
              />
```

- [ ] **Step 5: 중물 차단 배너 추가** (의뢰검사 배너 아래에 추가)

```tsx
      {isMidBlock && (
        <div className="bg-blue-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2">
          <span className="animate-pulse">●</span>
          {t('kiosk.selfInspect.midBlock')}
        </div>
      )}
```

- [ ] **Step 6: SelfInspectModal onDone에서 MID 완료 처리 — kioskStore 연동 확인**

SelfInspectModal에서 `setMidInspectDone(true)` 호출은 이미 Task 10에서 구현됨.
page.tsx에서는 `midInspectDone` 상태를 직접 읽어 사용하므로 별도 처리 불필요.

- [ ] **Step 7: 빌드 확인**

```bash
pnpm --filter frontend build
```

- [ ] **Step 8: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/production/input-kiosk/page.tsx
git commit -m "feat: mid-inspection notify/block logic with ComCode-based thresholds"
```

---

## Task 12: 전체 빌드 최종 확인 및 커밋

- [ ] **Step 1: 모노레포 전체 빌드**

```bash
pnpm build
```

Expected: `Tasks: N successful` (모든 패키지 에러 없음)

- [ ] **Step 2: TypeScript 에러 없음 확인**

```bash
pnpm --filter frontend exec tsc --noEmit
pnpm --filter backend exec tsc --noEmit
```

- [ ] **Step 3: 필요 시 개별 수정 후 재빌드**

빌드 실패 시 에러 메시지 기준으로 수정 → 재빌드 반복.

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete input-kiosk inspect detail features

- DailyInspectModal: MEASURE/VISUAL branching, per-item remark, verdict banner
- WorkerInspectModal: API integration, QR scanner, OK/NG, verdict banner
- SelfInspectModal: sample tabs, MEASURE/VISUAL, NG re-inspect
- page.tsx: mid-inspection notify/block with ComCode thresholds
- i18n: 4 languages updated"
```

---

## 구현 완료 체크리스트

- [ ] DB: 3개 테이블에 신규 컬럼 추가 확인
- [ ] 백엔드: `pnpm --filter backend build` 에러 0건
- [ ] 프론트: `pnpm --filter frontend build` 에러 0건
- [ ] DailyInspectModal: MEASURE 항목 숫자 입력 → 자동 판정 동작
- [ ] WorkerInspectModal: API 항목 로드, QR 스캔 매칭 동작
- [ ] SelfInspectModal FIRST: sampleCount개 탭 표시 → 탭별 저장
- [ ] SelfInspectModal: FAIL 항목 있을 때 NG 재검사 버튼 표시
- [ ] page.tsx: 진행률 40% 이상 시 자주검사 버튼 pulse
- [ ] page.tsx: 진행률 60% 이상 + 중물 미완료 시 실적입력 비활성화
- [ ] i18n: ko/en/zh/vi 4개 파일 신규 키 누락 없음
