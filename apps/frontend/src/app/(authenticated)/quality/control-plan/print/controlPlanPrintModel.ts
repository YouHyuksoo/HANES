export interface QualityPlanPrintModel {
  package: Record<string, unknown>; documents: Record<string, unknown>[]; pfdRows: Record<string, unknown>[];
  pfmeaRows: Record<string, unknown>[]; controlPlanRows: Record<string, unknown>[]; revisions: Record<string, unknown>[];
  participants: Record<string, unknown>[];
}

export const getText = (row: Record<string, unknown> | undefined, key: string) => String(row?.[key] ?? row?.[key.toLowerCase()] ?? '');

export function documentHeader(model: QualityPlanPrintModel, type: 'PFD' | 'PFMEA' | 'CONTROL_PLAN') {
  const document = model.documents.find((row) => getText(row, 'DOCUMENT_TYPE') === type);
  return {
    title: getText(document, 'TITLE'), documentNo: getText(document, 'DOCUMENT_NO'), revision: getText(document, 'REVISION_CODE'),
    formNo: getText(document, 'TEMPLATE_FORM_NO'), itemCode: getText(model.package, 'ITEM_CODE'), itemName: getText(model.package, 'ITEM_NAME'),
    project: getText(model.package, 'PROJECT_NAME'), customer: getText(model.package, 'CUSTOMER_NAME'), phase: getText(model.package, 'PHASE'),
    issueDate: getText(document, 'ISSUE_DATE'), author: getText(document, 'AUTHOR_ID'), publisher: getText(document, 'PUBLISHER_ID'),
  };
}
