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

@Entity({ name: 'SHIPMENT_LOGS' })
@Unique(['shipNo'])
@Index(['status'])
@Index(['shipDate'])
@Index(['customer'])
export class ShipmentLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'SHIP_NO', length: 50, unique: true })
  shipNo: string;

  @Column({ name: 'SHIP_DATE', type: 'date', nullable: true })
  shipDate: Date | null;

  @Column({ name: 'SHIP_TIME', type: 'timestamp', nullable: true })
  shipAt: Date | null;

  @Column({ name: 'VEHICLE_NO', length: 50, nullable: true })
  vehicleNo: string | null;

  @Column({ name: 'DRIVER_NAME', length: 100, nullable: true })
  driverName: string | null;

  @Column({ name: 'DESTINATION', length: 255, nullable: true })
  destination: string | null;

  @Column({ name: 'CUSTOMER', length: 100, nullable: true })
  customer: string | null;

  @Column({ name: 'PALLET_COUNT', type: 'int', default: 0 })
  palletCount: number;

  @Column({ name: 'BOX_COUNT', type: 'int', default: 0 })
  boxCount: number;

  @Column({ name: 'TOTAL_QTY', type: 'int', default: 0 })
  totalQty: number;

  @Column({ name: 'STATUS', length: 50, default: 'PREPARING' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'ERP_SYNC_YN', length: 1, default: 'N' })
  erpSyncYn: string;

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
