/**
 * @file iqc-group.entity.ts
 * @description IQC 검사그룹 마스터 엔티티 - 검사항목 묶음 + 검사형태(전수/샘플/무검사)
 *              GROUP_CODE 자연키 PK 사용. ID는 자식 FK 참조용으로 유지.
 *
 * 초보자 가이드:
 * 1. GROUP_CODE가 자연키 PK (IGR-001 등)
 * 2. ID는 자식 테이블 FK 참조용 (시퀀스 자동 생성, 직접 입력/수정 불가)
 * 3. INSPECT_METHOD: FULL(전수), SAMPLE(샘플), SKIP(무검사)
 * 4. SAMPLE일 때만 SAMPLE_QTY 사용
 * 5. IQC_GROUP_ITEMS 테이블과 OneToMany 관계
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { IqcGroupItem } from './iqc-group-item.entity';

@Entity({ name: 'IQC_GROUPS' })
export class IqcGroup {
  @PrimaryColumn({ name: 'GROUP_CODE', length: 20 })
  groupCode: string;

  @Column({ name: 'ID', type: 'int', generated: true, insert: false, update: false })
  id: number;

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
