import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { documentHeader, getText, type QualityPlanPrintModel } from '../controlPlanPrintModel';

type Merge = { s: { r: number; c: number }; e: { r: number; c: number } };

type DocumentHeader = ReturnType<typeof documentHeader>;

const formSheet = (title: string, metadata: DocumentHeader, coreTeam: string, headerRows: string[][], body: string[][], headerMerges: Merge[]) => {
  const columnCount = headerRows[0]?.length ?? 1;
  const split = Math.max(2, Math.floor(columnCount / 2));
  const metadataRows = [
    ['문서번호', metadata.documentNo, 'REV', metadata.revision],
    ['품목', [metadata.itemCode, metadata.itemName].filter(Boolean).join(' / '), '프로젝트', metadata.project],
    ['고객', metadata.customer, '작성일', metadata.issueDate],
    ['핵심담당/CFT', coreTeam, '단계', metadata.phase],
  ].map(([leftLabel, leftValue, rightLabel, rightValue]) => {
    const row = Array.from({ length: columnCount }, () => '');
    row[0] = leftLabel; row[1] = leftValue; row[split] = rightLabel; row[split + 1] = rightValue;
    return row;
  });
  const headerStart = 1 + metadataRows.length;
  const ws = XLSX.utils.aoa_to_sheet([[title], ...metadataRows, ...headerRows, ...body]);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
    ...metadataRows.flatMap((_, index) => [
      { s: { r: index + 1, c: 1 }, e: { r: index + 1, c: split - 1 } },
      { s: { r: index + 1, c: split + 1 }, e: { r: index + 1, c: columnCount - 1 } },
    ]),
    ...headerMerges.map((merge) => ({
      s: { r: merge.s.r + headerStart, c: merge.s.c },
      e: { r: merge.e.r + headerStart, c: merge.e.c },
    })),
  ];
  ws['!cols'] = Array.from({ length: columnCount }, (_, column) => {
    const width = Math.max(...headerRows.map((row) => row[column]?.length ?? 0), 3);
    return { wch: Math.max(8, Math.min(28, width * 1.6 + 3)) };
  });
  ws['!margins'] = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
  const lastHeaderRow = headerStart + headerRows.length - 1;
  const lastRow = Math.max(lastHeaderRow + body.length, lastHeaderRow);
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: lastHeaderRow, c: 0 }, e: { r: lastRow, c: columnCount - 1 } }) };
  ws['!printArea'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: columnCount - 1 } });
  return ws;
};

export function createQualityPlanWorkbook(model: QualityPlanPrintModel) {
  const wb = XLSX.utils.book_new();
  const coreTeam = model.participants.map((row) => [getText(row,'ORGANIZATION'),getText(row,'USER_NAME')].filter(Boolean).join(' ')).filter(Boolean).join(', ');
  const pfdSymbols:Record<string,string>={OPERATION:'○',INSPECTION:'□',TRANSPORT:'→',STORAGE:'▽',DELAY:'D',REWORK:'↺',QUARANTINE:'◇',SHIPPING:'→'};
  const pfdBody=model.pfdRows.map((row)=>{const lane=getText(row,'FLOW_LANE');const symbol=pfdSymbols[getText(row,'FLOW_SYMBOL')]??'○';return [getText(row,'ROW_SEQ'),lane==='SUB'?symbol:'',lane==='MAIN'?symbol:'',lane==='OUTSOURCING'?symbol:'',getText(row,'PROCESS_NAME'),getText(row,'PRODUCT_SPECIAL_CHAR'),'',getText(row,'PROCESS_SPECIAL_CHAR'),'',getText(row,'DESCRIPTION')];});
  const pfdHeaders = [
    ['No.','Process flow','','','Process Name','Special Characteristics','Product Characteristics','Special Characteristics','Process Characteristics','Note'],
    ['','Sub','Main','Out Sourcing','','','','','',''],
  ];
  const pfdMerges: Merge[] = [
    { s:{r:0,c:0},e:{r:1,c:0} }, { s:{r:0,c:1},e:{r:0,c:3} },
    ...[4,5,6,7,8,9].map((column)=>({ s:{r:0,c:column},e:{r:1,c:column} })),
  ];
  XLSX.utils.book_append_sheet(wb,formSheet('PROCESS FLOW DIAGRAM',documentHeader(model,'PFD'),coreTeam,pfdHeaders,pfdBody,pfdMerges),'PFD');
  const pfmeaKeys=['ROW_SEQ','PROCESS_FUNCTION','REQUIREMENT','FAILURE_MODE','FAILURE_EFFECT','SEVERITY','SPECIAL_CHAR_CODE','FAILURE_CAUSE','PREVENTION_CONTROL','OCCURRENCE','DETECTION_CONTROL','DETECTION','RPN','RECOMMENDED_ACTION','RESPONSIBLE_ORG','RESPONSIBLE_PERSON','TARGET_DATE','COMPLETED_ACTION','COMPLETION_DATE','ACTION_SEVERITY','ACTION_OCCURRENCE','ACTION_DETECTION','ACTION_RPN'];
  const pfmeaHeaders = [
    ['Process Step / Function','','','Potential Failure Analysis','','','','Current Process','','','','','','Recommended Action','','','','Action Results','','','','',''],
    ['No.','Function','Requirement','Potential Failure Mode','Potential Effect(s)','Severity','Classification','Potential Cause(s)','Controls Prevention','Occurrence','Controls Detection','Detection','RPN','Recommended Action','Organization','Responsibility','Target Date','Action Taken','Completion Date','S','O','D','RPN'],
  ];
  const pfmeaMerges: Merge[] = [
    {s:{r:0,c:0},e:{r:0,c:2}}, {s:{r:0,c:3},e:{r:0,c:6}}, {s:{r:0,c:7},e:{r:0,c:12}},
    {s:{r:0,c:13},e:{r:0,c:16}}, {s:{r:0,c:17},e:{r:0,c:22}},
  ];
  XLSX.utils.book_append_sheet(wb,formSheet('PROCESS FMEA',documentHeader(model,'PFMEA'),coreTeam,pfmeaHeaders,model.pfmeaRows.map((row)=>pfmeaKeys.map((key)=>getText(row,key))),pfmeaMerges),'PFMEA');
  const controlPlanBody=model.controlPlanRows.map((row)=>{const lane=getText(row,'FLOW_LANE');return [getText(row,'PROCESS_NO'),lane==='SUB'?'●':'',lane==='MAIN'?'●':'',lane==='OUTSOURCING'?'●':'',getText(row,'PROCESS_NAME'),getText(row,'EQUIPMENT_NAME'),getText(row,'CHARACTERISTIC_NO'),getText(row,'PRODUCT_CHARACTERISTIC'),getText(row,'PROCESS_CHARACTERISTIC'),getText(row,'SPECIAL_CHAR_CODE'),getText(row,'SPECIFICATION'),getText(row,'EVALUATION_METHOD'),getText(row,'SAMPLE_SIZE'),getText(row,'SAMPLE_FREQUENCY'),getText(row,'CONTROL_METHOD'),getText(row,'RESPONSIBLE_ROLE'),getText(row,'REACTION_PLAN'),getText(row,'RECORD_FORM')];});
  const controlPlanHeaders = [
    ['Process flow','','','','Process','','Control Characteristics','','','','Method','','','','','Reaction Plan','','Document'],
    ['Process No.','Sub','Main','Out Sourcing','Process Name','Machines/Jigs/Fixtures/Tools','No.','Product','Process','Special Characteristics','Specification / Tolerance','Evaluation Measurement Technique','Sample Size','Freq.','Control Method (Error Proofing)','Contact','Corrective Action',''],
  ];
  const controlPlanMerges: Merge[] = [
    {s:{r:0,c:0},e:{r:0,c:3}}, {s:{r:0,c:4},e:{r:0,c:5}}, {s:{r:0,c:6},e:{r:0,c:9}},
    {s:{r:0,c:10},e:{r:0,c:14}}, {s:{r:0,c:15},e:{r:0,c:16}}, {s:{r:0,c:17},e:{r:1,c:17}},
  ];
  XLSX.utils.book_append_sheet(wb,formSheet('CONTROL PLAN',documentHeader(model,'CONTROL_PLAN'),coreTeam,controlPlanHeaders,controlPlanBody,controlPlanMerges),'Control Plan');
  const controlPlanRevisions=model.revisions.filter((row)=>getText(row,'DOCUMENT_TYPE')==='CONTROL_PLAN');
  const historyBody=controlPlanRevisions.map((row,index)=>[String(index+1),getText(row,'REVISION_CODE'),getText(row,'CHANGE_REASON'),getText(row,'REVISION_DATE'),getText(row,'AUTHOR_ID')]);
  XLSX.utils.book_append_sheet(wb,formSheet('CONTROL PLAN 이력',documentHeader(model,'CONTROL_PLAN'),coreTeam,[['No.','REV No.','제·개정 내용','개정일자','담당자']],historyBody,[]),'Revision History');
  wb.Workbook ??= {};
  wb.Workbook.Names = wb.SheetNames.map((name,index)=>{const ref=wb.Sheets[name]['!ref']??'A1:A1';const absolute=ref.split(':').map((cell)=>cell.replace(/^([A-Z]+)(\d+)$/,'$$$1$$$2')).join(':');return { Name:'_xlnm.Print_Area', Sheet:index, Ref:`'${name.replace(/'/g,"''")}'!${absolute}` };});
  return wb;
}

const printSetups = [
  { sheet: 1, orientation: 'landscape', paperSize: 9 },
  { sheet: 2, orientation: 'landscape', paperSize: 8 },
  { sheet: 3, orientation: 'landscape', paperSize: 8 },
  { sheet: 4, orientation: 'portrait', paperSize: 9 },
] as const;

export async function createQualityPlanWorkbookBytes(model: QualityPlanPrintModel): Promise<Uint8Array> {
  const raw = XLSX.write(createQualityPlanWorkbook(model), { bookType: 'xlsx', type: 'array', compression: true });
  const zip = await JSZip.loadAsync(raw);
  for (const setup of printSetups) {
    const path = `xl/worksheets/sheet${setup.sheet}.xml`;
    const entry = zip.file(path);
    if (!entry) throw new Error(`Excel worksheet를 찾을 수 없습니다: ${path}`);
    let xml = await entry.async('string');
    xml = xml.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    xml = xml.replace(
      '</worksheet>',
      `<pageSetup paperSize="${setup.paperSize}" orientation="${setup.orientation}" fitToWidth="1" fitToHeight="0"/></worksheet>`,
    );
    zip.file(path, xml);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function downloadQualityPlanWorkbook(model: QualityPlanPrintModel, fileName: string) {
  const bytes = await createQualityPlanWorkbookBytes(model);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
