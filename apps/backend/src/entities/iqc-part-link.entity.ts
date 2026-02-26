/**
 * @file iqc-part-link.entity.ts
 * @description IQC 품목-거래처-검사그룹 연결 엔티티
 *              시퀀스 PK 사용, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. 품목(ITEM_CODE) + 거래처(PARTNER_ID) → 검사그룹(GROUP_ID) 매핑
 * 3. 같은 품목이라도 거래처에 따라 다른 검사그룹 적용 가능
 * 4. PARTNER_ID가 null이면 "기본 검사그룹" (거래처 무관)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PartMaster } from './part-master.entity';
import { PartnerMaster } from './partner-master.entity';
import { IqcGroup } from './iqc-group.entity';

@Entity({ name: 'IQC_PART_LINKS' })
@Unique(['itemCode', 'partnerId'])
@Index(['itemCode'])
@Index(['partnerId'])
@Index(['groupId'])
export class IqcPartLink {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'PARTNER_ID', length: 255, nullable: true })
  partnerId: string | null;

  @Column({ name: 'GROUP_ID' })
  groupId: number;

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

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => PartMaster, { eager: false })
  @JoinColumn({ name: 'ITEM_CODE' })
  part: PartMaster;

  @ManyToOne(() => PartnerMaster, { eager: false, nullable: true })
  @JoinColumn({ name: 'PARTNER_ID' })
  partner: PartnerMaster;

  @ManyToOne(() => IqcGroup, { eager: false })
  @JoinColumn({ name: 'GROUP_ID' })
  group: IqcGroup;
}
