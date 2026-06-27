# 미완료 작업 — 출고요청 현장 개선 + PartMaster→ItemMaster 리네임

작성: 2026-06-28 / 작성자: Claude

## 목표
1. 출고요청 화면(`/material/request`) 현장 사용성 개선 (grill-me로 설계 도출)
2. `PartMaster` 클래스 → `ItemMaster` 리네임 (실제 테이블명 `ITEM_MASTERS`와 일치화)

## 완료한 것
- **grill-me로 출고요청 개선 설계 확정**:
  - 수량 모델: 요청=필요량(낱개) / 출고=`ceil(요청/MIN_PACK_QTY)×MIN_PACK_QTY`(포장단위 올림) / 잔량=공정재고 재공(반납 안 함)
  - 화면에 `[요청수량][포장단위][실출고수량]` 3값 표시
  - 약점 9개 우선순위: #5 업무흐름 주체 → #3 초과차단+#9 포장단위 → #2 중복가드+#4 부분출고상태(PARTIAL) → #1 품목직접입력/#6 LOT FIFO/#7 재고가시성/#8 공정효과표시
- **ITEM_MASTERS.MIN_PACK_QTY 주석 채움**: `'원자재 포장단위(최소 출고/불출 단위)'` — JSHANES에 DDL 적용 완료
- **메모리**: `PartMaster 클래스 실제 테이블 = ITEM_MASTERS` (착각 재발 방지)

## 미완료 / 막힌 것
- **출고요청 개선 구현 미착수**(설계만 도출).
- ✅ **PartMaster→ItemMaster 리네임 완료** (커밋 `34790d2d`, 142파일). 잔존 0, `@Entity ITEM_MASTERS`·마이그레이션 클래스명 보존, backend/frontend tsc 0. (Codex 미커밋분은 `69816e32`로 선행 커밋)
- **추적**: jest 1건 실패 `wip-mat-stock.service.spec.ts`의 `findByEquip` — 리네임 무관 선재 실패(테스트 mock queryBuilder `groupBy` 미정의)로 보고됨. 별도 확인 필요.
- **남은 것**: 출고요청 개선 구현(아래 "다음에 바로 할 일" 3번)만 미착수.

## 변경 파일
- 코드 변경 없음(설계 단계). DB 주석 1건(`ITEM_MASTERS.MIN_PACK_QTY`), Claude 메모리 1건(git 외부).

## 검증 결과
- 설계만 — 구현 검증 없음.

## 다음에 바로 할 일
1. **Codex의 part/IQC/AQL 작업이 커밋**돼 working tree가 깨끗해질 때까지 대기.
2. **ItemMaster 리네임**(전용 세션): fork+전역치환 `PartMaster`→`ItemMaster`, `partMaster`→`itemMaster`, `part-master`→`item-master`(파일명/import 포함) → `@Entity({ name: 'ITEM_MASTERS' })`는 그대로 → backend `tsc --noEmit` 0 + jest → 한 커밋.
3. **출고요청 개선 구현**(우선순위순): 포장단위 올림 로직은 `mat-issue`/`issue-request`, 3값 표시는 `WorkOrderRequestPanel`.

## 주의할 점
- 테이블명 `ITEM_MASTERS`는 정본(품목=item, 자재/제품/반제품 포함). `PART`로 되돌리지 말 것.
- 리네임은 Codex 미커밋과 충돌 — 반드시 Codex 커밋 후. git add는 파일 단위.
- 잔량 = 공정재고 재공(반납 아님) 확정.
- `tsc`/`jest`는 PATH 문제로 `node_modules/.bin/tsc`·`node_modules/.bin/jest` 직접 실행.
