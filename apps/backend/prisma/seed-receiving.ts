/**
 * @file prisma/seed-receiving.ts
 * @description 입고관리 테스트 데이터 시드 - IQC 합격 LOT + RECEIVE 이력
 *
 * 실행: npx ts-node prisma/seed-receiving.ts
 *
 * 생성 데이터:
 * - IQC 합격 LOT 7개 (입고대기 탭에 표시)
 * - RECEIVE 이력 5건 (입고이력 탭에 표시)
 * - 부분 입고 LOT 2개 (잔량 존재)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 입고관리 시드 시작 ===\n');

  // 1. 기존 품목 확인/생성
  let parts = await prisma.partMaster.findMany({
    take: 8,
    select: { id: true, partCode: true, partName: true, unit: true },
  });
  if (parts.length === 0) {
    console.log('품목 데이터 생성 중...');
    const partsData = [
      { partCode: 'WIRE-001', partName: 'AWG18 적색 전선', unit: 'M', partType: 'RAW' },
      { partCode: 'WIRE-002', partName: 'AWG20 흑색 전선', unit: 'M', partType: 'RAW' },
      { partCode: 'TERM-001', partName: '단자 110형 암', unit: 'EA', partType: 'RAW' },
      { partCode: 'TERM-002', partName: '단자 250형 수', unit: 'EA', partType: 'RAW' },
      { partCode: 'CONN-001', partName: '커넥터 6핀 백색', unit: 'EA', partType: 'RAW' },
      { partCode: 'CONN-002', partName: '커넥터 12핀 흑색', unit: 'EA', partType: 'RAW' },
      { partCode: 'TUBE-001', partName: '수축튜브 Φ3.0', unit: 'M', partType: 'RAW' },
      { partCode: 'TAPE-001', partName: '와이어링 테이프', unit: 'EA', partType: 'RAW' },
    ];
    for (const p of partsData) {
      await prisma.partMaster.upsert({
        where: { partCode: p.partCode },
        update: {},
        create: p,
      });
    }
    parts = await prisma.partMaster.findMany({
      take: 8,
      select: { id: true, partCode: true, partName: true, unit: true },
    });
    console.log(`  → 품목 ${parts.length}개 준비 완료`);
  } else {
    console.log(`기존 품목 ${parts.length}개 사용`);
  }

  // 2. 창고 확인/생성
  let warehouses = await prisma.warehouse.findMany({
    take: 3,
    select: { id: true, warehouseCode: true, warehouseName: true },
  });
  if (warehouses.length === 0) {
    console.log('창고 데이터 생성 중...');
    const whData = [
      { warehouseName: '자재창고A', warehouseCode: 'WH-MAT-A', warehouseType: 'RAW' },
      { warehouseName: '자재창고B', warehouseCode: 'WH-MAT-B', warehouseType: 'RAW' },
      { warehouseName: '완제품창고', warehouseCode: 'WH-FG', warehouseType: 'FG' },
    ];
    for (const w of whData) {
      await prisma.warehouse.upsert({
        where: { warehouseCode: w.warehouseCode },
        update: {},
        create: w,
      });
    }
    warehouses = await prisma.warehouse.findMany({
      take: 3,
      select: { id: true, warehouseCode: true, warehouseName: true },
    });
    console.log(`  → 창고 ${warehouses.length}개 준비 완료`);
  } else {
    console.log(`기존 창고 ${warehouses.length}개 사용`);
  }

  const whA = warehouses[0];
  const whB = warehouses[1] || warehouses[0];

  // =============================================
  // 3. IQC 합격 LOT 생성 (입고대기 탭 데이터 - 7개)
  // =============================================
  console.log('\n=== IQC 합격 LOT 생성 (입고대기) ===');

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const passLots = [
    { lotNo: `RCV-L${today}-001`, partIdx: 0, initQty: 3000, vendor: '대한전선', poNo: 'PO-2026-0001' },
    { lotNo: `RCV-L${today}-002`, partIdx: 1, initQty: 2000, vendor: '대한전선', poNo: 'PO-2026-0001' },
    { lotNo: `RCV-L${today}-003`, partIdx: 2, initQty: 8000, vendor: '한국단자공업', poNo: 'PO-2026-0002' },
    { lotNo: `RCV-L${today}-004`, partIdx: 3, initQty: 5000, vendor: '한국단자공업', poNo: 'PO-2026-0002' },
    { lotNo: `RCV-L${today}-005`, partIdx: 4, initQty: 1500, vendor: '삼성커넥터', poNo: 'PO-2026-0003' },
    { lotNo: `RCV-L${today}-006`, partIdx: 5, initQty: 2500, vendor: '삼성커넥터', poNo: null },
    { lotNo: `RCV-L${today}-007`, partIdx: 6, initQty: 600, vendor: '긴급 공급업체', poNo: null },
  ];

  const createdLots: Array<{ id: string; lotNo: string; partIdx: number; initQty: number }> = [];

  for (const lotData of passLots) {
    const part = parts[lotData.partIdx] || parts[0];
    const existing = await prisma.lot.findUnique({ where: { lotNo: lotData.lotNo } });
    if (existing) {
      console.log(`  ⏭ LOT 이미 존재: ${lotData.lotNo}`);
      createdLots.push({ id: existing.id, lotNo: existing.lotNo, partIdx: lotData.partIdx, initQty: lotData.initQty });
      continue;
    }
    const lot = await prisma.lot.create({
      data: {
        lotNo: lotData.lotNo,
        partId: part.id,
        partType: 'RAW',
        initQty: lotData.initQty,
        currentQty: lotData.initQty,
        recvDate: new Date(),
        vendor: lotData.vendor,
        poNo: lotData.poNo || undefined,
        iqcStatus: 'PASS',
        status: 'NORMAL',
      },
    });
    createdLots.push({ id: lot.id, lotNo: lot.lotNo, partIdx: lotData.partIdx, initQty: lotData.initQty });
    console.log(`  ✅ LOT: ${lot.lotNo} - ${part.partCode} ${lotData.initQty}${part.unit} (IQC합격)`);
  }

  // MAT_IN 트랜잭션도 생성 (입하 이력 - 입고대기 LOT에 대해)
  console.log('\n=== 입하(MAT_IN) 트랜잭션 생성 ===');
  for (let i = 0; i < createdLots.length; i++) {
    const lot = createdLots[i];
    const part = parts[lot.partIdx] || parts[0];
    const transNo = `ARR-RCV-${String(i + 1).padStart(3, '0')}`;

    const existingTx = await prisma.stockTransaction.findUnique({ where: { transNo } });
    if (existingTx) {
      console.log(`  ⏭ 트랜잭션 이미 존재: ${transNo}`);
      continue;
    }

    await prisma.stockTransaction.create({
      data: {
        transNo,
        transType: 'MAT_IN',
        toWarehouseId: i % 2 === 0 ? whA.id : whB.id,
        partId: part.id,
        lotId: lot.id,
        qty: lot.initQty,
        refType: 'PO',
        status: 'DONE',
        remark: `입하 완료 - IQC 합격`,
      },
    });
    console.log(`  ✅ ${transNo}: ${part.partCode} ${lot.initQty}${part.unit}`);
  }

  // =============================================
  // 4. 부분 입고된 LOT (잔량 있음) - 2건
  // =============================================
  console.log('\n=== 부분 입고 처리 (RECEIVE 트랜잭션) ===');

  // LOT 001: 3000 중 1000 입고 → 잔량 2000
  const partial1TransNo = `RCV-PARTIAL-001`;
  const existP1 = await prisma.stockTransaction.findUnique({ where: { transNo: partial1TransNo } });
  if (!existP1 && createdLots[0]) {
    const part0 = parts[createdLots[0].partIdx] || parts[0];
    await prisma.stockTransaction.create({
      data: {
        transNo: partial1TransNo,
        transType: 'RECEIVE',
        toWarehouseId: whA.id,
        partId: part0.id,
        lotId: createdLots[0].id,
        qty: 1000,
        refType: 'RECEIVE',
        status: 'DONE',
        remark: '1차 부분 입고',
      },
    });
    // Stock 반영
    await prisma.stock.upsert({
      where: { warehouseId_partId_lotId: { warehouseId: whA.id, partId: part0.id, lotId: createdLots[0].id } },
      update: { qty: { increment: 1000 }, availableQty: { increment: 1000 }, lastTransAt: new Date() },
      create: { warehouseId: whA.id, partId: part0.id, lotId: createdLots[0].id, qty: 1000, availableQty: 1000, lastTransAt: new Date() },
    });
    console.log(`  ✅ ${partial1TransNo}: ${part0.partCode} 1000/${createdLots[0].initQty} 부분입고 (잔량 ${createdLots[0].initQty - 1000})`);
  }

  // LOT 003: 8000 중 3000 입고 → 잔량 5000
  const partial2TransNo = `RCV-PARTIAL-002`;
  const existP2 = await prisma.stockTransaction.findUnique({ where: { transNo: partial2TransNo } });
  if (!existP2 && createdLots[2]) {
    const part2 = parts[createdLots[2].partIdx] || parts[0];
    await prisma.stockTransaction.create({
      data: {
        transNo: partial2TransNo,
        transType: 'RECEIVE',
        toWarehouseId: whA.id,
        partId: part2.id,
        lotId: createdLots[2].id,
        qty: 3000,
        refType: 'RECEIVE',
        status: 'DONE',
        remark: '1차 부분 입고',
      },
    });
    await prisma.stock.upsert({
      where: { warehouseId_partId_lotId: { warehouseId: whA.id, partId: part2.id, lotId: createdLots[2].id } },
      update: { qty: { increment: 3000 }, availableQty: { increment: 3000 }, lastTransAt: new Date() },
      create: { warehouseId: whA.id, partId: part2.id, lotId: createdLots[2].id, qty: 3000, availableQty: 3000, lastTransAt: new Date() },
    });
    console.log(`  ✅ ${partial2TransNo}: ${part2.partCode} 3000/${createdLots[2].initQty} 부분입고 (잔량 ${createdLots[2].initQty - 3000})`);
  }

  // =============================================
  // 5. 완전 입고 이력 (입고이력 탭 데이터 - 3건)
  // =============================================
  console.log('\n=== 완전 입고 이력 (과거 데이터) ===');

  const historyLots = [
    { lotNo: `RCV-H${today}-001`, partIdx: 7 % parts.length, qty: 500, vendor: '대한전선', daysAgo: 3 },
    { lotNo: `RCV-H${today}-002`, partIdx: 4 % parts.length, qty: 1200, vendor: '삼성커넥터', daysAgo: 2 },
    { lotNo: `RCV-H${today}-003`, partIdx: 1 % parts.length, qty: 800, vendor: '한국단자공업', daysAgo: 1 },
  ];

  for (let i = 0; i < historyLots.length; i++) {
    const h = historyLots[i];
    const part = parts[h.partIdx] || parts[0];
    const transNo = `RCV-HIST-${String(i + 1).padStart(3, '0')}`;

    const existH = await prisma.stockTransaction.findUnique({ where: { transNo } });
    if (existH) {
      console.log(`  ⏭ 이력 이미 존재: ${transNo}`);
      continue;
    }

    // 완전 입고된 LOT (iqcStatus=PASS, 이미 전량 입고 완료)
    const existLot = await prisma.lot.findUnique({ where: { lotNo: h.lotNo } });
    let histLot = existLot;
    if (!histLot) {
      histLot = await prisma.lot.create({
        data: {
          lotNo: h.lotNo,
          partId: part.id,
          partType: 'RAW',
          initQty: h.qty,
          currentQty: h.qty,
          recvDate: new Date(Date.now() - h.daysAgo * 86400000),
          vendor: h.vendor,
          iqcStatus: 'PASS',
          status: 'NORMAL',
        },
      });
    }

    // RECEIVE 트랜잭션 (전량 입고)
    const txDate = new Date(Date.now() - h.daysAgo * 86400000);
    await prisma.stockTransaction.create({
      data: {
        transNo,
        transType: 'RECEIVE',
        transDate: txDate,
        toWarehouseId: i % 2 === 0 ? whA.id : whB.id,
        partId: part.id,
        lotId: histLot.id,
        qty: h.qty,
        refType: 'RECEIVE',
        status: 'DONE',
        remark: '전량 입고 완료',
      },
    });

    // Stock 반영
    const wh = i % 2 === 0 ? whA : whB;
    await prisma.stock.upsert({
      where: { warehouseId_partId_lotId: { warehouseId: wh.id, partId: part.id, lotId: histLot.id } },
      update: { qty: { increment: h.qty }, availableQty: { increment: h.qty }, lastTransAt: txDate },
      create: { warehouseId: wh.id, partId: part.id, lotId: histLot.id, qty: h.qty, availableQty: h.qty, lastTransAt: txDate },
    });
    console.log(`  ✅ ${transNo}: ${part.partCode} ${h.qty}${part.unit} (${h.daysAgo}일 전 전량입고)`);
  }

  // =============================================
  // 요약
  // =============================================
  console.log('\n=== 시드 완료 요약 ===');
  console.log(`IQC 합격 LOT (입고대기): 7건`);
  console.log(`  - 미입고: 5건 (전량 입고 대기)`);
  console.log(`  - 부분입고: 2건 (잔량 존재)`);
  console.log(`RECEIVE 이력: 5건`);
  console.log(`  - 부분입고: 2건`);
  console.log(`  - 전량입고 (과거): 3건`);
  console.log(`입하(MAT_IN) 트랜잭션: 7건`);
  console.log(`현재고 반영: 5건`);
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
