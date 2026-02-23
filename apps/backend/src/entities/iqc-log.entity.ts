import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'IQC_LOGS' })
@Index(['partId'])
@Index(['lotNo'])
@Index(['inspectType'])
@Index(['result'])
export class IqcLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'LOT_ID', length: 255, nullable: true })
  lotId: string | null;

  @Column({ name: 'LOT_NO', length: 100, nullable: true })
  lotNo: string | null;

  @Column({ name: 'PART_ID', length: 255 })
  partId: string;

  @Column({ name: 'INSPECT_TYPE', length: 50, default: 'INITIAL' })
  inspectType: string;

  @Column({ name: 'RESULT', length: 50, default: 'PASS' })
  result: string;

  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

  @Column({ name: 'INSPECTOR_NAME', length: 100, nullable: true })
  inspectorName: string | null;

  @Column({ name: 'INSPECT_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  inspectDate: Date;

  @Column({ name: 'STATUS', length: 50, default: 'DONE' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
