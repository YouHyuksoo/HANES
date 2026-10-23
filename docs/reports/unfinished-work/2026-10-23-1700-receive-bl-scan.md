# 미완료 작업 기록: 입고 스캔 BL 방식

- 작성시각: 2026-10-23 17:00 KST
- 작성자: claude
- 작업 범위: `/material/receive` 스캔 입고, 현장 개선요청 12번 5) "BL-입하 매칭"
- 현재 상태: 검증대기

## 완료한 것

- 요구 해석(사용자 확인): 입고할 때 업체LOT 대신 BL 번호를 스캔한다. BL 은 한 번만 찍고 자재를 여러 개 이어서 찍는다. 방식은 화면에서 고른다.
- DB: `MAT_RECEIVINGS.BL_NO VARCHAR2(50)` + `IX_MAT_RECEIVINGS_BL_NO` (JSHANES 적용 완료, ERD 재생성).
- 백엔드: 입고 DTO `items[].blNo`, 저장, 입고이력 응답 `blNo`, 검색어로 BL/업체바코드도 찾는다. 업체바코드 중복 차단은 그대로이고 BL 은 여러 행이 공유한다.
- 프론트: 스캔 패널에 [업체LOT / BL] 선택. BL 방식은 BL 을 먼저 찍고 자체바코드를 연속으로 찍는다. [BL 변경]으로 다음 BL 을 찍는다. 입고 후에는 새 BL 부터 다시 찍는다. 입고이력 표에 BL 번호 열을 추가했다.

## 미완료 / 남은 것

- 실제 입고처리(재고 이동)는 실화면에서 누르지 않았다. 저장은 receiving.service 스펙으로만 확인했다.
- 커밋·푸시는 했다(`feat(material): 입고 스캔에 BL 방식` 커밋). hswbs 배포는 러너 offline 으로 대기 중이었다.

## 변경 파일

- `apps/backend/src/migrations/2026-10-23_mat_receiving_bl_no.sql`: 컬럼과 인덱스(멱등)
- `apps/backend/src/entities/mat-receiving.entity.ts`: blNo 컬럼. 이 파일에는 다른 세션의 PK 변경(COMPANY/PLANT_CD)이 섞여 있다.
- `apps/backend/src/modules/material/{dto/receiving.dto.ts,services/receiving.service.ts,services/receiving.service.spec.ts}`
- `apps/frontend/src/app/(authenticated)/material/receive/components/{ReceiveScanPanel.tsx,ReceivingHistoryTable.tsx,types.ts}`
- `apps/frontend/src/locales/{ko,en,zh,vi}.json`: `material.receive.scan.*` 8키, `material.receive.col.blNo`
- `docs/database/schema-erd.md`: 재생성

## 검증 상태

- 실행함: backend/frontend tsc 0, receiving.service 스펙 19 PASS, 입고 구조테스트 2 PASS.
- 실행함: localhost:3002 에서 BL 방식으로 바꾸고 `BLTEST-0001` 스캔 → 자재 2건을 연속 스캔했다. 목록에 둘 다 `BL BLTEST-0001` 로 들어갔다. 입고처리는 누르지 않았고, 새로고침해서 목록을 비웠다.
- 실행 못함: 실입고 저장 후 이력 화면의 BL 열 표시. 실재고가 움직여서 하지 않았다.

## 중단 사유

- 실입고는 재고를 움직여서 사용자 확인 없이 하지 않았다.

## 다음 작업자가 바로 할 일

1. 입고 대상 자재 1건으로 BL 방식 입고를 하고, `MAT_RECEIVINGS.BL_NO` 와 입고이력 BL 열을 확인한다.
2. 배포가 끝나면 hswbs 에서 같은 흐름을 확인한다.

## 주의사항

- `VENDOR_BARCODE` 에 BL 을 넣지 않는다. 업체LOT 은 LOT 당 1회만 쓰는 추적 키이고, BL 은 `BL_NO` 로 따로 둔다.

## 재개 절차

1. `git status --short` 로 위 파일이 남아 있는지 확인한다.
2. JSHANES `MAT_RECEIVINGS.BL_NO` 컬럼이 있는지 확인한다.
3. 위 1번부터 진행한다.
