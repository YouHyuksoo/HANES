import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity({ name: 'PLANTS' })
@Unique(['plantCode', 'shopCode', 'lineCode', 'cellCode'])
@Index(['plantType'])
@Index(['parentId'])
export class Plant {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'PLANT_CODE', length: 50 })
  plantCode: string;

  @Column({ name: 'SHOP_CODE', length: 50, nullable: true })
  shopCode: string | null;

  @Column({ name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string | null;

  @Column({ name: 'CELL_CODE', length: 50, nullable: true })
  cellCode: string | null;

  @Column({ name: 'PLANT_NAME', length: 100 })
  plantName: string;

  @Column({ name: 'PLANT_TYPE', length: 50, nullable: true })
  plantType: string | null;

  @Column({ name: 'PARENT_ID', nullable: true })
  parentId: string | null;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

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

  // Self-relation: Plant hierarchy
  @ManyToOne(() => Plant, (plant) => plant.children, { nullable: true })
  @JoinColumn({ name: 'PARENT_ID' })
  parent: Plant | null;

  @OneToMany(() => Plant, (plant) => plant.parent)
  children: Plant[];
}
