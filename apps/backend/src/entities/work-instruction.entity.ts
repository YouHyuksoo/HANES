/**
 * @file entities/work-instruction.entity.ts
 * @description 작업지시서 엔티티 - 품목별 공정 작업지시서를 관리한다.
 *              SEQUENCE(패턴 B)를 사용한다. partId -> itemCode 변경.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. itemCode: 대상 품목 코드 (ITEM_MASTERS.ITEM_CODE 참조)
 * 3. content: 작업지시 내용 (CLOB)
 * 4. revision: 리비전 (A, B, C...)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'WORK_INSTRUCTIONS' })
@Index(['itemCode'])
@Index(['processCode'])
export class WorkInstruction {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ name: 'TITLE', length: 255 })
  title: string;

  @Column({ name: 'CONTENT', type: 'clob', nullable: true })
  content: string | null;

  @Column({ name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'REVISION', length: 20, default: 'A' })
  revision: string;

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
}
