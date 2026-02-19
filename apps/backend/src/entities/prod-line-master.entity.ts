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

@Entity({ name: 'PROD_LINE_MASTERS' })
@Unique(['lineCode'])
@Index(['lineType'])
@Index(['oper'])
export class ProdLineMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'LINE_CODE', length: 255, unique: true })
  lineCode: string;

  @Column({ name: 'LINE_NAME', length: 255 })
  lineName: string;

  @Column({ name: 'WH_LOC', length: 255, nullable: true })
  whLoc: string | null;

  @Column({ name: 'ERP_CODE', length: 255, nullable: true })
  erpCode: string | null;

  @Column({ name: 'OPER', length: 255, nullable: true })
  oper: string | null;

  @Column({ name: 'LINE_TYPE', length: 255, nullable: true })
  lineType: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'COMPANY', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 255, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 255, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
