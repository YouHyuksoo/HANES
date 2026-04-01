/**
 * @file entities/shelf-life-reinspect.entity.ts
 * @description 유수명자재 재검사 엔티티 (SHELF_LIFE_REINSPECTS 테이블)
 *              G11: 수명만료 자재 재검 → 합격:기간연장 / 불합격:불용창고
 *
 * 초보자 가이드:
 * 1. IQC와 동일한 검사항목 참조 (품목별 IQC 항목)
 * 2. 검사분류(전수/선별) 없음, 검사성적서 업로드 없음
 * 3. 합격: 품목정보의 EXTEND_SHELF_DAYS만큼 만료기간 연장
 * 4. 불합격: 불량 시리얼 → 불용창고 자동이동 → 폐기
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SHELF_LIFE_REINSPECTS' })
@Index(['matUid'])
@Index(['result'])
export class ShelfLifeReInspect {
  @PrimaryColumn({ name: 'REINSPECT_NO', length: 20 })
  reinspectNo: string;

  /** 대상 시리얼 */
  @Column({ name: 'MAT_UID', length: 30 })
  matUid: string;

  /** 품목코드 */
  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  /** 검사자 ID */
  @Column({ type: 'varchar2', name: 'INSPECTOR_ID', length: 20, nullable: true })
  inspectorId: string | null;

  /** 검사자 이름 */
  @Column({ type: 'varchar2', name: 'INSPECTOR_NAME', length: 50, nullable: true })
  inspectorName: string | null;

  /** 검사일 */
  @Column({ name: 'INSPECT_DATE', type: 'date' })
  inspectDate: Date;

  /** 검사결과: PASS / FAIL */
  @Column({ name: 'RESULT', length: 10 })
  result: string;

  /** 파괴검사 시료수 */
  @Column({ name: 'DESTRUCT_SAMPLE_QTY', type: 'int', nullable: true })
  destructSampleQty: number | null;

  /** 검사 상세 (JSON) */
  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

  /** 변경 전 만료일 */
  @Column({ name: 'PREV_EXPIRY_DATE', type: 'date', nullable: true })
  prevExpiryDate: Date | null;

  /** 변경 후 만료일 (합격 시) */
  @Column({ name: 'NEW_EXPIRY_DATE', type: 'date', nullable: true })
  newExpiryDate: Date | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
