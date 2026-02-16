import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'DEFECT_LOGS' })
@Index(['PROD_RESULT_ID'])
@Index(['DEFECT_CODE'])
@Index(['STATUS'])
export class DefectLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'PROD_RESULT_ID', length: 255 })
  prodResultId: string;

  @Column({ name: 'DEFECT_CODE', length: 50 })
  defectCode: string;

  @Column({ name: 'DEFECT_NAME', length: 100, nullable: true })
  defectName: string | null;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ name: 'STATUS', length: 50, default: 'WAIT' })
  status: string;

  @Column({ name: 'CAUSE', length: 500, nullable: true })
  cause: string | null;

  @Column({ name: 'OCCUR_TIME', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  occurAt: Date;

  @Column({ name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string | null;

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
