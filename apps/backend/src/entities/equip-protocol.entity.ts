/**
 * @file equip-protocol.entity.ts
 * @description 장비 통신 프로토콜 설정 엔티티
 *              통전검사기 등 장비별 데이터 포맷/파싱 규칙을 정의한다.
 *
 * 초보자 가이드:
 * 1. PROTOCOL_ID: 프로토콜 식별자 (PK, 자연키)
 * 2. DELIMITER: 데이터 구분자 (쉼표, 탭 등)
 * 3. RESULT_INDEX: 구분자로 분리한 후 합격/불합격 값의 위치 (0-based)
 * 4. PASS_VALUE/FAIL_VALUE: 합격/불합격 판정 문자열 매핑
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'EQUIP_PROTOCOLS' })
export class EquipProtocol {
  @PrimaryColumn({ name: 'PROTOCOL_ID', length: 30 })
  protocolId: string;

  @Column({ name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;

  @Column({ name: 'PROTOCOL_NAME', length: 100 })
  protocolName: string;

  @Column({ name: 'COMM_TYPE', length: 20, default: 'SERIAL' })
  commType: string;

  @Column({ name: 'DELIMITER', length: 10, default: ',' })
  delimiter: string;

  @Column({ name: 'RESULT_INDEX', type: 'int', default: 1 })
  resultIndex: number;

  @Column({ name: 'PASS_VALUE', length: 20, default: 'PASS' })
  passValue: string;

  @Column({ name: 'FAIL_VALUE', length: 20, default: 'FAIL' })
  failValue: string;

  @Column({ name: 'ERROR_INDEX', type: 'int', nullable: true })
  errorIndex: number | null;

  @Column({ name: 'DATA_START_CHAR', length: 5, nullable: true })
  dataStartChar: string | null;

  @Column({ name: 'DATA_END_CHAR', length: 5, nullable: true })
  dataEndChar: string | null;

  @Column({ name: 'SAMPLE_DATA', length: 500, nullable: true })
  sampleData: string | null;

  @Column({ name: 'DESCRIPTION', length: 200, nullable: true })
  description: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
