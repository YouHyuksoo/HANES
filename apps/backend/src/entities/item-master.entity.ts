/**
 * @file item-master.entity.ts
 * @description 품목 마스터(ItemMaster) 엔티티 - 자재/제품/반제품 등 모든 품목 정보를 관리한다.
 *              테이블명은 ITEM_MASTERS이며, itemCode를 자연키 PK로 사용한다.
 *              클래스명 ItemMaster는 테이블명 ITEM_MASTERS와 일치한다.
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
export class ItemMaster {
  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 100 })
  itemName: string;

  @Column({ name: 'PART_NO', type: 'varchar2', length: 50 })
  itemNo: string;

  @Column({ type: 'varchar2', name: 'CUST_PART_NO', length: 50, nullable: true })
  custPartNo: string | null;

  @Column({ name: 'ITEM_TYPE', length: 50 })
  itemType: string;

  @Column({ type: 'varchar2', name: 'PRODUCT_TYPE', length: 50 })
  productType: string;

  @Column({ type: 'varchar2', name: 'MODEL_NAME', length: 100, nullable: true })
  modelName: string | null;

  @Column({ type: 'varchar2', name: 'DEFECT_MODEL_GROUP', length: 50, nullable: true })
  defectModelGroup: string | null;

  @Column({ type: 'varchar2', name: 'SPEC', length: 255, nullable: true })
  spec: string | null;

  @Column({ type: 'varchar2', name: 'REV', length: 20, nullable: true })
  rev: string | null;

  @Column({ type: 'varchar2', name: 'MARKING_TEXT', length: 100, nullable: true })
  markingText: string | null;

  @Column({ name: 'UNIT', length: 20, default: 'EA' })
  unit: string;

  @Column({ type: 'varchar2', name: 'COLOR', length: 50, nullable: true })
  color: string | null;

  @Column({ type: 'varchar2', name: 'DRAW_NO', length: 50, nullable: true })
  drawNo: string | null;

  @Column({ name: 'LEAD_TIME', type: 'int', default: 0 })
  leadTime: number;

  @Column({ name: 'SAFETY_STOCK', type: 'int', default: 0 })
  safetyStock: number;

  @Column({ name: 'LOT_UNIT_QTY', type: 'int', nullable: true })
  lotUnitQty: number | null;

  @Column({ name: 'BOX_QTY', type: 'int', default: 0 })
  boxQty: number;

  @Column({ name: 'MIN_PACK_QTY', type: 'int', default: 0 })
  minPackQty: number;

  @Column({ name: 'IQC_FLAG', length: 1, default: 'Y' })
  iqcYn: string;

  @Column({ type: 'varchar2', name: 'INSPECT_METHOD', length: 20, nullable: true })
  inspectMethod: string | null; // 검사구분 (FULL/SKIP)

  @Column({ name: 'TACT_TIME', type: 'int', default: 0 })
  tactTime: number;

  @Column({ name: 'EXPIRY_DATE', type: 'int', default: 0 })
  expiryDate: number;

  @Column({ name: 'EXPIRY_EXT_DAYS', type: 'int', default: 0 })
  expiryExtDays: number;

  @Column({ name: 'TOLERANCE_RATE', type: 'decimal', precision: 5, scale: 2, default: 5.0 })
  toleranceRate: number; // PO 수량 오차 허용률 (%)

  @Column({ name: 'IS_SPLITTABLE', length: 1, default: 'Y' })
  isSplittable: string; // 자재 분할 가능 여부 (Y/N)

  @Column({ name: 'SAMPLE_QTY', type: 'int', nullable: true })
  sampleQty: number | null; // 기본시료수. AQL 산출 샘플수량과 별개

  @Column({ type: 'varchar2', name: 'IQC_AQL_POLICY_CODE', length: 50, nullable: true })
  iqcAqlPolicyCode: string | null;

  @Column({ type: 'int', name: 'PACK_UNIT', nullable: true })
  packUnit: number | null; // 팔레트 구성 단위(팔레트당 박스 수)

  @Column({ type: 'varchar2', name: 'STORAGE_LOCATION', length: 100, nullable: true })
  storageLocation: string | null;

  @Column({ type: 'varchar2', name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
