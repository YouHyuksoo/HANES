/**
 * @file iqc-group.entity.ts
 * @description IQC 검사그룹 마스터 엔티티 - 검사항목 묶음 + 검사형태(전수/샘플/무검사)
 *              시퀀스 PK 사용.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. GROUP_CODE: 그룹 코드 (IGR-001 등)
 * 3. INSPECT_METHOD: FULL(전수), SAMPLE(샘플), SKIP(무검사)
 * 4. SAMPLE일 때만 SAMPLE_QTY 사용
 * 5. IQC_GROUP_ITEMS 테이블과 OneToMany 관계
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { IqcGroupItem } from './iqc-group-item.entity';

@Entity({ name: 'IQC_GROUPS' })
@Index(['groupCode'], { unique: true })
export class IqcGroup {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'GROUP_CODE', length: 20 })
  groupCode: string;

  @Column({ name: 'GROUP_NAME', length: 100 })
  groupName: string;

  @Column({ name: 'INSPECT_METHOD', length: 20 })
  inspectMethod: string;

  @Column({ name: 'SAMPLE_QTY', type: 'int', nullable: true })
  sampleQty: number | null;

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

  @OneToMany(() => IqcGroupItem, (item) => item.group, { cascade: true })
  items: IqcGroupItem[];
}
