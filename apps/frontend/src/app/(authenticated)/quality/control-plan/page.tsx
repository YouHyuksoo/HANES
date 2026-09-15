'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useControlPlanWorkspace } from './useControlPlanWorkspace';
import ControlPlanWorkspaceHeader from './components/ControlPlanWorkspaceHeader';
import DocumentPackageList from './components/DocumentPackageList';
import DocumentWorkspaceTabs from './components/DocumentWorkspaceTabs';
import NewPackageModal from './components/NewPackageModal';
import RevisionCreateModal from './components/RevisionCreateModal';
import ValidationResultPanel from './components/ValidationResultPanel';

export default function ControlPlanPage() {
  const state = useControlPlanWorkspace();
  const [newOpen, setNewOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <ControlPlanWorkspaceHeader
        state={state}
        onCreate={() => setNewOpen(true)}
        onRevision={() => setRevisionOpen(true)}
      />
      {state.error && (
        <div className="flex shrink-0 items-center gap-2 border-b border-red-400/30 bg-red-400/10 px-5 py-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {state.error}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <DocumentPackageList
          packages={state.packages}
          selectedId={state.selectedPackageId}
          onSelect={state.setSelectedPackageId}
          loading={state.loading}
        />
        <DocumentWorkspaceTabs state={state} />
      </div>
      <ValidationResultPanel result={state.validation} onSelect={state.selectValidationIssue} />
      <NewPackageModal
        isOpen={newOpen}
        onClose={() => setNewOpen(false)}
        onConfirm={state.createPackage}
        busy={state.busy}
      />
      <RevisionCreateModal
        isOpen={revisionOpen}
        onClose={() => setRevisionOpen(false)}
        onConfirm={state.createRevision}
        busy={state.busy}
      />
    </div>
  );
}
