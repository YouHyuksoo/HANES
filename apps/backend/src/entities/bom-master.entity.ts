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

@Entity({ name: 'BOM_MASTERS' })
@Unique(['PARENT_PART_ID', 'CHILD_PART_ID', 'REVISION'])
@Index(['PARENT_PART_ID'])
@Index(['CHILD_PART_ID'])
@Index(['BOM_GRP'])
export class BomMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'PARENT_PART_ID', length: 36 })
  parentPartId: string;

  @Column({ name: 'CHILD_PART_ID', length: 36 })
  childPartId: string;

  @Column({ name: 'QTY_PER', type: 'decimal', precision: 10, scale: 4 })
  qtyPer: number;

  @Column({ name: 'SEQ', type: 'int', default: 0 })
  seq: number;

  @Column({ name: 'REVISION', length: 10, default: 'A' })
  revision: string;

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

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  // Relations will be added when PartMaster entity is fully integrated
  // @ManyToOne(() => PartMaster, (part) => part.bomParents)
  // @JoinColumn({ name: 'PARENT_PART_ID' })
  // parentPart: PartMaster;

  // @ManyToOne(() => PartMaster, (part) => part.bomChildren)
  // @JoinColumn({ name: 'CHILD_PART_ID' })
  // childPart: PartMaster;
}
