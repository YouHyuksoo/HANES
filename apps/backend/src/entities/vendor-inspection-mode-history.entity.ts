import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'VENDOR_INSPECTION_MODE_HISTORY' })
export class VendorInspectionModeHistory {
  @PrimaryGeneratedColumn({ type: 'number', name: 'SEQ' })
  seq: number;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'VENDOR_CODE', length: 50 })
  vendorCode: string;

  @Column({ type: 'varchar2', name: 'PREV_MODE', length: 20, nullable: true })
  prevMode: string | null;

  @Column({ type: 'varchar2', name: 'NEW_MODE', length: 20 })
  newMode: string;

  @Column({ type: 'varchar2', name: 'REASON', length: 500, nullable: true })
  reason: string | null;

  @Column({ type: 'varchar2', name: 'REF_ARRIVAL_NO', length: 100, nullable: true })
  refArrivalNo: string | null;

  @Column({ type: 'varchar2', name: 'REF_ITEM_CODE', length: 50, nullable: true })
  refItemCode: string | null;

  @CreateDateColumn({ name: 'CHANGED_AT', type: 'timestamp' })
  changedAt: Date;
}
