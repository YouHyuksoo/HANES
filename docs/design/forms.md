---
sources:
  - apps/frontend/src/components/shared/QtyInput.tsx
  - apps/frontend/src/components/shared/BarcodeScanInput.tsx
  - apps/frontend/src/components/shared/ComCodeSelect.tsx
  - apps/frontend/src/hooks/useComCode.ts
  - apps/frontend/src/utils/date.ts
verifiedCommit: 90ecd475
---

# 폼 입력 디자인 규칙

`components/shared/`의 4개 실제 컴포넌트/훅과 `utils/date.ts`를 실측했다. export명·prop명은 모두 실제 소스 그대로다.

## 규칙
| 항목 | 규칙 | 근거 |
|---|---|---|
| 수량 입력 | 천단위 구분이 필요한 수량 입력은 `<input type="number">`를 직접 쓰지 않고 `QtyInput`(default export, `components/shared/QtyInput.tsx`)을 사용해야 한다. 내부적으로 `type="text"`+`inputMode="numeric"`으로 구현돼 있고 숫자 값을 emit한다 | `QtyInput.tsx` L1-9(주석), L25-42 |
| 수량 입력 props | `QtyInput`은 `value: number`, `onChange: (value: number) => void`, `maxValue?: number`(초과 입력 시 클램프)를 받는다. `type` prop은 노출하지 않는다(`Omit<InputProps, "value"\|"onChange"\|"type">`) | `QtyInput.tsx` L16-23 |
| 바코드/스캔 입력 | 바코드·QR 스캔을 받는 PC 업무 화면 입력은 일반 `Input`에 `onKeyDown` Enter 처리를 직접 조합하지 말고 `BarcodeScanInput`(default export, `components/shared/BarcodeScanInput.tsx`)을 사용해야 한다 | `BarcodeScanInput.tsx` 전체 |
| 바코드 입력 옵션 | PC 업무 화면에서는 `maintainFocus`(기본 true), `blinkIndicator`(기본 true), `serialFocusedOnly`(기본 true), `refocusAfterScan`(기본 true) 4개 옵션으로 포커스/시리얼 스캔/재포커스 동작을 제어해야 한다 | `BarcodeScanInput.tsx` L18-30, L42-48 |
| 바코드 입력 내부 훅 | `BarcodeScanInput`은 포커스 유지에 `useScanInputFocus`(`hooks/useScanInputFocus.ts`), 시리얼 스캐너 이벤트 구독에 `useSerialStore`(`stores/serialStore.ts`)를 이미 캡슐화하고 있다 — 신규 화면에서 이 두 훅을 직접 조합하지 않는다 | `BarcodeScanInput.tsx` L15-16, L62-105 |
| 코드성 값 선택 | 공통코드(그룹코드) 기반 드롭다운은 `ComCodeSelect`(default export, `components/shared/ComCodeSelect.tsx`)를 사용해야 한다. `groupCode` prop으로 그룹을 지정하고, 필터용은 `includeAll=true`(기본값), 폼 입력용은 `includeAll={false}`로 "전체" 옵션을 제거해야 한다 | `ComCodeSelect.tsx` L5-12, L19-26 |
| 코드 목록 조회 | `ComCodeSelect`는 내부적으로 `useComCodeOptions(groupCode, includeAll, showCode)`(`hooks/useComCode.ts`)를 사용한다. 코드 라벨/색상을 직접 API 호출로 재구현하지 않는다 | `useComCode.ts` L61-83 |
| 날짜 기본값 | 날짜 필터/입력의 기본값은 항상 당일이어야 하고, `getTodayLocal()`(`utils/date.ts`)로 계산해야 한다. `new Date().toISOString().slice(0, 10)`을 오늘 날짜 계산에 사용해서는 안 된다(UTC 변환으로 KST 오전 시간대에 전날이 나온다) | `date.ts` L1-24(주석 배경 설명), 사용자 확정 규칙(feedback_no_utc_date_for_local_today) |
| 날짜 범위 유틸 | 오늘~오늘, 최근 N일, 이번 달 범위가 필요하면 각각 `getDefaultRange()`, `getRecentDaysRange(days)`, `getThisMonthRange()`를 재사용해야 한다 | `date.ts` L47-73 |

## 사용 컴포넌트/토큰
- 수량 입력: `apps/frontend/src/components/shared/QtyInput.tsx` — `import QtyInput from "@/components/shared/QtyInput"`(또는 `@/components/shared` 배럴 확인 후 사용)
- 바코드 입력: `apps/frontend/src/components/shared/BarcodeScanInput.tsx` — `onScan: (value: string) => void | Promise<void>` 콜백 필수
- 공통코드 셀렉트: `apps/frontend/src/components/shared/ComCodeSelect.tsx`
- 공통코드 훅: `apps/frontend/src/hooks/useComCode.ts` — `useComCodes`, `useComCodeOptions`, `useComCodeLabel`, `useComCodeColor`, `useComCodeItem`, `useComCodeList`, `useComCodeMap`
- 날짜 유틸: `apps/frontend/src/utils/date.ts` — `getTodayLocal`, `formatDateOnly`, `getDefaultRange`, `getRecentDaysRange`, `getThisMonthRange`
- 기반 입력 컴포넌트: `apps/frontend/src/components/ui/Input.tsx`(`QtyInput`/`BarcodeScanInput` 모두 이 위에 래핑됨), `apps/frontend/src/components/ui/Select.tsx`(`ComCodeSelect`가 래핑)

## 금지 (안티패턴)
- 수량 입력에 `<input type="number">`를 직접 사용하는 방식 — 천단위 표시가 불가능하고, 표시 컬럼에만 `T-THOUSAND-FORMAT`을 적용하고 입력칸을 누락하는 실수로 이어진다.
- 바코드 스캔 입력을 일반 `Input` + `onKeyDown Enter` + `useScanInputFocus`/`useSerialStore` 수동 조합으로 새로 구현하는 방식(PDA 전용 스캔 UI, 검색/선택용 일반 입력은 예외).
- 상태/유형 코드값을 자유입력 텍스트 필드로 받는 방식 — `ComCodeSelect`/`useComCode` 계열을 우회한다.
- 오늘 날짜 기본값을 `new Date().toISOString().slice(0, 10)`으로 계산하는 방식.
