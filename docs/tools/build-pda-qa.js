/**
 * @file build-pda-qa.js
 * @description HANES MES PDA 프로그램 역질문서 DOCX 생성 (체크박스 선택형)
 * 기존 인터락 역질문서와 동일한 폼 (테이블 비교 + ☐ 체크 선택)
 */
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak } = require('docx');

const NAVY = '1B2A4A', ORANGE = 'E76F51', GRAY = '64748B', LIGHT_BG = 'F1F5F9', WHITE = 'FFFFFF';
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: tb, bottom: tb, left: tb, right: tb };
const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };

function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text: t, bold: true, size: 32, font: 'Arial', color: NAVY })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 }, children: [new TextRun({ text: t, bold: true, size: 26, font: 'Arial', color: NAVY })] }); }
function h3(t) { return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 }, children: [new TextRun({ text: t, bold: true, size: 22, font: 'Arial', color: NAVY })] }); }
function p(t, opts = {}) { return new Paragraph({ spacing: { after: 80 }, ...opts, children: [new TextRun({ text: t, size: 20, font: 'Arial', color: '334155', ...opts.run })] }); }
function bullet(t, ref = 'bl') { return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 20, font: 'Arial', color: '334155' })] }); }
function check(t) { return bullet(`\u2610 ${t}`, 'bl'); }

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
  return new Table({ columnWidths: [9360], rows: [
    new TableRow({ children: [
      new TableCell({ borders: { top: noBorder, bottom: noBorder, right: noBorder, left: { style: BorderStyle.SINGLE, size: 6, color: ORANGE } },
        shading: { fill: 'FEF3F0', type: ShadingType.CLEAR },
        children: [new Paragraph({ spacing: { before: 60, after: 60 },
          children: [new TextRun({ text, size: 18, font: 'Arial', color: '475569', italics: true })] })] }) ] }) ] });
}
function warnBox(text) {
  return new Table({ columnWidths: [9360], rows: [
    new TableRow({ children: [
      new TableCell({ borders: { top: noBorder, bottom: noBorder, right: noBorder, left: { style: BorderStyle.SINGLE, size: 6, color: 'DC2626' } },
        shading: { fill: 'FEF2F2', type: ShadingType.CLEAR },
        children: [new Paragraph({ spacing: { before: 60, after: 60 },
          children: [new TextRun({ text, size: 18, font: 'Arial', color: 'B91C1C', italics: true })] })] }) ] }) ] });
}
function divider() {
  return new Paragraph({ spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1', space: 1 } }, children: [] });
}

const W3 = [2200, 3800, 3360];
const W4 = [1800, 2800, 2400, 2360];

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
        new TextRun({ text: 'HANES MES - PDA 프로그램 역질문서', size: 16, font: 'Arial', color: GRAY, italics: true }) ] }) ] }) },
    footers: { default: new Footer({ children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: '- ', size: 16, font: 'Arial', color: GRAY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: GRAY }),
        new TextRun({ text: ' / ', size: 16, font: 'Arial', color: GRAY }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Arial', color: GRAY }),
        new TextRun({ text: ' -', size: 16, font: 'Arial', color: GRAY }),
      ] }) ] }) },
    children: [
      // ═══ 표지 ═══
      new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'PDA 프로그램 구현을 위한 역질문서', bold: true, size: 44, font: 'Arial', color: NAVY })] }),
      new Paragraph({ spacing: { before: 100, after: 40 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'HANES MES 프로젝트', size: 24, font: 'Arial', color: GRAY })] }),
      new Paragraph({ spacing: { before: 200, after: 60 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '작성일: 2026-02-23 | 회신 요청: 해당 항목에 체크(\u2611) 또는 기재 후 회신', size: 18, font: 'Arial', color: GRAY })] }),
      divider(),
      infoBox('요구사항최종.md에서 PDA 플랫폼으로 구현해야 할 프로그램 7개 + 프레임워크 1개를 추출하였습니다. 각 프로그램의 상세 구현 방식에 대해 아래 질문에 답변해 주시기 바랍니다.'),

      // ═══ PDA 프로그램 목록 ═══
      new Paragraph({ children: [new PageBreak()] }),
      h1('PDA 프로그램 목록 (요구사항 추출)'),
      new Table({ columnWidths: [500, 2200, 900, 900, 4860], rows: [
        row(cell('No', {bold:true, bg:NAVY}), cell('프로그램명', {bold:true, bg:NAVY}), cell('플랫폼', {bold:true, bg:NAVY}), cell('구현', {bold:true, bg:NAVY}), cell('비고 (요구사항 원문)', {bold:true, bg:NAVY})),
        row(cell('1'), cell('설비 일상점검', {bold:true}), cell('PDA'), cell('△'), cell('목록별 체크기능 필요, PDA 프로그램 필요')),
        row(cell('2'), cell('자재입고', {bold:true}), cell('PC/PDA'), cell('△'), cell('현물 바코드 스캔으로 전개 필요, PDA 필요')),
        row(cell('3'), cell('자재불출(출고/이동)', {bold:true}), cell('PC/PDA'), cell('△'), cell('불출요청서 바코드를 리딩하여 진행 필요')),
        row(cell('4'), cell('자재재고보정', {bold:true}), cell('PDA'), cell('△'), cell('PC 버전 구현됨, PDA 프로그램 필요')),
        row(cell('5'), cell('자재재고실사', {bold:true}), cell('PC/PDA'), cell('△'), cell('창고/로케이션별 실사, PDA 입력, 월 1회 이상')),
        row(cell('6'), cell('출하실적 등록', {bold:true}), cell('PC/PDA'), cell('O'), cell('출하지시/제품 포장 바코드 스캔, 작업자 스캔 후 출하')),
        row(cell('7'), cell('제품 재고실사', {bold:true}), cell('PC/PDA'), cell('X'), cell('자재 재고실사와 별개로 필요, 신규 개발')),
        row(cellRuns([{text:'★', bold:true, color:ORANGE}]), cell('PDA 프레임워크', {bold:true}), cell('PDA'), cell('X'), cell('로그인, 권한별 프로그램 실행, 안드로이드 프레임 개발')),
      ]}),

      // ═══════════════════════════════════════════════════════════════
      // 1. PDA 프레임워크
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('1. PDA 프레임워크 (공통 기반)'),
      warnBox('요구사항: PDA는 목록의 프로그램 외 로그인, 권한에 따른 프로그램 실행 등 프레임 개발이 병행되어야 함 (안드로이드)'),

      // Q1-1
      h2('Q1-1. 개발 플랫폼'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('장점', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('안드로이드 네이티브 (Kotlin)', {bold:true}), cell('PDA SDK 직접 연동 최적, 바코드 성능 우수'), cell('Kotlin 개발 인력 필요')),
        row(cell('크로스플랫폼 (Flutter)', {bold:true}), cell('iOS 확장 가능, 빠른 UI 개발'), cell('PDA SDK 플러그인 개발 필요')),
        row(cell('크로스플랫폼 (React Native)', {bold:true}), cell('웹 개발 인력 활용 가능'), cell('PDA SDK 네이티브 브릿지 개발 필요')),
        row(cell('모바일 웹 (PWA)', {bold:true}), cell('별도 앱 설치 불필요, 배포 간편'), cell('바코드 SDK 연동 제한, 오프라인 제한')),
      ]}),
      check('안드로이드 네이티브 (Kotlin/Java)'),
      check('크로스플랫폼 (Flutter)'),
      check('크로스플랫폼 (React Native)'),
      check('모바일 웹 (PWA)'),
      check('기타: _______________'),

      // Q1-2
      divider(),
      h2('Q1-2. PDA 디바이스 기종'),
      infoBox('PDA 내장 바코드 스캐너 SDK가 기종마다 다르므로 기종 확정이 선행 필요합니다.'),
      new Table({ columnWidths: W3, rows: [
        row(cell('제조사', {bold:true, bg:NAVY}), cell('대표 모델', {bold:true, bg:NAVY}), cell('스캐너 SDK', {bold:true, bg:NAVY})),
        row(cell('Zebra', {bold:true}), cell('TC21, TC26, TC52, MC3300'), cell('DataWedge API')),
        row(cell('Honeywell', {bold:true}), cell('CT40, CT60, EDA52'), cell('Honeywell Barcode SDK')),
        row(cell('Samsung', {bold:true}), cell('Galaxy XCover 시리즈'), cell('Knox SDK + 외장 스캐너')),
        row(cell('UROVO', {bold:true}), cell('DT50, i6310'), cell('자체 SDK')),
      ]}),
      check('Zebra — 모델: _______________'),
      check('Honeywell — 모델: _______________'),
      check('Samsung — 모델: _______________'),
      check('기타 — 제조사/모델: _______________'),
      check('미확정 — 조달 예정일: _______________'),

      // Q1-3
      divider(),
      h2('Q1-3. 로그인 방식'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('화면 예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('ID/PW 입력', {bold:true}), cell('아이디, 비밀번호 입력 → 로그인 버튼'), cell('PC MES와 동일한 계정 체계')),
        row(cell('작업자 QR 스캔', {bold:true}), cell('PDA 스캐너로 작업자 QR 카드 스캔 → 자동 로그인'), cell('작업자별 QR 카드 발급, 작업자마스터 연동')),
        row(cell('사번 + PIN', {bold:true}), cell('사번 입력 + 4자리 PIN → 로그인'), cell('작업자 PIN 관리 기능 추가')),
        row(cell('생체 인증', {bold:true}), cell('지문/안면 인식 → 로그인'), cell('디바이스 생체인증 API 연동')),
      ]}),
      check('ID/PW 입력'),
      check('작업자 QR 스캔'),
      check('사번 + PIN'),
      check('생체 인증'),
      check('기타: _______________'),

      // Q1-4
      divider(),
      h2('Q1-4. 세션 관리'),
      h3('Q1-4-1. 자동 로그아웃 시간은?'),
      check('30분'), check('1시간'), check('교대 종료 시'), check('로그아웃 없음 (수동만)'), check('기타: ___분'),

      h3('Q1-4-2. 여러 작업자 교대 사용 시나리오가 있는가?'),
      check('없음 — 1인 1디바이스 전용'),
      check('있음 — 로그아웃 → 다음 작업자 로그인 (동일 디바이스)'),
      check('있음 — 작업자 QR 전환 (로그아웃 없이 작업자만 전환)'),

      // Q1-5
      divider(),
      h2('Q1-5. 권한 체계'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('PC 권한 공유', {bold:true}), cell('PC MES와 동일한 역할(Role)로 PDA 메뉴 접근 제어'), cell('PC 역할 테이블에 PDA 메뉴 매핑 추가')),
        row(cell('PDA 전용 권한', {bold:true}), cell('PDA만의 별도 역할/권한 체계 운영'), cell('PDA 역할 마스터, 메뉴 권한 테이블 별도 설계')),
        row(cell('권한 없음', {bold:true}), cell('로그인한 작업자 누구나 모든 PDA 메뉴 사용'), cell('없음')),
      ]}),
      check('PC 권한 공유'), check('PDA 전용 권한'), check('권한 없음'), check('기타: _______________'),

      // Q1-6
      divider(),
      h2('Q1-6. 바코드 스캐닝 공통'),
      warnBox('요구사항: 바코드 스캐닝은 HID Mode가 아닌 Buffered Mode (Serial, API, SDK)로 스캔하여 바코드 유형을 시스템에서 구분하여 액션 필요'),

      h3('Q1-6-1. 스캔 실패(인식 불가) 시 수동 입력을 허용하는가?'),
      check('허용 — 수동 입력 시 바코드 번호 직접 타이핑'),
      check('허용하되 사유 입력 필수'),
      check('불허 — 반드시 스캔으로만 입력'),

      h3('Q1-6-2. 연속 스캔 지원 범위는?'),
      infoBox('예: 자재입고 시 자재 바코드 → 로케이션 바코드를 연속 스캔하는 시나리오'),
      check('단일 스캔 — 한 번에 하나의 바코드만 스캔'),
      check('연속 스캔 — 여러 종류의 바코드를 연속으로 스캔, 시스템이 유형 자동 구분'),
      check('기타: _______________'),

      // Q1-7
      divider(),
      h2('Q1-7. 네트워크 및 오프라인'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('Wi-Fi 전용', {bold:true}), cell('공장 내 Wi-Fi만 사용, 외부 접속 불가'), cell('공장 Wi-Fi 커버리지 확보')),
        row(cell('Wi-Fi + LTE', {bold:true}), cell('Wi-Fi 우선, 끊기면 LTE 전환'), cell('LTE 데이터 요금, VPN 구성')),
      ]}),
      check('Wi-Fi 전용'), check('Wi-Fi + LTE'), check('기타: _______________'),

      h3('Q1-7-1. 오프라인(네트워크 끊김) 시 처리는?'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('작업 차단', {bold:true}), cell('네트워크 없으면 모든 작업 불가, "네트워크 연결 확인" 메시지'), cell('없음')),
        row(cell('임시 저장 후 동기화', {bold:true}), cell('오프라인에서 작업 → 재접속 시 서버 동기화'), cell('로컬 DB(SQLite), 동기화 로직, 충돌 해결 규칙')),
      ]}),
      check('작업 차단 (온라인 필수)'), check('임시 저장 후 동기화'), check('기타: _______________'),

      // Q1-8
      divider(),
      h2('Q1-8. 다국어/UI'),
      check('다국어 지원 필요 (PC MES와 동일: 한/영/중/베)'),
      check('한국어만'),
      check('기타: _______________'),

      h3('Q1-8-1. 앱 배포 방식은?'),
      check('Google Play Store 배포'),
      check('사내 APK 직접 배포 (사이드로딩)'),
      check('MDM(모바일 디바이스 관리) 통한 배포'),
      check('기타: _______________'),

      // ═══════════════════════════════════════════════════════════════
      // 2. 설비 일상점검
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('2. 설비 일상점검 (PDA)'),
      warnBox('요구사항: 설비별 일상/정기 점검 항목 기준정보 기준, 일상점검은 목록별로 체크기능 필요, PDA 프로그램 필요'),

      h2('Q2-1. 점검 시작 방법'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('화면 예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('설비 QR 스캔', {bold:true}), cell('설비 QR 스캔 → 해당 설비 점검 항목 자동 표시'), cell('모든 설비에 QR 코드 부착')),
        row(cell('목록에서 선택', {bold:true}), cell('공장/라인/설비 트리에서 설비 선택'), cell('없음')),
        row(cell('미점검 설비 알림', {bold:true}), cell('PDA 실행 시 "미점검 설비 3대" 알림 → 터치하여 진행'), cell('미점검 조회 로직')),
      ]}),
      check('설비 QR 스캔'), check('목록에서 선택'), check('미점검 설비 알림'), check('복합 (QR 스캔 + 미점검 알림): _______________'),

      divider(),
      h2('Q2-2. 점검 항목 입력 유형'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('입력 유형', {bold:true, bg:NAVY}), cell('예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('OK/NG 체크만', {bold:true}), cell('각 항목마다 OK / NG 버튼 터치'), cell('없음 (기존 구현 활용)')),
        row(cell('OK/NG + 계측값', {bold:true}), cell('압력: [___ psi] OK/NG, 온도: [___ ℃] OK/NG'), cell('점검항목에 "계측형" 구분, 기준값(min/max) 등록')),
        row(cell('OK/NG + 사진 첨부', {bold:true}), cell('NG 판정 시 사진 촬영 첨부'), cell('PDA 카메라 연동, 이미지 업로드 API')),
      ]}),
      check('OK/NG 체크만'), check('OK/NG + 계측값 입력'), check('OK/NG + 사진 첨부'), check('전부 (OK/NG + 계측값 + 사진)'), check('기타: _______________'),

      divider(),
      h2('Q2-3. NG 판정 시 후속 처리'),
      new Table({ columnWidths: W3, rows: [
        row(cell('처리', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('기록만', {bold:true}), cell('NG 기록만 남기고 점검 완료 처리'), cell('없음')),
        row(cell('관리자 알림', {bold:true}), cell('NG 발생 시 관리자에게 실시간 알림'), cell('알림 시스템 (푸시/SMS/모니터링 연동)')),
        row(cell('설비 사용 차단', {bold:true}), cell('NG 판정 시 해당 설비 인터락 발동 → 생산 차단'), cell('인터락 시스템 연동')),
      ]}),
      check('기록만'), check('관리자 알림'), check('설비 사용 차단 (인터락 연동)'), check('기타: _______________'),

      divider(),
      h2('Q2-4. 일상점검 vs 정기점검'),
      check('동일 메뉴 — 점검 유형(일상/정기) 탭으로 구분'),
      check('별도 메뉴 — 일상점검 / 정기점검 각각 메뉴'),
      check('정기점검은 PC에서만 수행, PDA는 일상점검만'),

      h3('Q2-4-1. 이미 점검한 설비를 다시 점검하면?'),
      check('덮어쓰기 — 기존 기록 대체'), check('추가 기록 — 이력으로 누적'), check('차단 — "이미 점검 완료된 설비입니다" 안내'),

      divider(),
      h2('Q2-5. 소모품(설비부품) 연동'),
      infoBox('예: 커터날 사용횟수, 어플리케이터 사용횟수 등 소모성 설비부품'),
      check('점검 시 소모품 QR 스캔 → 사용횟수 표시, 수명 경고 확인'),
      check('점검 화면에 소모품 상태(NORMAL/WARNING/REPLACE) 표시만'),
      check('소모품 관리는 PC에서만, PDA 점검과 무관'),
      check('기타: _______________'),

      // ═══════════════════════════════════════════════════════════════
      // 3. 자재입고
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('3. 자재입고 (PDA)'),
      warnBox('요구사항: 작업자, 창고, 로케이션 정보, 자재 시리얼, PDA 및 PC로 입고. 현물 바코드 스캔으로 전개 필요'),

      h2('Q3-1. PDA 입고 스캔 순서'),
      new Table({ columnWidths: [600, 3400, 2800, 2560], rows: [
        row(cell('순서', {bold:true, bg:NAVY}), cell('방식 A', {bold:true, bg:NAVY}), cell('방식 B', {bold:true, bg:NAVY}), cell('방식 C', {bold:true, bg:NAVY})),
        row(cell('①', {bold:true}), cell('자재 바코드 스캔'), cell('창고 바코드 스캔'), cell('IQC 합격 건 목록 표시')),
        row(cell('②'), cell('창고 바코드 스캔'), cell('로케이션 바코드 스캔'), cell('자재 바코드 스캔')),
        row(cell('③'), cell('로케이션 바코드 스캔'), cell('자재 바코드 스캔 (다건)'), cell('로케이션 바코드 스캔')),
        row(cell('④'), cell('입고 확정'), cell('입고 확정'), cell('입고 확정')),
      ]}),
      check('방식 A — 자재 → 창고 → 로케이션 순'),
      check('방식 B — 창고/로케이션 먼저 → 자재 다건 스캔'),
      check('방식 C — IQC 합격 건에서 선택 → 자재 스캔'),
      check('기타: _______________'),

      divider(),
      h2('Q3-2. 자재 바코드 매핑'),
      infoBox('요구사항: "자재 제조사 바코드 매핑" 프로그램이 별도 존재 (상당히 중요, 반드시 구현 필요)'),
      h3('Q3-2-1. PDA에서 제조사 바코드를 스캔하면?'),
      new Table({ columnWidths: W3, rows: [
        row(cell('처리', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('자동 매핑', {bold:true}), cell('제조사 바코드 스캔 → MES 자재코드 자동 매칭 → 입고 정보 표시'), cell('자재 제조사 바코드 매핑 테이블 사전 등록')),
        row(cell('MES 라벨만 인식', {bold:true}), cell('MES에서 발행한 자재 라벨 바코드만 스캔 가능'), cell('IQC 합격 후 MES 라벨 발행이 선행')),
      ]}),
      check('제조사 바코드 자동 매핑'), check('MES 자재 라벨만 인식'), check('둘 다 지원 (MES 라벨 우선, 제조사 바코드 폴백)'),

      divider(),
      h2('Q3-3. 입고 수량 처리'),
      check('스캔 건수 = 입고 수량 (시리얼 1건 = 1스캔)'),
      check('바코드 스캔 후 수량 수동 입력 (LOT 단위 입고)'),
      check('기타: _______________'),

      divider(),
      h2('Q3-4. IQC 미합격 자재 스캔 시'),
      check('입고 차단 — "IQC 미합격 자재입니다. 입고 불가" 메시지'),
      check('경고 후 허용 — "IQC 미합격 자재입니다. 계속하시겠습니까?"'),
      check('IQC 무검사(iqcYn=N) 자재는 바로 입고 허용'),
      check('기타: _______________'),

      divider(),
      h2('Q3-5. 입고 취소'),
      check('PDA에서 당일 입고분 취소 가능'),
      check('PDA에서는 취소 불가 — PC에서만 처리'),
      check('기타: _______________'),

      // ═══════════════════════════════════════════════════════════════
      // 4. 자재불출 (출고/이동)
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('4. 자재불출 — 출고/이동 (PDA)'),
      warnBox('요구사항: 작업자, 출고유형, 이동 창고(로케이션), 자재시리얼, 작업지시. 불출요청서 바코드 리딩 필요'),

      h2('Q4-1. 불출 시작 방법'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('화면 예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('불출요청서 바코드 스캔', {bold:true}), cell('불출요청서 바코드 스캔 → 필요 자재 목록 표시 → 자재 하나씩 스캔'), cell('불출요청서 바코드 체계 확정, 인쇄물 발행')),
        row(cell('작업지시 바코드 스캔', {bold:true}), cell('작업지시서 바코드 스캔 → BOM 기반 필요 자재 목록 표시'), cell('작업지시서 바코드 체계 확정')),
        row(cell('수동 선택', {bold:true}), cell('작업지시 목록에서 선택 → 필요 자재 표시 → 자재 스캔'), cell('없음')),
      ]}),
      check('불출요청서 바코드 스캔'), check('작업지시 바코드 스캔'), check('수동 선택'), check('기타: _______________'),

      divider(),
      h2('Q4-2. 피킹(불출) 확인 방식'),
      infoBox('불출요청서에 따라 자재를 하나씩 확인하는 과정'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('자재 바코드 스캔', {bold:true}), cell('필요 자재 목록 표시 → 자재 하나씩 스캔 → 목록에서 체크 처리'), cell('자재 LOT별 바코드 라벨 부착')),
        row(cell('로케이션 + 자재 스캔', {bold:true}), cell('로케이션 스캔 → 해당 위치 자재 스캔 → 확인'), cell('로케이션 바코드 부착')),
        row(cell('수량 수동 입력', {bold:true}), cell('자재 목록 확인 → 수량만 입력'), cell('없음 (추적성 낮음)')),
      ]}),
      check('자재 바코드 스캔'), check('로케이션 + 자재 스캔'), check('수량 수동 입력'), check('기타: _______________'),

      divider(),
      h2('Q4-3. 과불출 방지'),
      check('차단 — 요청 수량 초과 시 스캔 불가'),
      check('경고 후 허용 — "요청 수량 초과입니다. 계속하시겠습니까?"'),
      check('제한 없음'),

      divider(),
      h2('Q4-4. 잔여 자재 반납'),
      check('PDA에서 반납 처리 가능 — 자재 스캔 → 반납 창고/로케이션 스캔 → 확정'),
      check('PDA에서는 반납 불가 — PC에서만 처리'),
      check('기타: _______________'),

      divider(),
      h2('Q4-5. 출고 유형'),
      infoBox('PDA에서 지원해야 할 출고 유형을 선택해 주세요'),
      check('생산불출 (작업지시 기반)'),
      check('창고 이동 (출고 창고 → 입고 창고)'),
      check('반품 출고 (공급업체 반품)'),
      check('전부 지원'),
      check('기타: _______________'),

      // ═══════════════════════════════════════════════════════════════
      // 5. 자재재고보정
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('5. 자재재고보정 (PDA)'),
      warnBox('요구사항: 작업자, 자재 재고 조정 정보. 최초 재고보다 많은 재고로는 보정할 수 없음. PC 버전 구현됨, PDA 필요'),

      h2('Q5-1. PDA 보정 프로세스'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('화면 예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('자재 바코드 스캔', {bold:true}), cell('자재 바코드 스캔 → 현재 재고 표시 → 실재고 입력 → 확정'), cell('자재 바코드 라벨')),
        row(cell('로케이션 + 자재 스캔', {bold:true}), cell('로케이션 스캔 → 자재 목록 → 자재 선택 → 수량 입력'), cell('로케이션 바코드')),
      ]}),
      check('자재 바코드 스캔 → 수량 입력'), check('로케이션 + 자재 스캔'), check('기타: _______________'),

      divider(),
      h2('Q5-2. 보정 사유 입력'),
      check('필수 — 사유 선택형 (파손, 분실, 계량 오차, 기타)'),
      check('필수 — 자유 입력'),
      check('선택사항 — 입력 안 해도 보정 가능'),

      divider(),
      h2('Q5-3. 관리자 승인'),
      check('승인 불필요 — 작업자 단독 확정'),
      check('일정 수량 이상 차이 시 승인 필요 — 기준: ___개 이상'),
      check('모든 보정에 승인 필요'),
      check('기타: _______________'),

      // ═══════════════════════════════════════════════════════════════
      // 6. 자재재고실사
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('6. 자재재고실사 (PDA)'),
      warnBox('요구사항: 창고/로케이션별 자재재고 실사(PDA 입력). 실사 시작 시 모든 자재 재고 트랜잭션 제한. 월 1회 이상, 실사 후 기초재고 생성'),

      h2('Q6-1. 실사 시작/종료 주체'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('PC에서 시작, PDA 입력', {bold:true}), cell('PC에서 "실사 개시" → PDA에서 현장 스캔 → PC에서 "실사 종료/확정"'), cell('PC-PDA 실시간 동기화')),
        row(cell('PDA에서 직접 시작', {bold:true}), cell('PDA에서 창고 선택 → "실사 시작" → 스캔 → "실사 완료"'), cell('PDA에 실사 시작/종료 권한 부여')),
      ]}),
      check('PC에서 시작/종료, PDA는 현장 입력만'), check('PDA에서 직접 시작/종료 가능'), check('기타: _______________'),

      divider(),
      h2('Q6-2. PDA 실사 입력 방식'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('화면 예시', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('로케이션 스캔 → 자재 스캔', {bold:true}), cell('로케이션 QR 스캔 → 해당 위치 자재 하나씩 스캔 → 자동 카운트'), cell('로케이션 QR + 자재 바코드')),
        row(cell('로케이션 스캔 → 수량 입력', {bold:true}), cell('로케이션 QR 스캔 → 자재 목록 표시 → 품목별 실수량 수동 입력'), cell('로케이션 QR')),
        row(cell('자재 스캔만 (위치 무관)', {bold:true}), cell('자재 바코드 순서 무관하게 스캔 → 시스템이 위치 자동 매핑'), cell('자재 바코드에 위치 정보 포함')),
      ]}),
      check('로케이션 스캔 → 자재 스캔 (자동 카운트)'), check('로케이션 스캔 → 수량 수동 입력'), check('자재 스캔만'), check('기타: _______________'),

      divider(),
      h2('Q6-3. 트랜잭션 제한 범위'),
      infoBox('실사 중 자재 입고/불출/이동을 제한하는 범위'),
      check('실사 중인 창고만 제한 — 다른 창고는 정상 운영'),
      check('전체 창고 제한 — 실사 기간 동안 모든 자재 트랜잭션 차단'),
      check('로케이션 단위 제한 — 실사 중인 로케이션만 차단'),
      check('기타: _______________'),

      divider(),
      h2('Q6-4. 실사 결과 확정'),
      check('PDA에서 실사 완료 후 PC에서 관리자가 차이 확인 → 보정 확정'),
      check('PDA에서 바로 보정 확정 가능'),
      check('기타: _______________'),

      // ═══════════════════════════════════════════════════════════════
      // 7. 출하실적 등록
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('7. 출하실적 등록 (PDA)'),
      warnBox('요구사항: 출하지시 바코드 스캔, 제품 포장 바코드 스캔, 작업자 스캔 후 출하 처리. 출하취소는 당일까지만'),

      h2('Q7-1. 출하 스캔 순서'),
      new Table({ columnWidths: [600, 2800, 3000, 2960], rows: [
        row(cell('순서', {bold:true, bg:NAVY}), cell('방식 A', {bold:true, bg:NAVY}), cell('방식 B', {bold:true, bg:NAVY}), cell('방식 C', {bold:true, bg:NAVY})),
        row(cell('①', {bold:true}), cell('작업자 QR 스캔'), cell('출하지시서 바코드 스캔'), cell('출하지시 목록에서 선택')),
        row(cell('②'), cell('출하지시서 바코드 스캔'), cell('작업자 QR 스캔'), cell('제품 포장 바코드 스캔 (다건)')),
        row(cell('③'), cell('제품 포장 바코드 스캔 (다건)'), cell('제품 포장 바코드 스캔 (다건)'), cell('출하 확정')),
        row(cell('④'), cell('출하 확정'), cell('출하 확정'), cell('')),
      ]}),
      check('방식 A — 작업자 → 출하지시 → 제품 스캔'),
      check('방식 B — 출하지시 → 작업자 → 제품 스캔'),
      check('방식 C — 목록 선택 → 제품 스캔'),
      check('기타: _______________'),

      divider(),
      h2('Q7-2. 출하 검증'),
      h3('Q7-2-1. 제품 혼입 방지'),
      check('출하지시 품목과 다른 제품 스캔 시 차단'),
      check('경고 후 허용'),
      check('검증 없음'),

      h3('Q7-2-2. 과출하(초과 스캔) 방지'),
      check('차단 — 출하지시 수량 도달 시 추가 스캔 불가'),
      check('경고 후 허용 — "지시 수량 초과입니다. 계속하시겠습니까?"'),
      check('제한 없음'),

      divider(),
      h2('Q7-3. 스캔 단위'),
      check('개별 포장 박스 단위 스캔'),
      check('팔레트 단위 스캔 → 하위 박스 일괄 처리'),
      check('둘 다 지원'),
      check('기타: _______________'),

      divider(),
      h2('Q7-4. 부분 출하'),
      check('허용 — 출하지시 수량 미만이어도 출하 확정 가능'),
      check('불허 — 출하지시 수량 전량 스캔 후에만 확정 가능'),
      check('기타: _______________'),

      divider(),
      h2('Q7-5. 출하 취소'),
      check('PDA에서 당일 출하분 취소 가능'),
      check('PDA에서는 취소 불가 — PC에서만 처리'),
      check('기타: _______________'),

      // ═══════════════════════════════════════════════════════════════
      // 8. 제품 재고실사
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('8. 제품 재고실사 (PDA)'),
      warnBox('요구사항: 제품창고 제품 재고 실사(PDA 입력). 재고실사 시 제품 트랜잭션 제한. 월 1회 이상. 자재 재고실사와 별개 필요 (신규 개발)'),

      h2('Q8-1. 자재재고실사와 UI/UX 통일 여부'),
      check('통일 — 자재재고실사와 동일한 화면 구조로 구현'),
      check('별도 — 제품 특성에 맞는 별도 화면 설계'),

      divider(),
      h2('Q8-2. 실사 대상 범위'),
      check('완제품만'), check('완제품 + 반제품'), check('기타: _______________'),

      divider(),
      h2('Q8-3. 실사 스캔 단위'),
      new Table({ columnWidths: W3, rows: [
        row(cell('방식', {bold:true, bg:NAVY}), cell('동작 설명', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY})),
        row(cell('개별 제품 바코드', {bold:true}), cell('제품 시리얼 바코드 하나씩 스캔 → 자동 카운트'), cell('모든 제품에 시리얼 바코드')),
        row(cell('포장 박스 바코드', {bold:true}), cell('포장 바코드 스캔 → 내용물 수량 자동 반영'), cell('포장 바코드에 수량 정보 포함')),
        row(cell('팔레트 바코드', {bold:true}), cell('팔레트 스캔 → 하위 박스/제품 일괄 카운트'), cell('팔레트-박스 매핑 데이터')),
        row(cell('수량 수동 입력', {bold:true}), cell('품목 선택 → 실수량 수동 입력'), cell('없음')),
      ]}),
      check('개별 제품 바코드 스캔'), check('포장 박스 바코드 스캔'), check('팔레트 바코드 스캔'), check('수량 수동 입력'), check('복합: _______________'),

      // ═══════════════════════════════════════════════════════════════
      // 9. 추가 PDA 프로그램 검토
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('9. 추가 PDA 프로그램 검토'),
      infoBox('요구사항 원문: "화면 구조는 추후 논의 필요, 일부 추가 개발 프로그램이 발생할 수도 있음" — 아래 프로그램들은 현재 PC 전용이지만 현장 특성상 PDA가 필요할 수 있습니다.'),

      h2('Q9-1. 추가 PDA 프로그램이 필요한 것은?'),
      new Table({ columnWidths: [2400, 3600, 1680, 1680], rows: [
        row(cell('프로그램', {bold:true, bg:NAVY}), cell('PDA 필요 사유', {bold:true, bg:NAVY}), cell('필요', {bold:true, bg:NAVY, align:AlignmentType.CENTER}), cell('불필요', {bold:true, bg:NAVY, align:AlignmentType.CENTER})),
        row(cell('생산실적 입력'), cell('설비 옆에서 QR 스캔 → 바코드 스캔 → 실적 등록'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('포장'), cell('포장라인에서 제품 스캔 + 박스 바코드 스캔'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('IQC 실적 입력'), cell('입하장에서 자재 바코드 스캔하며 현장 검사'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('입하관리'), cell('입하장에서 PDA로 입하 검수/수량 확인'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('폐기'), cell('현장에서 불량 바코드 스캔 → 폐기 처리'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
      ]}),

      // ═══════════════════════════════════════════════════════════════
      // 10. 개발 우선순위
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('10. 개발 우선순위 및 일정'),

      h2('Q10-1. PDA 프로그램 개발 우선순위'),
      new Table({ columnWidths: [2800, 1640, 1640, 1640, 1640], rows: [
        row(cell('프로그램', {bold:true, bg:NAVY}), cell('1순위', {bold:true, bg:NAVY, align:AlignmentType.CENTER}), cell('2순위', {bold:true, bg:NAVY, align:AlignmentType.CENTER}), cell('3순위', {bold:true, bg:NAVY, align:AlignmentType.CENTER}), cell('불필요', {bold:true, bg:NAVY, align:AlignmentType.CENTER})),
        row(cell('PDA 프레임워크'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('설비 일상점검'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('자재입고'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('자재불출'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('자재재고보정'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('자재재고실사'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('출하실적 등록'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('제품 재고실사'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
      ]}),

      divider(),
      h2('Q10-2. 일정 관련'),
      h3('Q10-2-1. PDA 디바이스 조달 일정'),
      p('기재: _______________ (예: 2026년 N월, 이미 보유 등)'),

      h3('Q10-2-2. PC MES 오픈과 PDA 오픈 시점'),
      check('동시 오픈 — PC MES 1차 오픈 시 PDA도 함께'),
      check('PDA는 2차 오픈 — PC MES 안정화 후 PDA 배포'),
      check('기타: _______________'),

      h3('Q10-2-3. PDA 파일럿 테스트 범위'),
      check('전체 라인 동시 적용'),
      check('1~2개 라인 시범 운영 후 확대'),
      check('기타: _______________'),

      // ═══════════════════════════════════════════════════════════════
      // 11. 종합
      // ═══════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('11. 종합: 선택에 따른 사전요구사항 요약'),
      infoBox('아래는 주요 선택에 따라 사전에 준비/확정해야 할 항목을 정리한 것입니다.'),
      new Table({ columnWidths: [2600, 4200, 2560], rows: [
        row(cell('선택 사항', {bold:true, bg:NAVY}), cell('사전요구사항', {bold:true, bg:NAVY}), cell('담당/협의 대상', {bold:true, bg:NAVY})),
        row(cell('PDA 디바이스 기종'), cell('기종 확정 → 바코드 SDK 연동 방식 결정'), cell('IT 인프라, 구매팀')),
        row(cell('안드로이드 네이티브 선택'), cell('Kotlin/Java 개발 인력 확보 또는 외주'), cell('개발팀')),
        row(cell('작업자 QR 로그인'), cell('작업자별 QR 카드 발급, 카드 관리 체계 수립'), cell('현장 관리자')),
        row(cell('바코드 Buffered Mode'), cell('PDA SDK(DataWedge 등) 설정, 바코드 유형별 액션 매핑'), cell('개발팀, 장비 업체')),
        row(cell('오프라인 동기화'), cell('로컬 DB(SQLite) 설계, 충돌 해결 규칙 정의'), cell('개발팀')),
        row(cell('제조사 바코드 매핑'), cell('자재 제조사 바코드-MES 코드 매핑 테이블 사전 등록'), cell('자재 담당자')),
        row(cell('로케이션 바코드'), cell('창고 내 로케이션별 QR 코드 생성/부착'), cell('창고 관리자')),
        row(cell('불출요청서 바코드'), cell('불출요청서 바코드 체계 정의, 인쇄 프로세스 확립'), cell('프로젝트 관리자')),
        row(cell('출하지시서 바코드'), cell('출하지시서 바코드 체계 확정'), cell('영업 담당자')),
        row(cell('Wi-Fi 환경'), cell('공장 전 구역 Wi-Fi 커버리지 확보, AP 추가 설치 검토'), cell('IT 인프라')),
        row(cell('다국어 지원'), cell('PDA 앱 다국어 리소스 파일 (한/영/중/베)'), cell('개발팀')),
      ]}),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('C:/Project/HANES/docs/07-PDA-역질문서.docx', buf);
  console.log('Done!');
}).catch(err => { console.error(err); process.exit(1); });
