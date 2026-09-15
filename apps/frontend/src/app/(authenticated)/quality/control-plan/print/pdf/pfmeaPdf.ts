import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { documentHeader, getText, type QualityPlanPrintModel } from '../controlPlanPrintModel';
import { addPageFooters, drawFormTitle, drawInfoGrid, loadNotoSansKrFont, padTableRows } from './pdfBase';

export const PFMEA_NUMBERED_FIELDS = [
  { no:1, label:'프로젝트', key:'PROJECT_NAME', area:'header' }, { no:2, label:'품목', key:'ITEM_CODE', area:'header' },
  { no:3, label:'문서번호', key:'DOCUMENT_NO', area:'header' }, { no:4, label:'REV', key:'REVISION_CODE', area:'header' },
  { no:5, label:'작성일', key:'ISSUE_DATE', area:'header' }, { no:6, label:'핵심담당', key:'CORE_TEAM', area:'header' },
  ...[
    ['공정번호','ROW_SEQ'],['공정기능','PROCESS_FUNCTION'],['요구사항','REQUIREMENT'],['잠재고장형태','FAILURE_MODE'],
    ['잠재영향','FAILURE_EFFECT'],['심각도','SEVERITY'],['특별특성','SPECIAL_CHAR_CODE'],['잠재원인','FAILURE_CAUSE'],
    ['예방관리','PREVENTION_CONTROL'],['발생도','OCCURRENCE'],['검출관리','DETECTION_CONTROL'],['검출도','DETECTION'],
    ['RPN','RPN'],['권고조치','RECOMMENDED_ACTION'],['책임조직','RESPONSIBLE_ORG'],['책임자','RESPONSIBLE_PERSON'],
    ['목표일','TARGET_DATE'],['완료조치','COMPLETED_ACTION'],['완료일','COMPLETION_DATE'],['조치S','ACTION_SEVERITY'],
    ['조치O','ACTION_OCCURRENCE'],['조치D','ACTION_DETECTION'],['조치RPN','ACTION_RPN'],
  ].map(([label,key], index) => ({ no:index + 7, label, key, area:'table' as const })),
  // 절차서의 30번 비고는 양식 표의 독립 물리 열이 아니라 작성 지침 항목이다.
  { no:30, label:'비고', key:null, area:'instruction' },
] as const;
export const PFMEA_PHYSICAL_COLUMNS = PFMEA_NUMBERED_FIELDS
  .filter((field): field is Extract<(typeof PFMEA_NUMBERED_FIELDS)[number], { area:'table' }> => field.area === 'table')
  .map((field) => field.key);

export async function createPfmeaPdf(model: QualityPlanPrintModel) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' }); await loadNotoSansKrFont(doc); const header=documentHeader(model,'PFMEA'); const width=doc.internal.pageSize.getWidth();
  const decorate=()=>{ drawFormTitle(doc,'POTENTIAL FAILURE MODE AND EFFECTS ANALYSIS (PROCESS FMEA)','[첨부 3] PFMEA',width); drawInfoGrid(doc,[['FMEA No.',header.documentNo,'Project Name',header.project,'Process Responsibility','-'],['Issue Date',header.issueDate,'Part No.',header.itemCode,'Key date','-'],['Revision Date',header.issueDate,'Part Name',header.itemName,'Prepared by',header.author || '-'],['Core Team',model.participants.map((row)=>[getText(row,'ORGANIZATION'),getText(row,'USER_NAME')].filter(Boolean).join(' ')).filter(Boolean).join(', '),'Revision',header.revision,'Phase',header.phase]],width,14,4.5); };
  decorate();
  autoTable(doc,{startY:34,theme:'grid',styles:{font:'NotoSansKR',fontStyle:'normal',fontSize:5.4,cellPadding:1,lineColor:[75,75,75],lineWidth:0.12,minCellHeight:19},headStyles:{font:'NotoSansKR',fontStyle:'normal',fillColor:[242,242,242],textColor:20},head:[[{content:'Process Step / Function',colSpan:3},{content:'Potential Failure Analysis',colSpan:4},{content:'Current Process',colSpan:6},{content:'Recommended Action',colSpan:4},{content:'Action Results',colSpan:6}],['No.','Function','Requirement','Potential Failure Mode','Potential Effect(s)','Severity','Classification','Potential Cause(s)','Controls Prevention','Occurrence','Controls Detection','Detection','RPN','Recommended Action','Organization','Responsibility','Target Date','Action Taken','Completion Date','S','O','D','RPN']],body:padTableRows(model.pfmeaRows.map((row)=>PFMEA_PHYSICAL_COLUMNS.map((key)=>getText(row,key))),23,11),margin:{left:7,right:7,top:34,bottom:10},didDrawPage:decorate});
  addPageFooters(doc,'QREKA-PR-025-02',header.revision,'A3(420mm×297mm)'); return doc;
}
