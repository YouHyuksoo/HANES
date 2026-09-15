'use client';

import { useEffect, useState } from 'react';
import { Eye, FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';
import type { jsPDF } from 'jspdf';
import { controlPlanApi, getControlPlanErrorMessage, type QualityPlanPackage } from '../controlPlanApi';
import { createProcessFlowPdf } from '../print/pdf/processFlowPdf';
import { createPfmeaPdf } from '../print/pdf/pfmeaPdf';
import { createControlPlanPdf } from '../print/pdf/controlPlanPdf';
import { createRevisionHistoryPdf } from '../print/pdf/revisionHistoryPdf';
import { downloadQualityPlanWorkbook } from '../print/excel/qualityPlanWorkbook';
import type { QualityPlanPrintModel } from '../print/controlPlanPrintModel';
import QualityPlanDocumentPreview from './QualityPlanDocumentPreview';

type OutputType = 'PFD' | 'PFMEA' | 'HISTORY' | 'CONTROL_PLAN';
const definitions: { type: OutputType; title: string; meta: string; formNo: string }[] = [
  { type: 'PFD', title: 'PFD', meta: 'A4 가로', formNo: 'QREKA-PR-025-01' },
  { type: 'PFMEA', title: 'PFMEA', meta: 'A3 가로', formNo: 'QREKA-PR-025-02' },
  { type: 'HISTORY', title: 'Revision History', meta: 'A4 세로', formNo: 'QREKA-PR-025-03' },
  { type: 'CONTROL_PLAN', title: 'Control Plan', meta: 'A3 가로', formNo: 'QREKA-PR-025-04' },
];

export default function OutputCenterTab({ pkg }: { pkg: QualityPlanPackage }) {
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<QualityPlanPrintModel | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewType, setPreviewType] = useState<OutputType>('CONTROL_PLAN');
  useEffect(() => {
    let active = true;
    setModel(null);
    setPreviewError('');
    controlPlanApi.getPrintModel(pkg.packageId)
      .then((value) => { if (active) setModel(value); })
      .catch((error) => { if (active) setPreviewError(getControlPlanErrorMessage(error, '발행본을 불러오지 못했습니다.')); });
    return () => { active = false; };
  }, [pkg.packageId]);
  const createPdf = async (type: OutputType) => {
    const model = await controlPlanApi.getPrintModel(pkg.packageId);
    if (type === 'PFD') return createProcessFlowPdf(model);
    if (type === 'PFMEA') return createPfmeaPdf(model);
    if (type === 'HISTORY') return createRevisionHistoryPdf(model);
    return createControlPlanPdf(model);
  };
  const withBusy = async (work: () => Promise<void>) => { setBusy(true); try { await work(); } catch (error) { toast.error(getControlPlanErrorMessage(error, '출력 생성에 실패했습니다.')); } finally { setBusy(false); } };
  const preview = (type: OutputType) => withBusy(async () => {
    setPreviewType(type);
    await controlPlanApi.recordOutputEvent(pkg.packageId,'PREVIEWED',type);
  });
  const download = (type: OutputType, formNo: string) => withBusy(async () => { const doc = await createPdf(type); doc.save(`${pkg.itemCode}_${formNo}.pdf`); await controlPlanApi.recordOutputEvent(pkg.packageId,'PDF_DOWNLOADED',type); });
  const print = (type: OutputType) => withBusy(async () => { const doc: jsPDF = await createPdf(type); const url = URL.createObjectURL(doc.output('blob')); const frame = document.createElement('iframe'); frame.style.position='fixed'; frame.style.right='0'; frame.style.bottom='0'; frame.style.width='1px'; frame.style.height='1px'; frame.src=url; frame.onload=()=>{ frame.contentWindow?.focus(); frame.contentWindow?.print(); window.setTimeout(()=>{ URL.revokeObjectURL(url); frame.remove(); },30_000); }; document.body.appendChild(frame); await controlPlanApi.recordOutputEvent(pkg.packageId,'PRINTED',type); });
  const excel = () => withBusy(async () => { const model = await controlPlanApi.getPrintModel(pkg.packageId); await downloadQualityPlanWorkbook(model, `${pkg.itemCode}_QualityPlan`); await controlPlanApi.recordOutputEvent(pkg.packageId,'EXCEL_DOWNLOADED','WORKBOOK'); });
  const selectedDefinition = definitions.find((item) => item.type === previewType) ?? definitions[3];
  return <div className="h-full min-h-0 min-w-0 w-full space-y-4 overflow-auto overscroll-contain pb-4 pr-1"><section className="min-w-0 rounded-lg border border-border bg-surface p-4"><div className="mb-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">{selectedDefinition.meta}</span><strong className="text-text">{selectedDefinition.formNo} 형식</strong><span className="text-text-muted">이 화면 안에서 문서를 미리보고 스크롤할 수 있습니다.</span></div>{model ? <QualityPlanDocumentPreview model={model} type={previewType} /> : <div className="flex h-[320px] items-center justify-center rounded-md border border-dashed border-border bg-background text-sm text-text-muted">{previewError || '발행된 문서를 불러오는 중…'}</div>}</section><div className="grid gap-4 xl:grid-cols-[1fr_320px]"><div className="rounded-lg border border-border bg-surface p-5"><div className="text-xs font-bold uppercase tracking-widest text-primary">Official forms</div><h2 className="mt-1 text-lg font-bold text-text">QREKA-PR-025 출력 세트</h2><p className="mt-2 text-sm text-text-muted">발행된 Revision snapshot만 출력합니다. 결재란은 제외 요청에 따라 Verified/Approved '-'로 표기합니다.</p><div className="mt-5 space-y-2">{definitions.map((item) => <div key={item.type} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2"><FileDown className="h-4 w-4 text-primary" /><span className="min-w-32 font-semibold text-text">{item.title}</span><span className="mr-auto text-xs text-text-muted">{item.meta} · {item.formNo}</span><Button size="sm" variant="secondary" disabled={busy} onClick={() => void preview(item.type)}><Eye className="mr-1 h-3.5 w-3.5" />미리보기</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void download(item.type,item.formNo)}><FileDown className="mr-1 h-3.5 w-3.5" />PDF</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void print(item.type)}><Printer className="mr-1 h-3.5 w-3.5" />인쇄</Button></div>)}</div></div><div className="rounded-lg border border-border bg-surface p-5"><h3 className="font-bold text-text">통합 Excel</h3><p className="mt-2 text-sm leading-6 text-text-muted">PFD, PFMEA, Control Plan, Revision History 4개 Sheet와 인쇄방향·열너비·병합 제목을 포함합니다.</p><Button className="mt-5 w-full" disabled={busy} onClick={() => void excel()}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel 다운로드</Button>{busy && <p className="mt-3 text-center text-xs text-primary">한글 폰트와 문서 데이터를 구성하는 중…</p>}</div></div></div>;
}
