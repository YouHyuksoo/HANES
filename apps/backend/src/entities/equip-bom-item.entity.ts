/**
 * @file src/entities/equip-bom-item.entity.ts
 * @description 설비 BOM 품목 마스터 Entity
 *
 * 초보자 가이드:
 * 1. **EQUIP_BOM_ITEMS** 테이블 매핑
 * 2. 부품(PART)과 소모품(CONSUMABLE)을 구분하여 관리
 * 3. 재고, 교체주기, 안전재고 등을 관리
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { EquipBomRel } from './equip-bom-rel.entity';

export type BomItemType = 'PART' | 'CONSUMABLE';

@Entity({ name: 'EQUIP_BOM_ITEMS' })
@Index(['itemType'])
@Index(['useYn'])
export class EquipBomItem {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'ITEM_CODE', length: 50, unique: true })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 200 })
  itemName: string;

  @Column({ name: 'ITEM_TYPE', length: 20, default: 'PART' })
  itemType: BomItemType;

  @Column({ name: 'SPEC', length: 200, nullable: true })
  spec: string | null;

  @Column({ name: 'MAKER', length: 100, nullable: true })
  maker: string | null;

  @Column({ name: 'UNIT', length: 20, default: 'EA' })
  unit: string;

  @Column({ name: 'UNIT_PRICE', type: 'float', nullable: true })
  unitPrice: number | null;

  @Column({ name: 'REPLACEMENT_CYCLE', type: 'number', nullable: true })
  replacementCycle: number | null;

  @Column({ name: 'STOCK_QTY', type: 'float', default: 0 })
  stockQty: number;

  @Column({ name: 'SAFETY_STOCK', type: 'float', default: 0 })
  safetyStock: number;

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

  // Relations
  @OneToMany(() => EquipBomRel, (rel) => rel.bomItem)
  equipRels: EquipBomRel[];
}
