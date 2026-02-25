/**
 * @file entities/equip-bom-rel.entity.ts
 * @description 설비-BOM 품목 연결 관계 Entity
 *              SEQUENCE(패턴 B)를 사용한다.
 *              equipCode/bomItemCode로 FK 참조.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
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
@Index(['equipCode'])
@Index(['bomItemCode'])
@Index(['useYn'])
export class EquipBomRel {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'BOM_ITEM_CODE', length: 50 })
  bomItemCode: string;

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
  @JoinColumn({ name: 'EQUIP_CODE', referencedColumnName: 'equipCode' })
  equipment: EquipMaster;

  @ManyToOne(() => EquipBomItem, (item) => item.equipRels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'BOM_ITEM_CODE', referencedColumnName: 'bomItemCode' })
  bomItem: EquipBomItem;
}
