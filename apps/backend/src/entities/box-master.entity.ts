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

@Entity({ name: 'BOX_MASTERS' })
@Unique(['boxNo'])
@Index(['partId'])
@Index(['palletId'])
@Index(['status'])
export class BoxMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'BOX_NO', length: 50, unique: true })
  boxNo: string;

  @Column({ name: 'PART_ID', length: 255 })
  partId: string;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'SERIAL_LIST', type: 'clob', nullable: true })
  serialList: string | null;

  @Column({ name: 'PALLET_ID', length: 255, nullable: true })
  palletId: string | null;

  @Column({ name: 'STATUS', length: 50, default: 'OPEN' })
  status: string;

  @Column({ name: 'OQC_STATUS', length: 50, nullable: true })
  oqcStatus: string | null;

  @Column({ name: 'CLOSE_TIME', type: 'timestamp', nullable: true })
  closeAt: Date | null;

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
