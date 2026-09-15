'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { controlPlanApi, getControlPlanErrorMessage, type DocumentType, type QualityPlanPackage, type QualityPlanPackageUpdate, type ValidationIssue, type ValidationResult } from './controlPlanApi';

export type WorkspaceTab = 'BASIC' | DocumentType | 'HISTORY' | 'OUTPUT';

export function useControlPlanWorkspace() {
  const [packages, setPackages] = useState<QualityPlanPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('BASIC');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [focusRowId, setFocusRowId] = useState<number | null>(null);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.packageId === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  );
  const activeDocumentType: DocumentType = activeTab === 'PFD' || activeTab === 'PFMEA' || activeTab === 'CONTROL_PLAN'
    ? activeTab : 'CONTROL_PLAN';
  const activeDocument = selectedPackage?.documents.find((item) => item.documentType === activeDocumentType) ?? null;
  const activeRevision = activeDocument?.revisions.find((item) => item.status === 'DRAFT')
    ?? activeDocument?.revisions.find((item) => item.status === 'PUBLISHED')
    ?? activeDocument?.revisions[0] ?? null;
  const readOnly = activeRevision?.status !== 'DRAFT';

  const refresh = useCallback(async (keepSelection = true) => {
    setLoading(true); setError(null);
    try {
      const next = await controlPlanApi.listPackages();
      setPackages(next);
      setSelectedPackageId((current) => keepSelection && next.some((item) => item.packageId === current)
        ? current : next[0]?.packageId ?? null);
    } catch (caught) {
      setError(getControlPlanErrorMessage(caught));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(false); }, [refresh]);

  const run = useCallback(async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(null);
    try { const result = await action(); toast.success(success); await refresh(); return result; }
    catch (caught) { const message = getControlPlanErrorMessage(caught); setError(message); toast.error(message); return undefined; }
    finally { setBusy(false); }
  }, [refresh]);

  const createPackage = useCallback(async (input: { itemCode: string; phase: string; projectCode?: string; projectName?: string; partNumber?: string }) => {
    const result = await run(() => controlPlanApi.createPackage(input), '문서 묶음을 생성했습니다.') as QualityPlanPackage;
    if (result?.packageId) setSelectedPackageId(result.packageId);
    return result;
  }, [run]);
  const generateDraft = useCallback(() => selectedPackageId
    ? run(() => controlPlanApi.generateDraft(selectedPackageId), '기준정보에서 초안을 생성했습니다.') : Promise.resolve(), [run, selectedPackageId]);
  const validate = useCallback(async () => {
    if (!activeRevision) return;
    const result = await run(() => controlPlanApi.validate(activeRevision.revisionId), '문서 검증을 완료했습니다.') as ValidationResult;
    setValidation(result);
  }, [activeRevision, run]);
  const publish = useCallback(() => activeRevision
    ? run(() => controlPlanApi.publish(activeRevision.revisionId), 'Revision을 발행했습니다.') : Promise.resolve(), [activeRevision, run]);
  const createRevision = useCallback((changeReason: string, changeDescription: string) => activeRevision
    ? run(() => controlPlanApi.createRevision(activeRevision.revisionId, { changeReason, changeDescription }), '새 Revision을 생성했습니다.') : Promise.resolve(), [activeRevision, run]);
  const updateRevisionReferences = useCallback((input: { refPfdRevisionId?: number; refPfmeaRevisionId?: number }) => activeRevision
    ? run(() => controlPlanApi.updateRevision(activeRevision.revisionId, input), '참조 Revision을 변경했습니다.') : Promise.resolve(), [activeRevision, run]);
  const selectValidationIssue = useCallback((issue: ValidationIssue) => {
    setActiveTab(issue.documentType); setFocusRowId(issue.rowId ?? null);
  }, []);
  const updatePackage = useCallback((input: QualityPlanPackageUpdate) => selectedPackageId
    ? run(() => controlPlanApi.updatePackage(selectedPackageId,input),'기본정보를 수정했습니다.') : Promise.resolve(),[run,selectedPackageId]);

  return { packages, selectedPackage, selectedPackageId, setSelectedPackageId, activeTab, setActiveTab,
    activeDocument, activeRevision, readOnly, loading, busy, error, validation, focusRowId,
    refresh, createPackage, updatePackage, generateDraft, validate, publish, createRevision, updateRevisionReferences, selectValidationIssue };
}

export type ControlPlanWorkspaceState = ReturnType<typeof useControlPlanWorkspace>;
