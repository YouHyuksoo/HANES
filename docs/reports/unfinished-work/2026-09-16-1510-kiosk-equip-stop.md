# 미완료 작업 기록: 키오스크 설비정지 / 관리자호출 1단계

- 작성시각: 2026-09-16 15:10 KST
- 작성자: claude
- 작업 범위: `/production/input-kiosk` 설비정지·관리자호출 (정지 등록 → 경과 타이머 → 사유 확정 → 해제 → 유실시간 집계)
- 현재 상태: 검증대기 (브라우저 검증 미실행)

## 완료한 것

- DB 스키마 적용(JSHANES 실적용, pre/post 확인): `EQUIP_STOP_EVENTS`, `EQUIP_CALL_EVENTS`, 시퀀스 2개,
  설비당 진행중 1건만 허용하는 함수기반 유니크 인덱스 `UX_EQUIP_STOP_OPEN` / `UX_EQUIP_CALL_OPEN`,
  공통코드 `EQUIP_STOP_REASON` 10건 · `EQUIP_CALL_TYPE` 4건 MERGE.
  - pre: 테이블 0 / 시퀀스 0 / 코드 0 → post: 테이블 2 / 시퀀스 2 / 사유 10 / 호출유형 4 / 유니크인덱스 2
- 백엔드 API: `GET|POST /equipment/stop`, `GET /equipment/stop/open`, `PATCH /equipment/stop/:id/reason`,
  `POST /equipment/stop/:id/release`, `GET|POST /equipment/call`, `GET /equipment/call/open`, `POST /equipment/call/:id/ack`
- 규칙: 정지 시각·해제 시각·유실시간은 전부 서버 `SYSTIMESTAMP` 계산(클라 시계 미사용).
  사유미정 허용, 해제 시 사유 필수(400), 중복 정지 409.
- 설비 상태 반영은 **조건부**다. 정지 시 `STATUS='NORMAL'`일 때만 `'STOP'`으로 바꾸고,
  해제 시 `STATUS='STOP'`일 때만 `PREV_EQUIP_STATUS`로 되돌린다.
  정지 중에 금형수명/PM계획/센서룰/생산실적이 `INTERLOCK`을 걸 수 있는데, 조건 없이 되돌리면 그 인터록을 조용히 풀어버린다.
- 생산실적 게이트: `ProdResultService.assertEquipNotStopped` 추가 → 정지 중 설비는 실적 저장 400으로 차단.
- 프론트: 헤더 우측 `설비정지`/`관리자호출` 버튼 + 진행중 배지(경과시간), 정지 팝업(경과 타이머·사유·해제·당일 이력/유실시간 합계),
  관리자호출 팝업(호출·대기시간·응대), 정지 중 하단 빨간 배너 + 실적입력 차단.
- i18n ko/en/zh/vi 4파일 동시 반영(BOM 없음, 추가만 240줄).

## 미완료 / 남은 것

- **브라우저 실동작 검증 미실행**. Claude 크롬 확장이 연결되지 않았고, 백엔드가 watch가 아닌 빌드 산출물로 떠 있어 신규 라우트가 아직 안 붙었다.
- 정지 이력 조회/사후 보정용 별도 관리화면(엔지니어용)은 만들지 않았다. 현재는 키오스크 팝업 내 당일 이력까지만.
- 유실시간을 가동률/OEE로 환산하는 계산(교대마스터·부하시간 분모·계획비가동·교대 마감)은 이번 범위 밖.
- 관리자호출 알림 발송(채널 미정)은 이번 범위 밖 — 이력 기록 + 화면 표시까지만.
- 서브공정 키팅 화면(`subprocess-kitting`)에는 정지 게이트를 걸지 않았다(요청 범위가 실적입력 화면이라서).

## 변경 파일

- `tools/sql/2026-09-16-equip-stop-events.sql`: 신규 DDL + 공통코드 seed (JSHANES 적용 완료)
- `apps/backend/src/entities/equip-stop-event.entity.ts`, `equip-call-event.entity.ts`: 신규 엔티티
- `apps/backend/src/modules/equipment/dto/equip-stop.dto.ts`: 신규 DTO
- `apps/backend/src/modules/equipment/services/equip-stop.service.ts`: 신규 서비스
- `apps/backend/src/modules/equipment/services/equip-stop.service.spec.ts`: 규칙 테스트 8건
- `apps/backend/src/modules/equipment/controllers/equip-stop.controller.ts`: 신규 컨트롤러 2개
- `apps/backend/src/modules/equipment/equipment.module.ts`: 신규 엔티티/컨트롤러/서비스 등록
- `apps/backend/src/modules/production/services/prod-result.service.ts`: `assertEquipNotStopped` 추가 + `create()`에서 호출
- `apps/frontend/.../input-kiosk/hooks/useEquipStop.ts`: 신규 훅(서버 기준 경과초 + 10초 폴링)
- `apps/frontend/.../input-kiosk/components/EquipStopModal.tsx`, `ManagerCallModal.tsx`: 신규 팝업
- `apps/frontend/.../input-kiosk/components/EquipHeader.tsx`: 버튼 2개 + 진행중 배지
- `apps/frontend/.../input-kiosk/page.tsx`: 훅/팝업 연결, 정지 배너, 실적입력 차단 조건
- `apps/frontend/src/locales/{ko,en,zh,vi}.json`: `kiosk.equipStop.*`, `kiosk.managerCall.*`, `comCode.EQUIP_STOP_REASON/EQUIP_CALL_TYPE`

## 검증 상태

- 실행함: `pnpm run typecheck:backend` 통과.
- 실행함: `pnpm run typecheck:frontend` — 신규 파일 오류 없음.
  단 `.next/types/validator.ts`의 `"/production/productivity"` 라우트 오류 1건은 이번 변경과 무관한 기존 오류다.
- 실행함: `jest equip-stop` 8건 PASS, `jest prod-result` 69건 PASS(회귀 없음).
- 실행함: JSHANES 실DB SQL 계약 스모크 — 정지 등록 / 같은 설비 중복 OPEN 차단(DUP_VAL_ON_INDEX) /
  사유 확정 / 해제 시 `LOSS_SECONDS` 90초 고정 / 해제 후 재정지 가능 / 당일 집계(건수 2, 유실 138초, 진행중 1) 확인.
  스모크 행(`EQUIP_CODE='ZZ-SMOKE-EQ'`)은 DELETE + COMMIT으로 정리했고 `EQUIP_STOP_EVENTS` 잔여 0건을 확인했다.
- 실행함: i18n 누락 점검 `node scripts/find_missing_i18n.js` — 이번에 추가한 `kiosk.equipStop.*`,
  `kiosk.managerCall.*`, `comCode.EQUIP_STOP_REASON/EQUIP_CALL_TYPE` 및 사용한 `common.close`/`common.noData`는
  누락 목록에 없다(전체 345건은 기존 누락이라 이번 변경과 무관).
- 실행함: 프론트는 `next dev --turbopack -p 3002`(dev 모드)로 떠 있어 변경이 즉시 반영된다.
  `/production/input-kiosk` 요청 시 컴파일 후 200 응답을 확인했다(컴파일 오류 없음).
- 실행 못함: 브라우저 UI 검증 — Claude 크롬 확장 미연결(`Browser extension is not connected`).
- 실행 못함: 신규 라우트 HTTP 호출 — 백엔드가 `node dist/main`(pid 13424)으로 떠 있어 404.
  기존 라우트(`/equipment/equips`)는 401로 정상 응답하므로 서버 자체는 살아 있다.

## 중단 사유

- 백엔드 재시작이 필요한데 사용자가 쓰고 있는 프로세스라 임의 종료하지 않았다.
- 브라우저 확장 미연결로 UI 조작 검증 불가.

## 다음 작업자가 바로 할 일

1. **백엔드만** 재빌드·재시작해 신규 라우트를 올린다. 프론트(3002)는 dev 모드라 손댈 필요 없다.
   `GET /api/v1/equipment/stop/open?equipCode=...`가 404가 아니라 401/200이면 정상이다.
2. `/production/input-kiosk`에서 설비 선택 → 헤더 `설비정지` → 사유 없이 등록 → 경과시간 증가 확인 →
   F5 후에도 경과가 이어지는지 확인 → 실적 저장이 차단되는지 확인 → 사유 선택 후 해제 → 당일 이력/유실시간 합계 확인.
3. `관리자호출`도 호출 → 대기시간 → 응대 완료까지 확인한다.
4. 정지 해제 후 `EQUIP_MASTERS.STATUS`가 정지 직전 값으로 돌아왔는지 DB로 확인한다.

## 주의사항

- `EQUIP_STOP_EVENTS` / `EQUIP_CALL_EVENTS` / 시퀀스 2개 / 공통코드 14건은 **JSHANES 운영 DB에 이미 적용**돼 있다. 되돌리지 말 것.
- 유실시간의 단일 출처는 DB다. 프론트에서 `Date.now()`로 정지 시작시각을 만들지 말 것 —
  훅은 서버가 준 경과초를 기준점으로 잡고 화면에서만 1초씩 더한 뒤 폴링마다 서버 값으로 재동기화한다.
- 공통코드 `EQUIP_STOP_REASON`의 `ATTR1`(손실분류) / `ATTR2`(통제가능)는 뒤에 가동률을 붙일 때 쓰려고 채워둔 자리다. 지우지 말 것.
- 사용 계정/사이트: oracle-db 스킬 `--site JSHANES`, company=40 / plant=1000.
- 서버 상태: 백엔드는 `node dist/main`(빌드 산출물, pid 13424) — watch가 아니다. 프론트는 `next dev --turbopack -p 3002`.
- TypeORM 바인드 배열(`:1`…`:11`) 경로는 아직 실드라이버로 실행된 적이 없다(유닛테스트는 query를 모킹, DB 스모크는 리터럴).
  `subprocess-kitting.service.ts:193`의 검증된 패턴과 같은 형태지만, 첫 `POST /equipment/stop` 때 제일 먼저 볼 지점이다.
- `EQUIP_MASTERS.STATUS`에 `'STOP'` 값이 처음으로 들어가게 된다(현재 DB는 NORMAL 63 / INTERLOCK 7).
  `EQUIP_STATUS` 공통코드에 `STOP`(정지)가 이미 있어 설비현황·설비보드 표시는 깨지지 않는다.
