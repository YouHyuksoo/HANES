import fs from 'node:fs/promises';

const base = process.env.HANES_API_BASE ?? 'http://localhost:3003/api/v1';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const company = process.env.HANES_COMPANY ?? '40';
const plant = process.env.HANES_PLANT ?? '1000';
const stamp = process.env.HANES_TEST_STAMP
  ?? `${new Date().toISOString().replace(/\D/g, '').slice(2, 14)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
const today = new Date().toISOString().slice(0, 10);
const nextYear = `${new Date().getUTCFullYear() + 1}-12-31`;

const headers = {
  Authorization: `Bearer ${token}`,
  'X-Company': company,
  'X-Plant': plant,
};

const code = {
  comGroup: `CRUD_${stamp}`,
  comDetail: 'D1',
  company: `C-${stamp}`,
  partner: `V-${stamp}`,
  rawPart: `RM-${stamp}`,
  fgPart: `FG-${stamp}`,
  process: `P${stamp.slice(-8)}`,
  line: `L-${stamp}`,
  worker: `WK-${stamp}`,
  warehouseA: `WHA-${stamp}`,
  warehouseB: `WHB-${stamp}`,
  location: `LOC-${stamp}`,
  transfer: null,
  equip: `EQ-${stamp}`,
  equipBomItem: `EBI-${stamp}`,
  routing: `RT-${stamp}`,
  iqcPool: `IQP-${stamp}`,
  iqcTemplate: `IQT-${stamp}`,
  equipInspectItem: `EII-${stamp}`,
  labelTemplate: `TPL-${stamp}`,
  gauge: `G-${stamp}`,
  calendar: `CAL-${stamp}`,
  shift: `SH-${stamp.slice(-12)}`,
};
code.transfer = `${code.warehouseA}/${code.warehouseB}`;

const evidence = {
  executedAt: new Date().toISOString(),
  base,
  company,
  plant,
  stamp,
  target: 'HANES 기준정보 화면/API CRUD 런타임 점검',
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
  },
  codes: code,
  steps: [],
  cleanup: [],
  failures: [],
};

const cleanupStack = [];

async function rawApi(method, path, body) {
  const init = {
    method,
    headers: { ...headers },
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok && json?.success !== false, status: res.status, json, text };
}

function unwrap(json) {
  if (json && Object.prototype.hasOwnProperty.call(json, 'data')) return json.data;
  return json;
}

function compact(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return { count: value.length, first: value[0] ?? null };
  if (typeof value !== 'object') return value;
  const keys = [
    'id', 'companyCode', 'plantCode', 'groupCode', 'detailCode', 'itemCode',
    'partnerCode', 'processCode', 'lineCode', 'workerCode', 'warehouseCode',
    'locationCode', 'equipCode', 'routingCode', 'seq', 'templateName',
    'category', 'gaugeCode', 'calendarId', 'shiftCode', 'useYn', 'status',
    'deleted', 'total', 'page', 'limit',
  ];
  const out = {};
  for (const key of keys) {
    if (value[key] !== undefined) out[key] = value[key];
  }
  return Object.keys(out).length > 0 ? out : value;
}

async function step(module, operation, method, path, body, options = {}) {
  const entry = {
    module,
    operation,
    method,
    path,
    request: body ?? null,
    expected: options.expected ?? '2xx success',
    ok: false,
  };
  evidence.steps.push(entry);
  evidence.summary.total++;
  const result = await rawApi(method, path, body);
  entry.status = result.status;
  entry.response = compact(unwrap(result.json));

  const expectedStatus = options.expectedStatus;
  const expectedStatuses = options.expectedStatuses;
  const ok = expectedStatuses
    ? expectedStatuses.includes(result.status)
    : expectedStatus
    ? result.status === expectedStatus
    : result.ok;
  entry.ok = ok;
  if (ok) {
    evidence.summary.passed++;
    return unwrap(result.json);
  }

  evidence.summary.failed++;
  entry.error = result.text;
  evidence.failures.push({ module, operation, method, path, status: result.status, error: result.text });
  if (options.allowFailure) return unwrap(result.json);
  throw new Error(`${module} ${operation} failed: ${method} ${path} ${result.status} ${result.text}`);
}

async function duplicateGuard(module, path, body, options = {}) {
  return step(module, 'DUPLICATE_GUARD', 'POST', path, body, {
    expected: options.expected ?? '4xx duplicate defense',
    expectedStatuses: options.expectedStatuses ?? [400, 409],
  });
}

async function duplicateLastCreate(module, options = {}) {
  const createStep = [...evidence.steps].reverse().find((entry) =>
    entry.module === module && entry.operation === 'CREATE' && entry.method === 'POST'
  );
  if (!createStep) throw new Error(`${module} CREATE step not found for duplicate guard`);
  return duplicateGuard(module, createStep.path, createStep.request, options);
}

async function cleanup(label, method, path) {
  const entry = { label, method, path, ok: false };
  evidence.cleanup.push(entry);
  try {
    const result = await rawApi(method, path);
    entry.status = result.status;
    entry.response = compact(unwrap(result.json));
    entry.ok = result.ok || result.status === 404;
    if (!entry.ok) {
      entry.error = result.text;
      evidence.failures.push({ module: label, operation: 'CLEANUP', method, path, status: result.status, error: result.text });
    }
  } catch (error) {
    entry.error = error instanceof Error ? error.message : String(error);
    evidence.failures.push({ module: label, operation: 'CLEANUP', method, path, error: entry.error });
  }
}

function deferCleanup(label, method, path) {
  cleanupStack.push(() => cleanup(label, method, path));
}

async function expectGone(module, path) {
  await step(module, 'READ_AFTER_DELETE', 'GET', path, undefined, {
    expected: '404 after delete',
    expectedStatus: 404,
  });
}

function enc(value) {
  return encodeURIComponent(value);
}

async function main() {
  await step('health', 'DB 연결 확인', 'GET', '/health');

  await step('회사', 'CREATE', 'POST', '/master/companies', {
    companyCode: code.company,
    companyName: 'CRUD 테스트 회사',
    bizNo: `CBIZ-${stamp.slice(-12)}`,
    useYn: 'Y',
  });
  await duplicateLastCreate('회사');
  deferCleanup('회사', 'DELETE', `/master/companies/${enc(`${code.company}::${plant}`)}`);
  await step('회사', 'READ', 'GET', `/master/companies/${enc(`${code.company}::${plant}`)}`);
  await step('회사', 'UPDATE', 'PUT', `/master/companies/${enc(`${code.company}::${plant}`)}`, {
    companyName: 'CRUD 테스트 회사 수정',
    useYn: 'Y',
  });

  await step('공통코드', 'CREATE', 'POST', '/master/com-codes', {
    groupCode: code.comGroup,
    detailCode: code.comDetail,
    codeName: 'CRUD 테스트 코드',
    codeDesc: '기준정보 CRUD 자동점검 생성',
    sortOrder: 1,
    useYn: 'Y',
  });
  await duplicateLastCreate('공통코드');
  deferCleanup('공통코드', 'DELETE', `/master/com-codes/${enc(`${code.comGroup}::${code.comDetail}`)}`);
  await step('공통코드', 'READ', 'GET', `/master/com-codes/${enc(`${code.comGroup}::${code.comDetail}`)}`);
  await step('공통코드', 'UPDATE', 'PUT', `/master/com-codes/${enc(`${code.comGroup}::${code.comDetail}`)}`, {
    codeName: 'CRUD 테스트 코드 수정',
    sortOrder: 2,
  });

  await step('거래처', 'CREATE', 'POST', '/master/partners', {
    partnerCode: code.partner,
    partnerName: 'CRUD 테스트 거래처',
    partnerType: 'SUPPLIER',
    bizNo: `BIZ-${stamp.slice(-12)}`,
    useYn: 'Y',
  });
  await duplicateLastCreate('거래처');
  deferCleanup('거래처', 'DELETE', `/master/partners/${enc(code.partner)}`);
  await step('거래처', 'READ', 'GET', `/master/partners/${enc(code.partner)}`);
  await step('거래처', 'UPDATE', 'PUT', `/master/partners/${enc(code.partner)}`, {
    partnerName: 'CRUD 테스트 거래처 수정',
    useYn: 'Y',
  });

  await step('품목-원자재', 'CREATE', 'POST', '/master/parts', {
    itemCode: code.rawPart,
    itemNo: `RAW-NO-${stamp}`,
    itemName: 'CRUD 테스트 원자재',
    itemType: 'RAW_MATERIAL',
    unit: 'EA',
    iqcYn: 'Y',
    inspectMethod: 'FULL',
    useYn: 'Y',
  });
  await duplicateLastCreate('품목-원자재');
  deferCleanup('품목-원자재', 'DELETE', `/master/parts/${enc(code.rawPart)}`);
  await step('품목-원자재', 'READ', 'GET', `/master/parts/${enc(code.rawPart)}`);
  await step('품목-원자재', 'UPDATE', 'PUT', `/master/parts/${enc(code.rawPart)}`, {
    itemName: 'CRUD 테스트 원자재 수정',
    unit: 'EA',
    iqcYn: 'Y',
    inspectMethod: 'FULL',
  });

  await step('품목-완제품', 'CREATE', 'POST', '/master/parts', {
    itemCode: code.fgPart,
    itemNo: `FG-NO-${stamp}`,
    itemName: 'CRUD 테스트 완제품',
    itemType: 'FINISHED',
    productType: 'HARNESS',
    unit: 'EA',
    useYn: 'Y',
  });
  await duplicateLastCreate('품목-완제품');
  deferCleanup('품목-완제품', 'DELETE', `/master/parts/${enc(code.fgPart)}`);
  await step('품목-완제품', 'READ', 'GET', `/master/parts/${enc(code.fgPart)}`);
  await step('품목-완제품', 'UPDATE', 'PUT', `/master/parts/${enc(code.fgPart)}`, {
    itemName: 'CRUD 테스트 완제품 수정',
    unit: 'EA',
  });

  await step('공정', 'CREATE', 'POST', '/master/processes', {
    processCode: code.process,
    processName: 'CRUD 테스트 공정',
    processType: 'ASSEMBLY',
    useYn: 'Y',
  });
  await duplicateLastCreate('공정');
  deferCleanup('공정', 'DELETE', `/master/processes/${enc(code.process)}`);
  await step('공정', 'READ', 'GET', `/master/processes/${enc(code.process)}`);
  await step('공정', 'UPDATE', 'PUT', `/master/processes/${enc(code.process)}`, {
    processName: 'CRUD 테스트 공정 수정',
    processType: 'ASSEMBLY',
  });

  await step('생산라인', 'CREATE', 'POST', '/master/prod-lines', {
    lineCode: code.line,
    lineName: 'CRUD 테스트 라인',
    oper: code.process,
    lineType: 'MAIN',
    useYn: 'Y',
  });
  await duplicateLastCreate('생산라인');
  deferCleanup('생산라인', 'DELETE', `/master/prod-lines/${enc(code.line)}`);
  await step('생산라인', 'READ', 'GET', `/master/prod-lines/${enc(code.line)}`);
  await step('생산라인', 'UPDATE', 'PUT', `/master/prod-lines/${enc(code.line)}`, {
    lineName: 'CRUD 테스트 라인 수정',
    oper: code.process,
  });

  await step('작업자', 'CREATE', 'POST', '/master/workers', {
    workerCode: code.worker,
    workerName: 'CRUD 테스트 작업자',
    qrCode: `QR-${code.worker}`,
    processIds: [code.process],
    useYn: 'Y',
  });
  await duplicateLastCreate('작업자');
  deferCleanup('작업자', 'DELETE', `/master/workers/${enc(code.worker)}`);
  await step('작업자', 'READ', 'GET', `/master/workers/${enc(code.worker)}`);
  await step('작업자', 'UPDATE', 'PUT', `/master/workers/${enc(code.worker)}`, {
    workerName: 'CRUD 테스트 작업자 수정',
    processIds: [code.process],
  });

  await step('창고-A', 'CREATE', 'POST', '/inventory/warehouses', {
    warehouseCode: code.warehouseA,
    warehouseName: 'CRUD 테스트 창고 A',
    warehouseType: 'RAW',
    plantCode: plant,
    isDefault: false,
  });
  await duplicateLastCreate('창고-A');
  deferCleanup('창고-A', 'DELETE', `/inventory/warehouses/${enc(code.warehouseA)}`);
  await step('창고-A', 'READ', 'GET', `/inventory/warehouses/${enc(code.warehouseA)}`);
  await step('창고-A', 'UPDATE', 'PUT', `/inventory/warehouses/${enc(code.warehouseA)}`, {
    warehouseName: 'CRUD 테스트 창고 A 수정',
    warehouseType: 'RAW',
    plantCode: plant,
  });

  await step('창고-B', 'CREATE', 'POST', '/inventory/warehouses', {
    warehouseCode: code.warehouseB,
    warehouseName: 'CRUD 테스트 창고 B',
    warehouseType: 'WIP',
    plantCode: plant,
    isDefault: false,
  });
  await duplicateLastCreate('창고-B');
  deferCleanup('창고-B', 'DELETE', `/inventory/warehouses/${enc(code.warehouseB)}`);

  await step('창고위치', 'CREATE', 'POST', '/inventory/warehouse-locations', {
    warehouseCode: code.warehouseA,
    locationCode: code.location,
    locationName: 'CRUD 테스트 로케이션',
    zone: 'Z1',
  });
  await duplicateLastCreate('창고위치');
  deferCleanup('창고위치', 'DELETE', `/inventory/warehouse-locations/${enc(`${code.warehouseA}::${code.location}`)}`);
  await step('창고위치', 'READ_LIST', 'GET', `/inventory/warehouse-locations?warehouseId=${enc(code.warehouseA)}`);
  await step('창고위치', 'UPDATE', 'PUT', `/inventory/warehouse-locations/${enc(`${code.warehouseA}::${code.location}`)}`, {
    locationName: 'CRUD 테스트 로케이션 수정',
    zone: 'Z2',
  });

  await step('창고이동규칙', 'CREATE', 'POST', '/master/transfer-rules', {
    fromWarehouseId: code.warehouseA,
    toWarehouseId: code.warehouseB,
    allowYn: 'Y',
    remark: 'CRUD 테스트 이동규칙',
  });
  await duplicateLastCreate('창고이동규칙');
  deferCleanup('창고이동규칙', 'DELETE', `/master/transfer-rules/${enc(code.warehouseA)}/${enc(code.warehouseB)}`);
  await step('창고이동규칙', 'READ_LIST', 'GET', `/master/transfer-rules?fromWarehouseId=${enc(code.warehouseA)}&toWarehouseId=${enc(code.warehouseB)}`);
  await step('창고이동규칙', 'UPDATE', 'PUT', `/master/transfer-rules/${enc(code.warehouseA)}/${enc(code.warehouseB)}`, {
    allowYn: 'N',
    remark: 'CRUD 테스트 이동규칙 수정',
  });

  await step('설비', 'CREATE', 'POST', '/equipment/equips', {
    equipCode: code.equip,
    equipName: 'CRUD 테스트 설비',
    equipType: 'AUTO_CRIMP',
    lineCode: code.line,
    processCode: code.process,
    commType: 'TCP',
    ipAddress: '127.0.0.1',
    port: 1502,
    status: 'NORMAL',
    useYn: 'Y',
  });
  await duplicateLastCreate('설비');
  deferCleanup('설비', 'DELETE', `/equipment/equips/${enc(code.equip)}`);
  await step('설비', 'READ', 'GET', `/equipment/equips/${enc(code.equip)}`);
  await step('설비', 'UPDATE', 'PUT', `/equipment/equips/${enc(code.equip)}`, {
    equipName: 'CRUD 테스트 설비 수정',
    equipType: 'AUTO_CRIMP',
    lineCode: code.line,
    processCode: code.process,
    status: 'NORMAL',
  });
  await step('공정-설비매핑', 'CREATE', 'POST', `/master/processes/${enc(code.process)}/equipments`, {
    equipCode: code.equip,
  });
  await duplicateLastCreate('공정-설비매핑');
  deferCleanup('공정-설비매핑', 'DELETE', `/master/processes/${enc(code.process)}/equipments/${enc(code.equip)}`);
  await step('공정-설비매핑', 'READ_LIST', 'GET', `/master/processes/${enc(code.process)}/equipments`);

  await step('BOM', 'CREATE', 'POST', '/master/boms', {
    parentItemCode: code.fgPart,
    childItemCode: code.rawPart,
    qtyPer: 2,
    seq: 1,
    revision: 'A',
    bomGrp: code.fgPart,
    processCode: code.process,
    useYn: 'Y',
  });
  await duplicateLastCreate('BOM');
  const bomId = `${code.fgPart}::${code.rawPart}::A`;
  deferCleanup('BOM', 'DELETE', `/master/boms/${enc(bomId)}`);
  await step('BOM', 'READ', 'GET', `/master/boms/${enc(bomId)}`);
  await step('BOM', 'UPDATE', 'PUT', `/master/boms/${enc(bomId)}`, {
    qtyPer: 3,
    seq: 2,
    remark: 'CRUD 테스트 BOM 수정',
  });
  await step('BOM', 'READ_HIERARCHY', 'GET', `/master/boms/hierarchy/${enc(code.fgPart)}`);

  await step('라우팅그룹', 'CREATE', 'POST', '/master/routing-groups', {
    routingCode: code.routing,
    routingName: 'CRUD 테스트 라우팅',
    itemCode: code.fgPart,
    useYn: 'Y',
  });
  await duplicateLastCreate('라우팅그룹');
  deferCleanup('라우팅그룹', 'DELETE', `/master/routing-groups/${enc(code.routing)}`);
  await step('라우팅그룹', 'READ', 'GET', `/master/routing-groups/${enc(code.routing)}`);
  await step('라우팅그룹', 'UPDATE', 'PUT', `/master/routing-groups/${enc(code.routing)}`, {
    routingName: 'CRUD 테스트 라우팅 수정',
    itemCode: code.fgPart,
  });
  await step('라우팅공정', 'CREATE', 'POST', `/master/routing-groups/${enc(code.routing)}/processes`, {
    routingCode: code.routing,
    seq: 1,
    processCode: code.process,
    processName: 'CRUD 테스트 공정 수정',
    processType: 'ASSEMBLY',
    equipType: 'AUTO_CRIMP',
    stdTime: 12,
    useYn: 'Y',
  });
  await duplicateLastCreate('라우팅공정');
  deferCleanup('라우팅공정', 'DELETE', `/master/routing-groups/${enc(code.routing)}/processes/1`);
  await step('라우팅공정', 'READ_LIST', 'GET', `/master/routing-groups/${enc(code.routing)}/processes`);
  await step('라우팅공정', 'UPDATE', 'PUT', `/master/routing-groups/${enc(code.routing)}/processes/1`, {
    routingCode: code.routing,
    seq: 1,
    processCode: code.process,
    processName: 'CRUD 테스트 공정 수정',
    stdTime: 10,
  });
  await step('라우팅조건', 'UPSERT_BULK', 'PUT', `/master/routing-groups/${enc(code.routing)}/processes/1/conditions/bulk`, {
    conditions: [{ conditionSeq: 1, conditionCode: 'TORQUE', minValue: 1, maxValue: 5, unit: 'N' }],
  });
  await step('라우팅조건', 'READ_LIST', 'GET', `/master/routing-groups/${enc(code.routing)}/processes/1/conditions`);
  await step('라우팅자재', 'UPSERT_BULK', 'PUT', `/master/routing-groups/${enc(code.routing)}/processes/1/materials/bulk`, {
    materials: [{ childItemCode: code.rawPart, allocQty: 1, issueMethod: 'BACKFLUSH' }],
  });
  await step('라우팅자재', 'READ_LIST', 'GET', `/master/routing-groups/${enc(code.routing)}/processes/1/materials`);

  await step('공정CAPA', 'CREATE', 'POST', '/master/process-capas', {
    processCode: code.process,
    itemCode: code.fgPart,
    stdTactTime: 12,
    workerCnt: 1,
    equipCnt: 1,
    balanceEff: 90,
    useYn: 'Y',
  });
  await duplicateLastCreate('공정CAPA');
  deferCleanup('공정CAPA', 'DELETE', `/master/process-capas/${enc(code.process)}/${enc(code.fgPart)}`);
  await step('공정CAPA', 'READ_LIST', 'GET', `/master/process-capas?processCode=${enc(code.process)}&itemCode=${enc(code.fgPart)}`);
  await step('공정CAPA', 'UPDATE', 'PUT', `/master/process-capas/${enc(code.process)}/${enc(code.fgPart)}`, {
    stdTactTime: 10,
    workerCnt: 2,
    balanceEff: 88,
  });

  await step('제조사바코드', 'CREATE', 'POST', '/master/vendor-barcode-mappings', {
    vendorBarcode: `VB-${stamp}`,
    itemCode: code.rawPart,
    itemName: 'CRUD 테스트 원자재 수정',
    vendorCode: code.partner,
    vendorName: 'CRUD 테스트 거래처 수정',
    matchType: 'EXACT',
    useYn: 'Y',
  });
  await duplicateLastCreate('제조사바코드');
  deferCleanup('제조사바코드', 'DELETE', `/master/vendor-barcode-mappings/${enc(`VB-${stamp}`)}`);
  await step('제조사바코드', 'READ', 'GET', `/master/vendor-barcode-mappings/${enc(`VB-${stamp}`)}`);
  await step('제조사바코드', 'UPDATE', 'PUT', `/master/vendor-barcode-mappings/${enc(`VB-${stamp}`)}`, {
    itemCode: code.rawPart,
    vendorName: 'CRUD 테스트 거래처 재수정',
    remark: 'CRUD 테스트 바코드 수정',
  });
  await step('제조사바코드', 'RESOLVE', 'POST', '/master/vendor-barcode-mappings/resolve', {
    barcode: `VB-${stamp}`,
  });

  await step('IQC검사항목풀', 'CREATE', 'POST', '/master/iqc-item-pool', {
    inspItemCode: code.iqcPool,
    inspItemName: 'CRUD 테스트 IQC 항목',
    judgeMethod: 'MEASURE',
    criteria: '1.0-5.0',
    lsl: 1,
    usl: 5,
    unit: 'mm',
    revision: 1,
    effectiveDate: today,
    useYn: 'Y',
  });
  await duplicateLastCreate('IQC검사항목풀');
  deferCleanup('IQC검사항목풀', 'DELETE', `/master/iqc-item-pool/${enc(code.iqcPool)}`);
  await step('IQC검사항목풀', 'READ', 'GET', `/master/iqc-item-pool/${enc(code.iqcPool)}`);
  await step('IQC검사항목풀', 'UPDATE', 'PUT', `/master/iqc-item-pool/${enc(code.iqcPool)}`, {
    inspItemName: 'CRUD 테스트 IQC 항목 수정',
    judgeMethod: 'MEASURE',
    lsl: 2,
    usl: 6,
    unit: 'mm',
  });

  await step('IQC품목검사', 'CREATE', 'POST', '/master/iqc-items', {
    itemCode: code.rawPart,
    seq: 1,
    inspectItem: 'CRUD 테스트 IQC 항목',
    spec: '2-6mm',
    lsl: 2,
    usl: 6,
    unit: 'mm',
    useYn: 'Y',
  });
  await duplicateLastCreate('IQC품목검사');
  deferCleanup('IQC품목검사', 'DELETE', `/master/iqc-items/${enc(code.rawPart)}/1`);
  await step('IQC품목검사', 'READ', 'GET', `/master/iqc-items/${enc(code.rawPart)}/1`);
  await step('IQC품목검사', 'UPDATE', 'PUT', `/master/iqc-items/${enc(code.rawPart)}/1`, {
    inspectItem: 'CRUD 테스트 IQC 항목 수정',
    spec: '3-6mm',
    lsl: 3,
    usl: 6,
    unit: 'mm',
  });

  await step('IQC품목규격', 'UPSERT', 'POST', '/master/iqc-part-specs', {
    itemCode: code.rawPart,
    sampleQty: 1,
    isDest: 'N',
    useYn: 'Y',
    items: [{ seq: 1, inspItemCode: code.iqcPool, lsl: 3, usl: 6, judgeCriteria: '3-6mm', useYn: 'Y' }],
  });
  deferCleanup('IQC품목규격', 'DELETE', `/master/iqc-part-specs/${enc(code.rawPart)}`);
  await step('IQC품목규격', 'READ', 'GET', `/master/iqc-part-specs/${enc(code.rawPart)}`);

  await step('설비점검항목마스터', 'CREATE', 'POST', '/master/equip-inspect-item-masters', {
    itemCode: code.equipInspectItem,
    itemName: 'CRUD 테스트 설비점검',
    inspectType: 'DAILY',
    equipType: 'AUTO_CRIMP',
    criteria: '정상',
    cycle: 'DAILY',
    itemType: 'VISUAL',
    useYn: 'Y',
  });
  await duplicateLastCreate('설비점검항목마스터');
  deferCleanup('설비점검항목마스터', 'DELETE', `/master/equip-inspect-item-masters/${enc(code.equipInspectItem)}`);
  await step('설비점검항목마스터', 'READ_LIST', 'GET', `/master/equip-inspect-item-masters?search=${enc(code.equipInspectItem)}`);
  await step('설비점검항목마스터', 'UPDATE', 'PUT', `/master/equip-inspect-item-masters/${enc(code.equipInspectItem)}`, {
    itemName: 'CRUD 테스트 설비점검 수정',
    inspectType: 'DAILY',
    equipType: 'AUTO_CRIMP',
    criteria: '정상 수정',
    cycle: 'DAILY',
    itemType: 'VISUAL',
  });

  await step('설비점검매핑', 'CREATE', 'POST', '/master/equip-inspect-items', {
    equipCode: code.equip,
    itemCode: code.equipInspectItem,
    inspectType: 'DAILY',
    sortSeq: 1,
    useYn: 'Y',
  });
  await duplicateLastCreate('설비점검매핑');
  deferCleanup('설비점검매핑', 'DELETE', `/master/equip-inspect-items/${enc(code.equip)}/${enc(code.equipInspectItem)}/DAILY`);
  await step('설비점검매핑', 'READ_LIST', 'GET', `/master/equip-inspect-items?equipCode=${enc(code.equip)}`);

  await step('라벨템플릿', 'CREATE', 'POST', '/master/label-templates', {
    templateName: code.labelTemplate,
    category: 'part',
    designData: { width: 60, height: 30, fields: [{ type: 'text', value: 'CRUD' }] },
    printMode: 'BROWSER',
    isDefault: false,
    remark: 'CRUD 테스트 라벨',
  });
  await duplicateLastCreate('라벨템플릿');
  deferCleanup('라벨템플릿', 'DELETE', `/master/label-templates/${enc(`${code.labelTemplate}::part`)}`);
  await step('라벨템플릿', 'READ', 'GET', `/master/label-templates/${enc(`${code.labelTemplate}::part`)}`);
  await step('라벨템플릿', 'UPDATE', 'PUT', `/master/label-templates/${enc(`${code.labelTemplate}::part`)}`, {
    designData: { width: 70, height: 30, fields: [{ type: 'text', value: 'CRUD-UPDATED' }] },
    remark: 'CRUD 테스트 라벨 수정',
  });

  await step('작업지도서', 'CREATE', 'POST', '/master/work-instructions', {
    itemCode: code.fgPart,
    processCode: code.process,
    title: 'CRUD 테스트 작업지도서',
    content: '기준정보 CRUD 자동점검',
    revision: 'A',
    useYn: 'Y',
  });
  await duplicateLastCreate('작업지도서');
  const workInstructionId = `${code.fgPart}::${code.process}::A`;
  deferCleanup('작업지도서', 'DELETE', `/master/work-instructions/${enc(workInstructionId)}`);
  await step('작업지도서', 'READ', 'GET', `/master/work-instructions/${enc(workInstructionId)}`);
  await step('작업지도서', 'UPDATE', 'PUT', `/master/work-instructions/${enc(workInstructionId)}`, {
    title: 'CRUD 테스트 작업지도서 수정',
    content: '기준정보 CRUD 자동점검 수정',
  });

  await step('교대패턴', 'CREATE', 'POST', '/master/shift-patterns', {
    shiftCode: code.shift,
    shiftName: 'CRUD 주간',
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
    workMinutes: 480,
    sortOrder: 1,
  });
  await duplicateLastCreate('교대패턴');
  deferCleanup('교대패턴', 'DELETE', `/master/shift-patterns/${enc(code.shift)}`);
  await step('교대패턴', 'READ_LIST', 'GET', '/master/shift-patterns');
  await step('교대패턴', 'UPDATE', 'PUT', `/master/shift-patterns/${enc(code.shift)}`, {
    shiftName: 'CRUD 주간 수정',
    startTime: '08:00',
    endTime: '17:30',
    breakMinutes: 60,
    workMinutes: 510,
    sortOrder: 2,
  });

  await step('작업달력', 'CREATE', 'POST', '/master/work-calendars', {
    calendarId: code.calendar,
    calendarYear: String(new Date().getUTCFullYear()),
    processCd: code.process,
    defaultShiftCount: 1,
    defaultShifts: code.shift,
    remark: 'CRUD 테스트 작업달력',
  });
  await duplicateLastCreate('작업달력');
  deferCleanup('작업달력', 'DELETE', `/master/work-calendars/${enc(code.calendar)}`);
  await step('작업달력', 'READ', 'GET', `/master/work-calendars/${enc(code.calendar)}`);
  await step('작업달력', 'UPDATE', 'PUT', `/master/work-calendars/${enc(code.calendar)}`, {
    remark: 'CRUD 테스트 작업달력 수정',
    defaultShiftCount: 1,
    defaultShifts: code.shift,
  });
  await step('작업달력', 'GENERATE', 'POST', `/master/work-calendars/${enc(code.calendar)}/generate`, {
    saturdayWork: false,
    sundayWork: false,
  });
  await step('작업달력', 'READ_DAYS', 'GET', `/master/work-calendars/${enc(code.calendar)}/days?month=${today.slice(0, 7)}`);

  await step('설비BOM품목', 'CREATE', 'POST', '/master/equip-bom/items', {
    bomItemCode: code.equipBomItem,
    bomItemName: 'CRUD 테스트 설비부품',
    itemType: 'PART',
    spec: 'CRUD-SPEC',
    unit: 'EA',
    unitPrice: 1000,
    replacementCycle: 30,
    stockQty: 0,
    safetyStock: 0,
    useYn: 'Y',
  });
  await duplicateLastCreate('설비BOM품목');
  deferCleanup('설비BOM품목', 'DELETE', `/master/equip-bom/items/${enc(code.equipBomItem)}`);
  await step('설비BOM품목', 'READ', 'GET', `/master/equip-bom/items/${enc(code.equipBomItem)}`);
  await step('설비BOM품목', 'UPDATE', 'PUT', `/master/equip-bom/items/${enc(code.equipBomItem)}`, {
    bomItemName: 'CRUD 테스트 설비부품 수정',
    itemType: 'PART',
    unitPrice: 1200,
  });
  await step('설비BOM관계', 'CREATE', 'POST', '/master/equip-bom/rels', {
    equipCode: code.equip,
    bomItemId: code.equipBomItem,
    quantity: 1,
    installDate: today,
    expireDate: nextYear,
    useYn: 'Y',
  });
  await duplicateLastCreate('설비BOM관계');
  deferCleanup('설비BOM관계', 'DELETE', `/master/equip-bom/rels/${enc(code.equip)}/${enc(code.equipBomItem)}`);
  await step('설비BOM관계', 'READ', 'GET', `/master/equip-bom/rels/${enc(code.equip)}/${enc(code.equipBomItem)}`);
  await step('설비BOM관계', 'UPDATE', 'PUT', `/master/equip-bom/rels/${enc(code.equip)}/${enc(code.equipBomItem)}`, {
    quantity: 2,
    remark: 'CRUD 테스트 설비BOM 관계 수정',
  });

  await step('계측기', 'CREATE', 'POST', '/quality/msa/gauges', {
    gaugeCode: code.gauge,
    gaugeName: 'CRUD 테스트 계측기',
    gaugeType: 'CALIPER',
    manufacturer: 'Codex',
    model: 'CRUD-1',
    serialNo: `SN-${stamp}`,
    resolution: 0.01,
    measureRange: '0-150mm',
    calibrationCycle: 12,
    lastCalibrationDate: today,
    nextCalibrationDate: nextYear,
    status: 'ACTIVE',
    location: code.warehouseA,
    responsiblePerson: code.worker,
  });
  await duplicateLastCreate('계측기');
  deferCleanup('계측기', 'DELETE', `/quality/msa/gauges/${enc(code.gauge)}`);
  await step('계측기', 'READ', 'GET', `/quality/msa/gauges/${enc(code.gauge)}`);
  await step('계측기', 'UPDATE', 'PUT', `/quality/msa/gauges/${enc(code.gauge)}`, {
    gaugeName: 'CRUD 테스트 계측기 수정',
    gaugeType: 'CALIPER',
    calibrationCycle: 6,
    status: 'ACTIVE',
  });

  while (cleanupStack.length > 0) {
    await cleanupStack.pop()();
  }

  await expectGone('계측기', `/quality/msa/gauges/${enc(code.gauge)}`);
  await expectGone('작업지도서', `/master/work-instructions/${enc(workInstructionId)}`);
  await expectGone('라벨템플릿', `/master/label-templates/${enc(`${code.labelTemplate}::part`)}`);
  await expectGone('설비', `/equipment/equips/${enc(code.equip)}`);
  await expectGone('창고-A', `/inventory/warehouses/${enc(code.warehouseA)}`);
  await expectGone('품목-원자재', `/master/parts/${enc(code.rawPart)}`);
  await expectGone('공통코드', `/master/com-codes/${enc(`${code.comGroup}::${code.comDetail}`)}`);

  if (evidence.failures.length > 0) {
    throw new Error(`기준정보 CRUD 실패 ${evidence.failures.length}건`);
  }
}

try {
  await main();
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error);
  while (cleanupStack.length > 0) {
    await cleanupStack.pop()();
  }
} finally {
  const out = `docs/reports/hanes-master-crud-runtime-test-${stamp}.json`;
  await fs.mkdir('docs/reports', { recursive: true });
  await fs.writeFile(out, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    out,
    total: evidence.summary.total,
    passed: evidence.summary.passed,
    failed: evidence.summary.failed,
    cleanup: evidence.cleanup.length,
    failures: evidence.failures.length,
    error: evidence.error ?? null,
  }, null, 2));
  if (evidence.failures.length > 0 || evidence.error) {
    process.exitCode = 1;
  }
}
