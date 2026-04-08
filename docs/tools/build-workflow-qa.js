const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak } = require('docx');

const NAVY = '1B2A4A', ORANGE = 'E76F51', GRAY = '64748B';
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: tb, bottom: tb, left: tb, right: tb };
const nb = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text: t, bold: true, size: 32, font: 'Arial', color: NAVY })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 }, children: [new TextRun({ text: t, bold: true, size: 26, font: 'Arial', color: NAVY })] }); }
function h3(t) { return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 }, children: [new TextRun({ text: t, bold: true, size: 22, font: 'Arial', color: NAVY })] }); }
function p(t, o = {}) { return new Paragraph({ spacing: { after: 80 }, ...o, children: [new TextRun({ text: t, size: 20, font: 'Arial', color: '334155', ...o.run })] }); }
function pRuns(rs) { return new Paragraph({ spacing: { after: 80 }, children: rs.map(r => typeof r === 'string' ? new TextRun({ text: r, size: 20, font: 'Arial', color: '334155' }) : new TextRun({ size: 20, font: 'Arial', color: '334155', ...r })) }); }
function chk(t) { return new Paragraph({ numbering: { reference: 'bl', level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: `\u2610 ${t}`, size: 20, font: 'Arial', color: '334155' })] }); }
function ans() { return p('\u2192 답변: _______________________________________________', { run: { color: '1E40AF' } }); }

function cell(t, o = {}) {
  return new TableCell({ borders, columnSpan: o.colSpan,
    width: o.width ? { size: o.width, type: WidthType.DXA } : undefined,
    shading: o.bg ? { fill: o.bg, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: o.align || AlignmentType.LEFT, spacing: { before: 40, after: 40 },
      children: [new TextRun({ text: t, bold: !!o.bold, size: 18, font: 'Arial', color: o.bg === NAVY ? 'FFFFFF' : '334155' })] })] });
}
function row(...c) { return new TableRow({ children: c }); }

function infoBox(t) {
  return new Table({ columnWidths: [9360], rows: [
    new TableRow({ children: [
      new TableCell({ borders: { top: nb, bottom: nb, right: nb, left: { style: BorderStyle.SINGLE, size: 6, color: ORANGE } },
        shading: { fill: 'FEF3F0', type: ShadingType.CLEAR },
        children: [new Paragraph({ spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: t, size: 18, font: 'Arial', color: '475569', italics: true })] })] }) ] }) ] });
}

function gapBox(t) {
  return new Table({ columnWidths: [9360], rows: [
    new TableRow({ children: [
      new TableCell({ borders: { top: nb, bottom: nb, right: nb, left: { style: BorderStyle.SINGLE, size: 6, color: 'DC2626' } },
        shading: { fill: 'FEF2F2', type: ShadingType.CLEAR },
        children: [new Paragraph({ spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: '\u26A0 ' + t, size: 18, font: 'Arial', color: '991B1B' })] })] }) ] }) ] });
}

function divider() {
  return new Paragraph({ spacing: { before: 200, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1', space: 1 } }, children: [] });
}

const children = [
  // === TITLE ===
  new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: '워크플로우 역질문서', bold: true, size: 44, font: 'Arial', color: NAVY })] }),
  new Paragraph({ spacing: { before: 80 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'HANES MES 프로젝트 — 프로세스 상세 정의', size: 24, font: 'Arial', color: GRAY })] }),
  new Paragraph({ spacing: { before: 200, after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: '작성일: 2026-02-23 | 회신: 각 질문에 선택 또는 기재 후 회신', size: 18, font: 'Arial', color: GRAY })] }),
  divider(),
  infoBox('현재 프로세스 문서와 요구사항에는 "무엇을 한다"만 기술되어 있고, "누가, 언제, 어떤 순서로, 어떤 단위로" 하는지가 생략되어 있어 시스템 간 유기적 연결이 불가능합니다. 본 문서는 각 워크플로우별 상세 절차를 확정하기 위한 역질문서입니다.'),

  // ============================================================
  // WF-01: 자재입하/PO 관리
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-01. 자재입하 / PO 관리'),
  gapBox('현재 상태: PO 관리 구현됨. 입하 시 물리적 절차와 MES 연동 시점이 미정의.'),

  h3('Q1-1. 자재 입하 시 MES 등록 시점은?'),
  p('자재가 공장에 도착했을 때, MES에 언제 누가 등록하나요?'),
  chk('자재 도착 즉시, 자재 담당자가 PO 대비 입하 등록'),
  chk('IQC 완료 후 합격분만 입하 등록 (= 입고와 동시)'),
  chk('별도 입하 절차 불필요 — IQC → 입고만 진행'),
  chk('기타: _______________'),

  h3('Q1-2. PO 대비 수량 차이 시 처리는?'),
  p('PO 1,000개인데 실제 도착이 950개이거나 1,050개인 경우'),
  chk('과부족 관계없이 실 수량으로 입하 등록'),
  chk('부족만 허용, 초과 입하 불가 (반품 처리)'),
  chk('허용 오차율 설정 (예: ±5%) 범위 내 자동 허용'),
  ans(),

  h3('Q1-3. ERP ↔ MES 연동 범위는?'),
  chk('ERP에서 PO 정보를 MES로 자동 전송 (MES에서 PO 직접 생성 불가)'),
  chk('MES에서도 PO 생성 가능 (ERP 미사용 품목 등)'),
  chk('ERP 연동 없음 — MES에서 PO 독립 관리'),
  ans(),

  // ============================================================
  // WF-02: IQC
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-02. IQC (수입검사)'),
  gapBox('현재 상태: IQC 검사 입력 화면 있으나 단순 합불 판정만 구현. 검사항목별 계측값 입력 미구현. 자재라벨 발행 프로세스 미확정.'),

  h3('Q2-1. IQC 검사 대상은 어떻게 결정되나요?'),
  chk('품목마스터의 IQC 구분(무검사/샘플/전수)에 따라 자동 결정'),
  chk('입하 시 담당자가 수동으로 검사 여부 판단'),
  chk('기타: _______________'),

  h3('Q2-2. 샘플검사 시 샘플 수량 기준은?'),
  chk('고정 수량 (예: 입하 수량 무관 5개)'),
  chk('AQL 기준표에 따라 수량 자동 산출'),
  chk('품목별 기준정보에 샘플 수량 지정'),
  ans(),

  h3('Q2-3. IQC 검사 후 자재라벨 발행 절차는?'),
  gapBox('라벨 발행 시점, 발행 주체, 발행 단위가 미정의'),
  chk('IQC 합격 즉시 자동 발행 (합격 건당 1매)'),
  chk('IQC 합격 후 담당자가 수동으로 발행 버튼 클릭'),
  chk('입고 처리 시점에 라벨 발행 (IQC 시점 아님)'),

  h3('Q2-4. 자재라벨에 포함될 정보는?'),
  p('(해당 항목 모두 체크)'),
  chk('품번 / 품명'), chk('자재 LOT 번호'), chk('MES 시리얼 번호 (바코드)'),
  chk('입고일 / 유효기한'), chk('수량'), chk('PO 번호'),
  chk('공급업체(벤더) 정보'), chk('적재 로케이션'),
  chk('기타: _______________'),

  h3('Q2-5. IQC 파괴검사 샘플에 대한 수량 처리는?'),
  chk('파괴 수량만큼 입고 수량에서 차감'),
  chk('파괴 수량을 별도 기타출고로 처리'),
  chk('파괴 수량은 관리하지 않음 (소량이므로)'),
  ans(),

  h3('Q2-6. 제조사 바코드 ↔ MES 바코드 매핑은?'),
  gapBox('요구사항에 "상당히 중요, 반드시 구현 필요"로 명시됨. 상세 로직 미정.'),
  p('자재 제조사가 부착한 기존 바코드와 MES 내부 바코드의 관계는?'),
  chk('제조사 바코드 스캔 → MES가 자동으로 품번 매칭 (매핑 테이블 기반)'),
  chk('제조사 바코드 무시 → MES 자체 라벨만 사용'),
  chk('둘 다 사용 (제조사 바코드로 입고, 이후 MES 라벨 부착)'),
  ans(),

  // ============================================================
  // WF-03: 자재입고
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-03. 자재입고'),
  gapBox('현재 상태: 입고 화면 있으나 바코드 스캔 연동 없음. PDA 미구현. 입고 취소 조건 확정 필요.'),

  h3('Q3-1. 입고 작업 절차는?'),
  p('자재를 창고에 넣을 때의 단계별 절차를 확인합니다.'),
  chk('IQC 합격 확인 → 자재라벨 스캔 → 창고/로케이션 선택 → 입고 확정'),
  chk('IQC 합격 확인 → 창고/로케이션 바코드 스캔 → 자재 바코드 스캔 → 자동 입고'),
  chk('기타: _______________'),

  h3('Q3-2. 입고 작업 주체는?'),
  chk('자재 담당자 (PC에서)'),
  chk('창고 담당자 (PDA로 현장에서)'),
  chk('자재 담당자가 PC에서 등록 + 창고 담당자가 PDA로 적치 확인'),
  ans(),

  h3('Q3-3. 로케이션 지정 방식은?'),
  chk('품목별 고정 로케이션 (기준정보에 설정)'),
  chk('빈 로케이션에 자유 적치 (적치 시 로케이션 스캔)'),
  chk('시스템이 로케이션 추천 → 작업자가 확인/변경'),
  ans(),

  h3('Q3-4. 수입품 불량 입고 처리는?'),
  infoBox('프로세스 문서: "수입품일 경우 불량도 입고 처리"'),
  chk('IQC 불합격이라도 입고 가능 (불량 상태로 별도 관리)'),
  chk('불합격분은 별도 불량 창고에 입고'),
  chk('불합격분은 입고하지 않고 반품 대기'),
  ans(),

  // ============================================================
  // WF-04: 자재불출
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-04. 자재불출 (출고/이동)'),
  gapBox('현재 상태: 작업지시 기반 불출요청 있으나 바코드 리딩 미구현. 자재 분할/병합 상세 로직 미정.'),

  h3('Q4-1. 불출 트리거는?'),
  chk('작업지시 생성 시 BOM 기반 불출요청 자동 생성 → 자재 담당자가 처리'),
  chk('현장 작업자가 직접 불출 요청 (수동)'),
  chk('자재 담당자가 작업지시서 확인 후 직접 불출 등록'),
  ans(),

  h3('Q4-2. 불출 작업 절차는?'),
  chk('불출요청서 바코드 스캔 → 자재 바코드 스캔 → 수량 확인 → 불출 확정'),
  chk('작업지시 선택 → BOM 자재 목록 표시 → 자재 바코드 스캔 → 불출'),
  chk('기타: _______________'),

  h3('Q4-3. 불출 시 자재 수량 처리는?'),
  gapBox('벌크자재 분할 시 라벨 처리 절차 미정'),
  p('예: 전선 1,000m 릴에서 작업지시에 필요한 300m만 불출하는 경우'),
  chk('분할 등록 → 원 시리얼 사용중지 → 700m/300m 두 개의 새 시리얼 생성 → 각각 라벨 발행'),
  chk('원 시리얼 유지하면서 불출 수량만 차감 (분할 없이)'),
  chk('기타: _______________'),

  h3('Q4-4. 자재를 설비에 투입할 때 누가 스캔하나요?'),
  gapBox('자재 스캔 주체와 시점이 미정의 — 생산실적 입력과의 연결 끊김'),
  chk('작업자가 설비에 자재 장착 전에 자재 바코드 스캔'),
  chk('자재 담당자가 불출 시점에 스캔 (현장 투입은 스캔 없음)'),
  chk('자재 불출 시 자동으로 설비에 매핑 (스캔 불필요)'),
  ans(),

  h3('Q4-5. 모델 변경(품목 전환) 시 잔여 자재 처리는?'),
  gapBox('라인/설비에서 모델 변경 시 기존 자재 회수 절차 미정의'),
  chk('작업자가 잔여 자재를 자재 창고에 반납 → 반납 바코드 스캔'),
  chk('현장 보관 로케이션에 이동 (반납 없음) → 로케이션 이동 처리'),
  chk('모델 변경과 무관하게 동일 자재면 계속 사용'),
  chk('기타: _______________'),

  h3('Q4-6. 선입선출(FIFO) 강제 방법은?'),
  chk('시스템이 자동으로 입고일 순서대로 불출 대상 지정 (다른 LOT 선택 불가)'),
  chk('입고일 순서 추천하되 작업자가 다른 LOT 선택 가능 (경고만)'),
  chk('FIFO 관리하지 않음'),
  ans(),

  // ============================================================
  // WF-05: 작업지시
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-05. 작업지시'),
  gapBox('현재 상태: 작업지시 생성 구현됨. 완제품 기준 반제품 동시 생성 로직 상세 미정. 트리 형태 현황 미구현.'),

  h3('Q5-1. 작업지시 생성 단위는?'),
  chk('완제품 기준 1건 생성 → 반제품 작업지시는 BOM 기반 자동 생성'),
  chk('공정별로 개별 생성 (반제품 단위)'),
  chk('둘 다 가능 (완제품 기준 자동 + 반제품 단독 생성)'),
  ans(),

  h3('Q5-2. 작업지시 수량과 실제 생산 수량의 관계는?'),
  chk('작업지시 수량 이상 생산 불가 (초과 시 차단)'),
  chk('작업지시 수량 초과 생산 가능 (경고만)'),
  chk('작업지시 수량은 참고용, 실생산 수량은 자유'),
  ans(),

  h3('Q5-3. 동일 설비에서 복수 작업지시 동시 진행 가능?'),
  chk('불가 — 1 설비 = 1 작업지시 (전 작업지시 완료 후 다음 진행)'),
  chk('가능 — 같은 설비에서 여러 작업지시 전환 가능 (혼입 주의)'),
  chk('같은 품번이면 가능, 다른 품번이면 불가'),
  ans(),

  h3('Q5-4. 작업지시서 출력물에 포함할 정보는?'),
  chk('작업지시 번호 (바코드)'), chk('품목 정보 / BOM 목록'), chk('공정 라우팅'),
  chk('필요 자재 목록 + 불출요청서'), chk('작업 조건 (길이, 탈피값, 압착값 등)'),
  chk('작업지도서 이미지'), chk('기타: _______________'),

  // ============================================================
  // WF-06: 생산실적 (공통)
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-06. 생산실적 입력 (공통)'),
  gapBox('현재 상태: 리스트 선택 후 키인 입력만 구현. 바코드 없어 실물과 비교 불가. 프로그램 분기 미구현.'),

  h3('Q6-1. 실적 입력 단위는?'),
  gapBox('핵심 질문: 한 번에 1개씩 등록? 모아서 N개 등록? 이에 따라 전체 시스템 구조가 달라짐'),
  chk('낱개 등록 — 제품 1개 생산할 때마다 즉시 등록 (바코드 스캔)'),
  chk('묶음 등록 — 일정 수량(예: 10개, 50개) 생산 후 한 번에 등록'),
  chk('교대 종료 시 일괄 등록 — 교대 동안 생산한 전체 수량을 한 번에'),
  chk('공정별로 다름 (예: 절단은 묶음, 조립은 낱개)'),
  ans(),
  p('→ 묶음/일괄인 경우, 묶음 단위는? ___개 또는 ___단위', { run: { color: '1E40AF' } }),

  h3('Q6-2. 생산실적 입력 시 화면 진입 방식은?'),
  infoBox('요구사항: "메뉴는 하나지만 바코드 스캔을 통해 프로그램 분기 필요"'),
  chk('설비 QR 스캔 → 해당 설비의 공정에 맞는 입력 화면 자동 표시'),
  chk('메뉴에서 공정 선택 → 설비 선택 → 입력 화면'),
  chk('통합 메뉴 → 바코드 유형(설비/자재/제품) 자동 인식 → 화면 분기'),
  ans(),

  h3('Q6-3. 양품/불량 수량 입력 방식은?'),
  chk('양품 수량 + 불량 수량을 각각 수동 키인'),
  chk('생산 수량 입력 → 불량 수량만 별도 입력 → 양품은 자동 계산'),
  chk('바코드 스캔으로 자동 카운트 (양품 스캔 / 불량은 별도 등록)'),
  chk('설비에서 양품/불량 자동 카운트 데이터 수신'),
  ans(),

  h3('Q6-4. 실적 등록 시 자재 투입 확인 절차는?'),
  gapBox('현재 자재 투입 확인 프로세스 없음. 어느 자재를 사용했는지 기록 불가.'),
  chk('실적 등록 전 자재 바코드 스캔 필수 → BOM 대비 자동 검증'),
  chk('실적 등록 시 자재 LOT 드롭다운 선택'),
  chk('자재 불출 시점에 이미 매핑됨 → 실적 등록 시 자동 연결'),
  chk('자재 투입 확인 하지 않음 (추적성 포기)'),
  ans(),

  h3('Q6-5. 설비 조건값 입력은 어떻게?'),
  infoBox('프로세스 문서: "설비 동작조건 데이터 입력 (직접입력)" — 전선길이, 탈피값, 압착값, 융착조건 등'),
  chk('작업지시의 공정 파라미터에서 자동 로딩 → 작업자가 확인만'),
  chk('작업자가 매번 수동 입력'),
  chk('설비에서 자동 수신 (설비 IF 구현 시)'),
  ans(),

  // ============================================================
  // WF-07: 추적성 라벨 / 시리얼 관리
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-07. 추적성 라벨 / 시리얼 관리'),
  gapBox('핵심 미정의 영역: 라벨 발행 시점, 발행 단위, 부착 주체, 공정 간 연결 방법이 모두 미확정. 추적성 체계의 근간.'),

  h3('Q7-1. 제품 시리얼(LOT) 바코드는 어느 공정에서 처음 생성되나요?'),
  chk('와이어 절단 (최초 공정) — 묶음 단위로 시리얼 생성'),
  chk('준비공정 — 회선들이 합쳐지는 시점에서'),
  chk('조립 — 반제품 파트가 합쳐져 완제품이 되는 시점'),
  chk('공정마다 다름: 절단=묶음시리얼, 준비공정=개별시리얼, 조립=완제품시리얼'),
  ans(),

  h3('Q7-2. 라벨 발행 시점은?'),
  gapBox('프로세스 문서에 "생산라벨발행(묶음)", "생산라벨발행(개별)" 등 언급되나 정확한 트리거 미정'),
  chk('실적 등록 완료 시 자동 발행'),
  chk('양품 판정 후 수동 발행 (작업자가 발행 버튼 클릭)'),
  chk('공정 완료 후 다음 공정 이동 전에 발행'),
  ans(),

  h3('Q7-3. 라벨 부착은 누가 하나요?'),
  chk('생산 작업자가 직접 부착'),
  chk('별도 라벨 부착 담당자'),
  chk('공정에 따라 다름 (예: 절단=작업자, 검사=검사원)'),
  ans(),

  h3('Q7-4. 묶음 시리얼과 개별 시리얼의 관계는?'),
  infoBox('절단에서 50개 묶음 시리얼 생성 → 이후 공정에서 낱개 작업 시 어떻게 연결?'),
  chk('묶음 시리얼에서 개별 시리얼로 분할 (분할 시점 기록)'),
  chk('묶음 시리얼을 유지하면서 내부적으로 개별 추적'),
  chk('특정 공정(예: 조립)에서 묶음→개별 전환'),
  ans(),

  h3('Q7-5. 반제품 → 완제품 조립 시 시리얼 연결은?'),
  gapBox('반제품 파트 A + B + C → 완제품 D 생산 시 시리얼 연결 방법 미정'),
  chk('각 반제품 바코드 스캔 → 완제품 시리얼에 자동 연결 (부모-자식 관계)'),
  chk('작업지시 기준으로 자동 연결 (스캔 없이)'),
  chk('기타: _______________'),

  h3('Q7-6. 불량품 라벨은?'),
  infoBox('프로세스: "불량 판정시 불량품 라벨 발행"'),
  chk('불량 등록 시 자동으로 불량 라벨 발행 (빨간색 등 구분)'),
  chk('불량 등록 후 수동 발행'),
  chk('기존 양품 라벨 위에 불량 스티커만 부착'),
  ans(),

  // ============================================================
  // WF-08: 샘플검사 (초물검사)
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-08. 샘플검사 (초물검사)'),
  gapBox('현재 상태: 입력 화면 없음 (요구사항 X). 수기 입력 중. 측정값 정상범위 미확정.'),

  h3('Q8-1. 샘플검사 절차는?'),
  p('압착/초음파 공정 시작 전 샘플을 만들어 검사하는 절차'),
  chk('설비 조건 설정 → 샘플 N개 제작 → 배럴 측정 → 인장력 측정 → 합격 시 양산 시작'),
  chk('설비 조건 설정 → 테스트 가동 → 자동 측정 → MES에 결과 전송 → 합격 시 양산'),
  chk('기타: _______________'),

  h3('Q8-2. 샘플 검사 수량은?'),
  chk('고정 (항상 N개) → N = ___개'),
  chk('품목별 기준정보에 지정'),
  chk('작업자 재량'),
  ans(),

  h3('Q8-3. 측정값 입력 방식은?'),
  chk('작업자가 수동 키인 (낱개별 측정값)'),
  chk('측정 장비에서 MES로 자동 전송 (설비 IF)'),
  chk('합불 판정만 입력 (측정값 기록 불필요)'),
  ans(),

  h3('Q8-4. 샘플 제작에 사용된 자재는 어떻게 처리?'),
  chk('파괴검사이므로 불량 수량으로 기록'),
  chk('샘플 수량으로 별도 기록 (양품/불량과 구분)'),
  chk('자재 사용량에 포함하되 생산 수량에서 제외'),
  ans(),

  // ============================================================
  // WF-09: 불량 등록 / 폐기
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-09. 불량 등록 / 폐기'),
  gapBox('현재 상태: 폐기 프로그램 미구현 (요구사항 X). 불량 처리 프로세스 미정의.'),

  h3('Q9-1. 불량 발견 시 등록 절차는?'),
  chk('생산 실적 입력 시 불량 수량으로 함께 등록 (별도 등록 불필요)'),
  chk('불량품 바코드 스캔 → 불량 유형 선택 → 불량 등록 (별도 화면)'),
  chk('둘 다 (실적에 불량 수량 포함 + 불량 상세 별도 등록)'),
  ans(),

  h3('Q9-2. 불량 유형은 어떻게 관리?'),
  chk('공통코드로 불량 유형 관리 (예: 외관불량, 치수불량, 기능불량 등)'),
  chk('공정별로 다른 불량 유형 목록'),
  chk('불량 유형 구분 없이 불량 수량만 관리'),
  ans(),

  h3('Q9-3. 불량품의 물리적 처리 흐름은?'),
  chk('불량 등록 → 불량 라벨 부착 → 불량품 보관 영역에 격리 → 폐기/재작업 판정'),
  chk('불량 등록 → 즉시 폐기 (재작업 없음)'),
  chk('불량 등록 → 품질팀이 판정 (재작업/폐기/특채 등)'),
  ans(),

  h3('Q9-4. 폐기 시 자재 재고 처리는?'),
  chk('불량품에 투입된 자재는 자동 재고 차감 (이미 불출 시 차감됨)'),
  chk('폐기 등록 시 자재 사용량을 별도 기록'),
  chk('자재 재고와 연동하지 않음'),
  ans(),

  // ============================================================
  // WF-10: 외관검사
  // ============================================================
  divider(),
  h1('WF-10. 외관검사'),
  gapBox('현재 상태: 단순 합불 판정만. 검사 기준/항목 미정. ERP 실적 연동 시점.'),

  h3('Q10-1. 외관검사 범위는?'),
  chk('전수검사 (모든 완성품)'),
  chk('샘플검사 (일부만)'),
  chk('고객사 요구에 따라 품목별 상이'),
  ans(),

  h3('Q10-2. 외관검사 입력 방식은?'),
  chk('제품 바코드 스캔 → 합격/불합격 판정 → 결과 저장'),
  chk('작업지시 선택 → 검사 수량/합격 수량 키인'),
  chk('기타: _______________'),

  h3('Q10-3. 외관검사 합격 후 라벨은?'),
  chk('외관검사 합격 시 별도 합격 라벨 발행'),
  chk('통합검사에서 발행된 품질합격 라벨 유지 (추가 라벨 없음)'),
  chk('기타: _______________'),

  // ============================================================
  // WF-11: 제품포장
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-11. 제품포장'),
  gapBox('현재 상태: 단순 데이터 처리. 바코드 연동 없음. 포장 바코드 규격 미확정 (THN 확인 예정).'),

  h3('Q11-1. 포장 단위와 용기 유형은?'),
  p('(복수 선택 가능)'),
  chk('밀봉박스 (1회용) — 박스 바코드 라벨 발행 필요'),
  chk('플라스틱박스 (반복 사용) — 고정 바코드 부착'),
  chk('대차 (반복 사용) — 고정 바코드 부착'),
  p('→ 포장 단위 수량은 품목 기준정보의 포장단위 참조? [ ] 예 / [ ] 아니오'),

  h3('Q11-2. 포장 절차는?'),
  chk('포장 용기 바코드 스캔 → 제품 바코드 스캔(1개씩) → 수량 도달 시 포장 완료'),
  chk('포장 용기 바코드 스캔 → 작업지시 선택 → 포장 수량 키인 → 완료'),
  chk('기타: _______________'),

  h3('Q11-3. 제품 혼입 방지 체크 시점은?'),
  chk('제품 스캔 시 실시간 체크 (다른 품번/작업지시 즉시 경고)'),
  chk('포장 완료 시 일괄 체크'),
  chk('기타: _______________'),

  h3('Q11-4. 과포장/부족 포장 처리는?'),
  infoBox('요구사항: "과포장 방지, 포장단위 이하 포장은 가능"'),
  chk('포장단위 초과 시 차단 (추가 스캔 불가)'),
  chk('포장단위 미만은 허용 (잔량 포장)'),
  chk('기타: _______________'),

  // ============================================================
  // WF-12: 제품창고 입고 / 팔레트
  // ============================================================
  divider(),
  h1('WF-12. 제품창고 입고 / 팔레트 구성'),
  gapBox('현재 상태: 제품 재고 조회 있으나 제품창고 입고 절차 미정의. 팔레트 구성 프로세스 없음.'),

  h3('Q12-1. 포장 완료 후 제품창고 입고 절차는?'),
  chk('포장 완료 시 자동으로 제품 재고 등록 (별도 입고 불필요)'),
  chk('포장 완료 → 제품창고로 이동 → 창고에서 바코드 스캔 → 입고 확정'),
  chk('기타: _______________'),

  h3('Q12-2. 팔레트 구성이 필요한가요?'),
  chk('필요 — 여러 박스를 팔레트로 구성 → 팔레트 바코드 발행'),
  chk('불필요 — 박스 단위로 출하'),
  chk('고객사에 따라 다름'),
  ans(),

  h3('Q12-3. 팔레트 구성 시 혼적 허용?'),
  chk('동일 품번만 가능'), chk('동일 품번 + 동일 작업지시만 가능'),
  chk('다른 품번 혼적 가능 (고객사별 정책)'), chk('기타: _______________'),

  // ============================================================
  // WF-13: 출하지시 / 제품출하
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-13. 출하지시 / 제품출하'),
  gapBox('현재 상태: 출하지시/실적 기본 구현됨. 출하지시서 바코드 연동, 선적 절차 상세 미정.'),

  h3('Q13-1. 출하지시 생성 주체는?'),
  chk('영업 담당자가 MES에서 직접 생성'),
  chk('ERP에서 출하지시 수신 (MES는 실행만)'),
  chk('둘 다 가능'),
  ans(),

  h3('Q13-2. 출하 실적 등록 절차는?'),
  chk('출하지시서 바코드 스캔 → 포장(박스/팔레트) 바코드 스캔 → 작업자 스캔 → 출하 확정'),
  chk('출하지시 선택 → 제품 목록에서 출하 대상 선택 → 출하'),
  chk('기타: _______________'),

  h3('Q13-3. 출하 시 수량 검증은?'),
  chk('출하지시 수량과 스캔된 제품 수량 일치해야 출하 가능'),
  chk('부분 출하 가능 (잔량은 다음 출하로)'),
  chk('초과 출하 가능 여부: [ ] 불가 / [ ] 가능'),
  ans(),

  h3('Q13-4. 출하 취소 조건은?'),
  infoBox('요구사항: "출하취소는 당일까지만"'),
  chk('당일 출하분만 취소 가능'),
  chk('출하 후 N시간 이내 취소 가능 → N = ___시간'),
  chk('관리자 승인 시 기간 무관 취소 가능'),
  ans(),

  // ============================================================
  // WF-14: 출하반품
  // ============================================================
  divider(),
  h1('WF-14. 출하반품'),
  gapBox('현재 상태: 출하반품 프로세스 미정의.'),

  h3('Q14-1. 반품 사유 유형은?'),
  chk('고객 불량 반품'), chk('오출하 반품'), chk('수량 과다 반품'),
  chk('기타: _______________'),

  h3('Q14-2. 반품 시 재고 처리는?'),
  chk('반품 등록 → 입고검사(IQC) → 합격 시 제품 재고 복원'),
  chk('반품 등록 → 즉시 제품 재고 복원 (검사 없이)'),
  chk('반품 등록 → 불량 재고로 별도 관리 (재고 복원 안 함)'),
  ans(),

  // ============================================================
  // WF-15: 재작업 / 수리
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-15. 재작업 / 수리'),
  gapBox('현재 상태: "재작업 내용만 남김 (직접 입력), 불량시 폐기" — 상세 프로세스 미정의.'),

  h3('Q15-1. 재작업 대상 판정은 누가?'),
  chk('생산 현장에서 작업자가 판단'),
  chk('품질팀에서 불량품 검토 후 재작업/폐기 판정'),
  chk('기타: _______________'),

  h3('Q15-2. 재작업 시 시리얼은?'),
  chk('기존 시리얼 유지 (재작업 이력만 추가)'),
  chk('새 시리얼 발급 (기존 시리얼과 연결 기록)'),
  ans(),

  h3('Q15-3. 재작업 후 공정 흐름은?'),
  chk('불량 발생 공정부터 다시 시작'),
  chk('재작업 전용 공정 → 합격 시 원래 후속 공정으로 복귀'),
  chk('재작업 후 처음부터 전체 공정 재진행'),
  ans(),

  h3('Q15-4. 재작업 실적은 원 작업지시에 포함?'),
  chk('원 작업지시의 실적으로 포함 (양품 수량에 합산)'),
  chk('별도 재작업 작업지시 생성'),
  chk('재작업 이력만 남기고 작업지시와 무관'),
  ans(),

  // ============================================================
  // WF-16: 바코드 스캐닝 / 공통 인프라
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-16. 바코드 스캐닝 / 공통 인프라'),
  gapBox('요구사항: "바코드 스캐닝은 HID Mode가 아닌 Buffered Mode로 스캔하여 바코드 유형을 시스템에서 구분" — 상세 아키텍처 미정.'),

  h3('Q16-1. 바코드 스캐너 타입은?'),
  chk('유선 핸디 스캐너 (각 PC에 연결)'),
  chk('무선 핸디 스캐너 (블루투스/WiFi)'),
  chk('고정형 스캐너 (설비에 부착)'),
  chk('PDA 내장 스캐너'),
  chk('혼용: _______________'),

  h3('Q16-2. 바코드 유형 자동 인식이 필요한 항목은?'),
  p('하나의 스캔 입력으로 시스템이 자동 분기해야 하는 바코드 종류'),
  chk('설비코드 QR'), chk('자재 바코드'), chk('제품(시리얼) 바코드'),
  chk('작업자 QR'), chk('작업지시 바코드'), chk('포장(박스) 바코드'),
  chk('소모품 QR'), chk('로케이션 바코드'),

  h3('Q16-3. 바코드 체계(포맷)는 확정되었나요?'),
  chk('THN에서 규격 전달 예정 (미확정)'),
  chk('자체 규격 설계 필요'),
  chk('기존 규격 있음 → 규격서: _______________'),

  h3('Q16-4. PDA 필요 공정/기능은?'),
  chk('설비 일상점검'), chk('자재 입고'), chk('자재 불출'),
  chk('자재 재고실사'), chk('제품 출하'), chk('제품 재고실사'),
  chk('생산실적 입력'), chk('기타: _______________'),

  // ============================================================
  // WF-17: 종합 — 끊어진 연결 확인
  // ============================================================
  new Paragraph({ children: [new PageBreak()] }),
  h1('WF-17. 종합 — 워크플로우 간 연결 확인'),
  infoBox('아래는 현재 문서에서 확인된 워크플로우 간 "끊어진 연결"입니다. 각 항목에 대해 처리 방안을 확인해 주세요.'),

  new Table({ columnWidths: [600, 2600, 3400, 2760], rows: [
    row(cell('#', {bold:true, bg:NAVY, align:AlignmentType.CENTER}), cell('끊어진 연결', {bold:true, bg:NAVY}), cell('질문', {bold:true, bg:NAVY}), cell('답변/선택', {bold:true, bg:NAVY})),
    row(cell('1', {align:AlignmentType.CENTER}), cell('IQC → 자재입고'), cell('IQC 합격 시 자동 입고? 별도 입고 절차?'), cell('')),
    row(cell('2', {align:AlignmentType.CENTER}), cell('자재불출 → 설비 투입'), cell('불출된 자재가 설비에 투입되는 확인 방법?'), cell('')),
    row(cell('3', {align:AlignmentType.CENTER}), cell('설비 투입 → 생산실적'), cell('투입 자재와 생산실적의 연결 방법?'), cell('')),
    row(cell('4', {align:AlignmentType.CENTER}), cell('절단(묶음) → 개별공정'), cell('묶음 시리얼이 개별 시리얼로 전환되는 시점?'), cell('')),
    row(cell('5', {align:AlignmentType.CENTER}), cell('반제품 실적 → 조립'), cell('각 반제품 실적이 완제품 조립에 연결되는 방법?'), cell('')),
    row(cell('6', {align:AlignmentType.CENTER}), cell('통합검사 → 외관검사'), cell('통합검사 합격품이 외관검사로 이동되는 추적?'), cell('')),
    row(cell('7', {align:AlignmentType.CENTER}), cell('외관검사 → 포장'), cell('외관검사 합격품만 포장 가능하게 하는 방법?'), cell('')),
    row(cell('8', {align:AlignmentType.CENTER}), cell('포장 → 제품창고'), cell('포장 완료 후 제품 재고 등록 시점?'), cell('')),
    row(cell('9', {align:AlignmentType.CENTER}), cell('제품창고 → 출하'), cell('출하지시 대비 어떤 재고를 할당하는 방법?'), cell('')),
    row(cell('10', {align:AlignmentType.CENTER}), cell('불량 → 재작업/폐기'), cell('불량품이 재작업/폐기로 분기되는 판정 절차?'), cell('')),
    row(cell('11', {align:AlignmentType.CENTER}), cell('모델 변경 → 자재 회수'), cell('라인 모델 전환 시 잔여 자재 처리 절차?'), cell('')),
    row(cell('12', {align:AlignmentType.CENTER}), cell('ERP ↔ MES'), cell('실적/재고 ERP 전송 시점과 방법?'), cell('')),
  ]}),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 20 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, color: NAVY, font: 'Arial' },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: NAVY, font: 'Arial' },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, color: NAVY, font: 'Arial' },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: { config: [
    { reference: 'bl', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ]},
  sections: [{
    properties: { page: { margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } } },
    headers: { default: new Header({ children: [
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ text: 'HANES MES - 워크플로우 역질문서', size: 16, font: 'Arial', color: GRAY, italics: true }) ] }) ] }) },
    footers: { default: new Footer({ children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: '- ', size: 16, font: 'Arial', color: GRAY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: GRAY }),
        new TextRun({ text: ' / ', size: 16, font: 'Arial', color: GRAY }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Arial', color: GRAY }),
        new TextRun({ text: ' -', size: 16, font: 'Arial', color: GRAY }),
      ] }) ] }) },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('C:/Project/HANES/docs/06-워크플로우-역질문서.docx', buf);
  console.log('Done!');
}).catch(e => { console.error(e); process.exit(1); });
