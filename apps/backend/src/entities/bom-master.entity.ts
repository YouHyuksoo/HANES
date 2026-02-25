/**
 * @file bom-master.entity.ts
 * @description BOM 마스터(BomMaster) 엔티티 - 부모/자식 품목 간 BOM 관계를 정의한다.
 *              복합 PK: (parentItemCode, childItemCode, revision)
 *              parentPartId → parentItemCode, childPartId → childItemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. 복합 PK: PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION
 * 2. UUID id 필드 없음
 * 3. ItemMaster의 itemCode를 직접 참조
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'BOM_MASTERS' })
@Index(['parentItemCode'])
@Index(['childItemCode'])
@Index(['bomGrp'])
export class BomMaster {
  @PrimaryColumn({ name: 'PARENT_ITEM_CODE', length: 50 })
  parentItemCode: string;

  @PrimaryColumn({ name: 'CHILD_ITEM_CODE', length: 50 })
  childItemCode: string;

  @PrimaryColumn({ name: 'REVISION', length: 10, default: 'A' })
  revision: string;

  @Column({ name: 'QTY_PER', type: 'decimal', precision: 10, scale: 4 })
  qtyPer: number;

  @Column({ name: 'SEQ', type: 'int', default: 0 })
  seq: number;

  @Column({ name: 'BOM_GRP', length: 50, nullable: true })
  bomGrp: string | null;

  @Column({ name: 'OPER', length: 50, nullable: true })
  processCode: string | null;

  @Column({ name: 'SIDE', length: 10, nullable: true })
  side: string | null;

  @Column({ name: 'ECO_NO', length: 50, nullable: true })
  ecoNo: string | null;

  @Column({ name: 'VALID_FROM', type: 'date', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'VALID_TO', type: 'date', nullable: true })
  validTo: Date | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
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
