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

@Entity({ name: 'COM_CODES' })
@Unique(['groupCode', 'detailCode'])
@Index(['groupCode'])
@Index(['parentCode'])
export class ComCode {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'GROUP_CODE', length: 50 })
  groupCode: string;

  @Column({ name: 'DETAIL_CODE', length: 50 })
  detailCode: string;

  @Column({ name: 'PARENT_CODE', length: 50, nullable: true })
  parentCode: string | null;

  @Column({ name: 'CODE_NAME', length: 100 })
  codeName: string;

  @Column({ name: 'CODE_DESC', length: 255, nullable: true })
  codeDesc: string | null;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'ATTR1', length: 100, nullable: true })
  attr1: string | null;

  @Column({ name: 'ATTR2', length: 100, nullable: true })
  attr2: string | null;

  @Column({ name: 'ATTR3', length: 100, nullable: true })
  attr3: string | null;

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
