'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import type { DocumentType, QualityPlanPackage, QualityRevision } from '../controlPlanApi';

const immutable = (revision: QualityRevision) => revision.status === 'PUBLISHED' || revision.status === 'SUPERSEDED';

export default function RevisionReferenceSelector({ pkg, type, revision, busy, onSave }: {
  pkg: QualityPlanPackage;
  type: DocumentType;
  revision: QualityRevision;
  busy: boolean;
  onSave: (input: { refPfdRevisionId?: number; refPfmeaRevisionId?: number }) => Promise<unknown>;
}) {
  const pfdRevisions = useMemo(() => pkg.documents.find((document) => document.documentType === 'PFD')?.revisions.filter(immutable) ?? [], [pkg]);
  const pfmeaRevisions = useMemo(() => pkg.documents.find((document) => document.documentType === 'PFMEA')?.revisions.filter(immutable) ?? [], [pkg]);
  const [refPfdRevisionId, setRefPfdRevisionId] = useState(revision.refPfdRevisionId ?? 0);
  const [refPfmeaRevisionId, setRefPfmeaRevisionId] = useState(revision.refPfmeaRevisionId ?? 0);
  useEffect(() => { setRefPfdRevisionId(revision.refPfdRevisionId ?? 0); setRefPfmeaRevisionId(revision.refPfmeaRevisionId ?? 0); }, [revision]);
  if (type === 'PFD' || revision.status !== 'DRAFT') return null;
  const choosePfmea = (value: number) => {
    setRefPfmeaRevisionId(value);
    const selected = pfmeaRevisions.find((item) => item.revisionId === value);
    if (selected?.refPfdRevisionId) setRefPfdRevisionId(selected.refPfdRevisionId);
  };
  const canSave = Boolean(refPfdRevisionId) && (type !== 'CONTROL_PLAN' || Boolean(refPfmeaRevisionId));
  return <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3 text-xs">
    <label className="grid gap-1 font-medium text-text">참조 PFD Revision<select aria-label="참조 PFD Revision" className="min-w-44 rounded-md border border-border bg-background px-3 py-2" value={refPfdRevisionId} onChange={(event) => setRefPfdRevisionId(Number(event.target.value))}><option value={0}>선택</option>{pfdRevisions.map((item) => <option key={item.revisionId} value={item.revisionId}>REV.{item.revisionCode} · {item.status}</option>)}</select></label>
    {type === 'CONTROL_PLAN' && <label className="grid gap-1 font-medium text-text">참조 PFMEA Revision<select aria-label="참조 PFMEA Revision" className="min-w-44 rounded-md border border-border bg-background px-3 py-2" value={refPfmeaRevisionId} onChange={(event) => choosePfmea(Number(event.target.value))}><option value={0}>선택</option>{pfmeaRevisions.map((item) => <option key={item.revisionId} value={item.revisionId}>REV.{item.revisionCode} · {item.status}</option>)}</select></label>}
    <Button size="sm" disabled={busy || !canSave} onClick={() => void onSave({ refPfdRevisionId, ...(type === 'CONTROL_PLAN' ? { refPfmeaRevisionId } : {}) })}>참조 변경</Button>
    <span className="text-text-muted">참조 변경 후 기존 행을 새 Revision의 행으로 다시 연결하세요.</span>
  </div>;
}
