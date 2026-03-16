# 라우팅 정보 페이지 재설계

## 개요

`/master/routing` 페이지를 BOM 기반 트리뷰 + 양품조건 관리 UI로 전면 재설계한다.

### 핵심 변경점

- **좌측**: 단순 품목 리스트 → BOM 계층 트리뷰 (제품F + 반제품S + 공정P)
- **우측**: 라우팅 DataGrid → 선택된 공정의 양품조건 관리
- **신규 테이블**: `PROCESS_QUALITY_CONDITIONS` (양품조건 마스터)

## 1. 데이터 모델

### 1.1 신규 테이블: PROCESS_QUALITY_CONDITIONS

| 컬럼 | 타입 | PK | NULL | 설명 |
|------|------|----|------|------|
| ITEM_CODE | VARCHAR2(36) | O | N | 품번 (PROCESS_MAPS FK) |
| SEQ | NUMBER | O | N | 공정순서 (PROCESS_MAPS FK) |
| CONDITION_SEQ | NUMBER | O | N | 조건 순번 |
| CONDITION_CODE | VARCHAR2(50) | | Y | 양품조건 코드 (ComCode: QUALITY_CONDITION) |
| MIN_VALUE | NUMBER(10,2) | | Y | 정상수치 MIN |
| MAX_VALUE | NUMBER(10,2) | | Y | 정상수치 MAX |
| UNIT | VARCHAR2(20) | | Y | 단위 (ComCode: UNIT) |
| EQUIP_INTERFACE_YN | VARCHAR2(1) | | Y | 설비 인터페이스 여부 (Y/N) |
| USE_YN | VARCHAR2(1) | | N | 사용여부 (기본 Y) |
| COMPANY | VARCHAR2(255) | | N | 회사 |
| PLANT_CD | VARCHAR2(255) | | N | 공장 |
| CREATED_BY | VARCHAR2(255) | | Y | 생성자 |
| UPDATED_BY | VARCHAR2(255) | | Y | 수정자 |
| CREATED_AT | TIMESTAMP WITH TIME ZONE | | Y | 생성일시 |
| UPDATED_AT | TIMESTAMP WITH TIME ZONE | | Y | 수정일시 |

**PK**: ITEM_CODE + SEQ + CONDITION_SEQ

### 1.2 기존 테이블 (변경 없음)

- `PROCESS_MAPS`: 공정순서 마스터 (ITEM_CODE + SEQ)
- `BOM_MASTERS`: BOM 계층 (PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION)
- `ITEM_MASTERS`: 품목 마스터 (ITEM_CODE)

## 2. 백엔드 API

### 2.1 신규 엔드포인트: 양품조건 CRUD

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/master/routings/:itemCode/:seq/conditions` | 특정 공정의 양품조건 목록 |
| POST | `/master/routings/:itemCode/:seq/conditions` | 양품조건 추가 |
| PUT | `/master/routings/:itemCode/:seq/conditions/:conditionSeq` | 양품조건 수정 |
| DELETE | `/master/routings/:itemCode/:seq/conditions/:conditionSeq` | 양품조건 삭제 |
| PUT | `/master/routings/:itemCode/:seq/conditions/bulk` | 양품조건 일괄 저장 |

### 2.2 신규 엔드포인트: 라우팅 트리 조회

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/master/routings/tree/:itemCode` | 제품의 BOM 트리(원재료 제외) + 각 품목별 라우팅 |

**응답 구조**:
```json
{
  "data": {
    "itemCode": "PA-001",
    "itemName": "고전압 PA-001",
    "itemType": "FINISHED",
    "processes": [
      { "seq": 1, "processCode": "P009", "processName": "조립" },
      { "seq": 2, "processCode": "P010", "processName": "테이핑" }
    ],
    "children": [
      {
        "itemCode": "PA-001-01",
        "itemName": "CIRCUIT-L 회로",
        "itemType": "SEMI_PRODUCT",
        "processes": [
          { "seq": 1, "processCode": "P002", "processName": "케이블절단" }
        ],
        "children": []
      }
    ]
  }
}
```

### 2.3 기존 엔드포인트 유지

기존 PROCESS_MAPS CRUD는 그대로 유지 (공정 추가/삭제/수정).

## 3. 프론트엔드 UI

### 3.1 전체 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│ 라우팅 정보                          [새로고침] [저장]    │
├─────────────────────┬────────────────────────────────────┤
│ 라우팅정보           │ 공정 상세정보                       │
│ [품번검색    ] [🔍]  │ PA-001-01 > 케이블절단 P002        │
│ [완제품] 고전압      │                                    │
│ PA-001              │ 양품조건  수치MIN 수치MAX 단위 I/F  │
│ [공정삭제] [공정추가] │ [A001]..  35    35    CM   □  ✕  │
│                     │ [A002]..  9.9   10.1  MM   □  ✕  │
│ ▼ F PA-001          │                                    │
│   P 1 조립 [P009]   │         [+ 조건추가]               │
│   P 2 테이핑 [P010] │                                    │
│   ▼ S PA-001-01     │                                    │
│     P 1 절단 [P002] │                                    │
│     P 2 삽입 [P004] │                                    │
│   ▶ S PA-001-02     │                                    │
└─────────────────────┴────────────────────────────────────┘
```

- 좌측 4열, 우측 8열 (기존과 동일 비율)
- 우측 상단: 브레드크럼(품번 > 공정명 공정코드)

### 3.2 좌측 패널: BOM 트리뷰

**검색 영역**:
- 품번 입력 + 검색 버튼 → API 호출
- 검색 결과: 품번 + 품명 표시, 품목유형 배지(완제품/반제품)

**트리 구조**:
- `F` 배지(보라) = 완제품
- `S` 배지(노랑/초록) = 반제품
- `P` 배지(회색) = 공정
- 제품/반제품 노드: 접기/펼치기(ChevronRight/ChevronDown)
- 공정 노드: 클릭 시 우측 양품조건 표시, 선택 상태 하이라이트

**버튼**:
- `공정추가`: 선택된 품번(F/S)에 새 공정 추가 → RoutingFormModal
- `공정삭제`: 선택된 공정(P) 삭제 → ConfirmModal

### 3.3 우측 패널: 양품조건 관리

**헤더**:
- 브레드크럼: `{품번} > {공정명} {공정코드}`
- 공정 미선택 시 안내 메시지

**양품조건 테이블** (인라인 편집):
- 양품조건: ComCodeSelect (그룹: QUALITY_CONDITION)
- 수치(MIN): 숫자 입력
- 수치(MAX): 숫자 입력
- 단위: ComCodeSelect (그룹: UNIT)
- I/F: 체크박스
- 삭제: X 버튼

**버튼**:
- `+ 조건추가`: 빈 행 추가
- 상단 `저장`: 변경된 양품조건 일괄 저장 (bulk API)

### 3.4 컴포넌트 구조

```
routing/
├── page.tsx                    (메인 페이지 - 좌우 레이아웃)
├── components/
│   ├── RoutingTreePanel.tsx    (좌측 트리 패널)
│   ├── RoutingTreeNode.tsx     (트리 노드 재귀 렌더링)
│   ├── QualityConditionPanel.tsx (우측 양품조건 패널)
│   └── RoutingFormModal.tsx    (공정 추가/수정 모달 - 기존 재사용)
└── types.ts                   (타입 정의)
```

### 3.5 상태 관리

- `selectedItem`: 검색된 품번 정보
- `treeData`: BOM + 라우팅 트리 데이터
- `expandedNodes`: Set<string> - 펼친 노드 목록
- `selectedProcess`: 현재 선택된 공정 (itemCode + seq)
- `conditions`: 양품조건 배열 (인라인 편집 상태)
- `isDirty`: 변경사항 존재 여부

## 4. ComCode 그룹

- `QUALITY_CONDITION`: 양품조건 코드 (전선 재단 길이, 피복탈피 등)
- `UNIT`: 단위 (CM, MM, EA 등) - 기존 그룹 활용

## 5. 주요 동작 시나리오

1. **품번 검색** → tree API 호출 → 좌측 트리 렌더링
2. **공정 클릭** → conditions API 호출 → 우측 양품조건 표시
3. **양품조건 편집** → 인라인 수정 → 저장 버튼 클릭 → bulk API
4. **공정 추가** → RoutingFormModal → 저장 → 트리 새로고침
5. **공정 삭제** → ConfirmModal → 삭제 → 트리 새로고침
6. **저장하지 않고 다른 공정 클릭** → dirty 상태면 확인 모달
