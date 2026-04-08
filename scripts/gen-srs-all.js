/**
 * @file scripts/gen-srs-all.js
 * @description HARNESS MES ?꾩껜 紐⑤뱢 ?붽뎄?ы빆 ?뺤쓽??Word 臾몄꽌 ?앹꽦
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
        const isPri = hds[i]==='?곗꽑?쒖쐞';
        const isSt = hds[i]==='?곹깭';
        let sh = idx%2===1 ? C.alt : C.w;
        if (isPri) sh = v==='?? ? C.must : v==='以? ? C.should : C.could;
        if (isSt) sh = v==='援ы쁽?꾨즺' ? C.done : v==='援ы쁽以? ? C.wip : C.hold;
        return c(v, ws[i], { sz:14, sh, al: i===0||isPri||isSt ? AlignmentType.CENTER : AlignmentType.LEFT });
      }) })),
    ] });
}

function sp() { return new Paragraph({ spacing: { after: 150 }, children: [] }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }
function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: 'Arial' })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: 'Arial' })] }); }
function p(t) { return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: t, font: 'Arial', size: 18 })] }); }

// ?? ?붽뎄?ы빆 ?곗씠????
const reqs = [
  // 湲곗??뺣낫
  { id:'REQ-MST-001', name:'?덈ぉ愿由?, mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'?덈챸肄붾뱶, ?덈ぉ紐? ?덈ぉ?좏삎(?먯옱/諛섏젣???쒗뭹), ?ш퀬?⑥쐞, ?먯옱?섎챸, ?ъ옣?⑥쐞, IQC 寃?ъ뿬遺 愿由? },
  { id:'REQ-MST-002', name:'BOM愿由?, mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'?덈ぉ蹂?BOM ?뚯슂?먯옱 愿由? ?묒? ???ㅼ슫濡쒕뱶, ?쇱슦???곕룞' },
  { id:'REQ-MST-003', name:'?쇱슦?낃?由?, mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'?덈ぉ蹂?怨듭젙 ?쇱슦???뺣낫, ?묒뾽議곌굔(?꾩꽑湲몄씠, ?덊뵾媛? ?뺤갑媛? ?듭갑議곌굔) 愿由? },
  { id:'REQ-MST-004', name:'怨듭젙愿由?, mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'怨듭젙肄붾뱶, 怨듭젙紐? 怨듭젙遺꾨쪟(?섏옉??媛怨??⑥닚寃???λ퉬寃??, ?ъ슜?щ?' },
  { id:'REQ-MST-005', name:'?묒뾽?먭?由?, mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'?묒뾽??肄붾뱶, ?대쫫, ?좏삎, ?묎렐媛??怨듭젙. QR肄붾뱶 諛쒗뻾. 濡쒓렇???좎?? 蹂꾧컻' },
  { id:'REQ-MST-006', name:'IQC 寃?ы빆紐⑷?由?, mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'?덈ぉ蹂?IQC ??ぉ 諛?議곌굔媛? ?좎닔紐낆옄???ш?????ぉ 愿由? },
  { id:'REQ-MST-007', name:'?ㅻ퉬留덉뒪?곌?由?, mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'?ㅻ퉬肄붾뱶, ?ㅻ퉬紐? ?뚮え??遺??紐⑸줉 諛??섎챸, ?ъ슜怨듭젙 留ㅽ븨. QR肄붾뱶 諛쒗뻾' },
  { id:'REQ-MST-008', name:'?ㅻ퉬 ?먭???ぉ愿由?, mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'?ㅻ퉬蹂??쇱긽/?뺢린 ?먭? ??ぉ ?낅젰. ?먭? ?ъ씤??QR肄붾뱶 遺李? },
  { id:'REQ-MST-009', name:'李쎄퀬/濡쒖??댁뀡愿由?, mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'李쎄퀬肄붾뱶, 李쎄퀬紐? 濡쒖??댁뀡(?몃??꾩튂), ?ъ슜?щ?' },
  { id:'REQ-MST-010', name:'嫄곕옒泥섍?由?, mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'怨좉컼??怨듦툒??肄붾뱶, ?뺣낫 愿由? },
  { id:'REQ-MST-011', name:'?묒뾽吏?꾩꽌愿由?, mod:'湲곗??뺣낫', pri:'以?, st:'援ы쁽?꾨즺', desc:'?덈ぉ蹂?怨듭젙 ?묒뾽吏?꾩꽌 ?대?吏 ?뚯씪 ?낅줈??諛?誘몃━蹂닿린' },
  { id:'REQ-MST-012', name:'?쒖“??諛붿퐫??留ㅽ븨', mod:'湲곗??뺣낫', pri:'??, st:'援ы쁽?꾨즺', desc:'?먯옱 ?쒖“??諛붿퐫?쒖? MES ???덈ぉ肄붾뱶 1:1 留ㅽ븨' },
  { id:'REQ-MST-013', name:'?쇰꺼愿由?, mod:'湲곗??뺣낫', pri:'以?, st:'援ы쁽?꾨즺', desc:'?쇰꺼 ?묒떇 愿由? ?쇰꺼 ?붿옄???ㅼ젙' },
  // ?먯옱愿由?  { id:'REQ-MAT-001', name:'PO愿由?, mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'PO 踰덊샇, ?곸꽭踰덊샇, ?앹꽦?? 援щℓ?좏삎, ?곹깭, 嫄곕옒泥? ?덈ぉ, ?섎웾 愿由? },
  { id:'REQ-MAT-002', name:'PO?꾪솴議고쉶', mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'PO ?鍮??낃퀬 ?뺣낫 ?쒓컖?? ?붾웾 ?뺤씤' },
  { id:'REQ-MAT-003', name:'?낇븯愿由?, mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'PO 湲곕컲/?섎룞 ?낇븯 ?깅줉, ??텇媛?痍⑥냼, ?몃낫?댁뒪 愿由? 諛붿퐫???ㅼ틪 ?낇븯' },
  { id:'REQ-MAT-004', name:'IQC 寃?ш?由?, mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'IQC ??ぉ蹂?怨꾩륫媛??먯젙 ?낅젰, ?⑷꺽 ???낃퀬?쇰꺼 諛쒗뻾. 臾닿????섑뵆/?꾩닔 援щ텇' },
  { id:'REQ-MAT-005', name:'IQC ?대젰議고쉶', mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'IQC 寃???대젰 議고쉶, ??ぉ蹂?怨꾩륫媛?諛??먯젙 寃곌낵' },
  { id:'REQ-MAT-006', name:'?낃퀬?쇰꺼諛쒗뻾', mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'IQC ?⑷꺽 ?먯옱 LOT??????쇰꺼 諛쒗뻾/?щ컻?? matUid 梨꾨쾲' },
  { id:'REQ-MAT-007', name:'?먯옱?낃퀬愿由?, mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'IQC ?⑷꺽嫄??쇨큵/遺꾪븷 ?낃퀬, ?먮룞?낃퀬(?쇰꺼 諛쒗뻾 ??. PO ?ㅼ감??寃利? },
  { id:'REQ-MAT-008', name:'?낃퀬?대젰議고쉶', mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?낃퀬 ?대젰 議고쉶, ?듦퀎 (湲덉씪 ?낃퀬嫄댁닔/?섎웾)' },
  { id:'REQ-MAT-009', name:'異쒓퀬?붿껌愿由?, mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?묒뾽吏??湲곕컲 BOM ?뚯슂?먯옱 遺덉텧?붿껌' },
  { id:'REQ-MAT-010', name:'?먯옱異쒓퀬愿由?, mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'異쒓퀬?좏삎蹂??먯옱 異쒓퀬, 諛붿퐫???ㅼ틪 遺덉텧, ?좎엯?좎텧(FIFO) 媛?대뱶' },
  { id:'REQ-MAT-011', name:'LOT愿由?, mod:'?먯옱愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?먯옱 LOT ?대젰 異붿쟻, ?곹깭 愿由?(NORMAL/HOLD/SCRAPPED)' },
  { id:'REQ-MAT-012', name:'?먯옱遺꾪븷愿由?, mod:'?먯옱愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'踰뚰겕?먯옱 遺꾪븷 ?????쒕━???ъ슜以묒?, 遺꾪븷 ?쒕━???앹꽦 諛??쇰꺼 諛쒗뻾' },
  { id:'REQ-MAT-013', name:'?먯옱蹂묓빀愿由?, mod:'?먯옱愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'媛숈? LOT ?먯옱?쇰━ 蹂묓빀 泥섎━' },
  { id:'REQ-MAT-014', name:'?좎닔紐낆옄?ш?由?, mod:'?먯옱愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?좏슚湲곌컙 留뚮즺 ?먯옱 ?ш????먯젙, ?섎챸 ?곗옣 泥섎━' },
  { id:'REQ-MAT-015', name:'?먯옱?ш퀬??쒓?由?, mod:'?먯옱愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?ш퀬 ?????쒗빐??泥섎━' },
  { id:'REQ-MAT-016', name:'?먯옱?먭린泥섎━', mod:'?먯옱愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'遺덈웾/留뚮즺 ?먯옱 ?먭린 泥섎━ 諛??대젰 愿由? },
  { id:'REQ-MAT-017', name:'?ш퀬蹂댁젙泥섎━', mod:'?먯옱愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?ш퀬 議곗젙(湲고??낆텧怨??ы븿). 理쒖큹 ?ш퀬 珥덇낵 蹂댁젙 遺덇?' },
  { id:'REQ-MAT-018', name:'湲고??낃퀬愿由?, mod:'?먯옱愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'PO ?놁씠 湲고? ?낃퀬 泥섎━' },
  { id:'REQ-MAT-019', name:'?낃퀬痍⑥냼', mod:'?먯옱愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?뱀씪 ?낃퀬遺?痍⑥냼, 遺덉텧/遺꾪븷???먯옱??痍⑥냼 遺덇?' },
  // ?ш퀬愿由?  { id:'REQ-INV-001', name:'?먯옱?ш퀬?꾪솴議고쉶', mod:'?ш퀬愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'李쎄퀬/濡쒖??댁뀡蹂? ?덈ぉ蹂??ш퀬 議고쉶. ?좏슚湲곌컙 洹쇱젒(?몃옉)/留뚮즺(鍮④컯) ?쒓컖 ?쒖떆' },
  { id:'REQ-INV-002', name:'?먯옱?섎텋?대젰議고쉶', mod:'?ш퀬愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?먯옱 ?낆텧怨??꾪솴 議고쉶 (?섎텋?먯옣)' },
  { id:'REQ-INV-003', name:'?먯옱?ш퀬?ㅼ궗愿由?, mod:'?ш퀬愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'PDA ?낅젰 湲곕컲 ?ш퀬?ㅼ궗, ?ㅼ궗 以??몃옖??뀡 ?쒗븳, ??1???댁긽' },
  { id:'REQ-INV-004', name:'?먯옱?ш퀬?ㅼ궗議고쉶', mod:'?ш퀬愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?ш퀬?ㅼ궗 ?댁뿭 議고쉶' },
  { id:'REQ-INV-005', name:'?낇븯?ш퀬?꾪솴議고쉶', mod:'?ш퀬愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?낇븯 湲곗? ?ш퀬 ?꾪솴 議고쉶' },
  { id:'REQ-INV-006', name:'?쒗뭹?ш퀬?꾪솴議고쉶', mod:'?ш퀬愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?덈ぉ蹂? ?ъ옣蹂??쒗뭹/諛섏젣???꾩옱怨?議고쉶' },
  { id:'REQ-INV-007', name:'?쒗뭹?ш퀬?ㅼ궗愿由?, mod:'?ш퀬愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?쒗뭹 ?ш퀬?ㅼ궗 (?먯옱? 蹂꾨룄)' },
  { id:'REQ-INV-008', name:'?쒗뭹?ш퀬??쒓?由?, mod:'?ш퀬愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?쒗뭹 ?ш퀬 ????댁젣' },
  // ?앹궛愿由?  { id:'REQ-PRD-001', name:'?붽컙?앹궛怨꾪쉷', mod:'?앹궛愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?붽컙 ?앹궛怨꾪쉷 ?깅줉/?뺤젙/留덇컧' },
  { id:'REQ-PRD-002', name:'?묒뾽吏?쒓?由?, mod:'?앹궛愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?꾩젣??湲곗? 媛?諛섏젣???묒뾽吏???숈떆 ?앹꽦, 諛섏젣???⑥쐞???앹꽦 媛?? ?먯옱遺덉텧?붿껌???곕룞' },
  { id:'REQ-PRD-003', name:'?묒뾽吏?쒗쁽?⑹“??, mod:'?앹궛愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?묒뾽吏???곹깭 諛?吏꾪뻾 ?꾪솴 議고쉶' },
  { id:'REQ-PRD-004', name:'?ㅼ쟻?낅젰(?섏옉??', mod:'?앹궛愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?ㅻ퉬 QR ?ㅼ틪 ?뺤씤 ???쒖옉. ?묒뾽吏?쒕쾲?? ?덈ぉ, ?섎웾, ?묒뾽?? ?ъ엯?먯옱, ?묒뾽吏?꾩꽌 ?쒖떆' },
  { id:'REQ-PRD-005', name:'?ㅼ쟻?낅젰(媛怨?', mod:'?앹궛愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?ㅻ퉬 QR ?ㅼ틪, ?ㅻ퉬?ㅼ젙媛? ?뚮え遺???뺤씤. ?덈ぉ 蹂寃????섑뵆 寃???꾩닔' },
  { id:'REQ-PRD-006', name:'?ㅼ쟻?낅젰(?⑥닚寃??', mod:'?앹궛愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?ㅻ퉬 QR ?ㅼ틪, 寃???먯젙 ??? ?멸?寃?? ?⑥옄寃?? },
  { id:'REQ-PRD-007', name:'?ㅼ쟻?낅젰(寃?ъ옣鍮?', mod:'?앹궛愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?ㅻ퉬?ㅼ젙媛? ?뚮え遺???뺤씤. 寃?ы빆紐?諛??뺤긽踰붿쐞 ?쒖떆. ?듯빀寃???듭쟾寃??' },
  { id:'REQ-PRD-008', name:'?묒뾽?ㅼ쟻?듯빀議고쉶', mod:'?앹궛愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?꾩젣??湲곗? ?꾩껜 怨듭젙 ?ㅼ쟻 ?듯빀 ?뺤씤' },
  { id:'REQ-PRD-009', name:'諛섏젣???섑뵆寃??, mod:'?앹궛愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?뺤갑 怨듭젙 ?섑뵆 ?몄옣??諛곕윺 寃??痢≪젙媛????(?깃컻 ?⑥쐞)' },
  { id:'REQ-PRD-010', name:'?ъ옉?낃?由?, mod:'?앹궛愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'NG ?쒗뭹 ?섎━ ?대젰, ?ш???寃곌낵 愿由? ?꾨즺 ???좉퇋 ?쇰꺼 諛쒗뻾' },
  { id:'REQ-PRD-011', name:'?섎━愿由?, mod:'?앹궛愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'遺?곹빀???섎━ ?대젰 諛?寃곌낵 愿由? },
  // ?쒗뭹?섎텋愿由?  { id:'REQ-PM-001', name:'?쒗뭹?낃퀬愿由?, mod:'?쒗뭹?섎텋', pri:'??, st:'援ы쁽?꾨즺', desc:'?앹궛 ?꾨즺 ?쒗뭹 ?낃퀬 泥섎━' },
  { id:'REQ-PM-002', name:'?쒗뭹?낃퀬痍⑥냼', mod:'?쒗뭹?섎텋', pri:'以?, st:'援ы쁽?꾨즺', desc:'?쒗뭹 ?낃퀬 痍⑥냼 泥섎━' },
  { id:'REQ-PM-003', name:'?쒗뭹異쒓퀬愿由?, mod:'?쒗뭹?섎텋', pri:'??, st:'援ы쁽?꾨즺', desc:'異쒗븯吏??湲곕컲 ?쒗뭹 異쒓퀬' },
  { id:'REQ-PM-004', name:'?쒗뭹異쒓퀬痍⑥냼', mod:'?쒗뭹?섎텋', pri:'以?, st:'援ы쁽?꾨즺', desc:'?쒗뭹 異쒓퀬 痍⑥냼 泥섎━' },
  // ?덉쭏愿由?  { id:'REQ-QUA-001', name:'?섏엯寃??IQC)', mod:'?덉쭏愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'IQC ??ぉ蹂?怨꾩륫/?먯젙 ?낅젰, ?⑸텋 ?먯젙' },
  { id:'REQ-QUA-002', name:'遺덈웾愿由?, mod:'?덉쭏愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'遺덈웾 ?묒닔, 遺꾩꽍, ?닿껐, 醫낃껐 ?꾨줈?몄뒪' },
  { id:'REQ-QUA-003', name:'?ъ옉?낃???, mod:'?덉쭏愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?ъ옉???꾨즺 ???ш????먯젙' },
  { id:'REQ-QUA-004', name:'怨듭젙寃??, mod:'?덉쭏愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'怨듭젙蹂?寃????ぉ ?낅젰 諛??먯젙' },
  { id:'REQ-QUA-005', name:'異쒗븯寃??OQC)', mod:'?덉쭏愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?멸?寃????遺??먯젙, 寃?ъ썝 ?ㅻ챸?? },
  { id:'REQ-QUA-006', name:'異붿쟻愿由?, mod:'?덉쭏愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?쒗뭹 ?쒕━??湲곗? ?먯옱LOT, ?묒뾽?? ?ㅻ퉬, 怨꾩륫媛???텛?? },
  { id:'REQ-QUA-007', name:'SPC愿由?, mod:'?덉쭏愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?ㅼ떆媛?Cpk 怨꾩궛, 愿由щ룄 李⑦듃, 怨꾩륫 ?곗씠???먮룞 ?섏쭛' },
  { id:'REQ-QUA-008', name:'Control Plan', mod:'?덉쭏愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'寃?щ갑踰? ?섑뵆?ш린/鍮덈룄, 愿由щ갑踰??뺤쓽' },
  { id:'REQ-QUA-009', name:'蹂寃쎄?由?, mod:'?덉쭏愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?ㅺ퀎/怨듭젙 蹂寃?愿由??꾨줈?몄뒪' },
  { id:'REQ-QUA-010', name:'怨좉컼遺덈쭔愿由?, mod:'?덉쭏愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'怨좉컼 遺덈쭔 ?묒닔 諛?泥섎━ 愿由? },
  { id:'REQ-QUA-011', name:'CAPA愿由?, mod:'?덉쭏愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?쒖젙/?덈갑 議곗튂 愿由? },
  { id:'REQ-QUA-012', name:'FAI愿由?, mod:'?덉쭏愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'珥덈룄??寃??愿由? },
  { id:'REQ-QUA-013', name:'PPAP愿由?, mod:'?덉쭏愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?앹궛遺???뱀씤 ?꾨줈?몄뒪' },
  { id:'REQ-QUA-014', name:'媛먯궗愿由?, mod:'?덉쭏愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?대?/?몃? 媛먯궗 愿由? },
  // ?듭쟾寃??  { id:'REQ-INS-001', name:'?듭쟾寃?ш?由?, mod:'?듭쟾寃??, pri:'??, st:'援ы쁽?꾨즺', desc:'?듭쟾寃???ㅽ뻾, 留덉뒪???섑뵆 寃?? ?⑷꺽 ?쇰꺼 諛쒗뻾' },
  { id:'REQ-INS-002', name:'?듭쟾寃?ъ씠??, mod:'?듭쟾寃??, pri:'??, st:'援ы쁽?꾨즺', desc:'?듭쟾寃???대젰 議고쉶' },
  // ?ㅻ퉬愿由?  { id:'REQ-EQP-001', name:'湲덊삎愿由?, mod:'?ㅻ퉬愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'湲덊삎/?댄뵆由ъ??댄꽣 愿由? 移쇰궇 ???移댁슫?? ?섎챸 ?꾨떖 ??媛??李⑤떒' },
  { id:'REQ-EQP-002', name:'?쇱긽?먭?', mod:'?ㅻ퉬愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'PDA 湲곕컲 ?쇱씪 ?ㅻ퉬 ?먭?. 誘몄젏寃 ???ㅻ퉬 媛??李⑤떒 ?명꽣?? },
  { id:'REQ-EQP-003', name:'?뺢린?먭?', mod:'?ㅻ퉬愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?ㅻ퉬蹂??뺢린?먭? (?몄쿃, 援먯젙 ??. 二쇨린蹂?愿由? },
  { id:'REQ-EQP-004', name:'?먭??대젰議고쉶', mod:'?ㅻ퉬愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?쇱긽/?뺢린?먭? ?댁뿭 議고쉶' },
  { id:'REQ-EQP-005', name:'?덈갑蹂댁쟾怨꾪쉷', mod:'?ㅻ퉬愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?쒓컙/?곹깭/?덉륫 湲곕컲 ?덈갑蹂댁쟾 怨꾪쉷 ?깅줉' },
  { id:'REQ-EQP-006', name:'?덈갑蹂댁쟾?ㅼ쟻', mod:'?ㅻ퉬愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?덈갑蹂댁쟾 ?ㅽ뻾 寃곌낵 湲곕줉' },
  // 怨꾩륫湲곌?由?  { id:'REQ-GAU-001', name:'怨꾩륫湲곕쭏?ㅽ꽣', mod:'怨꾩륫湲?, pri:'以?, st:'援ы쁽?꾨즺', desc:'怨꾩륫湲?醫낅쪟, 援먯젙 ?곹깭 愿由? },
  { id:'REQ-GAU-002', name:'援먯젙愿由?, mod:'怨꾩륫湲?, pri:'以?, st:'援ы쁽?꾨즺', desc:'怨꾩륫湲?援먯젙 ?ㅽ뻾 諛?寃곌낵 湲곕줉' },
  // 異쒗븯愿由?  { id:'REQ-SHP-001', name:'?ъ옣愿由?, mod:'異쒗븯愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?ъ옣 諛뺤뒪 ?ㅼ틪, ?쒗뭹 ?쇱엯/怨쇳룷??諛⑹?, ?ъ옣 ?쇰꺼 諛쒗뻾' },
  { id:'REQ-SHP-002', name:'?붾젢愿由?, mod:'異쒗븯愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'?붾젢 ?곸옱/?꾨즺 愿由? },
  { id:'REQ-SHP-003', name:'異쒗븯?뺤젙', mod:'異쒗븯愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'異쒗븯吏??諛붿퐫???ㅼ틪, ?ъ옣 諛붿퐫???ㅼ틪 ??異쒗븯 泥섎━' },
  { id:'REQ-SHP-004', name:'異쒗븯?ㅻ뜑愿由?, mod:'異쒗븯愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'異쒗븯?? ?덈ぉ, ?섎웾, ?⑺뭹泥??뺣낫. 異쒗븯吏?쒖꽌 諛쒗뻾' },
  { id:'REQ-SHP-005', name:'異쒗븯?대젰議고쉶', mod:'異쒗븯愿由?, pri:'??, st:'援ы쁽?꾨즺', desc:'異쒗븯 ?대젰 議고쉶' },
  { id:'REQ-SHP-006', name:'諛섑뭹愿由?, mod:'異쒗븯愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'異쒗븯 諛섑뭹 ?깅줉 諛?泥섎━' },
  { id:'REQ-SHP-007', name:'怨좉컼PO愿由?, mod:'異쒗븯愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'怨좉컼 PO ?깅줉 諛??꾪솴 愿由? },
  // 蹂댁꽭愿由?  { id:'REQ-CUS-001', name:'蹂댁꽭諛섏엯', mod:'蹂댁꽭愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'蹂댁꽭 ?먯옱 諛섏엯 愿由? },
  { id:'REQ-CUS-002', name:'蹂댁꽭?ш퀬', mod:'蹂댁꽭愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'蹂댁꽭 ?ш퀬 ?꾪솴 愿由? },
  { id:'REQ-CUS-003', name:'蹂댁꽭?ъ슜?꾪솴', mod:'蹂댁꽭愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'蹂댁꽭 ?먯옱 ?ъ슜 ?대젰 議고쉶' },
  // ?뚮え?덇?由?  { id:'REQ-CSM-001', name:'?뚮え?덈쭏?ㅽ꽣', mod:'?뚮え??, pri:'以?, st:'援ы쁽?꾨즺', desc:'?뚮え??醫낅쪟, 移댄뀒怨좊━, ?섎챸 愿由? },
  { id:'REQ-CSM-002', name:'?뚮え?덉엯異쒓퀬', mod:'?뚮え??, pri:'以?, st:'援ы쁽?꾨즺', desc:'?뚮え???낃퀬/異쒓퀬/?ш퀬 愿由? },
  { id:'REQ-CSM-003', name:'?뚮え?덉닔紐낃?由?, mod:'?뚮え??, pri:'以?, st:'援ы쁽?꾨즺', desc:'?뚮え???ъ슜?잛닔 湲곕컲 ?섎챸 愿由? },
  // ?몄＜愿由?  { id:'REQ-OUT-001', name:'?몄＜?낆껜愿由?, mod:'?몄＜愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?몄＜ ?낆껜 ?뺣낫 愿由? },
  { id:'REQ-OUT-002', name:'?몄＜諛쒖＜愿由?, mod:'?몄＜愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?몄＜ 諛쒖＜ ?깅줉 諛?愿由? },
  { id:'REQ-OUT-003', name:'?몄＜?낃퀬愿由?, mod:'?몄＜愿由?, pri:'以?, st:'援ы쁽?꾨즺', desc:'?몄＜ 媛怨듯뭹 ?낃퀬 泥섎━' },
  // ?명꽣?섏씠??  { id:'REQ-IF-001', name:'?곕룞?꾪솴', mod:'?명꽣?섏씠??, pri:'以?, st:'援ы쁽?꾨즺', desc:'ERP ???몃? ?쒖뒪???곕룞 ?꾪솴 ??쒕낫?? },
  { id:'REQ-IF-002', name:'?곕룞濡쒓렇', mod:'?명꽣?섏씠??, pri:'以?, st:'援ы쁽?꾨즺', desc:'?곕룞 濡쒓렇 議고쉶' },
  // ?쒖뒪?쒓?由?  { id:'REQ-SYS-001', name:'?ъ슜?먭?由?, mod:'?쒖뒪??, pri:'??, st:'援ы쁽?꾨즺', desc:'?ъ슜??怨꾩젙 ?깅줉, 沅뚰븳 ?좊떦' },
  { id:'REQ-SYS-002', name:'沅뚰븳愿由?RBAC)', mod:'?쒖뒪??, pri:'??, st:'援ы쁽?꾨즺', desc:'硫붾돱 肄붾뱶 湲곕컲 ??븷/沅뚰븳 愿由? },
  { id:'REQ-SYS-003', name:'PDA沅뚰븳愿由?, mod:'?쒖뒪??, pri:'以?, st:'援ы쁽?꾨즺', desc:'PDA ?꾩슜 沅뚰븳 愿由? },
  { id:'REQ-SYS-004', name:'?쒖뒪?쒖꽕??, mod:'?쒖뒪??, pri:'??, st:'援ы쁽?꾨즺', desc:'?쒖뒪???섍꼍蹂?? ?먮룞?낃퀬 ?ㅼ젙 ?? },
  { id:'REQ-SYS-005', name:'肄붾뱶愿由?, mod:'?쒖뒪??, pri:'??, st:'援ы쁽?꾨즺', desc:'怨듯넻肄붾뱶 洹몃９/?곸꽭肄붾뱶 愿由? },
  { id:'REQ-SYS-006', name:'?ㅼ?以꾨윭愿由?, mod:'?쒖뒪??, pri:'以?, st:'援ы쁽?꾨즺', desc:'諛곗튂 ?묒뾽 ?ㅼ?以??깅줉/?ㅽ뻾/濡쒓렇 愿由? },
  { id:'REQ-SYS-007', name:'臾몄꽌愿由?, mod:'?쒖뒪??, pri:'以?, st:'援ы쁽?꾨즺', desc:'洹쒓꺽?? 留ㅻ돱?? ?꾨㈃, SOP ?뚯씪 愿由? },
  { id:'REQ-SYS-008', name:'援먯쑁愿由?, mod:'?쒖뒪??, pri:'??, st:'援ы쁽?꾨즺', desc:'援먯쑁 怨꾪쉷, 吏꾪뻾, ?꾨즺 愿由? },
  // 鍮꾧린??  { id:'NFR-P-001', name:'?묐떟?쒓컙', mod:'鍮꾧린???깅뒫', pri:'??, st:'援ы쁽?꾨즺', desc:'?섏씠吏 濡쒕뵫 3珥??대궡, API ?묐떟 1珥??대궡' },
  { id:'NFR-S-001', name:'JWT ?몄쬆', mod:'鍮꾧린??蹂댁븞', pri:'??, st:'援ы쁽?꾨즺', desc:'Bearer Token 湲곕컲 ?몄쬆, ?좏겙 留뚮즺 愿由? },
  { id:'NFR-S-002', name:'RBAC ?멸?', mod:'鍮꾧린??蹂댁븞', pri:'??, st:'援ы쁽?꾨즺', desc:'硫붾돱 肄붾뱶 湲곕컲 ??븷蹂??묎렐 ?쒖뼱' },
  { id:'NFR-C-001', name:'?ㅺ뎅??吏??, mod:'鍮꾧린???명솚', pri:'??, st:'援ы쁽?꾨즺', desc:'?쒓뎅?? ?곸뼱, 以묎뎅?? 踰좏듃?⑥뼱 4媛??몄뼱' },
  { id:'NFR-C-002', name:'?ㅽ겕紐⑤뱶', mod:'鍮꾧린???명솚', pri:'以?, st:'援ы쁽?꾨즺', desc:'?ㅽ겕/?쇱씠??紐⑤뱶 ?꾪솚 吏?? },
  { id:'NFR-C-003', name:'PWA 吏??, mod:'鍮꾧린???명솚', pri:'以?, st:'援ы쁽?꾨즺', desc:'PDA 紐⑤컮????(Progressive Web App)' },
  { id:'NFR-C-004', name:'硫?고뀒?뚯떆', mod:'鍮꾧린???명솚', pri:'??, st:'援ы쁽?꾨즺', desc:'COMPANY + PLANT_CD 湲곕컲 ?ㅼ쨷 ?ъ뾽??吏?? },
  // ?명꽣?섏씠??  { id:'IR-001', name:'諛붿퐫???ㅼ틦???곕룞', mod:'?명꽣?섏씠??, pri:'??, st:'援ы쁽以?, desc:'Buffered Mode(Serial/API) 諛붿퐫???ㅼ틦?? ?좏삎 ?먮룞 援щ텇' },
  { id:'IR-002', name:'?쇰꺼 ?꾨┛???곕룞', mod:'?명꽣?섏씠??, pri:'??, st:'援ы쁽以?, desc:'?쒕━???ы듃 湲곕컲 ?쇰꺼 ?꾨┛???쒖뼱' },
  { id:'IR-003', name:'?ㅻ퉬 PLC ?곕룞', mod:'?명꽣?섏씠??, pri:'??, st:'蹂대쪟', desc:'PLC ?명꽣?섏씠???듯븳 ?ㅻ퉬 媛??以묒? ?쒖뼱 (?명꽣??' },
  { id:'IR-004', name:'怨꾩륫?λ퉬 RS-232', mod:'?명꽣?섏씠??, pri:'??, st:'蹂대쪟', desc:'誘몄벐?꾩슂 ?몄옣?κ퀎/留덉씠?щ줈誘명꽣 RS-232 ?곗씠???먮룞 ?섏쭛' },
  { id:'IR-005', name:'ERP ?곕룞', mod:'?명꽣?섏씠??, pri:'以?, st:'蹂대쪟', desc:'3李?媛쒕컻 - ERP ?곗씠???명꽣?섏씠?? },
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
        rows: [['?꾨줈?앺듃紐?,'HARNESS MES'],['?곗텧臾쇰챸','?붽뎄?ы빆 ?뺤쓽??(?꾩껜)'],['踰꾩쟾','v1.0'],['?묒꽦??,'2026-03-18'],['?묒꽦??,'HANES MES?'],['洹쇨굅臾몄꽌','怨듭젙蹂꾩슂援ъ궗?? WBS, ?꾩슂?꾨줈洹몃옩紐⑸줉']].map(([k,v])=>
          new TableRow({ children: [c(k,2000,{b:true,sh:C.hdr,al:AlignmentType.CENTER,sz:18}), c(v,3000,{sz:18})] })) }),
    ],
  };

  const body = [];
  body.push(h1('\uAC1C\uC815\uC774\uB825'), tbl(['踰꾩쟾','?쇱옄','?묒꽦??,'蹂寃쎈궡??],[['1.0','2026-03-18','HANES MES?','理쒖큹 ?묒꽦 (?꾩껜 紐⑤뱢 醫낇빀)']],[1500,1500,2000,8440]), pb());
  body.push(h1('\uBAA9\uCC28'), new TableOfContents('TOC',{hyperlink:true,headingStyleRange:'1-3'}), pb());

  // 1. 媛쒖슂
  const totalReqs = reqs.length;
  const frCount = reqs.filter(r=>r.id.startsWith('REQ')).length;
  const nfrCount = reqs.filter(r=>r.id.startsWith('NFR')).length;
  const irCount = reqs.filter(r=>r.id.startsWith('IR')).length;
  const doneCount = reqs.filter(r=>r.st==='援ы쁽?꾨즺').length;
  const wipCount = reqs.filter(r=>r.st==='援ы쁽以?).length;
  const holdCount = reqs.filter(r=>r.st==='蹂대쪟').length;

  body.push(h1('1. \uAC1C\uC694'), h2('1.1 \uBAA9\uC801'),
    p('\uBCF8 \uBB38\uC11C\uB294 HARNESS MES \uC2DC\uC2A4\uD15C\uC758 \uC804\uCCB4 \uAE30\uB2A5/\uBE44\uAE30\uB2A5/\uC778\uD130\uD398\uC774\uC2A4 \uC694\uAD6C\uC0AC\uD56D\uC744 \uC885\uD569\uC801\uC73C\uB85C \uC815\uC758\uD55C\uB2E4.'),
    h2('1.2 \uBC94\uC704'),
    p(`\uAE30\uB2A5 \uC694\uAD6C\uC0AC\uD56D ${frCount}\uAC74, \uBE44\uAE30\uB2A5 ${nfrCount}\uAC74, \uC778\uD130\uD398\uC774\uC2A4 ${irCount}\uAC74 \u2014 \uCD1D ${totalReqs}\uAC74`),
    p(`\uAD6C\uD604\uC644\uB8CC: ${doneCount}\uAC74 / \uAD6C\uD604\uC911: ${wipCount}\uAC74 / \uBCF4\uB958: ${holdCount}\uAC74`),
    h2('1.3 \uADFC\uAC70 \uBB38\uC11C'),
    tbl(['\uBB38\uC11C\uBA85','\uC704\uCE58','\uC124\uBA85'],[
      ['01-system-architecture.md','docs/core/','시스템 아키텍처 개요'],
      ['02-data-model-erd.md','docs/core/','핵심 엔티티와 데이터 관계'],
      ['03-frontend-routing.md','docs/core/','프론트엔드 라우팅 구조'],
      ['04-backend-api-endpoints.md','docs/core/','백엔드 API 그룹 구조'],
      ['05-production-process-flow.md','docs/core/','도메인 워크플로우 개요'],
      ['backend-module-index.md','docs/core/','현재 백엔드 모듈 인덱스'],
    ],[3500,2500,7440]),
    pb());

  // 2. ?쒖뒪??媛쒖슂
  body.push(h1('2. \uC2DC\uC2A4\uD15C \uAC1C\uC694'), h2('2.1 \uC0AC\uC6A9\uC790 \uC720\uD615'),
    tbl(['\uC0AC\uC6A9\uC790 \uC720\uD615','\uC124\uBA85','\uD50C\uB7AB\uD3FC','\uC811\uADFC \uBAA8\uB4C8'],[
      ['?쒖뒪?쒓?由ъ옄','?꾩껜 ?쒖뒪??愿由?,'PC','?꾩껜'],
      ['?앹궛愿由ъ옄','?묒뾽吏?? ?앹궛怨꾪쉷, ?ㅼ쟻 愿由?,'PC','?앹궛, 湲곗??뺣낫'],
      ['?덉쭏愿由ъ옄','IQC, 寃?? SPC, CAPA','PC','?덉쭏, 怨꾩륫湲?],
      ['?먯옱愿由ъ옄','?낇븯, ?낃퀬, 異쒓퀬, ?ш퀬 愿由?,'PC, PDA','?먯옱, ?ш퀬'],
      ['?꾩옣?묒뾽??,'?ㅼ쟻?낅젰, ?ㅻ퉬?먭?','PC, PDA','?앹궛, ?ㅻ퉬'],
      ['異쒗븯?대떦??,'?ъ옣, 異쒗븯, 諛섑뭹','PC, PDA','異쒗븯'],
    ],[2000,3000,1500,6940]),
    pb());

  // 3. 湲곕뒫 ?붽뎄?ы빆
  body.push(h1('3. \uAE30\uB2A5 \uC694\uAD6C\uC0AC\uD56D'));
  const ws = [500,1600,2200,1200,800,900,6240];
  const frReqs = reqs.filter(r=>r.id.startsWith('REQ'));
  body.push(tbl(['No','?붽뎄?ы빆ID','?붽뎄?ы빆紐?,'紐⑤뱢','?곗꽑?쒖쐞','?곹깭','?곸꽭 ?ㅻ챸'],
    frReqs.map((r,i)=>[String(i+1),r.id,r.name,r.mod,r.pri,r.st,r.desc]), ws), pb());

  // 紐⑤뱢蹂??곸꽭 (洹몃９??
  const modules = [...new Set(frReqs.map(r=>r.mod))];
  modules.forEach((mod, mi) => {
    body.push(h2(`3.${mi+1} ${mod}`));
    const modReqs = frReqs.filter(r=>r.mod===mod);
    body.push(tbl(['No','?붽뎄?ы빆ID','?붽뎄?ы빆紐?,'?곗꽑?쒖쐞','?곹깭','?곸꽭 ?ㅻ챸'],
      modReqs.map((r,i)=>[String(i+1),r.id,r.name,r.pri,r.st,r.desc]),
      [500,1600,2200,900,900,7340]), sp());
  });
  body.push(pb());

  // 4. 鍮꾧린???붽뎄?ы빆
  body.push(h1('4. \uBE44\uAE30\uB2A5 \uC694\uAD6C\uC0AC\uD56D'));
  const nfrs = reqs.filter(r=>r.id.startsWith('NFR'));
  body.push(tbl(['No','?붽뎄?ы빆ID','?붽뎄?ы빆紐?,'遺꾨쪟','?곗꽑?쒖쐞','?곹깭','?곸꽭 ?ㅻ챸'],
    nfrs.map((r,i)=>[String(i+1),r.id,r.name,r.mod,r.pri,r.st,r.desc]),
    [500,1600,1800,1500,800,900,6340]), pb());

  // 5. ?명꽣?섏씠???붽뎄?ы빆
  body.push(h1('5. \uC778\uD130\uD398\uC774\uC2A4 \uC694\uAD6C\uC0AC\uD56D'));
  const irs = reqs.filter(r=>r.id.startsWith('IR'));
  body.push(tbl(['No','?붽뎄?ы빆ID','?붽뎄?ы빆紐?,'?곗꽑?쒖쐞','?곹깭','?곸꽭 ?ㅻ챸'],
    irs.map((r,i)=>[String(i+1),r.id,r.name,r.pri,r.st,r.desc]),
    [500,1600,2500,900,900,7040]), pb());

  // 6. ?쒖빟?ы빆
  body.push(h1('6. \uC81C\uC57D\uC0AC\uD56D'),
    tbl(['\uBD84\uB958','\uC81C\uC57D\uC0AC\uD56D'],[
      ['DB','Oracle Database ?ъ슜 (PostgreSQL/MySQL ?꾨떂)'],
      ['PK ?꾨왂','?먯뿰??蹂듯빀???ъ슜 (Auto Increment 湲덉?)'],
      ['?⑦궎吏 留ㅻ땲?','pnpm ?꾩슜 (npm ?ъ슜 湲덉?)'],
      ['?꾨줎?몄뿏???ы듃','3002 (3000, 3001 ?ъ슜 湲덉?)'],
      ['E2E ?뚯뒪??,'Playwright ?ъ슜 湲덉? (?섎룞 ?뚯뒪??'],
      ['諛붿퐫??諛⑹떇','HID Mode ?꾨땶 Buffered Mode (Serial/API)'],
      ['媛쒕컻 ?④퀎','1李?THN ?앹궛 ??? ??2李?蹂댁셿) ??3李?ERP ?곕룞)'],
    ],[2500,10940]), pb());

  // 7. ?듦퀎
  body.push(h1('7. \uC694\uAD6C\uC0AC\uD56D \uD1B5\uACC4'));
  // 紐⑤뱢蹂??듦퀎
  const allMods = [...new Set(reqs.map(r=>r.mod))];
  const statData = allMods.map((mod,i) => {
    const modR = reqs.filter(r=>r.mod===mod);
    return [String(i+1), mod, String(modR.length),
      String(modR.filter(r=>r.pri==='??).length),
      String(modR.filter(r=>r.pri==='以?).length),
      String(modR.filter(r=>r.pri==='??).length),
      String(modR.filter(r=>r.st==='援ы쁽?꾨즺').length),
      String(modR.filter(r=>r.st!=='援ы쁽?꾨즺').length)];
  });
  statData.push(['', '?⑷퀎', String(totalReqs), String(reqs.filter(r=>r.pri==='??).length), String(reqs.filter(r=>r.pri==='以?).length), String(reqs.filter(r=>r.pri==='??).length), String(doneCount), String(wipCount+holdCount)]);

  body.push(tbl(['No','紐⑤뱢','?꾩껜','??,'以?,'??,'?꾨즺','誘몄셿猷?], statData,
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
  fs.mkdirSync('exports/system', { recursive: true });
  const outPath = 'exports/system/?붽뎄?ы빆?뺤쓽???꾩껜_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);

