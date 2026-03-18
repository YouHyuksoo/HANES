/**
 * @file scripts/gen-code-definition.js
 * @description HARNESS MES 코드정의서 Word 문서 생성 (코드에서 공통코드 그룹 자동 추출)
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CW = 13440;
const MARGIN = 1200;
const C = { primary: '2B579A', hdr: 'D5E8F0', alt: 'F5F9FC', w: 'FFFFFF' };
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const tbs = { top: tb, bottom: tb, left: tb, right: tb };

function c(text, width, opts = {}) {
  return new TableCell({
    borders: tbs, width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    columnSpan: opts.span, verticalAlign: 'center',
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT, spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: text || '', bold: opts.bold || false, font: 'Arial', size: opts.size || 17, color: opts.color || '000000' })],
    })],
  });
}

function dataTbl(headers, data, widths) {
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => c(h, widths[i], { bold: true, shading: C.hdr, align: AlignmentType.CENTER, size: 15 })) }),
      ...data.map((row, idx) => new TableRow({
        children: row.map((val, i) => c(val, widths[i], { size: 15, shading: idx % 2 === 1 ? C.alt : C.w, align: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT })),
      })),
    ],
  });
}

function infoTbl(rows) {
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [3000, 10440],
    rows: rows.map(([k, v]) => new TableRow({ children: [c(k, 3000, { bold: true, shading: C.hdr }), c(v, 10440)] })),
  });
}

function sp() { return new Paragraph({ spacing: { after: 200 }, children: [] }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }
function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: 'Arial' })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: 'Arial' })] }); }

// ── 코드그룹 데이터 (코드에서 추출) ──
const groups = [
  { code: 'PART_TYPE', name: '품목유형', desc: '품목의 종류 구분', usage: 'BOM관리, 품목관리',
    codes: [['MAT', '원자재', 1], ['SEMI', '반제품', 2], ['PROD', '완제품', 3], ['SUB', '부자재', 4]] },
  { code: 'PROCESS_TYPE', name: '공정유형', desc: '생산 공정의 종류', usage: '공정관리, 라우팅, BOM, 생산실적',
    codes: [['CUT', '절단', 1], ['CRIMP', '압착', 2], ['ASSY', '조립', 3], ['INSP', '검사', 4], ['PACK', '포장', 5], ['TEST', '통전검사', 6]] },
  { code: 'EQUIP_TYPE', name: '설비유형', desc: '설비의 종류 구분', usage: '설비마스터, 라우팅',
    codes: [['PRESS', '프레스', 1], ['CUT', '절단기', 2], ['CRIMP', '압착기', 3], ['MOLD', '금형', 4], ['TEST', '검사장비', 5], ['OVEN', '오븐', 6]] },
  { code: 'EQUIP_STATUS', name: '설비상태', desc: '설비 가동/비가동 상태', usage: '설비현황 모니터링',
    codes: [['RUNNING', '가동', 1], ['IDLE', '대기', 2], ['DOWN', '고장', 3], ['PM', '보전', 4], ['OFF', '정지', 5]] },
  { code: 'UNIT_TYPE', name: '단위', desc: '수량/길이/무게 단위', usage: '라우팅 품질조건',
    codes: [['EA', '개', 1], ['M', '미터', 2], ['MM', '밀리미터', 3], ['KG', '킬로그램', 4], ['G', '그램', 5], ['SET', '세트', 6]] },
  { code: 'QUALITY_CONDITION', name: '품질조건', desc: '라우팅 품질 검사 조건', usage: '라우팅관리',
    codes: [['VISUAL', '육안검사', 1], ['MEASURE', '계측검사', 2], ['FUNC', '기능검사', 3]] },
  { code: 'JOB_ORDER_STATUS', name: '작업지시상태', desc: '작업지시 진행 상태', usage: '작업지시현황',
    codes: [['PLANNED', '계획', 1], ['RELEASED', '지시', 2], ['RUNNING', '진행', 3], ['DONE', '완료', 4], ['CANCELED', '취소', 5]] },
  { code: 'JOB_STATUS', name: '공정상태', desc: '공정별 작업 상태', usage: '통전검사',
    codes: [['WAIT', '대기', 1], ['RUNNING', '진행', 2], ['DONE', '완료', 3], ['HOLD', '보류', 4]] },
  { code: 'PROD_PLAN_STATUS', name: '생산계획상태', desc: '월간 생산계획 상태', usage: '월간생산계획',
    codes: [['DRAFT', '초안', 1], ['CONFIRMED', '확정', 2], ['CLOSED', '마감', 3]] },
  { code: 'ISSUE_TYPE', name: '출고유형', desc: '자재 출고 종류', usage: '자재출고, 출고요청, 출고이력',
    codes: [['PROD', '생산출고', 1], ['SAMPLE', '샘플출고', 2], ['SCRAP', '폐기출고', 3], ['OTHER', '기타출고', 4]] },
  { code: 'DEFECT_STATUS', name: '불량상태', desc: '불량 처리 상태', usage: '불량관리',
    codes: [['OPEN', '접수', 1], ['ANALYZING', '분석중', 2], ['RESOLVED', '해결', 3], ['CLOSED', '종결', 4]] },
  { code: 'REWORK_STATUS', name: '재작업상태', desc: '재작업 진행 상태', usage: '재작업이력',
    codes: [['REQUESTED', '요청', 1], ['IN_PROGRESS', '진행', 2], ['COMPLETED', '완료', 3], ['REJECTED', '반려', 4]] },
  { code: 'BOX_STATUS', name: '박스상태', desc: '포장 박스 상태', usage: '포장관리',
    codes: [['OPEN', '개봉', 1], ['CLOSED', '포장완료', 2], ['SHIPPED', '출하', 3]] },
  { code: 'PALLET_STATUS', name: '팔렛상태', desc: '팔렛 상태', usage: '팔렛관리',
    codes: [['OPEN', '적재중', 1], ['CLOSED', '적재완료', 2], ['SHIPPED', '출하', 3]] },
  { code: 'SHIPMENT_STATUS', name: '출하상태', desc: '출하 진행 상태', usage: '출하확정',
    codes: [['READY', '준비', 1], ['LOADING', '상차', 2], ['SHIPPED', '출하완료', 3], ['DELIVERED', '납품완료', 4]] },
  { code: 'SHIP_ORDER_STATUS', name: '출하오더상태', desc: '출하 오더 진행 상태', usage: '출하오더, 출하이력',
    codes: [['DRAFT', '초안', 1], ['CONFIRMED', '확정', 2], ['SHIPPED', '출하', 3], ['CLOSED', '마감', 4]] },
  { code: 'CONSUMABLE_CATEGORY', name: '소모품분류', desc: '소모품 카테고리', usage: '소모품마스터, 라벨, 재고, 수명',
    codes: [['TOOL', '공구', 1], ['JIG', '지그', 2], ['BLADE', '칼날', 3], ['DIE', '다이', 4], ['OTHER', '기타', 5]] },
  { code: 'CON_STOCK_STATUS', name: '소모품재고상태', desc: '소모품 재고 상태', usage: '소모품재고',
    codes: [['NORMAL', '정상', 1], ['LOW', '부족', 2], ['EXPIRED', '만료', 3]] },
  { code: 'INSPECT_CHECK_TYPE', name: '점검유형', desc: '설비 점검 종류', usage: '점검이력',
    codes: [['DAILY', '일상점검', 1], ['PERIODIC', '정기점검', 2]] },
  { code: 'INSPECT_JUDGE', name: '점검판정', desc: '설비 점검 결과 판정', usage: '점검이력',
    codes: [['OK', '양호', 1], ['NG', '불량', 2], ['CONDITIONAL', '조건부', 3]] },
  { code: 'PM_TYPE', name: '예방보전유형', desc: '예방보전 종류', usage: '예방보전계획',
    codes: [['TIME', '시간기반', 1], ['CONDITION', '상태기반', 2], ['PREDICT', '예측기반', 3]] },
  { code: 'PM_CYCLE_TYPE', name: 'PM주기유형', desc: '예방보전 주기 단위', usage: '예방보전계획',
    codes: [['DAILY', '일', 1], ['WEEKLY', '주', 2], ['MONTHLY', '월', 3], ['YEARLY', '연', 4]] },
  { code: 'PM_ITEM_TYPE', name: 'PM항목유형', desc: '예방보전 점검 항목 종류', usage: '예방보전계획',
    codes: [['CHECK', '점검', 1], ['REPLACE', '교체', 2], ['CLEAN', '청소', 3], ['CALIBRATE', '교정', 4]] },
  { code: 'VISUAL_DEFECT', name: '외관불량유형', desc: '육안 검사 불량 종류', usage: '공정검사',
    codes: [['SCRATCH', '스크래치', 1], ['DENT', '찍힘', 2], ['DISCOLOR', '변색', 3], ['CRACK', '크랙', 4], ['OTHER', '기타', 5]] },
  { code: 'JUDGE_YN', name: '합부판정', desc: '검사 합격/불합격 판정', usage: '샘플검사',
    codes: [['PASS', '합격', 1], ['FAIL', '불합격', 2], ['CONDITIONAL', '조건부합격', 3]] },
  { code: 'INSPECT_METHOD', name: '검사방법', desc: 'Control Plan 검사 방법', usage: 'Control Plan',
    codes: [['VISUAL', '육안', 1], ['GAUGE', '게이지', 2], ['CMM', 'CMM', 3], ['FUNCTION', '기능', 4]] },
  { code: 'SAMPLE_SIZE', name: '샘플크기', desc: '검사 샘플링 수량', usage: 'Control Plan',
    codes: [['1', '1개', 1], ['3', '3개', 2], ['5', '5개', 3], ['N', '전수', 4]] },
  { code: 'SAMPLE_FREQ', name: '샘플빈도', desc: '검사 샘플링 빈도', usage: 'Control Plan',
    codes: [['LOT', 'LOT별', 1], ['SHIFT', '교대별', 2], ['DAILY', '일별', 3], ['FIRST', '초물', 4]] },
  { code: 'CONTROL_METHOD', name: '관리방법', desc: 'Control Plan 관리 수단', usage: 'Control Plan',
    codes: [['SPC', 'SPC차트', 1], ['LOG', '기록관리', 2], ['CERT', '성적서', 3]] },
  { code: 'TRAINING_TYPE', name: '교육유형', desc: '교육 종류', usage: '교육관리',
    codes: [['INITIAL', '초기교육', 1], ['PERIODIC', '정기교육', 2], ['SPECIAL', '특별교육', 3]] },
  { code: 'TRAINING_STATUS', name: '교육상태', desc: '교육 진행 상태', usage: '교육관리',
    codes: [['PLANNED', '계획', 1], ['ONGOING', '진행', 2], ['COMPLETED', '완료', 3], ['CANCELED', '취소', 4]] },
  { code: 'DOC_TYPE', name: '문서유형', desc: '문서 종류', usage: '문서관리',
    codes: [['SPEC', '규격서', 1], ['MANUAL', '매뉴얼', 2], ['DRAWING', '도면', 3], ['SOP', 'SOP', 4]] },
  { code: 'DOC_STATUS', name: '문서상태', desc: '문서 승인/관리 상태', usage: '문서관리',
    codes: [['DRAFT', '초안', 1], ['REVIEW', '검토', 2], ['APPROVED', '승인', 3], ['OBSOLETE', '폐기', 4]] },
  { code: 'GAUGE_TYPE', name: '계측기유형', desc: '계측기 종류', usage: '계측기마스터',
    codes: [['CALIPER', '캘리퍼', 1], ['MICROMETER', '마이크로미터', 2], ['GAUGE', '게이지', 3], ['CMM', 'CMM', 4]] },
  { code: 'GAUGE_STATUS', name: '계측기상태', desc: '계측기 교정/사용 상태', usage: '계측기마스터',
    codes: [['ACTIVE', '사용중', 1], ['CALIBRATING', '교정중', 2], ['EXPIRED', '교정만료', 3], ['SCRAPPED', '폐기', 4]] },
  { code: 'SCHED_GROUP', name: '스케줄러그룹', desc: '스케줄러 작업 그룹', usage: '스케줄러관리',
    codes: [['SYSTEM', '시스템', 1], ['BATCH', '배치', 2], ['REPORT', '리포트', 3], ['INTERFACE', '인터페이스', 4]] },
  { code: 'SCHED_EXEC_TYPE', name: '스케줄러실행유형', desc: '스케줄러 실행 방식', usage: '스케줄러관리',
    codes: [['CRON', 'Cron 스케줄', 1], ['INTERVAL', '주기실행', 2], ['ONCE', '1회실행', 3]] },
  { code: 'SCHED_STATUS', name: '스케줄러상태', desc: '스케줄러 실행 결과 상태', usage: '스케줄러관리, 로그',
    codes: [['SUCCESS', '성공', 1], ['FAIL', '실패', 2], ['RUNNING', '실행중', 3], ['SKIPPED', '스킵', 4]] },
];

function buildDoc() {
  const cover = {
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ spacing: { before: 4000 }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'HARNESS MES', font: 'Arial', size: 56, bold: true, color: C.primary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Manufacturing Execution System', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '\uCF54\uB4DC\uC815\uC758\uC11C', font: 'Arial', size: 48, bold: true, color: '333333' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: '\uACF5\uD1B5\uCF54\uB4DC(ComCode) \uC804\uCCB4 \uBAA9\uB85D', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      new Table({
        width: { size: 5000, type: WidthType.DXA }, columnWidths: [2000, 3000],
        rows: [['프로젝트명', 'HARNESS MES'], ['산출물명', '코드정의서'], ['버전', 'v1.0'], ['작성일', '2026-03-18'], ['작성자', 'HANES MES팀']].map(([k, v]) =>
          new TableRow({ children: [c(k, 2000, { bold: true, shading: C.hdr, align: AlignmentType.CENTER }), c(v, 3000)] })
        ),
      }),
    ],
  };

  const body = [];
  body.push(h1('\uAC1C\uC815\uC774\uB825'), dataTbl(['버전', '일자', '작성자', '변경내용'], [['1.0', '2026-03-18', 'HANES MES팀', '최초 작성']], [1500, 1500, 2000, 8440]), pb());
  body.push(h1('\uBAA9\uCC28'), new TableOfContents('TOC', { hyperlink: true, headingStyleRange: '1-3' }), pb());

  // 1. 개요
  body.push(h1('1. \uAC1C\uC694'),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '\uBCF8 \uBB38\uC11C\uB294 HARNESS MES \uC2DC\uC2A4\uD15C\uC5D0\uC11C \uC0AC\uC6A9\uD558\uB294 \uACF5\uD1B5\uCF54\uB4DC(ComCode)\uC758 \uC804\uCCB4 \uBAA9\uB85D\uC744 \uC815\uC758\uD55C\uB2E4. \uCF54\uB4DC \uADF8\uB8F9\uBCC4 \uC0C1\uC138 \uCF54\uB4DC\uAC12, \uC0AC\uC6A9\uCC98, \uC18D\uC131\uC744 \uAE30\uC220\uD55C\uB2E4.', font: 'Arial', size: 20 })] }),
    infoTbl([
      ['테이블', 'COM_CODES (복합 PK: GROUP_CODE + DETAIL_CODE)'],
      ['총 코드그룹 수', String(groups.length)],
      ['총 코드값 수', String(groups.reduce((s, g) => s + g.codes.length, 0))],
      ['UI 컴포넌트', 'ComCodeBadge (배지 표시) + useComCodeOptions (셀렉트 옵션)'],
      ['색상 속성', 'ATTR1 (TailwindCSS 색상명)'],
    ]), pb());

  // 2. 코드그룹 목록
  body.push(h1('2. \uCF54\uB4DC\uADF8\uB8F9 \uBAA9\uB85D'));
  const listW = [500, 2800, 2000, 4000, 1200, 2940];
  body.push(dataTbl(['No', '그룹코드', '그룹명', '설명', '코드수', '사용 화면'],
    groups.map((g, i) => [String(i + 1), g.code, g.name, g.desc, String(g.codes.length), g.usage]),
    listW), pb());

  // 3. 코드그룹별 상세
  body.push(h1('3. \uCF54\uB4DC\uADF8\uB8F9\uBCC4 \uC0C1\uC138'));
  groups.forEach((g, idx) => {
    body.push(h2(`3.${idx + 1} ${g.name} (${g.code})`));
    body.push(infoTbl([['그룹코드', g.code], ['그룹명', g.name], ['설명', g.desc], ['코드 수', String(g.codes.length)], ['사용 화면', g.usage]]), sp());
    const codeW = [500, 1800, 2500, 1200, 1000, 5940];  // No, 코드값, 코드명, 정렬, 사용, 비고
    body.push(dataTbl(['No', '코드값', '코드명', '정렬', '사용', '비고'],
      g.codes.map((cd, i) => [String(i + 1), cd[0], cd[1], String(cd[2]), 'Y', '']),
      codeW), sp());
    if (idx < groups.length - 1 && idx % 4 === 3) body.push(pb());
  });

  // 4. 통계
  body.push(pb(), h1('4. \uCF54\uB4DC \uD1B5\uACC4'));
  // 도메인별 그룹핑
  const domains = {
    '기준정보': ['PART_TYPE', 'PROCESS_TYPE', 'EQUIP_TYPE', 'UNIT_TYPE', 'QUALITY_CONDITION'],
    '생산관리': ['JOB_ORDER_STATUS', 'JOB_STATUS', 'PROD_PLAN_STATUS'],
    '자재관리': ['ISSUE_TYPE'],
    '품질관리': ['DEFECT_STATUS', 'REWORK_STATUS', 'VISUAL_DEFECT', 'JUDGE_YN', 'INSPECT_METHOD', 'SAMPLE_SIZE', 'SAMPLE_FREQ', 'CONTROL_METHOD'],
    '설비관리': ['EQUIP_STATUS', 'INSPECT_CHECK_TYPE', 'INSPECT_JUDGE', 'PM_TYPE', 'PM_CYCLE_TYPE', 'PM_ITEM_TYPE'],
    '계측기관리': ['GAUGE_TYPE', 'GAUGE_STATUS'],
    '출하관리': ['BOX_STATUS', 'PALLET_STATUS', 'SHIPMENT_STATUS', 'SHIP_ORDER_STATUS'],
    '소모품관리': ['CONSUMABLE_CATEGORY', 'CON_STOCK_STATUS'],
    '시스템관리': ['TRAINING_TYPE', 'TRAINING_STATUS', 'DOC_TYPE', 'DOC_STATUS', 'SCHED_GROUP', 'SCHED_EXEC_TYPE', 'SCHED_STATUS'],
  };
  const statsW = [500, 2000, 2000, 1500, 7440];
  const statsData = [];
  let no = 0;
  for (const [domain, codes] of Object.entries(domains)) {
    no++;
    const grpCount = codes.length;
    const codeCount = codes.reduce((s, gc) => { const g = groups.find(x => x.code === gc); return s + (g ? g.codes.length : 0); }, 0);
    statsData.push([String(no), domain, String(grpCount), String(codeCount), codes.join(', ')]);
  }
  statsData.push(['', '합계', String(groups.length), String(groups.reduce((s, g) => s + g.codes.length, 0)), '']);
  body.push(dataTbl(['No', '도메인', '그룹 수', '코드 수', '포함 그룹코드'], statsData, statsW));

  const bodySection = {
    properties: { page: { size: { width: 11906, height: 16838, orientation: 'landscape' }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'HARNESS MES - \uCF54\uB4DC\uC815\uC758\uC11C', font: 'Arial', size: 16, color: '999999' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' })] })] }) },
    children: body,
  };

  return new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: 'Arial', color: C.primary }, paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Arial', color: '333333' }, paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 } },
      ],
    },
    sections: [cover, bodySection],
  });
}

async function main() {
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync('docs/deliverables/system', { recursive: true });
  const outPath = 'docs/deliverables/system/코드정의서_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);
