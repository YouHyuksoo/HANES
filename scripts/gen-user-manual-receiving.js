/**
 * @file scripts/gen-user-manual-receiving.js
 * @description 자재입고(Receiving) 사용자 매뉴얼 Word 문서 생성
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents, LevelFormat,
} = require('docx');

const CW = 9026; // A4 portrait content width
const C = { primary: '2B579A', hdr: 'D5E8F0', alt: 'F5F9FC', w: 'FFFFFF', tip: 'E8F5E9', warn: 'FFF2CC', danger: 'FCE4EC', step: 'E8F0FE' };
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const tbs = { top: tb, bottom: tb, left: tb, right: tb };

function c(t,w,o={}) {
  return new TableCell({ borders:tbs, width:{size:w,type:WidthType.DXA},
    shading:o.sh?{fill:o.sh,type:ShadingType.CLEAR}:undefined,
    margins:{top:60,bottom:60,left:100,right:100}, columnSpan:o.span, verticalAlign:'center',
    children:[new Paragraph({alignment:o.al||AlignmentType.LEFT,spacing:{before:0,after:0},
      children:[new TextRun({text:t||'',bold:o.b||false,font:'Arial',size:o.sz||20,color:o.cl||'000000'})]})]});
}
function tbl(hds,data,ws) {
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:ws,
    rows:[
      new TableRow({tableHeader:true,children:hds.map((h,i)=>c(h,ws[i],{b:true,sh:C.hdr,al:AlignmentType.CENTER,sz:18}))}),
      ...data.map((r,idx)=>new TableRow({children:r.map((v,i)=>c(v,ws[i],{sz:18,sh:idx%2===1?C.alt:C.w}))})),
    ]});
}
function sp(n=200){return new Paragraph({spacing:{after:n},children:[]});}
function pb(){return new Paragraph({children:[new PageBreak()]});}
function h1(t){return new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun({text:t,font:'Arial'})]});}
function h2(t){return new Paragraph({heading:HeadingLevel.HEADING_2,children:[new TextRun({text:t,font:'Arial'})]});}
function h3(t){return new Paragraph({heading:HeadingLevel.HEADING_3,children:[new TextRun({text:t,font:'Arial'})]});}
function p(t,o={}){return new Paragraph({spacing:{after:o.after||120},indent:o.indent?{left:o.indent}:undefined,children:[new TextRun({text:t,font:'Arial',size:o.sz||20,bold:o.b,color:o.cl})]});}
function tip(icon,text,bg){
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[CW],
    rows:[new TableRow({children:[new TableCell({borders:tbs,width:{size:CW,type:WidthType.DXA},
      shading:{fill:bg,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},
      children:[new Paragraph({children:[new TextRun({text:icon+' '+text,font:'Arial',size:18})]})]})]})]});
}
function stepBox(num,text){
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[600,CW-600],
    rows:[new TableRow({children:[
      c('Step '+num,600,{b:true,sh:C.primary,cl:'FFFFFF',al:AlignmentType.CENTER,sz:18}),
      c(text,CW-600,{sh:C.step,sz:18})
    ]})]});
}

function buildDoc(){
  const cover={
    properties:{page:{size:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}},
    children:[
      new Paragraph({spacing:{before:4000},children:[]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:'HARNESS MES',font:'Arial',size:56,bold:true,color:C.primary})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:600},children:[new TextRun({text:'Manufacturing Execution System',font:'Arial',size:28,color:'666666'})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:'\uC0AC\uC6A9\uC790 \uB9E4\uB274\uC5BC',font:'Arial',size:48,bold:true,color:'333333'})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:100},children:[new TextRun({text:'\uC790\uC7AC\uC785\uACE0(Receiving) \uBAA8\uB4C8',font:'Arial',size:28,color:'666666'})]}),
      new Paragraph({spacing:{before:2000},children:[]}),
      new Table({width:{size:5000,type:WidthType.DXA},columnWidths:[2000,3000],
        rows:[['프로젝트명','HARNESS MES'],['산출물명','사용자 매뉴얼 - 자재입고'],['버전','v1.0'],['작성일','2026-03-19'],['작성자','HANES MES팀']].map(([k,v])=>
          new TableRow({children:[c(k,2000,{b:true,sh:C.hdr,al:AlignmentType.CENTER}),c(v,3000)]}))}),
    ],
  };

  const body=[];
  // 개정이력+목차
  body.push(h1('\uAC1C\uC815\uC774\uB825'),tbl(['버전','일자','작성자','변경내용'],[['1.0','2026-03-19','HANES MES팀','최초 작성']],[1500,1500,2000,4026]),pb());
  body.push(h1('\uBAA9\uCC28'),new TableOfContents('TOC',{hyperlink:true,headingStyleRange:'1-3'}),pb());

  // 1. 개요
  body.push(h1('1. \uAC1C\uC694'),
    p('본 매뉴얼은 HARNESS MES 시스템의 자재입고(Receiving) 모듈 사용법을 안내합니다.'),
    p('자재입고 모듈은 발주(PO) 기반 입하부터 IQC 검사, 라벨 발행, 입고 확정까지의 전체 프로세스를 관리합니다.'),
    sp(),
    h2('1.1 \uC5C5\uBB34 \uD750\uB984'),
    p('PO \uBC1C\uC8FC \u2192 \uC785\uD558(\uC218\uB839) \u2192 IQC \uAC80\uC0AC \u2192 \uB77C\uBCA8 \uBC1C\uD589 \u2192 \uC785\uACE0 \uD655\uC815 \u2192 \uD604\uC7AC\uACE0 \uBC18\uC601',{b:true,cl:C.primary}),
    sp(),
    h2('1.2 \uAD00\uB828 \uD654\uBA74'),
    tbl(['메뉴','화면명','경로','설명'],[
      ['자재수불관리','입하관리','/material/arrival','PO/수동 입하 등록 및 취소'],
      ['자재수불관리','입고라벨발행','/material/receive-label','IQC 합격 자재 라벨 발행'],
      ['자재수불관리','자재입고관리','/material/receive','IQC 합격건 일괄/분할 입고'],
      ['자재수불관리','입고이력조회','/material/receive-history','입고 완료 이력 조회'],
    ],[1500,1800,2500,3226]),
    pb());

  // 2. 입하관리
  body.push(h1('2. \uC785\uD558\uAD00\uB9AC'),
    p('입하관리 화면에서는 PO 기반 또는 수동으로 자재를 수령(입하)하고, 입하 이력을 조회/취소할 수 있습니다.'),
    sp(),

    h2('2.1 \uD654\uBA74 \uAD6C\uC131'),
    tbl(['영역','구성요소','설명'],[
      ['통계 카드 (4개)','금일 입하건수, 금일 입하수량, 미입하 PO 수, 전체 입하건수','실시간 통계 표시'],
      ['버튼 영역','[새로고침] [PO 입하 등록] [수동 입하 등록]','상단 우측 액션 버튼'],
      ['필터 영역','검색 입력 + 상태 필터 (전체/완료/취소)','이력 필터링'],
      ['데이터 그리드','트랜잭션번호, 입하일, PO번호, 품목, 수량, 창고, 상태, 취소버튼','입하 이력 테이블 (10건/페이지)'],
    ],[1500,3000,4526]),
    sp(),

    h2('2.2 PO \uAE30\uBC18 \uC785\uD558 \uB4F1\uB85D'),
    p('발주(PO)에 등록된 품목을 기반으로 입하를 등록합니다.'),
    sp(100),
    stepBox('1','[PO 입하 등록] 버튼을 클릭합니다.'),sp(80),
    stepBox('2','입하 가능한 PO 목록이 표시됩니다. 원하는 PO를 클릭합니다.'),sp(80),
    stepBox('3','선택한 PO의 품목 목록이 표시됩니다. 각 품목별로 입하 수량, 제조일자, 창고를 입력합니다.'),sp(80),
    stepBox('4','[등록] 버튼을 클릭하면 입하가 완료됩니다.'),sp(80),
    tip('\u2139\uFE0F','입하 수량은 잔량(발주수량 - 기입하수량) 이하만 입력 가능합니다.',C.tip),sp(),
    tip('\u26A0\uFE0F','입하 등록 시 현재고(MAT_STOCKS)에 즉시 반영됩니다.',C.warn),sp(),

    h2('2.3 \uC218\uB3D9 \uC785\uD558 \uB4F1\uB85D'),
    p('PO 없이 직접 품목/수량을 지정하여 입하를 등록합니다.'),
    sp(100),
    stepBox('1','[수동 입하 등록] 버튼을 클릭합니다.'),sp(80),
    stepBox('2','품목코드 [검색] 버튼으로 품목을 선택합니다.'),sp(80),
    stepBox('3','창고, 수량, 공급업체, 인보이스 번호 등을 입력합니다.'),sp(80),
    stepBox('4','[등록] 버튼을 클릭하면 수동 입하가 완료됩니다.'),sp(),

    h2('2.4 \uC785\uD558 \uCDE8\uC18C'),
    p('등록된 입하 건을 취소합니다. 삭제가 아닌 역분개 방식으로 처리됩니다.'),
    sp(100),
    stepBox('1','입하 이력 테이블에서 취소할 행의 [X] 버튼을 클릭합니다.'),sp(80),
    stepBox('2','취소 사유를 입력합니다 (필수).'),sp(80),
    stepBox('3','[취소 확인] 버튼을 클릭합니다.'),sp(80),
    tip('\uD83D\uDEA8','취소 시 원본은 CANCELED 상태가 되고, 음수 수량의 역분개 트랜잭션이 생성됩니다. 현재고도 차감됩니다.',C.danger),sp(),
    tip('\u2139\uFE0F','MAT_IN 유형 + 완료(DONE) 상태인 건만 취소 가능합니다.',C.tip),
    pb());

  // 3. 자재입고관리
  body.push(h1('3. \uC790\uC7AC\uC785\uACE0\uAD00\uB9AC'),
    p('IQC 검사에 합격(PASS)된 자재 LOT을 선택하여 입고(창고 이동)를 처리합니다.'),
    sp(),

    h2('3.1 \uD654\uBA74 \uAD6C\uC131'),
    tbl(['영역','구성요소','설명'],[
      ['통계 카드 (4개)','입고대기, 대기수량, 금일 입고건수, 금일 입고수량','실시간 통계'],
      ['검색','자재시리얼/품목코드/품목명/공급처 검색','텍스트 입력 필터'],
      ['데이터 그리드','체크박스, 자재시리얼, PO번호, 품목, 공급처, 입하일, 초기수량, 기입고(파랑), 잔량(주황), 제조일자입력, 입고수량입력, 창고선택','입고 가능 LOT 목록'],
      ['일괄입고 버튼','[일괄입고(N건)]','선택한 LOT 일괄 입고 (1건 이상 선택 시 표시)'],
    ],[1500,3000,4526]),
    sp(),

    h2('3.2 \uC77C\uAD04/\uBD84\uD560 \uC785\uACE0 \uCC98\uB9AC'),
    stepBox('1','입고 가능 LOT 목록에서 입고할 LOT의 체크박스를 선택합니다.'),sp(80),
    stepBox('2','각 LOT별로 입고수량을 확인/수정합니다 (기본값: 잔량 전체).'),sp(80),
    stepBox('3','입고 창고를 선택합니다 (기본값: 입하 시 창고).'),sp(80),
    stepBox('4','필요 시 제조일자를 수정합니다 (LOT의 유효기한이 재계산됩니다).'),sp(80),
    stepBox('5','[일괄입고(N건)] 버튼을 클릭합니다.'),sp(80),
    tip('\u2139\uFE0F','분할 입고: 잔량의 일부만 입고하고 나머지는 추후 입고할 수 있습니다.',C.tip),sp(),
    tip('\u2139\uFE0F','입고수량은 0~잔량 범위로 자동 제한됩니다.',C.tip),sp(),
    tip('\u26A0\uFE0F','재고동결 기간에는 입고가 차단됩니다 (InventoryFreezeGuard).',C.warn),sp(),

    h2('3.3 \uC785\uACE0 \uACB0\uACFC'),
    p('입고 완료 시 다음이 자동 처리됩니다:'),
    p('\u2022 MAT_RECEIVINGS에 입고 기록 생성 (입고번호 자동채번)',{indent:360}),
    p('\u2022 STOCK_TRANSACTIONS에 RECEIVE 트랜잭션 생성',{indent:360}),
    p('\u2022 입하창고 재고 차감 + 입고창고 재고 증가',{indent:360}),
    p('\u2022 PO 수량 오차율 자동 검증 (toleranceRate 초과 시 에러)',{indent:360}),
    pb());

  // 4. 입고이력조회
  body.push(h1('4. \uC785\uACE0\uC774\uB825\uC870\uD68C'),
    p('입고 완료된 이력을 조회하는 화면입니다 (조회 전용).'),
    sp(),
    h2('4.1 \uD654\uBA74 \uAD6C\uC131'),
    tbl(['영역','설명'],[
      ['통계 카드','금일 입고건수, 금일 입고수량'],
      ['데이터 그리드','입고번호, 입고일, 자재시리얼, PO번호, 품목코드, 품목명, 수량(녹색), 창고, 비고'],
    ],[2000,7026]),
    sp(),
    p('필터/정렬/엑셀 내보내기 기능을 사용할 수 있습니다.'),
    pb());

  // 5. 주요 업무 시나리오
  body.push(h1('5. \uC8FC\uC694 \uC5C5\uBB34 \uC2DC\uB098\uB9AC\uC624'),
    h2('5.1 \uC815\uC0C1 \uC785\uD558\u2192\uC785\uACE0 \uD504\uB85C\uC138\uC2A4'),
    tbl(['Step','화면','조작','결과'],[
      ['1','입하관리','PO 입하 등록 → PO 선택 → 수량 입력 → 등록','입하 완료, 현재고 반영'],
      ['2','(IQC)','IQC 검사 항목 입력 → 합격 판정','iqcStatus = PASS'],
      ['3','입고라벨발행','합격건 라벨 발행','MatLot 생성, 라벨 인쇄'],
      ['4','자재입고관리','LOT 선택 → 창고 선택 → 일괄입고','입고 완료, 창고 이동'],
      ['5','입고이력조회','이력 확인','입고 기록 조회'],
    ],[600,1500,3500,3426]),
    sp(),

    h2('5.2 \uBD84\uD560 \uC785\uACE0 \uC2DC\uB098\uB9AC\uC624'),
    p('100개 LOT 중 50개만 먼저 입고하는 경우:'),
    p('1. 자재입고관리 화면에서 해당 LOT 선택',{indent:360}),
    p('2. 입고수량을 50으로 변경 (잔량 100 중 50)',{indent:360}),
    p('3. 일괄입고 실행 → 50개 입고 완료',{indent:360}),
    p('4. 나머지 50개는 잔량으로 남아 추후 입고 가능',{indent:360}),
    sp(),

    h2('5.3 \uC785\uD558 \uCDE8\uC18C \uC2DC\uB098\uB9AC\uC624'),
    p('잘못 입하한 건을 취소하는 경우:'),
    p('1. 입하관리 화면에서 해당 행의 [X] 취소 버튼 클릭',{indent:360}),
    p('2. 취소 사유 입력 → 확인',{indent:360}),
    p('3. 원본 CANCELED + 역분개 트랜잭션(음수) 생성',{indent:360}),
    p('4. 현재고 차감 + PO 상태 재계산',{indent:360}),
    pb());

  // 6. 주의사항 / FAQ
  body.push(h1('6. \uC8FC\uC758\uC0AC\uD56D \uBC0F FAQ'),
    h2('6.1 \uC8FC\uC758\uC0AC\uD56D'),
    tip('\u26A0\uFE0F','IQC 합격(PASS) 상태인 자재만 입고 가능합니다. PENDING/FAIL 상태는 입고 불가.',C.warn),sp(80),
    tip('\u26A0\uFE0F','입고 후에는 입고 취소 기능이 없습니다. 재고보정 화면을 사용하세요.',C.warn),sp(80),
    tip('\u26A0\uFE0F','PO 수량 대비 입하수량이 오차율(기본 5%)을 초과하면 입고가 차단됩니다.',C.warn),sp(80),
    tip('\uD83D\uDEA8','수불원장(STOCK_TRANSACTIONS)의 데이터는 삭제되지 않습니다. 취소 시 역분개 방식으로 처리됩니다.',C.danger),sp(),

    h2('6.2 FAQ'),
    tbl(['질문','답변'],[
      ['입하 후 IQC가 안 보여요','입하 시 IQC_STATUS=PENDING으로 생성됩니다. IQC 화면에서 검사를 진행하세요.'],
      ['입고 가능 LOT이 없어요','IQC 합격(PASS) + 라벨 발행 완료된 LOT만 표시됩니다. IQC 검사와 라벨 발행을 먼저 진행하세요.'],
      ['자동입고가 뭔가요?','시스템설정(IQC_AUTO_RECEIVE=ON)이면 라벨 발행 시 자동으로 기본 창고에 입고됩니다.'],
      ['수량이 마이너스로 표시돼요','취소(역분개)된 트랜잭션입니다. 빨간색 음수(-) 표시는 정상입니다.'],
      ['PO 상태가 안 바뀌어요','모든 품목의 수령이 완료되면 자동으로 RECEIVED로 변경됩니다. 일부만 수령 시 PARTIAL입니다.'],
    ],[3000,6026]),
  );

  const bodySection={
    properties:{page:{size:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'HARNESS MES - \uC0AC\uC6A9\uC790 \uB9E4\uB274\uC5BC (\uC790\uC7AC\uC785\uACE0)',font:'Arial',size:16,color:'999999'})]})]})},
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Page ',font:'Arial',size:16,color:'999999'}),new TextRun({children:[PageNumber.CURRENT],font:'Arial',size:16,color:'999999'})]})]})},
    children:body,
  };

  return new Document({
    styles:{default:{document:{run:{font:'Arial',size:20}}},
      paragraphStyles:[
        {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:32,bold:true,font:'Arial',color:C.primary},paragraph:{spacing:{before:360,after:240},outlineLevel:0}},
        {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:26,bold:true,font:'Arial',color:'333333'},paragraph:{spacing:{before:240,after:180},outlineLevel:1}},
        {id:'Heading3',name:'Heading 3',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:22,bold:true,font:'Arial',color:'555555'},paragraph:{spacing:{before:180,after:120},outlineLevel:2}},
      ]},
    sections:[cover,bodySection],
  });
}

async function main(){
  const doc=buildDoc();
  const buffer=await Packer.toBuffer(doc);
  fs.mkdirSync('docs/deliverables/material',{recursive:true});
  const out='docs/deliverables/material/사용자매뉴얼_자재입고_2026-03-19.docx';
  fs.writeFileSync(out,buffer);
  console.log('Generated: '+out);
}
main().catch(console.error);
