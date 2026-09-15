/**
 * @file inspect-sample-check.entity.ts
 * @description 양불마스터(한도견본) 대조 헤더 — 통전·단자검사 시작 전 검사기 유효성 확인 기록
 *
 * 초보자 가이드:
 * 1. PK: COMPANY + PLANT_CD + CHECK_NO (채번 docType 'SMP_CHK')
 * 2. 재대조는 갱신이 아니라 새 행이다. 유효 판정은 같은 키의 최신 CHECKED_AT 1건
 * 3. 판정 키 = 작업지시 + 검사유형 + 검사기 + 조업일 + 교대 (SHIFT_CODE 미판별 시 'NONE')
 * 4. CHECKER_ID는 검사기 대표 작업자, CREATED_BY는 로그인 계정(공용 단말에서 다를 수 있다)
 */
import { Entity, PrimaryColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'INSPECT_SAMPLE_CHECKS' })
@Index(['company', 'plant', 'orderNo', 'inspectType', 'equipCode', 'workDate', 'shiftCode'])
export class InspectSampleCheck {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'CHECK_NO', length: 30 })
  checkNo: string;

  @Column({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @Column({ name: 'INSPECT_TYPE', length: 30 })
  inspectType: string;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ type: 'varchar2', name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string | null;

  @Column({ name: 'WORK_DATE', type: 'date' })
  workDate: Date;

  @Column({ name: 'SHIFT_CODE', length: 20, default: 'NONE' })
  shiftCode: string;

  @Column({ name: 'OVERALL_RESULT', length: 10 })
  overallResult: string;

  @Column({ type: 'varchar2', name: 'CHECKER_ID', length: 50, nullable: true })
  checkerId: string | null;

  @Column({ name: 'CHECKED_AT', type: 'timestamp' })
  checkedAt: Date;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
