import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CONSUMABLE_MASTERS' })
@Index(['CATEGORY'])
@Index(['STATUS'])
export class ConsumableMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'CONSUMABLE_CODE', length: 50, unique: true })
  consumableCode: string;

  @Column({ name: 'NAME', length: 100 })
  consumableName: string;

  @Column({ name: 'CATEGORY', length: 50, nullable: true })
  category: string | null;

  @Column({ name: 'EXPECTED_LIFE', type: 'int', nullable: true })
  expectedLife: number | null;

  @Column({ name: 'CURRENT_COUNT', type: 'int', default: 0 })
  currentCount: number;

  @Column({ name: 'STOCK_QTY', type: 'int', default: 0 })
  stockQty: number;

  @Column({ name: 'SAFETY_STOCK', type: 'int', default: 0 })
  safetyStock: number;

  @Column({ name: 'WARNING_COUNT', type: 'int', nullable: true })
  warningCount: number | null;

  @Column({ name: 'LOCATION', length: 100, nullable: true })
  location: string | null;

  @Column({ name: 'LAST_REPLACE', type: 'timestamp', nullable: true })
  lastReplaceAt: Date | null;

  @Column({ name: 'NEXT_REPLACE', type: 'timestamp', nullable: true })
  nextReplaceAt: Date | null;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'VENDOR', length: 50, nullable: true })
  vendor: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'NORMAL' })
  status: string;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
