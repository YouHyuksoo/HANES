/**
 * @file limit-sample-image.entity.ts
 * @description 양불마스터 견본 사진 — 한 견본에 각도별·불량부위별 여러 장
 *
 * 초보자 가이드:
 * 1. PK: COMPANY + PLANT_CD + SAMPLE_CODE + SEQ_NO. SEQ_NO는 견본 내 MAX+1로 채번한다.
 * 2. IS_PRIMARY='Y'가 대표 사진이고 견본당 1건뿐이다 (DB 유니크 인덱스 UX_LIMIT_SAMPLE_IMAGES_PRIMARY가 강제).
 * 3. 그리드 썸네일과 대조 모달 썸네일은 대표 1장만 쓴다.
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'LIMIT_SAMPLE_IMAGES' })
export class LimitSampleImage {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'SAMPLE_CODE', length: 50 })
  sampleCode: string;

  @PrimaryColumn({ name: 'SEQ_NO', type: 'number' })
  seqNo: number;

  @Column({ name: 'IMAGE_URL', length: 500 })
  imageUrl: string;

  @Column({ type: 'varchar2', name: 'CAPTION', length: 200, nullable: true })
  caption: string | null;

  @Column({ name: 'IS_PRIMARY', length: 1, default: 'N' })
  isPrimary: string;

  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
