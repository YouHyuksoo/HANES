import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SHIPMENT_RETURN_ITEMS' })
@Index(['RETURN_ID'])
@Index(['PART_ID'])
export class ShipmentReturnItem {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'RETURN_ID', length: 255 })
  returnId: string;

  @Column({ name: 'PART_ID', length: 255 })
  partId: string;

  @Column({ name: 'RETURN_QTY', type: 'int' })
  returnQty: number;

  @Column({ name: 'DISPOSAL_TYPE', length: 50, default: 'RESTOCK' })
  disposalType: string;

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
}
