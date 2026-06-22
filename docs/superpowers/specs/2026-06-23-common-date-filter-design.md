# 전사 공통 날짜 필터 설계

- 작성일: 2026-06-23
- 상태: 설계 승인 대기

## 1. 배경 / 문제

조회 화면 상단의 날짜 필터(시작일~종료일, 단일 날짜)가 공통 컴포넌트로 분리되어 있지 않다.

- `components/shared/`에 날짜 필터 컴포넌트 없음 (Select 계열만 존재)
- 약 82개 파일이 각자 `<Input type="date">`를 직접 사용
- 상태 변수명이 3가지로 분산: `startDate/endDate`(~133곳), `dateFrom/dateTo`(~82곳), `fromDate/toDate`(~55곳)
- 공통화된 것은 `utils/date.ts`의 `getTodayLocal()` **유틸 함수뿐**, UI는 화면마다 개별 구현
- 결과: 시작/종료 레이아웃·기본값 처리·프리셋 유무가 화면마다 제각각

## 2. 목표 / 비목표

### 목표
- 조회기간 **범위 필터**와 **단일 날짜 필터**를 공통 컴포넌트로 통일
- 기본값(오늘) 계산을 `getTodayLocal` 기반으로 일원화 → UTC 밀림 버그 원천 차단
- 시작/종료 레이아웃·프리셋 버튼의 일관성 확보

### 비목표 (이번 범위 밖)
- 폼 입력용 날짜 필드(예: 주문일자, 금형 사용일 등 데이터 입력 칸)는 **건드리지 않는다**
- DataGrid 컬럼 헤더의 셀 날짜 필터(`data-grid/DateFilterPopup`)는 별개 — 변경 없음
- 상태 변수명 통일(리네이밍)은 하지 않는다 — 기존 `dateFrom/dateTo` 등 그대로 둔다

## 3. 컴포넌트 설계 (`components/shared/`)

### 3.1 `DateRangeFilter` — 조회기간 범위 필터

```
[시작일 ▾] ~ [종료일 ▾]   [오늘] [최근 7일] [이번 달]
```

props (controlled):

| prop | 타입 | 설명 |
|---|---|---|
| `from` | `string` (YYYY-MM-DD) | 시작일 값 |
| `to` | `string` | 종료일 값 |
| `onFromChange` | `(v: string) => void` | 시작일 변경 |
| `onToChange` | `(v: string) => void` | 종료일 변경 |
| `presets` | `boolean` (기본 `true`) | 프리셋 버튼 노출 여부 |
| `className` | `string?` | 래퍼 클래스 |

- 기존 두 개의 `useState(dateFrom/dateTo)`를 그대로 연결 → 화면당 변경 최소화
- 프리셋 클릭 시 `onFromChange`/`onToChange`를 함께 호출
- 시작일 > 종료일이면 자동 보정(둘을 swap 또는 반대값을 맞춤) — 구현 시 swap으로 확정

### 3.2 `DateFilter` — 단일 날짜 필터

```
[날짜 ▾]  [오늘]
```

props: `value: string`, `onChange: (v: string) => void`, `todayButton?: boolean`(기본 true), `className?`

### 3.3 기본값 처리

컴포넌트는 controlled이므로 **초기값은 호출부의 `useState`**가 가진다. 기본값 로직을 유틸로 공통화한다.

`utils/date.ts`에 추가:
- `getDefaultRange()` → `{ from: getTodayLocal(), to: getTodayLocal() }` (오늘~오늘)
- `getRecentDaysRange(n)` → n일 전 ~ 오늘
- `getThisMonthRange()` → 이번 달 1일 ~ 오늘

호출부 예:
```tsx
const [dateFrom, setDateFrom] = useState(getTodayLocal());
const [dateTo, setDateTo] = useState(getTodayLocal());
...
<DateRangeFilter from={dateFrom} to={dateTo}
  onFromChange={setDateFrom} onToChange={setDateTo} />
```

- 범위 기본값 **오늘~오늘**, 단일 **오늘**
- 화면별 예외는 호출부에서 다른 초기값(예: `getThisMonthRange()`)을 쓰면 됨

## 4. i18n

프리셋 라벨을 4개 locale(ko/en/zh/vi)에 추가:
- `common.dateFilter.today` (오늘)
- `common.dateFilter.recent7` (최근 7일)
- `common.dateFilter.thisMonth` (이번 달)

## 5. 마이그레이션 (단계적)

### 1단계 — 컴포넌트 + 파일럿
- `DateRangeFilter`, `DateFilter` 작성 + `shared/index.ts` export
- `utils/date.ts` 헬퍼 추가
- i18n 4파일 프리셋 라벨 추가
- 대표 화면 3~5개에 적용해 패턴 검증 (범위 필터 다수 + 단일 필터 1개 포함)
- 빌드/타입 체크 후 독립 커밋

### 2단계 — 일괄 적용
- 1단계에서 검증된 패턴으로 나머지 조회 필터 화면 일괄 치환
- 폼 입력 날짜 칸은 제외(수기 식별)
- 변경 규모가 크므로 모듈 단위로 나눠 커밋

## 6. 검증

- `pnpm --filter @harness/frontend exec tsc --noEmit` 타입 0건 (dev 서버 가동 중이면 build 대신)
- i18n 4파일 키 일치(Grep), BOM 없음 확인
- 파일럿 화면 실제 동작 확인(기본값 오늘, 프리셋 클릭, 범위 보정)

## 7. 협업

- 공유 컴포넌트 신규 추가 + 광범위 변경 → 구현 시작 시 `.ai-coordination/LOCKS.md`에 대상 파일·task ID 기록
- 협업 보드 변경과 기능 변경은 별도 커밋
