import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getText, type QualityPlanPrintModel } from '../controlPlanPrintModel';
import { addPageFooters, drawFormTitle, drawInfoGrid, loadNotoSansKrFont, padTableRows } from './pdfBase';

export async function createRevisionHistoryPdf(model: QualityPlanPrintModel) {
  const controlPlanRevisions=model.revisions.filter((row)=>getText(row,'DOCUMENT_TYPE')==='CONTROL_PLAN');
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}); await loadNotoSansKrFont(doc); const width=doc.internal.pageSize.getWidth(); const revision=getText(controlPlanRevisions[0],'REVISION_CODE') || '00';
  const decorate=()=>{drawFormTitle(doc,'CONTROL PLAN 이력','[첨부 4] Control Plan(이력)',width);drawInfoGrid(doc,[['Document No.',getText(model.documents.find((row)=>getText(row,'DOCUMENT_TYPE')==='CONTROL_PLAN'),'DOCUMENT_NO'),'Project Name',getText(model.package,'PROJECT_NAME')],['Part No.',getText(model.package,'ITEM_CODE'),'Part Name',getText(model.package,'ITEM_NAME')]],width,15,6);};
  decorate();
  autoTable(doc,{startY:28,theme:'grid',styles:{font:'NotoSansKR',fontStyle:'normal',fontSize:7,cellPadding:2,lineColor:[75,75,75],lineWidth:0.15,minCellHeight:7.5},headStyles:{font:'NotoSansKR',fontStyle:'normal',fillColor:[242,242,242],textColor:20},head:[['No.','REV No.','제·개정 내용','개정일자','담당자']],body:padTableRows(controlPlanRevisions.map((row,index)=>[String(index+1),getText(row,'REVISION_CODE'),getText(row,'CHANGE_REASON'),getText(row,'REVISION_DATE'),getText(row,'AUTHOR_ID')]),5,30),margin:{left:8,right:8,top:28,bottom:10},didDrawPage:decorate}); addPageFooters(doc,'QREKA-PR-025-03',revision,'A4(210mm ×297mm)'); return doc;
}
