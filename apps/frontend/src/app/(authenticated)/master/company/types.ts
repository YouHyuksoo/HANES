/**
 * @file src/app/(authenticated)/master/company/types.ts
 * @description 회사마스터 + 사업장 타입 정의
 */

export interface Company {
  companyCode: string;
  plant: string;
  plantName?: string;
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
  plantCode: string;
  shopCode?: string;
  lineCode?: string;
  cellCode?: string;
  plantName: string;
  plantType?: string;
  sortOrder: number;
  useYn: string;
  company?: string;
  plant?: string;
}

export const getCompanyKey = (company: Pick<Company, "companyCode" | "plant">) =>
  `${company.companyCode}::${company.plant || "-"}`;

export const getPlantKey = (
  plant: Pick<Plant, "plantCode" | "shopCode" | "lineCode" | "cellCode">,
) =>
  [plant.plantCode, plant.shopCode || "-", plant.lineCode || "-", plant.cellCode || "-"].join("::");
