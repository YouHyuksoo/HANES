/**
 * @file scripts/gen-erd-html.js
 * @description ERD HTML 생성 - entity-columns.json 기반, 컬럼 속성 포함, 드래그/줌 지원
 */
const fs = require('fs');
const entityData = require('./entity-columns.json');

// 도메인 그룹핑
const domainDefs = [
  { id:'master', name:'기준정보', color:'#2563eb', tables:['ITEM_MASTERS','BOM_MASTERS','ROUTING_GROUPS','ROUTING_PROCESSES','PROCESS_MASTERS','PROCESS_QUALITY_CONDITIONS','PROCESS_MAPS','PROD_LINE_MASTERS','PARTNER_MASTERS','VENDOR_MASTERS','WORKER_MASTERS','WORK_INSTRUCTIONS','LABEL_TEMPLATES','MODEL_SUFFIXES','VENDOR_BARCODE_MAPPINGS'] },
  { id:'purchasing', name:'구매/발주', color:'#059669', tables:['PURCHASE_ORDERS','PURCHASE_ORDER_ITEMS'] },
  { id:'material', name:'자재관리', color:'#16a34a', tables:['MAT_ARRIVALS','MAT_LOTS','MAT_RECEIVINGS','MAT_STOCKS','STOCK_TRANSACTIONS','MAT_ISSUES','MAT_ISSUE_REQUESTS','MAT_ISSUE_REQUEST_ITEMS','LABEL_PRINT_LOGS','INV_ADJ_LOGS'] },
  { id:'iqc', name:'IQC/품질검사', color:'#ea580c', tables:['IQC_ITEM_POOL','IQC_ITEM_MASTERS','IQC_GROUPS','IQC_GROUP_ITEMS','IQC_PART_LINKS','IQC_LOGS','INSPECT_RESULTS','SAMPLE_INSPECT_RESULTS','OQC_REQUESTS','OQC_REQUEST_BOXES'] },
  { id:'quality', name:'품질관리', color:'#dc2626', tables:['DEFECT_LOGS','REWORK_ORDERS','REWORK_PROCESSES','REWORK_RESULTS','REWORK_INSPECTS','CHANGE_ORDERS','CUSTOMER_COMPLAINTS','CAPA_REQUESTS','CAPA_ACTIONS','FAI_REQUESTS','FAI_ITEMS','PPAP_SUBMISSIONS','AUDIT_PLANS','AUDIT_FINDINGS','TRACE_LOGS'] },
  { id:'spc', name:'SPC', color:'#e11d48', tables:['SPC_CHARTS','SPC_DATA','CONTROL_PLANS','CONTROL_PLAN_ITEMS'] },
  { id:'production', name:'생산관리', color:'#d97706', tables:['PROD_PLANS','JOB_ORDERS','PROD_RESULTS','FG_LABELS','REPAIR_ORDERS','REPAIR_LOGS','REPAIR_USED_PARTS'] },
  { id:'product-inv', name:'제품재고', color:'#ca8a04', tables:['PRODUCT_STOCKS','PRODUCT_TRANSACTIONS','PHYSICAL_INV_SESSIONS','PHYSICAL_INV_COUNT_DETAILS'] },
  { id:'shipping', name:'출하관리', color:'#0891b2', tables:['CUSTOMER_ORDERS','CUSTOMER_ORDER_ITEMS','SHIPMENT_ORDERS','SHIPMENT_ORDER_ITEMS','BOX_MASTERS','PALLET_MASTERS','SHIPMENT_LOGS','SHIPMENT_RETURNS','SHIPMENT_RETURN_ITEMS'] },
  { id:'equipment', name:'설비관리', color:'#7c3aed', tables:['EQUIP_MASTERS','EQUIP_BOM_RELS','EQUIP_BOM_ITEMS','EQUIP_INSPECT_ITEM_MASTERS','EQUIP_INSPECT_LOGS','EQUIP_PROTOCOLS','MOLD_MASTERS','MOLD_USAGE_LOGS','PM_PLANS','PM_PLAN_ITEMS','PM_WORK_ORDERS','PM_WO_RESULTS','GAUGE_MASTERS','CALIBRATION_LOGS'] },
  { id:'warehouse', name:'창고/로케이션', color:'#0d9488', tables:['WAREHOUSES','WAREHOUSE_LOCATIONS','WAREHOUSE_TRANSFER_RULES'] },
  { id:'consumables', name:'소모품관리', color:'#8b5cf6', tables:['CONSUMABLE_MASTERS','CONSUMABLE_STOCKS','CONSUMABLE_LOGS','CONSUMABLE_MOUNT_LOGS'] },
  { id:'outsourcing', name:'외주관리', color:'#0284c7', tables:['SUBCON_ORDERS','SUBCON_DELIVERIES','SUBCON_RECEIVES'] },
  { id:'customs', name:'보세관리', color:'#06b6d4', tables:['CUSTOMS_ENTRIES','CUSTOMS_LOTS','CUSTOMS_USAGE_REPORTS'] },
  { id:'system', name:'시스템', color:'#64748b', tables:['USERS','USER_AUTHS','ROLES','ROLE_MENU_PERMISSIONS','PDA_ROLE','PDA_ROLE_MENU','COM_CODES','COMPANY_MASTERS','PLANTS','DEPARTMENT_MASTERS','SYS_CONFIGS','COMM_CONFIGS','DOCUMENT_MASTERS','TRAINING_PLANS','TRAINING_RESULTS','ACTIVITY_LOGS','NUM_RULE_MASTERS','SEQ_RULES','INTER_LOGS','SCHEDULER_JOBS','SCHEDULER_LOGS','SCHEDULER_NOTIFICATIONS'] },
];

// 도메인별 관계 정의
const domainRels = {
  master: [
    {from:'BOM_MASTERS',to:'ITEM_MASTERS',label:'N:1'},{from:'ROUTING_GROUPS',to:'ITEM_MASTERS',label:'1:1'},
    {from:'ROUTING_PROCESSES',to:'ROUTING_GROUPS',label:'N:1'},{from:'ROUTING_PROCESSES',to:'PROCESS_MASTERS',label:'N:1'},
    {from:'PROCESS_QUALITY_CONDITIONS',to:'PROCESS_MASTERS',label:'N:1'},{from:'PROCESS_MAPS',to:'PROCESS_MASTERS',label:'N:1'},
    {from:'WORK_INSTRUCTIONS',to:'ITEM_MASTERS',label:'N:1'},{from:'VENDOR_BARCODE_MAPPINGS',to:'ITEM_MASTERS',label:'N:1'},
  ],
  purchasing: [
    {from:'PURCHASE_ORDER_ITEMS',to:'PURCHASE_ORDERS',label:'N:1'},
  ],
  material: [
    {from:'MAT_RECEIVINGS',to:'MAT_LOTS',label:'N:1'},{from:'MAT_STOCKS',to:'MAT_LOTS',label:'N:1'},
    {from:'STOCK_TRANSACTIONS',to:'MAT_STOCKS',label:'→'},{from:'MAT_ISSUES',to:'MAT_LOTS',label:'N:1'},
    {from:'MAT_ISSUE_REQUEST_ITEMS',to:'MAT_ISSUE_REQUESTS',label:'N:1'},
    {from:'MAT_ARRIVALS',to:'MAT_LOTS',label:'→'},
  ],
  iqc: [
    {from:'IQC_GROUP_ITEMS',to:'IQC_GROUPS',label:'N:1'},{from:'IQC_GROUP_ITEMS',to:'IQC_ITEM_POOL',label:'N:1'},
    {from:'IQC_PART_LINKS',to:'IQC_GROUPS',label:'N:1'},
    {from:'OQC_REQUEST_BOXES',to:'OQC_REQUESTS',label:'N:1'},
  ],
  quality: [
    {from:'REWORK_ORDERS',to:'DEFECT_LOGS',label:'N:1'},{from:'REWORK_PROCESSES',to:'REWORK_ORDERS',label:'N:1'},
    {from:'REWORK_RESULTS',to:'REWORK_ORDERS',label:'N:1'},{from:'REWORK_INSPECTS',to:'REWORK_ORDERS',label:'N:1'},
    {from:'CAPA_ACTIONS',to:'CAPA_REQUESTS',label:'N:1'},{from:'FAI_ITEMS',to:'FAI_REQUESTS',label:'N:1'},
    {from:'AUDIT_FINDINGS',to:'AUDIT_PLANS',label:'N:1'},
  ],
  spc: [
    {from:'SPC_DATA',to:'SPC_CHARTS',label:'N:1'},{from:'CONTROL_PLAN_ITEMS',to:'CONTROL_PLANS',label:'N:1'},
  ],
  production: [
    {from:'JOB_ORDERS',to:'PROD_PLANS',label:'N:1'},{from:'PROD_RESULTS',to:'JOB_ORDERS',label:'N:1'},
    {from:'FG_LABELS',to:'JOB_ORDERS',label:'N:1'},{from:'REPAIR_LOGS',to:'REPAIR_ORDERS',label:'N:1'},
    {from:'REPAIR_USED_PARTS',to:'REPAIR_ORDERS',label:'N:1'},
  ],
  'product-inv': [
    {from:'PHYSICAL_INV_COUNT_DETAILS',to:'PHYSICAL_INV_SESSIONS',label:'N:1'},
  ],
  shipping: [
    {from:'CUSTOMER_ORDER_ITEMS',to:'CUSTOMER_ORDERS',label:'N:1'},{from:'SHIPMENT_ORDERS',to:'CUSTOMER_ORDERS',label:'N:1'},
    {from:'SHIPMENT_ORDER_ITEMS',to:'SHIPMENT_ORDERS',label:'N:1'},{from:'SHIPMENT_LOGS',to:'SHIPMENT_ORDERS',label:'N:1'},
    {from:'SHIPMENT_RETURN_ITEMS',to:'SHIPMENT_RETURNS',label:'N:1'},
  ],
  equipment: [
    {from:'EQUIP_BOM_RELS',to:'EQUIP_MASTERS',label:'N:1'},{from:'EQUIP_BOM_ITEMS',to:'EQUIP_BOM_RELS',label:'N:1'},
    {from:'EQUIP_INSPECT_LOGS',to:'EQUIP_MASTERS',label:'N:1'},{from:'EQUIP_PROTOCOLS',to:'EQUIP_MASTERS',label:'N:1'},
    {from:'MOLD_USAGE_LOGS',to:'MOLD_MASTERS',label:'N:1'},{from:'PM_PLANS',to:'EQUIP_MASTERS',label:'N:1'},
    {from:'PM_PLAN_ITEMS',to:'PM_PLANS',label:'N:1'},{from:'PM_WORK_ORDERS',to:'PM_PLANS',label:'N:1'},
    {from:'PM_WO_RESULTS',to:'PM_WORK_ORDERS',label:'N:1'},{from:'CALIBRATION_LOGS',to:'GAUGE_MASTERS',label:'N:1'},
  ],
  warehouse: [
    {from:'WAREHOUSE_LOCATIONS',to:'WAREHOUSES',label:'N:1'},{from:'WAREHOUSE_TRANSFER_RULES',to:'WAREHOUSES',label:'N:1'},
  ],
  consumables: [
    {from:'CONSUMABLE_STOCKS',to:'CONSUMABLE_MASTERS',label:'N:1'},{from:'CONSUMABLE_LOGS',to:'CONSUMABLE_MASTERS',label:'N:1'},
    {from:'CONSUMABLE_MOUNT_LOGS',to:'CONSUMABLE_MASTERS',label:'N:1'},
  ],
  outsourcing: [
    {from:'SUBCON_DELIVERIES',to:'SUBCON_ORDERS',label:'N:1'},{from:'SUBCON_RECEIVES',to:'SUBCON_DELIVERIES',label:'N:1'},
  ],
  customs: [
    {from:'CUSTOMS_LOTS',to:'CUSTOMS_ENTRIES',label:'N:1'},
  ],
  system: [
    {from:'USER_AUTHS',to:'USERS',label:'N:1'},{from:'USERS',to:'ROLES',label:'N:1'},
    {from:'ROLE_MENU_PERMISSIONS',to:'ROLES',label:'N:1'},{from:'PDA_ROLE_MENU',to:'PDA_ROLE',label:'N:1'},
    {from:'PLANTS',to:'COMPANY_MASTERS',label:'N:1'},{from:'TRAINING_RESULTS',to:'TRAINING_PLANS',label:'N:1'},
    {from:'ACTIVITY_LOGS',to:'USERS',label:'N:1'},{from:'SCHEDULER_LOGS',to:'SCHEDULER_JOBS',label:'N:1'},
    {from:'SCHEDULER_NOTIFICATIONS',to:'SCHEDULER_JOBS',label:'N:1'},
  ],
};

// 한글명 매핑
const korNames = {
  'ITEM_MASTERS':'품목마스터','BOM_MASTERS':'BOM','ROUTING_GROUPS':'라우팅그룹','ROUTING_PROCESSES':'라우팅공정','PROCESS_MASTERS':'공정마스터','PROCESS_QUALITY_CONDITIONS':'품질조건','PROCESS_MAPS':'공정맵','PROD_LINE_MASTERS':'생산라인','PARTNER_MASTERS':'거래처','VENDOR_MASTERS':'공급업체','WORKER_MASTERS':'작업자','WORK_INSTRUCTIONS':'작업지도서','LABEL_TEMPLATES':'라벨템플릿','MODEL_SUFFIXES':'모델접미사','VENDOR_BARCODE_MAPPINGS':'바코드매핑',
  'PURCHASE_ORDERS':'발주','PURCHASE_ORDER_ITEMS':'발주품목',
  'MAT_ARRIVALS':'입하','MAT_LOTS':'자재LOT','MAT_RECEIVINGS':'입고','MAT_STOCKS':'자재현재고','STOCK_TRANSACTIONS':'수불원장','MAT_ISSUES':'자재출고','MAT_ISSUE_REQUESTS':'출고요청','MAT_ISSUE_REQUEST_ITEMS':'출고요청품목','LABEL_PRINT_LOGS':'라벨인쇄이력','INV_ADJ_LOGS':'재고조정이력',
  'IQC_ITEM_POOL':'IQC항목풀','IQC_ITEM_MASTERS':'IQC항목마스터','IQC_GROUPS':'IQC그룹','IQC_GROUP_ITEMS':'IQC그룹항목','IQC_PART_LINKS':'IQC품목연결','IQC_LOGS':'IQC검사이력','INSPECT_RESULTS':'공정검사결과','SAMPLE_INSPECT_RESULTS':'샘플검사결과','OQC_REQUESTS':'OQC요청','OQC_REQUEST_BOXES':'OQC박스',
  'DEFECT_LOGS':'불량이력','REWORK_ORDERS':'재작업지시','REWORK_PROCESSES':'재작업공정','REWORK_RESULTS':'재작업결과','REWORK_INSPECTS':'재작업검사','CHANGE_ORDERS':'변경관리','CUSTOMER_COMPLAINTS':'고객불만','CAPA_REQUESTS':'CAPA요청','CAPA_ACTIONS':'CAPA조치','FAI_REQUESTS':'FAI요청','FAI_ITEMS':'FAI항목','PPAP_SUBMISSIONS':'PPAP제출','AUDIT_PLANS':'감사계획','AUDIT_FINDINGS':'감사발견','TRACE_LOGS':'추적이력',
  'SPC_CHARTS':'SPC차트','SPC_DATA':'SPC데이터','CONTROL_PLANS':'관리계획','CONTROL_PLAN_ITEMS':'관리계획항목',
  'PROD_PLANS':'생산계획','JOB_ORDERS':'작업지시','PROD_RESULTS':'생산실적','FG_LABELS':'완제품라벨','REPAIR_ORDERS':'수리지시','REPAIR_LOGS':'수리이력','REPAIR_USED_PARTS':'수리사용부품',
  'PRODUCT_STOCKS':'제품현재고','PRODUCT_TRANSACTIONS':'제품수불','PHYSICAL_INV_SESSIONS':'재고실사세션','PHYSICAL_INV_COUNT_DETAILS':'재고실사상세',
  'CUSTOMER_ORDERS':'고객PO','CUSTOMER_ORDER_ITEMS':'고객PO품목','SHIPMENT_ORDERS':'출하오더','SHIPMENT_ORDER_ITEMS':'출하오더품목','BOX_MASTERS':'박스','PALLET_MASTERS':'팔렛','SHIPMENT_LOGS':'출하이력','SHIPMENT_RETURNS':'반품','SHIPMENT_RETURN_ITEMS':'반품품목',
  'EQUIP_MASTERS':'설비마스터','EQUIP_BOM_RELS':'설비BOM관계','EQUIP_BOM_ITEMS':'설비BOM품목','EQUIP_INSPECT_ITEM_MASTERS':'점검항목마스터','EQUIP_INSPECT_LOGS':'점검이력','EQUIP_PROTOCOLS':'통전검사프로토콜','MOLD_MASTERS':'금형마스터','MOLD_USAGE_LOGS':'금형사용이력','PM_PLANS':'예방보전계획','PM_PLAN_ITEMS':'PM계획항목','PM_WORK_ORDERS':'PM작업지시','PM_WO_RESULTS':'PM작업결과','GAUGE_MASTERS':'계측기마스터','CALIBRATION_LOGS':'교정이력',
  'WAREHOUSES':'창고','WAREHOUSE_LOCATIONS':'로케이션','WAREHOUSE_TRANSFER_RULES':'이동규칙',
  'CONSUMABLE_MASTERS':'소모품마스터','CONSUMABLE_STOCKS':'소모품재고','CONSUMABLE_LOGS':'소모품이력','CONSUMABLE_MOUNT_LOGS':'소모품장착이력',
  'SUBCON_ORDERS':'외주발주','SUBCON_DELIVERIES':'외주납품','SUBCON_RECEIVES':'외주입고',
  'CUSTOMS_ENTRIES':'보세반입','CUSTOMS_LOTS':'보세LOT','CUSTOMS_USAGE_REPORTS':'보세사용보고',
  'USERS':'사용자','USER_AUTHS':'인증이력','ROLES':'역할','ROLE_MENU_PERMISSIONS':'역할메뉴권한','PDA_ROLE':'PDA역할','PDA_ROLE_MENU':'PDA역할메뉴','COM_CODES':'공통코드','COMPANY_MASTERS':'회사마스터','PLANTS':'공장','DEPARTMENT_MASTERS':'부서마스터','SYS_CONFIGS':'시스템설정','COMM_CONFIGS':'통신설정','DOCUMENT_MASTERS':'문서마스터','TRAINING_PLANS':'교육계획','TRAINING_RESULTS':'교육결과','ACTIVITY_LOGS':'활동이력','NUM_RULE_MASTERS':'채번규칙','SEQ_RULES':'시퀀스규칙','INTER_LOGS':'연동이력','SCHEDULER_JOBS':'스케줄러작업','SCHEDULER_LOGS':'스케줄러로그','SCHEDULER_NOTIFICATIONS':'스케줄러알림',
};

// domains JSON 생성
const domainsJson = domainDefs.map(d => {
  const tables = d.tables.map(tName => {
    const e = entityData[tName];
    if (!e) return null;
    // PK 컬럼을 cols에서 제거
    const pkSet = new Set(e.pk);
    const cols = e.cols.filter(c => !pkSet.has(c.name));
    return { n: tName, k: korNames[tName] || tName, pk: e.pk, cols };
  }).filter(Boolean);
  return { id: d.id, name: d.name, color: d.color, tables };
});

// 전체 관계 (모든 도메인 합산)
const allRels = [];
Object.values(domainRels).forEach(rels => rels.forEach(r => allRels.push(r)));
// cross-domain 관계 추가
allRels.push(
  {from:'PURCHASE_ORDER_ITEMS',to:'ITEM_MASTERS',label:'N:1'},
  {from:'PURCHASE_ORDERS',to:'PARTNER_MASTERS',label:'N:1'},
  {from:'MAT_ARRIVALS',to:'PURCHASE_ORDERS',label:'N:1'},
  {from:'MAT_ARRIVALS',to:'ITEM_MASTERS',label:'N:1'},
  {from:'MAT_LOTS',to:'ITEM_MASTERS',label:'N:1'},
  {from:'MAT_STOCKS',to:'WAREHOUSES',label:'N:1'},
  {from:'MAT_ISSUES',to:'JOB_ORDERS',label:'N:1'},
  {from:'MAT_ISSUE_REQUESTS',to:'JOB_ORDERS',label:'N:1'},
  {from:'IQC_LOGS',to:'MAT_LOTS',label:'N:1'},
  {from:'INSPECT_RESULTS',to:'JOB_ORDERS',label:'N:1'},
  {from:'SAMPLE_INSPECT_RESULTS',to:'JOB_ORDERS',label:'N:1'},
  {from:'DEFECT_LOGS',to:'ITEM_MASTERS',label:'N:1'},
  {from:'SPC_CHARTS',to:'ITEM_MASTERS',label:'N:1'},
  {from:'SPC_CHARTS',to:'PROCESS_MASTERS',label:'N:1'},
  {from:'JOB_ORDERS',to:'ITEM_MASTERS',label:'N:1'},
  {from:'PRODUCT_STOCKS',to:'WAREHOUSES',label:'N:1'},
  {from:'CUSTOMER_ORDERS',to:'PARTNER_MASTERS',label:'N:1'},
  {from:'CONSUMABLE_MOUNT_LOGS',to:'EQUIP_MASTERS',label:'N:1'},
  {from:'SUBCON_ORDERS',to:'VENDOR_MASTERS',label:'N:1'},
);

const totalTables = domainsJson.reduce((s,d) => s + d.tables.length, 0);
const totalCols = domainsJson.reduce((s,d) => s + d.tables.reduce((s2,t) => s2 + t.pk.length + t.cols.length, 0), 0);

// deduplicate rels
const relKey = r => r.from+'→'+r.to;
const relSet = new Set();
const uniqueRels = allRels.filter(r => { const k=relKey(r); if(relSet.has(k))return false; relSet.add(k); return true; });

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HARNESS MES - ERD</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:#0f172a;color:#e2e8f0;overflow:hidden}
.header{background:#1e293b;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #334155;position:fixed;top:0;left:0;right:0;z-index:100;height:44px}
.header h1{font-size:16px;color:#60a5fa}
.header .info{font-size:12px;color:#94a3b8}
.canvas{position:fixed;left:0;top:44px;right:0;bottom:0;overflow:hidden;background:#0f172a;cursor:grab}
.canvas.grabbing{cursor:grabbing}
.controls{position:fixed;bottom:16px;right:16px;display:flex;gap:6px;z-index:100}
.controls button{width:36px;height:36px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.controls button:hover{background:#334155}
.legend{position:fixed;bottom:16px;left:16px;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:8px 12px;z-index:100;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;color:#94a3b8;max-width:calc(100% - 100px)}
.legend span{display:flex;align-items:center;gap:5px}
.legend .d{width:12px;height:12px;border-radius:3px}
</style>
</head>
<body>
<div class="header">
  <h1>HARNESS MES - ERD (${totalTables} Tables / ${domainsJson.length} Domains)</h1>
  <div class="info">${totalCols}개 컬럼 / ${uniqueRels.length}개 관계 / 드래그: 엔티티 이동, 휠: 줌, 캔버스 드래그: 팬</div>
</div>
<div class="canvas" id="cv"><svg id="svg" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;position:absolute;top:0;left:0;right:0;bottom:0"><defs><marker id="ah" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#64748b"/></marker></defs><g id="g"></g></svg></div>
<div class="controls">
  <button onclick="zm(1.3)" title="Zoom In">+</button>
  <button onclick="zm(0.7)" title="Zoom Out">\u2212</button>
  <button onclick="rst()" title="Reset">\u21BB</button>
  <button onclick="fit()" title="Fit All">[ ]</button>
</div>
<div class="legend">${domainsJson.map(d=>`<span><span class="d" style="background:${d.color}"></span>${d.name}(${d.tables.length})</span>`).join('')}</div>

<script>
const D=${JSON.stringify(domainsJson)};
const R=${JSON.stringify(uniqueRels)};
let sc=0.25,px=0,py=0,drag=null,doff={x:0,y:0},pan=false,ps={x:0,y:0},pos={};
const W=320,HDR=34,ROW=16,PAD=4,GPAD=30,GCOLS=5;
const NS='http://www.w3.org/2000/svg';
const allTbls={};
D.forEach(d=>d.tables.forEach(t=>{allTbls[t.n]=t;allTbls[t.n]._color=d.color}));
function tH(t){return HDR+(t.pk.length+t.cols.length)*ROW+PAD*2}

// layout: 도메인을 5열 그리드로 배치, 각 도메인 내부에 엔티티 배치
function layoutAll(){
  let gx=40,gy=40,rowMaxH=0,colIdx=0;
  const domBounds={};
  D.forEach(d=>{
    const cols=Math.min(Math.ceil(Math.sqrt(d.tables.length)),4);
    // 도메인 내 엔티티 배치
    let dx=GPAD,dy=GPAD+30; // 30 for domain title
    let rowH=0,maxW=0,ci2=0;
    d.tables.forEach((t,i)=>{
      const h=tH(t);
      pos[t.n]={x:gx+dx,y:gy+dy};
      dx+=W+20;ci2++;
      rowH=Math.max(rowH,h);
      if(ci2>=cols){ci2=0;dx=GPAD;dy+=rowH+16;rowH=0;}
      maxW=Math.max(maxW,dx);
    });
    if(ci2>0)dy+=rowH+16;
    const domW=Math.max(maxW+GPAD,cols*(W+20)+GPAD*2);
    const domH=dy+GPAD;
    domBounds[d.id]={x:gx,y:gy,w:domW,h:domH,name:d.name,color:d.color};
    colIdx++;
    gx+=domW+30;
    rowMaxH=Math.max(rowMaxH,domH);
    if(colIdx>=GCOLS){colIdx=0;gx=40;gy+=rowMaxH+30;rowMaxH=0;}
  });
  return domBounds;
}

function drawRel(g,rel){
  const fp=pos[rel.from],tp=pos[rel.to];
  if(!fp||!tp)return;
  const ft=allTbls[rel.from],tt=allTbls[rel.to];
  if(!ft||!tt)return;
  const fH=tH(ft),tHt=tH(tt);
  let x1=fp.x+W/2,y1=fp.y+fH/2,x2=tp.x+W/2,y2=tp.y+tHt/2;
  if(Math.abs(fp.x-tp.x)>Math.abs(fp.y-tp.y)){
    if(x1>x2){x1=fp.x;x2=tp.x+W}else{x1=fp.x+W;x2=tp.x}
    y1=fp.y+fH/2;y2=tp.y+tHt/2;
  }else{
    if(y1>y2){y1=fp.y;y2=tp.y+tHt}else{y1=fp.y+fH;y2=tp.y}
    x1=fp.x+W/2;x2=tp.x+W/2;
  }
  const mx=(x1+x2)/2,my=(y1+y2)/2;
  const isCross=ft._color!==tt._color;
  const path=document.createElementNS(NS,'path');
  path.setAttribute('d','M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2);
  path.setAttribute('stroke',isCross?'#f59e0b':'#475569');
  path.setAttribute('stroke-width',isCross?'2':'1.5');
  path.setAttribute('stroke-dasharray',isCross?'6,3':'');
  path.setAttribute('fill','none');path.setAttribute('marker-end','url(#ah)');
  path.classList.add('rel-path');g.appendChild(path);
  const lbl=document.createElementNS(NS,'text');
  lbl.setAttribute('x',mx);lbl.setAttribute('y',my-5);lbl.setAttribute('text-anchor','middle');
  lbl.setAttribute('fill',isCross?'#f59e0b':'#94a3b8');lbl.setAttribute('font-size','9');lbl.setAttribute('font-family','Arial');
  lbl.classList.add('rel-lbl');lbl.textContent=rel.label;g.appendChild(lbl);
}

function drawEntity(g,t,color){
  const p=pos[t.n];if(!p)return;
  const allRows=[...t.pk.map(pk=>({name:pk,isPk:true})),...t.cols.map(c=>({name:c.name,type:c.type,len:c.len,nl:c.null}))];
  const h=HDR+allRows.length*ROW+PAD*2;
  const eg=document.createElementNS(NS,'g');
  eg.setAttribute('data-t',t.n);eg.style.cursor='move';
  const r=document.createElementNS(NS,'rect');
  r.setAttribute('width',W);r.setAttribute('height',h);r.setAttribute('rx',5);
  r.setAttribute('fill','#1e293b');r.setAttribute('stroke',color);r.setAttribute('stroke-width','2');
  r.style.filter='drop-shadow(0 1px 3px rgba(0,0,0,.4))';eg.appendChild(r);
  const hr=document.createElementNS(NS,'rect');
  hr.setAttribute('width',W);hr.setAttribute('height',HDR);hr.setAttribute('rx',5);hr.setAttribute('fill',color);eg.appendChild(hr);
  const hrc=document.createElementNS(NS,'rect');
  hrc.setAttribute('y',HDR-5);hrc.setAttribute('width',W);hrc.setAttribute('height',5);hrc.setAttribute('fill',color);eg.appendChild(hrc);
  const tt2=document.createElementNS(NS,'text');
  tt2.setAttribute('x',8);tt2.setAttribute('y',14);tt2.setAttribute('fill','#fff');tt2.setAttribute('font-size','12');tt2.setAttribute('font-weight','700');tt2.setAttribute('font-family','Segoe UI,Arial');
  tt2.textContent=t.k;eg.appendChild(tt2);
  const st=document.createElementNS(NS,'text');
  st.setAttribute('x',8);st.setAttribute('y',28);st.setAttribute('fill','rgba(255,255,255,.6)');st.setAttribute('font-size','9');st.setAttribute('font-family','Consolas');
  st.textContent=t.n;eg.appendChild(st);
  allRows.forEach((col,ci3)=>{
    const y=HDR+PAD+ci3*ROW+11;
    if(ci3%2===0){const bg=document.createElementNS(NS,'rect');bg.setAttribute('x',1);bg.setAttribute('y',HDR+PAD+ci3*ROW);bg.setAttribute('width',W-2);bg.setAttribute('height',ROW);bg.setAttribute('fill','rgba(255,255,255,.03)');eg.appendChild(bg);}
    if(col.isPk){
      const pk=document.createElementNS(NS,'text');pk.setAttribute('x',6);pk.setAttribute('y',y);pk.setAttribute('fill','#fbbf24');pk.setAttribute('font-size','8');pk.setAttribute('font-weight','700');pk.setAttribute('font-family','Consolas');pk.textContent='PK';eg.appendChild(pk);
      const cn=document.createElementNS(NS,'text');cn.setAttribute('x',24);cn.setAttribute('y',y);cn.setAttribute('fill','#fbbf24');cn.setAttribute('font-size','10');cn.setAttribute('font-weight','600');cn.setAttribute('font-family','Consolas');cn.textContent=col.name;eg.appendChild(cn);
    }else{
      const cn=document.createElementNS(NS,'text');cn.setAttribute('x',8);cn.setAttribute('y',y);cn.setAttribute('fill','#cbd5e1');cn.setAttribute('font-size','10');cn.setAttribute('font-family','Consolas');cn.textContent=col.name;eg.appendChild(cn);
      const ts=col.type+(col.len&&col.len!=='-'?'('+col.len+')':'');
      const ct=document.createElementNS(NS,'text');ct.setAttribute('x',170);ct.setAttribute('y',y);ct.setAttribute('fill','#64748b');ct.setAttribute('font-size','9');ct.setAttribute('font-family','Consolas');ct.textContent=ts;eg.appendChild(ct);
      if(col.nl==='Y'){const nl=document.createElementNS(NS,'text');nl.setAttribute('x',W-16);nl.setAttribute('y',y);nl.setAttribute('fill','#475569');nl.setAttribute('font-size','8');nl.setAttribute('font-family','Consolas');nl.setAttribute('text-anchor','end');nl.textContent='NULL';eg.appendChild(nl);}
    }
  });
  eg.addEventListener('mousedown',(e)=>{if(e.button!==0)return;e.stopPropagation();drag=t.n;doff={x:e.clientX/sc-pos[t.n].x,y:e.clientY/sc-pos[t.n].y};});
  eg.setAttribute('transform','translate('+p.x+','+p.y+')');
  g.appendChild(eg);
}

function render(){
  const g=document.getElementById('g');g.innerHTML='';
  const domBounds=layoutAll();
  // 1. 도메인 그룹 박스
  Object.values(domBounds).forEach(db=>{
    const r=document.createElementNS(NS,'rect');
    r.setAttribute('x',db.x);r.setAttribute('y',db.y);r.setAttribute('width',db.w);r.setAttribute('height',db.h);
    r.setAttribute('rx',10);r.setAttribute('fill',db.color+'0D');r.setAttribute('stroke',db.color+'40');r.setAttribute('stroke-width','2');r.setAttribute('stroke-dasharray','8,4');
    g.appendChild(r);
    const t=document.createElementNS(NS,'text');
    t.setAttribute('x',db.x+12);t.setAttribute('y',db.y+20);t.setAttribute('fill',db.color);t.setAttribute('font-size','14');t.setAttribute('font-weight','700');t.setAttribute('font-family','Segoe UI,Arial');
    t.textContent=db.name;g.appendChild(t);
  });
  // 2. 관계선 (전체)
  R.forEach(rel=>drawRel(g,rel));
  // 3. 엔티티
  D.forEach(d=>d.tables.forEach(t=>drawEntity(g,t,d.color)));
  updG();
}

function updG(){document.getElementById('g').setAttribute('transform','translate('+px+','+py+') scale('+sc+')');}

function drawAllRels(){
  const g=document.getElementById('g');
  g.querySelectorAll('.rel-path,.rel-lbl').forEach(el=>el.remove());
  const firstEntity=g.querySelector('[data-t]');
  R.forEach(rel=>{
    const fp=pos[rel.from],tp=pos[rel.to];if(!fp||!tp)return;
    const ft=allTbls[rel.from],tt=allTbls[rel.to];if(!ft||!tt)return;
    const fH2=tH(ft),tH2=tH(tt);
    let x1=fp.x+W/2,y1=fp.y+fH2/2,x2=tp.x+W/2,y2=tp.y+tH2/2;
    if(Math.abs(fp.x-tp.x)>Math.abs(fp.y-tp.y)){if(x1>x2){x1=fp.x;x2=tp.x+W}else{x1=fp.x+W;x2=tp.x}y1=fp.y+fH2/2;y2=tp.y+tH2/2;}
    else{if(y1>y2){y1=fp.y;y2=tp.y+tH2}else{y1=fp.y+fH2;y2=tp.y}x1=fp.x+W/2;x2=tp.x+W/2;}
    const mx=(x1+x2)/2,my=(y1+y2)/2;
    const isCross=ft._color!==tt._color;
    const path=document.createElementNS(NS,'path');
    path.setAttribute('d','M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2);
    path.setAttribute('stroke',isCross?'#f59e0b':'#475569');path.setAttribute('stroke-width',isCross?'2':'1.5');
    path.setAttribute('stroke-dasharray',isCross?'6,3':'');path.setAttribute('fill','none');path.setAttribute('marker-end','url(#ah)');
    path.classList.add('rel-path');
    if(firstEntity)g.insertBefore(path,firstEntity);else g.appendChild(path);
    const lbl=document.createElementNS(NS,'text');
    lbl.setAttribute('x',mx);lbl.setAttribute('y',my-5);lbl.setAttribute('text-anchor','middle');
    lbl.setAttribute('fill',isCross?'#f59e0b':'#94a3b8');lbl.setAttribute('font-size','9');lbl.setAttribute('font-family','Arial');
    lbl.classList.add('rel-lbl');lbl.textContent=rel.label;
    if(firstEntity)g.insertBefore(lbl,firstEntity);else g.appendChild(lbl);
  });
}

const cv=document.getElementById('cv');
cv.addEventListener('mousemove',(e)=>{
  if(drag){
    pos[drag]={x:(e.clientX-px)/sc-doff.x+px/sc,y:(e.clientY-py)/sc-doff.y+py/sc};
    const el=document.querySelector('[data-t="'+drag+'"]');
    if(el)el.setAttribute('transform','translate('+pos[drag].x+','+pos[drag].y+')');
    drawAllRels();
  }else if(pan){
    px+=e.clientX-ps.x;py+=e.clientY-ps.y;ps={x:e.clientX,y:e.clientY};updG();
  }
});
cv.addEventListener('mouseup',()=>{drag=null;pan=false;cv.classList.remove('grabbing')});
cv.addEventListener('mouseleave',()=>{drag=null;pan=false;cv.classList.remove('grabbing')});
cv.addEventListener('mousedown',(e)=>{if(!drag){pan=true;ps={x:e.clientX,y:e.clientY};cv.classList.add('grabbing')}});
cv.addEventListener('wheel',(e)=>{e.preventDefault();const d2=e.deltaY>0?0.9:1.1;sc=Math.max(0.1,Math.min(5,sc*d2));updG();});

function zm(f){sc=Math.max(0.1,Math.min(5,sc*f));updG();}
function rst(){sc=0.25;px=0;py=0;updG();}
function fit(){sc=0.15;px=50;py=50;updG();}

render();
</script>
</body>
</html>`;

fs.writeFileSync('exports/system/ERD_2026-03-18.html', html);
console.log(`Generated: ERD_2026-03-18.html (${totalTables} tables, ${totalCols} columns)`);
