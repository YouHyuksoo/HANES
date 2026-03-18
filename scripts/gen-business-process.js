/**
 * @file scripts/gen-business-process.js
 * @description HANES MES 업무프로세스정의서 Word 문서 생성 (프로세스 단위 상세 기술)
 *
 * 초보자 가이드:
 * 1. 실행: node scripts/gen-business-process.js
 * 2. 출력: docs/deliverables/all/업무프로세스정의서_YYYY-MM-DD.docx
 * 3. 각 프로세스별 개요/처리흐름/관련화면·API·테이블/업무규칙 상세 기술
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  TableOfContents, LevelFormat,
} = require("docx");

const today = new Date().toISOString().slice(0, 10);
const FONT = "맑은 고딕";
const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const hdrFill = { fill: "1F4E79", type: ShadingType.CLEAR };
const subFill = { fill: "D6E4F0", type: ShadingType.CLEAR };
const lightFill = { fill: "F2F7FB", type: ShadingType.CLEAR };
const cm = { top: 50, bottom: 50, left: 80, right: 80 };
const PAGE_W = 11906; const PAGE_H = 16838; const MARGIN = 1100;
const CW = PAGE_W - MARGIN * 2;

// ── 헬퍼 ──
function hC(t, w, s) { return new TableCell({ borders, width:{size:w,type:WidthType.DXA}, shading:hdrFill, margins:cm, verticalAlign:VerticalAlign.CENTER, children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:t,bold:true,color:"FFFFFF",font:FONT,size:s||16})]})] }); }
function dC(t, w, o={}) { return new TableCell({ borders, width:{size:w,type:WidthType.DXA}, margins:cm, shading:o.sh, children:[new Paragraph({alignment:o.c?AlignmentType.CENTER:AlignmentType.LEFT,children:[new TextRun({text:String(t),font:FONT,size:o.s||16,...(o.r||{})})]})] }); }
function lC(t, w) { return new TableCell({ borders, width:{size:w,type:WidthType.DXA}, shading:subFill, margins:cm, children:[new Paragraph({children:[new TextRun({text:t,bold:true,font:FONT,size:16})]})] }); }
function txt(text, opts={}) { return new Paragraph({ spacing:{after:opts.after||100}, children:[new TextRun({text,font:FONT,size:opts.size||20,...(opts.run||{})})] }); }

// 프로세스 개요 카드 (2열 테이블)
function overviewCard(data) {
  const lw = 1800; const rw = CW - lw;
  return new Table({ width:{size:CW,type:WidthType.DXA}, columnWidths:[lw,rw],
    rows: data.map(([label, value]) => new TableRow({ children:[
      lC(label, lw), dC(value, rw, { s: 17 }),
    ]})),
  });
}

// ═══════════════════════════════════════════════════════════════
// 프로세스 데이터 (각 프로세스별 상세)
// ═══════════════════════════════════════════════════════════════
const modules = [
  // ═══ 기준정보관리 ═══
  { name: "기준정보관리", code: "MST", processes: [
    {
      id: "TB-MST-01", name: "품목/BOM/라우팅 관리",
      asIs: { id: "AS-MST-01", desc: "Excel 품목대장 관리, 수기 BOM 작성, 변경 시 수동 갱신", problem: "버전관리 불가, 변경이력 미관리, 중복등록 우려, 공정라우팅 연결 불가" },
      overview: "거래처로부터 공급받는 원자재, 공정 중 발생하는 반제품, 최종 완제품의 품목 정보를 시스템으로 일원화 관리한다. 각 품목에 대한 BOM(자재명세서)을 등록하고, 생산에 필요한 공정순서(라우팅)를 정의하여 작업지시 및 자재 자동출고의 기반 데이터를 구축한다.",
      dept: "생산기술팀", method: "MES 시스템",
      screens: ["품목관리", "BOM관리", "라우팅관리", "공정관리", "생산라인관리"],
      apis: ["GET/POST/PUT/DELETE master/parts", "GET/POST/PUT/DELETE master/boms", "GET/POST/PUT/DELETE master/routings", "GET/POST master/routing-groups", "GET/POST master/processes"],
      tables: ["ITEM_MASTERS", "BOM_MASTERS", "PROCESS_MASTERS", "PROCESS_MAPS", "ROUTING_GROUPS", "PROD_LINE_MASTERS"],
      flow: [
        { step: 1, actor: "생산기술", screen: "품목관리", action: "품목 신규 등록 (품번, 품명, 규격, 유형, 단위, IQC기준)", table: "ITEM_MASTERS", note: "ERP 품목 동기화 가능" },
        { step: 2, actor: "생산기술", screen: "공정관리", action: "공정 마스터 등록 (공정코드, 공정명, 공정유형)", table: "PROCESS_MASTERS", note: "공통코드 PROCESS_TYPE" },
        { step: 3, actor: "생산기술", screen: "BOM관리", action: "부모품목 선택 → 자품목 추가 → 소요수량/단위 설정", table: "BOM_MASTERS", note: "다단계 BOM 지원" },
        { step: 4, actor: "생산기술", screen: "라우팅관리", action: "품목별 공정순서 정의 → 설비/표준시간 설정 → 품질조건 등록", table: "PROCESS_MAPS, ROUTING_GROUPS", note: "라우팅그룹 재사용 가능" },
      ],
      rules: [
        "품번(ITEM_CD)은 시스템 내 유일해야 하며, ERP 품번과 동일하게 유지한다",
        "BOM은 부모-자품목 관계로 다단계 구성이 가능하며, 순환참조를 허용하지 않는다",
        "라우팅그룹을 활용하여 동일 공정순서를 여러 품목에 재사용할 수 있다",
        "품목 유형(PART_TYPE)은 공통코드로 관리하며, 원자재/반제품/완제품을 구분한다",
      ],
    },
    {
      id: "TB-MST-02", name: "거래처/작업자/창고 관리",
      asIs: { id: "AS-MST-02", desc: "Excel 거래처 대장, 수기 작업자 명부 관리", problem: "변경 미반영, 중복 데이터, 검색 어려움" },
      overview: "자재 공급 거래처, 생산 현장 작업자, 자재/제품 보관 창고 정보를 체계적으로 관리한다. 작업자에게는 QR코드를 부여하여 현장에서 빠르게 식별하고, 창고는 위치(Location) 단위까지 관리하여 정확한 재고 위치 추적을 가능하게 한다.",
      dept: "관리팀 / 자재팀", method: "MES 시스템",
      screens: ["거래처관리", "작업자관리", "창고관리"],
      apis: ["master/partners", "master/workers", "inventory/warehouse-locations"],
      tables: ["PARTNER_MASTERS", "WORKER_MASTERS", "WAREHOUSES", "WAREHOUSE_LOCATIONS"],
      flow: [
        { step: 1, actor: "관리담당", screen: "거래처관리", action: "거래처 등록 (코드, 명칭, 유형, 연락처, 사업자번호)", table: "PARTNER_MASTERS", note: "공급사/고객사 구분" },
        { step: 2, actor: "관리담당", screen: "작업자관리", action: "작업자 등록 → QR코드 자동생성 → 유형/부서 지정", table: "WORKER_MASTERS", note: "사진 업로드 가능" },
        { step: 3, actor: "자재담당", screen: "창고관리", action: "창고 등록 → 위치(Location) 정의 → 자재/제품 구분", table: "WAREHOUSES, WAREHOUSE_LOCATIONS", note: "계층 구조" },
      ],
      rules: [
        "거래처코드는 시스템 내 유일하며, 공급사/고객사/외주처를 유형으로 구분한다",
        "작업자 QR코드는 자동생성되며, PDA에서 스캔하여 작업자를 식별한다",
        "창고-위치는 계층 구조이며, 재고 이동 시 위치 단위로 추적한다",
      ],
    },
    {
      id: "TB-MST-03", name: "설비/금형/계측기 마스터 관리",
      asIs: { id: "AS-MST-03", desc: "수기 설비대장, 금형 수동 카운트", problem: "실시간 상태 파악 불가, 수명 관리 어려움" },
      overview: "생산에 사용되는 설비, 금형, 계측기 정보를 등록하고, 각각의 특성에 맞는 관리 체계를 적용한다. 설비는 가동상태를 실시간 관리하고, 금형은 타수(사용횟수) 기반 수명을 관리하며, 계측기는 교정주기를 관리하여 만료 전 알림을 제공한다.",
      dept: "보전팀", method: "MES 시스템",
      screens: ["설비마스터", "금형관리", "계측기마스터", "계측기교정관리"],
      apis: ["equipment/equips", "molds", "quality/msa/gauges", "quality/msa/calibrations"],
      tables: ["EQUIP_MASTERS", "MOLD_MASTERS", "GAUGE_MASTERS", "CALIBRATION_LOGS"],
      flow: [
        { step: 1, actor: "보전담당", screen: "설비마스터", action: "설비 등록 (코드, 명칭, 유형, 라인, 상태) → 설비BOM 등록", table: "EQUIP_MASTERS, EQUIP_BOM_ITEMS", note: "상태: 가동/정지/고장/보전" },
        { step: 2, actor: "보전담당", screen: "금형관리", action: "금형 등록 → 보증타수/한계타수 설정 → 타수 자동 카운트", table: "MOLD_MASTERS", note: "타수 경고 알림" },
        { step: 3, actor: "품질담당", screen: "계측기마스터", action: "계측기 등록 → 교정주기 설정 → 교정 실시 → 이력 관리", table: "GAUGE_MASTERS, CALIBRATION_LOGS", note: "만료 전 알림" },
      ],
      rules: [
        "설비 상태 변경 시 이력이 자동 기록되며, 가동현황 모니터링에 반영된다",
        "금형 보증타수 도달 시 경고, 한계타수 도달 시 자동 사용중지를 권고한다",
        "계측기 교정 만료 시 자동 상태 변경 및 관련 담당자에게 알림을 발송한다",
      ],
    },
  ]},

  // ═══ 자재관리 ═══
  { name: "자재관리", code: "MAT", processes: [
    {
      id: "TB-MAT-01", name: "입하/입고 관리",
      asIs: { id: "AS-MAT-01", desc: "거래처 납품 → 수기 입고대장 기록 → Excel 재고 갱신", problem: "수기 오류 빈번, 실시간 추적 불가, 바코드 미사용" },
      overview: "거래처로부터 자재가 도착(입하)하면 PO(구매발주) 기반으로 입하 등록 후, 바코드 라벨(matUid)을 발행한다. IQC(수입검사) 합격 후 입고를 확정하면 재고가 자동으로 반영된다. PDA를 통한 모바일 입고도 지원한다.",
      dept: "자재팀", method: "MES + PDA",
      screens: ["입하관리", "입고라벨발행", "자재입고관리", "입고이력조회", "PDA 자재입고"],
      apis: ["POST material/arrivals/po (PO기반 입하)", "POST material/arrivals/manual (수동 입하)", "POST material/receive-label (라벨발행/matUid생성)", "POST material/receiving/auto-receive (입고확정)", "GET material/arrivals (입하이력)"],
      tables: ["PURCHASE_ORDERS", "PURCHASE_ORDER_ITEMS", "MAT_ARRIVALS", "MAT_STOCKS", "MAT_RECEIVINGS", "STOCK_TRANSACTIONS"],
      flow: [
        { step: 1, actor: "자재담당", screen: "입하관리", action: "PO 목록에서 입하 가능 PO 선택 → 입하수량 입력 → 입하 등록", table: "MAT_ARRIVALS", note: "PO 없이 수동입하 가능" },
        { step: 2, actor: "자재담당", screen: "입고라벨발행", action: "입하된 자재 선택 → 바코드 라벨 발행 (matUid 자동 생성)", table: "MAT_STOCKS", note: "ZPL 프린터로 출력" },
        { step: 3, actor: "품질담당", screen: "수입검사(IQC)", action: "IQC 대기 자재 검사 → 합격/불합격/조건부 판정", table: "IQC_ITEM_MASTERS", note: "무검사 설정 시 자동합격" },
        { step: 4, actor: "자재담당", screen: "자재입고관리", action: "IQC 합격 자재 선택 → 입고 확정 → 창고/위치 지정", table: "MAT_RECEIVINGS", note: "일괄 입고 지원" },
        { step: 5, actor: "시스템", screen: "자동처리", action: "재고 자동 증가 + 수불이력(STOCK_TRANSACTIONS) 자동 생성", table: "MAT_STOCKS, STOCK_TRANSACTIONS", note: "실시간 반영" },
      ],
      rules: [
        "입하 시 PO 잔량을 초과하는 수량은 등록할 수 없다 (초과입하 방지)",
        "matUid는 자재의 고유 바코드로, 입고부터 출고까지 전 과정을 추적하는 핵심 키이다",
        "IQC 불합격 자재는 입고가 차단되며, 반품 또는 특채 프로세스로 전환된다",
        "입고 확정 시 재고와 수불이력이 동시에 생성되며, 트랜잭션으로 보장된다",
        "입고 취소(역분개) 시 재고가 원복되며, 취소 사유가 기록된다",
      ],
    },
    {
      id: "TB-MAT-02", name: "수입검사(IQC)",
      asIs: { id: "AS-MAT-02", desc: "입고자재 검사 → 수기 검사성적서 작성", problem: "검사 누락, 이력 관리 어려움, 기준 불명확" },
      overview: "입하된 자재에 대해 품목-거래처별로 정의된 검사기준에 따라 수입검사를 실시한다. 검사항목별로 육안/계측 판정을 수행하고, 결과에 따라 합격(입고 진행), 불합격(반품/폐기), 조건부합격(특채)으로 분류한다.",
      dept: "품질팀", method: "MES 시스템",
      screens: ["IQC검사항목/그룹 관리", "수입검사(IQC)", "수입검사이력조회"],
      apis: ["master/iqc-items", "master/iqc-groups", "master/iqc-item-pool", "material/iqc-history"],
      tables: ["IQC_ITEM_MASTERS", "IQC_GROUPS", "IQC_GROUP_ITEMS", "IQC_ITEM_POOL", "MAT_STOCKS"],
      flow: [
        { step: 1, actor: "품질담당", screen: "IQC검사항목관리", action: "품목-거래처별 검사항목 등록 (전수/샘플/무검사, 항목별 기준)", table: "IQC_ITEM_MASTERS", note: "검사그룹 재사용" },
        { step: 2, actor: "품질담당", screen: "수입검사(IQC)", action: "IQC 대기 목록에서 자재 선택 → 항목별 측정값 입력", table: "MAT_STOCKS", note: "무검사 시 자동합격" },
        { step: 3, actor: "품질담당", screen: "수입검사(IQC)", action: "전체 합격/불합격/조건부 판정 → 판정 확정", table: "MAT_STOCKS", note: "불합격 시 입고 차단" },
        { step: 4, actor: "품질담당", screen: "수입검사이력조회", action: "검사 결과 이력 조회/검색/엑셀 다운로드", table: "MAT_STOCKS", note: "기간/품목/결과별 필터" },
      ],
      rules: [
        "검사형태는 전수검사, 샘플검사, 무검사 3종이며 품목-거래처별로 설정한다",
        "무검사 설정 시 입하와 동시에 자동 합격 처리되어 즉시 입고 가능하다",
        "검사항목은 항목풀(IQC_ITEM_POOL)에서 선택하여 구성하며, 그룹으로 묶어 재사용한다",
        "불합격 판정 시 해당 자재는 입고가 차단되며, 반품/폐기/특채 결정을 기다린다",
      ],
    },
    {
      id: "TB-MAT-03", name: "재고/LOT 관리",
      asIs: { id: "AS-MAT-03", desc: "월 1회 재고실사 → Excel 갱신", problem: "실시간 재고 불일치, 수불 추적 불가, LOT 미관리" },
      overview: "자재의 입고/출고/이동/조정 등 모든 재고 변동을 실시간으로 추적하고, LOT 단위로 관리한다. 재고실사는 PDA를 활용하여 현장에서 직접 수행하고, 차이 발생 시 재고보정 프로세스(승인 포함)를 통해 조정한다.",
      dept: "자재팀", method: "MES + PDA",
      screens: ["자재재고현황조회", "자재수불이력조회", "LOT관리", "자재재고실사관리", "재고보정처리", "자재분할관리", "자재병합관리", "자재유수명관리", "자재폐기처리", "기타입고관리"],
      apis: ["material/stocks", "inventory/transaction", "material/lots", "material/physical-inv", "material/adjustment", "material/lot-split", "material/lot-merge", "material/shelf-life", "material/scrap", "material/misc-receipt"],
      tables: ["MAT_STOCKS", "STOCK_TRANSACTIONS", "INV_ADJ_LOGS"],
      flow: [
        { step: 1, actor: "자재담당", screen: "자재재고현황", action: "품목/창고/위치별 실시간 재고 조회", table: "MAT_STOCKS", note: "가용재고(IQC합격) 구분" },
        { step: 2, actor: "자재담당", screen: "수불이력조회", action: "기간별 입고/출고/이동/조정 이력 조회", table: "STOCK_TRANSACTIONS", note: "거래유형별 필터" },
        { step: 3, actor: "자재담당(PDA)", screen: "PDA 자재실사", action: "실사 세션 시작 → 바코드 스캔 카운팅 → 실사 완료", table: "MAT_STOCKS", note: "차이 자동 계산" },
        { step: 4, actor: "자재담당", screen: "재고보정처리", action: "실사 차이 확인 → 보정 등록 → 승인 → 재고 반영", table: "INV_ADJ_LOGS, MAT_STOCKS", note: "PDA는 승인대기" },
        { step: 5, actor: "자재담당", screen: "LOT관리/분할/병합", action: "LOT 분할(1→N) 또는 병합(N→1) 처리", table: "MAT_STOCKS", note: "추적성 유지" },
      ],
      rules: [
        "모든 재고 변동은 STOCK_TRANSACTIONS에 이력으로 기록되며, 삭제 불가하다",
        "재고보정은 PC에서 즉시승인, PDA에서는 승인대기 후 관리자 승인이 필요하다",
        "유수명(Shelf Life) 만료 자재는 경고 표시되며, 출고 시 주의 알림을 제공한다",
        "LOT 분할/병합 시 원본 LOT과의 추적성이 유지된다",
        "홀드(Hold) 처리된 자재는 출고가 차단되며, 해제 시까지 사용할 수 없다",
      ],
    },
    {
      id: "TB-MAT-04", name: "출고/출고요청 관리",
      asIs: { id: "AS-MAT-04", desc: "생산현장 요청 → 수기 출고전표 → Excel 차감", problem: "선입선출 미준수, 출고 누락, 수량 오류" },
      overview: "생산현장에서 필요한 자재를 출고요청하고, 자재팀이 승인 후 바코드 스캔으로 출고한다. FIFO(선입선출) 원칙이 자동 적용되어 오래된 자재부터 출고되며, 작업지시 연계 시 BOM 기반 자동출고도 지원한다.",
      dept: "자재팀 / 생산팀", method: "MES + PDA",
      screens: ["출고요청관리", "자재출고관리", "PDA 자재출고"],
      apis: ["material/issue-requests", "material/issues/scan"],
      tables: ["MAT_ISSUE_REQUESTS", "MAT_ISSUE_REQUEST_ITEMS", "MAT_ISSUES", "MAT_STOCKS", "STOCK_TRANSACTIONS"],
      flow: [
        { step: 1, actor: "현장담당", screen: "출고요청관리", action: "필요 자재/수량 선택 → 출고요청 등록", table: "MAT_ISSUE_REQUESTS", note: "작업지시 연계 가능" },
        { step: 2, actor: "자재담당", screen: "출고요청관리", action: "출고요청 확인 → 승인/반려", table: "MAT_ISSUE_REQUESTS", note: "승인 프로세스" },
        { step: 3, actor: "자재담당", screen: "자재출고관리/PDA", action: "승인된 요청 → 바코드 스캔 출고 (FIFO 자동적용)", table: "MAT_ISSUES, STOCK_TRANSACTIONS", note: "재고 자동 차감" },
        { step: 4, actor: "시스템", screen: "자동(작업지시 연계)", action: "작업지시 시작 시 BOM 기반 자동출고 (설정 시)", table: "MAT_ISSUES", note: "AutoIssueService" },
      ],
      rules: [
        "출고 시 FIFO(선입선출) 원칙이 자동 적용되어, 입고일이 빠른 LOT부터 출고된다",
        "출고가능 재고는 IQC 합격이며 홀드 상태가 아닌 자재만 해당된다",
        "작업지시 자동출고 설정 시, 작업 시작과 동시에 BOM 소요량만큼 자동 출고된다",
        "출고유형(ISSUE_TYPE)은 공통코드로 관리하며, 생산출고/샘플/폐기 등을 구분한다",
      ],
    },
  ]},

  // ═══ 생산관리 ═══
  { name: "생산관리", code: "PRD", processes: [
    {
      id: "TB-PRD-01", name: "생산계획/작업지시 관리",
      asIs: { id: "AS-PRD-01", desc: "수기 작업지시서 작성 → 현장 배포, Excel 생산계획", problem: "배포 지연, 변경 추적 불가, 계획 대비 실적 비교 어려움" },
      overview: "월간 생산계획을 수립하고, 이를 기반으로 작업지시를 생성한다. ERP에서 작업지시를 수신할 수도 있으며, 각 작업지시는 시작/일시중지/재개/완료/취소 등의 상태 관리가 가능하다. 작업지시 시작 시 BOM 기반 자재 자동출고가 연계된다.",
      dept: "생산관리팀", method: "MES 시스템",
      screens: ["월간생산계획", "작업지시관리", "작업지시현황조회"],
      apis: ["production/prod-plans", "production/job-orders", "production/progress"],
      tables: ["PROD_PLANS", "JOB_ORDERS"],
      flow: [
        { step: 1, actor: "생산관리", screen: "월간생산계획", action: "월간 생산 목표 수량/일정 등록 → 확정", table: "PROD_PLANS", note: "계획/확정/진행/마감" },
        { step: 2, actor: "생산관리", screen: "작업지시관리", action: "계획 기반 작업지시 생성 → 품목/수량/라인/설비 지정", table: "JOB_ORDERS", note: "ERP 수신도 가능" },
        { step: 3, actor: "생산관리", screen: "작업지시관리", action: "작업지시 시작 → (자재 자동출고) → 현장 작업 시작", table: "JOB_ORDERS, MAT_ISSUES", note: "상태: 시작" },
        { step: 4, actor: "생산관리", screen: "작업지시현황", action: "진행률/양품/불량 실시간 모니터링", table: "JOB_ORDERS, PROD_RESULTS", note: "대시보드 연동" },
        { step: 5, actor: "생산관리", screen: "작업지시관리", action: "작업 완료 처리 → ERP 실적 전송", table: "JOB_ORDERS, INTER_LOGS", note: "자동/수동 전송" },
      ],
      rules: [
        "작업지시 상태: 대기→시작→(일시중지↔재개)→완료/취소의 워크플로우를 따른다",
        "완료된 작업지시는 수정/삭제할 수 없으며, 이력으로만 조회 가능하다",
        "ERP 연동 시 작업지시 번호는 ERP 기준을 사용하며, MES에서 자동 매핑한다",
      ],
    },
    {
      id: "TB-PRD-02", name: "생산실적 입력/조회",
      asIs: { id: "AS-PRD-02", desc: "수기 생산일보 작성 → 월말 집계", problem: "실시간 실적 파악 불가, 집계 오류, 작업자별 실적 미관리" },
      overview: "현장 작업자가 4가지 입력방식(수작업/가공/단순검사/검사장비) 중 공정 특성에 맞는 방식으로 생산실적을 입력한다. 양품/불량 수량과 작업시간을 기록하고, 완제품에는 제품라벨(prdUid)을 발행한다.",
      dept: "생산팀", method: "MES 시스템",
      screens: ["실적입력(수작업)", "실적입력(가공)", "실적입력(단순검사)", "실적입력(검사장비)", "생산실적조회", "작업실적통합조회", "포장실적조회", "반제품/제품재고조회"],
      apis: ["production/prod-results", "production/product-label", "production/progress", "production/pack-result", "production/wip-stock"],
      tables: ["PROD_RESULTS", "FG_LABELS", "PRODUCT_STOCKS"],
      flow: [
        { step: 1, actor: "작업자", screen: "실적입력(4종 중 택1)", action: "작업지시 선택 → 양품/불량 수량 입력 → 작업자/설비 기록", table: "PROD_RESULTS", note: "공정유형별 화면" },
        { step: 2, actor: "작업자", screen: "실적입력", action: "완제품인 경우 제품라벨(FG Label) 발행 (prdUid 자동생성)", table: "FG_LABELS, PRODUCT_STOCKS", note: "바코드 라벨" },
        { step: 3, actor: "시스템", screen: "자동처리", action: "실적 등록 시 제품재고 자동 증가 + 불량 자동 집계", table: "PRODUCT_STOCKS, DEFECT_LOGS", note: "실시간 반영" },
        { step: 4, actor: "관리자", screen: "생산실적조회/통합조회", action: "작업지시별/설비별/작업자별/일별 실적 조회 및 분석", table: "PROD_RESULTS", note: "다차원 요약" },
      ],
      rules: [
        "4가지 입력방식: 수작업(단순수량), 가공(설비연동), 단순검사(양불판정), 검사장비(장비자동)",
        "생산실적 등록 시 불량수량이 있으면 DEFECT_LOGS에 자동으로 불량이 기록된다",
        "제품라벨(prdUid)은 완제품의 고유 바코드로, 포장/출하까지 추적하는 핵심 키이다",
        "실적 수정은 당일에 한하여 가능하며, 수정 시 이력이 기록된다",
      ],
    },
    {
      id: "TB-PRD-03", name: "재작업/수리 관리",
      asIs: { id: "-", desc: "(신규 프로세스)", problem: "체계적 재작업 관리 부재" },
      overview: "불량 판정된 제품에 대해 재작업 지시를 발행하고, 공정별 재작업 실적을 기록한다. 품질팀과 생산팀의 이중 승인 프로세스를 거치며, 재작업 완료 후 재검사를 통해 양품 전환 여부를 판정한다.",
      dept: "생산팀 / 품질팀", method: "MES 시스템",
      screens: ["재작업 지시", "재작업 현황", "재작업 후 검사", "수리관리"],
      apis: ["quality/reworks", "production/repairs"],
      tables: ["REWORK_ORDERS", "REWORK_PROCESSES", "REWORK_RESULTS", "REWORK_INSPECTS"],
      flow: [
        { step: 1, actor: "품질담당", screen: "재작업 지시", action: "불량 제품 선택 → 재작업 지시 등록 → 공정 정의", table: "REWORK_ORDERS, REWORK_PROCESSES", note: "재작업 사유 필수" },
        { step: 2, actor: "품질/생산", screen: "재작업 지시", action: "품질승인 요청 → 품질팀 승인 → 생산팀 승인", table: "REWORK_ORDERS", note: "이중 승인" },
        { step: 3, actor: "작업자", screen: "재작업 지시", action: "공정별 재작업 실행 → 실적 기록 → 공정 완료", table: "REWORK_RESULTS", note: "공정 건너뛰기 가능" },
        { step: 4, actor: "품질담당", screen: "재작업 후 검사", action: "재작업 완료 제품 재검사 → 합격/불합격 판정", table: "REWORK_INSPECTS", note: "합격 시 양품 전환" },
      ],
      rules: [
        "재작업 지시는 품질팀 승인 → 생산팀 승인의 이중 승인을 거쳐야 작업이 시작된다",
        "재작업 공정은 원래 라우팅과 다를 수 있으며, 재작업 전용 공정을 정의할 수 있다",
        "재작업 후 재검사에서 불합격 시 폐기 또는 재재작업 결정이 필요하다",
      ],
    },
  ]},

  // ═══ 품질관리 ═══
  { name: "품질관리", code: "QC", processes: [
    {
      id: "TB-QC-01", name: "불량등록/통계 관리",
      asIs: { id: "AS-QC-01", desc: "불량 발생 시 수기 기록 → 월별 집계", problem: "유형별 통계 불가, 추적 어려움" },
      overview: "생산 중 발생하는 불량을 즉시 시스템에 등록하고, 유형별/일별/공정별 자동 통계를 제공한다. 불량 제품의 수리 이력도 함께 관리하여 불량 원인 분석의 기초 데이터를 축적한다.",
      dept: "품질팀", method: "MES 시스템",
      screens: ["불량등록관리"],
      apis: ["quality/defect-logs"],
      tables: ["DEFECT_LOGS"],
      flow: [
        { step: 1, actor: "작업자/품질", screen: "불량등록관리", action: "불량 발생 즉시 등록 (유형, 수량, 공정, 원인)", table: "DEFECT_LOGS", note: "생산실적 연계 자동등록도 가능" },
        { step: 2, actor: "품질담당", screen: "불량등록관리", action: "불량 상태 관리 (등록→조사→조치→종결)", table: "DEFECT_LOGS", note: "수리이력 연계" },
        { step: 3, actor: "관리자", screen: "불량등록관리", action: "유형별/상태별/일별 통계 조회 및 분석", table: "DEFECT_LOGS", note: "차트/그래프 제공" },
      ],
      rules: [
        "불량유형(VISUAL_DEFECT 등)은 공통코드로 관리하며, ComCodeBadge로 표시한다",
        "불량 상태: 등록→조사중→조치완료→종결의 워크플로우를 따른다",
        "생산실적 입력 시 불량수량이 있으면 자동으로 불량 로그가 생성된다",
      ],
    },
    {
      id: "TB-QC-02", name: "검사 관리 (외관/통전/샘플)",
      asIs: { id: "AS-QC-02", desc: "외관검사 수기 기록, 통전검사 수동 판정", problem: "시리얼별 이력 미관리, 장비 연동 불가" },
      overview: "제품의 품질을 확보하기 위한 3가지 검사 체계를 제공한다. 외관검사(육안), 통전검사(전기적 연결 확인, 와이어하네스 특화), 샘플검사(공정 중 주기적 품질 확인)를 시스템으로 관리하며, 통전검사는 장비 자동연동을 지원한다.",
      dept: "품질팀", method: "MES 시스템 + 검사장비",
      screens: ["외관검사", "통전검사관리", "통전검사이력", "검사기프로토콜", "샘플검사이력조회"],
      apis: ["quality/inspect-results", "quality/continuity-inspect", "production/sample-inspect-input"],
      tables: ["INSPECT_RESULTS", "SAMPLE_INSPECT_RESULTS", "FG_LABELS", "EQUIP_PROTOCOLS"],
      flow: [
        { step: 1, actor: "검사자", screen: "외관검사", action: "바코드(prdUid) 스캔 → 검사항목별 합/부 판정 → 결과 저장", table: "INSPECT_RESULTS", note: "시리얼별 이력" },
        { step: 2, actor: "검사자/장비", screen: "통전검사관리", action: "FG 바코드 스캔 → 통전검사 실행(수동/장비자동) → 합격/불합격", table: "FG_LABELS", note: "프로토콜 기반 장비연동" },
        { step: 3, actor: "검사자", screen: "샘플검사", action: "작업지시별 주기적 샘플 채취 → 항목별 측정/판정", table: "SAMPLE_INSPECT_RESULTS", note: "일괄 입력 지원" },
      ],
      rules: [
        "통전검사는 와이어하네스 제품의 전기적 연결 상태를 확인하는 특화 검사이다",
        "검사기 프로토콜은 장비별로 통신 설정(IP, 포트, 프로토콜)을 관리한다",
        "FG 라벨은 합격/불합격/재검사/취소 상태를 가지며, 출하 시 합격 상태만 허용된다",
      ],
    },
    {
      id: "TB-QC-03", name: "출하검사(OQC)",
      asIs: { id: "AS-QC-03", desc: "출하 전 샘플 검사 → 수기 판정", problem: "출하 전 검사 누락 위험" },
      overview: "출하 전 완제품의 최종 품질을 확인하는 출하검사(OQC)를 수행한다. 포장된 박스 단위로 OQC 의뢰를 생성하고, 샘플 검사 후 합격/불합격/조건부합격을 판정한다. OQC 불합격 시 출하가 차단된다.",
      dept: "품질팀", method: "MES 시스템",
      screens: ["출하검사(OQC)", "출하검사이력조회"],
      apis: ["quality/oqc"],
      tables: ["OQC_REQUESTS", "OQC_REQUEST_BOXES"],
      flow: [
        { step: 1, actor: "품질담당", screen: "출하검사(OQC)", action: "OQC 의뢰 생성 → 검사 대상 박스 선택", table: "OQC_REQUESTS, OQC_REQUEST_BOXES", note: "박스 단위 의뢰" },
        { step: 2, actor: "품질담당", screen: "출하검사(OQC)", action: "샘플 추출 → 검사 실행 → 합격/불합격/조건부 판정", table: "OQC_REQUESTS", note: "AQL 기준 적용" },
        { step: 3, actor: "품질담당", screen: "출하검사이력", action: "OQC 결과 이력 조회 및 통계", table: "OQC_REQUESTS", note: "기간/품목/결과 필터" },
      ],
      rules: [
        "OQC 불합격 시 해당 박스의 출하가 차단되며, 재검사 또는 재작업이 필요하다",
        "OQC 합격률이 기준치 미달 시 경고 알림을 발송한다",
      ],
    },
    {
      id: "TB-QC-04", name: "CAPA/변경점/클레임/심사 관리",
      asIs: { id: "-", desc: "(신규 프로세스)", problem: "체계적 품질 시스템 부재" },
      overview: "고객 클레임 접수 → 원인 조사 → CAPA(시정예방조치) 수립 → 실행 → 유효성 검증의 체계적 품질 관리 사이클을 운영한다. 제품/공정 변경 시 변경점관리 워크플로우를 적용하고, 내부심사를 통해 품질 시스템을 지속적으로 점검한다.",
      dept: "품질팀", method: "MES 시스템",
      screens: ["고객클레임", "CAPA관리", "변경점관리", "내부심사", "교육훈련"],
      apis: ["quality/complaints", "quality/capas", "quality/changes", "quality/audits", "trainings"],
      tables: ["CUSTOMER_COMPLAINTS", "CAPA_REQUESTS", "CAPA_ACTIONS", "CHANGE_ORDERS", "AUDIT_PLANS", "AUDIT_FINDINGS", "TRAINING_PLANS"],
      flow: [
        { step: 1, actor: "품질담당", screen: "고객클레임", action: "클레임 접수 → 조사 → 대응 → 해결 → 종료 (CAPA 연계)", table: "CUSTOMER_COMPLAINTS", note: "5단계 워크플로우" },
        { step: 2, actor: "품질담당", screen: "CAPA관리", action: "원인분석 → 조치계획 → 조치실행 → 유효성검증 → 종결", table: "CAPA_REQUESTS, CAPA_ACTIONS", note: "조치항목 N개" },
        { step: 3, actor: "품질담당", screen: "변경점관리", action: "변경요청 → 제출 → 검토 → 승인 → 시행 → 완료", table: "CHANGE_ORDERS", note: "6단계 워크플로우" },
        { step: 4, actor: "품질담당", screen: "내부심사", action: "심사계획 → 실시 → 발견사항 → CAPA 연계 → 종결", table: "AUDIT_PLANS, AUDIT_FINDINGS", note: "발견사항→CAPA" },
      ],
      rules: [
        "클레임 → CAPA 연계: 클레임에서 도출된 근본원인에 대해 CAPA를 자동 생성할 수 있다",
        "변경점관리는 6단계 승인 워크플로우(요청→제출→검토→승인→시행→완료)를 따른다",
        "내부심사 발견사항은 CAPA와 연계하여 시정조치를 추적할 수 있다",
        "IATF 16949 / ISO 9001 요구사항에 부합하는 프로세스 구조이다",
      ],
    },
    {
      id: "TB-QC-05", name: "SPC/관리계획서/PPAP/FAI",
      asIs: { id: "-", desc: "(신규 프로세스)", problem: "고급 품질관리 체계 부재" },
      overview: "통계적 공정관리(SPC), 관리계획서(CP), 양산부품승인절차(PPAP), 초물검사(FAI) 등 자동차/전장 업종에 필요한 고급 품질관리 체계를 제공한다.",
      dept: "품질팀", method: "MES 시스템",
      screens: ["SPC관리", "관리계획서", "PPAP관리", "초물검사", "추적성조회"],
      apis: ["quality/control-plans", "quality/ppap", "quality/fai"],
      tables: ["SPC_CHARTS", "SPC_DATA", "CONTROL_PLANS", "CONTROL_PLAN_ITEMS", "PPAP_SUBMISSIONS", "FAI_REQUESTS", "FAI_ITEMS"],
      flow: [
        { step: 1, actor: "품질담당", screen: "관리계획서", action: "품목별 공정 관리항목/기준/방법 정의 → 승인 → 개정 관리", table: "CONTROL_PLANS, CONTROL_PLAN_ITEMS", note: "IATF 16949" },
        { step: 2, actor: "품질담당", screen: "PPAP관리", action: "Level별 필수요소 등록 → 제출 → 고객 승인/반려", table: "PPAP_SUBMISSIONS", note: "Level 1~5" },
        { step: 3, actor: "품질담당", screen: "초물검사", action: "신규/변경 제품 첫 생산품 전수검사 → 항목별 판정 → 승인", table: "FAI_REQUESTS, FAI_ITEMS", note: "검사항목 N개" },
        { step: 4, actor: "품질담당", screen: "추적성조회", action: "원자재 LOT → 생산실적 → 검사 → 출하까지 정/역방향 추적", table: "전 테이블 연계", note: "End-to-End" },
      ],
      rules: [
        "관리계획서는 품목별 공정 관리기준의 최상위 문서이며, 개정 이력이 관리된다",
        "PPAP는 Level에 따라 필수 제출 요소가 달라지며, 완성률을 자동 계산한다",
        "초물검사(FAI)는 신규/변경 제품의 첫 생산품에 대한 의무 검사이다",
        "추적성 조회는 matUid(자재)→prdUid(제품)→FG Label→Box→Pallet→출하까지 연결한다",
      ],
    },
  ]},

  // ═══ 설비관리 ═══
  { name: "설비관리", code: "EQ", processes: [
    {
      id: "TB-EQ-01", name: "일상/정기점검 관리",
      asIs: { id: "AS-EQ-01", desc: "종이 체크리스트 기반 일상/정기점검", problem: "점검 누락, 이력 추적 불가" },
      overview: "설비별 점검항목을 마스터로 관리하고, 캘린더 기반으로 점검 일정을 자동 생성한다. 현장에서 PC 또는 PDA로 점검 결과를 입력하고, 이상 발견 시 즉시 조치를 기록한다.",
      dept: "보전팀", method: "MES + PDA",
      screens: ["점검항목마스터", "설비별점검항목", "일상점검캘린더", "일상점검결과", "정기점검캘린더", "정기점검결과", "점검이력조회", "PDA 설비일상점검"],
      apis: ["master/equip-inspect-items", "equipment/daily-inspect", "equipment/periodic-inspect", "equipment/inspect-history"],
      tables: ["EQUIP_INSPECT_LOGS", "EQUIP_MASTERS"],
      flow: [
        { step: 1, actor: "보전담당", screen: "점검항목마스터", action: "점검항목 등록 (항목명, 점검방법, 판정기준)", table: "EQUIP_INSPECT_LOGS", note: "항목풀 관리" },
        { step: 2, actor: "보전담당", screen: "설비별점검항목", action: "설비-점검항목 매핑 (일상/정기 구분, 주기 설정)", table: "EQUIP_INSPECT_LOGS", note: "" },
        { step: 3, actor: "시스템", screen: "캘린더", action: "주기에 따라 점검 일정 자동 생성 → 캘린더 표시", table: "-", note: "미점검 표시" },
        { step: 4, actor: "현장담당", screen: "점검결과/PDA", action: "점검항목별 양호/불량/조치필요 판정 → 결과 저장", table: "EQUIP_INSPECT_LOGS", note: "사진 첨부" },
      ],
      rules: [
        "일상점검은 매일 가동 전/후 실시하며, 정기점검은 주/월/분기 주기로 실시한다",
        "점검 결과가 '불량' 또는 '조치필요'인 경우, 조치 내용 기록이 필수이다",
        "점검 미실시 설비는 캘린더에 경고 표시되며, 관리자에게 알림이 발송된다",
      ],
    },
    {
      id: "TB-EQ-02", name: "예방보전(PM) 관리",
      asIs: { id: "AS-EQ-02", desc: "수기 보전일보 작성, 경험 기반 보전", problem: "계획적 보전 어려움, 돌발고장 빈번" },
      overview: "설비별 예방보전(PM) 계획을 주기적으로 수립하고, 계획에 따라 보전 작업지시를 자동 생성한다. 보전 실행 결과와 부품 교체 이력을 기록하여 설비 수명 관리의 기반을 구축한다.",
      dept: "보전팀", method: "MES 시스템",
      screens: ["PM계획", "PM캘린더", "PM보전결과"],
      apis: ["equipment/pm-plans", "equipment/pm-work-orders"],
      tables: ["PM_PLANS", "PM_PLAN_ITEMS", "PM_WORK_ORDERS", "PM_WO_RESULTS"],
      flow: [
        { step: 1, actor: "보전담당", screen: "PM계획", action: "설비별 PM 항목 등록 (유형, 주기, 담당자)", table: "PM_PLANS, PM_PLAN_ITEMS", note: "주기: 일/주/월/분기/년" },
        { step: 2, actor: "시스템", screen: "PM캘린더", action: "주기에 따라 PM 작업지시 자동 생성 → 캘린더 표시", table: "PM_WORK_ORDERS", note: "자동 생성" },
        { step: 3, actor: "보전담당", screen: "PM보전결과", action: "PM 작업 실행 → 결과/부품교체 기록 → 완료 처리", table: "PM_WO_RESULTS", note: "부품 사용 이력" },
      ],
      rules: [
        "PM 유형: 예방보전, 사후보전, 개량보전으로 구분한다 (공통코드 PM_TYPE)",
        "PM 주기 도래 시 자동으로 작업지시가 생성되며, 담당자에게 알림이 발송된다",
        "PM 미실시 시 설비 가동을 경고하며, 강제 중지 설정도 가능하다",
      ],
    },
  ]},

  // ═══ 출하관리 ═══
  { name: "출하관리", code: "SHP", processes: [
    {
      id: "TB-SHP-01", name: "포장/팔레트/출하 관리",
      asIs: { id: "AS-SHP-01", desc: "수기 출하전표 작성 → 수동 적재", problem: "포장/팔레트 추적 불가, 오출하 위험" },
      overview: "완제품을 박스 단위로 포장하고, 박스를 팔레트에 적재한 후 출하를 확정하는 전 과정을 바코드 기반으로 관리한다. OQC 검사와 연계하여 합격 제품만 출하되도록 보장하며, PDA를 통한 모바일 출하도 지원한다.",
      dept: "물류팀", method: "MES + PDA",
      screens: ["포장실적조회", "제품포장관리", "팔레트적재관리", "출하확정처리", "출하지시등록", "출하이력조회", "출하반품등록"],
      apis: ["shipping/boxes", "shipping/pallets", "shipping/shipments", "shipping/orders", "shipping/returns", "shipping/history"],
      tables: ["BOX_MASTERS", "PALLET_MASTERS", "SHIPMENT_LOGS", "SHIPMENT_ORDERS", "SHIPMENT_ORDER_ITEMS", "SHIPMENT_RETURNS", "PRODUCT_STOCKS"],
      flow: [
        { step: 1, actor: "포장담당", screen: "제품포장관리", action: "완제품(FG Label) 스캔 → 박스 포장 → 박스 바코드 발행", table: "BOX_MASTERS", note: "박스별 시리얼 관리" },
        { step: 2, actor: "포장담당", screen: "팔레트적재관리", action: "박스 스캔 → 팔레트 적재 → 팔레트 바코드 발행", table: "PALLET_MASTERS", note: "" },
        { step: 3, actor: "품질담당", screen: "출하검사(OQC)", action: "OQC 의뢰 → 샘플 검사 → 합격/불합격 판정", table: "OQC_REQUESTS", note: "불합격 시 출하 차단" },
        { step: 4, actor: "영업담당", screen: "출하지시등록", action: "고객PO 기반 출하지시 생성 (품목, 수량, 납기)", table: "SHIPMENT_ORDERS", note: "" },
        { step: 5, actor: "물류담당", screen: "출하확정처리", action: "팔레트 선택 → 출하 확정 → 제품재고 자동 차감", table: "SHIPMENT_LOGS, PRODUCT_STOCKS", note: "재고 즉시 차감" },
        { step: 6, actor: "물류담당", screen: "출하이력조회", action: "기간/고객/품목별 출하 이력 및 통계 조회", table: "SHIPMENT_LOGS", note: "" },
      ],
      rules: [
        "출하 확정 시 OQC 합격 상태인 박스/팔레트만 출하할 수 있다",
        "출하 확정 시 제품재고(PRODUCT_STOCKS)가 자동으로 차감된다",
        "반품 접수 시 제품재고가 원복되며, 반품 사유와 품목/수량이 기록된다",
        "FG Label → Box → Pallet → 출하의 계층 구조로 추적이 가능하다",
      ],
    },
    {
      id: "TB-SHP-02", name: "고객발주 관리",
      asIs: { id: "-", desc: "(신규 프로세스)", problem: "고객발주 체계적 관리 부재" },
      overview: "고객으로부터 수주한 발주(Customer PO)를 시스템에 등록하고, 발주 대비 출하 현황을 추적한다. 출하지시와 연계하여 발주 잔량 관리를 자동화한다.",
      dept: "영업팀", method: "MES 시스템",
      screens: ["고객발주관리", "고객발주현황조회"],
      apis: ["shipping/customer-orders"],
      tables: ["CUSTOMER_ORDERS", "CUSTOMER_ORDER_ITEMS"],
      flow: [
        { step: 1, actor: "영업담당", screen: "고객발주관리", action: "고객PO 등록 (고객, 품목, 수량, 납기, 단가)", table: "CUSTOMER_ORDERS, CUSTOMER_ORDER_ITEMS", note: "" },
        { step: 2, actor: "영업담당", screen: "고객발주현황", action: "발주 대비 출하 진행률 조회 → 잔량 확인", table: "CUSTOMER_ORDERS", note: "출하 연계 자동 갱신" },
      ],
      rules: [
        "고객발주 잔량이 출하지시 생성 시 참조되어 과출하를 방지한다",
        "발주 상태: 등록→확정→출하중→출하완료→마감의 라이프사이클을 따른다",
      ],
    },
  ]},

  // ═══ 보세/소모품/외주 ═══
  { name: "보세/소모품/외주관리", code: "ETC", processes: [
    {
      id: "TB-CUS-01", name: "보세 수입/사용신고 관리",
      asIs: { id: "AS-CUS-01", desc: "수기 보세대장 관리", problem: "관리 복잡, 누락 위험" },
      overview: "관세 미납 상태의 수입 자재(보세자재)에 대한 수입신고, 보세자재 LOT 관리, 사용신고를 시스템으로 관리한다.",
      dept: "관리팀", method: "MES 시스템",
      screens: ["수입신고관리", "보세재고조회", "사용신고관리"],
      apis: ["customs"],
      tables: ["CUSTOMS_ENTRIES", "CUSTOMS_LOTS", "CUSTOMS_USAGE_REPORTS"],
      flow: [
        { step: 1, actor: "관리담당", screen: "수입신고관리", action: "수입신고 등록 (신고번호, 자재, 수량, 관세)", table: "CUSTOMS_ENTRIES", note: "" },
        { step: 2, actor: "관리담당", screen: "보세재고조회", action: "보세자재 LOT별 재고 현황 조회", table: "CUSTOMS_LOTS", note: "일반재고와 분리" },
        { step: 3, actor: "관리담당", screen: "사용신고관리", action: "보세자재 사용 시 사용신고 등록 → 제출", table: "CUSTOMS_USAGE_REPORTS", note: "" },
      ],
      rules: ["보세자재는 일반자재와 분리 관리되며, 사용 시 반드시 사용신고를 등록해야 한다"],
    },
    {
      id: "TB-CON-01", name: "소모품 관리",
      asIs: { id: "AS-CON-01", desc: "수기 소모품 대장 관리", problem: "수명/교체시기 관리 불가" },
      overview: "생산에 사용되는 소모품(공구, 블레이드, 지그 등)의 입출고 및 타수(사용횟수) 기반 수명을 관리한다. 교체 시기 도래 시 자동 알림을 제공한다.",
      dept: "보전팀", method: "MES 시스템",
      screens: ["소모품관리", "소모품라벨발행", "소모품입고", "소모품출고", "소모품재고현황", "소모품수명현황"],
      apis: ["consumables"],
      tables: ["CONSUMABLE_MASTERS", "CONSUMABLE_STOCKS"],
      flow: [
        { step: 1, actor: "보전담당", screen: "소모품관리", action: "소모품 마스터 등록 (유형, 보증타수, 한계타수)", table: "CONSUMABLE_MASTERS", note: "이미지 업로드" },
        { step: 2, actor: "보전담당", screen: "소모품라벨발행", action: "개별 인스턴스 라벨 발행 (conUid 생성)", table: "CONSUMABLE_STOCKS", note: "바코드 관리" },
        { step: 3, actor: "보전담당", screen: "입고/출고", action: "소모품 입출고 이력 등록", table: "CONSUMABLE_STOCKS", note: "재고 자동 계산" },
        { step: 4, actor: "시스템", screen: "수명현황", action: "타수 기반 수명 모니터링 → 교체경고 알림", table: "CONSUMABLE_STOCKS", note: "보증타수/한계타수" },
      ],
      rules: ["소모품 보증타수 도달 시 경고, 한계타수 도달 시 교체 권고 알림을 발송한다"],
    },
    {
      id: "TB-OUT-01", name: "외주 관리",
      asIs: { id: "AS-OUT-01", desc: "수기 외주 발주서 작성", problem: "진행현황 파악 어려움" },
      overview: "자사 공정 일부를 외부 업체에 위탁하는 외주 프로세스를 관리한다. 외주처 등록 → 발주 → 자재출고 → 외주입고의 전 과정을 시스템으로 추적한다.",
      dept: "구매팀", method: "MES 시스템",
      screens: ["외주처관리", "외주발주관리", "외주입고관리"],
      apis: ["outsourcing"],
      tables: ["VENDOR_MASTERS", "SUBCON_ORDERS", "SUBCON_DELIVERIES", "SUBCON_RECEIVES"],
      flow: [
        { step: 1, actor: "구매담당", screen: "외주처관리", action: "외주처 등록 (업체정보, 가공 가능 공정)", table: "VENDOR_MASTERS", note: "" },
        { step: 2, actor: "구매담당", screen: "외주발주관리", action: "외주발주 등록 (품목, 수량, 납기, 단가)", table: "SUBCON_ORDERS", note: "" },
        { step: 3, actor: "자재담당", screen: "외주발주관리", action: "발주 기반 외주처 자재출고", table: "SUBCON_DELIVERIES", note: "재고 차감" },
        { step: 4, actor: "자재담당", screen: "외주입고관리", action: "외주 가공 완료품 입고 → 재고 반영", table: "SUBCON_RECEIVES", note: "IQC 연계 가능" },
      ],
      rules: ["외주발주 취소 시 이미 출고된 자재가 있으면 반입 처리가 선행되어야 한다"],
    },
  ]},

  // ═══ 인터페이스/시스템 ═══
  { name: "인터페이스/시스템관리", code: "SYS", processes: [
    {
      id: "TB-IF-01", name: "ERP 연동 관리",
      asIs: { id: "AS-IF-01", desc: "ERP 데이터 수동 입력, 이중 작업", problem: "이중입력, 동기화 지연, 오류" },
      overview: "ERP와 MES 간 데이터를 API 기반으로 자동 연동한다. Inbound(ERP→MES): 작업지시/BOM/품목 수신, Outbound(MES→ERP): 생산실적 전송. 실패 시 재시도 및 수동전송을 지원하며, 전체 전송 이력을 관리한다.",
      dept: "IT팀", method: "MES 시스템 (API)",
      screens: ["ERP연동현황조회", "전송이력조회", "수동전송처리"],
      apis: ["interface/inbound/job-order", "interface/inbound/bom", "interface/inbound/part", "interface/outbound/prod-result", "interface/logs"],
      tables: ["INTER_LOGS"],
      flow: [
        { step: 1, actor: "시스템(스케줄러)", screen: "자동", action: "ERP → MES 작업지시 수신 (주기적 폴링 또는 이벤트)", table: "JOB_ORDERS, INTER_LOGS", note: "Inbound" },
        { step: 2, actor: "시스템(스케줄러)", screen: "자동", action: "ERP → MES BOM/품목 마스터 동기화", table: "BOM_MASTERS, ITEM_MASTERS, INTER_LOGS", note: "Inbound" },
        { step: 3, actor: "시스템/수동", screen: "자동/수동전송", action: "MES → ERP 생산실적 전송", table: "INTER_LOGS", note: "Outbound" },
        { step: 4, actor: "IT담당", screen: "전송이력조회", action: "전송 성공/실패 이력 조회 → 실패 건 재시도", table: "INTER_LOGS", note: "일괄 재시도" },
      ],
      rules: [
        "모든 전송은 INTER_LOGS에 이력이 기록되며, 성공/실패/재시도 상태를 추적한다",
        "실패 건은 자동 재시도(설정 횟수)하며, 최종 실패 시 수동전송으로 처리한다",
        "ERP 연동 현황 대시보드에서 실시간 성공률과 실패 건수를 모니터링한다",
      ],
    },
    {
      id: "TB-SYS-01", name: "RBAC/사용자/스케줄러/PDA 관리",
      asIs: { id: "AS-SYS-01", desc: "공유 계정 사용, 권한 구분 없음", problem: "보안 취약, 감사추적 불가" },
      overview: "역할 기반 접근제어(RBAC)를 통해 사용자별 메뉴 접근 권한을 관리한다. 활동 로그로 감사 추적을 지원하며, 스케줄러로 배치 작업을 관리하고, PDA 앱을 위한 별도 역할 체계를 운영한다.",
      dept: "IT팀 / 관리팀", method: "MES 시스템",
      screens: ["사용자관리", "역할관리", "PDA역할관리", "통신설정관리", "환경설정", "스케줄러관리"],
      apis: ["users", "roles", "system/pda-roles", "system/comm-configs", "system/configs", "scheduler/jobs"],
      tables: ["USERS", "USER_AUTHS", "ROLES", "ROLE_MENU_PERMISSIONS", "PDA_ROLE", "SYS_CONFIGS", "COMM_CONFIGS"],
      flow: [
        { step: 1, actor: "관리자", screen: "역할관리", action: "역할 생성 → 메뉴별 접근권한 할당", table: "ROLES, ROLE_MENU_PERMISSIONS", note: "menuConfig 기반" },
        { step: 2, actor: "관리자", screen: "사용자관리", action: "사용자 등록 → 역할 매핑 → 계정 활성화", table: "USERS, USER_AUTHS", note: "JWT 인증" },
        { step: 3, actor: "관리자", screen: "PDA역할관리", action: "PDA 전용 역할 생성 → PDA 메뉴 매핑", table: "PDA_ROLE", note: "PC/PDA 분리" },
        { step: 4, actor: "관리자", screen: "스케줄러관리", action: "배치 작업 등록 (Cron 주기, 실행유형) → 활성화", table: "SYS_CONFIGS", note: "5종 Executor" },
      ],
      rules: [
        "모든 사용자 활동은 활동 로그에 기록되며, 감사 추적이 가능하다",
        "역할은 메뉴 코드(menuConfig) 단위로 접근권한을 제어한다",
        "PDA 역할은 PC Web 역할과 분리되어 모바일 전용 메뉴를 관리한다",
        "스케줄러는 Script/HTTP/SQL/Procedure/Service 5종 실행유형을 지원한다",
      ],
    },
  ]},
];

// ═══════════════════════════════════════════════════════════════
// 기대효과
// ═══════════════════════════════════════════════════════════════
const effects = [
  ["입고 처리 시간", "건당 5분 (수기)", "건당 30초 (바코드 스캔)", "90% 단축"],
  ["재고 정확도", "약 85%", "99% 이상", "14%p 향상"],
  ["추적성", "불가", "LOT/시리얼 단위 완전 추적", "100% 확보"],
  ["불량 집계 소요", "월말 수작업 1일", "실시간 자동 통계", "100% 단축"],
  ["검사 누락률", "약 5%", "0% (시스템 강제)", "5%p 개선"],
  ["작업지시 배포", "종이 배포 30분~1시간", "시스템 즉시 조회", "95% 단축"],
  ["생산실적 집계", "월말 수작업 2~3일", "실시간 자동 집계", "100% 단축"],
  ["설비 점검 누락", "약 10%", "캘린더 알림 0%", "10%p 개선"],
  ["출하 오류율", "약 2%", "바코드 검증 0.1% 이하", "95% 감소"],
  ["ERP 이중입력", "전 항목 수동", "API 자동 연동", "100% 제거"],
];

// ═══════════════════════════════════════════════════════════════
// 문서 빌드
// ═══════════════════════════════════════════════════════════════
const ch = []; // children

// 개정이력
ch.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun("개정이력")]}));
ch.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[1500,800,1800,5606],rows:[
  new TableRow({children:[hC("날짜",1500),hC("버전",800),hC("작성자",1800),hC("변경내용",5606)]}),
  new TableRow({children:[dC(today,1500,{c:1}),dC("1.0",800,{c:1}),dC("시스템 자동생성",1800,{c:1}),dC("초기 작성 - 프로세스 단위 상세 기술",5606)]})
]}));

ch.push(new Paragraph({children:[new PageBreak()]}));
ch.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun("목차")]}));
ch.push(new TableOfContents("목차",{hyperlink:true,headingStyleRange:"1-3"}));

// 1. 개요
ch.push(new Paragraph({children:[new PageBreak()]}));
ch.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun("1. 개요")]}));
ch.push(txt("본 문서는 HANES MES 프로젝트의 현행(As-Is) 업무 프로세스를 분석하고, MES 시스템 도입 후 목표(To-Be) 프로세스를 프로세스 단위로 상세히 정의한다. 각 프로세스별 개요, 시스템 처리 흐름, 관련 화면/API/테이블, 업무 규칙을 기술한다."));
const totalProc = modules.reduce((s,m)=>s+m.processes.length,0);
ch.push(txt(`대상: ${modules.length}개 모듈, ${totalProc}개 프로세스`));

// 모듈별 → 프로세스별 상세
let chapIdx = 2;
modules.forEach((mod) => {
  ch.push(new Paragraph({children:[new PageBreak()]}));
  ch.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun(`${chapIdx}. ${mod.name}`)]}));

  mod.processes.forEach((proc, pi) => {
    if (pi > 0) ch.push(new Paragraph({children:[new PageBreak()]}));
    ch.push(new Paragraph({heading:HeadingLevel.HEADING_2,children:[new TextRun(`${chapIdx}.${pi+1} [${proc.id}] ${proc.name}`)]}));

    // 개요 카드
    ch.push(new Paragraph({heading:HeadingLevel.HEADING_3,children:[new TextRun("개요")]}));
    ch.push(overviewCard([
      ["프로세스ID", proc.id],
      ["프로세스명", proc.name],
      ["수행부서", proc.dept],
      ["수행방법", proc.method],
    ]));
    ch.push(txt(""));
    ch.push(txt(proc.overview));

    // As-Is 현행
    ch.push(new Paragraph({heading:HeadingLevel.HEADING_3,children:[new TextRun("현행(As-Is)")]}));
    ch.push(overviewCard([
      ["현행 프로세스ID", proc.asIs.id],
      ["현행 방식", proc.asIs.desc],
      ["문제점", proc.asIs.problem],
    ]));

    // 시스템 처리 흐름
    ch.push(txt(""));
    ch.push(new Paragraph({heading:HeadingLevel.HEADING_3,children:[new TextRun("시스템 처리 흐름")]}));
    const fCols = [450, 900, 1500, 3256, 1800, 1800];
    ch.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:fCols,
      rows:[
        new TableRow({tableHeader:true,children:[hC("단계",fCols[0]),hC("수행자",fCols[1]),hC("화면/시스템",fCols[2]),hC("처리 내용",fCols[3]),hC("관련 테이블",fCols[4]),hC("비고",fCols[5])]}),
        ...proc.flow.map(f=>new TableRow({children:[
          dC(f.step,fCols[0],{c:1}),dC(f.actor,fCols[1],{c:1,s:14}),dC(f.screen,fCols[2],{s:14}),
          dC(f.action,fCols[3],{s:14}),dC(f.table,fCols[4],{s:12}),dC(f.note,fCols[5],{s:13}),
        ]})),
      ]
    }));

    // 관련 화면
    ch.push(txt(""));
    ch.push(new Paragraph({heading:HeadingLevel.HEADING_3,children:[new TextRun("관련 화면")]}));
    ch.push(txt(proc.screens.join(", ")));

    // 관련 API
    ch.push(new Paragraph({heading:HeadingLevel.HEADING_3,children:[new TextRun("관련 API")]}));
    ch.push(txt(proc.apis.join("\n"), {size:17}));

    // 관련 테이블
    ch.push(new Paragraph({heading:HeadingLevel.HEADING_3,children:[new TextRun("관련 테이블")]}));
    ch.push(txt(proc.tables.join(", "), {size:17}));

    // 업무 규칙
    ch.push(new Paragraph({heading:HeadingLevel.HEADING_3,children:[new TextRun("업무 규칙")]}));
    proc.rules.forEach((rule, ri) => {
      ch.push(txt(`${ri+1}. ${rule}`, {size:18}));
    });
  });
  chapIdx++;
});

// 기대효과
ch.push(new Paragraph({children:[new PageBreak()]}));
ch.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun(`${chapIdx}. 기대 효과`)]}));
const efCols = [400, 2200, 2200, 2706, 2200];
ch.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:efCols,rows:[
  new TableRow({tableHeader:true,children:[hC("No",efCols[0]),hC("영역",efCols[1]),hC("현행",efCols[2]),hC("개선 후",efCols[3]),hC("정량적 효과",efCols[4])]}),
  ...effects.map((e,i)=>new TableRow({children:[
    dC(i+1,efCols[0],{c:1}),dC(e[0],efCols[1],{r:{bold:true}}),dC(e[1],efCols[2]),dC(e[2],efCols[3]),dC(e[3],efCols[4],{c:1,r:{bold:true}}),
  ]})),
]}));

const doc = new Document({
  styles:{
    default:{document:{run:{font:FONT,size:22}}},
    paragraphStyles:[
      {id:"Heading1",name:"Heading 1",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:32,bold:true,font:FONT,color:"1F4E79"},paragraph:{spacing:{before:360,after:240},outlineLevel:0}},
      {id:"Heading2",name:"Heading 2",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:26,bold:true,font:FONT,color:"2E75B6"},paragraph:{spacing:{before:240,after:180},outlineLevel:1}},
      {id:"Heading3",name:"Heading 3",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:22,bold:true,font:FONT},paragraph:{spacing:{before:180,after:120},outlineLevel:2}},
    ],
  },
  sections:[
    {properties:{page:{size:{width:PAGE_W,height:PAGE_H},margin:{top:MARGIN,right:MARGIN,bottom:MARGIN,left:MARGIN}}},
      children:[
        new Paragraph({spacing:{before:4000},children:[]}),
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:600},children:[new TextRun({text:"HANES MES",font:FONT,size:60,bold:true,color:"1F4E79"})]}),
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:300},children:[new TextRun({text:"업무 프로세스 정의서",font:FONT,size:44,bold:true,color:"2E75B6"})]}),
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:"(Business Process Definition)",font:FONT,size:26,color:"666666",italics:true})]}),
        new Paragraph({spacing:{before:2000},children:[]}),
        new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`프로젝트명: HANES MES`,font:FONT,size:24,color:"444444"})]}),
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120},children:[new TextRun({text:`작성일: ${today}   |   버전: 1.0`,font:FONT,size:24,color:"444444"})]}),
      ]
    },
    {properties:{page:{size:{width:PAGE_W,height:PAGE_H},margin:{top:MARGIN,right:MARGIN,bottom:MARGIN,left:MARGIN}}},
      headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:"HANES MES - 업무프로세스정의서",font:FONT,size:16,color:"888888",italics:true})]})]})},
      footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"- ",font:FONT,size:16,color:"888888"}),new TextRun({children:[PageNumber.CURRENT],font:FONT,size:16,color:"888888"}),new TextRun({text:" -",font:FONT,size:16,color:"888888"})]})]})},
      children: ch,
    },
  ],
});

const outFile = path.join(__dirname,"..","docs","deliverables","all",`업무프로세스정의서_${today}.docx`);
Packer.toBuffer(doc).then(buf=>{
  fs.writeFileSync(outFile,buf);
  console.log(`생성 완료: ${outFile}`);
  console.log(`  모듈: ${modules.length}개, 프로세스: ${totalProc}개`);
  console.log(`  처리흐름: ${modules.reduce((s,m)=>s+m.processes.reduce((ss,p)=>ss+p.flow.length,0),0)}단계`);
  console.log(`  업무규칙: ${modules.reduce((s,m)=>s+m.processes.reduce((ss,p)=>ss+p.rules.length,0),0)}개`);
}).catch(err=>{console.error("생성 실패:",err);process.exit(1);});
