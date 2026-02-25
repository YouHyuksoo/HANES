/**
 * @file part-master.entity.ts
 * @description 품목 마스터(ItemMaster) 엔티티 - 자재/제품/반제품 등 모든 품목 정보를 관리한다.
 *              테이블명은 ITEM_MASTERS이며, itemCode를 자연키 PK로 사용한다.
 *              클래스명은 기존 참조 호환을 위해 PartMaster를 유지한다.
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'ITEM_MASTERS' })
@Index(['itemType'])
@Index(['customer'])
export class PartMaster {
  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 100 })
  itemName: string;

  @Column({ name: 'ITEM_NO', length: 50, nullable: true })
  itemNo: string | null;

  @Column({ name: 'CUST_PART_NO', length: 50, nullable: true })
  custPartNo: string | null;

  @Column({ name: 'ITEM_TYPE', length: 50 })
  itemType: string;

  @Column({ name: 'PRODUCT_TYPE', length: 50, nullable: true })
  productType: string | null;

  @Column({ name: 'SPEC', length: 255, nullable: true })
  spec: string | null;

  @Column({ name: 'REV', length: 20, nullable: true })
  rev: string | null;

  @Column({ name: 'UNIT', length: 20, default: 'EA' })
  unit: string;

  @Column({ name: 'DRAW_NO', length: 50, nullable: true })
  drawNo: string | null;

  @Column({ name: 'CUSTOMER', length: 50, nullable: true })
  customer: string | null;

  @Column({ name: 'VENDOR', length: 50, nullable: true })
  vendor: string | null;

  @Column({ name: 'LEAD_TIME', type: 'int', default: 0 })
  leadTime: number;

  @Column({ name: 'SAFETY_STOCK', type: 'int', default: 0 })
  safetyStock: number;

  @Column({ name: 'LOT_UNIT_QTY', type: 'int', nullable: true })
  lotUnitQty: number | null;

  @Column({ name: 'BOX_QTY', type: 'int', default: 0 })
  boxQty: number;

  @Column({ name: 'IQC_FLAG', length: 1, default: 'Y' })
  iqcYn: string;

  @Column({ name: 'TACT_TIME', type: 'int', default: 0 })
  tactTime: number;

  @Column({ name: 'EXPIRY_DATE', type: 'int', default: 0 })
  expiryDate: number;

  @Column({ name: 'TOLERANCE_RATE', type: 'decimal', precision: 5, scale: 2, default: 5.0 })
  toleranceRate: number; // PO 수량 오차 허용률 (%)

  @Column({ name: 'IS_SPLITTABLE', length: 1, default: 'Y' })
  isSplittable: string; // 자재 분할 가능 여부 (Y/N)

  @Column({ name: 'SAMPLE_QTY', type: 'int', nullable: true })
  sampleQty: number | null; // 샘플검사 수량

  @Column({ name: 'PACK_UNIT', length: 50, nullable: true })
  packUnit: string | null;

  @Column({ name: 'STORAGE_LOCATION', length: 100, nullable: true })
  storageLocation: string | null;

  @Column({ name: 'REMARKS', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
