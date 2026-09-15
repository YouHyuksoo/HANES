'use client';

import { CheckCircle2 } from 'lucide-react';
import { Button, ComCodeBadge } from '@/components/ui';
import type { ControlPlanWorkspaceState, WorkspaceTab } from '../useControlPlanWorkspace';
import BasicInfoTab from './BasicInfoTab';
import ProcessFlowTab from './ProcessFlowTab';
import PfmeaTab from './PfmeaTab';
import ControlPlanTab from './ControlPlanTab';
import RevisionHistoryTab from './RevisionHistoryTab';
import OutputCenterTab from './OutputCenterTab';
import RevisionReferenceSelector from './RevisionReferenceSelector';

const tabs: [WorkspaceTab, string][] = [
  ['BASIC', '기본정보'],
  ['PFD', 'PFD'],
  ['PFMEA', 'PFMEA'],
  ['CONTROL_PLAN', 'Control Plan'],
  ['HISTORY', '개정이력'],
  ['OUTPUT', '출력센터'],
];

export default function DocumentWorkspaceTabs({ state }: { state: ControlPlanWorkspaceState }) {
  const pkg = state.selectedPackage;
  if (!pkg)
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="rounded-xl border border-border bg-surface p-10 text-center shadow-lg">
          <div className="text-sm font-bold text-text">품질 문서 작업공간</div>
          <p className="mt-2 text-sm text-text-muted">
            왼쪽 문서함에서 묶음을 선택하거나 신규 문서를 생성하세요.
          </p>
        </div>
      </main>
    );
  const document = state.activeDocument;
  const revision = state.activeRevision;
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center border-b border-border bg-surface px-4">
        <nav className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => state.setActiveTab(key)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${state.activeTab === key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void state.validate()}
          disabled={!revision || state.busy}
        >
          <CheckCircle2 className="mr-1 h-4 w-4" />
          검증
        </Button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
        <div className="mb-3 flex shrink-0 items-center gap-3">
          <div>
            <div className="text-xs text-text-muted">
              {pkg.itemCode} · {document?.documentNo ?? '통합 문서'}
            </div>
            <h2 className="text-base font-bold text-text">
              {document?.title ?? '문서 묶음'} {revision ? `· REV.${revision.revisionCode}` : ''}
            </h2>
          </div>
          {revision && (
            <ComCodeBadge groupCode="QC_PLAN_REV_STATUS" code={revision.status} className="ml-auto" />
          )}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {(state.activeTab === 'PFMEA' || state.activeTab === 'CONTROL_PLAN') && revision && <RevisionReferenceSelector pkg={pkg} type={state.activeTab} revision={revision} busy={state.busy} onSave={state.updateRevisionReferences} />}
          <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain pr-1">
          {state.activeTab === 'BASIC' && <BasicInfoTab value={pkg} busy={state.busy} onSave={state.updatePackage} />}
          {state.activeTab === 'PFD' && revision && (
            <ProcessFlowTab
              revision={revision}
              readOnly={state.readOnly}
              focusRowId={state.focusRowId}
            />
          )}
          {state.activeTab === 'PFMEA' && revision && (
            <PfmeaTab
              key={`${revision.revisionId}:${revision.refPfdRevisionId ?? 0}`}
              pkg={pkg}
              revision={revision}
              readOnly={state.readOnly}
              focusRowId={state.focusRowId}
            />
          )}
          {state.activeTab === 'CONTROL_PLAN' && revision && (
            <ControlPlanTab
              key={`${revision.revisionId}:${revision.refPfdRevisionId ?? 0}:${revision.refPfmeaRevisionId ?? 0}`}
              pkg={pkg}
              revision={revision}
              readOnly={state.readOnly}
              focusRowId={state.focusRowId}
            />
          )}
          {state.activeTab === 'HISTORY' && <RevisionHistoryTab pkg={pkg} />}
          {state.activeTab === 'OUTPUT' && <OutputCenterTab pkg={pkg} />}
          </div>
        </div>
      </div>
    </main>
  );
}
