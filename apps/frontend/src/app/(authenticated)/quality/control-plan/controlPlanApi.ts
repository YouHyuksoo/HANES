import api from '@/services/api';

export const getControlPlanErrorMessage = (error: unknown, fallback = '요청 처리 중 오류가 발생했습니다.') => {
  const value = error as { response?: { data?: { message?: string | { message?: string } } }; message?: string };
  const message = value.response?.data?.message;
  return typeof message === 'string' ? message : message?.message ?? value.message ?? fallback;
};

export type DocumentType = 'PFD' | 'PFMEA' | 'CONTROL_PLAN';
export type RevisionStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';

export interface QualityRevision {
  revisionId: number;
  revisionCode: string;
  status: RevisionStatus;
  publishedAt?: string | null;
  changeReason?: string | null;
  changeDescription?: string | null;
  refPfdRevisionId?: number | null;
  refPfmeaRevisionId?: number | null;
}

export interface QualityDocument {
  documentId: number;
  documentType: DocumentType;
  documentNo: string;
  title?: string;
  templateFormNo?: string;
  revisions: QualityRevision[];
}

export interface QualityPlanPackage {
  packageId: number;
  itemCode: string;
  itemName: string;
  phase: string;
  projectCode?: string | null;
  projectName?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  partNumber?: string | null;
  organization?: string | null;
  keyContact?: string | null;
  documents: QualityDocument[];
}

export type QualityPlanPackageUpdate = Partial<Pick<QualityPlanPackage, 'phase' | 'projectCode' | 'projectName' | 'customerName' | 'partNumber' | 'organization' | 'keyContact'>> & { customerCode?: string | null };

export interface ValidationIssue {
  severity: 'ERROR' | 'WARNING';
  code: string;
  documentType: DocumentType;
  revisionId: number;
  rowId?: number;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  validationId: number;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
}

export interface RevisionCompareResult {
  documentId: number;
  documentType: DocumentType;
  metadataChanges: { field: string; before: unknown; after: unknown }[];
  added: Record<string, unknown>[];
  removed: Record<string, unknown>[];
  changed: { rowSeq: number; fields: string[]; before: Record<string, unknown>; after: Record<string, unknown> }[];
}

export interface QualityPlanEvent {
  eventId: number;
  eventType: string;
  actorId: string;
  occurredAt: string;
  documentType?: string | null;
  documentNo?: string | null;
  revisionCode?: string | null;
  detail?: string | null;
}

const payload = <T>(response: { data?: { data?: T } }): T => response.data?.data as T;
const value = (row: Record<string, unknown>, camel: string, oracle: string) => row[camel] ?? row[oracle];

function groupPackages(rows: Record<string, unknown>[]): QualityPlanPackage[] {
  const packages = new Map<number, QualityPlanPackage>();
  for (const row of rows) {
    const packageId = Number(value(row, 'packageId', 'PACKAGE_ID'));
    let pkg = packages.get(packageId);
    if (!pkg) {
      pkg = {
        packageId,
        itemCode: String(value(row, 'itemCode', 'ITEM_CODE') ?? ''),
        itemName: String(value(row, 'itemName', 'ITEM_NAME') ?? ''),
        phase: String(value(row, 'phase', 'PHASE') ?? ''),
        projectCode: value(row, 'projectCode', 'PROJECT_CODE') as string | null,
        projectName: value(row, 'projectName', 'PROJECT_NAME') as string | null,
        customerCode: value(row, 'customerCode', 'CUSTOMER_CODE') as string | null,
        customerName: value(row, 'customerName', 'CUSTOMER_NAME') as string | null,
        partNumber: value(row, 'partNumber', 'PART_NUMBER') as string | null,
        organization: value(row, 'organization', 'ORGANIZATION') as string | null,
        keyContact: value(row, 'keyContact', 'KEY_CONTACT') as string | null,
        documents: [],
      };
      packages.set(packageId, pkg);
    }
    const documentId = Number(value(row, 'documentId', 'DOCUMENT_ID'));
    if (!documentId) continue;
    let document = pkg.documents.find((item) => item.documentId === documentId);
    if (!document) {
      document = {
        documentId,
        documentType: String(value(row, 'documentType', 'DOCUMENT_TYPE')) as DocumentType,
        documentNo: String(value(row, 'documentNo', 'DOCUMENT_NO') ?? ''),
        title: value(row, 'title', 'TITLE') as string | undefined,
        templateFormNo: value(row, 'templateFormNo', 'TEMPLATE_FORM_NO') as string | undefined,
        revisions: [],
      };
      pkg.documents.push(document);
    }
    const revisionId = Number(value(row, 'revisionId', 'REVISION_ID'));
    if (revisionId && !document.revisions.some((item) => item.revisionId === revisionId)) {
      document.revisions.push({
        revisionId,
        revisionCode: String(value(row, 'revisionCode', 'REVISION_CODE') ?? '00'),
        status: String(value(row, 'status', 'STATUS')) as RevisionStatus,
        publishedAt: value(row, 'publishedAt', 'PUBLISHED_AT') as string | null,
        changeReason: value(row, 'changeReason', 'CHANGE_REASON') as string | null,
        changeDescription: value(row, 'changeDescription', 'CHANGE_DESCRIPTION') as string | null,
        refPfdRevisionId: value(row, 'refPfdRevisionId', 'REF_PFD_REVISION_ID') == null ? null : Number(value(row, 'refPfdRevisionId', 'REF_PFD_REVISION_ID')),
        refPfmeaRevisionId: value(row, 'refPfmeaRevisionId', 'REF_PFMEA_REVISION_ID') == null ? null : Number(value(row, 'refPfmeaRevisionId', 'REF_PFMEA_REVISION_ID')),
      });
    }
  }
  return [...packages.values()];
}

export const controlPlanApi = {
  async listPackages() {
    const rows = payload<Record<string, unknown>[]>(await api.get('/quality/plan-packages')) ?? [];
    return groupPackages(rows);
  },
  async getPackage(packageId: number) {
    const rows = payload<Record<string, unknown>[]>(await api.get(`/quality/plan-packages/${packageId}`)) ?? [];
    return groupPackages(rows)[0];
  },
  async createPackage(input: { itemCode: string; phase: string; projectCode?: string; projectName?: string; partNumber?: string }) {
    return payload<QualityPlanPackage>(await api.post('/quality/plan-packages', input));
  },
  async updatePackage(packageId: number, input: QualityPlanPackageUpdate) {
    return payload(await api.put(`/quality/plan-packages/${packageId}`, input));
  },
  async generateDraft(packageId: number) {
    return payload(await api.post(`/quality/plan-packages/${packageId}/generate-draft`));
  },
  async getRows(revisionId: number, type: DocumentType) {
    const suffix = type === 'PFD' ? 'pfd-rows' : type === 'PFMEA' ? 'pfmea-rows' : 'control-plan-rows';
    const data = payload<Record<string, unknown>[] | { rows?: Record<string, unknown>[] }>(await api.get(`/quality/revisions/${revisionId}/${suffix}`));
    return type === 'PFD' && data && !Array.isArray(data) ? data.rows ?? [] : Array.isArray(data) ? data : [];
  },
  async createRow(revisionId: number, type: DocumentType, row: Record<string, unknown>) {
    const suffix = type === 'PFD' ? 'pfd-rows' : type === 'PFMEA' ? 'pfmea-rows' : 'control-plan-rows';
    return payload(await api.post(`/quality/revisions/${revisionId}/${suffix}`, row));
  },
  async updatePfdRow(rowId: number, row: Record<string, unknown>) {
    return payload(await api.put(`/quality/pfd-rows/${rowId}`, row));
  },
  async updateRow(rowId: number, type: DocumentType, row: Record<string, unknown>) {
    const suffix = type === 'PFD' ? 'pfd-rows' : type === 'PFMEA' ? 'pfmea-rows' : 'control-plan-rows';
    return payload(await api.put(`/quality/${suffix}/${rowId}`, row));
  },
  async deleteRow(rowId: number, type: DocumentType) {
    const suffix = type === 'PFD' ? 'pfd-rows' : type === 'PFMEA' ? 'pfmea-rows' : 'control-plan-rows';
    return payload(await api.delete(`/quality/${suffix}/${rowId}`));
  },
  async listParticipants(revisionId: number) {
    return payload<Record<string, unknown>[]>(await api.get(`/quality/revisions/${revisionId}/participants`)) ?? [];
  },
  async createParticipant(revisionId: number, input: { userName: string; organization?: string }) {
    return payload(await api.post(`/quality/revisions/${revisionId}/participants`, input));
  },
  async deleteParticipant(participantId: number) {
    return payload(await api.delete(`/quality/participants/${participantId}`));
  },
  async reorderPfdRows(revisionId: number, rowIds: number[]) {
    return payload(await api.patch(`/quality/revisions/${revisionId}/pfd-rows/reorder`, { rowIds }));
  },
  async validate(revisionId: number) {
    return payload<ValidationResult>(await api.post(`/quality/revisions/${revisionId}/validate`));
  },
  async publish(revisionId: number) {
    return payload(await api.post(`/quality/revisions/${revisionId}/publish`));
  },
  async createRevision(revisionId: number, input: { changeReason: string; changeDescription: string }) {
    return payload(await api.post(`/quality/revisions/${revisionId}/create-revision`, input));
  },
  async updateRevision(revisionId: number, input: { changeReason?: string; changeDescription?: string; refPfdRevisionId?: number; refPfmeaRevisionId?: number }) {
    return payload(await api.put(`/quality/revisions/${revisionId}`, input));
  },
  async listRevisions(documentId: number) {
    return payload<Record<string, unknown>[]>(await api.get(`/quality/documents/${documentId}/revisions`)) ?? [];
  },
  async compareRevisions(revisionId: number, otherRevisionId: number) {
    return payload<RevisionCompareResult>(await api.get(`/quality/revisions/${revisionId}/compare/${otherRevisionId}`));
  },
  async getPrintModel(packageId: number) {
    return payload<QualityPlanPrintModel>(await api.get(`/quality/plan-packages/${packageId}/print-model`));
  },
  async listEvents(packageId: number) {
    const rows = payload<Record<string, unknown>[]>(await api.get(`/quality/plan-packages/${packageId}/events`)) ?? [];
    return rows.map((row) => ({
      eventId: Number(value(row, 'eventId', 'EVENT_ID')),
      eventType: String(value(row, 'eventType', 'EVENT_TYPE') ?? ''),
      actorId: String(value(row, 'actorId', 'ACTOR_ID') ?? ''),
      occurredAt: String(value(row, 'occurredAt', 'OCCURRED_AT') ?? ''),
      documentType: value(row, 'documentType', 'DOCUMENT_TYPE') as string | null,
      documentNo: value(row, 'documentNo', 'DOCUMENT_NO') as string | null,
      revisionCode: value(row, 'revisionCode', 'REVISION_CODE') as string | null,
      detail: value(row, 'detail', 'DETAIL') as string | null,
    })) satisfies QualityPlanEvent[];
  },
  async recordOutputEvent(packageId: number, eventType: 'PREVIEWED' | 'PDF_DOWNLOADED' | 'PRINTED' | 'EXCEL_DOWNLOADED', documentType?: OutputDocumentType) {
    return payload(await api.post(`/quality/plan-packages/${packageId}/output-events`, { eventType, documentType }));
  },
};

export type OutputDocumentType = DocumentType | 'HISTORY' | 'WORKBOOK';

export interface QualityPlanPrintModel {
  package: Record<string, unknown>;
  documents: Record<string, unknown>[];
  pfdRows: Record<string, unknown>[];
  pfmeaRows: Record<string, unknown>[];
  controlPlanRows: Record<string, unknown>[];
  revisions: Record<string, unknown>[];
  participants: Record<string, unknown>[];
}
