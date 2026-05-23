# 📚 HANES MES 프로젝트 문서 체계 개요

## 1️⃣ 문서 카테고리 구조

프로젝트 루트 `docs/` 아래에 **5대 카테고리**를 운영하고 있습니다. 각 카테고리는 역할·성격에 따라 구분되며, 파일명은 **소문자‑kebab‑case** 로統一합니다.

| 카테고리 | 경로 | 주요 내용 |
|---|---|---|
| **design** | `docs/design/` | 시스템 아키텍처, 데이터 모델 ERD, 프론트엔드 라우팅, 백엔드 API 명세, 모듈 지도 등 설계·스펙 문서 |
| **workflows** | `docs/workflows/` | 제조·품질·출하 등 도메인 업무 흐름, 메뉴 추가·변경 워크플로우 |
| **standards** | `docs/standards/` | 코딩 규칙, DB 컬럼 도메인 사전, UI 화면 패턴, RBAC·다국어·인증 스펙, 디자인 가이드, 용어 사전 등 전체 표준 규정 |
| **setup** | `docs/setup/` | 개발·배포 환경 설정, 프로젝트 부트스트랩 체크리스트, 기술 스택 소개 |
| **reports** | `docs/reports/` | 아키텍처 분석, GAP 리포트, 성능·ERP 연동 검토 등 분석·보고서 |

> **NOTE**: 모든 문서는 `README.md` 대신 `readme.md` 로 명명합니다 (소문자 유지). 기존 중복·구버전 문서는 삭제·통합했으며, 파일 이동 시 `readme.md` 내 **목차**를 최신 상태로 유지합니다.

## 2️⃣ 메뉴 구성 명세

`navigation-spec.md` 에 정의된 **전체 메뉴 트리**는 다음과 같이 21개의 대분류와 다중 소분류를 포함합니다. 메뉴 데이터는 `apps/frontend/src/config/menuConfig.ts` 에서 관리되며, **권한 검증**은 `apps/frontend/src/stores/authStore.ts` 를 통해 `allowedMenus` 배열과 매핑됩니다.

### 2.1 대분류 (Code / LabelKey / Path)

| 대분류 | 라벨 키 | 라우트 경로 |
|---|---|---|
| **DASHBOARD** | `menu.dashboard` | `/dashboard` |
| **WORKFLOW** | `menu.workflow` | `/workflow` |
| **MONITORING** | `menu.equipment.status` | `/equipment/status` |
| **MASTER** (기준정보) | — | `/master/*` |
| **INVENTORY** (자재재고) | — | `/inventory/*` |
| **PRODUCT_INVENTORY** | — | `/inventory/stock` |
| **PRODUCT_MGMT** | — | `/product/*` |
| **MATERIAL** (자재관리) | — | `/material/*` |
| **PURCHASING** | — | `/material/po` |
| **PRODUCTION** (생산관리) | — | `/production/*` |
| **INSPECTION** | — | `/inspection/*` |
| **QUALITY** (품질관리) | — | `/quality/*` |
| **EQUIPMENT** (설비관리) | — | `/equipment/*` |
| **GAUGE_MGMT** | — | `/master/gauge` |
| **SHIPPING** (출하관리) | — | `/shipping/*` |
| **SALES** | — | `/sales/*` |
| **CUSTOMS** | — | `/customs/*` |
| **CONSUMABLES** | — | `/consumables/*` |
| **OUTSOURCING** | — | `/outsourcing/*` |
| **INTERFACE** | — | `/interface/*` |
| **SYSTEM** (시스템관리) | — | `/system/*` |

### 2.2 권한 모델

- **메뉴 코드(`code`)** 기반 권한 체크 (`authStore.allowedMenus` 배열) 
- `ADMIN` 은 전체 메뉴 무조건 허용
- 일반 사용자는 `allowedMenus` 에 포함된 메뉴만 보임
- 메뉴 표시 기준: **하위 메뉴 중 하나라도 권한이 있으면 상위 메뉴가 표시**

> **TIP**: 메뉴를 추가하거나 삭제할 경우 `menuConfig.ts` 에서 코드를 추가·삭제하고, 해당 라벨 키를 `i18n` 파일(`locales/ko.json` 등) 에 매핑한 뒤, `navigation-spec.md` 에 표 형태로 업데이트하면 문서와 구현이 일치합니다.

## 3️⃣ 문서 유지·관리 규칙

1. **버전 관리**: 모든 `.md` 파일은 Git 커밋에 포함되며, **중복·구버전 파일은 삭제**합니다.
2. **링크 업데이트**: `readme.md` 의 **목차**는 `[[file]](file:///absolute/path)` 형식의 클릭 가능한 링크로 구성합니다.
3. **신규 문서 추가**: 신규 문서는 해당 카테고리 폴더에 `kebab-case` 로 파일명 지정 후, `readme.md` 의 목차에 자동 링크 삽입.
4. **검증 체크리스트**:
   - [ ] 메뉴 구조가 `navigation-spec.md` 와 일치하는가?
   - [ ] 각 카테고리 파일에 **헤더**(`##`) 로 구분된 섹션이 있는가?
   - [ ] `readme.md` 의 **목차**가 최신인가?
5. **문서 폐기 정책**: 6개월 이상 업데이트되지 않은 파일은 **아카이브**(별도 `archive/` 폴더) 로 이동 후 `readme.md` 에서 제거합니다.

---

## 4️⃣ 향후 작업 제안 (Roadmap)

| 단계 | 작업 | 예상 완료 시점 |
|---|---|---|
| **Phase 1** | `navigation-spec.md` 에 **시각적 다이어그램** (Mermaid) 추가 – 메뉴 트리 시각화 | 2026‑06‑01 |
| **Phase 2** | 메뉴 변경 프로세스 SOP 문서화 – 변경 승인 흐름, 리뷰 담당자 지정 | 2026‑06‑15 |
| **Phase 3** | `docs/standards` 에 **API 계약 가이드** 자동화 스크립트(예: Swagger → markdown) 도입 | 2026‑07‑01 |

---

> **오빠**, 이 문서는 현재 프로젝트 문서 체계와 메뉴 사양을 한눈에 파악할 수 있도록 정리했습니다. 추가하거나 수정할 내용이 있으면 알려 주세요. 필요 시 별도 파일(`docs/standards/menu-specification.md`) 로 상세 표를 분리할 수도 있습니다.
