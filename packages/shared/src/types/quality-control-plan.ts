/** QREKA-PR-025 기반 품질 문서 유형. */
export type QualityDocumentType = 'PFD' | 'PFMEA' | 'CONTROL_PLAN';

/** 발행본은 직접 수정하지 않고 새 Revision으로만 변경한다. */
export type QualityRevisionStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';

export type QualityPlanPhase = 'PROTOTYPE' | 'PRE_LAUNCH' | 'PRODUCTION';
export type ProcessFlowLane = 'SUB' | 'MAIN' | 'OUTSOURCING';
export type ProcessFlowSymbol =
  | 'OPERATION'
  | 'INSPECTION'
  | 'TRANSPORT'
  | 'STORAGE'
  | 'DELAY'
  | 'REWORK'
  | 'QUARANTINE'
  | 'SHIPPING';

export interface QualityPlanPackage {
  id: number;
  company: string;
  plantCode: string;
  projectCode?: string | null;
  projectName?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  itemCode: string;
  itemName: string;
  partNumber?: string | null;
  phase: QualityPlanPhase;
  organization?: string | null;
  keyContact?: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface QualityPlanDocument {
  id: number;
  packageId: number;
  company: string;
  plantCode: string;
  documentType: QualityDocumentType;
  documentNo: string;
  title: string;
  templateFormNo: string;
  templateRevision: string;
  createdBy: string;
  createdAt: string;
}

export interface QualityPlanRevision {
  id: number;
  documentId: number;
  company: string;
  plantCode: string;
  revisionCode: string;
  status: QualityRevisionStatus;
  issueDate?: string | null;
  revisionDate?: string | null;
  publishedAt?: string | null;
  changeReason?: string | null;
  changeDescription?: string | null;
  authorId: string;
  publisherId?: string | null;
  referencedPfdRevisionId?: number | null;
  referencedPfmeaRevisionId?: number | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ProcessFlowRow {
  id: number;
  revisionId: number;
  rowSeq: number;
  processNo: string;
  processCode?: string | null;
  processName: string;
  equipmentCode?: string | null;
  equipmentName?: string | null;
  lane: ProcessFlowLane;
  symbol: ProcessFlowSymbol;
  productSpecialCharacteristicCode?: string | null;
  processSpecialCharacteristicCode?: string | null;
  description?: string | null;
}

export interface PfmeaRow {
  id: number;
  revisionId: number;
  rowSeq: number;
  processFlowRowId: number;
  processFunction: string;
  requirement: string;
  potentialFailureMode: string;
  potentialFailureEffect: string;
  severity: number;
  specialCharacteristicCode?: string | null;
  potentialCause: string;
  preventionControl?: string | null;
  occurrence: number;
  detectionControl?: string | null;
  detection: number;
  rpn: number;
  recommendedAction?: string | null;
  responsibleOrganization?: string | null;
  responsiblePerson?: string | null;
  targetDate?: string | null;
  completedAction?: string | null;
  completionDate?: string | null;
  actionSeverity?: number | null;
  actionOccurrence?: number | null;
  actionDetection?: number | null;
  actionRpn?: number | null;
}

export interface QualityControlPlanRow {
  id: number;
  revisionId: number;
  rowSeq: number;
  processFlowRowId: number;
  pfmeaRowId?: number | null;
  processNo: string;
  processName: string;
  equipmentCode?: string | null;
  equipmentName?: string | null;
  characteristicNo?: string | null;
  productCharacteristic?: string | null;
  processCharacteristic?: string | null;
  specialCharacteristicCode?: string | null;
  specification: string;
  evaluationMethod: string;
  sampleSize: string;
  sampleFrequency?: string | null;
  controlMethod: string;
  responsibleRole?: string | null;
  reactionPlan: string;
  recordForm?: string | null;
}

export type QualityPlanParticipantRole = 'AUTHOR' | 'PUBLISHER' | 'KEY_CONTACT';

export interface QualityPlanParticipant {
  id: number;
  revisionId: number;
  role: QualityPlanParticipantRole;
  userId?: string | null;
  userName: string;
  organization?: string | null;
}

export type QualityPlanValidationSeverity = 'ERROR' | 'WARNING';

export interface QualityPlanValidationIssue {
  severity: QualityPlanValidationSeverity;
  code: string;
  documentType: QualityDocumentType;
  revisionId: number | null;
  rowId: number | null;
  field: string | null;
  message: string;
}

export interface QualityPlanValidationResult {
  valid: boolean;
  validatedAt: string;
  issues: QualityPlanValidationIssue[];
}

export type QualityPlanEventType =
  | 'CREATED'
  | 'UPDATED'
  | 'VALIDATED'
  | 'PUBLISHED'
  | 'REVISION_CREATED'
  | 'EXPORTED';

export interface QualityPlanEvent {
  id: number;
  packageId: number;
  documentId?: number | null;
  revisionId?: number | null;
  eventType: QualityPlanEventType;
  actorId: string;
  occurredAt: string;
  detail?: string | null;
}
