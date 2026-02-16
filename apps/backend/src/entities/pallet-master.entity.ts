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

@Entity({ name: 'PALLET_MASTERS' })
@Unique(['PALLET_NO'])
@Index(['STATUS'])
@Index(['SHIPMENT_ID'])
export class PalletMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'PALLET_NO', length: 50, unique: true })
  palletNo: string;

  @Column({ name: 'BOX_COUNT', type: 'int', default: 0 })
  boxCount: number;

  @Column({ name: 'TOTAL_QTY', type: 'int', default: 0 })
  totalQty: number;

  @Column({ name: 'STATUS', length: 50, default: 'OPEN' })
  status: string;

  @Column({ name: 'CLOSE_TIME', type: 'timestamp', nullable: true })
  closeAt: Date | null;

  @Column({ name: 'SHIPMENT_ID', length: 255, nullable: true })
  shipmentId: string | null;

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
