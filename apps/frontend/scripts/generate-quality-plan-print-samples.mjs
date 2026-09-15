import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compiled = path.resolve(frontend, '.tmp-quality-plan-print');
const output = path.resolve(frontend, 'test-results', 'quality-plan-print');
const fontDir = path.resolve(frontend, 'public', 'fonts');

globalThis.fetch = async (url) => {
  const file = String(url).includes('Bold') ? 'NotoSansKR-Bold.ttf' : 'NotoSansKR-Regular.ttf';
  const data = await readFile(path.join(fontDir, file));
  return { arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
};

const require = createRequire(import.meta.url);
const pfd = require(path.join(compiled, 'pdf', 'processFlowPdf.js'));
const pfmea = require(path.join(compiled, 'pdf', 'pfmeaPdf.js'));
const cp = require(path.join(compiled, 'pdf', 'controlPlanPdf.js'));
const history = require(path.join(compiled, 'pdf', 'revisionHistoryPdf.js'));
const workbook = require(path.join(compiled, 'excel', 'qualityPlanWorkbook.js'));
const packageRow = { ITEM_CODE: 'SAMPLE-FG-001', ITEM_NAME: '샘플 와이어 하네스', PROJECT_NAME: 'QREKA 검증', CUSTOMER_NAME: 'N/A', PHASE: 'PRODUCTION' };
const documents = [['PFD','PFD-20260915-001','공정흐름도','QREKA-PR-025-01'],['PFMEA','PFMEA-20260915-001','공정 FMEA','QREKA-PR-025-02'],['CONTROL_PLAN','CP-20260915-001','관리계획서','QREKA-PR-025-04']].map(([DOCUMENT_TYPE,DOCUMENT_NO,TITLE,TEMPLATE_FORM_NO])=>({ ...packageRow,DOCUMENT_TYPE,DOCUMENT_NO,TITLE,TEMPLATE_FORM_NO,REVISION_CODE:'00',ISSUE_DATE:'2026-09-15',AUTHOR_ID:'tester',PUBLISHER_ID:'tester' }));
const model = {
  package: packageRow, documents,
  pfdRows: [{ ROW_SEQ:1,FLOW_LANE:'MAIN',FLOW_SYMBOL:'OPERATION',PROCESS_NO:'10',PROCESS_CODE:'CUT',PROCESS_NAME:'절단',EQUIPMENT_NAME:'자동 절단기',DESCRIPTION:'전선 절단' },{ ROW_SEQ:2,FLOW_LANE:'MAIN',FLOW_SYMBOL:'INSPECTION',PROCESS_NO:'20',PROCESS_CODE:'CRIMP',PROCESS_NAME:'압착',EQUIPMENT_NAME:'압착기',PRODUCT_SPECIAL_CHAR:'★',DESCRIPTION:'단자 압착' }],
  pfmeaRows: [{ ROW_SEQ:1,PROCESS_FUNCTION:'단자 압착',REQUIREMENT:'압착높이 규격 만족',FAILURE_MODE:'과소 압착',FAILURE_EFFECT:'접촉 저항 증가',SEVERITY:8,SPECIAL_CHAR_CODE:'SAFETY_REGULATORY',FAILURE_CAUSE:'금형 마모',PREVENTION_CONTROL:'금형 수명관리',OCCURRENCE:3,DETECTION_CONTROL:'초중종 측정',DETECTION:4,RPN:96,RECOMMENDED_ACTION:'금형 교체주기 단축',RESPONSIBLE_ORG:'생산기술' }],
  controlPlanRows: [{ ROW_SEQ:1,PROCESS_NO:'20',PROCESS_CODE:'CRIMP',FLOW_LANE:'MAIN',PROCESS_NAME:'압착',EQUIPMENT_CODE:'CRP-01',EQUIPMENT_NAME:'압착기',CHARACTERISTIC_NO:'CC-01',PRODUCT_CHARACTERISTIC:'압착 높이',PROCESS_CHARACTERISTIC:'압착 조건',SPECIAL_CHAR_CODE:'SAFETY_REGULATORY',SPECIFICATION:'1.20 ± 0.05 mm',EVALUATION_METHOD:'마이크로미터',SAMPLE_SIZE:'5EA',SAMPLE_FREQUENCY:'초/중/종',CONTROL_METHOD:'자주검사',RESPONSIBLE_ROLE:'작업자',REACTION_PLAN:'설비 정지 후 격리 및 재검',RECORD_FORM:'검사일보' }],
  revisions: documents.map((row)=>({ ...row,STATUS:'PUBLISHED',REVISION_DATE:'2026-09-15',CHANGE_REASON:'최초 제정' })),
  participants: [{ ROLE:'KEY_CONTACT', ORGANIZATION:'품질보증팀', USER_NAME:'홍길동' }],
};

await mkdir(output, { recursive: true });
const files = [['PFD-A4-landscape.pdf',await pfd.createProcessFlowPdf(model)],['PFMEA-A3-landscape.pdf',await pfmea.createPfmeaPdf(model)],['Revision-History-A4-portrait.pdf',await history.createRevisionHistoryPdf(model)],['Control-Plan-A3-landscape.pdf',await cp.createControlPlanPdf(model)]];
const repeat=(row,count)=>Array.from({length:count},(_,index)=>({...row,ROW_SEQ:index+1,REVISION_CODE:String(index).padStart(2,'0')}));
const multiModel={...model,pfdRows:repeat(model.pfdRows[0],30),pfmeaRows:repeat(model.pfmeaRows[0],30),controlPlanRows:repeat(model.controlPlanRows[0],30),revisions:repeat(documents.find((row)=>row.DOCUMENT_TYPE==='CONTROL_PLAN'),70).map((row,index)=>({...row,DOCUMENT_TYPE:'CONTROL_PLAN',STATUS:index===69?'PUBLISHED':'SUPERSEDED',REVISION_DATE:'2026-09-15',CHANGE_REASON:`개정 ${index}`}))};
const multipage=[['multipage/PFD.pdf',await pfd.createProcessFlowPdf(multiModel)],['multipage/PFMEA.pdf',await pfmea.createPfmeaPdf(multiModel)],['multipage/Revision-History.pdf',await history.createRevisionHistoryPdf(multiModel)],['multipage/Control-Plan.pdf',await cp.createControlPlanPdf(multiModel)]];
await mkdir(path.join(output,'multipage'),{recursive:true});
for (const [name, doc] of [...files,...multipage]) await writeFile(path.join(output, name), Buffer.from(doc.output('arraybuffer')));
await writeFile(path.join(output,'Quality-Plan.xlsx'),Buffer.from(await workbook.createQualityPlanWorkbookBytes(model)));
console.log(JSON.stringify({ output, files: [...files,...multipage].map(([name, doc]) => ({ name, pages: doc.getNumberOfPages() })) }));
