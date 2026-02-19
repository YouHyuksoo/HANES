import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'IQC_ITEM_MASTERS' })
@Unique(['partId', 'seq'])
@Index(['partId'])
export class IqcItemMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'PART_ID', length: 255 })
  partId: string;

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

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
