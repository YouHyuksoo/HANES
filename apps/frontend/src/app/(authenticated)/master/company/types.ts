/**
 * @file src/app/(authenticated)/master/company/types.ts
 * @description 회사마스터 + 사업장 타입 정의
 */

export interface Company {
  id: string;
  companyCode: string;
  companyName: string;
  bizNo?: string;
  ceoName?: string;
  address?: string;
  tel?: string;
  fax?: string;
  email?: string;
  remark?: string;
  useYn: string;
}

export interface Plant {
  id: string;
  plantCode: string;
  plantName: string;
  plantType?: string;
  sortOrder: number;
  useYn: string;
  company?: string;
}
