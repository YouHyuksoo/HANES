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
          new TextRun({ text: 'HANES MES - ?명꽣????쭏臾몄꽌', size: 16, font: 'Arial', color: GRAY, italics: true }) ] }) ] })
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
        children: [new TextRun({ text: '?명꽣??援ы쁽???꾪븳 ??쭏臾몄꽌', bold: true, size: 44, font: 'Arial', color: NAVY })] }),
      new Paragraph({ spacing: { before: 100, after: 40 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'HANES MES ?꾨줈?앺듃', size: 24, font: 'Arial', color: GRAY })] }),
      new Paragraph({ spacing: { before: 200, after: 60 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '?묒꽦?? 2026-02-23 | ?뚯떊 ?붿껌: ?대떦 ??ぉ??泥댄겕(\u2611) ?먮뒗 湲곗옱 ???뚯떊', size: 18, font: 'Arial', color: GRAY })] }),
      divider(),
      infoBox('04-?꾨줈?몄뒪.md???명꽣??議곌굔???섏뿴?섏뼱 ?덉쑝?? 援ъ껜?곸씤 援ы쁽 諛⑹떇??誘몄젙???곹깭?낅땲?? ?꾨옒 吏덈Ц??????듬????듯빐 ?명꽣???쒖뒪?쒖쓽 ?ㅺ퀎 諛⑺뼢???뺤젙?⑸땲??'),

      // === 1. ?명꽣??李⑤떒 ?섏? ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('1. ?명꽣??李⑤떒 ?섏?'),
      p('?명꽣?쎌씠 諛쒕룞?섏뿀???? ?묒뾽???대뼡 ?섏??쇰줈 留됱쓣 寃껋씤媛?'),
      h2('Q1-1. 湲곕낯 李⑤떒 ?섏? ?좏깮'),
      new Table({ columnWidths: [1600, 3400, 2200, 2160], rows: [
        row(cell('諛⑹떇', {bold:true, bg:NAVY}), cell('?숈옉 ?ㅻ챸', {bold:true, bg:NAVY}), cell('?붾㈃ ?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('A. Hard Block', {bold:true}), cell('議곌굔 誘몄땐議????묒뾽 吏꾪뻾 遺덇?. 踰꾪듉 鍮꾪솢?깊솕, API 嫄곕?'), cell('"?ㅼ쟻?깅줉" 踰꾪듉 鍮꾪솢?깊솕. "?ㅻ퉬 ?쇱긽?먭???癒쇱? ?꾨즺?섏꽭?? ?덈궡'), cell('?놁쓬 (湲곕낯 援ы쁽)')),
        row(cell('B. Soft Block', {bold:true}), cell('寃쎄퀬 ?앹뾽 ?쒖떆 ?? 沅뚰븳???뱀씤?쇰줈 ?고쉶 媛??), cell('"?ㅻ퉬?먭? 誘몄떎???곹깭?낅땲?? 愿由ъ옄 ?뱀씤 ??吏꾪뻾?섏떆寃좎뒿?덇퉴?" ??愿由ъ옄 ID/PW ?낅젰'), cellRuns([{text:'?뱀씤 沅뚰븳 泥닿퀎 ?꾩슂', bold:true}, ', ?뱀씤 UI 媛쒕컻, ?고쉶 ?ъ쑀 ?낅젰?'])),
        row(cell('C. Warning Only', {bold:true}), cell('寃쎄퀬 ?쒖떆留??섍퀬 ?묒뾽? ?덉슜. ?대젰留??④?'), cell('"二쇱쓽: 遺???ъ슜?잛닔 珥덇낵 (12,340/10,000)" 諛곕꼫 ?쒖떆, ?묒뾽 媛??), cellRuns([{text:'?대젰 ?뚯씠釉??꾩슂', bold:true}, ' (寃쎄퀬 臾댁떆 ?대젰 湲곕줉)'])),
      ]}),
      check('A. Hard Block'), check('B. Soft Block'), check('C. Warning Only'), check('湲고?: _______________'),

      divider(),
      h2('Q1-2. ?명꽣??議곌굔蹂꾨줈 李⑤떒 ?섏????ㅻⅤ寃?媛?멸컝 寃껋씤媛?'),
      infoBox('?덉떆: "?ㅻ퉬?먭? 誘몄떎????Hard Block, "遺???ъ슜?잛닔 珥덇낵"??Soft Block, "怨듭젙?쒖꽌 誘몄씪移???Warning Only ??),
      check('?숈씪 ??紐⑤뱺 ?명꽣?쎌뿉 媛숈? 李⑤떒 ?섏? ?곸슜'),
      check('議곌굔蹂?李⑤벑 ???명꽣??醫낅쪟留덈떎 李⑤떒 ?섏????ㅻⅤ寃??ㅼ젙'),
      infoBox('"議곌굔蹂?李⑤벑" ?좏깮 ?? ?명꽣???좏삎蹂?李⑤떒 ?섏? 留ㅽ븨 ?뚯씠釉??꾩슂 (DB ?먮뒗 ?ㅼ젙 ?뚯씪). 3?μ쓽 媛??명꽣??議곌굔留덈떎 李⑤떒 ?섏???蹂꾨룄 吏???꾩슂.'),

      divider(),
      h2('Q1-3. Soft Block ?고쉶 ?뱀씤 諛⑹떇'),
      p('(Q1-1 ?먮뒗 Q1-2?먯꽌 Soft Block ?좏깮 ??', { run: { italics: true, color: GRAY } }),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('諛⑹떇', {bold:true, bg:NAVY}), cell('?붾㈃ ?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('愿由ъ옄 ID/PW ?낅젰', {bold:true}), cell('?앹뾽??ID, 鍮꾨?踰덊샇 ?낅젰 ??濡쒓렇??寃利????뱀씤 沅뚰븳 ?뺤씤'), cell('?뱀씤 媛????븷(Role) ?뺤쓽 ?꾩슂')),
        row(cell('愿由ъ옄 QR ?ㅼ틪', {bold:true}), cell('"愿由ъ옄 QR???ㅼ틪?섏꽭?? ??QR ?몄떇 ???뱀씤'), cell('愿由ъ옄 QR 移대뱶 諛쒓툒, PC??QR 由щ뜑湲??ㅼ튂')),
        row(cell('愿由ъ옄 ?щ쾲 ?낅젰', {bold:true}), cell('愿由ъ옄 ?щ쾲 ?낅젰 ???щ쾲 ?좏슚???뺤씤 ???뱀씤'), cell('?묒뾽?먮쭏?ㅽ꽣???뱀씤沅뚰븳 ?뚮옒洹?異붽?')),
      ]}),
      check('愿由ъ옄 ID/PW ?낅젰'), check('愿由ъ옄 QR ?ㅼ틪'), check('愿由ъ옄 ?щ쾲 ?낅젰'), check('湲고?: _______________'),

      // === 2. ?명꽣??泥댄겕 ?쒖젏 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('2. ?명꽣??泥댄겕 ?쒖젏'),
      h2('Q2-1. ?명꽣?쎌쓣 ?몄젣 泥댄겕?섎뒗媛?'),
      infoBox('?꾩옱 ?앹궛?ㅼ쟻 ?낅젰 ?먮쫫: ?쇱씤 ?좏깮 ??怨듭젙 ?좏깮 ???ㅻ퉬 ?좏깮 ???묒뾽吏???좏깮 ???묒뾽???좏깮 ???ㅼ쟻?낅젰 紐⑤떖'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('?쒖젏', {bold:true, bg:NAVY}), cell('?붾㈃ ?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('A. ?ㅻ퉬 ?좏깮 ??, {bold:true}), cell('?ㅻ퉬 移대뱶 ?대┃ ???명꽣??泥댄겕 ??誘몄땐議???"???ㅻ퉬???ъ슜 遺덇?" 硫붿떆吏'), cell('?놁쓬')),
        row(cell('B. ?묒뾽?쒖옉 踰꾪듉 ?대┃ ??, {bold:true}), cell('5?④퀎 ?좏깮 ?꾨즺 ??"?묒뾽?쒖옉" ?대┃ ???명꽣??泥댄겕 ???먮윭 ?앹뾽'), cell('?놁쓬')),
        row(cell('C. ?ㅼ쟻 ????깅줉) ??, {bold:true}), cell('?섎웾 ?낅젰 ??"?깅줉" ?대┃ ???명꽣??泥댄겕 ?????嫄곕?'), cell('?놁쓬')),
        row(cell('D. ?ㅻ퉬 媛???좏샇 ?꾩넚 吏곸쟾', {bold:true}), cell('MES ???ㅻ퉬 媛??紐낅졊 ?꾩넚 ???명꽣??泥댄겕'), cellRuns([{text:'?ㅻ퉬 ?듭떊 ?곕룞 ?좏뻾 ?꾨즺 ?꾩슂', bold:true}])),
      ]}),
      check('A. ?ㅻ퉬 ?좏깮 ??), check('B. ?묒뾽?쒖옉 踰꾪듉 ?대┃ ??), check('C. ?ㅼ쟻 ????깅줉) ??), check('D. ?ㅻ퉬 媛???좏샇 ?꾩넚 吏곸쟾'), check('蹂듭닔 ?쒖젏 (?? A+C 議고빀): _______________'),

      divider(),
      h2('Q2-2. ?ㅼ떆媛?媛먯떆媛 ?꾩슂?쒓??'),
      new Table({ columnWidths: [2000, 3800, 3560], rows: [
        row(cell('諛⑹떇', {bold:true, bg:NAVY}), cell('?숈옉 ?ㅻ챸', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('?쒖젏 泥댄겕', {bold:true}), cell('Q2-1?먯꽌 ?좏깮???쒖젏?먮쭔 1??泥댄겕'), cell('?놁쓬')),
        row(cell('?ㅼ떆媛??대쭅', {bold:true}), cell('?붾㈃ 吏꾩엯 ??N珥덈쭏???쒕쾭???명꽣???곹깭 議고쉶'), cell('?쒕쾭 遺??怨좊젮 ?꾩슂 (?ㅻ퉬 ??x ?대쭅 二쇨린)')),
      ]}),
      check('?쒖젏 泥댄겕留뚯쑝濡?異⑸텇'), check('?ㅼ떆媛??대쭅 ?꾩슂 ??二쇨린: ___珥?),

      // === 3. ?명꽣??議곌굔蹂??몃? ?뺤쓽 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('3. ?명꽣??議곌굔蹂??몃? ?뺤쓽'),

      // 3-1
      h2('3-1. ?ㅻ퉬 ?쇱긽?먭? 誘몄떎??),
      infoBox('愿??怨듭젙: ??댁뼱?덈떒, ?몄“泥댁젅?? ?뺤갑, 珥덉쓬?뚯쑖李? ?듯빀寃??| ?꾩옱 ?곹깭: ?ㅻ퉬 ?쇱긽?먭? CRUD ?꾧뎄??(EQUIP_INSPECT_LOGS ?뚯씠釉?'),
      h3('Q3-1-1. "?먭? ?꾨즺"???먮떒 湲곗???'),
      new Table({ columnWidths: [2200, 3800, 3360], rows: [
        row(cell('湲곗?', {bold:true, bg:NAVY}), cell('?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('?뱀씪 湲곗?', {bold:true}), cell('?ㅻ뒛 ?대떦 ?ㅻ퉬???먭? 湲곕줉??1嫄??댁긽 議댁옱?섎㈃ ?듦낵'), cell('?먭? 湲곗? ?쒓컖 ?뺤쓽 ?꾩슂 (?먯젙? 援먮? ?쒖옉?)')),
        row(cell('援먮?(Shift) 湲곗?', {bold:true}), cell('?꾩옱 援먮?議곗쓽 ?먭? 湲곕줉??議댁옱?섎㈃ ?듦낵 (08:00~20:00, 20:00~08:00)'), cell('援먮? ?ㅼ?以?留덉뒪???꾩슂 (誘멸뎄??')),
        row(cell('理쒓렐 N?쒓컙 ?대궡', {bold:true}), cell('?꾩옱 ?쒓컖 湲곗? N?쒓컙 ?대궡???먭? 湲곕줉???덉쑝硫??듦낵'), cell('N媛??뺤쓽 ?꾩슂')),
      ]}),
      check('?뱀씪 湲곗? ??湲곗? ?쒓컖: ___??), check('援먮?(Shift) 湲곗?'), check('理쒓렐 N?쒓컙 ?대궡 ??N = ___?쒓컙'), check('湲고?: _______________'),

      h3('Q3-1-2. ?먭? 寃곌낵媛 "遺덊빀寃???寃쎌슦??'),
      new Table({ columnWidths: [2800, 3200, 3360], rows: [
        row(cell('泥섎━', {bold:true, bg:NAVY}), cell('?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('?⑷꺽留??몄젙', {bold:true}), cell('寃곌낵媛 FAIL?대㈃ ?명꽣??諛쒕룞 ?좎?'), cell('?놁쓬 (PASS/FAIL ?꾨뱶 議댁옱)')),
        row(cell('?ㅼ떆 ?먯껜濡??몄젙', {bold:true}), cell('?먭? 湲곕줉留??덉쑝硫?寃곌낵 臾닿? ?듦낵'), cell('?놁쓬')),
        row(cell('遺덊빀寃????꾩냽 議곗튂 ?꾨즺 ??, {bold:true}), cell('FAIL ???섎━/議곗튂 ???ъ젏寃 PASS ???댁젣'), cell('?꾩냽 議곗튂 湲곕줉 ?꾨뱶 異붽? ?꾩슂')),
      ]}),
      check('?⑷꺽(PASS)留??몄젙'), check('?ㅼ떆 ?먯껜濡??몄젙'), check('遺덊빀寃????꾩냽 議곗튂 ?꾨즺 ???몄젙'), check('湲고?: _______________'),

      // 3-2
      divider(),
      h2('3-2. ?ㅻ퉬遺???뚮え?? ?ъ슜?쒗븳 ?잛닔 珥덇낵'),
      infoBox('愿??怨듭젙: ??댁뼱?덈떒, ?몄“泥댁젅?? ?뺤갑, 珥덉쓬?뚯쑖李? ?듯빀寃??| ?꾩옱 ?곹깭: expectedLife, currentCount, status(NORMAL/WARNING/REPLACE) 愿由?以?),
      h3('Q3-2-1. ?뚮え???곹깭蹂?泥섎━??'),
      new Table({ columnWidths: [1800, 3200, 2200, 2160], rows: [
        row(cell('?곹깭', {bold:true, bg:NAVY}), cell('?섎?', {bold:true, bg:NAVY}), cell('寃쎄퀬留?', {bold:true, bg:NAVY}), cell('李⑤떒?', {bold:true, bg:NAVY})),
        row(cell('NORMAL'), cell('currentCount < expectedLife x 80%'), cell('?뺤긽 ?듦낵'), cell('?뺤긽 ?듦낵')),
        row(cellRuns([{text:'WARNING', bold:true, color:'D97706'}]), cell('currentCount >= expectedLife x 80%'), cell('\u2610 寃쎄퀬留?), cell('\u2610 李⑤떒')),
        row(cellRuns([{text:'REPLACE', bold:true, color:'DC2626'}]), cell('currentCount >= expectedLife'), cell('\u2610 寃쎄퀬留?), cell('\u2610 李⑤떒')),
      ]}),

      h3('Q3-2-2. ?ъ슜?잛닔 移댁슫??諛⑹떇??'),
      new Table({ columnWidths: [2800, 3200, 3360], rows: [
        row(cell('諛⑹떇', {bold:true, bg:NAVY}), cell('?숈옉 ?ㅻ챸', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('?ㅼ쟻 ?깅줉 ???먮룞 +1', {bold:true}), cell('?ㅼ쟻 ?깅줉 ???뚮え??currentCount +1'), cell('?ㅻ퉬-?뚮え???μ갑 留ㅽ븨 ?뺥솗?댁빞 ??)),
        row(cell('?ㅼ쟻 ?깅줉 ??+?앹궛?섎웾', {bold:true}), cell('?묓뭹 + 遺덈웾 ?⑷퀎留뚰겮 移댁슫??利앷?'), cell('?꾩? ?숈씪')),
        row(cell('?ㅻ퉬 媛???곗씠???먮룞 ?섏쭛', {bold:true}), cell('?ㅻ퉬媛 1???숈옉留덈떎 MES濡?移댁슫???좏샇 ?꾩넚'), cell('?ㅻ퉬 ?듭떊 ?곕룞 ?꾩닔')),
        row(cell('?묒뾽???섎룞 ?낅젰', {bold:true}), cell('援먮? 醫낅즺 ???ъ슜?잛닔 吏곸젒 ?낅젰'), cell('?섎룞 ?낅젰 ?붾㈃ 異붽? ?꾩슂')),
      ]}),
      check('?ㅼ쟻 ?깅줉 ???먮룞 +1'), check('?ㅼ쟻 ?깅줉 ??+?앹궛?섎웾'), check('?ㅻ퉬 媛???곗씠???먮룞 ?섏쭛'), check('?묒뾽???섎룞 ?낅젰'), check('湲고?: _______________'),

      h3('Q3-2-3. ?뚮え??援먯껜 ??移댁슫??由ъ뀑? ?꾧? ?섎뒗媛?'),
      check('?ㅻ퉬 ?대떦?먭? ?뚮え??愿由??붾㈃?먯꽌 援먯껜 ?깅줉 (?꾩옱 媛??'),
      check('?묒뾽?먭? QR ?ㅼ틪?쇰줈 援먯껜 ?깅줉 ???뚮え??QR 遺李? 援먯껜 ?깅줉 ?붾㈃ ?꾩슂'),
      check('湲고?: _______________'),

      // 3-3
      new Paragraph({ children: [new PageBreak()] }),
      h2('3-3. ?먯옱 誘몄씪移?),
      infoBox('愿??怨듭젙: ??댁뼱?덈떒, 以鍮꾧났?? ?뺤갑, 遺?먯옱?쎌엯, 議곕┰, ?듯빀寃??| ?꾩옱 ?곹깭: BOM留덉뒪??議댁옱, LOT 愿由?援ы쁽?? ?먯옱 ?ъ엯 寃利?誘멸뎄??),
      h3('Q3-3-1. "?먯옱 ?쇱튂"??寃利?踰붿쐞??'),
      new Table({ columnWidths: [2600, 3200, 3560], rows: [
        row(cell('寃利??섏?', {bold:true, bg:NAVY}), cell('?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('?덈쾲留??쇱튂', {bold:true}), cell('BOM??"WIRE-001" ???ъ엯 ?먯옱 "WIRE-001"?대㈃ ?듦낵'), cell('?먯옱 ?ъ엯 湲곕줉 湲곕뒫 異붽? ?꾩슂')),
        row(cell('?덈쾲 + LOT', {bold:true}), cell('??+ LOT 踰덊샇源뚯? 湲곕줉?섏뿬 異붿쟻'), cell('??+ LOT ?좏깮/?낅젰 UI 異붽?')),
        row(cell('?덈쾲 + LOT + ?좏슚湲고븳', {bold:true}), cell('??+ ?좏슚湲고븳 留뚮즺 ?먯옱 李⑤떒'), cell('??+ ?좏슚湲고븳 泥댄겕 濡쒖쭅 (ShelfLife ?곕룞)')),
        row(cell('?덈쾲+LOT+?좏슚湲고븳+?섎웾', {bold:true}), cell('??+ BOM ?섎웾 ?鍮?珥덇낵 ?ъ엯 李⑤떒'), cell('??+ ?섎웾 鍮꾧탳 濡쒖쭅, ?먮룞 ?ш퀬 李④컧')),
      ]}),
      check('?덈쾲留??쇱튂'), check('?덈쾲 + LOT'), check('?덈쾲 + LOT + ?좏슚湲고븳'), check('?덈쾲 + LOT + ?좏슚湲고븳 + ?섎웾'), check('湲고?: _______________'),

      h3('Q3-3-2. ?먯옱 ?뺤씤 諛⑸쾿??'),
      new Table({ columnWidths: [2200, 3400, 3760], rows: [
        row(cell('諛⑸쾿', {bold:true, bg:NAVY}), cell('?붾㈃ ?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('諛붿퐫???ㅼ틪', {bold:true}), cell('"?먯옱 諛붿퐫???ㅼ틪" ???ㅼ틦?덈줈 ?쇰꺼 ?ㅼ틪 ???덈쾲 ?먮룞 留ㅼ묶'), cell('紐⑤뱺 ?먯옱 LOT??諛붿퐫???쇰꺼 遺李? PC???ㅼ틦???ㅼ튂')),
        row(cell('?쒕∼?ㅼ슫 ?좏깮', {bold:true}), cell('BOM 湲곗? ?꾩슂 ?먯옱 紐⑸줉 ???묒뾽?먭? ?ъ슜 以?LOT ?좏깮'), cell('遺덉텧???먯옱 LOT 紐⑸줉 議고쉶 API ?꾩슂')),
        row(cell('?섎룞 ?덈쾲 ?낅젰', {bold:true}), cell('?묒뾽?먭? ?덈쾲 ?먮뒗 LOT 踰덊샇瑜?吏곸젒 ??댄븨'), cell('?낅젰 ?ㅻ쪟 媛?μ꽦 ?믪쓬, ?좏슚??寃利?濡쒖쭅 ?꾩슂')),
      ]}),
      check('諛붿퐫???ㅼ틪'), check('?쒕∼?ㅼ슫 ?좏깮'), check('?섎룞 ?덈쾲 ?낅젰'), check('蹂듯빀 (諛붿퐫???곗꽑, ?섎룞 蹂댁“): _______________'),

      // 3-4
      divider(),
      h2('3-4. 怨듭젙?쒖꽌 誘몄씪移?),
      infoBox('愿??怨듭젙: ?몄“泥댁젅??~ ?쒗뭹?ъ옣 (9媛?怨듭젙) | ?꾩옱 ?곹깭: ProcessMap(?쇱슦?? seq ?뺤쓽?? ?쒖꽌 寃利?濡쒖쭅 誘멸뎄??),
      h3('Q3-4-1. 怨듭젙?쒖꽌 寃利?湲곗???'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('湲곗?', {bold:true, bg:NAVY}), cell('?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('吏곸쟾 怨듭젙留??뺤씤', {bold:true}), cell('?꾩옱 seq=3?대㈃, seq=2 ?ㅼ쟻 議댁옱 ???듦낵'), cell('?쒕━??LOT)蹂?怨듭젙 ?대젰 議고쉶 濡쒖쭅 ?꾩슂')),
        row(cell('紐⑤뱺 ?좏뻾 怨듭젙 ?뺤씤', {bold:true}), cell('?꾩옱 seq=3?대㈃, seq=1, 2 紐⑤몢 ?ㅼ쟻 ?꾩슂'), cell('??+ ?꾩쟻 寃利?)),
        row(cell('?쇱슦??湲곗? ?먮룞 ?먮떒', {bold:true}), cell('ProcessMap seq ?쒖꽌?먯꽌 ?좏뻾 怨듭젙 ?먮룞 ?꾩텧'), cell('紐⑤뱺 ?덈ぉ ProcessMap ?뺥솗 ?깅줉 ?꾩슂')),
      ]}),
      check('吏곸쟾 怨듭젙留??뺤씤'), check('紐⑤뱺 ?좏뻾 怨듭젙 ?뺤씤'), check('湲고?: _______________'),

      h3('Q3-4-2. 怨듭젙 嫄대꼫?곌린(Skip) ?덉슜 ?щ???'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('諛⑹떇', {bold:true, bg:NAVY}), cell('?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('?덈? 遺덇?', {bold:true}), cell('?대뼡 寃쎌슦?먮룄 ?좏뻾 怨듭젙 ?놁씠 吏꾪뻾 遺덇?'), cell('?놁쓬')),
        row(cell('愿由ъ옄 ?뱀씤 ??媛??, {bold:true}), cell('?뱀닔 ?곹솴?먯꽌 愿由ъ옄 ?뱀씤 ??嫄대꼫?곌린 ?덉슜'), cell('Q1-3 ?뱀씤 諛⑹떇 ?곸슜, ?ъ쑀 湲곕줉 ?꾩슂')),
        row(cell('紐⑤뜽???곕씪 ?좏깮??, {bold:true}), cell('?뱀젙 紐⑤뜽? ?쇰? 怨듭젙 ?놁쓬 (?? 以鍮꾧났???앸왂)'), cell('ProcessMap "?꾩닔/?좏깮" ?꾨뱶 異붽? ?꾩슂')),
      ]}),
      check('?덈? 遺덇?'), check('愿由ъ옄 ?뱀씤 ??媛??), check('紐⑤뜽???곕씪 ?좏깮??), check('湲고?: _______________'),

      // 3-5
      new Paragraph({ children: [new PageBreak()] }),
      h2('3-5. ?섑뵆寃???묓뭹議곌굔 誘몄땐議?),
      infoBox('愿??怨듭젙: ?뺤갑(?↔컖), ?뺤갑/珥덉쓬?뚯쑖李?| ?꾩옱 ?곹깭: SampleInspectResult ?뷀떚??議댁옱, ?대젰 議고쉶/?낅젰 媛??),
      h3('Q3-5-1. ?섑뵆寃???좏슚 踰붿쐞??'),
      new Table({ columnWidths: [2600, 3400, 3360], rows: [
        row(cell('踰붿쐞', {bold:true, bg:NAVY}), cell('?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('?묒뾽吏???쒖옉 ??1??, {bold:true}), cell('JO ?쒖옉 ???섑뵆寃??1???⑷꺽 ???꾩껜 湲곌컙 ?좏슚'), cell('?섑뵆寃???묒뾽吏???곌껐 ?꾩슂')),
        row(cell('援먮?留덈떎 ?ъ떎??, {bold:true}), cell('二쇨컙?믪빞媛?援먮? ???ㅼ떆 ?ㅼ떆'), cell('援먮? ?ㅼ?以?留덉뒪???꾩슂 (誘멸뎄??')),
        row(cell('N媛??앹궛留덈떎', {bold:true}), cell('1,000媛??앹궛留덈떎 以묎컙 ?섑뵆寃??), cell('?앹궛 移댁슫???곕룞, N媛?湲곗??뺣낫 愿由?)),
        row(cell('湲덊삎(?뚮え?? 援먯껜 ??, {bold:true}), cell('?뚮え??援먯껜 ??諛섎뱶???ъ떎??), cell('?뚮え??援먯껜 ?대깽???섑뵆寃???곕룞')),
      ]}),
      check('?묒뾽吏???쒖옉 ??1??), check('援먮?留덈떎 ?ъ떎??), check('N媛??앹궛留덈떎 ??N = ___媛?), check('湲덊삎 援먯껜 ???ъ떎??), check('蹂듯빀: _______________'),

      h3('Q3-5-2. ?섑뵆寃????ぉ??'),
      check('諛곕윺 寃??+ ?몄옣??寃???????꾩닔 ???덈ぉ蹂?湲곗?媛??뺤쓽 ?꾩슂'),
      check('紐⑤뜽/怨듭젙???곕씪 寃????ぉ???ㅻ쫫 ??寃?ы빆紐?留덉뒪??留ㅽ븨 ?꾩슂'),
      check('湲고?: _______________'),

      h3('Q3-5-3. 諛곕윺/?몄옣??湲곗?媛믪? ?대뵒??媛?몄삤?붽??'),
      check('?덈ぉ留덉뒪?곗뿉 ?꾨뱶 異붽? (barrelMin, barrelMax, tensileMin, tensileMax)'),
      check('蹂꾨룄 寃?ш린以 留덉뒪??(?덈ぉ + 怨듭젙 + ?⑥옄 議고빀蹂?湲곗?媛??뚯씠釉?'),
      check('怨듭젙 ?뚮씪誘명꽣(ProcessMap.processParams)???ы븿'),
      check('湲고?: _______________'),

      // 3-6
      divider(),
      h2('3-6. IQC 誘몄떎??(?먯옱?낃퀬 ?명꽣??'),
      infoBox('?꾩옱 ?곹깭: ?덈ぉ留덉뒪?곗뿉 iqcYn ?꾨뱶 議댁옱. IQC 寃??湲곕줉(IqcLog) 愿由?以?),
      h3('Q3-6-1. IQC 遺덊빀寃??먯옱??泥섎━??'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('泥섎━', {bold:true, bg:NAVY}), cell('?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('?낃퀬 ?먯껜 李⑤떒', {bold:true}), cell('IQC FAIL ???낃퀬 ?깅줉 遺덇? ??諛섑뭹/?먭린'), cell('?놁쓬')),
        row(cell('?낃퀬 ?덉슜, 遺덉텧 李⑤떒', {bold:true}), cell('IQC FAIL ??遺덈웾 ?곹깭濡??낃퀬 ??遺덉텧 ??李⑤떒'), cell('?먯옱 LOT??"IQC ?곹깭" ?꾨뱶, 遺덉텧 API 泥댄겕')),
        row(cell('蹂꾨룄 遺덈웾 李쎄퀬濡??낃퀬', {bold:true}), cell('IQC FAIL ???먮룞?쇰줈 遺덈웾?먯옱 李쎄퀬???곸튂'), cell('遺덈웾 李쎄퀬 留덉뒪???깅줉, ?먮룞 李쎄퀬 遺꾧린')),
      ]}),
      check('?낃퀬 ?먯껜 李⑤떒'), check('?낃퀬 ?덉슜, 遺덉텧 李⑤떒'), check('蹂꾨룄 遺덈웾 李쎄퀬濡??낃퀬'), check('湲고?: _______________'),

      // 3-7
      divider(),
      h2('3-7. 留덉뒪???섑뵆 寃??(?듯빀寃???명꽣??'),
      infoBox('愿??怨듭젙: ?듯빀寃??| ?묓뭹 1媛?+ 遺덈웾 1媛쒕? 癒쇱? 寃?ы븯???λ퉬 ?먮퀎 ?뺥솗???뺤씤'),
      h3('Q3-7-1. 留덉뒪???섑뵆 寃?ъ쓽 ?좏슚 踰붿쐞??'),
      check('?묒뾽吏???쒖옉 ??1?????묒뾽吏??留덉뒪?곗깦?뚭????곌껐 ?뚯씠釉??꾩슂'),
      check('留?援먮? ?쒖옉 ????援먮? ?ㅼ?以?留덉뒪???꾩슂'),
      check('?ㅻ퉬 ?꾩썝 ON ?쒕쭏????MES媛 ?ㅻ퉬 ON/OFF ?대깽??媛먯? ?꾩슂 (?듭떊 ?곕룞)'),
      check('湲고?: _______________'),

      // 3-8
      divider(),
      h2('3-8. ?쒗뭹 ?쇱엯 (?쒗뭹?ъ옣 ?명꽣??'),
      infoBox('愿??怨듭젙: ?쒗뭹?ъ옣 | ?꾩옱 ?곹깭: BoxService?먯꽌 諛뺤뒪 ?앹꽦/?쒕━??異붽? 援ы쁽??),
      h3('Q3-8-1. "?쒗뭹 ?쇱엯 諛⑹?"??踰붿쐞??'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('踰붿쐞', {bold:true, bg:NAVY}), cell('?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('?덈쾲 ?쇱엯 諛⑹?', {bold:true}), cell('"HARNESS-A"? "HARNESS-B" ?쇱엯 ??李⑤떒'), cell('諛뺤뒪 異붽? ???덈쾲 鍮꾧탳 濡쒖쭅')),
        row(cell('+ ?묒뾽吏???쇱엯 諛⑹?', {bold:true}), cell('媛숈? ?덈쾲?대씪???ㅻⅨ ?묒뾽吏???쒗뭹 ?쇱엯 李⑤떒'), cell('??+ 諛뺤뒪???묒뾽吏?쏧D ?곌껐')),
        row(cell('+ LOT ?쇱엯 諛⑹?', {bold:true}), cell('媛숈? ?덈쾲, 媛숈? JO?쇰룄 ?앹궛 LOT ?ㅻⅤ硫?李⑤떒'), cell('??+ LOT ?⑥쐞 愿由?)),
      ]}),
      check('?덈쾲 ?쇱엯 諛⑹?留?), check('?덈쾲 + ?묒뾽吏???쇱엯 諛⑹?'), check('?덈쾲 + ?묒뾽吏??+ LOT ?쇱엯 諛⑹?'), check('湲고?: _______________'),

      h3('Q3-8-2. ?ъ옣 ???쒗뭹 ?뺤씤 諛⑸쾿??'),
      check('?쒗뭹 諛붿퐫???ㅼ틪 ???꾩꽦??諛붿퐫???쇰꺼, ?ㅼ틦???꾩슂'),
      check('?섎웾留??낅젰 (?쇱엯 諛⑹? 遺덇?)'),
      check('?묒뾽吏???⑥쐞 ?쇨큵 ?ъ옣'),
      check('湲고?: _______________'),

      // 3-9
      divider(),
      h2('3-9. ?좏슚湲곌컙 留뚮즺?먯옱 (?먯옱遺덉텧 ?명꽣??'),
      infoBox('?꾩옱 ?곹깭: ShelfLife(?좏슚湲고븳) 愿由?紐⑤뱢 議댁옱, MatLot???좏슚湲고븳 ?뺣낫 ???),
      h3('Q3-9-1. ?좏슚湲고븳 ?꾨컯 ?먯옱??泥섎━??'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('泥섎━', {bold:true, bg:NAVY}), cell('?덉떆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('留뚮즺 ?먯옱留?李⑤떒', {bold:true}), cell('?좏슚湲고븳 吏???먯옱留?遺덉텧 李⑤떒'), cell('?놁쓬 (ShelfLife ?곗씠??議댁옱)')),
        row(cell('N???꾨???寃쎄퀬', {bold:true}), cell('?좏슚湲고븳 30???꾨???"?꾨컯" 寃쎄퀬 ?쒖떆'), cell('N??湲곗?媛??ㅼ젙 ?꾩슂 (?덈ぉ蹂? ?꾩껜?)')),
        row(cell('?섎챸?곗옣 寃?????덉슜', {bold:true}), cell('留뚮즺 ???섎챸?곗옣 寃???⑷꺽 ???ъ궗???덉슜'), cell('?섎챸?곗옣 寃???꾨줈?몄뒪 ?뺤쓽, ?곗옣 濡쒖쭅')),
      ]}),
      check('留뚮즺 ?먯옱留?李⑤떒'), check('N???꾨???寃쎄퀬 ??N = ___??), check('?섎챸?곗옣 寃?????덉슜'), check('湲고?: _______________'),

      // === 4. ?ㅻ퉬 ?곕룞 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('4. ?ㅻ퉬 ?곕룞'),
      h2('Q4-1. ?명꽣?????ㅻ퉬??臾쇰━???좏샇瑜?蹂대궡?붽??'),
      new Table({ columnWidths: [2800, 3200, 3360], rows: [
        row(cell('諛⑹떇', {bold:true, bg:NAVY}), cell('?숈옉 ?ㅻ챸', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('MES ?뚰봽?몄썾??李⑤떒留?, {bold:true}), cell('MES ?붾㈃?먯꽌留??묒뾽 李⑤떒. ?ㅻ퉬 吏곸젒 議곗옉 ??媛??媛??), cell('?놁쓬')),
        row(cell('MES ???ㅻ퉬 媛?숉뿀媛 ?좏샇', {bold:true}), cell('?명꽣???듦낵 ??"媛?숉뿀媛" ?좏샇 ?꾩넚. 誘명넻怨????ㅻ퉬 臾쇰━ 李⑤떒'), cell('?듭떊 ?꾨줈?좎퐳 ?묒쓽, PLC ?섏젙, ?뚯뒪???섍꼍 援ъ텞')),
      ]}),
      check('MES ?뚰봽?몄썾??李⑤떒留?), check('MES ???ㅻ퉬 媛?숉뿀媛 ?좏샇 ?꾩넚'), check('1李??뚰봽?몄썾?? 2李??ㅻ퉬 ?곕룞'), check('湲고?: _______________'),

      h2('Q4-2. ?듭떊 ?꾨줈?좎퐳 (?ㅻ퉬 ?곕룞 ?좏깮 ??'),
      new Table({ columnWidths: [2400, 6960], rows: [
        row(cell('?꾨줈?좎퐳', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('TCP/IP', {bold:true}), cell('?ㅻ퉬 IP 二쇱냼, ?ы듃, ?듭떊 ?щ㎎ ?뺤젙 ?꾩슂')),
        row(cell('Serial (RS-232/485)', {bold:true}), cell('?ы듃 ?좊떦, 蹂대뱶?덉씠?? PC-?ㅻ퉬 媛?耳?대툝')),
        row(cell('MQTT', {bold:true}), cell('MQTT 釉뚮줈而??쒕쾭 援ъ텞, ?좏뵿 援ъ“ ?ㅺ퀎')),
        row(cell('OPC-UA', {bold:true}), cell('OPC-UA ?쒕쾭 ?쇱씠?좎뒪, ?ㅻ퉬 吏???щ? ?뺤씤')),
      ]}),
      check('TCP/IP'), check('Serial'), check('MQTT'), check('OPC-UA'), check('誘명솗?????ㅻ퉬 ?낆껜 ?묒쓽 ?덉젙?? _______________'),

      // === 5. ?대젰 愿由?===
      divider(),
      h1('5. ?명꽣???대젰 愿由?),
      h2('Q5-1. ?명꽣??諛쒖깮/?댁젣 ?대젰??蹂꾨룄 ??ν븯?붽??'),
      new Table({ columnWidths: [2400, 3600, 3360], rows: [
        row(cell('諛⑹떇', {bold:true, bg:NAVY}), cell('????댁슜', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY})),
        row(cell('蹂꾨룄 ?대젰 ?뚯씠釉?, {bold:true}), cell('諛쒖깮?쒓컖, ?좏삎, ?ㅻ퉬, ?묒뾽?? ?댁젣?쒓컖, ?댁젣諛⑸쾿, ?뱀씤?? ?ъ쑀'), cell('INTERLOCK_LOG ?뚯씠釉??앹꽦, ?대젰 議고쉶 API')),
        row(cell('湲곗〈 濡쒓렇 ?뚯씠釉?, {bold:true}), cell('?쒖뒪??濡쒓렇???명꽣???대깽??湲곕줉'), cell('?놁쓬')),
        row(cell('???遺덊븘??, {bold:true}), cell('?ㅼ떆媛?李⑤떒留? ?대젰 ?놁쓬'), cell('?놁쓬')),
      ]}),
      check('蹂꾨룄 ?대젰 ?뚯씠釉?), check('湲곗〈 濡쒓렇 ?뚯씠釉??쒖슜'), check('???遺덊븘??), check('湲고?: _______________'),

      h2('Q5-2. ?대젰 議고쉶 ?붾㈃???꾩슂?쒓??'),
      check('愿由ъ옄 ?꾩슜 ?붾㈃ (?꾪꽣: 湲곌컙, ?ㅻ퉬, ?좏삎, ?묒뾽??'),
      check('紐⑤땲?곕쭅 ??쒕낫?쒖뿉 ?듯빀 (?명꽣??嫄댁닔/異붿씠 ?꾩젽)'),
      check('遺덊븘??),

      h2('Q5-3. ?명꽣??諛쒖깮 ??愿由ъ옄 ?뚮┝?'),
      check('紐⑤땲?곕쭅 ?붾㈃???ㅼ떆媛??쒖떆 (WebSocket/?대쭅)'),
      check('?뚮━/寃쎄퀬??(釉뚮씪?곗? ?뚮┝ 沅뚰븳 ?꾩슂)'),
      check('遺덊븘??), check('湲고?: _______________'),

      // === 6. ?ㅼ젙 愿由?===
      divider(),
      h1('6. ?명꽣???ㅼ젙 愿由?),
      h2('Q6-1. ?명꽣??ON/OFF瑜?愿由ъ옄 ?붾㈃?먯꽌 ?ㅼ젙 媛??'),
      check('?붾㈃?먯꽌 ?ㅼ젙 媛?????명꽣???ㅼ젙 留덉뒪???뚯씠釉?+ 愿由??섏씠吏 媛쒕컻 ?꾩슂'),
      check('肄붾뱶 怨좎젙 (蹂寃???媛쒕컻???섏젙 ??諛고룷)'),
      check('湲고?: _______________'),

      h2('Q6-2. ?명꽣???꾧퀎媛믪쓣 ?붾㈃?먯꽌 蹂寃?媛??'),
      infoBox('?덉떆: ?뚮え???ъ슜?잛닔 ?쒗븳 10,000 ??12,000 蹂寃? WARNING ?꾧퀎 鍮꾩쑉 80% ??70% 蹂寃?),
      check('?붾㈃?먯꽌 蹂寃????명꽣???ㅼ젙 ?붾㈃???꾧퀎媛??낅젰 ?꾨뱶 異붽?'),
      check('留덉뒪???곗씠?곗뿉??蹂寃?(?꾩옱 諛⑹떇 ?좎?)'),
      check('湲고?: _______________'),

      // === 7. 媛쒕컻 ?곗꽑?쒖쐞 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('7. 媛쒕컻 ?곗꽑?쒖쐞'),
      h2('Q7-1. 1李??ㅽ뵂 ?쒖젏??諛섎뱶???꾩슂???명꽣?쎌??'),
      new Table({ columnWidths: [3600, 1920, 1920, 1920], rows: [
        row(cell('?명꽣??, {bold:true, bg:NAVY}), cell('1李??꾩닔', {bold:true, bg:NAVY, align:AlignmentType.CENTER}), cell('2李??댄썑', {bold:true, bg:NAVY, align:AlignmentType.CENTER}), cell('遺덊븘??, {bold:true, bg:NAVY, align:AlignmentType.CENTER})),
        row(cell('?ㅻ퉬 ?쇱긽?먭? 誘몄떎??), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('?ㅻ퉬遺???ъ슜?쒗븳 ?잛닔 珥덇낵'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('?먯옱 誘몄씪移?), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('怨듭젙?쒖꽌 誘몄씪移?), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('?섑뵆寃???묓뭹議곌굔 誘몄땐議?), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('IQC 誘몄떎??), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('留덉뒪???섑뵆 寃??誘몄땐議?), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('?쒗뭹 ?쇱엯'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
        row(cell('?좏슚湲곌컙 留뚮즺?먯옱'), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER}), cell('\u2610', {align:AlignmentType.CENTER})),
      ]}),

      h2('Q7-2. 1李??ㅽ뵂 紐⑺몴 ?쒖젏??'),
      p('湲곗옱: _______________ (?? 2026??N??'),

      // === 8. 醫낇빀 ===
      new Paragraph({ children: [new PageBreak()] }),
      h1('8. 醫낇빀: ?좏깮???곕Ⅸ ?ъ쟾?붽뎄?ы빆 ?붿빟'),
      infoBox('?꾨옒??二쇱슂 ?좏깮???곕씪 ?ъ쟾??以鍮??뺤젙?댁빞 ????ぉ???뺣━??寃껋엯?덈떎.'),
      new Table({ columnWidths: [2600, 4200, 2560], rows: [
        row(cell('?좏깮 ?ы빆', {bold:true, bg:NAVY}), cell('?ъ쟾?붽뎄?ы빆', {bold:true, bg:NAVY}), cell('?대떦/?묒쓽 ???, {bold:true, bg:NAVY})),
        row(cell('Soft Block ?곸슜 ??), cell('?뱀씤 沅뚰븳 ??븷 ?뺤쓽, ?뱀씤 UI ?ㅺ퀎'), cell('?꾨줈?앺듃 愿由ъ옄')),
        row(cell('援먮?(Shift) 湲곗?'), cell('援먮? ?ㅼ?以?留덉뒪???뺤쓽 (議? ?쒖옉/醫낅즺 ?쒓컖)'), cell('?앹궛愿由??대떦??)),
        row(cell('諛붿퐫???ㅼ틪 諛⑹떇'), cell('媛?PC??諛붿퐫???ㅼ틦???ㅼ튂, ?먯옱/?쒗뭹??諛붿퐫???쇰꺼 遺李?), cell('?꾩옣 愿由ъ옄, IT ?명봽??)),
        row(cell('?ㅻ퉬 臾쇰━ ?곕룞'), cell('?ㅻ퉬 ?낆껜? ?듭떊 ?꾨줈?좎퐳 ?묒쓽, PLC ?꾨줈洹몃옩 ?섏젙'), cell('?ㅻ퉬 ?낆껜')),
        row(cell('?섑뵆寃??湲곗?媛?), cell('?덈ぉ蹂?諛곕윺/?몄옣??湲곗?媛??곗씠???뺣━'), cell('?덉쭏愿由??대떦??)),
        row(cell('留덉뒪???섑뵆 愿由?), cell('?묓뭹/遺덈웾 留덉뒪???섑뵆 紐⑸줉, 蹂닿?/愿由?泥닿퀎 ?섎┰'), cell('?덉쭏愿由??대떦??)),
        row(cell('?명꽣???대젰 愿由?), cell('INTERLOCK_LOG ?뚯씠釉??ㅺ퀎, 蹂닿? 湲곌컙 ?뺤콉'), cell('DBA, ?꾨줈?앺듃 愿由ъ옄')),
        row(cell('?명꽣???ㅼ젙 ?붾㈃'), cell('?명꽣???ㅼ젙 留덉뒪???뚯씠釉??ㅺ퀎, 愿由??섏씠吏 媛쒕컻'), cell('媛쒕컻?')),
        row(cell('?뚮え??援먯껜 QR'), cell('?뚮え??QR 肄붾뱶 諛쒗뻾/遺李? ?꾩옣 援먯껜 ?깅줉 ?붾㈃'), cell('?꾩옣 愿由ъ옄, 媛쒕컻?')),
      ]}),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('C:/Project/HANES/exports/system/interlock-questionnaire.docx', buf);
  console.log('DOCX created successfully!');
}).catch(err => { console.error('Error:', err); process.exit(1); });

