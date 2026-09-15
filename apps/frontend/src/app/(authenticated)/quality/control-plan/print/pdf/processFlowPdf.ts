import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { documentHeader, getText, type QualityPlanPrintModel } from '../controlPlanPrintModel';
import { addPageFooters, drawFormTitle, drawInfoGrid, loadNotoSansKrFont, padTableRows } from './pdfBase';

export async function createProcessFlowPdf(model: QualityPlanPrintModel) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); await loadNotoSansKrFont(doc);
  const header = documentHeader(model, 'PFD'); const width=doc.internal.pageSize.getWidth();
  const decorate=()=>{ drawFormTitle(doc,'공정 흐름도(Process Flow Diagram)','[첨부 2] 공정 흐름도(PFD)',width); drawInfoGrid(doc,[['Document No.',header.documentNo,'Project Name',header.project,'Prepared by/Date',`${header.author || '-'} / ${header.issueDate || '-'}`],['Issue Date',header.issueDate,'Part No.',header.itemCode,'Verified by/Date','-'],['Customer',header.customer || 'N/A','Part Name',header.itemName,'Approved by/Date','-']],width); };
  decorate();
  const symbols:Record<string,string>={OPERATION:'○',INSPECTION:'□',TRANSPORT:'→',STORAGE:'▽',DELAY:'D',REWORK:'↺',QUARANTINE:'◇',SHIPPING:'→'};
  const rows=model.pfdRows.map((row) => { const lane=getText(row,'FLOW_LANE'); const symbol=symbols[getText(row,'FLOW_SYMBOL')]??'○'; return [getText(row,'ROW_SEQ'),lane==='SUB'?symbol:'',lane==='MAIN'?symbol:'',lane==='OUTSOURCING'?symbol:'',getText(row,'PROCESS_NAME'),getText(row,'PRODUCT_SPECIAL_CHAR'),'',getText(row,'PROCESS_SPECIAL_CHAR'),'',getText(row,'DESCRIPTION')]; });
  autoTable(doc, { startY: 31, theme: 'grid', styles: { font: 'NotoSansKR', fontStyle: 'normal', fontSize: 7, cellPadding: 1.4, lineColor: [75,75,75], lineWidth: 0.15, minCellHeight: 16 }, headStyles: { font: 'NotoSansKR', fontStyle: 'normal', fillColor: [242,242,242], textColor: 20 }, head: [[{content:'No.',rowSpan:2},{content:'Process flow',colSpan:3},{content:'Process Name',rowSpan:2},{content:'Special Characteristics',rowSpan:2},{content:'Product Characteristics',rowSpan:2},{content:'Special Characteristics',rowSpan:2},{content:'Process Characteristics',rowSpan:2},{content:'Note',rowSpan:2}],['Sub','Main','Out Sourcing']], body: padTableRows(rows,10,8), margin: { left: 8, right: 8, top: 31, bottom: 10 }, didDrawPage: decorate });
  addPageFooters(doc, 'QREKA-PR-025-01',header.revision,'A4(297mm ×210mm)'); return doc;
}
