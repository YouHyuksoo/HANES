/**
 * @file prisma/seed-vendor.ts
 * @description Oracle TM_VENDOR → Supabase partner_masters 마이그레이션
 *
 * 실행: npx tsx prisma/seed-vendor.ts
 *
 * 매핑:
 * - VENDOR → partnerCode
 * - VENDORNAME → partnerName
 * - PRCFLAG/SALFLAG → partnerType (SUPPLIER/CUSTOMER)
 * - ENTRYNO → bizNo, CEONAME → ceoName, ADDRESS → address
 * - PHONE → tel, FAXNO → fax, USEFLAG → useYn, REMARKS → remark
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OracleVendor {
  VENDOR: string;
  VENDORNAME: string;
  MAKER: string | null;
  ENTRYNO: string | null;
  CONTRYNO: string | null;
  CEONAME: string | null;
  PHONE: string | null;
  FAXNO: string | null;
  ADDRESS: string | null;
  PRCFLAG: string;
  SALFLAG: string;
  OSCFLAG: string;
  USEFLAG: string;
  REMARKS: string | null;
}

/** "." 같은 placeholder 값을 null로 치환 */
function clean(val: string | null): string | undefined {
  if (!val || val.trim() === '' || val.trim() === '.') return undefined;
  return val.trim();
}

/** PRCFLAG/SALFLAG → partnerType 결정 */
function resolvePartnerType(prcFlag: string, salFlag: string): string {
  if (salFlag === 'Y' && prcFlag !== 'Y') return 'CUSTOMER';
  return 'SUPPLIER';
}

const vendorData: OracleVendor[] = [
  { VENDOR: '101268', VENDORNAME: '无锡LS', MAKER: null, ENTRYNO: null, CONTRYNO: null, CEONAME: null, PHONE: null, FAXNO: null, ADDRESS: null, PRCFLAG: 'Y', SALFLAG: 'N', OSCFLAG: 'N', USEFLAG: 'Y', REMARKS: null },
  { VENDOR: '101269', VENDORNAME: 'EUJIN', MAKER: null, ENTRYNO: null, CONTRYNO: null, CEONAME: null, PHONE: null, FAXNO: null, ADDRESS: null, PRCFLAG: 'Y', SALFLAG: 'N', OSCFLAG: 'N', USEFLAG: 'Y', REMARKS: null },
  { VENDOR: '101270', VENDORNAME: 'LG Energy Solution', MAKER: null, ENTRYNO: null, CONTRYNO: null, CEONAME: null, PHONE: null, FAXNO: null, ADDRESS: null, PRCFLAG: 'N', SALFLAG: 'Y', OSCFLAG: 'N', USEFLAG: 'Y', REMARKS: null },
  { VENDOR: '101271', VENDORNAME: '南京万佳精密注塑有限公司', MAKER: null, ENTRYNO: '.', CONTRYNO: null, CEONAME: '.', PHONE: null, FAXNO: null, ADDRESS: '.', PRCFLAG: 'Y', SALFLAG: 'Y', OSCFLAG: 'Y', USEFLAG: 'Y', REMARKS: null },
  { VENDOR: '101272', VENDORNAME: '常熟新都安电器股份有限公司', MAKER: null, ENTRYNO: '.', CONTRYNO: null, CEONAME: '.', PHONE: null, FAXNO: null, ADDRESS: '.', PRCFLAG: 'Y', SALFLAG: 'Y', OSCFLAG: 'Y', USEFLAG: 'Y', REMARKS: null },
];

async function main() {
  console.log('=== Oracle TM_VENDOR → Supabase partner_masters 마이그레이션 ===');

  // 1. 기존 데이터 삭제
  const { count: deleted } = await prisma.partnerMaster.deleteMany({});
  console.log(`기존 거래처 삭제: ${deleted}건`);

  // 2. 데이터 삽입
  const result = await prisma.partnerMaster.createMany({
    data: vendorData.map((v) => ({
      partnerCode: v.VENDOR,
      partnerName: v.VENDORNAME,
      partnerType: resolvePartnerType(v.PRCFLAG, v.SALFLAG),
      bizNo: clean(v.ENTRYNO),
      ceoName: clean(v.CEONAME),
      address: clean(v.ADDRESS),
      tel: clean(v.PHONE),
      fax: clean(v.FAXNO),
      remark: clean(v.REMARKS),
      useYn: v.USEFLAG === 'Y' ? 'Y' : 'N',
    })),
    skipDuplicates: true,
  });

  console.log(`삽입 완료: ${result.count}건`);

  // 3. 결과 확인
  const all = await prisma.partnerMaster.findMany({ orderBy: { partnerCode: 'asc' } });
  console.log('\n=== 결과 ===');
  all.forEach((p) => {
    console.log(`  ${p.partnerCode} | ${p.partnerName} | ${p.partnerType} | useYn=${p.useYn}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
