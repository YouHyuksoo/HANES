# 회사마스터 — 비즈니스 로직 & 데이터 흐름 분석
> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

## 1. 화면 개요

회사(Master) 및 사업장(Plant) CRUD 페이지. DataGrid 기반 목록 + 우측 슬라이드 패널로 추가/수정, 사업장 관리 포함.

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | SYS_COMPANY |
| **경로** | `/master/company` |
| **프론트 파일** | `apps/frontend/src/app/(authenticated)/master/company/page.tsx` |
| **컴포넌트** | `CompanyForm.tsx`, `companyColumns.tsx`, `types.ts` |
| **백엔드** | `CompanyController` (`/master/companies`), `PlantController` (`/master/plants`) |
| **서비스** | `CompanyService`, `PlantService` |
| **DB 엔티티** | `CompanyMaster`, Plant entities |

## 2. 화면 구성

```mermaid
flowchart TD
    A[SYS_COMPANY Page] --> B[DataGrid: 회사 목록]
    A --> C[CompanyFormPanel: 우측 슬라이드 패널]
    C --> D[기본정보: companyCode/companyName/bizNo/ceoName]
    C --> E[연락처: address/tel/fax/email]
    C --> F[비고]
    C --> G[사업장 관리 (수정 시): plant 목록 CRUD]
    A --> H[ConfirmModal: 삭제 확인]
```

| 컬럼 | 설명 |
|------|------|
| companyCode | 회사 코드 |
| companyName | 회사명 |
| bizNo | 사업자번호 |
| ceoName | 대표자 |
| address | 주소 |
| tel | 전화 |
| email | 이메일 |
| useYn | 사용여부 (초록/회색 dot) |

## 3. 상태 관리

```typescript
const [companies, setCompanies] = useState<Company[]>([]);
const [loading, setLoading] = useState(false);
const [searchText, setSearchText] = useState("");
const [isPanelOpen, setIsPanelOpen] = useState(false);
const [editingCompany, setEditingCompany] = useState<Company | null>(null);
const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
const { markDirty, guard, guardModalProps } = useUnsavedGuard();
```

- `fetchCompanies`: `GET /master/companies?limit=5000&search=...`
- `handleDeleteConfirm`: `DELETE /master/companies/${companyCode}::${plant}`
- `useUnsavedGuard`: 행 전환 시 미저장 데이터 보호

## 4. API 호출 흐름

```mermaid
sequenceDiagram
    participant F as Frontend
    participant CC as CompanyController
    participant CS as CompanyService
    participant PC as PlantController
    participant PS as PlantService
    participant DB as CompanyMaster

    F->>F: fetchCompanies()
    F->>CC: GET /master/companies?search=&limit=5000
    CC->>CS: findAll(query)
    CS->>DB: queryBuilder: LIKE search + USE_YN filter
    DB-->>CS: CompanyMaster[]
    CS-->>CC: { data, total, page, limit }
    CC-->>F: ResponseUtil.paged(data)

    F->>F: save(create/edit)
    F->>CC: POST/PUT /master/companies/:id
    CC->>CS: create(dto) / update(id, dto)
    CS->>DB: save / update
    DB-->>CS: saved entity
    CC-->>F: ResponseUtil.success(data)

    F->>CC: DELETE /master/companies/:id
    CC->>CS: delete(id)
    CS->>DB: delete

    F->>PC: GET /master/plants?plantType=PLANT
    PC->>PS: findAll(query)
    PS->>DB: Plant[]
    DB-->>PS
    PC-->>F: ResponseUtil.paged(data)

    F->>PC: POST /master/plants {plantCode, plantName, plantType, company}
    F->>PC: DELETE /master/plants/:plantCode
```

## 5. 백엔드 처리

- `CompanyService.findAll`: `companyCode LIKE %search% OR companyName LIKE %search% OR bizNo LIKE %search%`
- `CompanyService.findPublic`: 활성 회사 목록 (인증 불필요, 로그인 페이지용)
- `CompanyService.create`: 중복 체크 → create → save
- `CompanyService.update`: findById → partial update
- `CompanyService.delete`: 진짜 DELETE (소프트 대신 하드)
- 회사 키: `companyCode::plant` (복합키, 프론트에서 `getCompanyKey`로 생성)

## 6. 처리 규칙 및 검증

- companyCode는 수정 시 disabled (PK)
- companyCode, companyName 필수
- 사업장은 수정 모드에서만 관리 가능
- `getCompanyKey`: `companyCode + "::" + plant`
- `getPlantKey`: `plantCode + "::" + shopCode + "::" + lineCode + "::" + cellCode`

## 7. 상태 전이

- 논리적 상태 전이 없음. useYn(Y/N)으로 활성/비활성

## 8. 상태 코드 및 공통코드

- 없음

## 9. DB 테이블 영향 및 엔티티

**CompanyMaster** (`company-master.entity.ts`)
| 컬럼 | 설명 |
|------|------|
| companyCode | 회사코드 (PK) |
| plant | 사업장 (PK, `-` 기본값) |
| companyName | 회사명 |
| bizNo | 사업자번호 |
| ceoName | 대표자 |
| address | 주소 |
| tel | 전화 |
| email | 이메일 |
| useYn | 사용여부 |

## 10. 에러 코드

| HTTP | 상황 |
|------|------|
| 409 | 중복 회사코드 |
| 404 | 회사 미존재 |

## 11. 비고

- Plant controller는 `Master/plants`에 있음 (Company와 동일 모듈)
- 인증 없이 접근 가능한 `public` 엔드포인트 별도 존재 (로그인 페이지용)
