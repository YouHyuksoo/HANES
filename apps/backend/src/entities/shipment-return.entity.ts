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

@Entity({ name: 'SHIPMENT_RETURNS' })
@Unique(['RETURN_NO'])
@Index(['SHIPMENT_ID'])
@Index(['STATUS'])
export class ShipmentReturn {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'RETURN_NO', length: 50, unique: true })
  returnNo: string;

  @Column({ name: 'SHIPMENT_ID', length: 255, nullable: true })
  shipmentId: string | null;

  @Column({ name: 'RETURN_DATE', type: 'date', nullable: true })
  returnDate: Date | null;

  @Column({ name: 'RETURN_REASON', length: 500, nullable: true })
  returnReason: string | null;

  @Column({ name: 'STATUS', length: 50, default: 'DRAFT' })
  status: string;

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

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
