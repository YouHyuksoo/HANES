/**
 * @file src/entities/consumable-usage-map.entity.ts
 * @description 소모품-설비-모델 사용 매핑 (어느 모델을 어느 설비에서 생산할 때 어느 소모품을 쓰는가)
 *
 * 초보자 가이드:
 * - PK: COMPANY + PLANT_CD + PRODUCT_ITEM_CODE(모델) + EQUIP_CODE(설비) + CONSUMABLE_CODE(소모품)
 * - USAGE_PER_UNIT: 단위 생산당 소모 타수(사용횟수). 생산수량 × 이 값만큼 누적.
 * - 키오스크에서 작업지시(모델)+설비로 필요 소모품을 조회하는 기준이 된다.
 */
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'CONSUMABLE_USAGE_MAP' })
export class ConsumableUsageMap {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'PRODUCT_ITEM_CODE', length: 50 })
  productItemCode: string;

  @PrimaryColumn({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @PrimaryColumn({ name: 'CONSUMABLE_CODE', length: 50 })
  consumableCode: string;

  @Column({ name: 'USAGE_PER_UNIT', type: 'number', default: 1 })
  usagePerUnit: number;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'CREATED_AT', type: 'timestamp', default: () => 'SYSTIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'UPDATED_AT', type: 'timestamp', default: () => 'SYSTIMESTAMP' })
  updatedAt: Date;
}
