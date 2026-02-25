/**
 * @file iqc-item-master.entity.ts
 * @description IQC 검사항목 마스터(IqcItemMaster) 엔티티 - 품목별 검사항목을 정의한다.
 *              시퀀스 PK 사용, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. ITEM_CODE로 ItemMaster(품목)를 참조
 * 3. SEQ로 검사 순서 관리
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'IQC_ITEM_MASTERS' })
@Unique(['itemCode', 'seq'])
@Index(['itemCode'])
export class IqcItemMaster {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'INSPECT_ITEM', length: 255 })
  inspectItem: string;

  @Column({ name: 'SPEC', length: 255, nullable: true })
  spec: string | null;

  @Column({ name: 'LSL', type: 'decimal', precision: 10, scale: 4, nullable: true })
  lsl: number | null;

  @Column({ name: 'USL', type: 'decimal', precision: 10, scale: 4, nullable: true })
  usl: number | null;

  @Column({ name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'IS_SHELF_LIFE', default: false })
  isShelfLife: boolean;

  @Column({ name: 'RETEST_CYCLE', type: 'int', nullable: true })
  retestCycle: number | null;

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
