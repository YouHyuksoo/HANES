import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProcessMaster } from './process-master.entity';
import { EquipMaster } from './equip-master.entity';

@Entity({ name: 'PROCESS_EQUIPMENTS' })
@Index(['equipCode'])
export class ProcessEquipment {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string | null;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string | null;

  @PrimaryColumn({ name: 'PROCESS_CODE', length: 50 })
  processCode: string;

  @PrimaryColumn({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => ProcessMaster, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'PROCESS_CODE', referencedColumnName: 'processCode' },
  ])
  process: ProcessMaster;

  @ManyToOne(() => EquipMaster, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'EQUIP_CODE', referencedColumnName: 'equipCode' },
  ])
  equipment: EquipMaster;
}
