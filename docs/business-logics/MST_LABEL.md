---
sources:
  - apps/backend/src/modules/master/controllers/label-template.controller.ts
verifiedCommit: 8a7e96ea
---

# 라벨 디자인 (MST_LABEL) — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

## 1. 화면 개요

| 항목 | 내용 |
|---|---|
| 메뉴 코드 | MST_LABEL |
| 페이지 경로 | `/master/label` |
| 화면 제목 | 라벨 디자인 관리 (Label Template Designer) |
| 주요 기능 | 객체 기반 라벨 디자인 (WYSIWYG 편집기), 템플릿 저장/불러오기, 미리보기 |
| 데이터 소스 | LABEL_TEMPLATES (JSON 디자인 데이터) |

## 2. 화면 구성

```mermaid
graph TD
    A[LabelPage] --> B[Header: 타이틀]
    A --> C[좌측: LabelObjectDesigner]
    A --> D[우측: TemplateManager + LabelDesignRenderer]
    C --> E[객체 기반 라벨 편집 캔버스]
    D --> F[TemplateManager: 템플릿 CRUD]
    D --> G[LabelDesignRenderer: 미리보기 (3x scale)]
```

### 컴포넌트 목록

| 파일 | 역할 |
|---|---|
| `page.tsx` | 메인 페이지, 디자인 상태 관리 |
| `components/LabelObjectDesigner.tsx` | 객체 기반 라벨 편집기 |
| `components/TemplateManager.tsx` | 템플릿 저장/불러오기/삭제 |
| `components/LabelDesignRenderer.tsx` | 라벨 디자인 렌더러 (미리보기) |
| `types.ts` | LabelDesign, LabelCategory, LabelSourceTable 타입 |
| `labelSources.ts` | source별 샘플 데이터 |

## 3. API 호출

| 엔드포인트 | 컨트롤러 | 설명 |
|---|---|---|
| `GET /master/label-templates` | `LabelTemplateController.findAll` | 템플릿 목록 |
| `GET /master/label-templates/:id` | `LabelTemplateController.findById` | 템플릿 조회 |
| `POST /master/label-templates` | `LabelTemplateController.create` | 템플릿 저장 |
| `PUT /master/label-templates/:id` | `LabelTemplateController.update` | 템플릿 수정 |
| `DELETE /master/label-templates/:id` | `LabelTemplateController.delete` | 템플릿 삭제 |
| `POST /master/label-templates/upload-image` | `LabelTemplateController.uploadImage` | 라벨 내 이미지 업로드 |

## 4. DB 테이블 영향

| 테이블 | 작업 |
|---|---|
| `LABEL_TEMPLATES` | SELECT/INSERT/UPDATE/DELETE |

주요 필드: `TEMPLATE_ID(PK)`, `CATEGORY` (equip/jig/worker/mat_lot/box/pallet/sg/fg), `TEMPLATE_NAME`, `DESIGN_DATA` (JSON), `LABEL_WIDTH`, `LABEL_HEIGHT`, `SOURCE_TABLE`, `USE_YN`

## 5. 처리 규칙

- 카테고리: equip, jig, worker, mat_lot, box, pallet, sg, fg
- 디자인 데이터는 JSON 형식으로 저장 (요소 배열)
- sourceTable 매핑: equipment→equip, consumable→jig, mat_lot→mat_lot 등
- `ensureObjectLabelDesign()`: 기존 디자인을 최신 객체 형식으로 마이그레이션
- 미저장 변경 감지: `baseline`과 현재 `design` JSON 비교

## 6. 공통코드

| 코드 그룹 | 사용처 |
|---|---|
| `LABEL_CATEGORY` | 라벨 카테고리 |

## 7. 비고

- Preview 렌더러는 3x scale로 미리보기 표시
- TemplateManager에서 dirty 상태 감지하여 저장/불러오기 제어
- 라벨 크기는 `labelWidth x labelHeight` mm로 표시
