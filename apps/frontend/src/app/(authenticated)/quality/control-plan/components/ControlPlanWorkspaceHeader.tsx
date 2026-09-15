'use client';

import { FilePlus2, RefreshCw, Sparkles, ShieldCheck, GitBranch, Printer } from 'lucide-react';
import { Button } from '@/components/ui';
import type { ControlPlanWorkspaceState } from '../useControlPlanWorkspace';

interface Props {
  state: ControlPlanWorkspaceState;
  onCreate: () => void;
  onRevision: () => void;
}

export default function ControlPlanWorkspaceHeader({ state, onCreate, onRevision }: Props) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-5 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
          Quality document control <span className="h-px w-10 bg-primary/40" /> QREKA-PR-025
        </div>
        <h1 className="mt-1 truncate text-xl font-bold text-text">관리계획서</h1>
        <p className="mt-0.5 text-xs text-text-muted">품목별 PFD → PFMEA → Control Plan 통합 문서</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => void state.refresh()} disabled={state.loading || state.busy}>
          <RefreshCw className={`mr-1 h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />새로고침
        </Button>
        <Button size="sm" variant="secondary" onClick={onCreate}><FilePlus2 className="mr-1 h-4 w-4" />신규</Button>
        <Button size="sm" variant="secondary" onClick={() => void state.generateDraft()} disabled={!state.selectedPackage || state.busy}>
          <Sparkles className="mr-1 h-4 w-4" />자동 초안
        </Button>
        {state.readOnly ? (
          <Button size="sm" onClick={onRevision} disabled={!state.activeRevision}><GitBranch className="mr-1 h-4 w-4" />개정 생성</Button>
        ) : (
          <Button size="sm" onClick={() => void state.publish()} disabled={!state.activeRevision || state.busy}>
            <ShieldCheck className="mr-1 h-4 w-4" />발행
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => state.setActiveTab('OUTPUT')} disabled={!state.selectedPackage}>
          <Printer className="mr-1 h-4 w-4" />출력
        </Button>
      </div>
    </header>
  );
}
