/**
 * @file iqc-item-pool.entity.ts
 * @description IQC 검사항목 풀(Pool) 엔티티 - 전역 검사항목 정의 마스터
 *              시퀀스 PK 사용. 충돌 해결: itemCode → inspItemCode, itemName → inspItemName.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. INSP_ITEM_CODE: 검사항목 코드 (IQC-001 등) - 품목코드(itemCode)와 구분
 * 3. INSP_ITEM_NAME: 검사항목명
 * 4. JUDGE_METHOD: VISUAL(육안) / MEASURE(계측)
 * 5. 계측 항목은 LSL/USL/UNIT으로 규격 범위 정의
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'IQC_ITEM_POOL' })
@Index(['inspItemCode'], { unique: true })
export class IqcItemPool {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'INSP_ITEM_CODE', length: 20 })
  inspItemCode: string;

  @Column({ name: 'INSP_ITEM_NAME', length: 100 })
  inspItemName: string;

  @Column({ name: 'JUDGE_METHOD', length: 20 })
  judgeMethod: string;

  @Column({ name: 'CRITERIA', length: 255, nullable: true })
  criteria: string | null;

  @Column({ name: 'LSL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  lsl: number | null;

  @Column({ name: 'USL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  usl: number | null;

  @Column({ name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'REVISION', type: 'int', default: 1 })
  revision: number;

  @Column({ name: 'EFFECTIVE_DATE', type: 'timestamp', nullable: true })
  effectiveDate: Date | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
}
