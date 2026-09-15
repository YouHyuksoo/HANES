'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { PartnerSelect } from '@/components/shared';
import { usePartnerOptions } from '@/hooks/useMasterOptions';
import type { QualityPlanPackage, QualityPlanPackageUpdate } from '../controlPlanApi';

export default function BasicInfoTab({ value, busy, onSave }: {
  value: QualityPlanPackage;
  busy: boolean;
  onSave: (input: QualityPlanPackageUpdate) => Promise<unknown>;
}) {
  const locked = value.documents.some((document) => document.revisions.some((revision) => revision.status !== 'DRAFT'));
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<QualityPlanPackageUpdate>({});
  const { options: customers } = usePartnerOptions('CUSTOMER');
  useEffect(() => setForm({ phase: value.phase, projectCode: value.projectCode ?? '', projectName: value.projectName ?? '', customerCode: value.customerCode ?? '',
    customerName: value.customerName ?? '', partNumber: value.partNumber ?? '', organization: value.organization ?? '', keyContact: value.keyContact ?? '' }), [value]);
  const fields = [['품목코드', value.itemCode], ['품목명', value.itemName], ['단계', value.phase], ['품번', value.partNumber],
    ['프로젝트', value.projectName], ['프로젝트 코드', value.projectCode], ['고객', value.customerName], ['조직', value.organization], ['핵심 담당자', value.keyContact]];
  if (!editing) return <><div className="mb-3 flex justify-end"><Button size="sm" variant="secondary" disabled={locked} onClick={() => setEditing(true)}>기본정보 수정</Button></div>{locked && <p className="mb-3 text-right text-xs text-text-muted">발행 이력이 있어 공통 기본정보는 고정됩니다. 문서 내용은 새 Revision에서 수정하세요.</p>}<div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">{fields.map(([label, content]) => <div key={label} className="bg-surface p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</div><div className="mt-1 min-h-6 text-sm font-semibold text-text">{content || '-'}</div></div>)}</div></>;
  return <div className="rounded-lg border border-border bg-surface p-4"><div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-medium text-text">단계<select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={form.phase ?? 'PRODUCTION'} onChange={(event) => setForm({ ...form, phase: event.target.value })}><option value="PROTOTYPE">Prototype</option><option value="PRE_LAUNCH">Pre-launch</option><option value="PRODUCTION">Production</option></select></label><Input label="품번" value={form.partNumber ?? ''} onChange={(event) => setForm({ ...form, partNumber: event.target.value })} fullWidth /><Input label="프로젝트 코드" value={form.projectCode ?? ''} onChange={(event) => setForm({ ...form, projectCode: event.target.value })} fullWidth /><Input label="프로젝트명" value={form.projectName ?? ''} onChange={(event) => setForm({ ...form, projectName: event.target.value })} fullWidth /><label className="text-sm font-medium text-text">고객<PartnerSelect partnerType="CUSTOMER" fullWidth value={form.customerCode ?? ''} onChange={(customerCode) => { const label = customers.find((item) => item.value === customerCode)?.label ?? ''; setForm({ ...form, customerCode, customerName: label.replace(`${customerCode} - `, '') }); }} /></label><Input label="조직/Site" value={form.organization ?? ''} onChange={(event) => setForm({ ...form, organization: event.target.value })} fullWidth /><Input label="핵심 담당자" value={form.keyContact ?? ''} onChange={(event) => setForm({ ...form, keyContact: event.target.value })} fullWidth /></div><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditing(false)}>취소</Button><Button disabled={busy} onClick={async () => { await onSave(form); setEditing(false); }}>저장</Button></div></div>;
}
