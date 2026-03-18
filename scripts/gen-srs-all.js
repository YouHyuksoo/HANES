/**
 * @file scripts/gen-srs-all.js
 * @description HARNESS MES 전체 모듈 요구사항 정의서 Word 문서 생성
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CW = 13440; const MARGIN = 1200;
const C = { primary: '2B579A', hdr: 'D5E8F0', alt: 'F5F9FC', w: 'FFFFFF', must: 'FCE4EC', should: 'FFF2CC', could: 'E8F5E9', done: 'E2EFDA', wip: 'FFF2CC', hold: 'F5F9FC' };
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const tbs = { top: tb, bottom: tb, left: tb, right: tb };

function c(text, w, o={}) {
  return new TableCell({ borders: tbs, width: { size: w, type: WidthType.DXA },
    shading: o.sh ? { fill: o.sh, type: ShadingType.CLEAR } : undefined,
    margins: { top: 40, bottom: 40, left: 70, right: 70 }, columnSpan: o.span, verticalAlign: 'center',
    children: [new Paragraph({ alignment: o.al || AlignmentType.LEFT, spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: text||'', bold: o.b||false, font: 'Arial', size: o.sz||16, color: o.cl||'000000' })] })] });
}

function tbl(hds, data, ws) {
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: ws,
    rows: [
      new TableRow({ tableHeader: true, children: hds.map((h,i) => c(h, ws[i], { b:true, sh:C.hdr, al:AlignmentType.CENTER, sz:14 })) }),
      ...data.map((r,idx) => new TableRow({ children: r.map((v,i) => {
        const isPri = hds[i]==='우선순위';
        const isSt = hds[i]==='상태';
        let sh = idx%2===1 ? C.alt : C.w;
        if (isPri) sh = v==='상' ? C.must : v==='중' ? C.should : C.could;
        if (isSt) sh = v==='구현완료' ? C.done : v==='구현중' ? C.wip : C.hold;
        return c(v, ws[i], { sz:14, sh, al: i===0||isPri||isSt ? AlignmentType.CENTER : AlignmentType.LEFT });
      }) })),
    ] });
}

function sp() { return new Paragraph({ spacing: { after: 150 }, children: [] }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }
function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: 'Arial' })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: 'Arial' })] }); }
function p(t) { return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: t, font: 'Arial', size: 18 })] }); }

// ── 요구사항 데이터 ──
const reqs = [
  // 기준정보
  { id:'REQ-MST-001', name:'품목관리', mod:'기준정보', pri:'상', st:'구현완료', desc:'품명코드, 품목명, 품목유형(자재/반제품/제품), 재고단위, 자재수명, 포장단위, IQC 검사여부 관리' },
  { id:'REQ-MST-002', name:'BOM관리', mod:'기준정보', pri:'상', st:'구현완료', desc:'품목별 BOM 소요자재 관리. 엑셀 업/다운로드, 라우팅 연동' },
  { id:'REQ-MST-003', name:'라우팅관리', mod:'기준정보', pri:'상', st:'구현완료', desc:'품목별 공정 라우팅 정보, 작업조건(전선길이, 탈피값, 압착값, 융착조건) 관리' },
  { id:'REQ-MST-004', name:'공정관리', mod:'기준정보', pri:'상', st:'구현완료', desc:'공정코드, 공정명, 공정분류(수작업/가공/단순검사/장비검사), 사용여부' },
  { id:'REQ-MST-005', name:'작업자관리', mod:'기준정보', pri:'상', st:'구현완료', desc:'작업자 코드, 이름, 유형, 접근가능 공정. QR코드 발행. 로그인 유저와 별개' },
  { id:'REQ-MST-006', name:'IQC 검사항목관리', mod:'기준정보', pri:'상', st:'구현완료', desc:'품목별 IQC 항목 및 조건값, 유수명자재 재검사 항목 관리' },
  { id:'REQ-MST-007', name:'설비마스터관리', mod:'기준정보', pri:'상', st:'구현완료', desc:'설비코드, 설비명, 소모성 부품 목록 및 수명, 사용공정 매핑. QR코드 발행' },
  { id:'REQ-MST-008', name:'설비 점검항목관리', mod:'기준정보', pri:'상', st:'구현완료', desc:'설비별 일상/정기 점검 항목 입력. 점검 포인트 QR코드 부착' },
  { id:'REQ-MST-009', name:'창고/로케이션관리', mod:'기준정보', pri:'상', st:'구현완료', desc:'창고코드, 창고명, 로케이션(세부위치), 사용여부' },
  { id:'REQ-MST-010', name:'거래처관리', mod:'기준정보', pri:'상', st:'구현완료', desc:'고객사/공급사 코드, 정보 관리' },
  { id:'REQ-MST-011', name:'작업지도서관리', mod:'기준정보', pri:'중', st:'구현완료', desc:'품목별 공정 작업지도서 이미지 파일 업로드 및 미리보기' },
  { id:'REQ-MST-012', name:'제조사 바코드 매핑', mod:'기준정보', pri:'상', st:'구현완료', desc:'자재 제조사 바코드와 MES 내 품목코드 1:1 매핑' },
  { id:'REQ-MST-013', name:'라벨관리', mod:'기준정보', pri:'중', st:'구현완료', desc:'라벨 양식 관리, 라벨 디자인 설정' },
  // 자재관리
  { id:'REQ-MAT-001', name:'PO관리', mod:'자재관리', pri:'상', st:'구현완료', desc:'PO 번호, 상세번호, 생성일, 구매유형, 상태, 거래처, 품목, 수량 관리' },
  { id:'REQ-MAT-002', name:'PO현황조회', mod:'자재관리', pri:'상', st:'구현완료', desc:'PO 대비 입고 정보 시각화, 잔량 확인' },
  { id:'REQ-MAT-003', name:'입하관리', mod:'자재관리', pri:'상', st:'구현완료', desc:'PO 기반/수동 입하 등록, 역분개 취소, 인보이스 관리. 바코드 스캔 입하' },
  { id:'REQ-MAT-004', name:'IQC 검사관리', mod:'자재관리', pri:'상', st:'구현완료', desc:'IQC 항목별 계측값/판정 입력, 합격 시 입고라벨 발행. 무검사/샘플/전수 구분' },
  { id:'REQ-MAT-005', name:'IQC 이력조회', mod:'자재관리', pri:'상', st:'구현완료', desc:'IQC 검사 이력 조회, 항목별 계측값 및 판정 결과' },
  { id:'REQ-MAT-006', name:'입고라벨발행', mod:'자재관리', pri:'상', st:'구현완료', desc:'IQC 합격 자재 LOT에 대한 라벨 발행/재발행. matUid 채번' },
  { id:'REQ-MAT-007', name:'자재입고관리', mod:'자재관리', pri:'상', st:'구현완료', desc:'IQC 합격건 일괄/분할 입고, 자동입고(라벨 발행 시). PO 오차율 검증' },
  { id:'REQ-MAT-008', name:'입고이력조회', mod:'자재관리', pri:'상', st:'구현완료', desc:'입고 이력 조회, 통계 (금일 입고건수/수량)' },
  { id:'REQ-MAT-009', name:'출고요청관리', mod:'자재관리', pri:'상', st:'구현완료', desc:'작업지시 기반 BOM 소요자재 불출요청' },
  { id:'REQ-MAT-010', name:'자재출고관리', mod:'자재관리', pri:'상', st:'구현완료', desc:'출고유형별 자재 출고, 바코드 스캔 불출, 선입선출(FIFO) 가이드' },
  { id:'REQ-MAT-011', name:'LOT관리', mod:'자재관리', pri:'상', st:'구현완료', desc:'자재 LOT 이력 추적, 상태 관리 (NORMAL/HOLD/SCRAPPED)' },
  { id:'REQ-MAT-012', name:'자재분할관리', mod:'자재관리', pri:'중', st:'구현완료', desc:'벌크자재 분할 시 원 시리얼 사용중지, 분할 시리얼 생성 및 라벨 발행' },
  { id:'REQ-MAT-013', name:'자재병합관리', mod:'자재관리', pri:'중', st:'구현완료', desc:'같은 LOT 자재끼리 병합 처리' },
  { id:'REQ-MAT-014', name:'유수명자재관리', mod:'자재관리', pri:'중', st:'구현완료', desc:'유효기간 만료 자재 재검사 판정, 수명 연장 처리' },
  { id:'REQ-MAT-015', name:'자재재고홀드관리', mod:'자재관리', pri:'중', st:'구현완료', desc:'재고 홀드/홀드해제 처리' },
  { id:'REQ-MAT-016', name:'자재폐기처리', mod:'자재관리', pri:'중', st:'구현완료', desc:'불량/만료 자재 폐기 처리 및 이력 관리' },
  { id:'REQ-MAT-017', name:'재고보정처리', mod:'자재관리', pri:'중', st:'구현완료', desc:'재고 조정(기타입출고 포함). 최초 재고 초과 보정 불가' },
  { id:'REQ-MAT-018', name:'기타입고관리', mod:'자재관리', pri:'중', st:'구현완료', desc:'PO 없이 기타 입고 처리' },
  { id:'REQ-MAT-019', name:'입고취소', mod:'자재관리', pri:'중', st:'구현완료', desc:'당일 입고분 취소, 불출/분할된 자재는 취소 불가' },
  // 재고관리
  { id:'REQ-INV-001', name:'자재재고현황조회', mod:'재고관리', pri:'상', st:'구현완료', desc:'창고/로케이션별, 품목별 재고 조회. 유효기간 근접(노랑)/만료(빨강) 시각 표시' },
  { id:'REQ-INV-002', name:'자재수불이력조회', mod:'재고관리', pri:'상', st:'구현완료', desc:'자재 입출고 현황 조회 (수불원장)' },
  { id:'REQ-INV-003', name:'자재재고실사관리', mod:'재고관리', pri:'중', st:'구현완료', desc:'PDA 입력 기반 재고실사, 실사 중 트랜잭션 제한, 월 1회 이상' },
  { id:'REQ-INV-004', name:'자재재고실사조회', mod:'재고관리', pri:'중', st:'구현완료', desc:'재고실사 내역 조회' },
  { id:'REQ-INV-005', name:'입하재고현황조회', mod:'재고관리', pri:'중', st:'구현완료', desc:'입하 기준 재고 현황 조회' },
  { id:'REQ-INV-006', name:'제품재고현황조회', mod:'재고관리', pri:'상', st:'구현완료', desc:'품목별, 포장별 제품/반제품 현재고 조회' },
  { id:'REQ-INV-007', name:'제품재고실사관리', mod:'재고관리', pri:'중', st:'구현완료', desc:'제품 재고실사 (자재와 별도)' },
  { id:'REQ-INV-008', name:'제품재고홀드관리', mod:'재고관리', pri:'중', st:'구현완료', desc:'제품 재고 홀드/해제' },
  // 생산관리
  { id:'REQ-PRD-001', name:'월간생산계획', mod:'생산관리', pri:'상', st:'구현완료', desc:'월간 생산계획 등록/확정/마감' },
  { id:'REQ-PRD-002', name:'작업지시관리', mod:'생산관리', pri:'상', st:'구현완료', desc:'완제품 기준 각 반제품 작업지시 동시 생성, 반제품 단위도 생성 가능. 자재불출요청서 연동' },
  { id:'REQ-PRD-003', name:'작업지시현황조회', mod:'생산관리', pri:'상', st:'구현완료', desc:'작업지시 상태 및 진행 현황 조회' },
  { id:'REQ-PRD-004', name:'실적입력(수작업)', mod:'생산관리', pri:'상', st:'구현완료', desc:'설비 QR 스캔 확인 후 시작. 작업지시번호, 품목, 수량, 작업자, 투입자재, 작업지도서 표시' },
  { id:'REQ-PRD-005', name:'실적입력(가공)', mod:'생산관리', pri:'상', st:'구현완료', desc:'설비 QR 스캔, 설비설정값, 소모부품 확인. 품목 변경 시 샘플 검사 필수' },
  { id:'REQ-PRD-006', name:'실적입력(단순검사)', mod:'생산관리', pri:'상', st:'구현완료', desc:'설비 QR 스캔, 검사 판정 저장. 외관검사, 단자검사' },
  { id:'REQ-PRD-007', name:'실적입력(검사장비)', mod:'생산관리', pri:'상', st:'구현완료', desc:'설비설정값, 소모부품 확인. 검사항목 및 정상범위 표시. 통합검사(통전검사)' },
  { id:'REQ-PRD-008', name:'작업실적통합조회', mod:'생산관리', pri:'상', st:'구현완료', desc:'완제품 기준 전체 공정 실적 통합 확인' },
  { id:'REQ-PRD-009', name:'반제품 샘플검사', mod:'생산관리', pri:'상', st:'구현완료', desc:'압착 공정 샘플 인장력/배럴 검사 측정값 저장 (낱개 단위)' },
  { id:'REQ-PRD-010', name:'재작업관리', mod:'생산관리', pri:'중', st:'구현완료', desc:'NG 제품 수리 이력, 재검사 결과 관리. 완료 후 신규 라벨 발행' },
  { id:'REQ-PRD-011', name:'수리관리', mod:'생산관리', pri:'중', st:'구현완료', desc:'부적합품 수리 이력 및 결과 관리' },
  // 제품수불관리
  { id:'REQ-PM-001', name:'제품입고관리', mod:'제품수불', pri:'상', st:'구현완료', desc:'생산 완료 제품 입고 처리' },
  { id:'REQ-PM-002', name:'제품입고취소', mod:'제품수불', pri:'중', st:'구현완료', desc:'제품 입고 취소 처리' },
  { id:'REQ-PM-003', name:'제품출고관리', mod:'제품수불', pri:'상', st:'구현완료', desc:'출하지시 기반 제품 출고' },
  { id:'REQ-PM-004', name:'제품출고취소', mod:'제품수불', pri:'중', st:'구현완료', desc:'제품 출고 취소 처리' },
  // 품질관리
  { id:'REQ-QUA-001', name:'수입검사(IQC)', mod:'품질관리', pri:'상', st:'구현완료', desc:'IQC 항목별 계측/판정 입력, 합불 판정' },
  { id:'REQ-QUA-002', name:'불량관리', mod:'품질관리', pri:'상', st:'구현완료', desc:'불량 접수, 분석, 해결, 종결 프로세스' },
  { id:'REQ-QUA-003', name:'재작업검사', mod:'품질관리', pri:'중', st:'구현완료', desc:'재작업 완료 후 재검사 판정' },
  { id:'REQ-QUA-004', name:'공정검사', mod:'품질관리', pri:'상', st:'구현완료', desc:'공정별 검사 항목 입력 및 판정' },
  { id:'REQ-QUA-005', name:'출하검사(OQC)', mod:'품질관리', pri:'상', st:'구현완료', desc:'외관검사 합/불 판정, 검사원 실명제' },
  { id:'REQ-QUA-006', name:'추적관리', mod:'품질관리', pri:'상', st:'구현완료', desc:'제품 시리얼 기준 자재LOT, 작업자, 설비, 계측값 역추적' },
  { id:'REQ-QUA-007', name:'SPC관리', mod:'품질관리', pri:'상', st:'구현완료', desc:'실시간 Cpk 계산, 관리도 차트, 계측 데이터 자동 수집' },
  { id:'REQ-QUA-008', name:'Control Plan', mod:'품질관리', pri:'중', st:'구현완료', desc:'검사방법, 샘플크기/빈도, 관리방법 정의' },
  { id:'REQ-QUA-009', name:'변경관리', mod:'품질관리', pri:'중', st:'구현완료', desc:'설계/공정 변경 관리 프로세스' },
  { id:'REQ-QUA-010', name:'고객불만관리', mod:'품질관리', pri:'중', st:'구현완료', desc:'고객 불만 접수 및 처리 관리' },
  { id:'REQ-QUA-011', name:'CAPA관리', mod:'품질관리', pri:'중', st:'구현완료', desc:'시정/예방 조치 관리' },
  { id:'REQ-QUA-012', name:'FAI관리', mod:'품질관리', pri:'중', st:'구현완료', desc:'초도품 검사 관리' },
  { id:'REQ-QUA-013', name:'PPAP관리', mod:'품질관리', pri:'중', st:'구현완료', desc:'생산부품 승인 프로세스' },
  { id:'REQ-QUA-014', name:'감사관리', mod:'품질관리', pri:'하', st:'구현완료', desc:'내부/외부 감사 관리' },
  // 통전검사
  { id:'REQ-INS-001', name:'통전검사관리', mod:'통전검사', pri:'상', st:'구현완료', desc:'통전검사 실행, 마스터 샘플 검사, 합격 라벨 발행' },
  { id:'REQ-INS-002', name:'통전검사이력', mod:'통전검사', pri:'상', st:'구현완료', desc:'통전검사 이력 조회' },
  // 설비관리
  { id:'REQ-EQP-001', name:'금형관리', mod:'설비관리', pri:'상', st:'구현완료', desc:'금형/어플리케이터 관리, 칼날 타수 카운팅, 수명 도달 시 가동 차단' },
  { id:'REQ-EQP-002', name:'일상점검', mod:'설비관리', pri:'상', st:'구현완료', desc:'PDA 기반 일일 설비 점검. 미점검 시 설비 가동 차단 인터락' },
  { id:'REQ-EQP-003', name:'정기점검', mod:'설비관리', pri:'상', st:'구현완료', desc:'설비별 정기점검 (세척, 교정 등). 주기별 관리' },
  { id:'REQ-EQP-004', name:'점검이력조회', mod:'설비관리', pri:'상', st:'구현완료', desc:'일상/정기점검 내역 조회' },
  { id:'REQ-EQP-005', name:'예방보전계획', mod:'설비관리', pri:'중', st:'구현완료', desc:'시간/상태/예측 기반 예방보전 계획 등록' },
  { id:'REQ-EQP-006', name:'예방보전실적', mod:'설비관리', pri:'중', st:'구현완료', desc:'예방보전 실행 결과 기록' },
  // 계측기관리
  { id:'REQ-GAU-001', name:'계측기마스터', mod:'계측기', pri:'중', st:'구현완료', desc:'계측기 종류, 교정 상태 관리' },
  { id:'REQ-GAU-002', name:'교정관리', mod:'계측기', pri:'중', st:'구현완료', desc:'계측기 교정 실행 및 결과 기록' },
  // 출하관리
  { id:'REQ-SHP-001', name:'포장관리', mod:'출하관리', pri:'상', st:'구현완료', desc:'포장 박스 스캔, 제품 혼입/과포장 방지, 포장 라벨 발행' },
  { id:'REQ-SHP-002', name:'팔렛관리', mod:'출하관리', pri:'상', st:'구현완료', desc:'팔렛 적재/완료 관리' },
  { id:'REQ-SHP-003', name:'출하확정', mod:'출하관리', pri:'상', st:'구현완료', desc:'출하지시 바코드 스캔, 포장 바코드 스캔 후 출하 처리' },
  { id:'REQ-SHP-004', name:'출하오더관리', mod:'출하관리', pri:'상', st:'구현완료', desc:'출하일, 품목, 수량, 납품처 정보. 출하지시서 발행' },
  { id:'REQ-SHP-005', name:'출하이력조회', mod:'출하관리', pri:'상', st:'구현완료', desc:'출하 이력 조회' },
  { id:'REQ-SHP-006', name:'반품관리', mod:'출하관리', pri:'중', st:'구현완료', desc:'출하 반품 등록 및 처리' },
  { id:'REQ-SHP-007', name:'고객PO관리', mod:'출하관리', pri:'중', st:'구현완료', desc:'고객 PO 등록 및 현황 관리' },
  // 보세관리
  { id:'REQ-CUS-001', name:'보세반입', mod:'보세관리', pri:'중', st:'구현완료', desc:'보세 자재 반입 관리' },
  { id:'REQ-CUS-002', name:'보세재고', mod:'보세관리', pri:'중', st:'구현완료', desc:'보세 재고 현황 관리' },
  { id:'REQ-CUS-003', name:'보세사용현황', mod:'보세관리', pri:'중', st:'구현완료', desc:'보세 자재 사용 이력 조회' },
  // 소모품관리
  { id:'REQ-CSM-001', name:'소모품마스터', mod:'소모품', pri:'중', st:'구현완료', desc:'소모품 종류, 카테고리, 수명 관리' },
  { id:'REQ-CSM-002', name:'소모품입출고', mod:'소모품', pri:'중', st:'구현완료', desc:'소모품 입고/출고/재고 관리' },
  { id:'REQ-CSM-003', name:'소모품수명관리', mod:'소모품', pri:'중', st:'구현완료', desc:'소모품 사용횟수 기반 수명 관리' },
  // 외주관리
  { id:'REQ-OUT-001', name:'외주업체관리', mod:'외주관리', pri:'중', st:'구현완료', desc:'외주 업체 정보 관리' },
  { id:'REQ-OUT-002', name:'외주발주관리', mod:'외주관리', pri:'중', st:'구현완료', desc:'외주 발주 등록 및 관리' },
  { id:'REQ-OUT-003', name:'외주입고관리', mod:'외주관리', pri:'중', st:'구현완료', desc:'외주 가공품 입고 처리' },
  // 인터페이스
  { id:'REQ-IF-001', name:'연동현황', mod:'인터페이스', pri:'중', st:'구현완료', desc:'ERP 등 외부 시스템 연동 현황 대시보드' },
  { id:'REQ-IF-002', name:'연동로그', mod:'인터페이스', pri:'중', st:'구현완료', desc:'연동 로그 조회' },
  // 시스템관리
  { id:'REQ-SYS-001', name:'사용자관리', mod:'시스템', pri:'상', st:'구현완료', desc:'사용자 계정 등록, 권한 할당' },
  { id:'REQ-SYS-002', name:'권한관리(RBAC)', mod:'시스템', pri:'상', st:'구현완료', desc:'메뉴 코드 기반 역할/권한 관리' },
  { id:'REQ-SYS-003', name:'PDA권한관리', mod:'시스템', pri:'중', st:'구현완료', desc:'PDA 전용 권한 관리' },
  { id:'REQ-SYS-004', name:'시스템설정', mod:'시스템', pri:'상', st:'구현완료', desc:'시스템 환경변수, 자동입고 설정 등' },
  { id:'REQ-SYS-005', name:'코드관리', mod:'시스템', pri:'상', st:'구현완료', desc:'공통코드 그룹/상세코드 관리' },
  { id:'REQ-SYS-006', name:'스케줄러관리', mod:'시스템', pri:'중', st:'구현완료', desc:'배치 작업 스케줄 등록/실행/로그 관리' },
  { id:'REQ-SYS-007', name:'문서관리', mod:'시스템', pri:'중', st:'구현완료', desc:'규격서, 매뉴얼, 도면, SOP 파일 관리' },
  { id:'REQ-SYS-008', name:'교육관리', mod:'시스템', pri:'하', st:'구현완료', desc:'교육 계획, 진행, 완료 관리' },
  // 비기능
  { id:'NFR-P-001', name:'응답시간', mod:'비기능-성능', pri:'상', st:'구현완료', desc:'페이지 로딩 3초 이내, API 응답 1초 이내' },
  { id:'NFR-S-001', name:'JWT 인증', mod:'비기능-보안', pri:'상', st:'구현완료', desc:'Bearer Token 기반 인증, 토큰 만료 관리' },
  { id:'NFR-S-002', name:'RBAC 인가', mod:'비기능-보안', pri:'상', st:'구현완료', desc:'메뉴 코드 기반 역할별 접근 제어' },
  { id:'NFR-C-001', name:'다국어 지원', mod:'비기능-호환', pri:'상', st:'구현완료', desc:'한국어, 영어, 중국어, 베트남어 4개 언어' },
  { id:'NFR-C-002', name:'다크모드', mod:'비기능-호환', pri:'중', st:'구현완료', desc:'다크/라이트 모드 전환 지원' },
  { id:'NFR-C-003', name:'PWA 지원', mod:'비기능-호환', pri:'중', st:'구현완료', desc:'PDA 모바일 앱 (Progressive Web App)' },
  { id:'NFR-C-004', name:'멀티테넌시', mod:'비기능-호환', pri:'상', st:'구현완료', desc:'COMPANY + PLANT_CD 기반 다중 사업장 지원' },
  // 인터페이스
  { id:'IR-001', name:'바코드 스캐너 연동', mod:'인터페이스', pri:'상', st:'구현중', desc:'Buffered Mode(Serial/API) 바코드 스캐닝, 유형 자동 구분' },
  { id:'IR-002', name:'라벨 프린터 연동', mod:'인터페이스', pri:'상', st:'구현중', desc:'시리얼 포트 기반 라벨 프린터 제어' },
  { id:'IR-003', name:'설비 PLC 연동', mod:'인터페이스', pri:'상', st:'보류', desc:'PLC 인터페이스 통한 설비 가동/중지 제어 (인터락)' },
  { id:'IR-004', name:'계측장비 RS-232', mod:'인터페이스', pri:'상', st:'보류', desc:'미쓰도요 인장력계/마이크로미터 RS-232 데이터 자동 수집' },
  { id:'IR-005', name:'ERP 연동', mod:'인터페이스', pri:'중', st:'보류', desc:'3차 개발 - ERP 데이터 인터페이스' },
];

function buildDoc() {
  const cover = {
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ spacing: { before: 4000 }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'HARNESS MES', font: 'Arial', size: 56, bold: true, color: C.primary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Manufacturing Execution System', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '\uC694\uAD6C\uC0AC\uD56D \uC815\uC758\uC11C', font: 'Arial', size: 48, bold: true, color: '333333' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: '\uC804\uCCB4 \uBAA8\uB4C8 \uC885\uD569', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      new Table({ width: { size: 5000, type: WidthType.DXA }, columnWidths: [2000, 3000],
        rows: [['프로젝트명','HARNESS MES'],['산출물명','요구사항 정의서 (전체)'],['버전','v1.0'],['작성일','2026-03-18'],['작성자','HANES MES팀'],['근거문서','공정별요구사항, WBS, 필요프로그램목록']].map(([k,v])=>
          new TableRow({ children: [c(k,2000,{b:true,sh:C.hdr,al:AlignmentType.CENTER,sz:18}), c(v,3000,{sz:18})] })) }),
    ],
  };

  const body = [];
  body.push(h1('\uAC1C\uC815\uC774\uB825'), tbl(['버전','일자','작성자','변경내용'],[['1.0','2026-03-18','HANES MES팀','최초 작성 (전체 모듈 종합)']],[1500,1500,2000,8440]), pb());
  body.push(h1('\uBAA9\uCC28'), new TableOfContents('TOC',{hyperlink:true,headingStyleRange:'1-3'}), pb());

  // 1. 개요
  const totalReqs = reqs.length;
  const frCount = reqs.filter(r=>r.id.startsWith('REQ')).length;
  const nfrCount = reqs.filter(r=>r.id.startsWith('NFR')).length;
  const irCount = reqs.filter(r=>r.id.startsWith('IR')).length;
  const doneCount = reqs.filter(r=>r.st==='구현완료').length;
  const wipCount = reqs.filter(r=>r.st==='구현중').length;
  const holdCount = reqs.filter(r=>r.st==='보류').length;

  body.push(h1('1. \uAC1C\uC694'), h2('1.1 \uBAA9\uC801'),
    p('\uBCF8 \uBB38\uC11C\uB294 HARNESS MES \uC2DC\uC2A4\uD15C\uC758 \uC804\uCCB4 \uAE30\uB2A5/\uBE44\uAE30\uB2A5/\uC778\uD130\uD398\uC774\uC2A4 \uC694\uAD6C\uC0AC\uD56D\uC744 \uC885\uD569\uC801\uC73C\uB85C \uC815\uC758\uD55C\uB2E4.'),
    h2('1.2 \uBC94\uC704'),
    p(`\uAE30\uB2A5 \uC694\uAD6C\uC0AC\uD56D ${frCount}\uAC74, \uBE44\uAE30\uB2A5 ${nfrCount}\uAC74, \uC778\uD130\uD398\uC774\uC2A4 ${irCount}\uAC74 \u2014 \uCD1D ${totalReqs}\uAC74`),
    p(`\uAD6C\uD604\uC644\uB8CC: ${doneCount}\uAC74 / \uAD6C\uD604\uC911: ${wipCount}\uAC74 / \uBCF4\uB958: ${holdCount}\uAC74`),
    h2('1.3 \uADFC\uAC70 \uBB38\uC11C'),
    tbl(['\uBB38\uC11C\uBA85','\uC704\uCE58','\uC124\uBA85'],[
      ['01-공정별-요구사항.md','docs/','MES 고도화 상세 내역서'],
      ['02-WBS.md','docs/','상세 개발 항목 (WBS)'],
      ['04-프로세스.md','docs/','하네스 MES 공정 프로세스'],
      ['05-필요프로그램-원본.md','docs/','1차/2차/3차 개발 프로그램 목록'],
      ['06-필요프로그램-김산K추가분.md','docs/','추가 요구사항 (재고홀드, 폐기 등)'],
      ['요구사항최종.md','docs/','최종 요구사항 비교표'],
    ],[3500,2500,7440]),
    pb());

  // 2. 시스템 개요
  body.push(h1('2. \uC2DC\uC2A4\uD15C \uAC1C\uC694'), h2('2.1 \uC0AC\uC6A9\uC790 \uC720\uD615'),
    tbl(['\uC0AC\uC6A9\uC790 \uC720\uD615','\uC124\uBA85','\uD50C\uB7AB\uD3FC','\uC811\uADFC \uBAA8\uB4C8'],[
      ['시스템관리자','전체 시스템 관리','PC','전체'],
      ['생산관리자','작업지시, 생산계획, 실적 관리','PC','생산, 기준정보'],
      ['품질관리자','IQC, 검사, SPC, CAPA','PC','품질, 계측기'],
      ['자재관리자','입하, 입고, 출고, 재고 관리','PC, PDA','자재, 재고'],
      ['현장작업자','실적입력, 설비점검','PC, PDA','생산, 설비'],
      ['출하담당자','포장, 출하, 반품','PC, PDA','출하'],
    ],[2000,3000,1500,6940]),
    pb());

  // 3. 기능 요구사항
  body.push(h1('3. \uAE30\uB2A5 \uC694\uAD6C\uC0AC\uD56D'));
  const ws = [500,1600,2200,1200,800,900,6240];
  const frReqs = reqs.filter(r=>r.id.startsWith('REQ'));
  body.push(tbl(['No','요구사항ID','요구사항명','모듈','우선순위','상태','상세 설명'],
    frReqs.map((r,i)=>[String(i+1),r.id,r.name,r.mod,r.pri,r.st,r.desc]), ws), pb());

  // 모듈별 상세 (그룹핑)
  const modules = [...new Set(frReqs.map(r=>r.mod))];
  modules.forEach((mod, mi) => {
    body.push(h2(`3.${mi+1} ${mod}`));
    const modReqs = frReqs.filter(r=>r.mod===mod);
    body.push(tbl(['No','요구사항ID','요구사항명','우선순위','상태','상세 설명'],
      modReqs.map((r,i)=>[String(i+1),r.id,r.name,r.pri,r.st,r.desc]),
      [500,1600,2200,900,900,7340]), sp());
  });
  body.push(pb());

  // 4. 비기능 요구사항
  body.push(h1('4. \uBE44\uAE30\uB2A5 \uC694\uAD6C\uC0AC\uD56D'));
  const nfrs = reqs.filter(r=>r.id.startsWith('NFR'));
  body.push(tbl(['No','요구사항ID','요구사항명','분류','우선순위','상태','상세 설명'],
    nfrs.map((r,i)=>[String(i+1),r.id,r.name,r.mod,r.pri,r.st,r.desc]),
    [500,1600,1800,1500,800,900,6340]), pb());

  // 5. 인터페이스 요구사항
  body.push(h1('5. \uC778\uD130\uD398\uC774\uC2A4 \uC694\uAD6C\uC0AC\uD56D'));
  const irs = reqs.filter(r=>r.id.startsWith('IR'));
  body.push(tbl(['No','요구사항ID','요구사항명','우선순위','상태','상세 설명'],
    irs.map((r,i)=>[String(i+1),r.id,r.name,r.pri,r.st,r.desc]),
    [500,1600,2500,900,900,7040]), pb());

  // 6. 제약사항
  body.push(h1('6. \uC81C\uC57D\uC0AC\uD56D'),
    tbl(['\uBD84\uB958','\uC81C\uC57D\uC0AC\uD56D'],[
      ['DB','Oracle Database 사용 (PostgreSQL/MySQL 아님)'],
      ['PK 전략','자연키/복합키 사용 (Auto Increment 금지)'],
      ['패키지 매니저','pnpm 전용 (npm 사용 금지)'],
      ['프론트엔드 포트','3002 (3000, 3001 사용 금지)'],
      ['E2E 테스트','Playwright 사용 금지 (수동 테스트)'],
      ['바코드 방식','HID Mode 아닌 Buffered Mode (Serial/API)'],
      ['개발 단계','1차(THN 생산 대응) → 2차(보완) → 3차(ERP 연동)'],
    ],[2500,10940]), pb());

  // 7. 통계
  body.push(h1('7. \uC694\uAD6C\uC0AC\uD56D \uD1B5\uACC4'));
  // 모듈별 통계
  const allMods = [...new Set(reqs.map(r=>r.mod))];
  const statData = allMods.map((mod,i) => {
    const modR = reqs.filter(r=>r.mod===mod);
    return [String(i+1), mod, String(modR.length),
      String(modR.filter(r=>r.pri==='상').length),
      String(modR.filter(r=>r.pri==='중').length),
      String(modR.filter(r=>r.pri==='하').length),
      String(modR.filter(r=>r.st==='구현완료').length),
      String(modR.filter(r=>r.st!=='구현완료').length)];
  });
  statData.push(['', '합계', String(totalReqs), String(reqs.filter(r=>r.pri==='상').length), String(reqs.filter(r=>r.pri==='중').length), String(reqs.filter(r=>r.pri==='하').length), String(doneCount), String(wipCount+holdCount)]);

  body.push(tbl(['No','모듈','전체','상','중','하','완료','미완료'], statData,
    [500,2000,1000,1000,1000,1000,1200,5740]));

  const bodySection = {
    properties: { page: { size: { width: 11906, height: 16838, orientation: 'landscape' }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'HARNESS MES - \uC694\uAD6C\uC0AC\uD56D \uC815\uC758\uC11C', font: 'Arial', size: 16, color: '999999' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' })] })] }) },
    children: body,
  };

  return new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 18 } } },
      paragraphStyles: [
        { id:'Heading1', name:'Heading 1', basedOn:'Normal', next:'Normal', quickFormat:true, run:{size:32,bold:true,font:'Arial',color:C.primary}, paragraph:{spacing:{before:360,after:240},outlineLevel:0} },
        { id:'Heading2', name:'Heading 2', basedOn:'Normal', next:'Normal', quickFormat:true, run:{size:26,bold:true,font:'Arial',color:'333333'}, paragraph:{spacing:{before:240,after:180},outlineLevel:1} },
      ] },
    sections: [cover, bodySection],
  });
}

async function main() {
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync('docs/deliverables/system', { recursive: true });
  const outPath = 'docs/deliverables/system/요구사항정의서_전체_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);
