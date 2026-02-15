/**
 * @file prisma/seed-arrival.ts
 * @description 입하관리 테스트 데이터 시드 - PO + 입하(MAT_IN) 트랜잭션 생성
 *
 * 실행: npx ts-node prisma/seed-arrival.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 기존 데이터 확인 ===');

  // 1. 품목 확인
  let parts = await prisma.partMaster.findMany({ take: 10, select: { id: true, partCode: true, partName: true, unit: true } });
  console.log(`품목 수: ${parts.length}`);
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
      await prisma.partMaster.create({ data: p });
    }
    parts = await prisma.partMaster.findMany({ take: 10, select: { id: true, partCode: true, partName: true, unit: true } });
    console.log(`  → 품목 ${parts.length}개 생성 완료`);
  }

  // 2. 창고 확인
  let warehouses = await prisma.warehouse.findMany({ take: 5, select: { id: true, warehouseName: true } });
  console.log(`창고 수: ${warehouses.length}`);
  if (warehouses.length === 0) {
    console.log('창고 데이터 생성 중...');
    const whData = [
      { warehouseName: '자재창고A', warehouseCode: 'WH-MAT-A', warehouseType: 'RAW' },
      { warehouseName: '자재창고B', warehouseCode: 'WH-MAT-B', warehouseType: 'RAW' },
      { warehouseName: '완제품창고', warehouseCode: 'WH-FG', warehouseType: 'FG' },
    ];
    for (const w of whData) {
      await prisma.warehouse.create({ data: w });
    }
    warehouses = await prisma.warehouse.findMany({ take: 5, select: { id: true, warehouseName: true } });
    console.log(`  → 창고 ${warehouses.length}개 생성 완료`);
  }

  // 3. 거래처 확인
  let partners = await prisma.partnerMaster.findMany({
    where: { partnerType: { in: ['SUPPLIER', 'BOTH'] } },
    take: 5,
    select: { id: true, partnerName: true },
  });
  console.log(`공급업체 수: ${partners.length}`);
  if (partners.length === 0) {
    console.log('공급업체 데이터 생성 중...');
    const partnerData = [
      { partnerCode: 'SUP-001', partnerName: '대한전선', partnerType: 'SUPPLIER' },
      { partnerCode: 'SUP-002', partnerName: '한국단자공업', partnerType: 'SUPPLIER' },
      { partnerCode: 'SUP-003', partnerName: '삼성커넥터', partnerType: 'SUPPLIER' },
    ];
    for (const p of partnerData) {
      await prisma.partnerMaster.create({ data: p });
    }
    partners = await prisma.partnerMaster.findMany({
      where: { partnerType: { in: ['SUPPLIER', 'BOTH'] } },
      take: 5,
      select: { id: true, partnerName: true },
    });
    console.log(`  → 공급업체 ${partners.length}개 생성 완료`);
  }

  console.log('\n=== PO 데이터 생성 ===');

  // PO 1: CONFIRMED 상태 (전량 미입하)
  const po1 = await prisma.purchaseOrder.create({
    data: {
      poNo: 'PO-2026-0001',
      partnerId: partners[0]?.id,
      partnerName: partners[0]?.partnerName || '대한전선',
      orderDate: new Date('2026-02-10'),
      dueDate: new Date('2026-02-20'),
      status: 'CONFIRMED',
      remark: '긴급 발주',
      items: {
        create: [
          { partId: parts[0].id, orderQty: 5000, receivedQty: 0, unitPrice: 150 },
          { partId: parts[1].id, orderQty: 3000, receivedQty: 0, unitPrice: 120 },
          { partId: parts[6]?.id || parts[0].id, orderQty: 1000, receivedQty: 0, unitPrice: 50 },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`PO1: ${po1.poNo} (CONFIRMED) - ${po1.items.length}개 품목`);

  // PO 2: CONFIRMED 상태
  const po2 = await prisma.purchaseOrder.create({
    data: {
      poNo: 'PO-2026-0002',
      partnerId: partners[1]?.id,
      partnerName: partners[1]?.partnerName || '한국단자공업',
      orderDate: new Date('2026-02-11'),
      dueDate: new Date('2026-02-25'),
      status: 'CONFIRMED',
      items: {
        create: [
          { partId: parts[2].id, orderQty: 10000, receivedQty: 0, unitPrice: 25 },
          { partId: parts[3].id, orderQty: 8000, receivedQty: 0, unitPrice: 35 },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`PO2: ${po2.poNo} (CONFIRMED) - ${po2.items.length}개 품목`);

  // PO 3: PARTIAL 상태 (부분 입하 완료)
  const po3 = await prisma.purchaseOrder.create({
    data: {
      poNo: 'PO-2026-0003',
      partnerId: partners[2]?.id,
      partnerName: partners[2]?.partnerName || '삼성커넥터',
      orderDate: new Date('2026-02-05'),
      dueDate: new Date('2026-02-15'),
      status: 'PARTIAL',
      items: {
        create: [
          { partId: parts[4].id, orderQty: 2000, receivedQty: 800, unitPrice: 450 },
          { partId: parts[5]?.id || parts[4].id, orderQty: 1500, receivedQty: 0, unitPrice: 680 },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`PO3: ${po3.poNo} (PARTIAL) - ${po3.items.length}개 품목`);

  // PO 4: CONFIRMED (소량)
  const po4 = await prisma.purchaseOrder.create({
    data: {
      poNo: 'PO-2026-0004',
      partnerId: partners[0]?.id,
      partnerName: partners[0]?.partnerName || '대한전선',
      orderDate: new Date('2026-02-12'),
      dueDate: new Date('2026-02-28'),
      status: 'CONFIRMED',
      items: {
        create: [
          { partId: parts[7]?.id || parts[0].id, orderQty: 500, receivedQty: 0, unitPrice: 200 },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`PO4: ${po4.poNo} (CONFIRMED) - ${po4.items.length}개 품목`);

  console.log('\n=== 입하(MAT_IN) 트랜잭션 생성 ===');

  const wh = warehouses[0];

  // 입하 1: PO3의 부분 입하 (이미 receivedQty에 반영된 과거 입하)
  const lot1 = await prisma.lot.create({
    data: {
      lotNo: 'L20260210-A001',
      partId: parts[4].id,
      partType: 'RAW',
      initQty: 800,
      currentQty: 800,
      recvDate: new Date('2026-02-10'),
      poNo: po3.poNo,
      vendor: po3.partnerName || undefined,
    },
  });
  const tx1 = await prisma.stockTransaction.create({
    data: {
      transNo: 'ARR-PO3-001',
      transType: 'MAT_IN',
      toWarehouseId: wh.id,
      partId: parts[4].id,
      lotId: lot1.id,
      qty: 800,
      refType: 'PO',
      refId: po3.items[0].id,
      remark: 'PO3 1차 분할 입하',
    },
  });
  console.log(`입하1: ${tx1.transNo} - ${parts[4].partCode} 800EA (PO3 분할입하)`);

  // 입하 2: 수동 입하
  const lot2 = await prisma.lot.create({
    data: {
      lotNo: 'L20260212-M001',
      partId: parts[0].id,
      partType: 'RAW',
      initQty: 1000,
      currentQty: 1000,
      recvDate: new Date('2026-02-12'),
      vendor: '긴급 공급업체',
    },
  });
  const tx2 = await prisma.stockTransaction.create({
    data: {
      transNo: 'ARR-MANUAL-001',
      transType: 'MAT_IN',
      toWarehouseId: wh.id,
      partId: parts[0].id,
      lotId: lot2.id,
      qty: 1000,
      refType: 'MANUAL',
      remark: '긴급 수동 입하',
    },
  });
  console.log(`입하2: ${tx2.transNo} - ${parts[0].partCode} 1000M (수동 입하)`);

  // 입하 3: 수동 입하
  const lot3 = await prisma.lot.create({
    data: {
      lotNo: 'L20260213-M002',
      partId: parts[2].id,
      partType: 'RAW',
      initQty: 5000,
      currentQty: 5000,
      recvDate: new Date('2026-02-13'),
      vendor: '테스트 업체',
    },
  });
  const tx3 = await prisma.stockTransaction.create({
    data: {
      transNo: 'ARR-MANUAL-002',
      transType: 'MAT_IN',
      toWarehouseId: warehouses[1]?.id || wh.id,
      partId: parts[2].id,
      lotId: lot3.id,
      qty: 5000,
      refType: 'MANUAL',
      remark: '샘플 입고',
    },
  });
  console.log(`입하3: ${tx3.transNo} - ${parts[2].partCode} 5000EA (수동 입하)`);

  // 입하 4: 오늘자 입하 (통계용)
  const lot4 = await prisma.lot.create({
    data: {
      lotNo: `L${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-T001`,
      partId: parts[3].id,
      partType: 'RAW',
      initQty: 2000,
      currentQty: 2000,
      recvDate: new Date(),
      vendor: '한국단자공업',
    },
  });
  const tx4 = await prisma.stockTransaction.create({
    data: {
      transNo: 'ARR-TODAY-001',
      transType: 'MAT_IN',
      toWarehouseId: wh.id,
      partId: parts[3].id,
      lotId: lot4.id,
      qty: 2000,
      refType: 'MANUAL',
      remark: '오늘 입하 테스트',
    },
  });
  console.log(`입하4: ${tx4.transNo} - ${parts[3].partCode} 2000EA (오늘 입하)`);

  // 입하 5: 취소된 입하 (역분개 포함)
  const lot5 = await prisma.lot.create({
    data: {
      lotNo: 'L20260211-C001',
      partId: parts[1].id,
      partType: 'RAW',
      initQty: 500,
      currentQty: 0,
      recvDate: new Date('2026-02-11'),
      status: 'DEPLETED',
    },
  });
  const tx5 = await prisma.stockTransaction.create({
    data: {
      transNo: 'ARR-CANCEL-001',
      transType: 'MAT_IN',
      toWarehouseId: wh.id,
      partId: parts[1].id,
      lotId: lot5.id,
      qty: 500,
      refType: 'MANUAL',
      status: 'CANCELED',
      remark: '수량 오류로 취소됨',
    },
  });
  // 역분개 트랜잭션
  await prisma.stockTransaction.create({
    data: {
      transNo: 'ARR-CANCEL-001-C',
      transType: 'MAT_IN_CANCEL',
      fromWarehouseId: wh.id,
      partId: parts[1].id,
      lotId: lot5.id,
      qty: -500,
      refType: 'CANCEL',
      cancelRefId: tx5.id,
      remark: '수량 오류',
    },
  });
  console.log(`입하5: ${tx5.transNo} - ${parts[1].partCode} 500M (취소됨 + 역분개)`);

  // Stock upsert (입하된 것들 현재고 반영)
  console.log('\n=== 현재고 반영 ===');
  const stockEntries = [
    { warehouseId: wh.id, partId: parts[4].id, lotId: lot1.id, qty: 800 },
    { warehouseId: wh.id, partId: parts[0].id, lotId: lot2.id, qty: 1000 },
    { warehouseId: warehouses[1]?.id || wh.id, partId: parts[2].id, lotId: lot3.id, qty: 5000 },
    { warehouseId: wh.id, partId: parts[3].id, lotId: lot4.id, qty: 2000 },
  ];
  for (const s of stockEntries) {
    await prisma.stock.create({
      data: { ...s, availableQty: s.qty, lastTransAt: new Date() },
    });
  }
  console.log(`현재고 ${stockEntries.length}건 생성 완료`);

  console.log('\n=== 시드 완료 ===');
  console.log(`PO: 4건 (CONFIRMED 3건, PARTIAL 1건)`);
  console.log(`입하 트랜잭션: 5건 (정상 4건, 취소 1건)`);
  console.log(`역분개: 1건`);
  console.log(`LOT: 5개`);
  console.log(`현재고: 4건`);
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
