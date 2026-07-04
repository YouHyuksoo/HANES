# 실적입력(단순검사) — 비즈니스 로직 & 데이터 흐름 분석

> **Menu Code:** `PROD_INPUT_INSPECT`
> **Path:** `/production/input-inspect`
> **Label:** `menu.production.inputInspect`
> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

## 1. 화면 개요

라인→공정→설비→작업지시→작업자 5단계 선택 후 검사 결과를 입력하는 단순검사 실적 화면.

## 2. 화면 구성

```mermaid
%%{init: {'themeVariables': {'fontSize': '11px'}}}%%
flowchart TD
    H["헤더 + 새로고침 + 초기화 + 입력버튼"] --> S["선택 영역 4분할"]
    S --> C1["① 라인/공정/설비 선택 카드"]
    S --> C2["② 작업지시 정보 카드"]
    S --> C3["③ 작업자 정보 카드"]
    S --> C4["④ 통계 카드 (검사수/합격/불합격)"]
    H --> G["DataGrid: 검사 실적 목록"]
    G --> M["Modal: 검사 입력 폼"]
```

## 3. 상태 관리 (Zustand + persist)

**Store:** `inputInspectStore.ts` (`useInputInspectStore`)

| 상태 | 초기화 규칙 |
| --- | --- |
| `selectedLine` | 변경 시 process/equip/jobOrder 초기화 |
| `selectedProcess` | 변경 시 equip/jobOrder 초기화 |
| `selectedEquip` | 변경 시 jobOrder 초기화 |
| `selectedJobOrder` | 독립 |
| `selectedWorker` | 독립 |

## 4. API 호출 흐름

| 시점 | API | 용도 |
| --- | --- | --- |
| 라인+공정 선택 | `GET /equipment/equips?lineCode=&limit=200` | 설비 목록 (공정 필터) |
| 작업지시 선택 | `PATCH /equipment/equips/{id}/job-order` | 설비에 할당 |
| 실적 조회 | `GET /production/prod-results` | 검사 실적 목록 |
| 실적 저장 | `POST /production/prod-results` | 검사 결과 등록 |

```mermaid
%%{init: {'sequence': {'actorFontSize': 10, 'noteFontSize': 10, 'messageFontSize': 10}}}%%
sequenceDiagram
    actor U as 검사자
    participant F as 프론트
    participant B as 백엔드

    Note over U,B: 5단계 선택
    U->>F: 라인 → 공정 → 설비 → 작업지시 → 작업자 순서 선택
    F->>B: GET /equipment/equips?lineCode=
    B-->>F: 설비 목록

    Note over U,B: 검사 결과 저장
    U->>F: 수량/판정 입력 → 저장
    F->>B: POST /production/prod-results
    Note over B: {orderNo, workerId, equipCode, processCode, goodQty, defectQty, remark}
    B-->>F: success
    F->>F: fetchData() 재조회
```

## 5. 백엔드 처리

**Controller:** `ProdResultController.create()`
**Service:** `ProdResultService.create()`

`POST /production/prod-results`로 검사 실적 등록. 일반 생산실적과 동일한 엔드포인트 공유.

## 6. DB 테이블 영향

| 테이블 | 작업 | 설명 |
| --- | --- | --- |
| `PROD_RESULTS` | INSERT | 검사 실적 등록 |

## 7. 비고

- `alert()/confirm()/prompt()` 사용 없음
- Zustand persist로 localStorage에 선택 상태 저장 (페이지 이동 후 유지)
- 공용 `JobOrderSelectModal` + `WorkerSelectModal` 사용
- 설비 목록은 선택된 라인+공정 기준으로 필터링
