import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const root=new URL('.',import.meta.url); const read=(path)=>readFileSync(new URL(path,root),'utf8');

test('four official PDFs use CID Korean font and required paper orientations',()=>{
  const base=read('pdf/pdfBase.ts'); assert.match(base,/Identity-H/); assert.match(base,/NotoSansKR-Regular/);
  assert.match(read('pdf/processFlowPdf.ts'),/orientation: 'landscape'.*format: 'a4'/s);
  assert.match(read('pdf/pfmeaPdf.ts'),/orientation: 'landscape'.*format: 'a3'/s);
  assert.match(read('pdf/controlPlanPdf.ts'),/orientation:'landscape'.*format:'a3'/s);
  assert.match(read('pdf/revisionHistoryPdf.ts'),/orientation:'portrait'.*format:'a4'/s);
});

test('Control Plan has 18 physical columns and PFMEA maps procedure fields 7-29 to 23 rendered columns',()=>{
  const cp=read('pdf/controlPlanPdf.ts'); const pfmea=read('pdf/pfmeaPdf.ts');
  const columns=cp.match(/CONTROL_PLAN_PHYSICAL_COLUMNS = \[(.*?)\] as const/s)?.[1].match(/'[^']+'/g)??[];
  assert.equal(columns.length,18);
  assert.match(pfmea,/no:30, label:'비고', key:null, area:'instruction'/);
  assert.match(pfmea,/index \+ 7/);
  assert.match(pfmea,/PFMEA_NUMBERED_FIELDS\s*\.filter/);
  assert.match(pfmea,/PFMEA_PHYSICAL_COLUMNS\.map/);
  assert.match(pfmea,/getText\(row,'USER_NAME'\)/);
  assert.doesNotMatch(pfmea,/PARTICIPANT_NAME/);
});

test('workbook contains four named sheets and direct print uses PDF blob',()=>{
  const excel=read('excel/qualityPlanWorkbook.ts'); for(const name of ['PFD','PFMEA','Control Plan','Revision History']) assert.match(excel,new RegExp(`'${name.replace(' ','\\s')}'`));
  assert.match(excel,/_xlnm\.Print_Area/);
  assert.match(excel,/createQualityPlanWorkbookBytes/);
  assert.match(excel,/paperSize: 9/);
  assert.match(excel,/paperSize: 8/);
  assert.match(excel,/orientation: 'portrait'/);
  assert.match(excel,/Process Step \/ Function/);
  assert.match(excel,/Potential Failure Analysis/);
  assert.match(excel,/Control Characteristics/);
  assert.match(excel,/headerMerges/);
  for (const label of ['문서번호','품목','프로젝트','고객','작성일','핵심담당/CFT']) assert.match(excel,new RegExp(label));
  assert.doesNotMatch(read('../components/OutputCenterTab.tsx'),/html2canvas/);
  assert.match(read('../components/OutputCenterTab.tsx'),/recordOutputEvent/);
});
