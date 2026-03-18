# HANES MES 아키텍처 분석 보고서

**분석일**: 2026-03-18  
**대상 프로젝트**: HANES MES (NestJS + TypeORM + Oracle)  
**분석 범위**: `apps/backend/src` 및 `packages/shared`

---

## 요약

본 분석에서 **7가지 주요 아키텍처 문제점**을 식별했습니다:

| # | 문제 유형 | 심각도 | 주요 파일/모듈 |
|---|----------|--------|--------------|
| 1 | **과도한 책임의 거대 모듈** | 🔴 높음 | `QualityModule`, `MaterialModule` |
| 2 | **얕은 추상화 계층** | 🔴 높음 | `GenericCrudService`, `ResponseUtil` |
| 3 | **단위 테스트 부재** | 🔴 높음 | 전체 프로젝트 (`.spec.ts` 파일 없음) |
| 4 | **중복 채번 로직** | 🟡 중간 | `UidGeneratorService` vs `SeqGeneratorService` vs `NumRuleService` |
| 5 | **과도한 모듈 간 의존성** | 🟡 중간 | `InventoryModule`이 6개 모듈에 import됨 |
| 6 | **일관성 없는 DTO 정의** | 🟡 중간 | `BaseListQueryDto` 확장 불일치 |
| 7 | **트랜잭션 로직 중복** | 🟡 중간 | `QueryRunner` 패턴 반복 |

---

## 1. 과도한 책임의 거대 모듈 (QualityModule, MaterialModule)

### 문제 증거

```typescript
// apps/backend/src/modules/quality/quality.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DefectLog, RepairLog, InspectResult, ProdResult, OqcRequest, 
      OqcRequestBox, BoxMaster, PartMaster, TraceLog, ReworkOrder,
      ReworkInspect, ReworkProcess, ReworkResult, ProcessMap, ChangeOrder,
      CustomerComplaint, CAPARequest, CAPAAction, FaiRequest, FaiItem,
      SpcChart, SpcData, ProcessMaster, GaugeMaster, CalibrationLog,
      ControlPlan, ControlPlanItem, PpapSubmission, AuditPlan, AuditFinding,
      FgLabel, JobOrder, EquipProtocol,  // ← 30개 이상의 엔티티
    ]),
  ],
  controllers: [12개 컨트롤러],
  providers: [13개 서비스],
  exports: [13개 서비스],
})
export class QualityModule {}
```

### 왜 문제인가?

- **단일 책임 원칙 위반**: QualityModule이 검사, 불량, OQC, 재작업, 4M 변경, CAPA, SPC, MSA, PPAP, 심사 등 10개 이상의 하위 도메인을 포함
- **변경 영향 범위 확대**: 품질 관련 기능 하나를 수정필요할 때 30개 엔티티가 있는 모듈 전체를 재컴파일/재배포해야 함
- **테스트 어려움**: 단위 테스트 시 불필요한 30개의 엔티티를 모두 로드해야 함
- **코드 탐색성 저하**: 파일만 200+ 라인의 모듈 정의만으로도 전체 구조 파악 어려움

### 개선 방향

```typescript
// 제안: 기능별 서브모듈 분리
// modules/quality/quality-core.module.ts     - 공통 엔티티
// modules/quality/defects/defects.module.ts  - 불량/수리
// modules/quality/oqc/oqc.module.ts          - 출하검사
// modules/quality/spc/spc.module.ts          - SPC/통계
// modules/quality/audits/audits.module.ts    - 심사/4M/CAPA
// modules/quality/rework/rework.module.ts    - 재작업
```

---

## 2. 얕은 추상화 계층 (Shallow Abstraction)

### 문제 증거

```typescript
// apps/backend/src/common/services/generic-crud.service.ts
@Injectable()
export abstract class GenericCrudService<T extends { id: string }> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly options: GenericCrudOptions<T> = {},
  ) {}

  async findAll(query: BaseListQueryDto): Promise<PaginatedResult<T>> {
    // ... 40+ 라인의 복잡한 쿼리 빌딩
  }
  
  async create(dto: Partial<T>, userId?: string): Promise<T> {
    // 중복 체크 로직 (모든 서비스가 필요한 것은 아님)
  }
}
```

**사용처 문제**:
```typescript
// apps/backend/src/modules/production/services/job-order.service.ts
export class JobOrderService {
  // GenericCrudService를 상속하지 않고 직접 구현
  // → 중복 코드 80% 발생
  
  async findAll(query: JobOrderQueryDto, company?: string, plant?: string) {
    // QueryBuilder 중복 (Generic과 유사하지만 복사-붙여넣기)
    const qb = this.jobOrderRepository.createQueryBuilder('jo')
      .leftJoinAndSelect('jo.part', 'part')
      .leftJoinAndSelect('jo.routing', 'routing')
    // ... 30+ 라인의 유사 로직
  }
}
```

### 왜 문제인가?

- **인터페이스가 구현만큼 복잡함**: GenericCrudService의 `findAll` 파라미터가 특정 DTO(`BaseListQueryDto`)에 의존하여 범용성이 떨어짐
- **실제 사용률 저하**: JobOrderService, ProdResultService 등 대부분의 서비스가 GenericCrudService를 상속하지 않고 직접 구현
- **중복 코드 확산**: 페이지네이션, 검색, 정렬 로직이 각 서비스마다 거의 동일하게 반복됨

### 개선 방향

```typescript
// 제안: Repository 패턴으로 추상화
@Injectable()
export abstract class BaseRepository<T> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly config: RepositoryConfig<T>
  ) {}

  // 조건을 외부에서 주입받는 범용 메서드
  async findPaginated(
    options: FindOptions<T>,
    filters?: FilterBuilder<T>
  ): Promise<PaginatedResult<T>>;
}

// 사용처
@Injectable()
export class JobOrderRepository extends BaseRepository<JobOrder> {
  async findByStatus(status: string) {
    return this.findPaginated(
      { relations: ['part', 'routing'] },
      (qb) => qb.where('status = :status', { status })
    );
  }
}
```

---

## 3. 단위 테스트 완전 부재

### 문제 증거

```bash
# 프로젝트 전체에서 .spec.ts 파일 검색 결과
$ find apps/backend -name "*.spec.ts" | wc -l
0

# 테스트용 spec 파일은 하나만 존재 (기본 생성된 app.controller.spec.ts)
$ ls apps/backend/src/*.spec.ts
apps/backend/src/app.controller.spec.ts
```

**app.controller.spec.ts 내용**:
```typescript
describe('AppController', () => {
  it('should return "Hello World!"', () => {
    // 실제로는 의미 없는 테스트
  });
});
```

### 왜 문제인가?

- **리팩토링 불가**: 746라인의 `InventoryService`를 리팩토링할 때 수동 검증만 의존해야 함
- **버그 회귀**: 수불 처리 로직 변경 시 기존 기능이 깨지는지 알 수 없음
- **신규 개발자 온보딩**: 테스트 없이는 코드 의도를 이해하기 어려움

### 개선 방향

```typescript
// 제안: 테스트 우선 작성 예시
// inventory.service.spec.ts
describe('InventoryService', () => {
  describe('receiveStock', () => {
    it('should create transaction and update stock', async () => {
      // Given
      const dto = createReceiveDto({ qty: 100 });
      
      // When
      const result = await service.receiveStock(dto);
      
      // Then
      expect(result.transNo).toBeDefined();
      expect(stockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ qty: 100 })
      );
    });
    
    it('should rollback on stock update failure', async () => {
      // 롤백 테스트
    });
  });
});
```

---

## 4. 중복 채번 로직

### 문제 증거

```typescript
// apps/backend/src/shared/uid-generator.service.ts
@Injectable()
export class UidGeneratorService {
  async nextMatUid(qr?: QueryRunner): Promise<string> {
    return result[0].uid;  // Oracle Function 호출
  }
  async nextPrdUid(qr?: QueryRunner): Promise<string> { ... }
}

// apps/backend/src/shared/seq-generator.service.ts  
@Injectable()
export class SeqGeneratorService {
  async getNo(docType: string, qr?: QueryRunner): Promise<string> {
    // Oracle Package 호출
  }
  // 하위호환 편의 메서드 - UidGenerator와 중복!
  async nextMatUid(qr?: QueryRunner) { return this.getNo('MAT_UID', qr); }
  async nextPrdUid(qr?: QueryRunner) { return this.getNo('PRD_UID', qr); }
}

// apps/backend/src/modules/num-rule/num-rule.service.ts
@Injectable()
export class NumRuleService {
  async nextNumber(ruleType: string, userId?: string): Promise<string> {
    // 별도의 NUM_RULE_MASTERS 테이블 사용
  }
}
```

### 왜 문제인가?

| 서비스 | 방식 | 사용처 | 중복 관계 |
|-------|------|--------|----------|
| UidGeneratorService | Oracle Function | 레거시 코드 | SeqGeneratorService와 인터페이스 중복 |
| SeqGeneratorService | Oracle Package | 신규 코드 | UidGeneratorService의 상위 집합 |
| NumRuleService | TypeORM + Table | 채번 규칙 동적 관리 | 완전히 다른 구현 |

- **일관성 없는 API**: 개발자가 어느 서비스를 사용해야 할지 혼란
- **유지보수 복잡성**: 채번 규칙 변경 시 3곳을 확인해야 함

### 개선 방향

```typescript
// 제안: 단일 채번 서비스로 통합
@Injectable()
export class NumberingService {
  constructor(
    private readonly seqGenerator: SeqGeneratorService,
    private readonly numRuleService: NumRuleService,
    private readonly config: NumberingConfig,
  ) {}

  async generate(type: string, options?: GenerateOptions): Promise<string> {
    // 설정에 따라 Oracle Package 또는 Table 기반 채번 선택
    if (this.config.useNumRule(type)) {
      return this.numRuleService.nextNumber(type);
    }
    return this.seqGenerator.getNo(type);
  }
}
```

---

## 5. 과도한 모듈 간 의존성 (InventoryModule)

### 문제 증거

```typescript
// InventoryModule이 6개 모듈에서 직접 import됨
// production/production.module.ts
import { InventoryModule } from '../inventory/inventory.module';

// material/material.module.ts  
import { InventoryModule } from '../inventory/inventory.module';

// shipping/shipping.module.ts
import { InventoryModule } from '../inventory/inventory.module';

// consumables/consumables.module.ts
import { InventoryModule } from '../inventory/inventory.module';

// customs/customs.module.ts
import { InventoryModule } from '../inventory/inventory.module';

// outsourcing/outsourcing.module.ts
import { InventoryModule } from '../inventory/inventory.module';
```

**InventoryModule의 exports**:
```typescript
@Module({
  exports: [
    InventoryService, WarehouseService, ProductInventoryService, 
    ProductPhysicalInvService, WarehouseLocationService, ProductHoldService
  ],
})
export class InventoryModule {}
```

### 왜 문제인가?

- **순환 의존성 위험**: InventoryModule이 향후 ProductionModule을 필요로 하게 되면 순환 참조 발생
- **높은 결합도**: InventoryModule 내부 변경이 6개 모듈에 영향
- **테스트 어려움**: 각 모듈 테스트 시 InventoryModule 전체를 Mock해야 함

### 개선 방향

```typescript
// 제안: 인터페이스 기반 의존성 역전
// interfaces/inventory.interface.ts
export interface IStockManager {
  receive(dto: ReceiveDto): Promise<Transaction>;
  issue(dto: IssueDto): Promise<Transaction>;
}

// InventoryModule
@Module({
  providers: [
    { provide: 'IStockManager', useClass: InventoryService }
  ],
  exports: ['IStockManager'],
})

// 사용처
export class ProductionService {
  constructor(
    @Inject('IStockManager') private readonly stockManager: IStockManager
  ) {}
}
```

---

## 6. 일관성 없는 DTO 정의 패턴

### 문제 증거

```typescript
// apps/backend/src/common/dto/base-query.dto.ts
export class BaseListQueryDto extends PaginationQueryDto {
  search?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

// apps/backend/src/modules/production/dto/job-order.dto.ts
export class JobOrderQueryDto {
  // BaseListQueryDto를 상속하지 않고 독립 정의
  page?: number;
  limit?: number;
  search?: string;
  orderNo?: string;
  itemCode?: string;
  lineCode?: string;
  status?: string;
  planDateFrom?: string;  // ← 이름 불일치 (fromDate vs planDateFrom)
  planDateTo?: string;    // ← 이름 불일치 (toDate vs planDateTo)
  erpSyncYn?: string;
}
```

### 왜 문제인가?

- **공통 기능 중복**: 페이지네이션 로직이 각 DTO마다 복사됨
- **API 인터페이스 불일치**: 클라이언트가 일관된 쿼리 파라미터를 사용할 수 없음
- **타입 안전성 저하**: `BaseListQueryDto`의 유틸리티를 사용할 수 없음

### 개선 방향

```typescript
// 제안: DTO 상속 및 컴포지션 표준화
export class JobOrderQueryDto extends BaseListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemCode?: string;

  // 공통 필드는 Base에서 상속
  // search, status, fromDate, toDate, page, limit
}
```

---

## 7. 트랜잭션 로직 중복

### 문제 증거

```typescript
// apps/backend/src/modules/production/services/job-order.service.ts (150-210)
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();
try {
  // ... 비즈니스 로직
  await queryRunner.commitTransaction();
} catch (err) {
  await queryRunner.rollbackTransaction();
  throw err;
} finally {
  await queryRunner.release();
}

// apps/backend/src/modules/inventory/services/inventory.service.ts (155-211)
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();
try {
  // ... 비즈니스 로직
  await queryRunner.commitTransaction();
} catch (err) {
  await queryRunner.rollbackTransaction();
  throw err;
} finally {
  await queryRunner.release();
}

// 위 패턴이 15개 이상의 서비스에서 동일하게 반복
```

### 왜 문제인가?

- **보일러플레이트 코드**: 12라인의 try-catch-finally가 모든 트랜잭션 메서드에 반복
- **에러 처리 불일치**: 일부 메서드에서는 rollback 누락 가능성
- **가독성 저하**: 실제 비즈니스 로직이 트랜잭션 코드에 묻힘

### 개선 방향

```typescript
// 제안: 데코레이터 또는 유틸리티 패턴
@Injectable()
export class TransactionalService {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T>(
    callback: (manager: EntityManager) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const result = await callback(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

// 사용처
@Injectable()
export class JobOrderService {
  async create(dto: CreateJobOrderDto) {
    return this.txService.execute(async (manager) => {
      // 트랜잭션 내 비즈니스 로직만 작성
      const jobOrder = manager.create(JobOrder, { ...dto });
      return manager.save(jobOrder);
    });
  }
}
```

---

## 추가 발견 사항

### A. packages/shared의 역할 모호성

```typescript
// packages/shared/src/types/index.ts - 타입 정의만 존재
export * from './production';
export * from './material';
// ... 타입만 재내보내기
```

**문제**: 실제 비즈니스 로직에서 `@harness/shared` 사용률이 낮고, 대부분 로컬 DTO/엔티티 사용

### B. OracleService의 중복 연결 관리

```typescript
// apps/backend/src/common/services/oracle.service.ts
// DatabaseModule(TypeORM)와 별개의 oracledb 커넥션 풀 관리
async onModuleInit(): Promise<void> {
  this.pool = await oracledb.createPool({...});
}
```

**문제**: 동일 DB에 대해 TypeORM + oracledb 두 개의 연결 풀이 존재하여 리소스 낭비

---

## 우선순위별 개선 로드맵

### Phase 1 (즉시) - 테스트 인프라
1. Jest 설정 및 첫 테스트 작성
2. InventoryService.receiveStock 테스트 케이스 작성

### Phase 2 (단기) - 중복 제거
1. 채번 서비스 통합 (NumRuleService → SeqGeneratorService)
2. 트랜잭션 유틸리티 도입
3. DTO 상속 구조 표준화

### Phase 3 (중기) - 모듈 분리
1. QualityModule → 서브모듈 분리
2. InventoryModule 인터페이스 기반 리팩토링

### Phase 4 (장기) - 아키텍처 개선
1. GenericCrudService 실용화 또는 제거
2. CQRS 패턴 고려 (읽기/쓰기 분리)

---

## 결론

HANES MES 프로젝트는 기능적으로 완성도가 높지만, **아키텍처적 부채**가 상당히 누적되어 있습니다. 특히:

1. **단일 모듈의 과도한 책임**은 유지보수성을 크게 저하시킵니다
2. **테스트 부재**는 안전한 리팩토링을 방해합니다  
3. **중복 코드**는 버그 발생 가능성을 높입니다

우선 테스트 인프라를 구축한 후, 점진적으로 모듈 분리와 중복 제거를 진행할 것을 권장합니다.
