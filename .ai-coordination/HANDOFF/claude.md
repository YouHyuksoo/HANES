# claude Handoff

## Last Update

2026-06-06

---

## This Session (2026-06-06) 완료 — Phase A: 자재수명(유효기간) 관리

### 구현 내용

**DB DDL**
- `IQC_LOGS`에 `RETEST_ROUND NUMBER` 컬럼 추가 (JSHANES 완료)
- 실제 원자재 품목 5종 시드 데이터: `EXPIRY_DATE=360, EXPIRY_EXT_DAYS=180` (TMN-SE1, TMN-A, TMN-B, CBL-SE, RSL-T)

**엔티티**
- `iqc-log.entity.ts`: `retestRound: number | null` 필드 추가 (`RETEST_ROUND`)
- `mat-lot.entity.ts`: STATUS 주석에 DISCARDED 추가

**백엔드 버그 수정**

| 파일 | 수정 내용 |
|------|---------|
| `iqc-history.service.ts` | IQC PASS 시 `expireDate = recvDate + item.expiryDate` 자동 계산 (시리얼별 + 입하단위 모두) |
| `shelf-life-reinspect.service.ts` | 연장 로직: `prevExpiry + 90(하드코딩)` → `검사일 + extendDays(item.expiryExtDays 상한)` |
| `shelf-life-reinspect.service.ts` | matUid, retestRound IqcLog에 저장 |
| `shelf-life-reinspect.service.ts` | FAIL 시 `SCRAPPED` → `DISCARDED` |
| `shelf-life-reinspect.service.ts` | 예약수량 체크(availableQty < qty) 유지 |
| `shelf-life.service.ts` | nearExpiryDays 기본값 30 → 10 |
| `shelf-life.dto.ts` | nearExpiryDays default 30→10, DISCARDED 필터 추가 |

**신규 컨트롤러**
- `shelf-life-reinspect.controller.ts`: `GET /material/shelf-life/reinspect` + `POST /material/shelf-life/reinspect`
- `inventory-control.module.ts`에 `ShelfLifeReInspectController` 등록

**테스트**
- `shelf-life-reinspect.service.spec.ts` 전면 업데이트:
  - SCRAPPED → DISCARDED
  - 날짜 비교 `expect.any(Date)`로 변경
  - `iqcLogRepo.count`, `partMasterRepo.findOne` mock 추가
  - retestRound=2 반환 검증

**i18n (ko/en/zh/vi 4개 파일)**
- `material.shelfLife.discarded`, `stats.discarded`, `reinspect`, `reinspectTitle`, `reinspectHistory`, `extendDays`, `retestRound`, `pass`, `fail` 추가

**프론트엔드**
- `material/shelf-life/page.tsx` 전면 개선:
  - 탭 2개: "유수명자재 현황" + "재검사 이력"
  - D-10 기준 (잔여 10일 이하 → NEAR_EXPIRY)
  - DISCARDED 배지 (회색)
  - 폐기 통계 카드 추가 (5번째)
  - EXPIRED/NEAR_EXPIRY 행에 "재검사" 버튼 → 인라인 모달
  - 재검사 모달: PASS/FAIL 선택, 연장일 입력, 검사자/비고

---

## 다음 세션 확인 필요

1. **타입 체크 통과 확인** (이미 완료 — tsc --noEmit 에러 없음)
2. **브라우저 통합 테스트**: shelf-life 화면에서 재검사 플로우 실제 테스트
   - IQC PASS 후 shelf-life 화면에서 해당 LOT 확인 (expireDate 계산 확인)
   - 재검사 PASS → 새 만료일이 `검사일 + 연장일`인지 확인
   - 재검사 FAIL → status=DISCARDED, 재고 불용창고 이동 확인

---

## 이전 세션 이월 (미완)

- **ERD 문서 갱신**: `python tools/generate_db_schema_doc.py` 실행 필요
- **T-011 Phase B**: IQC006 입하 이력 조회, 시리얼 상세 그리드, 입하 취소
- **T-011 Phase C**: 라벨 프린터 백엔드/인쇄 통합
- **T-015**: ERP PO Interface Procedure (IF_PO)
- **notifications unread-count 500 에러**: 가끔 500 반환, 조사 필요

---

## Phase B — 생산관리/품질 (A 완료 후)

- **초·중·종물 검사 로직**: 초물=첫 실적 전 필수, 중물=70% 차단/40% 리마인드, 종물=마지막 실적 전 필수
- **직접검사 / 의뢰검사**: 직접=작업실적 팝업, 의뢰=별도 검사대 화면 + 완료 전 해당 공정 실적 입력 차단
- 검사 공정은 ERP 실적 전송 대상 제외

## Phase C — 영업관리
- 제품인계 → 출하지시 → 출하 (바코드 스캔)

## Phase D — 수리관리
- 불량 시리얼 → 수리/폐기 분기 → 수리 완료 후 양품 재채번

---

## 주요 파일 참조

| 파일 | 설명 |
|------|------|
| `apps/backend/src/entities/iqc-log.entity.ts` | retestRound 필드 추가됨 |
| `apps/backend/src/modules/material/services/iqc-history.service.ts` | IQC PASS 시 expireDate 계산 |
| `apps/backend/src/modules/material/services/shelf-life-reinspect.service.ts` | 재검사 서비스 (연장 로직 수정) |
| `apps/backend/src/modules/material/controllers/shelf-life-reinspect.controller.ts` | 재검사 API (신규) |
| `apps/backend/src/modules/material/services/shelf-life.service.ts` | nearExpiryDays=10 |
| `apps/frontend/src/app/(authenticated)/material/shelf-life/page.tsx` | 재검사 모달 + 이력 탭 |
| `C:\Users\hsyou\Desktop\프로세스 테스트 및 확인.html` | 전체 프로세스 설계 문서 (원본) |

---

## 환경 메모

- 프론트엔드 dev 포트: `3002`
- Oracle 기본 사이트: `JSHANES`
- dev 서버 실행 중 `pnpm build` 절대 금지 (`.next` 캐시 손상)
- 타입 체크 명령: `pnpm --filter @harness/frontend exec tsc --noEmit`
