# HANES MES 프로젝트 최적화 분석 보고서

> 작성일: 2026-02-16  
> 분석 범위: Frontend (Next.js), Backend (NestJS), Shared Packages

---

## 📊 개요

이 보고서는 HANES MES 프로젝트의 코드 품질 개선과 유지보수성 향상을 위해 다음 항목들을 분석한 결과입니다:

1. 컴포넌트 공용화 가능성
2. 중복 코드
3. 불필요한 코드
4. 타입/컬럼 정의 불일치

---

## 🔴 심각도: 높음 (즉시 조치 권장)

### 1. 타입 정의 불일치 (Frontend ↔ Backend)

#### 문제 설명
프론트엔드와 백엔드 간 상태 값 타입이 일치하지 않아 API 통합 시 버그 발생 가능성이 높습니다.

| 타입 | Frontend | Backend/Shared | 불일치 내용 |
|------|----------|----------------|-------------|
| `EquipmentStatus` | `'running' \| 'idle' \| 'maintenance' \| 'breakdown' \| 'offline'` | `'NORMAL' \| 'MAINT' \| 'STOP'` | 대소문자, 값 자체 불일치 |
| `JobOrderStatus` | `'planned' \| 'released' \| 'in_progress' \| 'completed' \| 'canceled'` | `'WAITING' \| 'RUNNING' \| 'PAUSED' \| 'DONE' \| 'CANCELED'` | 값 자체 불일치 |
| `DefectStatus` | `'detected' \| 'analyzing' \| 'repair_pending' \| 'repaired' \| 'scrapped'` | `'PENDING' \| 'REPAIRING' \| 'COMPLETED' \| 'SCRAPPED'` | 값 자체 불일치 |
| `MaterialStatus` | `'received' \| 'iqc_pending' \| 'iqc_pass' \| 'iqc_fail' \| 'in_use' \| 'depleted'` | `'PENDING' \| 'PASS' \| 'FAIL' \| 'HOLD'` | 값 자체 불일치 |
| `Equipment.commType` | `'mqtt' \| 'serial' \| 'manual'` | `'MQTT' \| 'SERIAL' \| 'TCP' \| 'OPC_UA' \| 'MODBUS'` | 대소문자, 값 개수 불일치 |

**영향 파일:**
- `apps/frontend/src/types/index.ts`
- `apps/frontend/src/types/equipment.ts`
- `packages/shared/src/constants/com-code-values.ts`

#### 해결 방안
```typescript
// shared 패키지의 상수를 기준으로 통일
// apps/frontend/src/types/index.ts 수정 예시

// ❌ 기존 코드
export type EquipmentStatus = "running" | "idle" | "maintenance" | "breakdown" | "offline";

// ✅ 수정 코드
import { EQUIP_STATUS_VALUES } from '@shared/constants';
export type EquipmentStatus = typeof EQUIP_STATUS_VALUES[number];
```

---

### 2. 페이지네이션 응답 구조 불일치

#### 문제 설명
프론트엔드와 백엔드의 페이지네이션 응답 구조가 달라 데이터 처리 로직이 복잡합니다.

**Frontend:**
```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

**Backend:**
```typescript
interface PagedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }
}
```

#### 해결 방안
프론트엔드 타입을 백엔드 구조에 맞게 수정:
```typescript
// apps/frontend/src/types/index.ts
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

---

### 3. API 응답 구조 불일치

#### 문제 설명
`ApiResponse` 타입이 프론트엔드와 백엔드에서 다르게 정의되어 있습니다.

| 필드 | Frontend | Backend |
|------|----------|---------|
| error | `string` | `errorCode?: string` |
| timestamp | 없음 | 있음 |

#### 해결 방안
프론트엔드 타입을 백엔드에 맞게 확장:
```typescript
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errorCode?: string;  // 추가
  timestamp?: string;  // 추가
}
```

---

## 🟡 심각도: 중간 (단계적 개선 권장)

### 4. 백엔드 DTO 중복 패턴

#### 문제 설명
모든 모듈의 DTO에서 페이지네이션, 날짜 범위, 작업자 정보 등의 필드가 반복 정의됩니다.

**반복되는 필드 패턴:**
```typescript
// 모든 QueryDto에서 반복
@ApiPropertyOptional({ default: 1 })
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
page: number = 1;

@ApiPropertyOptional({ default: 10 })
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
@Max(100)
limit: number = 10;

@ApiPropertyOptional()
@IsOptional()
@IsDateString()
fromDate?: string;

@ApiPropertyOptional()
@IsOptional()
@IsDateString()
toDate?: string;
```

#### 해결 방안 - Base DTO 추출
```typescript
// common/dto/pagination.dto.ts
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}

export class DateRangeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

// 사용 예시
export class ReceivingQueryDto extends PaginationQueryDto {
  @IsOptional()
  fromDate?: string;  // DateRangeQueryDto의 필드만 선택적으로 추가
  
  // ... 추가 필드
}
```

**예상 효과:**
- 각 DTO 파일 20~30% 코드 감소
- 페이지네이션 로직 일원화
- 유효성 검사 데코레이터 일관성 확보

---

### 5. 백엔드 서비스 CRUD 중복

#### 문제 설명
모든 서비스에서 거의 동일한 CRUD 패턴이 반복됩니다.

**반복 패턴:**
```typescript
// 모든 서비스에서 유사한 패턴
async findAll(query: QueryDto) {
  const { page = 1, limit = 10, search, status } = query;
  const skip = (page - 1) * limit;
  
  const where: any = { deletedAt: null };
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status) where.status = status;
  
  const [data, total] = await Promise.all([
    this.prisma.model.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    this.prisma.model.count({ where }),
  ]);
  
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async findById(id: string) {
  const item = await this.prisma.model.findFirst({ where: { id, deletedAt: null } });
  if (!item) throw new NotFoundException('Item not found');
  return item;
}
```

#### 해결 방안 - Generic CRUD Service
```typescript
// common/services/generic-crud.service.ts
export abstract class GenericCrudService<T, CreateDto, UpdateDto, QueryDto> {
  constructor(
    protected prisma: PrismaService,
    protected modelName: string,
  ) {}

  async findAll(query: QueryDto) {
    // 공통 페이지네이션 로직
  }

  async findById(id: string) {
    // 공통 단건 조회 + NotFound 처리
  }

  async create(dto: CreateDto) {
    // 공통 생성 + 중복 체크
  }

  async update(id: string, dto: UpdateDto) {
    // 공통 수정
  }

  async remove(id: string) {
    // 공통 소프트 삭제
  }
}

// 사용 예시
@Injectable()
export class PartService extends GenericCrudService<Part, CreatePartDto, UpdatePartDto, PartQueryDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'part');
  }
  
  // 특화 로직만 추가
}
```

**예상 효과:**
- 각 서비스 40~50% 코드 감소
- 일관된 에러 메시지 및 처리
- 테스트 코드 재사용성 향상

---

### 6. 프론트엔드 DataGrid 컬럼 정의 중복

#### 문제 설명
여러 페이지에서 유사한 컬럼 정의가 반복됩니다.

**반복되는 패턴:**
```typescript
// material/stock/page.tsx, material/lot/page.tsx 등에서 반복
{
  accessorKey: 'partCode',
  header: t('part.code'),
  size: 120,
},
{
  accessorKey: 'partName',
  header: t('part.name'),
  size: 200,
},
{
  accessorKey: 'status',
  header: t('common.status'),
  cell: ({ getValue }) => <ComCodeBadge groupCode="STATUS" code={getValue() as string} />,
},
{
  accessorKey: 'qty',
  header: t('common.qty'),
  cell: ({ getValue }) => Number(getValue()).toLocaleString(),
  meta: { align: 'right' },
},
{
  id: 'actions',
  header: t('common.actions'),
  cell: ({ row }) => (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => onEdit(row.original)}>{t('common.edit')}</Button>
      <Button size="sm" variant="danger" onClick={() => onDelete(row.original)}>{t('common.delete')}</Button>
    </div>
  ),
},
```

#### 해결 방안 - 컬럼 생성 유틸리티
```typescript
// lib/table-columns.ts
export const createPartColumns = (t: TFunction) => [
  { accessorKey: 'partCode', header: t('part.code'), size: 120 },
  { accessorKey: 'partName', header: t('part.name'), size: 200 },
];

export const createStatusColumn = (t: TFunction, groupCode: string): ColumnDef => ({
  accessorKey: 'status',
  header: t('common.status'),
  cell: ({ getValue }) => <ComCodeBadge groupCode={groupCode} code={getValue() as string} />,
});

export const createQtyColumn = (t: TFunction, key = 'qty'): ColumnDef => ({
  accessorKey: key,
  header: t('common.qty'),
  cell: ({ getValue }) => Number(getValue()).toLocaleString(),
  meta: { align: 'right' },
});

export const createActionsColumn = (t: TFunction, handlers: { onEdit, onDelete }): ColumnDef => ({
  id: 'actions',
  header: t('common.actions'),
  cell: ({ row }) => (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => handlers.onEdit(row.original)}>{t('common.edit')}</Button>
      <Button size="sm" variant="danger" onClick={() => handlers.onDelete(row.original)}>{t('common.delete')}</Button>
    </div>
  ),
});

// 사용 예시
const columns = useMemo(() => [
  ...createPartColumns(t),
  createStatusColumn(t, 'MATERIAL_STATUS'),
  createQtyColumn(t, 'quantity'),
  createActionsColumn(t, { onEdit, onDelete }),
], [t]);
```

---

### 7. 프론트엔드 훅 중복

#### 문제 설명
`useIssuingData`, `useReceivingData`, `useStockData` 등 비슷한 패턴의 훅이 반복됩니다.

**반복 패턴:**
```typescript
// 필터 상태
const [statusFilter, setStatusFilter] = useState('');
const [searchTerm, setSearchTerm] = useState('');

// 필터링 로직
const filteredData = useMemo(() => {
  return data.filter(item => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return item.code?.toLowerCase().includes(search) || 
             item.name?.toLowerCase().includes(search);
    }
    return true;
  });
}, [data, statusFilter, searchTerm]);

// 통계 계산
const stats = useMemo(() => {
  return {
    total: filteredData.length,
    pending: filteredData.filter(d => d.status === 'PENDING').length,
    completed: filteredData.filter(d => d.status === 'COMPLETED').length,
  };
}, [filteredData]);
```

#### 해결 방안 - 공통 훅 추출
```typescript
// hooks/useFilteredList.ts
export function useFilteredList<T>(
  data: T[],
  options: {
    searchFields?: (keyof T)[];
    statusField?: keyof T;
    dateField?: keyof T;
  }
) {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (statusFilter && item[options.statusField] !== statusFilter) return false;
      if (searchTerm && options.searchFields) {
        const search = searchTerm.toLowerCase();
        return options.searchFields.some(field => 
          String(item[field]).toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [data, statusFilter, searchTerm, dateRange]);

  const refresh = useCallback(() => {
    // queryClient.invalidateQueries 등
  }, []);

  return {
    filteredData,
    filters: { statusFilter, setStatusFilter, searchTerm, setSearchTerm },
    refresh,
  };
}

// 사용 예시
const { filteredData, filters, refresh } = useFilteredList(data, {
  searchFields: ['partCode', 'partName'],
  statusField: 'status',
});
```

---

### 8. 폼 모달 패턴 불일치

#### 문제 설명
각 페이지의 폼 모달이 일관되지 않은 패턴으로 구현되어 있습니다.

| 항목 | 불일치 내용 |
|------|-------------|
| 상태 관리 | CompanyForm은 props 전달, 나머지는 내부 useState |
| Submit 위치 | 일부는 모달 내부, 일부는 부모 컴포넌트 |
| Footer 레이아웃 | pt-4 vs pt-6, 마진/패딩 값 상이 |
| 로딩 변수명 | saving vs submitting |
| Modal 사이즈 | 기준 없이 xl/lg 혼용 |
| Form 레이아웃 | grid-cols-2, grid-cols-4, space-y-4 혼용 |

#### 해결 방안 - 공통 Form 컴포넌트
```typescript
// components/ui/FormModal.tsx
export interface FormModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'md' | 'lg' | 'xl';
  onSubmit: (data: T) => Promise<void>;
  initialData?: Partial<T>;
  children: React.ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
}

export function FormModal<T>({
  isOpen, onClose, title, size = 'lg', onSubmit, 
  initialData, children, submitLabel, cancelLabel, isSubmitting 
}: FormModalProps<T>) {
  // 공통 모달 + 폼 래퍼 + submit 핸들링
}

// components/ui/FormField.tsx
export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

// components/ui/FormSection.tsx
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-text-muted mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}
```

---

## 🟢 심각도: 낮음 (지속적 개선)

### 9. 불필요한 코드

#### console.log/debugger
현재 50개 이상의 파일에서 개발용 `console.log`가 남아있습니다.

**주요 위치:**
- `apps/frontend/src/app/(authenticated)/dashboard/page.tsx:273`
- `apps/frontend/src/hooks/material/*.ts`
- `apps/frontend/src/app/(authenticated)/production/*/page.tsx`
- `apps/frontend/src/app/(authenticated)/shipping/*/page.tsx`

#### 해결 방안
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
  },
};

// next.config.js - 빌드 시 console 제거
module.exports = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};
```

---

### 10. TODO 주석
9개 위치에서 API 연동 대기 중인 TODO 주석이 있습니다.

**주요 위치:**
- `apps/frontend/src/hooks/consumables/*.ts`
- `apps/frontend/src/app/(authenticated)/quality/defect/page.tsx:171`

---

### 11. mockData.ts 파일
`apps/frontend/src/app/(authenticated)/master/bom/mockData.ts`는 API 연동 완료 후 제거해야 합니다.

---

## 📋 우선순위별 작업 목록

### 즉시 조치 (1~2일)
1. [ ] 타입 정의 불일치 수정 (EquipmentStatus, JobOrderStatus, DefectStatus, MaterialStatus)
2. [ ] ApiResponse 타입 백엔드와 통일
3. [ ] PaginatedResponse 구조 백엔드와 통일

### 단기 개선 (1~2주)
4. [ ] 백엔드 Base DTO 추출 (PaginationQueryDto, DateRangeQueryDto)
5. [ ] Generic CRUD Service 구현
6. [ ] 프론트엔드 컬럼 생성 유틸리티 구현
7. [ ] 공통 FormModal/FormField 컴포넌트 구현

### 중기 개선 (2~4주)
8. [ ] useFilteredList 등 공통 훅 추출
9. [ ] 모든 페이지의 폼 모달을 공통 컴포넌트로 마이그레이션
10. [ ] console.log 정리 및 ESLint 규칙 적용
11. [ ] mock 데이터 제거 및 실제 API 연동 완료

---

## 📈 예상 효과

| 항목 | 개선 전 | 개선 후 | 효과 |
|------|---------|---------|------|
| 코드 라인 수 (DTO) | 100% | 70~80% | 20~30% 감소 |
| 코드 라인 수 (Service) | 100% | 50~60% | 40~50% 감소 |
| 신규 마스터 개발 시간 | 4시간 | 1~2시간 | 50% 단축 |
| 버그 발생률 (타입 불일치) | 중간 | 낮음 | API 통합 안정성 향상 |
| 유지보수성 | 낮음 | 높음 | 일관된 패턴 적용 |

---

## 🛠️ 구현 가이드

### 1. shared 패키지 타입 우선 사용 원칙
```typescript
// ❌ 피해야 할 코드
export type EquipmentStatus = 'running' | 'idle' | 'maintenance';

// ✅ 권장 코드
import { EQUIP_STATUS_VALUES } from '@shared/constants';
export type EquipmentStatus = typeof EQUIP_STATUS_VALUES[number];
```

### 2. 새로운 마스터 개발 시
```typescript
// 1. DTO는 Base DTO 상속
export class NewMasterQueryDto extends PaginationQueryDto {
  // 추가 필드만 정의
}

// 2. Service는 Generic CRUD 상속
export class NewMasterService extends GenericCrudService<...> {
  // 특화 로직만 추가
}

// 3. 프론트엔드 컬럼은 유틸리티 사용
const columns = [
  ...createPartColumns(t),
  createActionsColumn(t, handlers),
];
```

### 3. 폼 모달 개발 시
```typescript
// 공통 컴포넌트 사용
<FormModal
  isOpen={isOpen}
  onClose={onClose}
  title={t('part.create')}
  onSubmit={handleSubmit}
  isSubmitting={isSubmitting}
>
  <FormSection title={t('section.basic')}>
    <FormField label={t('part.code')} required error={errors.code}>
      <Input {...register('code')} />
    </FormField>
  </FormSection>
</FormModal>
```

---

## 결론

현재 프로젝트는 기능 개발이 우선되어 코드 중복과 타입 불일치가 발생하고 있습니다.  
본 보고서의 권장사항을 단계적으로 적용하면:

1. **유지보수성** 향상: 중복 코드 제거로 변경사항 적용이 용이
2. **안정성** 향상: 타입 일치로 런타임 에러 감소
3. **개발 속도** 향상: 공통 패턴 재사용으로 신규 기능 개발 단축

즉시 조치가 필요한 타입 불일치를 우선 해결하고, 단기/중기 개선 사항을 순차적으로 적용할 것을 권장합니다.
