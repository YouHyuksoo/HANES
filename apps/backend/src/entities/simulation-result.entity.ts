/**
 * @file entities/simulation-result.entity.ts
 * @description 시뮬레이션 결과 저장 엔티티 - 실행 결과를 JSON으로 DB에 보관한다.
 *
 * 초보자 가이드:
 * 1. SIM_ID: 자연키 (SIM-YYYYMM-HHMMSS 형식)
 * 2. RESULT_JSON: 시뮬레이션 결과 전체를 JSON 문자열로 저장
 * 3. 마지막 결과 조회: COMPANY+PLANT_CD+SIM_MONTH 기준 최신 1건
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'SIMULATION_RESULTS' })
export class SimulationResultEntity {
  @PrimaryColumn({ name: 'SIM_ID', length: 50 })
  simId: string;

  @Column({ name: 'SIM_MONTH', length: 7 })
  simMonth: string;

  @Column({ name: 'STRATEGY', length: 20, default: 'DUE_DATE' })
  strategy: string;

  @Column({ name: 'RESULT_JSON', type: 'clob' })
  resultJson: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
