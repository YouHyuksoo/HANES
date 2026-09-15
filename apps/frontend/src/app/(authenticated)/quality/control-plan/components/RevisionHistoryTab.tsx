'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, ComCodeBadge } from '@/components/ui';
import { controlPlanApi, type DocumentType, type QualityPlanEvent, type QualityPlanPackage, type RevisionCompareResult } from '../controlPlanApi';

export default function RevisionHistoryTab({ pkg }: { pkg: QualityPlanPackage }) {
  const rows = pkg.documents.flatMap((document) => document.revisions.map((revision) => ({ ...revision, documentType: document.documentType, documentNo: document.documentNo })));
  const [documentType, setDocumentType] = useState<DocumentType>('CONTROL_PLAN');
  const [leftId, setLeftId] = useState(0);
  const [rightId, setRightId] = useState(0);
  const [result, setResult] = useState<RevisionCompareResult | null>(null);
  const [events, setEvents] = useState<QualityPlanEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const revisions = useMemo(() => pkg.documents.find((item) => item.documentType === documentType)?.revisions ?? [], [pkg.documents, documentType]);

  useEffect(() => {
    setLeftId(revisions[1]?.revisionId ?? revisions[0]?.revisionId ?? 0);
    setRightId(revisions[0]?.revisionId ?? 0);
    setResult(null);
  }, [revisions]);
  useEffect(() => {
    controlPlanApi.listEvents(pkg.packageId).then(setEvents).catch(() => toast.error('감사 이력을 불러오지 못했습니다.'));
  }, [pkg.packageId]);

  const compare = async () => {
    if (!leftId || !rightId || leftId === rightId) return;
    setBusy(true);
    try { setResult(await controlPlanApi.compareRevisions(leftId, rightId)); }
    catch { toast.error('Revision 비교에 실패했습니다.'); }
    finally { setBusy(false); }
  };

  return <div className="flex min-h-0 flex-col gap-4 overflow-auto">
    <div className="overflow-auto rounded-lg border border-border"><table className="w-full text-sm"><thead className="bg-slate-800 text-white"><tr><th className="p-3 text-left">문서</th><th className="p-3 text-left">문서번호</th><th className="p-3 text-left">REV</th><th className="p-3 text-left">상태</th><th className="p-3 text-left">발행일시</th><th className="p-3 text-left">개정 사유</th></tr></thead><tbody>{rows.map((row) => <tr key={row.revisionId} className="border-b border-border"><td className="p-3 font-semibold">{row.documentType}</td><td className="p-3 font-mono text-xs">{row.documentNo}</td><td className="p-3">REV.{row.revisionCode}</td><td className="p-3"><ComCodeBadge groupCode="QC_PLAN_REV_STATUS" code={row.status}/></td><td className="p-3">{row.publishedAt ? new Date(row.publishedAt).toLocaleString('ko-KR') : '-'}</td><td className="p-3">{row.changeReason || '-'}</td></tr>)}</tbody></table></div>
    <section className="rounded-lg border border-border bg-surface p-4"><h3 className="font-bold text-text">Revision 비교</h3><div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs text-text-muted">문서<select className="mt-1 block rounded-md border border-border bg-background px-3 py-2 text-sm text-text" value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>{pkg.documents.map((document) => <option key={document.documentId} value={document.documentType}>{document.documentType}</option>)}</select></label><RevisionSelect label="기준 Revision" value={leftId} revisions={revisions} onChange={setLeftId}/><RevisionSelect label="비교 Revision" value={rightId} revisions={revisions} onChange={setRightId}/><Button size="sm" disabled={busy || !leftId || !rightId || leftId === rightId} onClick={() => void compare()}>비교</Button></div>{result && <div className="mt-4 grid gap-3 md:grid-cols-4"><CompareCount label="머리정보 변경" count={result.metadataChanges.length}/><CompareCount label="추가 행" count={result.added.length}/><CompareCount label="삭제 행" count={result.removed.length}/><CompareCount label="변경 행" count={result.changed.length}/><div className="rounded-md bg-background p-3 text-xs text-text-muted md:col-span-4">{result.changed.length ? result.changed.map((item) => `#${item.rowSeq}: ${item.fields.join(', ')}`).join(' · ') : '행 내용 변경 없음'}</div></div>}</section>
    <section className="rounded-lg border border-border bg-surface p-4"><h3 className="font-bold text-text">감사 이력</h3><div className="mt-3 max-h-56 overflow-auto"><table className="w-full text-xs"><thead className="bg-slate-800 text-white"><tr><th className="p-2 text-left">일시</th><th className="p-2 text-left">이벤트</th><th className="p-2 text-left">문서/REV</th><th className="p-2 text-left">처리자</th></tr></thead><tbody>{events.map((event) => <tr key={event.eventId} className="border-b border-border"><td className="p-2">{event.occurredAt ? new Date(event.occurredAt).toLocaleString('ko-KR') : '-'}</td><td className="p-2 font-medium">{event.eventType}</td><td className="p-2">{event.documentType || event.documentNo || '-'}{event.revisionCode ? ` · REV.${event.revisionCode}` : ''}</td><td className="p-2">{event.actorId}</td></tr>)}</tbody></table>{events.length === 0 && <p className="p-4 text-center text-text-muted">기록된 감사 이벤트가 없습니다.</p>}</div></section>
  </div>;
}

function RevisionSelect({ label, value, revisions, onChange }: { label: string; value: number; revisions: QualityPlanPackage['documents'][number]['revisions']; onChange: (value: number) => void }) {
  return <label className="text-xs text-text-muted">{label}<select className="mt-1 block rounded-md border border-border bg-background px-3 py-2 text-sm text-text" value={value} onChange={(event) => onChange(Number(event.target.value))}>{revisions.map((revision) => <option key={revision.revisionId} value={revision.revisionId}>REV.{revision.revisionCode} · {revision.status}</option>)}</select></label>;
}

function CompareCount({ label, count }: { label: string; count: number }) {
  return <div className="rounded-md border border-border bg-background p-3"><div className="text-xs text-text-muted">{label}</div><div className="mt-1 text-xl font-bold text-text">{count}</div></div>;
}
