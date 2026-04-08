/**
 * @file scripts/gen-erd.js
 * @description HARNESS MES ERD 산출물 Word 문서 생성 (125개 엔티티, 도메인별 그룹핑)
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CW = 13440; const MARGIN = 1200;
const C = { primary: '2B579A', hdr: 'D5E8F0', alt: 'F5F9FC', w: 'FFFFFF', pk: 'FFF2CC', fk: 'E2EFDA' };
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const tbs = { top: tb, bottom: tb, left: tb, right: tb };

function c(t,w,o={}) {
  return new TableCell({ borders:tbs, width:{size:w,type:WidthType.DXA},
    shading:o.sh?{fill:o.sh,type:ShadingType.CLEAR}:undefined,
    margins:{top:40,bottom:40,left:70,right:70}, columnSpan:o.span, verticalAlign:'center',
    children:[new Paragraph({alignment:o.al||AlignmentType.LEFT,spacing:{before:0,after:0},
      children:[new TextRun({text:t||'',bold:o.b||false,font:'Arial',size:o.sz||15,color:o.cl||'000000'})]})]});
}
function tbl(hds,data,ws) {
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:ws,
    rows:[
      new TableRow({tableHeader:true,children:hds.map((h,i)=>c(h,ws[i],{b:true,sh:C.hdr,al:AlignmentType.CENTER,sz:14}))}),
      ...data.map((r,idx)=>new TableRow({children:r.map((v,i)=>c(v,ws[i],{sz:14,sh:idx%2===1?C.alt:C.w,al:i===0?AlignmentType.CENTER:AlignmentType.LEFT}))})),
    ]});
}
function sp() { return new Paragraph({spacing:{after:150},children:[]}); }
function pb() { return new Paragraph({children:[new PageBreak()]}); }
function h1(t) { return new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun({text:t,font:'Arial'})]}); }
function h2(t) { return new Paragraph({heading:HeadingLevel.HEADING_2,children:[new TextRun({text:t,font:'Arial'})]}); }
function p(t) { return new Paragraph({spacing:{after:100},children:[new TextRun({text:t,font:'Arial',size:18})]}); }
function tree(lines) { return lines.map(l=>new Paragraph({spacing:{before:10,after:10},indent:{left:360},children:[new TextRun({text:l,font:'Consolas',size:15})]})); }

// ── 도메인별 테이블 그룹 ──
const domains = [
  { name: '기준정보 (Master)', tables: [
    {n:'ITEM_MASTERS',k:'품목마스터',pk:'ITEM_CODE',rel:[]},
    {n:'BOM_MASTERS',k:'BOM',pk:'PARENT_CODE+CHILD_CODE+SEQ',rel:['ITEM_MASTERS']},
    {n:'ROUTING_GROUPS',k:'라우팅그룹',pk:'ROUTING_GROUP_ID',rel:['ITEM_MASTERS']},
    {n:'ROUTING_PROCESSES',k:'라우팅공정',pk:'ROUTING_GROUP_ID+SEQ',rel:['ROUTING_GROUPS','PROCESS_MASTERS']},
    {n:'PROCESS_MASTERS',k:'공정마스터',pk:'PROCESS_CODE',rel:[]},
    {n:'PROCESS_QUALITY_CONDITIONS',k:'품질조건',pk:'PROCESS_CODE+SEQ',rel:['PROCESS_MASTERS']},
    {n:'PROCESS_MAPS',k:'공정맵',pk:'MAP_ID',rel:['PROCESS_MASTERS']},
    {n:'PROD_LINE_MASTERS',k:'생산라인',pk:'LINE_CODE',rel:[]},
    {n:'PARTNER_MASTERS',k:'거래처',pk:'PARTNER_ID',rel:[]},
    {n:'VENDOR_MASTERS',k:'공급업체',pk:'VENDOR_ID',rel:[]},
    {n:'WORKER_MASTERS',k:'작업자',pk:'WORKER_CODE',rel:[]},
    {n:'WORK_INSTRUCTIONS',k:'작업지도서',pk:'INSTRUCTION_ID',rel:['ITEM_MASTERS']},
    {n:'LABEL_TEMPLATES',k:'라벨템플릿',pk:'TEMPLATE_ID',rel:[]},
    {n:'MODEL_SUFFIXES',k:'모델접미사',pk:'SUFFIX_ID',rel:[]},
    {n:'VENDOR_BARCODE_MAPPINGS',k:'바코드매핑',pk:'MAPPING_ID',rel:['ITEM_MASTERS']},
  ]},
  { name: '구매/발주 (Purchasing)', tables: [
    {n:'PURCHASE_ORDERS',k:'발주',pk:'PO_NO',rel:['PARTNER_MASTERS']},
    {n:'PURCHASE_ORDER_ITEMS',k:'발주품목',pk:'PO_ID+SEQ',rel:['PURCHASE_ORDERS','ITEM_MASTERS']},
  ]},
  { name: '자재관리 (Material)', tables: [
    {n:'MAT_ARRIVALS',k:'입하',pk:'ARRIVAL_NO+SEQ',rel:['PURCHASE_ORDERS','ITEM_MASTERS']},
    {n:'MAT_LOTS',k:'자재LOT',pk:'MAT_UID',rel:['ITEM_MASTERS']},
    {n:'MAT_RECEIVINGS',k:'입고',pk:'RECEIVE_NO+SEQ',rel:['MAT_LOTS']},
    {n:'MAT_STOCKS',k:'자재현재고',pk:'WAREHOUSE_CODE+ITEM_CODE+MAT_UID',rel:['WAREHOUSES','ITEM_MASTERS']},
    {n:'STOCK_TRANSACTIONS',k:'수불원장',pk:'TRANS_NO',rel:['ITEM_MASTERS','WAREHOUSES']},
    {n:'MAT_ISSUES',k:'자재출고',pk:'ISSUE_NO+SEQ',rel:['MAT_LOTS','JOB_ORDERS']},
    {n:'MAT_ISSUE_REQUESTS',k:'출고요청',pk:'REQUEST_NO',rel:['JOB_ORDERS']},
    {n:'MAT_ISSUE_REQUEST_ITEMS',k:'출고요청품목',pk:'REQUEST_NO+SEQ',rel:['MAT_ISSUE_REQUESTS','ITEM_MASTERS']},
    {n:'LABEL_PRINT_LOGS',k:'라벨인쇄이력',pk:'LOG_ID',rel:[]},
    {n:'INV_ADJ_LOGS',k:'재고조정이력',pk:'ADJ_NO',rel:[]},
  ]},
  { name: 'IQC/품질검사 (Quality-Inspection)', tables: [
    {n:'IQC_ITEM_POOL',k:'IQC항목풀',pk:'ITEM_ID',rel:[]},
    {n:'IQC_ITEM_MASTERS',k:'IQC항목마스터',pk:'ITEM_CODE+SEQ',rel:['ITEM_MASTERS']},
    {n:'IQC_GROUPS',k:'IQC그룹',pk:'GROUP_ID',rel:[]},
    {n:'IQC_GROUP_ITEMS',k:'IQC그룹항목',pk:'GROUP_ID+ITEM_ID',rel:['IQC_GROUPS','IQC_ITEM_POOL']},
    {n:'IQC_PART_LINKS',k:'IQC품목연결',pk:'PART_CODE+GROUP_ID',rel:['ITEM_MASTERS','IQC_GROUPS']},
    {n:'IQC_LOGS',k:'IQC검사이력',pk:'LOG_ID',rel:['ITEM_MASTERS','MAT_LOTS']},
    {n:'INSPECT_RESULTS',k:'공정검사결과',pk:'RESULT_ID',rel:['JOB_ORDERS']},
    {n:'SAMPLE_INSPECT_RESULTS',k:'샘플검사결과',pk:'RESULT_ID',rel:['JOB_ORDERS']},
    {n:'OQC_REQUESTS',k:'OQC요청',pk:'OQC_NO',rel:[]},
    {n:'OQC_REQUEST_BOXES',k:'OQC박스',pk:'OQC_NO+BOX_NO',rel:['OQC_REQUESTS']},
  ]},
  { name: '품질관리 (Quality-Management)', tables: [
    {n:'DEFECT_LOGS',k:'불량이력',pk:'DEFECT_NO',rel:['ITEM_MASTERS']},
    {n:'REWORK_ORDERS',k:'재작업지시',pk:'REWORK_NO',rel:['DEFECT_LOGS']},
    {n:'REWORK_PROCESSES',k:'재작업공정',pk:'REWORK_NO+SEQ',rel:['REWORK_ORDERS']},
    {n:'REWORK_RESULTS',k:'재작업결과',pk:'RESULT_ID',rel:['REWORK_ORDERS']},
    {n:'REWORK_INSPECTS',k:'재작업검사',pk:'INSPECT_ID',rel:['REWORK_ORDERS']},
    {n:'CHANGE_ORDERS',k:'변경관리',pk:'CHANGE_NO',rel:[]},
    {n:'CUSTOMER_COMPLAINTS',k:'고객불만',pk:'COMPLAINT_NO',rel:[]},
    {n:'CAPA_REQUESTS',k:'CAPA요청',pk:'CAPA_NO',rel:[]},
    {n:'CAPA_ACTIONS',k:'CAPA조치',pk:'CAPA_NO+SEQ',rel:['CAPA_REQUESTS']},
    {n:'FAI_REQUESTS',k:'FAI요청',pk:'FAI_NO',rel:['ITEM_MASTERS']},
    {n:'FAI_ITEMS',k:'FAI항목',pk:'FAI_NO+SEQ',rel:['FAI_REQUESTS']},
    {n:'PPAP_SUBMISSIONS',k:'PPAP제출',pk:'PPAP_NO',rel:['ITEM_MASTERS']},
    {n:'AUDIT_PLANS',k:'감사계획',pk:'AUDIT_NO',rel:[]},
    {n:'AUDIT_FINDINGS',k:'감사발견',pk:'AUDIT_NO+SEQ',rel:['AUDIT_PLANS']},
    {n:'TRACE_LOGS',k:'추적이력',pk:'TRACE_ID',rel:[]},
  ]},
  { name: 'SPC (통계적 공정 관리)', tables: [
    {n:'SPC_CHARTS',k:'SPC차트',pk:'CHART_ID',rel:['ITEM_MASTERS','PROCESS_MASTERS']},
    {n:'SPC_DATA',k:'SPC데이터',pk:'DATA_ID',rel:['SPC_CHARTS']},
    {n:'CONTROL_PLANS',k:'관리계획',pk:'PLAN_ID',rel:['ITEM_MASTERS']},
    {n:'CONTROL_PLAN_ITEMS',k:'관리계획항목',pk:'PLAN_ID+SEQ',rel:['CONTROL_PLANS']},
  ]},
  { name: '생산관리 (Production)', tables: [
    {n:'PROD_PLANS',k:'생산계획',pk:'PLAN_ID',rel:['ITEM_MASTERS']},
    {n:'JOB_ORDERS',k:'작업지시',pk:'JOB_ORDER_NO',rel:['ITEM_MASTERS','PROD_PLANS']},
    {n:'PROD_RESULTS',k:'생산실적',pk:'RESULT_ID',rel:['JOB_ORDERS','PROCESS_MASTERS']},
    {n:'FG_LABELS',k:'완제품라벨',pk:'SERIAL_NO',rel:['JOB_ORDERS']},
    {n:'REPAIR_ORDERS',k:'수리지시',pk:'REPAIR_NO',rel:[]},
    {n:'REPAIR_LOGS',k:'수리이력',pk:'LOG_ID',rel:['REPAIR_ORDERS']},
    {n:'REPAIR_USED_PARTS',k:'수리사용부품',pk:'REPAIR_NO+SEQ',rel:['REPAIR_ORDERS']},
  ]},
  { name: '제품재고 (Product Inventory)', tables: [
    {n:'PRODUCT_STOCKS',k:'제품현재고',pk:'WAREHOUSE_CODE+ITEM_CODE+SERIAL_NO',rel:['WAREHOUSES','ITEM_MASTERS']},
    {n:'PRODUCT_TRANSACTIONS',k:'제품수불',pk:'TRANS_NO',rel:['ITEM_MASTERS']},
    {n:'PHYSICAL_INV_SESSIONS',k:'재고실사세션',pk:'SESSION_ID',rel:['WAREHOUSES']},
    {n:'PHYSICAL_INV_COUNT_DETAILS',k:'재고실사상세',pk:'SESSION_ID+SEQ',rel:['PHYSICAL_INV_SESSIONS']},
  ]},
  { name: '출하관리 (Shipping)', tables: [
    {n:'CUSTOMER_ORDERS',k:'고객PO',pk:'ORDER_NO',rel:['PARTNER_MASTERS']},
    {n:'CUSTOMER_ORDER_ITEMS',k:'고객PO품목',pk:'ORDER_NO+SEQ',rel:['CUSTOMER_ORDERS','ITEM_MASTERS']},
    {n:'SHIPMENT_ORDERS',k:'출하오더',pk:'SHIP_ORDER_NO',rel:['CUSTOMER_ORDERS']},
    {n:'SHIPMENT_ORDER_ITEMS',k:'출하오더품목',pk:'SHIP_ORDER_NO+SEQ',rel:['SHIPMENT_ORDERS']},
    {n:'BOX_MASTERS',k:'박스',pk:'BOX_NO',rel:[]},
    {n:'PALLET_MASTERS',k:'팔렛',pk:'PALLET_NO',rel:[]},
    {n:'SHIPMENT_LOGS',k:'출하이력',pk:'LOG_ID',rel:['SHIPMENT_ORDERS']},
    {n:'SHIPMENT_RETURNS',k:'반품',pk:'RETURN_NO',rel:[]},
    {n:'SHIPMENT_RETURN_ITEMS',k:'반품품목',pk:'RETURN_NO+SEQ',rel:['SHIPMENT_RETURNS']},
  ]},
  { name: '설비관리 (Equipment)', tables: [
    {n:'EQUIP_MASTERS',k:'설비마스터',pk:'EQUIP_CODE',rel:[]},
    {n:'EQUIP_BOM_RELS',k:'설비BOM관계',pk:'REL_ID',rel:['EQUIP_MASTERS']},
    {n:'EQUIP_BOM_ITEMS',k:'설비BOM품목',pk:'REL_ID+SEQ',rel:['EQUIP_BOM_RELS']},
    {n:'EQUIP_INSPECT_ITEM_MASTERS',k:'점검항목마스터',pk:'ITEM_ID',rel:[]},
    {n:'EQUIP_INSPECT_LOGS',k:'점검이력',pk:'LOG_ID',rel:['EQUIP_MASTERS']},
    {n:'EQUIP_PROTOCOLS',k:'통전검사프로토콜',pk:'PROTOCOL_ID',rel:['EQUIP_MASTERS']},
    {n:'MOLD_MASTERS',k:'금형마스터',pk:'MOLD_CODE',rel:[]},
    {n:'MOLD_USAGE_LOGS',k:'금형사용이력',pk:'LOG_ID',rel:['MOLD_MASTERS']},
    {n:'PM_PLANS',k:'예방보전계획',pk:'PM_PLAN_ID',rel:['EQUIP_MASTERS']},
    {n:'PM_PLAN_ITEMS',k:'PM계획항목',pk:'PM_PLAN_ID+SEQ',rel:['PM_PLANS']},
    {n:'PM_WORK_ORDERS',k:'PM작업지시',pk:'WO_ID',rel:['PM_PLANS']},
    {n:'PM_WO_RESULTS',k:'PM작업결과',pk:'WO_ID+SEQ',rel:['PM_WORK_ORDERS']},
    {n:'GAUGE_MASTERS',k:'계측기마스터',pk:'GAUGE_CODE',rel:[]},
    {n:'CALIBRATION_LOGS',k:'교정이력',pk:'LOG_ID',rel:['GAUGE_MASTERS']},
  ]},
  { name: '창고/로케이션 (Warehouse)', tables: [
    {n:'WAREHOUSES',k:'창고',pk:'WAREHOUSE_CODE',rel:[]},
    {n:'WAREHOUSE_LOCATIONS',k:'로케이션',pk:'WAREHOUSE_CODE+LOCATION_CODE',rel:['WAREHOUSES']},
    {n:'WAREHOUSE_TRANSFER_RULES',k:'이동규칙',pk:'RULE_ID',rel:['WAREHOUSES']},
  ]},
  { name: '소모품관리 (Consumables)', tables: [
    {n:'CONSUMABLE_MASTERS',k:'소모품마스터',pk:'CON_CODE',rel:[]},
    {n:'CONSUMABLE_STOCKS',k:'소모품재고',pk:'CON_CODE+WAREHOUSE_CODE',rel:['CONSUMABLE_MASTERS']},
    {n:'CONSUMABLE_LOGS',k:'소모품이력',pk:'LOG_ID',rel:['CONSUMABLE_MASTERS']},
    {n:'CONSUMABLE_MOUNT_LOGS',k:'소모품장착이력',pk:'LOG_ID',rel:['CONSUMABLE_MASTERS','EQUIP_MASTERS']},
  ]},
  { name: '외주관리 (Outsourcing)', tables: [
    {n:'SUBCON_ORDERS',k:'외주발주',pk:'ORDER_NO',rel:['VENDOR_MASTERS']},
    {n:'SUBCON_DELIVERIES',k:'외주납품',pk:'DELIVERY_NO',rel:['SUBCON_ORDERS']},
    {n:'SUBCON_RECEIVES',k:'외주입고',pk:'RECEIVE_NO',rel:['SUBCON_DELIVERIES']},
  ]},
  { name: '보세관리 (Customs)', tables: [
    {n:'CUSTOMS_ENTRIES',k:'보세반입',pk:'ENTRY_NO',rel:[]},
    {n:'CUSTOMS_LOTS',k:'보세LOT',pk:'LOT_NO',rel:['CUSTOMS_ENTRIES']},
    {n:'CUSTOMS_USAGE_REPORTS',k:'보세사용보고',pk:'REPORT_NO',rel:[]},
  ]},
  { name: '시스템 (System)', tables: [
    {n:'USERS',k:'사용자',pk:'USER_ID',rel:[]},
    {n:'USER_AUTHS',k:'인증이력',pk:'AUTH_ID',rel:['USERS']},
    {n:'ROLES',k:'역할',pk:'ROLE_ID',rel:[]},
    {n:'ROLE_MENU_PERMISSIONS',k:'역할메뉴권한',pk:'ROLE_ID+MENU_CODE',rel:['ROLES']},
    {n:'PDA_ROLE',k:'PDA역할',pk:'ROLE_ID',rel:[]},
    {n:'PDA_ROLE_MENU',k:'PDA역할메뉴',pk:'ROLE_ID+MENU_CODE',rel:['PDA_ROLE']},
    {n:'COM_CODES',k:'공통코드',pk:'GROUP_CODE+DETAIL_CODE',rel:[]},
    {n:'COMPANY_MASTERS',k:'회사마스터',pk:'COMPANY_CODE',rel:[]},
    {n:'PLANTS',k:'공장',pk:'PLANT_CD',rel:['COMPANY_MASTERS']},
    {n:'DEPARTMENT_MASTERS',k:'부서마스터',pk:'DEPT_CODE',rel:[]},
    {n:'SYS_CONFIGS',k:'시스템설정',pk:'CONFIG_KEY',rel:[]},
    {n:'COMM_CONFIGS',k:'통신설정',pk:'CONFIG_ID',rel:[]},
    {n:'DOCUMENT_MASTERS',k:'문서마스터',pk:'DOC_ID',rel:[]},
    {n:'TRAINING_PLANS',k:'교육계획',pk:'PLAN_ID',rel:[]},
    {n:'TRAINING_RESULTS',k:'교육결과',pk:'PLAN_ID+USER_ID',rel:['TRAINING_PLANS']},
    {n:'ACTIVITY_LOGS',k:'활동이력',pk:'LOG_ID',rel:['USERS']},
    {n:'NUM_RULE_MASTERS',k:'채번규칙',pk:'RULE_CODE',rel:[]},
    {n:'SEQ_RULES',k:'시퀀스규칙',pk:'RULE_ID',rel:[]},
    {n:'INTER_LOGS',k:'연동이력',pk:'LOG_ID',rel:[]},
    {n:'SCHEDULER_JOBS',k:'스케줄러작업',pk:'JOB_ID',rel:[]},
    {n:'SCHEDULER_LOGS',k:'스케줄러로그',pk:'LOG_ID',rel:['SCHEDULER_JOBS']},
    {n:'SCHEDULER_NOTIFICATIONS',k:'스케줄러알림',pk:'NOTI_ID',rel:['SCHEDULER_JOBS']},
  ]},
];

const totalTables = domains.reduce((s,d)=>s+d.tables.length,0);
const totalRels = domains.reduce((s,d)=>s+d.tables.reduce((s2,t)=>s2+t.rel.length,0),0);

function buildDoc() {
  const cover = {
    properties:{page:{size:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}},
    children:[
      new Paragraph({spacing:{before:4000},children:[]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:'HARNESS MES',font:'Arial',size:56,bold:true,color:C.primary})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:600},children:[new TextRun({text:'Manufacturing Execution System',font:'Arial',size:28,color:'666666'})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:'ERD (Entity Relationship Diagram)',font:'Arial',size:44,bold:true,color:'333333'})]}),
      new Paragraph({spacing:{before:2000},children:[]}),
      new Table({width:{size:5000,type:WidthType.DXA},columnWidths:[2000,3000],
        rows:[['프로젝트명','HARNESS MES'],['산출물명','ERD'],['버전','v1.0'],['작성일','2026-03-18'],['작성자','HANES MES팀'],['테이블 수',String(totalTables)+'개'],['관계 수',String(totalRels)+'개']].map(([k,v])=>
          new TableRow({children:[c(k,2000,{b:true,sh:C.hdr,al:AlignmentType.CENTER,sz:18}),c(v,3000,{sz:18})]}))}),
    ],
  };

  const body = [];
  body.push(h1('\uAC1C\uC815\uC774\uB825'),tbl(['버전','일자','작성자','변경내용'],[['1.0','2026-03-18','HANES MES팀','최초 작성 (전체 '+totalTables+'개 테이블)']],[1500,1500,2000,8440]),pb());
  body.push(h1('\uBAA9\uCC28'),new TableOfContents('TOC',{hyperlink:true,headingStyleRange:'1-3'}),pb());

  // 1. 개요
  body.push(h1('1. \uAC1C\uC694'),
    p(`본 문서는 HARNESS MES 시스템의 전체 ${totalTables}개 테이블에 대한 ERD(Entity Relationship Diagram)를 ${domains.length}개 도메인으로 그룹핑하여 정의한다.`),
    p('DBMS: Oracle Database / ORM: TypeORM / PK 전략: 자연키/복합키 (Auto Increment 미사용)'),
    pb());

  // 2. 전체 ERD 개요
  body.push(h1('2. \uC804\uCCB4 ERD \uAC1C\uC694'),
    tbl(['No','도메인','테이블 수','주요 테이블','비고'],
      domains.map((d,i)=>[String(i+1),d.name,String(d.tables.length),d.tables.slice(0,3).map(t=>t.k).join(', '),'']),
      [500,2500,1000,6000,3440]),pb());

  // 3. 도메인별 ERD
  body.push(h1('3. \uB3C4\uBA54\uC778\uBCC4 ERD'));
  domains.forEach((dom,di) => {
    body.push(h2(`3.${di+1} ${dom.name}`));

    // 테이블 목록
    body.push(tbl(['No','테이블명','한글명','PK','참조 테이블'],
      dom.tables.map((t,i)=>[String(i+1),t.n,t.k,t.pk,t.rel.join(', ')||'-']),
      [400,2800,1800,3000,5440]),sp());

    // 관계 다이어그램 (텍스트)
    const rels = [];
    dom.tables.forEach(t => {
      t.rel.forEach(r => {
        rels.push(`${r} (1) ──→ (N) ${t.n}`);
      });
    });
    if (rels.length > 0) {
      body.push(p('\u25A0 관계 다이어그램:'));
      body.push(...tree(rels));
    }
    body.push(sp());
    if (di < domains.length-1 && di%2===1) body.push(pb());
  });
  body.push(pb());

  // 4. 전체 관계 목록
  body.push(h1('4. \uC804\uCCB4 \uAD00\uACC4 \uBAA9\uB85D'));
  const allRels = [];
  let rno = 0;
  domains.forEach(dom => {
    dom.tables.forEach(t => {
      t.rel.forEach(r => {
        rno++;
        allRels.push([String(rno), r, '1:N', t.n, dom.name]);
      });
    });
  });
  body.push(tbl(['No','From 테이블','관계','To 테이블','도메인'], allRels,
    [500,2800,800,2800,6540]));

  // 5. 통계
  body.push(pb(), h1('5. \uD1B5\uACC4'),
    tbl(['항목','수치'],[
      ['전체 도메인',String(domains.length)+'개'],
      ['전체 테이블',String(totalTables)+'개'],
      ['전체 관계',String(totalRels)+'개'],
      ['평균 관계/테이블',String((totalRels/totalTables).toFixed(1))],
      ['최대 테이블 도메인',domains.reduce((a,b)=>a.tables.length>b.tables.length?a:b).name+' ('+domains.reduce((a,b)=>a.tables.length>b.tables.length?a:b).tables.length+'개)'],
    ],[3000,10440]));

  const bodySection = {
    properties:{page:{size:{width:11906,height:16838,orientation:'landscape'},margin:{top:MARGIN,right:MARGIN,bottom:MARGIN,left:MARGIN}}},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'HARNESS MES - ERD',font:'Arial',size:16,color:'999999'})]})]})},
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Page ',font:'Arial',size:16,color:'999999'}),new TextRun({children:[PageNumber.CURRENT],font:'Arial',size:16,color:'999999'})]})]})},
    children:body,
  };

  return new Document({
    styles:{default:{document:{run:{font:'Arial',size:18}}},
      paragraphStyles:[
        {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:32,bold:true,font:'Arial',color:C.primary},paragraph:{spacing:{before:360,after:240},outlineLevel:0}},
        {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:26,bold:true,font:'Arial',color:'333333'},paragraph:{spacing:{before:240,after:180},outlineLevel:1}},
      ]},
    sections:[cover,bodySection],
  });
}

async function main() {
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync('exports/system',{recursive:true});
  const outPath = 'exports/system/ERD_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);
