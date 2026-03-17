# 작업지시-라우팅 연결 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 작업지시(JobOrder) 생성 시 품목 기반 라우팅을 자동 조회하여 연결하고, 공정순서를 UI에 표시한다.

**Architecture:** JobOrder 엔티티에 `routingCode` 컬럼 추가. 생성/수정 시 `itemCode` → `RoutingGroup.findByItemCode()` 자동 조회. 프론트엔드에서 품목 선택 시 공정순서를 화살표 형태로 읽기 전용 표시.

**Tech Stack:** NestJS (TypeORM), Next.js (React), Oracle DB

---

## 파일 구조

### 수정 대상 파일
| 파일 | 역할 |
|------|------|
| `apps/backend/src/entities/job-order.entity.ts` | `routingCode` 컬럼 + ManyToOne 관계 추가 |
| `apps/backend/src/modules/production/dto/job-order.dto.ts` | 응답에 `routingCode` 포함 |
| `apps/backend/src/modules/production/services/job-order.service.ts` | create/update 시 라우팅 자동 조회 로직 |
| `apps/backend/src/modules/production/production.module.ts` | RoutingGroup, RoutingProcess 엔티티 등록 |
| `apps/frontend/src/app/(authenticated)/production/order/components/JobOrderFormPanel.tsx` | 라우팅 정보 + 공정순서 UI 표시 |
| `scripts/migration/add_routing_code_to_job_orders.sql` | DB 마이그레이션 스크립트 |

---

### Task 1: DB 마이그레이션 스크립트 작성

**Files:**
- Create: `scripts/migration/add_routing_code_to_job_orders.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- JOB_ORDERS 테이블에 ROUTING_CODE 컬럼 추가
ALTER TABLE JOB_ORDERS ADD ROUTING_CODE VARCHAR2(50);

-- 인덱스 추가
CREATE INDEX IDX_JOB_ORDERS_ROUTING ON JOB_ORDERS(ROUTING_CODE);

-- 기존 데이터 마이그레이션: itemCode 기반으로 라우팅 코드 매핑
UPDATE JOB_ORDERS jo
SET jo.ROUTING_CODE = (
  SELECT rg.ROUTING_CODE
  FROM ROUTING_GROUPS rg
  WHERE rg.ITEM_CODE = jo.ITEM_CODE
    AND rg.USE_YN = 'Y'
    AND ROWNUM = 1
)
WHERE jo.ROUTING_CODE IS NULL;

COMMIT;
```

- [ ] **Step 2: oracle-db 스킬로 마이그레이션 실행**

JSHANES 사이트에서 위 SQL 실행.

- [ ] **Step 3: 커밋**

```bash
git add scripts/migration/add_routing_code_to_job_orders.sql
git commit -m "chore: add ROUTING_CODE column migration for JOB_ORDERS"
```

---

### Task 2: JobOrder 엔티티에 routingCode 추가

**Files:**
- Modify: `apps/backend/src/entities/job-order.entity.ts`

- [ ] **Step 1: routingCode 컬럼 + ManyToOne 관계 추가**

`job-order.entity.ts`에 다음을 추가:

```typescript
import { RoutingGroup } from './routing-group.entity';

// 컬럼 추가 (lineCode 아래)
@Column({ name: 'ROUTING_CODE', length: 50, nullable: true })
routingCode: string | null;

@ManyToOne(() => RoutingGroup, { nullable: true })
@JoinColumn({ name: 'ROUTING_CODE' })
routing: RoutingGroup | null;
```

- [ ] **Step 2: JOB_ORDER_SELECT에 routingCode 추가**

`job-order.service.ts`의 `JOB_ORDER_SELECT` 상수에 `routingCode: true` 추가.

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/entities/job-order.entity.ts apps/backend/src/modules/production/services/job-order.service.ts
git commit -m "feat: add routingCode column to JobOrder entity"
```

---

### Task 3: production.module에 RoutingGroup, RoutingProcess 엔티티 등록

**Files:**
- Modify: `apps/backend/src/modules/production/production.module.ts`

- [ ] **Step 1: import 및 TypeOrmModule에 엔티티 추가**

```typescript
import { RoutingGroup } from '../../entities/routing-group.entity';
import { RoutingProcess } from '../../entities/routing-process.entity';

// TypeOrmModule.forFeature 배열에 추가:
RoutingGroup, RoutingProcess
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/production.module.ts
git commit -m "feat: register RoutingGroup/RoutingProcess entities in ProductionModule"
```

---

### Task 4: 서비스 로직 - 라우팅 자동 조회

**Files:**
- Modify: `apps/backend/src/modules/production/services/job-order.service.ts`

- [ ] **Step 1: RoutingGroup Repository 주입**

constructor에 추가:

```typescript
@InjectRepository(RoutingGroup)
private readonly routingGroupRepository: Repository<RoutingGroup>,
@InjectRepository(RoutingProcess)
private readonly routingProcessRepository: Repository<RoutingProcess>,
```

import 추가:

```typescript
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
```

- [ ] **Step 2: create() 메서드에 라우팅 자동 조회 추가**

`create()` 메서드에서 품목 검증 후, 라우팅 자동 조회:

```typescript
// 품목 검증 후 추가
const routingGroup = await this.routingGroupRepository.findOne({
  where: { itemCode: dto.itemCode, useYn: 'Y' },
});
```

jobOrder 생성 시 routingCode 세팅:

```typescript
routingCode: routingGroup?.routingCode || null,
```

- [ ] **Step 3: createChildOrders()에도 자식별 라우팅 자동 조회**

자식 작업지시 생성 시에도 각 자식 품목의 라우팅 자동 조회:

```typescript
// 자식 품목의 라우팅 조회
const childRouting = await this.routingGroupRepository.findOne({
  where: { itemCode: bom.childItemCode, useYn: 'Y' },
});

// childOrders.push() 시 routingCode 포함
routingCode: childRouting?.routingCode || null,
```

- [ ] **Step 4: update() 메서드에 itemCode 변경 시 라우팅 재조회**

```typescript
if (dto.itemCode !== undefined) {
  updateData.itemCode = dto.itemCode;
  const routingGroup = await this.routingGroupRepository.findOne({
    where: { itemCode: dto.itemCode, useYn: 'Y' },
  });
  updateData.routingCode = routingGroup?.routingCode || null;
}
```

- [ ] **Step 5: findAll()에 routing relation 추가**

`findAll()` 쿼리빌더에 라우팅 join 추가:

```typescript
.leftJoinAndSelect('jo.routing', 'routing')
```

- [ ] **Step 6: findById()에 routing relation 추가**

```typescript
relations: ['part', 'routing'],
```

- [ ] **Step 7: findByIdWithResults()에 라우팅 공정순서 포함**

상세 조회 시 RoutingProcess도 함께 반환:

```typescript
const routingProcesses = jobOrder.routingCode
  ? await this.routingProcessRepository.find({
      where: { routingCode: jobOrder.routingCode, useYn: 'Y' },
      order: { seq: 'ASC' },
    })
  : [];
return { ...jobOrder, prodResults, routingProcesses };
```

- [ ] **Step 8: 커밋**

```bash
git add apps/backend/src/modules/production/services/job-order.service.ts
git commit -m "feat: auto-lookup routing on JobOrder create/update"
```

---

### Task 5: 프론트엔드 - 라우팅 정보 + 공정순서 표시

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/order/components/JobOrderFormPanel.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/production/order/page.tsx`

- [ ] **Step 1: JobOrderFormPanel에 라우팅 자동 조회 로직 추가**

품목 선택 시 라우팅 API 호출:

```typescript
interface RoutingInfo {
  routingCode: string;
  routingName: string;
  processes: Array<{ seq: number; processCode: string; processName: string }>;
}

const [routingInfo, setRoutingInfo] = useState<RoutingInfo | null>(null);
const [routingLoading, setRoutingLoading] = useState(false);

// 품목 선택 시 라우팅 자동 조회
const fetchRouting = useCallback(async (itemCode: string) => {
  if (!itemCode) { setRoutingInfo(null); return; }
  setRoutingLoading(true);
  try {
    const res = await api.get(`/master/routing-groups/by-item/${itemCode}`);
    setRoutingInfo(res.data?.data || null);
  } catch {
    setRoutingInfo(null);
  } finally {
    setRoutingLoading(false);
  }
}, []);
```

PartSearchModal onSelect에서 fetchRouting 호출:

```typescript
onSelect={(part) => {
  setForm(p => ({ ...p, itemCode: part.itemCode }));
  fetchRouting(part.itemCode);
}}
```

수정 모드 진입 시에도 fetchRouting 호출 (useEffect):

```typescript
useEffect(() => {
  if (editingOrder?.itemCode) {
    fetchRouting(editingOrder.itemCode);
  }
}, [editingOrder, fetchRouting]);
```

- [ ] **Step 2: 공정순서 화살표 UI 추가**

라인/공정/설비 섹션을 라우팅 정보 섹션으로 교체:

```tsx
{/* 라우팅 정보 */}
<div>
  <h3 className="text-xs font-semibold text-text-muted mb-2">
    {t("production.order.sectionRouting")}
  </h3>
  {routingLoading ? (
    <p className="text-xs text-text-muted">{t("common.loading")}</p>
  ) : routingInfo ? (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-text">{routingInfo.routingCode}</span>
        <span className="text-text-muted">-</span>
        <span className="text-text-muted">{routingInfo.routingName}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1 p-2 bg-surface rounded-lg border border-border">
        {routingInfo.processes.map((proc, i) => (
          <span key={proc.seq} className="flex items-center gap-1">
            <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
              {proc.processName}
            </span>
            {i < routingInfo.processes.length - 1 && (
              <span className="text-text-muted">→</span>
            )}
          </span>
        ))}
      </div>
    </div>
  ) : form.itemCode ? (
    <p className="text-xs text-amber-500 dark:text-amber-400">
      {t("production.order.noRouting")}
    </p>
  ) : null}
</div>
```

- [ ] **Step 3: 기존 processCode/equipCode 관련 폼 필드 제거**

라우팅에서 공정/설비가 결정되므로, 개별 processCode/equipCode 선택 필드 제거:
- `ProcessSelect`, `EquipSelect` import 제거
- form 상태에서 `processCode`, `equipCode` 제거
- payload에서 `processCode`, `equipCode` 제거

`LineSelect`는 유지 (라인은 라우팅과 별개로 수동 지정 가능).

- [ ] **Step 4: page.tsx의 JobOrderItem 인터페이스에 routingCode 추가**

```typescript
interface JobOrderItem {
  // ... 기존 필드
  routingCode?: string | null;
  routing?: { routingCode: string; routingName: string } | null;
}
```

handleEdit에서 processCode/equipCode 참조 제거.

- [ ] **Step 5: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/production/order/components/JobOrderFormPanel.tsx
git add apps/frontend/src/app/(authenticated)/production/order/page.tsx
git commit -m "feat: display routing info with process flow in JobOrder form"
```

---

### Task 6: i18n 키 추가

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: 4개 언어 파일에 새 키 추가**

`production.order` 하위에 추가:

| 키 | ko | en | zh | vi |
|----|----|----|----|----|
| `sectionRouting` | 라우팅 정보 | Routing Info | 工艺路线信息 | Thông tin định tuyến |
| `noRouting` | 라우팅 미등록 품목입니다 | No routing registered for this item | 此品目未注册工艺路线 | Chưa đăng ký định tuyến cho mặt hàng này |

- [ ] **Step 2: Grep으로 4개 파일에 키 존재 확인**

```bash
grep -l "sectionRouting" apps/frontend/src/locales/*.json
grep -l "noRouting" apps/frontend/src/locales/*.json
```

4개 파일 모두 반환되어야 함.

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -m "feat: add i18n keys for routing info section"
```

---

### Task 7: 빌드 검증

- [ ] **Step 1: 백엔드 빌드**

```bash
cd apps/backend && pnpm build
```

에러 0건 확인.

- [ ] **Step 2: 프론트엔드 빌드**

```bash
cd apps/frontend && pnpm build
```

에러 0건 확인.

- [ ] **Step 3: 최종 커밋 (필요 시 수정사항)**

빌드 에러 발생 시 수정 후 커밋.
