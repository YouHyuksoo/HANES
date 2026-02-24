/**
 * @file src/entities/equip-bom-rel.entity.ts
 * @description 설비-BOM 품목 연결 관계 Entity
 *
 * 초보자 가이드:
 * 1. **EQUIP_BOM_RELS** 테이블 매핑
 * 2. 설비와 BOM 품목의 N:M 관계를 관리
 * 3. 설치일, 수량, 유효기한 등을 관리
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EquipMaster } from './equip-master.entity';
import { EquipBomItem } from './equip-bom-item.entity';

@Entity({ name: 'EQUIP_BOM_RELS' })
@Index(['equipId'])
@Index(['bomItemId'])
@Index(['useYn'])
export class EquipBomRel {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'EQUIP_ID', length: 36 })
  equipId: string;

  @Column({ name: 'BOM_ITEM_ID', length: 36 })
  bomItemId: string;

  @Column({ name: 'QUANTITY', type: 'float', default: 1 })
  quantity: number;

  @Column({ name: 'INSTALL_DATE', type: 'date', nullable: true })
  installDate: Date | null;

  @Column({ name: 'EXPIRE_DATE', type: 'date', nullable: true })
  expireDate: Date | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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

  @CreateDateColumn({ name: 'CREATED_AT', type: 'date' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'date' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => EquipMaster, (equip) => equip.bomRels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'EQUIP_ID', referencedColumnName: 'id' })
  equipment: EquipMaster;

  @ManyToOne(() => EquipBomItem, (item) => item.equipRels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'BOM_ITEM_ID', referencedColumnName: 'id' })
  bomItem: EquipBomItem;
}
