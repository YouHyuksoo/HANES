# 미완료 작업 기록: IQC 판정 대상 테이블(ADR 0004) 구현

- 작성시각: 2026-09-17 21:15 KST
- 작성자: claude
- 작업 범위: 수입검사(IQC) 판정↔입하 행 역조회 — `IQC_LOG_TARGETS` 신설, 호출부 6곳 이관
- 현재 상태: 검증대기

## 완료한 것

- `IQC_LOG_TARGETS` 신설 + 과거 판정 전수 백필을 JSHANES에 적용했다.
  - pre: `IQC_LOGS` 160건(MAT_UID 18 / REQUEST_NO 0 / ARRIVAL_NO NULL 0), `IQC_REQUEST_LOTS` 0건
  - post: 판정 대상 278행, 판정 160건 전부 대상 보유, 대상 없는 판정 0건
  - 백필 INSERT를 `NOT EXISTS`로 멱등화하고 재실행해 278행/0건 유지를 확인했다(PK 충돌 없음).
- `IqcJudgementLookupService`를 역조회 단일 경로로 세우고 호출부를 옮겼다.
  - 불량입고 판정정보(`iqc-defect-receive`), 검사성적서 첨부 여부(`receiving`),
    입하상세 검사상태·입하취소 가드(`arrival`), 제품 추적성 IQC(`product-traceability`)
- 판정 저장은 `IqcHistoryService.saveIqcLogWithTargets` 한 곳을 거쳐 로그와 대상을 한 트랜잭션으로 쓴다.
- 판정취소 복원 범위를 구성 라인(`IQC_REQUEST_LOT_LINES`)이 아니라 판정 대상으로 결정하도록 바꿨다.
- 죽은 코드 3개 제거: `findLogsByArrivalRows`, `findRequestLotLinesInTx`, `findTargetsOfLog`.
- ERD(`docs/database/schema-erd.md`) 재생성.

## 미완료 / 남은 것

- **브라우저 UI 검증 미실행.** 세션 중 dev 서버(3002/3003)가 떠 있지 않아 화면에서
  입하상세 검사상태, 입하취소 가드, 불량입고 판정정보, 검사성적서 아이콘, 제품 추적성 IQC를
  눈으로 확인하지 못했다.
- **검사의뢰(`IQC_REQUEST_LOTS`) 실데이터가 0건이라 핵심 시나리오를 실측하지 못했다.**
  이 작업의 원인 자체가 "검사의뢰 판정이 대표 입하 행을 잃는다"인데, 그 경로는 단위 테스트로만 덮였다.
  의뢰 1건을 만들어 판정 → 입하취소 가드/불량입고/추적성에서 되찾히는지 확인이 필요하다.
- **미배포(미푸시).** ADR 0004가 경고한 "마이그레이션 적용 ~ 코드 배포" 구간이 현재 열려 있다.
- `createResult`가 판정 저장과 재고 이동을 별도 트랜잭션 2개로 연다(기존에도 분리돼 있었고 이번에 통합하지 않았다).

## 변경 파일

- `apps/backend/src/entities/iqc-log-target.entity.ts`(신규), `entities/index.ts`
- `apps/backend/src/migrations/2026-09-17_iqc_log_targets.sql`(신규, JSHANES 적용 완료)
- `apps/backend/src/modules/material/services/iqc-judgement-lookup.service.ts`(신규, 역조회 단일 경로)
- `apps/backend/src/modules/material/services/iqc-history.service.ts`: 판정 저장 헬퍼, 취소 복원 범위
- `apps/backend/src/modules/material/services/{arrival,receiving,iqc-defect-receive}.service.ts`: 역조회 이관
- `apps/backend/src/modules/material/services/shelf-life-reinspect.service.ts`: RETEST 제외 근거 주석
- `apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts`: 역조회 이관
- 모듈 3곳(`material/receiving`, `material/inventory-control`, `quality/inspection`)
- spec 6개, `docs/database/schema-erd.md`

## 검증 상태

- 실행함: `pnpm typecheck:backend` 0 error
- 실행함: `npx jest`(backend 전체) 251 suites / 2856 tests PASS
- 실행함: JSHANES 실DB 프로브로 `findByArrivalRows`/`mapLatestByArrivalItem`가 백필 데이터에서
  판정을 되찾는 것 확인(`innerJoinAndMapOne` 매핑이 실제로 채워지는지 검증). 프로브 파일은 삭제했다.
- 실행함: 백필 재실행 멱등성 확인(278행 유지, 고아 판정 0건)
- 실행 못함: 브라우저 UI 검증 — dev 서버 미기동
- 실행 못함: 검사의뢰 판정 end-to-end 실측 — `IQC_REQUEST_LOTS` 데이터 0건

## 중단 사유

- 구현·단위검증·DB 적용은 끝났으나 화면 검증과 배포가 남았다.

## 다음 작업자가 바로 할 일

1. `pnpm dev`로 3002/3003을 띄우고 수입검사 화면에서 판정 → 입하취소 시도 → 불량입고 목록 →
   검사성적서 업로드 → 제품 추적성 순으로 확인한다.
2. 검사의뢰 LOT 1건을 만들어 판정하고, 의뢰에 담긴 **모든** 입하 행에서 판정이 되찾히는지 본다
   (대표 행만 되찾히면 이 작업의 목적이 미달이다).
3. 배포 후 `apps/backend/src/migrations/2026-09-17_iqc_log_targets.sql`의 백필 INSERT 2개를
   한 번 더 실행하고, 파일에 적힌 고아 판정 확인 쿼리가 0인지 본다.

## 주의사항

- **판정 저장은 `saveIqcLogWithTargets`만 쓴다.** `iqcLogRepository.save()` 직접 호출로 되돌리면
  대상 없는 판정이 생기고 입하취소 가드가 조용히 열린다.
- **`IQC_LOGS.ARRIVAL_NO`로 판정을 역조회하지 않는다.** 대표값 한 개라 검사의뢰 판정에서 대표 행을 잃는다.
- **`IQC_REQUEST_LOT_LINES`(구성 라인)와 `IQC_LOG_TARGETS`(판정 대상)를 합치지 않는다.**
  구성 라인은 판정 전 계획이라 의뢰가 바뀌면 사라진다.
- **동작 변화**: 입하취소 가드가 입하 행(ARRIVAL_SEQ) 단위로 좁아졌다. 같은 입하번호의 미판정 행은
  이제 취소된다. 완화가 아니라 취소 단위(자재 시리얼 1건)와 가드 단위를 맞춘 것이다.
- 재검사(RETEST)는 시리얼 스코프 판정이라 `ARRIVAL_NO`도 판정 대상도 없다. 취소 경로의 판정 대상
  가드는 `log.arrivalNo`가 있을 때만 걸린다. 이 조건을 빼면 재검사 취소가 영영 400이 된다.
- JSHANES DB는 이미 변경된 상태다(테이블 + 278행). 되돌리지 말 것.
