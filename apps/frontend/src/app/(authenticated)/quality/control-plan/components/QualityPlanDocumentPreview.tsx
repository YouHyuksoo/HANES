'use client';

import { useState, type ReactNode } from 'react';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui';
import Modal from '@/components/ui/Modal';
import { documentHeader, getText, type QualityPlanPrintModel } from '../print/controlPlanPrintModel';
import ControlPlanDocumentPreview from './ControlPlanDocumentPreview';

export type PreviewDocumentType = 'PFD' | 'PFMEA' | 'HISTORY' | 'CONTROL_PLAN';
const previewTitles: Record<PreviewDocumentType, string> = { PFD: 'PFD', PFMEA: 'PFMEA', HISTORY: 'Revision History', CONTROL_PLAN: 'Control Plan' };
const cell = 'border border-black px-1.5 py-1 align-middle';
const head = `${cell} bg-[#f2f2f2] text-center font-medium`;
const symbols: Record<string, string> = { OPERATION: '○', INSPECTION: '□', TRANSPORT: '→', STORAGE: '▽', DELAY: 'D', REWORK: '↺', QUARANTINE: '◇', SHIPPING: '→' };

function Shell({ label, width, aspect, children }: { label: string; width: number; aspect: string; children: ReactNode }) {
  return <div className="h-[320px] w-full max-w-full overflow-scroll [scrollbar-gutter:stable_both-edges]"><article aria-label={label} className="border border-slate-300 bg-white p-6 text-black shadow-sm" style={{ minWidth: width, aspectRatio: aspect }}>{children}</article></div>;
}

function Header({ model, type, title }: { model: QualityPlanPrintModel; type: 'PFD' | 'PFMEA'; title: string }) {
  const value = documentHeader(model, type);
  return <><h3 className="mb-3 text-center text-lg font-medium tracking-[0.04em]">{title}</h3><table className="mb-0 w-full table-fixed border-collapse text-[10px]"><tbody><tr><td className={head}>Document No.</td><td className={cell}>{value.documentNo || '-'}</td><td className={head}>Project Name</td><td className={cell}>{value.project || '-'}</td><td className={head}>Prepared by/Date</td><td className={cell}>{value.author || '-'} / {value.issueDate?.slice(0,10) || '-'}</td></tr><tr><td className={head}>Issue Date</td><td className={cell}>{value.issueDate?.slice(0,10) || '-'}</td><td className={head}>Part No.</td><td className={cell}>{getText(model.package,'PART_NUMBER') || value.itemCode}</td><td className={head}>REV.</td><td className={cell}>{value.revision}</td></tr><tr><td className={head}>Customer</td><td className={cell}>{value.customer || '-'}</td><td className={head}>Part Name</td><td className={cell}>{value.itemName || '-'}</td><td className={head}>Phase</td><td className={cell}>{value.phase || '-'}</td></tr></tbody></table></>;
}

function Footer({ formNo, meta }: { formNo: string; meta: string }) {
  return <footer className="mt-4 flex justify-between text-[10px]"><span>{formNo} REV.00 기반 HANES 전산양식</span><strong>1 / 1</strong><span>{meta}</span></footer>;
}

function PfdPreview({ model }: { model: QualityPlanPrintModel }) {
  return <Shell label="PFD A4 출력 미리보기" width={1100} aspect="297 / 210"><Header model={model} type="PFD" title="공정 흐름도 (Process Flow Diagram)"/><table className="w-full table-fixed border-collapse text-[10px]"><thead><tr><th className={head} rowSpan={2}>No.</th><th className={head} colSpan={3}>Process flow</th><th className={head} rowSpan={2}>Process Name</th><th className={head} rowSpan={2}>Special Characteristics</th><th className={head} rowSpan={2}>Product Characteristics</th><th className={head} rowSpan={2}>Special Characteristics</th><th className={head} rowSpan={2}>Process Characteristics</th><th className={head} rowSpan={2}>Note</th></tr><tr><th className={head}>Sub</th><th className={head}>Main</th><th className={head}>Out Sourcing</th></tr></thead><tbody>{model.pfdRows.map((row,index)=>{const lane=getText(row,'FLOW_LANE');const symbol=symbols[getText(row,'FLOW_SYMBOL')] || '○';return <tr className="h-10" key={getText(row,'ROW_ID')||index}><td className={cell}>{getText(row,'ROW_SEQ')}</td><td className={`${cell} text-center text-base`}>{lane==='SUB'?symbol:''}</td><td className={`${cell} text-center text-base`}>{lane==='MAIN'?symbol:''}</td><td className={`${cell} text-center text-base`}>{lane==='OUTSOURCING'?symbol:''}</td><td className={cell}>{getText(row,'PROCESS_NAME')}</td><td className={cell}>{getText(row,'PRODUCT_SPECIAL_CHAR')}</td><td className={cell}></td><td className={cell}>{getText(row,'PROCESS_SPECIAL_CHAR')}</td><td className={cell}></td><td className={cell}>{getText(row,'DESCRIPTION')}</td></tr>})}</tbody></table><Footer formNo="QREKA-PR-025-01" meta="A4 (297 mm × 210 mm)"/></Shell>;
}

const pfmeaKeys = ['ROW_SEQ','PROCESS_FUNCTION','REQUIREMENT','FAILURE_MODE','FAILURE_EFFECT','SEVERITY','SPECIAL_CHAR_CODE','FAILURE_CAUSE','PREVENTION_CONTROL','OCCURRENCE','DETECTION_CONTROL','DETECTION','RPN','RECOMMENDED_ACTION','RESPONSIBLE_ORG','RESPONSIBLE_PERSON','TARGET_DATE','COMPLETED_ACTION','COMPLETION_DATE','ACTION_SEVERITY','ACTION_OCCURRENCE','ACTION_DETECTION','ACTION_RPN'];
const pfmeaLabels = ['No.','Function','Requirement','Potential Failure Mode','Potential Effect(s)','Severity','Classification','Potential Cause(s)','Controls Prevention','Occurrence','Controls Detection','Detection','RPN','Recommended Action','Organization','Responsibility','Target Date','Action Taken','Completion Date','S','O','D','RPN'];
function PfmeaPreview({ model }: { model: QualityPlanPrintModel }) {
  return <Shell label="PFMEA A3 출력 미리보기" width={1700} aspect="420 / 297"><Header model={model} type="PFMEA" title="POTENTIAL FAILURE MODE AND EFFECTS ANALYSIS (PROCESS FMEA)"/><table className="w-full table-fixed border-collapse text-[9px] leading-tight"><thead><tr><th className={head} colSpan={3}>Process Step / Function</th><th className={head} colSpan={4}>Potential Failure Analysis</th><th className={head} colSpan={6}>Current Process</th><th className={head} colSpan={4}>Recommended Action</th><th className={head} colSpan={6}>Action Results</th></tr><tr>{pfmeaLabels.map((label,index)=><th className={head} key={index}>{label}</th>)}</tr></thead><tbody>{model.pfmeaRows.map((row,index)=><tr className="h-12" key={getText(row,'ROW_ID')||index}>{pfmeaKeys.map((key)=><td className={cell} key={key}>{getText(row,key)}</td>)}</tr>)}</tbody></table><Footer formNo="QREKA-PR-025-02" meta="A3 (420 mm × 297 mm)"/></Shell>;
}

function HistoryPreview({ model }: { model: QualityPlanPrintModel }) {
  const document=model.documents.find((row)=>getText(row,'DOCUMENT_TYPE')==='CONTROL_PLAN');
  const rows=model.revisions.filter((row)=>getText(row,'DOCUMENT_TYPE')==='CONTROL_PLAN');
  return <Shell label="개정이력 A4 출력 미리보기" width={850} aspect="210 / 297"><h3 className="mb-3 text-center text-lg font-medium tracking-[0.04em]">CONTROL PLAN 이력</h3><table className="w-full table-fixed border-collapse text-[10px]"><tbody><tr><td className={head}>Document No.</td><td className={cell}>{getText(document,'DOCUMENT_NO')}</td><td className={head}>Project Name</td><td className={cell}>{getText(model.package,'PROJECT_NAME')||'-'}</td></tr><tr><td className={head}>Part No.</td><td className={cell}>{getText(model.package,'PART_NUMBER')||getText(model.package,'ITEM_CODE')}</td><td className={head}>Part Name</td><td className={cell}>{getText(model.package,'ITEM_NAME')}</td></tr></tbody></table><table className="w-full table-fixed border-collapse text-[10px]"><thead><tr><th className={head}>No.</th><th className={head}>REV No.</th><th className={head}>제·개정 내용</th><th className={head}>개정일자</th><th className={head}>담당자</th></tr></thead><tbody>{rows.map((row,index)=><tr className="h-10" key={index}><td className={`${cell} text-center`}>{index+1}</td><td className={`${cell} text-center`}>{getText(row,'REVISION_CODE')}</td><td className={cell}>{getText(row,'CHANGE_REASON')||'최초 제정'}</td><td className={`${cell} text-center`}>{getText(row,'REVISION_DATE').slice(0,10)}</td><td className={`${cell} text-center`}>{getText(row,'AUTHOR_ID')}</td></tr>)}</tbody></table><p className="mt-3 text-[10px] text-slate-600">발행된 Revision은 변경할 수 없으며, 새 개정은 직전 발행본을 복제하여 작성합니다.</p><Footer formNo="QREKA-PR-025-03" meta="A4 (210 mm × 297 mm)"/></Shell>;
}

export default function QualityPlanDocumentPreview({ model, type, expanded = false }: { model: QualityPlanPrintModel; type: PreviewDocumentType; expanded?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const preview = type === 'PFD' ? <PfdPreview model={model}/> : type === 'PFMEA' ? <PfmeaPreview model={model}/> : type === 'HISTORY' ? <HistoryPreview model={model}/> : <ControlPlanDocumentPreview model={model}/>;
  if (expanded) return <div className="[&>div]:!h-[72vh]">{preview}</div>;
  return <><div className="mb-2 flex justify-end"><Button size="sm" variant="secondary" onClick={() => setIsExpanded(true)} aria-label="미리보기 크게 보기"><Maximize2 className="mr-1 h-3.5 w-3.5" />크게 보기</Button></div><div>{preview}</div><Modal isOpen={isExpanded} onClose={() => setIsExpanded(false)} title={`${previewTitles[type]} 크게 보기`} size="full"><div className="mb-3 text-xs text-text-muted">가로·세로 스크롤로 문서 전체를 확인할 수 있습니다.</div><QualityPlanDocumentPreview model={model} type={type} expanded /></Modal></>;
}
