import fs from 'node:fs/promises';

const base = process.env.HANES_API_BASE ?? 'http://localhost:3003/api/v1';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const company = process.env.HANES_COMPANY ?? '40';
const plant = process.env.HANES_PLANT ?? '1000';
const stamp = process.env.HANES_TEST_STAMP
  ?? `${new Date().toISOString().replace(/\D/g, '').slice(2, 14)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
const today = new Date().toISOString().slice(0, 10);

const itemCode = process.env.HANES_IQC_ITEM ?? 'HSG0001';
const itemName = process.env.HANES_IQC_ITEM_NAME ?? '하우징';
const orderedQty = Number(process.env.HANES_IQC_ORDER_QTY ?? 60);
const expectedSerialCount = Number(process.env.HANES_IQC_SERIAL_COUNT ?? 3);
const arrivalWarehouse = process.env.HANES_IQC_ARRIVAL_WAREHOUSE ?? 'W001';
const receiveWarehouse = process.env.HANES_IQC_RECEIVE_WAREHOUSE ?? 'RM_MAIN';
const supplierCode = process.env.HANES_IQC_SUPPLIER ?? 'VND-001';
const supplierName = process.env.HANES_IQC_SUPPLIER_NAME ?? '한국단자공업';
const mfgPartnerCode = process.env.HANES_IQC_MFG ?? 'M001';
const workerId = process.env.HANES_IQC_WORKER ?? token;
const poNo = `PO-IQC3-${stamp}`;

const headers = {
  Authorization: `Bearer ${token}`,
  'X-Company': company,
  'X-Plant': plant,
};

const evidence = {
  executedAt: new Date().toISOString(),
  base,
  company,
  plant,
  stamp,
  scenario: '수입검사(IQC) 절차대로 시리얼 3개 PASS 처리 후 입고 기록',
  inputs: {
    poNo,
    itemCode,
    orderedQty,
    expectedSerialCount,
    arrivalWarehouse,
    receiveWarehouse,
    supplierCode,
    mfgPartnerCode,
  },
  steps: [],
  summary: { total: 0, passed: 0, failed: 0 },
  result: {},
  failures: [],
};

async function rawApi(method, path, body) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
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
    'poNo', 'status', 'arrivalNo', 'seq', 'itemCode', 'itemName', 'matUid',
    'initQty', 'currentQty', 'qty', 'iqcStatus', 'result', 'inspectDate',
    'inspectType', 'sampleBarcode', 'affectedSerials', 'receiveNo', 'transNo',
    'warehouseCode', 'arrivalWarehouseCode', 'arrivalWarehouseName',
    'remainingQty', 'certRequired', 'certUploaded', 'path', 'total', 'page', 'limit',
  ];
  const out = {};
  for (const key of keys) {
    if (value[key] !== undefined) out[key] = value[key];
  }
  return Object.keys(out).length > 0 ? out : value;
}

async function step(name, method, path, body, validate) {
  const entry = { name, method, path, request: body ?? null, ok: false };
  evidence.steps.push(entry);
  evidence.summary.total++;
  const result = await rawApi(method, path, body);
  entry.status = result.status;
  entry.response = compact(unwrap(result.json));
  const data = unwrap(result.json);
  const ok = result.ok && (!validate || validate(data));
  entry.ok = ok;
  if (ok) {
    evidence.summary.passed++;
    return data;
  }
  evidence.summary.failed++;
  entry.error = result.text;
  evidence.failures.push({ name, method, path, status: result.status, error: result.text });
  throw new Error(`${name} failed: ${method} ${path} ${result.status} ${result.text}`);
}

function enc(value) {
  return encodeURIComponent(value);
}

function getReceiveNo(receivingRows) {
  const row = Array.isArray(receivingRows) ? receivingRows[0] : receivingRows;
  return row?.receiveNo ?? row?.refId?.split?.('-')?.[0] ?? null;
}

async function main() {
  await step('서버/DB health 확인', 'GET', '/health');

  await step('구매발주 생성', 'POST', '/material/purchase-orders', {
    poNo,
    partnerId: supplierCode,
    partnerName: supplierName,
    orderDate: today,
    dueDate: today,
    remark: 'IQC 시리얼 3개 절차 테스트',
    items: [{
      lineNo: 1,
      revNo: 1,
      itemCode,
      itemName,
      orderQty: orderedQty,
      unitPrice: 100,
      remark: 'IQC 시리얼 3개 테스트',
    }],
  });

  await step('구매발주 확정', 'PATCH', `/material/purchase-orders/${enc(poNo)}/confirm`);

  const arrival = await step('PO 라인 입하 및 시리얼 3개 생성', 'POST', '/material/arrivals/po-line', {
    poNo,
    lineNo: 1,
    revNo: 1,
    receivedQty: orderedQty,
    mfgPartnerCode,
    receivedDate: today,
    warehouseCode: arrivalWarehouse,
    remark: 'IQC 시리얼 3개 절차 테스트 입하',
  }, (data) => data?.arrivalNo && Array.isArray(data?.serials) && data.serials.length === expectedSerialCount);

  const arrivalNo = arrival.arrivalNo;
  const arrivalSerials = arrival.serials.map((row) => ({
    matUid: row.matUid,
    initQty: row.initQty,
    iqcStatus: row.iqcStatus,
  }));
  evidence.result.arrivalNo = arrivalNo;
  evidence.result.arrivalSerials = arrivalSerials;

  const pendingArrivals = await step('IQC 대기 입하 목록 확인', 'GET', `/material/iqc-history/pending-arrivals?search=${enc(arrivalNo)}`, undefined, (data) => {
    const rows = Array.isArray(data) ? data : data?.data ?? [];
    return rows.some((row) => row.arrivalNo === arrivalNo && row.itemCode === itemCode && Number(row.serialCount) === expectedSerialCount);
  });
  evidence.result.pendingArrivals = pendingArrivals;

  const pendingSerials = await step('IQC 대기 시리얼 3개 확인', 'GET', `/material/iqc-history/pending-serials?arrivalNo=${enc(arrivalNo)}&itemCode=${enc(itemCode)}`, undefined, (data) => {
    return Array.isArray(data) && data.length === expectedSerialCount && data.every((row) => row.matUid);
  });
  const matUids = pendingSerials.map((row) => row.matUid);
  evidence.result.pendingSerials = pendingSerials.map((row) => ({
    matUid: row.matUid,
    initQty: row.initQty,
    iqcStatus: 'PENDING',
  }));

  const details = JSON.stringify({
    inspectedSerials: matUids.map((matUid, idx) => ({
      seq: idx + 1,
      matUid,
      visual: 'OK',
      measuredValue: 3.5 + idx / 10,
      judgement: 'PASS',
    })),
  });
  const iqc = await step('IQC 입하단위 PASS 판정', 'POST', '/material/iqc-history/arrival', {
    arrivalNo,
    itemCode,
    result: 'PASS',
    inspectorName: 'Codex IQC tester',
    inspectType: 'INITIAL',
    sampleQty: 0,
    sampleBarcode: matUids.join(','),
    details,
    remark: '시리얼 3개 전수 확인 PASS',
  }, (data) => data?.result === 'PASS' && Number(data?.affectedSerials) === expectedSerialCount);
  evidence.result.iqc = iqc;

  const afterIqcSerials = await step('IQC 후 입하실적 시리얼 PASS 확인', 'GET', `/material/arrivals/results/${enc(arrivalNo)}/serials?itemCode=${enc(itemCode)}`, undefined, (data) => {
    return Array.isArray(data) && data.length === expectedSerialCount && data.every((row) => row.iqcStatus === 'PASS');
  });
  evidence.result.afterIqcSerials = afterIqcSerials;

  const form = new FormData();
  form.append(
    'file',
    new Blob([`IQC serial 3 PASS certificate\npo=${poNo}\narrival=${arrivalNo}\nserials=${matUids.join(',')}\n`], { type: 'text/plain' }),
    `iqc-serial3-${stamp}.txt`,
  );
  const cert = await step('검사성적서 업로드', 'POST', `/material/iqc-history/${enc(iqc.inspectDate)}/${iqc.seq}/upload-cert`, form, (data) => !!data?.certFilePath);
  evidence.result.certFilePath = cert.certFilePath;

  const receivableChecks = [];
  for (const matUid of matUids) {
    const receivable = await step(`입고 가능 시리얼 확인 ${matUid}`, 'GET', `/material/receiving/receivable/by-barcode/${enc(matUid)}`, undefined, (data) => {
      return data?.matUid === matUid && data?.certUploaded === true && Number(data?.remainingQty) > 0;
    });
    receivableChecks.push({
      matUid: receivable.matUid,
      remainingQty: receivable.remainingQty,
      certUploaded: receivable.certUploaded,
      arrivalWarehouseCode: receivable.arrivalWarehouseCode,
    });
  }
  evidence.result.receivableChecks = receivableChecks;

  const receiving = await step('시리얼 3개 일괄 입고 처리', 'POST', '/material/receiving', {
    workerId,
    items: pendingSerials.map((row, idx) => ({
      matUid: row.matUid,
      qty: Number(row.initQty),
      warehouseCode: receiveWarehouse,
      vendorBarcode: `IQC3-VBC-${stamp}-${idx + 1}`,
      remark: 'IQC 시리얼 3개 PASS 후 입고',
    })),
  }, (data) => Array.isArray(data) && data.length === expectedSerialCount);
  evidence.result.receiving = receiving.map((row) => ({
    receiveNo: row.receiveNo,
    transNo: row.transNo,
    matUid: row.matUid,
    qty: row.qty,
  }));
  evidence.result.receiveNo = getReceiveNo(receiving);

  const receivingHistory = await step('입고 이력 조회 확인', 'GET', `/material/receiving?matUid=${enc(matUids[0])}`, undefined, (data) => {
    const rows = data?.data ?? data ?? [];
    return Array.isArray(rows) && rows.some((row) => row.lot?.matUid === matUids[0] || row.matUid === matUids[0]);
  });
  evidence.result.receivingHistory = receivingHistory;

  const stockChecks = [];
  for (const matUid of matUids) {
    const stock = await step(`입고 재고 확인 ${matUid}`, 'GET', `/inventory/stocks?itemCode=${enc(itemCode)}&matUid=${enc(matUid)}&warehouseCode=${enc(receiveWarehouse)}`, undefined, (data) => {
      const rows = data?.data ?? data ?? [];
      return Array.isArray(rows)
        ? rows.some((row) => row.matUid === matUid && Number(row.qty) > 0)
        : Number(data?.qty) > 0;
    });
    stockChecks.push({ matUid, stock: compact(stock) });
  }
  evidence.result.stockChecks = stockChecks;
}

try {
  await main();
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error);
} finally {
  const out = `docs/reports/hanes-iqc-serial3-runtime-test-${stamp}.json`;
  await fs.mkdir('docs/reports', { recursive: true });
  await fs.writeFile(out, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    out,
    poNo,
    arrivalNo: evidence.result.arrivalNo ?? null,
    matUids: evidence.result.pendingSerials?.map((row) => row.matUid) ?? [],
    receiveNo: evidence.result.receiveNo ?? null,
    total: evidence.summary.total,
    passed: evidence.summary.passed,
    failed: evidence.summary.failed,
    failures: evidence.failures.length,
    error: evidence.error ?? null,
  }, null, 2));
  if (evidence.error || evidence.failures.length > 0) process.exitCode = 1;
}
