/**
 * @file scripts/gen-glossary.js
 * @description HANES MES 용어정의서 Word 문서 생성 스크립트
 *
 * 초보자 가이드:
 * 1. 실행: node scripts/gen-glossary.js
 * 2. 출력: exports/all/용어정의서_YYYY-MM-DD.docx
 * 3. 약어, 도메인용어, 기술용어, 데이터용어, 공통코드 5개 섹션으로 구성
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  TableOfContents,
} = require("docx");

const today = new Date().toISOString().slice(0, 10);
const FONT = "맑은 고딕";
const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerShading = { fill: "1F4E79", type: ShadingType.CLEAR };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1200;
const CONTENT_W = PAGE_W - MARGIN * 2;

function hCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: headerShading, margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", font: FONT, size: 18 })] })],
  });
}
function dCell(text, width, opts = {}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    margins: cellMargins, shading: opts.shading,
    children: [new Paragraph({ alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: String(text), font: FONT, size: opts.size || 18, ...opts.run })] })],
  });
}

// ═══════════════════════════════════════════════════════════════
// 2. 약어 목록
// ═══════════════════════════════════════════════════════════════
const abbreviations = [
  ["MES", "Manufacturing Execution System", "생산실행시스템", ""],
  ["IQC", "Incoming Quality Control", "수입검사", ""],
  ["OQC", "Outgoing Quality Control", "출하검사", ""],
  ["BOM", "Bill of Materials", "자재명세서", ""],
  ["PO", "Purchase Order", "구매발주", ""],
  ["LOT", "Lot (Production Batch)", "생산단위/배치", ""],
  ["WIP", "Work in Process", "재공품/반제품", ""],
  ["FIFO", "First In First Out", "선입선출", "재고 출고 원칙"],
  ["CAPA", "Corrective and Preventive Action", "시정예방조치", "ISO 9001"],
  ["SPC", "Statistical Process Control", "통계적 공정관리", ""],
  ["PPAP", "Production Part Approval Process", "양산부품승인절차", "IATF 16949"],
  ["FAI", "First Article Inspection", "초물검사", ""],
  ["PM", "Preventive Maintenance", "예방보전", ""],
  ["RBAC", "Role-Based Access Control", "역할기반 접근제어", ""],
  ["ERP", "Enterprise Resource Planning", "전사적자원관리", ""],
  ["PDA", "Personal Digital Assistant", "휴대용 단말기", "모바일 앱"],
  ["CP", "Control Plan", "관리계획서", "IATF 16949"],
  ["MSA", "Measurement System Analysis", "측정시스템분석", ""],
  ["FG", "Finished Goods", "완제품", "FG Label"],
  ["UID", "Unique Identifier", "고유식별자", "matUid, prdUid, conUid"],
  ["PK", "Primary Key", "기본키", "DB 설계"],
  ["FK", "Foreign Key", "외래키", "DB 설계"],
  ["DTO", "Data Transfer Object", "데이터전송객체", "API 입출력"],
  ["CRUD", "Create, Read, Update, Delete", "생성/조회/수정/삭제", "기본 데이터 조작"],
  ["JWT", "JSON Web Token", "인증 토큰", "사용자 인증"],
  ["API", "Application Programming Interface", "응용프로그램 인터페이스", "REST API"],
  ["ZPL", "Zebra Programming Language", "라벨프린터 언어", "바코드 라벨"],
  ["QR", "Quick Response (Code)", "큐알코드", "2D 바코드"],
  ["I/F", "Interface", "인터페이스", "시스템 간 연동"],
  ["KPI", "Key Performance Indicator", "핵심성과지표", "대시보드"],
];
const abbrColW = [450, 900, 3000, 2200, 2956];
const abbrTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: abbrColW,
  rows: [
    new TableRow({ tableHeader: true, children: [hCell("No", abbrColW[0]), hCell("약어", abbrColW[1]), hCell("영문 Full Name", abbrColW[2]), hCell("한글명", abbrColW[3]), hCell("비고", abbrColW[4])] }),
    ...abbreviations.map((a, i) => new TableRow({ children: [
      dCell(i + 1, abbrColW[0], { center: true }), dCell(a[0], abbrColW[1], { center: true, run: { bold: true } }),
      dCell(a[1], abbrColW[2]), dCell(a[2], abbrColW[3]), dCell(a[3], abbrColW[4]),
    ] })),
  ],
});

// ═══════════════════════════════════════════════════════════════
// 3. 도메인 용어
// ═══════════════════════════════════════════════════════════════
const domainTerms = [
  // 자재관리
  ["입하", "Arrival", "거래처로부터 자재가 공장에 도착하는 행위. PO 기반 또는 수동 등록 가능", "자재관리"],
  ["입고", "Receiving", "입하된 자재가 IQC 합격 후 창고에 실제 입고 처리되는 행위", "자재관리"],
  ["수불", "Transaction", "자재/제품의 입고, 출고, 이동, 조정 등 재고 변동 이력 전체", "재고관리"],
  ["출고", "Issue", "생산 또는 요청에 의해 창고에서 자재를 불출하는 행위", "자재관리"],
  ["출고요청", "Issue Request", "현장에서 필요 자재를 창고에 요청하는 행위 (승인 프로세스 포함)", "자재관리"],
  ["유수명", "Shelf Life", "자재의 사용 가능 기한. 유통기한과 유사한 개념", "자재관리"],
  ["재고보정", "Adjustment", "실물 재고와 시스템 재고의 차이를 보정하는 행위", "재고관리"],
  ["재고실사", "Physical Inventory", "실제 창고의 재고를 물리적으로 확인하여 시스템과 대조하는 행위", "재고관리"],
  ["역분개", "Receipt Cancel", "이미 처리된 입고를 취소하고 재고를 원복하는 행위", "자재관리"],
  ["홀드", "Hold", "품질 이슈 등으로 자재/제품의 사용을 일시 중지하는 상태", "재고관리"],
  // 생산관리
  ["작업지시", "Job Order", "생산계획에 따라 특정 품목의 생산을 지시하는 단위", "생산관리"],
  ["생산실적", "Production Result", "작업지시에 대해 실제 생산된 수량, 불량, 작업시간 등의 기록", "생산관리"],
  ["생산계획", "Production Plan", "월간/일간 단위로 생산 목표 수량과 일정을 계획하는 것", "생산관리"],
  ["재작업", "Rework", "불량 판정된 제품을 수리/재가공하여 양품으로 전환하는 작업", "생산관리"],
  ["반제품", "Semi-Finished Goods", "중간 공정까지 완료된 미완성 제품", "생산관리"],
  // 품질관리
  ["수입검사", "IQC", "입하된 자재의 품질을 검사하여 합격/불합격을 판정하는 행위", "품질관리"],
  ["출하검사", "OQC", "출하 전 완제품의 품질을 최종 검사하는 행위", "품질관리"],
  ["외관검사", "Visual Inspection", "제품의 외관을 육안으로 검사하여 불량 여부를 판별하는 행위", "품질관리"],
  ["통전검사", "Continuity Inspection", "전기적 연결 상태를 검사하는 행위 (와이어하네스 특화)", "품질관리"],
  ["불량", "Defect", "품질 기준에 부적합한 제품/자재의 상태", "품질관리"],
  ["추적성", "Traceability", "제품의 원자재부터 출하까지 전 과정을 추적할 수 있는 능력", "품질관리"],
  ["초물검사", "FAI", "신규 또는 변경된 제품의 첫 생산품에 대한 전수 검사", "품질관리"],
  ["시정예방조치", "CAPA", "불량/클레임의 근본원인을 분석하고 재발 방지 대책을 수립하는 활동", "품질관리"],
  ["변경점관리", "Change Control", "제품, 공정, 자재 등의 변경사항을 체계적으로 관리하는 프로세스", "품질관리"],
  ["관리계획서", "Control Plan", "제품 품질을 확보하기 위한 공정별 관리 항목과 기준을 정의한 문서", "품질관리"],
  // 설비관리
  ["일상점검", "Daily Inspection", "매일 설비 가동 전/후 실시하는 기본 점검 활동", "설비관리"],
  ["정기점검", "Periodic Inspection", "주기적(주간/월간/분기)으로 실시하는 상세 점검 활동", "설비관리"],
  ["예방보전", "Preventive Maintenance", "설비 고장 예방을 위해 계획적으로 수행하는 보전 활동", "설비관리"],
  ["금형", "Mold", "제품 성형에 사용되는 틀. 사용 횟수(타수) 기반 수명 관리", "설비관리"],
  ["계측기", "Gauge", "측정에 사용되는 기기. 주기적 교정(Calibration) 필요", "설비관리"],
  // 출하관리
  ["포장", "Packing/Box", "완제품을 박스 단위로 포장하는 행위", "출하관리"],
  ["팔레트", "Pallet", "다수의 박스를 적재하는 운반 단위", "출하관리"],
  ["출하", "Shipment", "완제품을 고객에게 발송하는 최종 행위", "출하관리"],
  ["반품", "Return", "출하된 제품이 품질/수량 이슈로 반송되는 것", "출하관리"],
  // 보세/소모품/외주
  ["보세", "Customs/Bonded", "관세 미납 상태로 보관/사용되는 수입 자재의 관리 체계", "보세관리"],
  ["소모품", "Consumable", "생산 과정에서 소모되는 부자재 (공구, 블레이드 등). 타수 기반 수명 관리", "소모품관리"],
  ["외주", "Outsourcing/Subcon", "자사 공정 일부를 외부 업체에 위탁하여 처리하는 것", "외주관리"],
  // 공통
  ["채번", "Number Generation", "시스템이 규칙에 따라 자동으로 일련번호를 생성하는 것", "공통"],
  ["바코드", "Barcode", "자재/제품/설비를 식별하기 위한 기계판독용 코드", "공통"],
  ["멀티테넌시", "Multi-Tenancy", "하나의 시스템에서 여러 회사/공장의 데이터를 분리 관리하는 구조", "공통"],
];
const domColW = [400, 1400, 1200, 4000, 1200, 1306];
const domTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: domColW,
  rows: [
    new TableRow({ tableHeader: true, children: [hCell("No", domColW[0]), hCell("용어(한글)", domColW[1]), hCell("용어(영문)", domColW[2]), hCell("정의", domColW[3]), hCell("관련 모듈", domColW[4]), hCell("비고", domColW[5])] }),
    ...domainTerms.map((d, i) => new TableRow({ children: [
      dCell(i + 1, domColW[0], { center: true, size: 16 }), dCell(d[0], domColW[1], { run: { bold: true }, size: 16 }),
      dCell(d[1], domColW[2], { size: 16 }), dCell(d[2], domColW[3], { size: 16 }),
      dCell(d[3], domColW[4], { center: true, size: 16 }), dCell("", domColW[5], { size: 16 }),
    ] })),
  ],
});

// ═══════════════════════════════════════════════════════════════
// 4. 기술 용어
// ═══════════════════════════════════════════════════════════════
const techTerms = [
  ["NestJS", "Node.js 기반 서버사이드 프레임워크. 모듈/컨트롤러/서비스 아키텍처, DI 컨테이너 제공", "Backend"],
  ["Next.js", "React 기반 풀스택 프레임워크. App Router, SSR/SSG, 파일 기반 라우팅 지원", "Frontend"],
  ["TypeORM", "TypeScript ORM 라이브러리. 데코레이터 기반 엔티티 정의, Oracle DB 연동", "Database"],
  ["Oracle DB", "Oracle Corporation의 관계형 데이터베이스 관리 시스템. 본 프로젝트의 메인 DB", "Database"],
  ["Turborepo", "모노레포 빌드 시스템. 태스크 캐싱, 병렬 빌드, 의존성 그래프 관리", "DevOps"],
  ["pnpm", "효율적인 Node.js 패키지 매니저. 심볼릭 링크 기반 디스크 절약", "DevOps"],
  ["TypeScript", "JavaScript에 정적 타입을 추가한 프로그래밍 언어", "Language"],
  ["React", "UI 구축을 위한 JavaScript 라이브러리. 컴포넌트 기반 개발", "Frontend"],
  ["Tailwind CSS", "유틸리티 퍼스트 CSS 프레임워크. 클래스 기반 스타일링", "Frontend"],
  ["AG Grid", "고성능 데이터 그리드 컴포넌트. 대용량 테이블 렌더링에 사용", "Frontend"],
  ["Zustand", "경량 React 상태 관리 라이브러리", "Frontend"],
  ["i18n", "국제화(Internationalization). 한국어/영어/중국어/베트남어 4개 언어 지원", "Frontend"],
  ["JWT", "JSON Web Token. 사용자 인증에 사용되는 토큰 기반 인증 방식", "Security"],
  ["Guard", "NestJS의 인증/인가 미들웨어. 요청 전 권한을 검증하는 컴포넌트", "Backend"],
  ["DTO", "Data Transfer Object. API 요청/응답 데이터의 형태를 정의하는 클래스", "Backend"],
  ["Entity", "TypeORM의 데이터베이스 테이블을 매핑하는 TypeScript 클래스", "Backend"],
  ["Repository", "TypeORM의 데이터 접근 계층. 엔티티에 대한 CRUD 연산 제공", "Backend"],
  ["ZPL", "Zebra Programming Language. 바코드 라벨 프린터 제어 언어", "Hardware"],
  ["TCP Socket", "네트워크 통신 프로토콜. 라벨 프린터 및 검사기 연동에 사용", "Hardware"],
];
const techColW = [400, 1600, 5806, 1700];
const techTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: techColW,
  rows: [
    new TableRow({ tableHeader: true, children: [hCell("No", techColW[0]), hCell("용어", techColW[1]), hCell("정의", techColW[2]), hCell("분류", techColW[3])] }),
    ...techTerms.map((t, i) => new TableRow({ children: [
      dCell(i + 1, techColW[0], { center: true, size: 16 }), dCell(t[0], techColW[1], { run: { bold: true }, size: 16 }),
      dCell(t[1], techColW[2], { size: 16 }), dCell(t[2], techColW[3], { center: true, size: 16 }),
    ] })),
  ],
});

// ═══════════════════════════════════════════════════════════════
// 5. 데이터 용어 - 테이블 접두어
// ═══════════════════════════════════════════════════════════════
const tablePrefix = [
  ["(없음)", "마스터/기준 테이블", "ITEM_MASTERS, EQUIP_MASTERS, PARTNER_MASTERS, WORKER_MASTERS"],
  ["MAT_", "자재 관련", "MAT_ARRIVALS, MAT_RECEIVINGS, MAT_STOCKS, MAT_ISSUES"],
  ["PROD_", "생산 관련", "PROD_PLANS, PROD_RESULTS"],
  ["EQUIP_", "설비 관련", "EQUIP_INSPECT_LOGS, EQUIP_PROTOCOLS, EQUIP_BOM_ITEMS"],
  ["PM_", "예방보전 관련", "PM_PLANS, PM_PLAN_ITEMS, PM_WORK_ORDERS, PM_WO_RESULTS"],
  ["IQC_", "수입검사 관련", "IQC_GROUPS, IQC_GROUP_ITEMS, IQC_ITEM_POOL, IQC_ITEM_MASTERS"],
  ["OQC_", "출하검사 관련", "OQC_REQUESTS, OQC_REQUEST_BOXES"],
  ["SPC_", "SPC 관련", "SPC_CHARTS, SPC_DATA"],
  ["CUSTOMS_", "보세 관련", "CUSTOMS_ENTRIES, CUSTOMS_LOTS, CUSTOMS_USAGE_REPORTS"],
  ["CONSUMABLE_", "소모품 관련", "CONSUMABLE_MASTERS, CONSUMABLE_STOCKS"],
  ["SUBCON_", "외주 관련", "SUBCON_ORDERS, SUBCON_DELIVERIES, SUBCON_RECEIVES"],
  ["REWORK_", "재작업 관련", "REWORK_ORDERS, REWORK_PROCESSES, REWORK_RESULTS"],
  ["SHIPMENT_", "출하 관련", "SHIPMENT_LOGS, SHIPMENT_ORDERS, SHIPMENT_RETURNS"],
  ["CUSTOMER_", "고객 관련", "CUSTOMER_ORDERS, CUSTOMER_ORDER_ITEMS, CUSTOMER_COMPLAINTS"],
];
const tpColW = [1500, 2000, 6006];
const tpTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: tpColW,
  rows: [
    new TableRow({ tableHeader: true, children: [hCell("접두어", tpColW[0]), hCell("의미", tpColW[1]), hCell("예시", tpColW[2])] }),
    ...tablePrefix.map(t => new TableRow({ children: [
      dCell(t[0], tpColW[0], { center: true, run: { bold: true }, size: 16 }),
      dCell(t[1], tpColW[1], { size: 16 }), dCell(t[2], tpColW[2], { size: 14 }),
    ] })),
  ],
});

// 컬럼 접미어
const colSuffix = [
  ["_CD", "코드", "NVARCHAR2", "ITEM_CD, PROCESS_CD, EQUIP_CD"],
  ["_NM", "명칭", "NVARCHAR2", "ITEM_NM, EQUIP_NM, WORKER_NM"],
  ["_QTY", "수량", "NUMBER", "ORDER_QTY, GOOD_QTY, DEFECT_QTY"],
  ["_DT", "일자", "NVARCHAR2(8)", "ARRIVAL_DT, PROD_DT, SHIP_DT"],
  ["_YN", "여부 (Y/N)", "NCHAR(1)", "USE_YN, DEL_YN, HOLD_YN"],
  ["_SEQ", "순번", "NUMBER", "LINE_SEQ, PROCESS_SEQ"],
  ["_STS", "상태코드", "NVARCHAR2", "ORDER_STS, SHIP_STS"],
  ["_AMT", "금액", "NUMBER", "UNIT_PRICE, TOTAL_AMT"],
  ["_UID", "고유식별자(바코드)", "NVARCHAR2", "MAT_UID, PRD_UID, CON_UID"],
  ["_AT", "일시(Timestamp)", "TIMESTAMP", "CREATED_AT, UPDATED_AT"],
  ["_BY", "처리자", "NVARCHAR2", "CREATED_BY, UPDATED_BY, APPROVED_BY"],
  ["_NO", "번호", "NVARCHAR2", "ORDER_NO, ENTRY_NO, PLAN_NO"],
];
const csColW = [1200, 1500, 1800, 5006];
const csTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: csColW,
  rows: [
    new TableRow({ tableHeader: true, children: [hCell("접미어", csColW[0]), hCell("의미", csColW[1]), hCell("데이터 타입", csColW[2]), hCell("예시", csColW[3])] }),
    ...colSuffix.map(c => new TableRow({ children: [
      dCell(c[0], csColW[0], { center: true, run: { bold: true }, size: 16 }),
      dCell(c[1], csColW[1], { size: 16 }), dCell(c[2], csColW[2], { center: true, size: 16 }),
      dCell(c[3], csColW[3], { size: 14 }),
    ] })),
  ],
});

// ═══════════════════════════════════════════════════════════════
// 6. 공통코드 그룹
// ═══════════════════════════════════════════════════════════════
const codeGroups = [
  ["PROCESS_TYPE", "공정유형", "절단, 압착, 조립, 검사, 포장 등", "공정관리, 라우팅"],
  ["ISSUE_TYPE", "출고유형", "생산출고, 샘플, 폐기 등", "자재출고"],
  ["EQUIP_TYPE", "설비유형", "프레스, 절단기, 검사기 등", "설비관리, 라우팅"],
  ["PART_TYPE", "품목유형", "원자재, 반제품, 완제품 등", "품목관리, BOM"],
  ["CONSUMABLE_CATEGORY", "소모품분류", "공구, 블레이드, 지그 등", "소모품관리"],
  ["JOB_ORDER_STATUS", "작업지시상태", "대기, 진행, 완료, 취소", "생산관리"],
  ["PROD_PLAN_STATUS", "생산계획상태", "계획, 확정, 진행, 마감", "생산계획"],
  ["DEFECT_STATUS", "불량상태", "등록, 조사중, 조치완료, 종결", "품질관리"],
  ["REWORK_STATUS", "재작업상태", "요청, 승인, 진행, 완료", "재작업"],
  ["BOX_STATUS", "박스상태", "포장중, 완료, 출하", "출하포장"],
  ["PALLET_STATUS", "팔레트상태", "적재중, 완료, 출하", "출하관리"],
  ["SHIP_ORDER_STATUS", "출하지시상태", "등록, 확정, 출하완료", "출하관리"],
  ["SHIPMENT_STATUS", "출하상태", "준비, 선적, 출하, 배송완료", "출하관리"],
  ["JUDGE_YN", "판정결과", "합격(Y), 불합격(N)", "검사"],
  ["VISUAL_DEFECT", "외관불량유형", "스크래치, 변형, 오염 등", "외관검사"],
  ["PM_TYPE", "PM유형", "예방보전, 사후보전, 개량보전", "설비보전"],
  ["PM_CYCLE_TYPE", "PM주기유형", "일, 주, 월, 분기, 년", "PM계획"],
  ["PM_ITEM_TYPE", "PM항목유형", "점검, 교체, 세척, 윤활", "PM계획"],
  ["INSPECT_CHECK_TYPE", "점검유형", "일상점검, 정기점검", "설비점검"],
  ["INSPECT_JUDGE", "점검판정", "양호, 불량, 조치필요", "설비점검"],
  ["QUALITY_CONDITION", "품질조건", "온도, 압력, 토크 등 관리 항목", "라우팅"],
  ["UNIT_TYPE", "단위유형", "mm, kg, EA, %, 등", "라우팅/검사"],
  ["INSPECT_METHOD", "검사방법", "전수, 샘플, 무검사", "관리계획서"],
  ["SAMPLE_SIZE", "샘플크기", "AQL 기준 샘플 수량", "관리계획서"],
  ["SAMPLE_FREQ", "샘플빈도", "매 LOT, 매 시간, 매일", "관리계획서"],
  ["CONTROL_METHOD", "관리방법", "자주검사, 초중종검사, SPC", "관리계획서"],
];
const ccColW = [500, 2200, 1600, 2706, 2500];
const ccTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: ccColW,
  rows: [
    new TableRow({ tableHeader: true, children: [hCell("No", ccColW[0]), hCell("코드그룹", ccColW[1]), hCell("한글명", ccColW[2]), hCell("상세코드 예시", ccColW[3]), hCell("사용처", ccColW[4])] }),
    ...codeGroups.map((c, i) => new TableRow({ children: [
      dCell(i + 1, ccColW[0], { center: true, size: 16 }),
      dCell(c[0], ccColW[1], { run: { bold: true }, size: 15 }),
      dCell(c[1], ccColW[2], { size: 16 }),
      dCell(c[2], ccColW[3], { size: 15 }),
      dCell(c[3], ccColW[4], { size: 15 }),
    ] })),
  ],
});

// ═══════════════════════════════════════════════════════════════
// 문서 생성
// ═══════════════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: FONT, color: "1F4E79" },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: "2E75B6" },
        paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: FONT },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 } },
    ],
  },
  sections: [
    // ── 표지 ──
    {
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      children: [
        new Paragraph({ spacing: { before: 4000 }, children: [] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "HANES MES", font: FONT, size: 60, bold: true, color: "1F4E79" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: "용어 정의서", font: FONT, size: 48, bold: true, color: "2E75B6" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "(Glossary)", font: FONT, size: 28, color: "666666", italics: true })] }),
        new Paragraph({ spacing: { before: 2000 }, children: [] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `프로젝트명: HANES MES`, font: FONT, size: 24, color: "444444" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: `작성일: ${today}   |   버전: 1.0`, font: FONT, size: 24, color: "444444" })] }),
      ],
    },
    // ── 본문 ──
    {
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "HANES MES - 용어정의서", font: FONT, size: 16, color: "888888", italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "- ", font: FONT, size: 16, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "888888" }), new TextRun({ text: " -", font: FONT, size: 16, color: "888888" })] })] }) },
      children: [
        // 개정이력
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("개정이력")] }),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [1500, 1000, 2000, 5006],
          rows: [
            new TableRow({ children: [hCell("날짜", 1500), hCell("버전", 1000), hCell("작성자", 2000), hCell("변경내용", 5006)] }),
            new TableRow({ children: [dCell(today, 1500, { center: true }), dCell("1.0", 1000, { center: true }), dCell("시스템 자동생성", 2000, { center: true }), dCell("초기 작성 - 코드베이스 자동 추출", 5006)] }),
          ],
        }),
        // 목차
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("목차")] }),
        new TableOfContents("목차", { hyperlink: true, headingStyleRange: "1-3" }),

        // 1. 개요
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. 개요")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.1 목적")] }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "본 문서는 HANES MES 프로젝트에서 사용되는 업무 용어, 기술 용어, 약어, 데이터 명명규칙, 공통코드를 정의하여 프로젝트 참여자 간 의사소통의 명확성을 확보하고, 개발/운영/유지보수 시 일관된 용어를 사용하기 위한 기준 문서이다.", font: FONT, size: 22 })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.2 범위")] }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `HANES MES 전체 모듈을 대상으로 하며, 약어 ${abbreviations.length}개, 도메인 용어 ${domainTerms.length}개, 기술 용어 ${techTerms.length}개, 공통코드 그룹 ${codeGroups.length}개를 정의한다.`, font: FONT, size: 22 })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.3 용어 분류 체계")] }),
        new Table({
          width: { size: 8000, type: WidthType.DXA }, columnWidths: [2000, 6000],
          rows: [
            new TableRow({ children: [hCell("분류", 2000), hCell("설명", 6000)] }),
            ...([["약어", "영문 줄임말과 그 풀네임/한글명"], ["도메인 용어", "MES 업무 프로세스에서 사용하는 한글/영문 업무 용어"], ["기술 용어", "시스템 개발에 사용된 프레임워크, 라이브러리, 기술 스택 용어"], ["데이터 용어", "DB 테이블/컬럼 명명규칙 및 접두어/접미어 의미"], ["공통코드", "시스템에서 사용하는 코드 그룹과 상세 코드 목록"]]).map(r => new TableRow({ children: [dCell(r[0], 2000, { run: { bold: true } }), dCell(r[1], 6000)] })),
          ],
        }),

        // 2. 약어 목록
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. 약어 목록 (Abbreviations)")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `총 ${abbreviations.length}개 약어`, font: FONT, size: 20 })] }),
        abbrTable,

        // 3. 도메인 용어
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. 도메인 용어 정의")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `총 ${domainTerms.length}개 업무 용어 (모듈별 분류)`, font: FONT, size: 20 })] }),
        domTable,

        // 4. 기술 용어
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. 기술 용어 정의")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `총 ${techTerms.length}개 기술 용어`, font: FONT, size: 20 })] }),
        techTable,

        // 5. 데이터 용어
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. 데이터 용어 정의")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.1 테이블 접두어 규칙")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Oracle DB 테이블명은 UPPER_SNAKE_CASE를 사용하며, 모듈별 접두어로 구분한다.", font: FONT, size: 20 })] }),
        tpTable,
        new Paragraph({ spacing: { before: 300 }, children: [] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.2 컬럼 접미어 규칙")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "컬럼명의 접미어로 데이터의 성격과 타입을 표현한다.", font: FONT, size: 20 })] }),
        csTable,

        // 6. 공통코드
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. 공통코드 그룹 정의")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `총 ${codeGroups.length}개 공통코드 그룹 (COM_CODES 테이블 기반)`, font: FONT, size: 20 })] }),
        ccTable,
      ],
    },
  ],
});

const outDir = path.join(__dirname, "..", "docs", "deliverables", "all");
const outFile = path.join(outDir, `용어정의서_${today}.docx`);
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outFile, buffer);
  console.log(`생성 완료: ${outFile}`);
  console.log(`  약어: ${abbreviations.length}개, 도메인용어: ${domainTerms.length}개, 기술용어: ${techTerms.length}개`);
  console.log(`  테이블접두어: ${tablePrefix.length}개, 컬럼접미어: ${colSuffix.length}개, 공통코드: ${codeGroups.length}개`);
}).catch(err => { console.error("생성 실패:", err); process.exit(1); });
