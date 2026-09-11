# 2026-09-11 현장 요청사항 22건 처리 보고

- 접수: 2026-09-11 (09-09 실무 흐름 테스트 결과, 22건)
- 처리 세션: Claude Code (hanes-ba)
- 우선 처리: ★★ 02·14, 중요 03·11·17·20, 나머지 순차. 보류 지정 08·12·19는 기록만.
- 검증: backend jest(iqc-history 28 / aql 8 / qty-math 4 / 관련 스위트 340+), frontend 구조 테스트 807건 중 804 통과(실패 3건은 HEAD에서도 실패하는 기존 건: material-stock-default-filter, production-result-columns, shipping-confirm-order-panel), frontend/backend `tsc --noEmit` 통과. 브라우저 실화면은 로그인 세션 부재로 미확인.

## 처리 현황

| # | 구분 | 상태 | 조치 요약 |
|---|------|------|-----------|
| 01 | 결함 | **이미 수정됨(09-10)** | `04591846 fix: unblock browser material label reprint` — `printPngLabelsInBrowser`가 `win.print()` 직후 settle 하도록 바뀌어 대화상자가 닫히면 즉시 「출력」으로 복귀. 09-09 18:53 테스트는 수정 전 버전. 배포 후 재검증 요청. |
| 02 | 결함 ★★ | **수정 + DB 복구** | 원인: DB 저장 템플릿 `matlot_label`의 QR 요소에 `sourceField` 자체가 없어 렌더러가 빈 값을 "SAMPLE"로 인코딩. 박스·팔레트·SFG·작업자 기본 템플릿 4종도 동일(전수 조사). (1) `scripts/2026-09-11_label_templates_barcode_sourcefield_repair.sql` 실행으로 5종 복구(pre/post 확인, DB 공유이므로 hswbs도 즉시 반영). (2) 코드: 로드 시 `ensureObjectLabelDesign`이 바코드 sourceField를 소스 테이블 기본 식별자(`DEFAULT_BARCODE_FIELD_BY_SOURCE`)로 보정, 실데이터 렌더에서 값이 비면 SAMPLE 대신 "NO DATA" 표시, 디자이너 소스 변경 시 바코드 필드 자동 보정. 구조 테스트 추가. |
| 03 | 결함·중요 | **규칙 보완** | LOT 판정은 설계상 항목별 불량수 vs AQL Ac/Re. 시리얼 1개=8,400EA에서 FAIL 시리얼 1건=불량 1 ≤ Ac 5 → PASS가 된 것(DB 실측: R26090900003, 항목 3개 모두 defectCount 1 vs Ac 5; 같은 오류 R26090900018도 확인). 보완: 불량코드에 입력한 **불량수량 합계**가 FAIL 시리얼 수보다 크면 FAIL 항목 불량수로 귀속(`AqlService.attributeDefectQtyToFailedItems`, 저장·미리보기 공용). PASS 사유 문구에 항목별 "불량 n건 ≤ Ac m" 명시. 같은 유형: 단건 LOT 경로(`createResult`, 외부 API 전용)에 파괴/전수 불량 합류가 빠져 있던 것도 동일 규칙으로 보완. |
| 04 | 개선 | **완료** | 검사결과 등록 모달 상단 요약줄에 **불합격기준**(Major/Minor "불량 N개 이상 (Ac/Re)") 추가, 하단에 **예상 LOT 판정: PASS/FAIL — 사유**를 시리얼 판정·불량수량 변경 시 실시간 표시(서버 `resolve-iqc-items`에 `itemDefectCounts`/`defectQtyTotal` 전달). 도움말에 판정 규칙 절 추가. |
| 05 | 결함 | **완료** | 전수/파괴 항목만 있는 품목: 우측 패널이 AQL 항목 유무(`aqlItems`)로 분기하도록 수정 → 시리얼은 PASS/FAIL 버튼으로 수동 판정, 안내 문구에 전수/파괴 입력 위치 명시. |
| 06 | 신규메뉴 | **구현 완료(수동입고 방식)** | 사용자 결정: 자동이동 대신 수동입고. (1) 시스템설정 `IQC_FAIL_DEFECT_MOVE_MODE` 신설(기본 MANUAL, AUTO=종전 자동이동) — FAIL 저장 시 재고는 입하재고에 남음. (2) 신규 메뉴 `자재관리 > IQC불합격자재 불량창고입고`(`/material/iqc-defect-receive`, 코드 MAT_IQC_DEFECT_RECEIVE): 입고 대기(FAIL·특채 아님·입하재고 잔량>0) 목록, 시리얼/입하번호 바코드 스캔 선택, DEFECT 창고 선택, 확인 모달 후 입고(입하재고→불량창고 MAT_MOVE/IQC_DEFECT_RECEIVE), 이력 탭(자동이동 포함)과 입고취소(불량창고 재고 미변경 시 입하재고 원복). (3) IQC 판정 취소는 자동이동·수동입고 모두 원복. (4) 메뉴 4곳(menuConfig·seed json·validator·DB) + 도움말·i18n 4개 언어 등록, SQL `scripts/2026-09-11_iqc_defect_receive_menu_and_config.sql` 적용. 스펙 4건·구조 테스트 4건. |
| 07 | 개선 | **완료** | 자재입고관리 설명문을 "IQC 합격건 일괄/분할 입고 + 스캔입고는 자재 LOT ID(자체부착) → 업체 바코드 순으로 짝지어 스캔" 안내로 교체(4개 언어). |
| 08 | 개선 | **보류(지시)** | 업체 바코드 정정·검증. 김산 의견대로 보류. |
| 09 | 결함 | **완료** | 출고요청 좌측 목록: 취소/완료된 상위 지시는 하위가 필터에 걸려도 표시하지 않음(`isJobOrderFinished`). 서버도 완료·취소 지시에 출고요청 등록을 거부(프론트만 고치면 클릭으로 우회 가능하던 구멍 봉합). |
| 10 | 개선 | **완료** | 문구를 "…반제품 투입·반제품 생산 공정인지 확인하세요. 이 경우 출고요청이 필요 없는 정상 상황입니다."로 보완, 하드코딩 문자열을 i18n 키로 전환. |
| 11 | 개선·중요 | **완료** | 좌측 목록에 구분 배지(품목/공정) 추가, 공정지시(OPERATION)는 목록에서 제외. 서버도 공정지시에 출고요청 등록 시 거부(`assertItemOrderForRequest`). 기존 중복 6건(MR2609090072·074·076·078·080·082)은 데이터 정리 필요 — 반려 처리 지시 주시면 실행. |
| 12 | 개선 | **보류(지시)** | 출고처리 행당 다중 LOT 배분. 김산 의견대로 보류. |
| 13 | 결함 | **완료** | 설비일상점검 모달이 sortSeq를 행 키로 써서 두 행이 묶이던 것 → 목록 index 기반 `rowKey`로 키·상태 분리, No는 1부터 순번. 저장 details 키는 기존 형식 유지(기존 로그 90건 호환). DB 실측: EQ-CRIMP-01은 SORT_SEQ 3과 NULL(→3) 충돌, EQ-ATCUT-01은 SORT_SEQ 1이 2건. 같은 유형: 작업자설비점검 모달(`WorkerInspectModal`)도 동일 패턴이라 함께 수정. `equipment/daily-inspect` 입력 패널은 itemCode 키를 이미 써서 해당 없음. 근본 원인인 EQUIP_INSPECT_ITEMS.SORT_SEQ 중복/NULL은 마스터 정리 권장. |
| 14 | 결함 ★★ | **완료** | (1) 키오스크: 공정별 초/중/종물 항목 수를 조회해 항목 없는 시점은 완료로 간주(서버 게이트와 동일 규칙), 작업지시 선택 시 안내 토스트, 모달에 「항목 없음 확인(건너뛰기)」 버튼. (2) 작업지시 생성 API가 트리 내 전 공정지시의 자주검사 항목 유무를 점검해 `warnings`로 반환, 생성 모달/패널이 경고 토스트 표시. |
| 15 | 결함 | **완료** | 헤더 진행수량이 선택 시점 스냅샷(`completedQty`, 설비 복원 경로에서는 아예 undefined→0)이라 갱신되지 않던 것 → 서버 집계 `savedResultCount`(양품+불량, 진행률·중물 차단과 같은 기준)를 단일 출처로 사용. 양품만 표시가 업무상 맞다면 라벨/기준 변경 필요(결정 요청). 같은 스냅샷 패턴이 실적입력(설비)·실적입력(검사) 화면에도 있으나 이번 범위 밖. |
| 16 | 개선 | **완료** | 실적입력 박스 아래 "불량은 좌측 불량입력 패널에서 불량코드와 함께 등록…" 보조설명 추가(4개 언어). |
| 17 | 결함·중요 | **완료 + DB 정리** | 공통 `packages/shared/utils/qty-math.ts`(`mulQty/ltQty/gtQty/ceilQty/roundQty`, 소수 6자리) 신설. 적용: 실적 소비량(auto-issue), 공정재고 비교(wip/proc-mat-stock), 가산·차감 저장값 반올림(잔차 누적 차단), WARN 부족수량 문구, 출고요청 BOM 소요량, 반제품 지시 계획수량(job-order·prod-plan), 서브공정 키팅 소요량. 단위테스트 4건. 기존 오염 데이터 16행(WIP 5·PROC 10·MAT 1, 예: 0.5000000000000222, 1194.600000000005)을 `scripts/2026-09-11_stock_qty_float_residue_cleanup.sql`로 ROUND(…,6) 정리(pre 16 → post 0). 재고정책 실측 MAT_ISSUE_STOCK_CHECK=BLOCK. |
| 18 | 확인 | **메시지 보완 + 별건 수정** | 조건은 `기등록(양품+불량)+이번입력(양품+불량) > 계획수량`(엄격 부등호)으로 정상이며 DB 실측 합계 999=작업지시 979/20 일치. 잔여 1에서 직전 실패한 870을 재입력했을 가능성이 큼(정확한 "이번입력" 값 필요). 오류 메시지에 입력 가능 잔여수량 추가. **별건**: 키오스크 실적입력에서 불량입력 패널로 불량을 등록하면 양품이 작업수에서 차감되지 않아 양품+불량이 과대 전송되던 결함을 수정(전송 시 양품=작업수−불량 재계산). |
| 19 | 결함 | **보류(지시)** | 서브공정 화면 설비점검 표시. 김산 의견대로 보류(20번 정의 후 함께). |
| 20 | 확인·중요 | **정의 회신** | 소스 정의(`subprocess-kitting/page.tsx`): 실적입력(서브공정)은 "이전 공정 SFG 라벨을 스캔해 **회로별 새 SFG(반제품 서브)**를 만드는 2영역 스캔 키팅" 화면(input-assembly의 거울상). 즉 회로별 서브 반제품 라벨이 필요한 다회로 제품의 키팅 단계 전용이며, N91H00-X9800 1~5단계(절단탈피·실드절단·육각압착·양단압착·열수축)처럼 수량 실적이 자연스러운 반제품 공정은 **실적입력(가공)**으로 통일하는 것이 맞음. 사용 조건은 "라우팅에서 회로 단위 SFG 발행이 필요한 공정"으로 한정. |
| 21 | 확인 | **이미지 필요** | 1~8단계 메뉴 매핑 이미지가 첨부되지 않아 검증 불가. 이미지 전달 요청. |
| 22 | 결함 | **완료** | 원인: 자재스캔 모달이 닫힐 때 자기 장착 목록을 비우면서 `materialScanDone` 인터록을 false로 덮어씀(자재리스트 패널이 세운 true를 나중에 실행되는 모달 effect가 뒤집음). 작업지시를 바꾸면 패널이 BOM을 재조회해 다시 true가 되어 "바꿨다 돌아오면 풀리는" 증상이 됨. 수정: 모달이 열려 있을 때만 인터록을 재평가. 검증 예측: 자재스캔 모달을 열지 않고 장착하면 증상이 없음. |

## 후속 필요 사항
- 11 중복 출고요청 6건 반려/삭제 정리 여부.
- 21 이미지 첨부.
- 배포 후 01·02(QR 스캔)·14·17·22 현장 재검증.
- 15 헤더 생산실적 기준(양품+불량 vs 양품) 업무 결정.
- EQUIP_INSPECT_ITEMS SORT_SEQ 중복/NULL 마스터 정리(13 근본 원인).
- 공통코드 QC_SELF(QC_MID_BLOCK_PCT/NOTIFY_PCT) 미시드 — 현재 기본값 60/40으로 동작(자주검사 임계값 조정이 필요하면 시드 필요).

## 변경 파일
- 공통: `packages/shared/src/utils/qty-math.ts`(신규) + `utils/index.ts`
- 백엔드: iqc-history/aql(service·controller·spec), issue-request, auto-issue, job-order, prod-plan, prod-result, subprocess-kitting, wip/proc-mat-stock, `src/shared/qty-math.spec.ts`(신규)
- 프론트: master/label(types·Renderer·Designer + 테스트), input-kiosk(page·DailyInspectModal·EquipHeader·ProductionInputBar·SelfInspectModal + 테스트), production/order(CreateModal·FormPanel), material(IqcModal·RequestModal·WorkOrderRequestPanel·useIssueRequestData + 테스트), locales ko/en/zh/vi
- 도움말: QC_IQC, PROD_INPUT_KIOSK, MAT_REQUEST, PROD_ORDER (사용자)
- DB: `scripts/2026-09-11_label_templates_barcode_sourcefield_repair.sql`, `scripts/2026-09-11_stock_qty_float_residue_cleanup.sql` (모두 적용 완료)
