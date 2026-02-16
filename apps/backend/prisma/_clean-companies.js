const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  const del = await p.companyMaster.deleteMany({ where: { companyCode: { in: ['HANES', 'HANES-KR'] } } });
  console.log('Removed old:', del.count);
  const all = await p.companyMaster.findMany({ where: { deletedAt: null }, select: { companyCode: true, companyName: true } });
  console.log('Current:', JSON.stringify(all));
  await p.$disconnect();
}
run();
