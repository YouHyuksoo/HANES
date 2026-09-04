---
sources:
  - apps/frontend/src/app/(authenticated)/quality/spc/components/hv-spc-theme.css
  - apps/frontend/src/app/(authenticated)/quality/spc/components/
  - apps/frontend/src/app/(authenticated)/quality/spc/page.tsx
verifiedCommit: pending
---

# 고전압 하네스 SPC 화면 디자인 규칙

> 출처: WebDisplay 저장소 `docs/design/hv-spc.md` (2026-09-04 HANES `/quality/spc` 이식 시 복사, 경로·토큰만 HANES 기준으로 조정)

## 적용 범위

**`/quality/spc` 한 화면.** 스코프는 `.hvspc-root` 이며 토큰 접두사는 `--hv-*` 다. 다른 화면에 영향이 없다.
전제와 금지 목록은 [overview.md](./overview.md)·[theme.md](./theme.md)와 같다. 이 문서는 HV SPC 에서 다른 점만 적는다.

## 의도

- 관리도 화면은 **읽는 화면**이다. 조작은 기간·k·공정·검색 4개뿐이고, 나머지는 전부 값이다.
- 첫 시선은 좌측 목록의 **상태 점 + Cpk 숫자**에 간다. 그 다음이 우측 X̄ 관리도의 **붉은 점**이다.
- 강조색은 **앰버(`--hv-accent`)** 다. 고전압 경고색과 같은 계열이라 도메인이 읽힌다. 파랑·보라 그라데이션은 쓰지 않는다.

## 대비 위계

| 층 | 토큰 | 쓰는 곳 |
|---|---|---|
| 1 | `--hv-ink` 22px 볼드 mono | 능력지수 스트립 값, 헤드라인 특성명 |
| 2 | `--hv-ink-dim` 12~13px | 목록 특성명, 표 본문 |
| 3 | `--hv-ink-mute` 10~11px | 라벨(`.hv-label`), 코드(`.hv-eyebrow`), 축 눈금 |

상태 색은 값에만 입힌다. 배경을 칠하지 않는다(파스텔 배지 금지). 선택 행만 `--hv-accent-soft` 배경 + 좌측 3px 바.

## 상태 색 — 단일 지점

`health` 는 서버(백엔드 `quality/spc/hv` 모듈 `healthOf`)가 정하고, 화면은 `.hv-tone-{STABLE|WARN|OOC}` 로 색만 입힌다.

```
R1/RR1 위반 있음          → OOC   (--hv-stop)
R2~R4 위반 또는 Cpk<1.33  → WARN  (--hv-warn)
그 외                     → STABLE(--hv-run)
```

능력지수 숫자 색은 `HvSpcDetail.tsx` `capTone()` 한 곳: `≥1.33` run, `≥1.00` warn, 미만 stop, null idle.

## 관리도 규칙 색

| 표시 | 색 |
|---|---|
| UCL / LCL | `--hv-stop` 점선 6-3 |
| CL / R̄ | `--hv-series-2` 실선 |
| USL / LSL (규격) | `--hv-accent` 점선 2-4 |
| ±1σ / ±2σ 구역 | `--hv-zone-2` / `--hv-zone-1` 띠 |
| 점 | 정상 `--hv-series` r=2.5, WARN `--hv-warn` r=4.5, OOC `--hv-stop` r=4.5 |

recharts 는 SVG 속성에 `var()` 를 못 쓰므로 `HvSpcCharts.tsx` 가 `.hvspc-root` 의 계산값을 읽어 넘긴다.

## 타이포

| 용도 | 값 |
|---|---|
| 본문 | `--hv-font` = IBM Plex Sans KR → Pretendard → Malgun Gothic |
| 숫자·코드·시각 | `--hv-mono` + `tabular-nums` (`.hv-num`) — 표 정렬과 축 눈금 |
| 마이크로 라벨 | `.hv-eyebrow` 10px/700 자간 0.16em 대문자 — 공정 코드 등 영문 전용 |
| 한글 라벨 | `.hv-label` 11px/600 — 대문자 변환 없음 |

## 레이아웃

- 툴바 1줄(조건) → 본문 2열(좌 목록 360px 고정 / 우 상세 유동). `lg` 미만은 세로 적층, 목록은 40vh 로 제한.
- 능력지수 스트립은 **카드가 아니라 수직 구분선**(`.hv-kpi`)이다. 박스 그리드 금지.
- 상세는 헤드라인 → 능력지수 → 관리도 → 규칙 위반 → 서브그룹 표 순서. 표는 최신이 위.

## 값이 없을 때

- Cp 는 양측 규격이 있어야 산출된다. 단측 규격(인장강도·누설전류)은 Cpk 만 나오고 Cp 는 `미산출`.
- 서브그룹 2건 미만이면 관리도를 그리지 않고 `데이터 부족` 문구만 둔다. 0 으로 채우지 않는다.
- 데이터 소스가 목업이면 툴바 우측에 점선 배너(`.hv-banner`)를 띄운다. 실 소스로 바뀌면 배너 조건이 저절로 꺼진다.

## 금지

- Tailwind 색 클래스(`bg-gray-*`, `text-blue-*`) 직접 사용. 색은 `var(--hv-*)` 만.
- 바탕·선·잉크는 HANES 토큰(`--background`/`--card`/`--border`/`--foreground`/`--muted`)을 `--hv-*` 로 매핑해 쓴다. 흰색(`#fff`) 카드 배경 금지 — 라이트도 페이지 바탕/뮤트 면을 쓴다.
- 상태를 배경색으로 칠하기, 아이콘 뿌리기, 카드 박스 격자.
