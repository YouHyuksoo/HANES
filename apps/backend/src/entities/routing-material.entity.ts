import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'ROUTING_MATERIALS' })
@Index(['routingCode', 'seq'])
@Index(['childItemCode'])
export class RoutingMaterial {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'ROUTING_CODE', length: 50 })
  routingCode: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @PrimaryColumn({ name: 'CHILD_ITEM_CODE', length: 50 })
  childItemCode: string;

  @Column({ name: 'CIRCUIT_ID', type: 'number', nullable: true })
  circuitId: number | null;

  @Column({ name: 'ALLOC_QTY', type: 'decimal', precision: 10, scale: 4, default: 0 })
  allocQty: number;

  @Column({ type: 'varchar2', name: 'ISSUE_METHOD', length: 20, default: 'BACKFLUSH' })
  issueMethod: string;

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
}
