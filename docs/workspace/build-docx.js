const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak } = require('docx');

const NAVY = '1B2A4A';
const ORANGE = 'E76F51';
const GRAY = '64748B';
const LIGHT_BG = 'F1F5F9';
const WHITE = 'FFFFFF';
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: tb, bottom: tb, left: tb, right: tb };
const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, font: 'Arial', color: NAVY })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Arial', color: NAVY })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color: NAVY })] });
}
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: 80 }, ...opts,
    children: [new TextRun({ text, size: 20, font: 'Arial', color: '334155', ...opts.run })] });
}
function pRuns(runs, opts = {}) {
  return new Paragraph({ spacing: { after: 80 }, ...opts,
    children: runs.map(r => typeof r === 'string' ? new TextRun({ text: r, size: 20, font: 'Arial', color: '334155' }) : new TextRun({ size: 20, font: 'Arial', color: '334155', ...r })) });
}
function bullet(text, ref = 'bl', level = 0) {
  return new Paragraph({ numbering: { reference: ref, level }, spacing: { after: 60 },
    children: [new TextRun({ text, size: 20, font: 'Arial', color: '334155' })] });
}
function bulletRuns(runs, ref = 'bl', level = 0) {
  return new Paragraph({ numbering: { reference: ref, level }, spacing: { after: 60 },
    children: runs.map(r => typeof r === 'string' ? new TextRun({ text: r, size: 20, font: 'Arial', color: '334155' }) : new TextRun({ size: 20, font: 'Arial', color: '334155', ...r })) });
}
function check(text) {
  return bullet(`\u2610 ${text}`, 'bl');
}

function cell(text, opts = {}) {
  const { bold, bg, align, width, colSpan } = opts;
  return new TableCell({
    borders, columnSpan: colSpan,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align || AlignmentType.LEFT, spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, bold: !!bold, size: 18, font: 'Arial', color: bg === NAVY ? WHITE : '334155' })] })]
  });
}
function cellRuns(runs, opts = {}) {
  const { bg, align, width } = opts;
  return new TableCell({
    borders, width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align || AlignmentType.LEFT, spacing: { before: 40, after: 40 },
      children: runs.map(r => typeof r === 'string' ? new TextRun({ text: r, size: 18, font: 'Arial', color: '334155' }) : new TextRun({ size: 18, font: 'Arial', color: '334155', ...r })) })]
  });
}
function row(...cells) { return new TableRow({ children: cells }); }

function infoBox(text) {
  return new Table({
    columnWidths: [9360], rows: [
      new TableRow({ children: [
        new TableCell({ borders: { top: noBorder, bottom: noBorder, right: noBorder, left: { style: BorderStyle.SINGLE, size: 6, color: ORANGE } },
          shading: { fill: 'FEF3F0', type: ShadingType.CLEAR },
          children: [new Paragraph({ spacing: { before: 60, after: 60 },
            children: [new TextRun({ text, size: 18, font: 'Arial', color: '475569', italics: true })] })] }) ] })
    ] });
}

function divider() {
  return new Paragraph({ spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1', space: 1 } },
    children: [] });
}

// Table helpers
const W = [2200, 3200, 3960]; // 3-col default
const W4 = [1800, 2500, 2500, 2560]; // 4-col

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
  numbering: {
    config: [
      { reference: 'bl', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'bl2', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: { margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } }
    },
    headers: {
      default: new Header({ children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [
          new TextRun({ text: 'HANES MES - 인터락 역질문서', size: 16, font: 'Arial', color: GRAY, italics: true }) ] }) ] })
    },
    footers: {
      default: new Footer({ children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: '- ', size: 16, font: 'Arial', color: GRAY }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: GRAY }),
          new TextRun({ text: ' / ', size: 16, font: 'Arial', color: GRAY }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Arial', color: GRAY }),
          new TextRun({ text: ' -', size: 16, font: 'Arial', color: GRAY }),
        ] }) ] })
    },
    children: [
      // === TITLE ===
      new Paragraph({ spacing: { before: 600, after: 0 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '인터락 구현을 위한 역질문서', bold: true, size: 44, font: 'Arial', color: NAVY })] }),
      new Paragraph({ spacing: { before: 100, after: 40 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'HANES MES 프로젝트', size: 24, font: 'Arial', color: GRAY })] }),
      new Paragraph({ spacing: { before: 200, after: 60 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '작성일: 2026-02-23 | 회신 요청: 해당 항목에 체크(\u2611) 또는 기재 후 회신', size: 18, font: 'Arial', color: GRAY })] }),
      divider(),
      infoBox('04-프로세스.md에 인터락 조건이 나열되어 있으나, 구체적인 구현 방식이 미정의 상태입니다. 아래 질문에 대한 답변을 통해 인터락 시스템의 설계 방향을 확정합니다.'),

      // === 1. 인터락 차단 수준 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('1. 인터락 차단 수준'),
      p('인터락이 발동되었을 때, 작업을 어떤 수준으로 막을 것인가?'),
      h2('Q1-1. 기본 차단 수준 선택'),
      new Table({ columnWidths: [1600, 3400, 2200, 2160], rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('화면 예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('A. Hard Block', {bold:true}), cell('조건 미충족 시 작업 진행 불가. 버튼 비활성화, API 거부'), cell('"실적등록" 버튼 비활성화. "설비 일상점검을 먼저 완료하세요" 안내'), cell('없음 (기본 구현)')),
        row(cell('B. Soft Block', {bold:true}), cell('경고 팝업 표시 후, 권한자 승인으로 우회 가능'), cell('"설비점검 미실시 상태입니다. 관리자 승인 후 진행하시겠습니까?" → 관리자 ID/PW 입력'), cellRuns([{text:'승인 권한 체계 필요', bold:true}, ', 승인 UI 개발, 우회 사유 입력란'])),
        row(cell('C. Warning Only', {bold:true}), cell('경고 표시만 하고 작업은 허용. 이력만 남김'), cell('"주의: 부품 사용횟수 초과 (12,340/10,000)" 배너 표시, 작업 가능'), cellRuns([{text:'이력 테이블 필요', bold:true}, ' (경고 무시 이력 기록)'])),
      ]}),
      check('A. Hard Block'), check('B. Soft Block'), check('C. Warning Only'), check('기타: _______________'),

      divider(),
      h2('Q1-2. 인터락 조건별로 차단 수준을 다르게 가져갈 것인가?'),
      infoBox('예시: "설비점검 미실시"는 Hard Block, "부품 사용횟수 초과"는 Soft Block, "공정순서 미일치"는 Warning Only 등'),
      check('동일 — 모든 인터락에 같은 차단 수준 적용'),
      check('조건별 차등 — 인터락 종류마다 차단 수준을 다르게 설정'),
      infoBox('"조건별 차등" 선택 시: 인터락 유형별 차단 수준 매핑 테이블 필요 (DB 또는 설정 파일). 3장의 각 인터락 조건마다 차단 수준을 별도 지정 필요.'),

      divider(),
      h2('Q1-3. Soft Block 우회 승인 방식'),
      p('(Q1-1 또는 Q1-2에서 Soft Block 선택 시)', { run: { italics: true, color: GRAY } }),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('화면 예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('관리자 ID/PW 입력', {bold:true}), cell('팝업에 ID, 비밀번호 입력 → 로그인 검증 → 승인 권한 확인'), cell('승인 가능 역할(Role) 정의 필요')),
        row(cell('관리자 QR 스캔', {bold:true}), cell('"관리자 QR을 스캔하세요" → QR 인식 → 승인'), cell('관리자 QR 카드 발급, PC에 QR 리더기 설치')),
        row(cell('관리자 사번 입력', {bold:true}), cell('관리자 사번 입력 → 사번 유효성 확인 → 승인'), cell('작업자마스터에 승인권한 플래그 추가')),
      ]}),
      check('관리자 ID/PW 입력'), check('관리자 QR 스캔'), check('관리자 사번 입력'), check('기타: _______________'),

      // === 2. 인터락 체크 시점 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('2. 인터락 체크 시점'),
      h2('Q2-1. 인터락을 언제 체크하는가?'),
      infoBox('현재 생산실적 입력 흐름: 라인 선택 → 공정 선택 → 설비 선택 → 작업지시 선택 → 작업자 선택 → 실적입력 모달'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('시점', {bold:true, bg:NAVY}), cell('화면 예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('A. 설비 선택 시', {bold:true}), cell('설비 카드 클릭 → 인터락 체크 → 미충족 시 "이 설비는 사용 불가" 메시지'), cell('없음')),
        row(cell('B. 작업시작 버튼 클릭 시', {bold:true}), cell('5단계 선택 완료 후 "작업시작" 클릭 → 인터락 체크 → 에러 팝업'), cell('없음')),
        row(cell('C. 실적 저장(등록) 시', {bold:true}), cell('수량 입력 후 "등록" 클릭 → 인터락 체크 → 저장 거부'), cell('없음')),
        row(cell('D. 설비 가동 신호 전송 직전', {bold:true}), cell('MES → 설비 가동 명령 전송 전 인터락 체크'), cellRuns([{text:'설비 통신 연동 선행 완료 필요', bold:true}])),
      ]}),
      check('A. 설비 선택 시'), check('B. 작업시작 버튼 클릭 시'), check('C. 실적 저장(등록) 시'), check('D. 설비 가동 신호 전송 직전'), check('복수 시점 (예: A+C 조합): _______________'),

      divider(),
      h2('Q2-2. 실시간 감시가 필요한가?'),
      new Table({ columnWidths: [2000, 3800, 3560], rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('시점 체크', {bold:true}), cell('Q2-1에서 선택한 시점에만 1회 체크'), cell('없음')),
        row(cell('실시간 폴링', {bold:true}), cell('화면 진입 시 N초마다 서버에 인터락 상태 조회'), cell('서버 부하 고려 필요 (설비 수 x 폴링 주기)')),
      ]}),
      check('시점 체크만으로 충분'), check('실시간 폴링 필요 → 주기: ___초'),

      // === 3. 인터락 조건별 세부 정의 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('3. 인터락 조건별 세부 정의'),

      // 3-1
      h2('3-1. 설비 일상점검 미실시'),
      infoBox('관련 공정: 와이어절단, 편조체절단, 압착, 초음파융착, 통합검사 | 현재 상태: 설비 일상점검 CRUD 완구현 (EQUIP_INSPECT_LOGS 테이블)'),
      h3('Q3-1-1. "점검 완료"의 판단 기준은?'),
      new Table({ columnWidths: [2200, 3800, 3360], rows: [
        row(cell('기준', {bold:true, bg:NAVY}), cell('예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('당일 기준', {bold:true}), cell('오늘 해당 설비의 점검 기록이 1건 이상 존재하면 통과'), cell('점검 기준 시각 정의 필요 (자정? 교대 시작?)')),
        row(cell('교대(Shift) 기준', {bold:true}), cell('현재 교대조의 점검 기록이 존재하면 통과 (08:00~20:00, 20:00~08:00)'), cell('교대 스케줄 마스터 필요 (미구현)')),
        row(cell('최근 N시간 이내', {bold:true}), cell('현재 시각 기준 N시간 이내에 점검 기록이 있으면 통과'), cell('N값 정의 필요')),
      ]}),
      check('당일 기준 → 기준 시각: ___시'), check('교대(Shift) 기준'), check('최근 N시간 이내 → N = ___시간'), check('기타: _______________'),

      h3('Q3-1-2. 점검 결과가 "불합격"인 경우는?'),
      new Table({ columnWidths: [2800, 3200, 3360], rows: [
        row(cell('처리', {bold:true, bg:NAVY}), cell('예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('합격만 인정', {bold:true}), cell('결과가 FAIL이면 인터락 발동 유지'), cell('없음 (PASS/FAIL 필드 존재)')),
        row(cell('실시 자체로 인정', {bold:true}), cell('점검 기록만 있으면 결과 무관 통과'), cell('없음')),
        row(cell('불합격 시 후속 조치 완료 후', {bold:true}), cell('FAIL → 수리/조치 → 재점검 PASS → 해제'), cell('후속 조치 기록 필드 추가 필요')),
      ]}),
      check('합격(PASS)만 인정'), check('실시 자체로 인정'), check('불합격 시 후속 조치 완료 후 인정'), check('기타: _______________'),

      // 3-2
      divider(),
      h2('3-2. 설비부품(소모품) 사용제한 횟수 초과'),
      infoBox('관련 공정: 와이어절단, 편조체절단, 압착, 초음파융착, 통합검사 | 현재 상태: expectedLife, currentCount, status(NORMAL/WARNING/REPLACE) 관리 중'),
      h3('Q3-2-1. 소모품 상태별 처리는?'),
      new Table({ columnWidths: [1800, 3200, 2200, 2160], rows: [
        row(cell('상태', {bold:true, bg:NAVY}), cell('의미', {bold:true, bg:NAVY}), cell('경고만?', {bold:true, bg:NAVY}), cell('차단?', {bold:true, bg:NAVY})),
        row(cell('NORMAL'), cell('currentCount < expectedLife x 80%'), cell('정상 통과'), cell('정상 통과')),
        row(cellRuns([{text:'WARNING', bold:true, color:'D97706'}]), cell('currentCount >= expectedLife x 80%'), cell('\u2610 경고만'), cell('\u2610 차단')),
        row(cellRuns([{text:'REPLACE', bold:true, color:'DC2626'}]), cell('currentCount >= expectedLife'), cell('\u2610 경고만'), cell('\u2610 차단')),
      ]}),

      h3('Q3-2-2. 사용횟수 카운트 방식은?'),
      new Table({ columnWidths: [2800, 3200, 3360], rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('실적 등록 시 자동 +1', {bold:true}), cell('실적 등록 시 소모품 currentCount +1'), cell('설비-소모품 장착 매핑 정확해야 함')),
        row(cell('실적 등록 시 +생산수량', {bold:true}), cell('양품 + 불량 합계만큼 카운트 증가'), cell('위와 동일')),
        row(cell('설비 가동 데이터 자동 수집', {bold:true}), cell('설비가 1회 동작마다 MES로 카운트 신호 전송'), cell('설비 통신 연동 필수')),
        row(cell('작업자 수동 입력', {bold:true}), cell('교대 종료 시 사용횟수 직접 입력'), cell('수동 입력 화면 추가 필요')),
      ]}),
      check('실적 등록 시 자동 +1'), check('실적 등록 시 +생산수량'), check('설비 가동 데이터 자동 수집'), check('작업자 수동 입력'), check('기타: _______________'),

      h3('Q3-2-3. 소모품 교체 후 카운트 리셋은 누가 하는가?'),
      check('설비 담당자가 소모품 관리 화면에서 교체 등록 (현재 가능)'),
      check('작업자가 QR 스캔으로 교체 등록 → 소모품 QR 부착, 교체 등록 화면 필요'),
      check('기타: _______________'),

      // 3-3
      new Paragraph({ children: [new PageBreak()] }),
      h2('3-3. 자재 미일치'),
      infoBox('관련 공정: 와이어절단, 준비공정, 압착, 부자재삽입, 조립, 통합검사 | 현재 상태: BOM마스터 존재, LOT 관리 구현됨, 자재 투입 검증 미구현'),
      h3('Q3-3-1. "자재 일치"의 검증 범위는?'),
      new Table({ columnWidths: [2600, 3200, 3560], rows: [
        row(cell('검증 수준', {bold:true, bg:NAVY}), cell('예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('품번만 일치', {bold:true}), cell('BOM에 "WIRE-001" → 투입 자재 "WIRE-001"이면 통과'), cell('자재 투입 기록 기능 추가 필요')),
        row(cell('품번 + LOT', {bold:true}), cell('위 + LOT 번호까지 기록하여 추적'), cell('위 + LOT 선택/입력 UI 추가')),
        row(cell('품번 + LOT + 유효기한', {bold:true}), cell('위 + 유효기한 만료 자재 차단'), cell('위 + 유효기한 체크 로직 (ShelfLife 연동)')),
        row(cell('품번+LOT+유효기한+수량', {bold:true}), cell('위 + BOM 수량 대비 초과 투입 차단'), cell('위 + 수량 비교 로직, 자동 재고 차감')),
      ]}),
      check('품번만 일치'), check('품번 + LOT'), check('품번 + LOT + 유효기한'), check('품번 + LOT + 유효기한 + 수량'), check('기타: _______________'),

      h3('Q3-3-2. 자재 확인 방법은?'),
      new Table({ columnWidths: [2200, 3400, 3760], rows: [
        row(cell('방법', {bold:true, bg:NAVY}), cell('화면 예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('바코드 스캔', {bold:true}), cell('"자재 바코드 스캔" → 스캐너로 라벨 스캔 → 품번 자동 매칭'), cell('모든 자재 LOT에 바코드 라벨 부착, PC에 스캐너 설치')),
        row(cell('드롭다운 선택', {bold:true}), cell('BOM 기준 필요 자재 목록 → 작업자가 사용 중 LOT 선택'), cell('불출된 자재 LOT 목록 조회 API 필요')),
        row(cell('수동 품번 입력', {bold:true}), cell('작업자가 품번 또는 LOT 번호를 직접 타이핑'), cell('입력 오류 가능성 높음, 유효성 검증 로직 필요')),
      ]}),
      check('바코드 스캔'), check('드롭다운 선택'), check('수동 품번 입력'), check('복합 (바코드 우선, 수동 보조): _______________'),

      // 3-4
      divider(),
      h2('3-4. 공정순서 미일치'),
      infoBox('관련 공정: 편조체절단 ~ 제품포장 (9개 공정) | 현재 상태: ProcessMap(라우팅) seq 정의됨, 순서 검증 로직 미구현'),
      h3('Q3-4-1. 공정순서 검증 기준은?'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('기준', {bold:true, bg:NAVY}), cell('예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('직전 공정만 확인', {bold:true}), cell('현재 seq=3이면, seq=2 실적 존재 시 통과'), cell('시리얼(LOT)별 공정 이력 조회 로직 필요')),
        row(cell('모든 선행 공정 확인', {bold:true}), cell('현재 seq=3이면, seq=1, 2 모두 실적 필요'), cell('위 + 누적 검증')),
        row(cell('라우팅 기준 자동 판단', {bold:true}), cell('ProcessMap seq 순서에서 선행 공정 자동 도출'), cell('모든 품목 ProcessMap 정확 등록 필요')),
      ]}),
      check('직전 공정만 확인'), check('모든 선행 공정 확인'), check('기타: _______________'),

      h3('Q3-4-2. 공정 건너뛰기(Skip) 허용 여부는?'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('절대 불가', {bold:true}), cell('어떤 경우에도 선행 공정 없이 진행 불가'), cell('없음')),
        row(cell('관리자 승인 시 가능', {bold:true}), cell('특수 상황에서 관리자 승인 후 건너뛰기 허용'), cell('Q1-3 승인 방식 적용, 사유 기록 필요')),
        row(cell('모델에 따라 선택적', {bold:true}), cell('특정 모델은 일부 공정 없음 (예: 준비공정 생략)'), cell('ProcessMap "필수/선택" 필드 추가 필요')),
      ]}),
      check('절대 불가'), check('관리자 승인 시 가능'), check('모델에 따라 선택적'), check('기타: _______________'),

      // 3-5
      new Paragraph({ children: [new PageBreak()] }),
      h2('3-5. 샘플검사 양품조건 미충족'),
      infoBox('관련 공정: 압착(육각), 압착/초음파융착 | 현재 상태: SampleInspectResult 엔티티 존재, 이력 조회/입력 가능'),
      h3('Q3-5-1. 샘플검사 유효 범위는?'),
      new Table({ columnWidths: [2600, 3400, 3360], rows: [
        row(cell('범위', {bold:true, bg:NAVY}), cell('예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('작업지시 시작 시 1회', {bold:true}), cell('JO 시작 전 샘플검사 1회 합격 → 전체 기간 유효'), cell('샘플검사-작업지시 연결 필요')),
        row(cell('교대마다 재실시', {bold:true}), cell('주간→야간 교대 시 다시 실시'), cell('교대 스케줄 마스터 필요 (미구현)')),
        row(cell('N개 생산마다', {bold:true}), cell('1,000개 생산마다 중간 샘플검사'), cell('생산 카운터 연동, N값 기준정보 관리')),
        row(cell('금형(소모품) 교체 시', {bold:true}), cell('소모품 교체 후 반드시 재실시'), cell('소모품 교체 이벤트-샘플검사 연동')),
      ]}),
      check('작업지시 시작 시 1회'), check('교대마다 재실시'), check('N개 생산마다 → N = ___개'), check('금형 교체 시 재실시'), check('복합: _______________'),

      h3('Q3-5-2. 샘플검사 항목은?'),
      check('배럴 검사 + 인장력 검사 둘 다 필수 → 품목별 기준값 정의 필요'),
      check('모델/공정에 따라 검사 항목이 다름 → 검사항목 마스터 매핑 필요'),
      check('기타: _______________'),

      h3('Q3-5-3. 배럴/인장력 기준값은 어디서 가져오는가?'),
      check('품목마스터에 필드 추가 (barrelMin, barrelMax, tensileMin, tensileMax)'),
      check('별도 검사기준 마스터 (품목 + 공정 + 단자 조합별 기준값 테이블)'),
      check('공정 파라미터(ProcessMap.processParams)에 포함'),
      check('기타: _______________'),

      // 3-6
      divider(),
      h2('3-6. IQC 미실시 (자재입고 인터락)'),
      infoBox('현재 상태: 품목마스터에 iqcYn 필드 존재. IQC 검사 기록(IqcLog) 관리 중'),
      h3('Q3-6-1. IQC 불합격 자재의 처리는?'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('처리', {bold:true, bg:NAVY}), cell('예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('입고 자체 차단', {bold:true}), cell('IQC FAIL → 입고 등록 불가 → 반품/폐기'), cell('없음')),
        row(cell('입고 허용, 불출 차단', {bold:true}), cell('IQC FAIL → 불량 상태로 입고 → 불출 시 차단'), cell('자재 LOT에 "IQC 상태" 필드, 불출 API 체크')),
        row(cell('별도 불량 창고로 입고', {bold:true}), cell('IQC FAIL → 자동으로 불량자재 창고에 적치'), cell('불량 창고 마스터 등록, 자동 창고 분기')),
      ]}),
      check('입고 자체 차단'), check('입고 허용, 불출 차단'), check('별도 불량 창고로 입고'), check('기타: _______________'),

      // 3-7
      divider(),
      h2('3-7. 마스터 샘플 검사 (통합검사 인터락)'),
      infoBox('관련 공정: 통합검사 | 양품 1개 + 불량 1개를 먼저 검사하여 장비 판별 정확도 확인'),
      h3('Q3-7-1. 마스터 샘플 검사의 유효 범위는?'),
      check('작업지시 시작 시 1회 → 작업지시-마스터샘플검사 연결 테이블 필요'),
      check('매 교대 시작 시 → 교대 스케줄 마스터 필요'),
      check('설비 전원 ON 시마다 → MES가 설비 ON/OFF 이벤트 감지 필요 (통신 연동)'),
      check('기타: _______________'),

      // 3-8
      divider(),
      h2('3-8. 제품 혼입 (제품포장 인터락)'),
      infoBox('관련 공정: 제품포장 | 현재 상태: BoxService에서 박스 생성/시리얼 추가 구현됨'),
      h3('Q3-8-1. "제품 혼입 방지"의 범위는?'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('범위', {bold:true, bg:NAVY}), cell('예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('품번 혼입 방지', {bold:true}), cell('"HARNESS-A"와 "HARNESS-B" 혼입 시 차단'), cell('박스 추가 시 품번 비교 로직')),
        row(cell('+ 작업지시 혼입 방지', {bold:true}), cell('같은 품번이라도 다른 작업지시 제품 혼입 차단'), cell('위 + 박스에 작업지시ID 연결')),
        row(cell('+ LOT 혼입 방지', {bold:true}), cell('같은 품번, 같은 JO라도 생산 LOT 다르면 차단'), cell('위 + LOT 단위 관리')),
      ]}),
      check('품번 혼입 방지만'), check('품번 + 작업지시 혼입 방지'), check('품번 + 작업지시 + LOT 혼입 방지'), check('기타: _______________'),

      h3('Q3-8-2. 포장 시 제품 확인 방법은?'),
      check('제품 바코드 스캔 → 완성품 바코드 라벨, 스캐너 필요'),
      check('수량만 입력 (혼입 방지 불가)'),
      check('작업지시 단위 일괄 포장'),
      check('기타: _______________'),

      // 3-9
      divider(),
      h2('3-9. 유효기간 만료자재 (자재불출 인터락)'),
      infoBox('현재 상태: ShelfLife(유효기한) 관리 모듈 존재, MatLot에 유효기한 정보 저장'),
      h3('Q3-9-1. 유효기한 임박 자재의 처리는?'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('처리', {bold:true, bg:NAVY}), cell('예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('만료 자재만 차단', {bold:true}), cell('유효기한 지난 자재만 불출 차단'), cell('없음 (ShelfLife 데이터 존재)')),
        row(cell('N일 전부터 경고', {bold:true}), cell('유효기한 30일 전부터 "임박" 경고 표시'), cell('N일 기준값 설정 필요 (품목별? 전체?)')),
        row(cell('수명연장 검사 후 허용', {bold:true}), cell('만료 → 수명연장 검사 합격 → 재사용 허용'), cell('수명연장 검사 프로세스 정의, 연장 로직')),
      ]}),
      check('만료 자재만 차단'), check('N일 전부터 경고 → N = ___일'), check('수명연장 검사 후 허용'), check('기타: _______________'),

      // === 4. 설비 연동 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('4. 설비 연동'),
      h2('Q4-1. 인터락 시 설비에 물리적 신호를 보내는가?'),
      new Table({ columnWidths: [2800, 3200, 3360], rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('MES 소프트웨어 차단만', {bold:true}), cell('MES 화면에서만 작업 차단. 설비 직접 조작 시 가동 가능'), cell('없음')),
        row(cell('MES → 설비 가동허가 신호', {bold:true}), cell('인터락 통과 후 "가동허가" 신호 전송. 미통과 시 설비 물리 차단'), cell('통신 프로토콜 협의, PLC 수정, 테스트 환경 구축')),
      ]}),
      check('MES 소프트웨어 차단만'), check('MES → 설비 가동허가 신호 전송'), check('1차 소프트웨어, 2차 설비 연동'), check('기타: _______________'),

      h2('Q4-2. 통신 프로토콜 (설비 연동 선택 시)'),
      new Table({ columnWidths: [2400, 6960], rows: [
        row(cell('프로토콜', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('TCP/IP', {bold:true}), cell('설비 IP 주소, 포트, 통신 포맷 확정 필요')),
        row(cell('Serial (RS-232/485)', {bold:true}), cell('포트 할당, 보드레이트, PC-설비 간 케이블')),
        row(cell('MQTT', {bold:true}), cell('MQTT 브로커 서버 구축, 토픽 구조 설계')),
        row(cell('OPC-UA', {bold:true}), cell('OPC-UA 서버 라이선스, 설비 지원 여부 확인')),
      ]}),
      check('TCP/IP'), check('Serial'), check('MQTT'), check('OPC-UA'), check('미확정 → 설비 업체 협의 예정일: _______________'),

      // === 5. 이력 관리 ===
      divider(),
      h1('5. 인터락 이력 관리'),
      h2('Q5-1. 인터락 발생/해제 이력을 별도 저장하는가?'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('저장 내용', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('별도 이력 테이블', {bold:true}), cell('발생시각, 유형, 설비, 작업자, 해제시각, 해제방법, 승인자, 사유'), cell('INTERLOCK_LOG 테이블 생성, 이력 조회 API')),
        row(cell('기존 로그 테이블', {bold:true}), cell('시스템 로그에 인터락 이벤트 기록'), cell('없음')),
        row(cell('저장 불필요', {bold:true}), cell('실시간 차단만, 이력 없음'), cell('없음')),
      ]}),
      check('별도 이력 테이블'), check('기존 로그 테이블 활용'), check('저장 불필요'), check('기타: _______________'),

      h2('Q5-2. 이력 조회 화면이 필요한가?'),
      check('관리자 전용 화면 (필터: 기간, 설비, 유형, 작업자)'),
      check('모니터링 대시보드에 통합 (인터락 건수/추이 위젯)'),
      check('불필요'),

      h2('Q5-3. 인터락 발생 시 관리자 알림?'),
      check('모니터링 화면에 실시간 표시 (WebSocket/폴링)'),
      check('소리/경고음 (브라우저 알림 권한 필요)'),
      check('불필요'), check('기타: _______________'),

      // === 6. 설정 관리 ===
      divider(),
      h1('6. 인터락 설정 관리'),
      h2('Q6-1. 인터락 ON/OFF를 관리자 화면에서 설정 가능?'),
      check('화면에서 설정 가능 → 인터락 설정 마스터 테이블 + 관리 페이지 개발 필요'),
      check('코드 고정 (변경 시 개발자 수정 후 배포)'),
      check('기타: _______________'),

      h2('Q6-2. 인터락 임계값을 화면에서 변경 가능?'),
      infoBox('예시: 소모품 사용횟수 제한 10,000 → 12,000 변경, WARNING 임계 비율 80% → 70% 변경'),
      check('화면에서 변경 → 인터락 설정 화면에 임계값 입력 필드 추가'),
      check('마스터 데이터에서 변경 (현재 방식 유지)'),
      check('기타: _______________'),

      // === 7. 개발 우선순위 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('7. 개발 우선순위'),
      h2('Q7-1. 1차 오픈 시점에 반드시 필요한 인터락은?'),
      new Table({ columnWidths: [3600, 1920, 1920, 1920], rows: [
        row(cell('인터락', {bold:true, bg:NAVY}), cell('1차 필수', {bold:true, bg:NAVY, align:AlignmentType.CENTER}), cell('2차 이후', {bold:true, bg:NAVY, align:AlignmentType.CENTER}), cell('불필요', {bold:true, bg:NAVY, align:AlignmentType.CENTER})),
        row(cell('설비 일상점검 미실시'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('설비부품 사용제한 횟수 초과'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('자재 미일치'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('공정순서 미일치'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('샘플검사 양품조건 미충족'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('IQC 미실시'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('마스터 샘플 검사 미충족'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('제품 혼입'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('유효기간 만료자재'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
      ]}),

      h2('Q7-2. 1차 오픈 목표 시점은?'),
      p('기재: _______________ (예: 2026년 N월)'),

      // === 8. 종합 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('8. 종합: 선택에 따른 사전요구사항 요약'),
      infoBox('아래는 주요 선택에 따라 사전에 준비/확정해야 할 항목을 정리한 것입니다.'),
      new Table({ columnWidths: [2600, 4200, 2560], rows: [
        row(cell('선택 사항', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY}), cell('담당/협의 대상', {bold:true, bg:NAVY})),
        row(cell('Soft Block 적용 시'), cell('승인 권한 역할 정의, 승인 UI 설계'), cell('프로젝트 관리자')),
        row(cell('교대(Shift) 기준'), cell('교대 스케줄 마스터 정의 (조, 시작/종료 시각)'), cell('생산관리 담당자')),
        row(cell('바코드 스캔 방식'), cell('각 PC에 바코드 스캐너 설치, 자재/제품에 바코드 라벨 부착'), cell('현장 관리자, IT 인프라')),
        row(cell('설비 물리 연동'), cell('설비 업체와 통신 프로토콜 협의, PLC 프로그램 수정'), cell('설비 업체')),
        row(cell('샘플검사 기준값'), cell('품목별 배럴/인장력 기준값 데이터 정리'), cell('품질관리 담당자')),
        row(cell('마스터 샘플 관리'), cell('양품/불량 마스터 샘플 목록, 보관/관리 체계 수립'), cell('품질관리 담당자')),
        row(cell('인터락 이력 관리'), cell('INTERLOCK_LOG 테이블 설계, 보관 기간 정책'), cell('DBA, 프로젝트 관리자')),
        row(cell('인터락 설정 화면'), cell('인터락 설정 마스터 테이블 설계, 관리 페이지 개발'), cell('개발팀')),
        row(cell('소모품 교체 QR'), cell('소모품 QR 코드 발행/부착, 현장 교체 등록 화면'), cell('현장 관리자, 개발팀')),
      ]}),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('C:/Project/HANES/docs/05-인터락-역질문서.docx', buf);
  console.log('DOCX created successfully!');
}).catch(err => { console.error('Error:', err); process.exit(1); });
