/**
 * @file src/entities/iqc-log-target.entity.ts
 * @description IQC 판정 대상 — 판정 1건(IQC_LOGS)이 실제로 덮은 입하 행의 목록.
 *
 * 초보자 가이드:
 * 1. 수입검사의 **검사 단위**는 세 가지다. 자재 시리얼 단건 / 입하번호+품목 / 검사의뢰.
 *    셋 중 무엇이든 **판정은 1건**이고, 그 판정이 덮은 범위가 여기에 여러 행으로 남는다.
 * 2. `IQC_LOGS.ARRIVAL_NO`는 대표값 한 개라서 검사의뢰 판정에서 대표 입하 행을 잃는다.
 *    입하 행에서 판정을 되찾을 때는 이 테이블만 본다. 이것이 역추적의 정본이다.
 * 3. 한 행의 단위는 **입하 행**(ARRIVAL_NO + ARRIVAL_SEQ + ITEM_CODE)이다.
 *    MAT_UID는 자재 시리얼 단건 판정일 때만 채운다.
 *
 * 주의: `IQC_REQUEST_LOT_LINES`(구성 라인)와 닮았지만 합치면 안 된다.
 * 구성 라인은 판정 *전*의 계획이라 의뢰 취소로 사라질 수 있고,
 * 판정 대상은 판정 *후*의 불변 스냅샷이다. ADR 0004 참고.
 */
import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity({ name: 'IQC_LOG_TARGETS' })
@Index(['company', 'plant', 'arrivalNo', 'arrivalSeq', 'itemCode'])
@Index(['company', 'plant', 'matUid'])
export class IqcLogTarget {
  /** IQC_LOGS.INSPECT_DATE */
  @PrimaryColumn({ name: 'INSPECT_DATE', type: 'timestamp' })
  inspectDate: Date;

  /** IQC_LOGS.SEQ */
  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @PrimaryColumn({ name: 'ARRIVAL_NO', length: 50 })
  arrivalNo: string;

  /** MAT_ARRIVALS.SEQ. ARRIVAL_NO 단독으로는 입하 행이 유일하지 않다. */
  @PrimaryColumn({ name: 'ARRIVAL_SEQ', type: 'int', default: 1 })
  arrivalSeq: number;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  /** 자재 시리얼 단건 판정일 때만 채운다. 입하단위·의뢰 판정에서는 null. */
  @Column({ type: 'varchar2', name: 'MAT_UID', length: 50, nullable: true })
  matUid: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;
}
