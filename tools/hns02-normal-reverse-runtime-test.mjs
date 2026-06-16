import fs from 'node:fs/promises';

const base = process.env.HANES_API_BASE ?? 'http://localhost:3003/api/v1';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const company = process.env.HANES_COMPANY ?? '40';
const plant = process.env.HANES_PLANT ?? '1000';
const stamp = process.env.HANES_TEST_STAMP
  ?? `${new Date().toISOString().replace(/\D/g, '').slice(2, 14)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
const today = new Date().toISOString().slice(0, 10);

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
  setup: {},
  normal: {},
  reverse: {},
  deletes: {},
  checks: {},
};

async function api(method, path, body, opts = {}) {
  const init = {
    method,
    headers: { ...headers },
  };
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
  if (!res.ok || json?.success === false) {
    const error = new Error(`${method} ${path} failed: ${res.status} ${text}`);
    error.response = json;
    throw error;
  }
  if (opts.keepRaw) return json;
  return json?.data ?? json;
}

function idOf(row, ...keys) {
  for (const key of keys) {
    if (row && row[key] != null) return row[key];
  }
  return undefined;
}

async function setupMaterial(qty) {
  const poNo = `PO-NR-${stamp}`;
  await api('POST', '/material/purchase-orders', {
    poNo,
    partnerId: 'VND-001',
    partnerName: '한국단자공업',
    orderDate: today,
    dueDate: today,
    remark: '정상/역처리 통합 재테스트 PO',
    items: [{
      lineNo: 1,
      revNo: 1,
      itemCode: 'HSG0001',
      itemName: '하우징',
      orderQty: qty,
      unitPrice: 100,
      remark: '정상/역처리 통합 재테스트',
    }],
  });
  await api('PATCH', `/material/purchase-orders/${encodeURIComponent(poNo)}/confirm`);
  const arrival = await api('POST', '/material/arrivals/po-line', {
    poNo,
    lineNo: 1,
    revNo: 1,
    receivedQty: qty,
    mfgPartnerCode: 'M001',
    receivedDate: today,
    warehouseCode: 'W001',
    remark: '정상/역처리 통합 재테스트 입하',
  });
  const arrivalNo = idOf(arrival, 'arrivalNo', 'ARRIVAL_NO');
  const iqc = await api('POST', '/material/iqc-history/arrival', {
    arrivalNo,
    itemCode: 'HSG0001',
    result: 'PASS',
    inspectorName: 'Codex runtime test',
    remark: '정상/역처리 통합 재테스트 IQC PASS',
  });
  const form = new FormData();
  form.append('file', new Blob(['HNS02 normal/reverse runtime test certificate\n'], { type: 'text/plain' }), `hns02-${stamp}.txt`);
  await api('POST', `/material/iqc-history/${encodeURIComponent(iqc.inspectDate)}/${iqc.seq}/upload-cert`, form);
  const labels = await api('POST', '/material/receive-label/create', {
    arrivalId: arrivalNo,
    arrivalSeq: 1,
    qty,
    supUid: `SUP-NR-${stamp}`,
  });
  const matUids = labels.map((row) => row.matUid);
  const receiving = await api('POST', '/material/receiving', {
    workerId: token,
    items: matUids.map((matUid) => ({
      matUid,
      qty: 1,
      warehouseCode: 'W001',
      vendorBarcode: `VBC-${matUid}`,
      remark: '정상/역처리 통합 재테스트 입고',
    })),
  });
  evidence.setup = { poNo, arrivalNo, iqc, matUids, receiving };
  return matUids;
}

async function produceOne(kind, matUid) {
  const orderNo = `JO-${kind}-${stamp}`;
  await api('POST', '/production/job-orders', {
    orderNo,
    itemCode: 'HNS02',
    lineCode: 'LINE-01',
    planQty: 1,
    planDate: today,
    processCode: 'MASSY',
    remark: `${kind} 정상/역처리 통합 재테스트`,
  });
  await api('POST', `/production/job-orders/${encodeURIComponent(orderNo)}/start`);

  const issueRequest = await api('POST', '/material/issue-requests', {
    orderNo,
    issueType: 'PROD',
    remark: `${kind} 정상/역처리 통합 재테스트 자재요청`,
    items: [{ itemCode: 'HSG0001', requestQty: 1, unit: 'EA', remark: matUid }],
  });
  const requestNo = idOf(issueRequest, 'requestNo', 'id');
  await api('PATCH', `/material/issue-requests/${encodeURIComponent(requestNo)}/approve`);
  const requestDetail = await api('GET', `/material/issue-requests/${encodeURIComponent(requestNo)}`);
  const requestItem = (requestDetail.items ?? requestDetail.requestItems ?? [])[0];
  const requestItemId = idOf(requestItem, 'id', 'requestItemId', 'seq');
  const issue = await api('POST', `/material/issue-requests/${encodeURIComponent(requestNo)}/issue`, {
    workerId: token,
    warehouseCode: 'W001',
    issueType: 'PROD',
    remark: `${kind} 정상/역처리 통합 재테스트 출고`,
    items: [{ requestItemId, matUid, issueQty: 1 }],
  });

  const result = await api('POST', '/production/prod-results', {
    orderNo,
    workerId: token,
    processCode: 'MASSY',
    goodQty: 0,
    defectQty: 0,
    remark: `${kind} 정상/역처리 통합 재테스트 실적`,
  });
  const resultNo = idOf(result, 'resultNo', 'id');
  const labels = await api('POST', '/production/product-label/create', {
    sourceId: resultNo,
    source: 'PROD_RESULT',
    qty: 1,
  });
  const prdUid = labels[0].prdUid;
  await api('POST', `/production/prod-results/${encodeURIComponent(resultNo)}/complete`, {
    goodQty: 1,
    defectQty: 0,
    endAt: new Date().toISOString(),
    remark: `${kind} 생산 완료`,
  });
  const fgReceive = await api('POST', '/inventory/fg/receive', {
    warehouseId: 'FG_MAIN',
    itemCode: 'HNS02',
    prdUid,
    qty: 1,
    orderNo,
    processCode: 'MASSY',
    refType: 'PROD_RESULT',
    refId: resultNo,
    workerId: token,
    remark: `${kind} 제품입고`,
  });

  return { orderNo, requestNo, requestItemId, issue, resultNo, prdUid, fgReceive };
}

async function shipOne(kind, prdUid) {
  const boxNo = `BX-${kind}-${stamp}`;
  const shipOrderNo = `SO-${kind}-${stamp}`;
  await api('POST', '/shipping/boxes', { boxNo, itemCode: 'HNS02', qty: 0 });
  await api('POST', `/shipping/boxes/${encodeURIComponent(boxNo)}/serials`, { serials: [prdUid] });
  await api('POST', `/shipping/boxes/${encodeURIComponent(boxNo)}/close`);
  const oqcNo = await findAutoOqcNo(boxNo);
  await api('POST', `/quality/oqc/${encodeURIComponent(oqcNo)}/execute`, {
    result: 'PASS',
    inspectorName: 'Codex runtime test',
    sampleBoxIds: [boxNo],
    details: JSON.stringify({ scenario: kind, stamp }),
  });
  await api('POST', '/shipping/orders', {
    shipOrderNo,
    customerId: 'CUS-001',
    customerName: '현대자동차',
    dueDate: today,
    shipDate: today,
    remark: `${kind} 정상/역처리 통합 재테스트 출하지시`,
    items: [{ itemCode: 'HNS02', orderQty: 1 }],
  });
  await api('PUT', `/shipping/orders/${encodeURIComponent(shipOrderNo)}/confirm`);
  const shipped = await api('POST', `/shipping/orders/${encodeURIComponent(shipOrderNo)}/ship-box`, {
    boxNo,
    workerId: token,
  });
  return { boxNo, oqcNo, shipOrderNo, shipped };
}

async function findAutoOqcNo(boxNo) {
  const list = await api('GET', '/quality/oqc?status=PENDING&search=HNS02&limit=20');
  const rows = Array.isArray(list) ? list : (list.data ?? []);
  for (const row of rows) {
    const requestNo = idOf(row, 'requestNo', 'id');
    if (!requestNo) continue;
    const detail = await api('GET', `/quality/oqc/${encodeURIComponent(requestNo)}`);
    const boxes = detail.boxes ?? [];
    if (boxes.some((box) => box.boxNo === boxNo)) return requestNo;
  }
  throw new Error(`자동 생성 OQC 의뢰를 찾을 수 없습니다: ${boxNo}`);
}

async function runDeletes() {
  const draftShipOrderNo = `SO-DEL-${stamp}`;
  const emptyBoxNo = `BX-DEL-${stamp}`;
  const cancelJobNo = `JO-CXL-${stamp}`;

  await api('POST', '/shipping/orders', {
    shipOrderNo: draftShipOrderNo,
    customerId: 'CUS-001',
    customerName: '현대자동차',
    dueDate: today,
    shipDate: today,
    items: [{ itemCode: 'HNS02', orderQty: 1 }],
    remark: '삭제 검증용 DRAFT 출하지시',
  });
  const shipOrderDelete = await api('DELETE', `/shipping/orders/${encodeURIComponent(draftShipOrderNo)}`, undefined, { keepRaw: true });

  await api('POST', '/shipping/boxes', { boxNo: emptyBoxNo, itemCode: 'HNS02', qty: 0 });
  const boxDelete = await api('DELETE', `/shipping/boxes/${encodeURIComponent(emptyBoxNo)}`, undefined, { keepRaw: true });

  await api('POST', '/production/job-orders', {
    orderNo: cancelJobNo,
    itemCode: 'HNS02',
    lineCode: 'LINE-01',
    planQty: 1,
    planDate: today,
    processCode: 'MASSY',
    remark: '취소 검증용 작업지시',
  });
  const jobCancel = await api('POST', `/production/job-orders/${encodeURIComponent(cancelJobNo)}/cancel`, {
    remark: '정상/역처리 통합 재테스트 작업 취소',
  });

  evidence.deletes = { draftShipOrderNo, shipOrderDelete, emptyBoxNo, boxDelete, cancelJobNo, jobCancel };
}

async function main() {
  const matUids = await setupMaterial(4);

  const normalProduction = await produceOne('OK', matUids[0]);
  const normalShipping = await shipOne('OK', normalProduction.prdUid);
  evidence.normal = { ...normalProduction, ...normalShipping };

  const reverseProduction = await produceOne('RV', matUids[1]);
  const reverseShipping = await shipOne('RV', reverseProduction.prdUid);
  const cancelShip = await api('POST', `/shipping/orders/${encodeURIComponent(reverseShipping.shipOrderNo)}/cancel-ship-box`, {
    boxNo: reverseShipping.boxNo,
    workerId: token,
  });
  evidence.reverse = { ...reverseProduction, ...reverseShipping, cancelShip };

  await runDeletes();

  const outPath = `docs/reports/hns02-normal-reverse-runtime-test-${stamp}.json`;
  await fs.writeFile(outPath, JSON.stringify(evidence, null, 2), 'utf8');
  console.log(JSON.stringify({ success: true, outPath, evidence }, null, 2));
}

main().catch(async (err) => {
  evidence.error = {
    message: err.message,
    response: err.response,
    stack: err.stack,
  };
  const outPath = `docs/reports/hns02-normal-reverse-runtime-test-${stamp}-failed.json`;
  await fs.writeFile(outPath, JSON.stringify(evidence, null, 2), 'utf8').catch(() => {});
  console.error(JSON.stringify({ success: false, outPath, error: evidence.error }, null, 2));
  process.exit(1);
});
