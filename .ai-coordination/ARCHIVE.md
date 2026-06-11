# ARCHIVE

Completed tasks are compacted here to save context. Keep each item to one line.

Format:

```md
- T-000 | YYYY-MM-DD | owner | short result | evidence: JOURNAL heading or commit
```

## Completed

- T-KIOSK-AUTOISSUE-BOM-MISMATCH-GUARD | 2026-06-12 | codex | 키오스크 스캔 LOT가 BOM 품목과 불일치하면 실적처리/자동차감 전에 중단하도록 방어 추가 | evidence: JOURNAL 2026-06-12 05:59 Codex
- T-CUSTOMER-INTRO-PPTX-EXPORT | 2026-06-12 | codex | 고객 소개 HTML 23장 기준으로 텍스트/도형 편집 가능한 PPTX 재생성, PowerPoint 렌더 23장 확인 | evidence: JOURNAL 2026-06-12 05:28 Codex
- T-QUALITY-INSPECT-USEMEMO | 2026-06-12 | codex | `/quality/inspect` 외관검사 화면의 누락된 `useMemo` React import를 복원해 런타임 ReferenceError 수정 | evidence: JOURNAL 2026-06-12 04:19 Codex
- T-INV-TRANSACTION-CARDS | 2026-06-12 | codex | `/inventory/transaction` 재고수불현황 상단 정보카드 3개와 전용 통계 계산 제거 | evidence: JOURNAL 2026-06-12 02:20 Codex
- T-CUSTOMER-INTRO-HTML-DESIGN | 2026-06-12 | codex | 고객 소개 HTML의 카드형 AI 느낌을 줄이고 산업형 색상/공정 보드 레이아웃으로 재정리 | evidence: JOURNAL 2026-06-12 01:35 Codex
- T-CUSTOMER-INTRO-HTML-V2 | 2026-06-12 | codex | 작업지시서 기준 고객 소개 HTML을 22장 가로형 슬라이드로 재구성, PPTX는 후속 단계로 보류 | evidence: JOURNAL 2026-06-12 01:21 Codex
- T-EQUIP-INSPECT-POOL-TYPE | 2026-06-11 | claude | 점검항목 풀(EQUIP_INSPECT_ITEM_POOL)에 EQUIP_TYPE 추가, 점검항목 마스터 페이지를 설비유형 기준 POOL 편집기로 전환, 설비점검 추가 모달이 설비유형으로 풀 조회 | evidence: JOURNAL 2026-06-11 22:* Claude
- T-DATA-CLEAN-HNS02 | 2026-06-11 | codex | JSHANES HNS02 BOM 기준 품목 47개만 유지하고 입하/입고/IQC/입출고/재고/제품/실적/작업지시/검사/시뮬레이션 데이터 클린징 완료 | evidence: JOURNAL 2026-06-11 22:03 Codex
- T-IQC-SAMPLE-REMOVE | 2026-06-11 | codex | IQC 검사구분 SAMPLE 제거, 마스터 SAMPLE은 FULL 정규화, INSPECT_CLASS는 별도 legacy 이력으로 분리 유지 | evidence: JOURNAL 2026-06-11 21:37 Codex
- T-IQC-METHOD-LABELS | 2026-06-11 | codex | IQC FULL/SAMPLE/SKIP 표시를 검사/검사/무검사로 통일하고 IQC 화면 라벨을 검사구분으로 정리, JSHANES 재적용 | evidence: JOURNAL 2026-06-11 21:21 Codex
- T-MAT-LOT-IQC-UID-SEPARATE | 2026-06-11 | codex | JSHANES에서 MAT_LOTS/MAT_STOCKS/STOCK_TRANSACTIONS 시드성 MAT_UID를 MLT-*로 변경해 IQC_LOGS와 LOT 화면 UID 중복 해소 | evidence: JOURNAL 2026-06-11 21:20 Codex
- T-IQC-CODE-ALIGN | 2026-06-11 | codex | IQC 검사방법(FULL/SAMPLE/SKIP)과 검사유형(INITIAL/RETEST)을 전용 공통코드로 분리하고 품목/IQC/이력 화면 매핑 통일 | evidence: JOURNAL 2026-06-11 20:48 Codex
- T-PROCESS-EQUIP-SEED | 2026-06-11 | codex | 공정 21개 기준 설비 36대와 공정-설비 매핑 36건을 JSHANES에 시드, 전 공정 시드 매핑 확인 | evidence: JOURNAL 2026-06-11 20:27 Codex
- T-MENU-SHELF-LIFE-REINSPECT | 2026-06-11 | codex | 유수명자재 재검사 메뉴 validator 누락과 JSHANES 배치/권한 복구, 이동 API 실측 성공 | evidence: JOURNAL 2026-06-11 20:00 Codex
- T-FE-THEME-PRESET | 2026-06-11 | codex | 상단 팔레트 아이콘에서 선택 가능한 Orchid 컬러 테마 preset 추가 및 dev 서버 3004 응답 확인 | evidence: JOURNAL 2026-06-11 19:30 Codex
- T-TAB-LIMIT-10 | 2026-06-11 | codex | 페이지 탭 제한 개수를 10개로 변경하고 타입/구조 테스트 통과 | evidence: JOURNAL 2026-06-11 16:24 Codex
- T-REQINSPECT-LSL-USL | 2026-06-11 | claude | 의뢰검사 입력 우측 패널에 공정생품검사 LSL/USL 검사기준 표시(SELF_INSPECT_RESULTS↔ITEMS JOIN), tsc 통과 | evidence: JOURNAL 2026-06-11 15:30 Claude
- T-CUSTOMER-INTRO-WORK-INSTRUCTION | 2026-06-11 | codex | 고객용 제품 소개 자료 재생성 작업지시 문서 작성 완료 | evidence: JOURNAL 2026-06-11 14:43 Codex
- T-CUSTOMER-INTRO-MENU-SCREEN-DECK | 2026-06-11 | codex | 현재 메뉴 화면 캡처 기반으로 고객용 제품 소개 PPTX/HTML 15장 확장 및 검증 완료 | evidence: JOURNAL 2026-06-11 13:59 Codex
- T-CUSTOMER-INTRO-PRODUCT-DECK | 2026-06-11 | codex | 고객용 제품 소개 자료로 HTML/PPTX 전면 재작성 및 검증 완료 | evidence: JOURNAL 2026-06-11 13:15 Codex
- T-CUSTOMER-INTRO-PPTX | 2026-06-11 | codex | 고객 소개용 HANES MES 가로형 PPTX 문서 생성 및 레이아웃/패키지 검증 완료 | evidence: JOURNAL 2026-06-11 12:56 Codex
- T-CUSTOMER-INTRO-HTML-REV | 2026-06-11 | codex | 고객 소개 HTML 자료를 12장 워크플로우형으로 보강하고 글자 침범/넘침 수정 | evidence: JOURNAL 2026-06-11 12:39 Codex
- T-CUSTOMER-INTRO-HTML | 2026-06-11 | codex | 고객 소개용 HANES MES 가로형 HTML 자료와 실제 화면 캡처 5종 생성 | evidence: JOURNAL 2026-06-11 12:00 Codex
