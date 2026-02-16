import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'REPAIR_LOGS' })
@Index(['DEFECT_LOG_ID'])
@Index(['WORKER_ID'])
export class RepairLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'DEFECT_LOG_ID', length: 255 })
  defectLogId: string;

  @Column({ name: 'WORKER_ID', length: 255, nullable: true })
  workerId: string | null;

  @Column({ name: 'REPAIR_ACTION', length: 500, nullable: true })
  repairAction: string | null;

  @Column({ name: 'MATERIAL_USED', length: 500, nullable: true })
  materialUsed: string | null;

  @Column({ name: 'REPAIR_TIME', type: 'int', nullable: true })
  repairTime: number | null;

  @Column({ name: 'RESULT', length: 50, nullable: true })
  result: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
}
