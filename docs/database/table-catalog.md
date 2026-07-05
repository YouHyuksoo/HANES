# HANES MES — AI 테이블 카탈로그

<!-- AI 질의(text-to-SQL) 시 주입되는 테이블 지식. 사람이 직접 편집할 수 있습니다. -->
<!-- 형식: "## 테이블명 — 설명" / "동의어: a, b" / "관계:" 아래 "- 컬럼 -> 대상테이블.컬럼" -->
<!-- "DB와 동기화" 시 누락 테이블이 자동 추가되며, 작성한 설명·관계는 보존됩니다. -->

## ACTIVITY_LOGS — 사용자 활동 로그(페이지 접근 이력)

## AQL_SAMPLING_RULES — AQL LOT 수량별 sampling rule

## AQL_STANDARDS — AQL 기준 헤더

## AUDIT_FINDINGS — 내부심사 부적합 사항(발견사항)

## AUDIT_PLANS — 내부심사 계획

## BOM_MASTERS — BOM(자재명세서) 마스터 - 모/자 품목 관계

## BOX_MASTERS — 박스 포장 마스터

## CALIBRATION_LOGS — 계측기 교정 이력

## CAPA_ACTIONS — CAPA(시정 예방조치) 조치 항목

## CAPA_REQUESTS — CAPA(시정 예방조치) 요청

## CHANGE_ORDERS — 변경관리(설계 공정 변경) 요청

## COM_CODES — 공통코드 마스터 (그룹코드+상세코드 관리)

## COMM_CONFIGS — 통신 설정 (시리얼포트/TCP 등)

## COMPANY_MASTERS — 자사(본사) 법인 정보. 자기 회사 1건만 보유(외부 회사 아님)

## CONSUMABLE_LOGS — 소모품 입출고 이력 로그

## CONSUMABLE_MASTERS — 소모품 마스터 (금형/치공구/공구)

## CONSUMABLE_MOUNT_LOGS — 소모품 설비 장착/탈착 이력

## CONSUMABLE_STOCKS — 소모품 재고(시리얼 단위)

## CONSUMABLE_USAGE_MAP — 소모품 사용 정의(품목 설비별 사용량)

## CONTROL_PLAN_ITEMS — 관리계획서 상세 항목

## CONTROL_PLANS — 관리계획서(Control Plan)

## CUSTOMER_COMPLAINTS — 고객 불만(클레임)

## CUSTOMER_ORDER_ITEMS — 수주 품목 상세

## CUSTOMER_ORDERS — 수주(고객주문)

## CUSTOMS_ENTRIES — 보세 수입신고 관리

## CUSTOMS_LOTS — 보세 LOT 관리 (수입자재 추적)

## CUSTOMS_USAGE_REPORTS — 보세 사용량 보고

## DEFECT_CATEGORY_MASTERS — 불량코드 전용 3레벨 분류 마스터

## DEFECT_CODE_MASTERS — 불량코드 전용 마스터

## DEFECT_CODE_PRODUCT_TYPES — 불량코드 모델구분별 적용 매핑

## DEFECT_LOGS — 불량 이력 로그

## DEPARTMENT_MASTERS — 부서 마스터

## DOCUMENT_MASTERS — 문서 마스터(문서관리)

## EQUIP_BOM_ITEMS — 설비 BOM 부품(예비품) 마스터

## EQUIP_BOM_RELS — 설비-부품 관계 (설비에 장착된 부품)

## EQUIP_CONDITION_RULES — 설비 상태감시 규칙(센서 임계값)

## EQUIP_INSPECT_ITEM_MASTERS — 설비점검항목 기준 마스터 (설비유형별 점검항목 템플릿)

## EQUIP_INSPECT_ITEM_POOL — 설비 점검 항목 풀

## EQUIP_INSPECT_LOGS — 설비 점검 이력 로그

## EQUIP_MASTERS — 설비 마스터

## EQUIP_PROTOCOLS — 설비 통신 프로토콜 정의

## FAI_ITEMS — 초도품검사(FAI) 측정 항목

## FAI_REQUESTS — 초도품검사(FAI) 요청

## FG_LABELS — 완제품 라벨(시리얼 바코드)

## GAUGE_MASTERS — 게이지(측정기) 마스터

## HARNESS_CIRCUIT_SPECS — 하네스 제품 도면 회로별 제작 사양

## HARNESS_DRAWING_MASTERS — 하네스 제품 도면 Header

## HARNESS_DRAWING_REVISIONS — 하네스 제품 도면 Revision

## IMPR_REQUESTS — 화면 개선요청

## INSPECT_RESULTS — 검사 결과 (공정검사/AOI 등)

## INTER_LOGS — 인터페이스 송수신 이력 로그

## INV_ADJ_LOGS — 재고 조정(실사) 이력 로그

## IQC_AQL_POLICIES — IQC AQL 정책 기준정보

## IQC_ITEM_MASTERS — IQC 검사항목 마스터 (품목별)

## IQC_ITEM_POOL — IQC 검사항목 풀 마스터

## IQC_LOGS — IQC 검사 이력 로그

## IQC_PART_SPEC_ITEMS — 품목별 IQC 검사항목 세부

## IQC_PART_SPECS — 품목별 IQC 기준 헤더

## IQC_TEMPLATE_ITEMS — 수입검사(IQC) 템플릿 항목

## IQC_TEMPLATES — 수입검사(IQC) 템플릿

## ITEM_MASTERS — 품목(자재/반제품/완제품) 마스터

## JOB_MATERIAL_LOTS — 작업지시 투입 자재 로트

## JOB_ORDERS — 작업지시 (생산계획 → 현장 지시)

## LABEL_PRINT_LOGS — 라벨 인쇄 이력 로그

## LABEL_TEMPLATES — 라벨 템플릿 마스터

## MAT_ARRIVAL_STOCKS — 자재 입하 재고

## MAT_ARRIVAL_TRANSACTIONS — 자재 입하 트랜잭션

## MAT_ARRIVALS — 자재 입고 (입고예정/입고확정)

## MAT_ISSUE_REQUEST_ITEMS — 자재 출고요청 품목 상세

## MAT_ISSUE_REQUESTS — 자재 출고요청 (청구)

## MAT_ISSUES — 자재 출고 이력

## MAT_LOTS — 자재 LOT 관리

## MAT_RECEIVINGS — 자재 수입검사 후 입고확정 (검수)

## MAT_STOCKS — 자재 재고 현황
관계:
- ITEM_CODE -> ITEM_MASTERS.ITEM_CODE

## MENU_CATEGORIES — 사이드바 카테고리(상위 메뉴) 정의

## MENU_CATEGORY_ITEMS — 메뉴(leaf) ↔ 카테고리 배치

## MODEL_SUFFIXES — 모델 서픽스 마스터

## MOLD_MASTERS — 금형 마스터

## MOLD_USAGE_LOGS — 금형 사용 이력(쇼트 수)

## NUM_RULE_MASTERS — 채번 규칙 마스터 (자동 번호생성)

## OQC_REQUEST_BOXES — OQC 요청 대상 박스 목록

## OQC_REQUESTS — OQC(출하검사) 요청

## PALLET_MASTERS — 팔레트 마스터

## PARTNER_MASTERS — 거래처 마스터(고객사 공급사 등 외부 회사). 외부 회사명 대표자명 사업자번호는 여기서 조회

## PDA_ROLE — PDA 역할 정의 테이블

## PHYSICAL_INV_COUNT_DETAILS — 재고 실사 상세(품목별 실사 수량)

## PHYSICAL_INV_SESSIONS — 재고 실사 세션

## PLANTS — 공장/라인/셀 계층 구조 마스터

## PM_PLAN_ITEMS — PM 계획 세부항목

## PM_PLANS — 예방보전(PM) 계획

## PM_WO_RESULTS — PM 작업지시 실행결과

## PM_WORK_ORDERS — PM 작업지시(워크오더)

## PPAP_SUBMISSIONS — PPAP 제출(양산부품 승인)

## PROCESS_CAPAS — 공정 생산능력(CAPA) 정의

## PROCESS_EQUIPMENTS — 공정-설비 매핑

## PROCESS_MAPS — 품목별 공정 라우팅(공정순서) 맵

## PROCESS_MASTERS — 공정 마스터

## PROCESS_QUALITY_CONDITIONS — 공정 품질조건(관리 항목 규격)

## PROD_LINE_MASTERS — 생산라인 마스터

## PROD_PLANS — 생산계획(월 단위)

## PROD_RESULTS — 생산실적 (공정별 양품/불량 수량)

## PRODUCT_GENEALOGY — 생산 genealogy(제품→묶음→원자재 lot 재귀)

## PRODUCT_STOCKS — 제품 재고(수량)

## PRODUCT_TRANSACTIONS — 제품 입출고 트랜잭션

## PURCHASE_ORDER_ITEMS — 구매발주 품목 상세

## PURCHASE_ORDERS — 구매발주

## REPAIR_LOGS — 수리/재작업 이력 로그

## REPAIR_ORDERS — 수리 지시

## REPAIR_USED_PARTS — 수리 사용 부품

## REWORK_INSPECTS — 재작업 검사

## REWORK_ORDERS — 재작업 지시

## REWORK_PROCESSES — 재작업 공정

## REWORK_RESULTS — 재작업 실적

## ROUTING_GROUPS — 라우팅(공정순서) 그룹

## ROUTING_MATERIALS — 라우팅 투입 자재(BOM)

## ROUTING_PROCESSES — 라우팅 공정 순서

## SAMPLE_INSPECT_RESULTS — 샘플 검사 결과(측정값)

## SCHEDULER_JOBS — 스케줄러 작업 정의

## SCHEDULER_LOGS — 스케줄러 실행 로그

## SCHEDULER_NOTIFICATIONS — 스케줄러 알림

## SELF_INSPECT_ITEMS — 자주검사 항목

## SELF_INSPECT_RESULTS — 자주검사 결과

## SENSOR_DATA_LOGS — 설비 센서 데이터 로그

## SEQ_RULES — 채번 규칙(문서번호 생성)

## SG_LABELS — 반제품 묶음 추적라벨(잔량 가닥수 보유)

## SHIFT_PATTERNS — 근무 교대 패턴

## SHIPMENT_LOGS — 출하 실적 이력

## SHIPMENT_ORDER_ITEMS — 출하지시 품목 상세

## SHIPMENT_ORDERS — 출하지시 (출하계획)

## SHIPMENT_RETURN_ITEMS — 출하 반품 품목 상세

## SHIPMENT_RETURNS — 출하 반품 관리

## SIMULATION_HEADERS — 생산 시뮬레이션 헤더

## SIMULATION_PLANS — 생산 시뮬레이션 계획

## SIMULATION_SCHEDULES — 생산 시뮬레이션 일정

## SPC_CHARTS — SPC 관리도 정의

## SPC_DATA — SPC 측정 데이터

## STOCK_TRANSACTIONS — 재고 트랜잭션 이력 (입고/출고/이동/조정)

## SUBCON_DELIVERIES — 외주 사급(자재 납품)

## SUBCON_ORDERS — 외주 발주

## SUBCON_RECEIVES — 외주 수입(완성품 입고)

## SYS_CONFIGS — 시스템 설정 (키-값 쌍 관리)

## TRACE_LOGS — 추적 이력 로그 (LOT/시리얼 추적)

## TRAINING_PLANS — 교육 계획

## TRAINING_RESULTS — 교육 결과(수료)

## VENDOR_BARCODE_MAPPINGS — 자재 제조사 바코드 매핑

## VENDOR_INSPECTION_MODE_HISTORY — 공급업체 검사강도 자동 전환 이력

## VENDOR_MASTERS — 자재 공급업체(벤더) 마스터

## WAREHOUSE_LOCATIONS — 창고 로케이션(세부위치)

## WAREHOUSE_TRANSFER_RULES — 창고 간 이동 허용 규칙

## WAREHOUSES — 창고 마스터

## WIP_MAT_STOCKS — 재공 자재 재고(설비 장착분)

## WIP_MAT_TRANSACTIONS — 재공 자재 트랜잭션

## WORK_CALENDAR_DAYS — 작업 캘린더 일자별 근무

## WORK_CALENDARS — 작업 캘린더(연 공정 단위)

## WORK_INSTRUCTIONS — 작업표준서(작업지시서) 마스터

## WORKER_MASTERS — 작업자 마스터
