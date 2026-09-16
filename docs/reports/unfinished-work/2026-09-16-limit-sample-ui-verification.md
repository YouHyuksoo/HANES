# 미완료 기록 — 양불마스터 화면 UI 실동작 검증

- 작성일: 2026-09-16
- 관련 작업: 양불마스터(한도견본) 전용 기준정보 분리
- 설계: `docs/specs/2026-09-16-limit-sample-master-design.md`
- 계획: `docs/plans/2026-09-16-limit-sample-master.md` (Task 10 Step 4)

## 무엇이 끝났나

코드·DB·문서는 전부 완료하고 커밋했다.

- DB: `LIMIT_SAMPLES`(23컬럼) / `LIMIT_SAMPLE_IMAGES`(10컬럼) 생성, 76건 이관(OK 38 / NG 38),
  `INSPECT_AIDS` 컬럼 4개 DROP + 홀더 시드 3건, `INSPECT_SAMPLE_CHECK_ITEMS` 컬럼 리네임.
  INVALID 객체 0건 확인.
- 백엔드: `limit-sample` 모듈(엔티티·DTO·서비스·컨트롤러), 대조 플로우 `LimitSample` 전환.
  jest 21건 통과, `typecheck:backend` 통과.
- 프론트: `/master/limit-sample` 신설, `inspect-aid` 축소, 대조 모달·이력 모달 필드 전환.
  구조 테스트 10+7건 통과, `typecheck:frontend` 통과.
- 문서: table-catalog, schema-erd 재생성, 도움말 4종(user/operator × 2화면), manifest.
  `help-frontmatter-audit` 누락 0건.

## 무엇이 안 끝났나

**브라우저 UI 실동작 검증을 하지 못했다.** `claude-in-chrome` 확장이 연결되지 않아
(`Browser extension is not connected`) 로그인 세션으로 화면을 열 수 없었다.

확인한 것은 라우팅까지다: `GET /api/v1/master/limit-samples` 가 401(인증 필요)을 반환하므로
라우트는 등록됐고 백엔드는 정상 기동했다. 그러나 **실제 SELECT는 한 번도 실행되지 않았다.**

미검증 항목:

1. `/master/limit-sample` 목록에 76건이 렌더되는지 (TypeORM ↔ Oracle 컬럼 매핑 실측)
2. 등록 → 수정 → 삭제 1회 왕복
3. 사진 다중 업로드 + 캡션 + 대표 지정(라디오) + 순서 변경 + 개별 삭제
4. 신규 등록 시 저장 후 사진 순차 업로드 경로 (`uploadPendingImages`)
5. `/master/inspect-aid` 에 홀더 시드 3건이 보이고 유형 탭이 사라졌는지
6. 통전·단자검사의 [양/불체크 시작] 대조 모달이 새 후보를 받는지, 대조 이력 모달에
   견본 코드가 정상 표시되는지

## 다음 세션 재검증 절차

1. 프론트 dev 서버(3002)와 백엔드(3003)가 떠 있는지 확인. 좀비면 `pnpm dev:restart`.
2. 브라우저로 `http://localhost:3002/master/limit-sample` 진입 → 목록 76건 확인.
   비어 있거나 500이면 백엔드 로그에서 TypeORM 컬럼 매핑 오류를 먼저 본다
   (`LIMIT_SAMPLES` 컬럼 23개 vs 엔티티 필드 대조).
3. 위 미검증 항목 2~6을 차례로 수행.
4. 사진 업로드 후 `uploads/limit-samples/` 에 파일이 생겼는지, `LIMIT_SAMPLE_IMAGES` 에
   `IS_PRIMARY='Y'` 가 견본당 1건인지 확인:
   ```sql
   SELECT SAMPLE_CODE, COUNT(*) CNT, SUM(CASE WHEN IS_PRIMARY='Y' THEN 1 ELSE 0 END) PRIMARIES
     FROM LIMIT_SAMPLE_IMAGES GROUP BY SAMPLE_CODE HAVING SUM(CASE WHEN IS_PRIMARY='Y' THEN 1 ELSE 0 END) <> 1;
   ```
   (결과가 0행이어야 정상 — 함수기반 유니크 인덱스가 강제하므로 위반 시 인덱스를 확인)

## 함께 알아둘 것

커밋 `55d2790e`(양불마스터 화면 추가)에 **생산성분석(productivity) 작업분이 섞여 들어갔다.**
세션 시작 시점에 `menuConfig.ts` / `menu-config.json` / `menu-code-validator.ts` /
`locales 4파일` / `pageRegistry.generated.ts` 가 이미 수정돼 있었고, 이 6개 파일은 양불마스터
메뉴 배선에도 필요해 파일 단위 `git add` 로는 분리할 수 없었다. 되돌리지 않았다 —
이미 완성된 작업분이다.
