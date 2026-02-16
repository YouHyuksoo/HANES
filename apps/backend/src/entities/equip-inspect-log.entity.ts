import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'EQUIP_INSPECT_LOGS' })
@Index(['EQUIP_ID'])
@Index(['INSPECT_TYPE'])
@Index(['INSPECT_DATE'])
export class EquipInspectLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'EQUIP_ID', length: 255 })
  equipId: string;

  @Column({ name: 'INSPECT_TYPE', length: 50 })
  inspectType: string;

  @Column({ name: 'INSPECT_DATE', type: 'date' })
  inspectDate: Date;

  @Column({ name: 'INSPECTOR_NAME', length: 100, nullable: true })
  inspectorName: string | null;

  @Column({ name: 'OVERALL_RESULT', length: 50, default: 'PASS' })
  overallResult: string;

  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

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
