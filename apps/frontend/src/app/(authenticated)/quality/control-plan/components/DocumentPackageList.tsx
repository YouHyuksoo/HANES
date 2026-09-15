'use client';

import { Search, Boxes, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ComCodeBadge, Input } from '@/components/ui';
import type { QualityPlanPackage } from '../controlPlanApi';

export default function DocumentPackageList({ packages, selectedId, onSelect, loading }: {
  packages: QualityPlanPackage[]; selectedId: number | null; onSelect: (id: number) => void; loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const visible = useMemo(() => packages.filter((item) => `${item.itemCode} ${item.itemName} ${item.projectName ?? ''}`.toLowerCase().includes(search.toLowerCase())), [packages, search]);
  return (
    <aside className="flex w-[310px] shrink-0 flex-col border-r border-border bg-background/70 min-h-0">
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted"><Boxes className="h-4 w-4" />문서함 <span className="ml-auto font-mono text-primary">{packages.length}</span></div>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="품목·프로젝트 검색" leftIcon={<Search className="h-4 w-4" />} fullWidth />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {loading && <div className="p-4 text-center text-sm text-text-muted">문서함 조회 중…</div>}
        {!loading && !visible.length && <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-text-muted">등록된 문서 묶음이 없습니다.</div>}
        {visible.map((item) => (
          <button key={item.packageId} onClick={() => onSelect(item.packageId)} className={`w-full rounded-lg border p-3 text-left transition ${selectedId === item.packageId ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-surface hover:border-primary/40'}`}>
            <div className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><div className="truncate text-sm font-bold text-text">{item.itemCode}</div><div className="truncate text-xs text-text-muted">{item.itemName}</div></div><span className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">{item.phase}</span></div>
            <div className="mt-3 grid grid-cols-3 gap-1">
              {(['PFD', 'PFMEA', 'CONTROL_PLAN'] as const).map((type) => {
                const document = item.documents.find((entry) => entry.documentType === type);
                const revision = document?.revisions.find((entry) => entry.status === 'DRAFT') ?? document?.revisions.find((entry) => entry.status === 'PUBLISHED');
                return <div key={type} className="rounded border border-border p-1 text-center text-[9px] font-bold text-text-muted"><div>{type === 'CONTROL_PLAN' ? 'CP' : type} R{revision?.revisionCode ?? '--'}</div>{revision && <ComCodeBadge groupCode="QC_PLAN_REV_STATUS" code={revision.status} className="mt-1 text-[9px]" />}</div>;
              })}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
