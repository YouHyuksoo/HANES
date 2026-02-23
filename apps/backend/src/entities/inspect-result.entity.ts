import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProdResult } from './prod-result.entity';

@Entity({ name: 'INSPECT_RESULTS' })
@Index(['prodResultId'])
@Index(['passYn'])
@Index(['serialNo'])
@Index(['inspectScope'])
export class InspectResult {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'PROD_RESULT_ID', length: 255 })
  prodResultId: string;

  @ManyToOne(() => ProdResult, (prodResult) => prodResult.inspectResults)
  @JoinColumn({ name: 'PROD_RESULT_ID' })
  prodResult: ProdResult;

  @Column({ name: 'SERIAL_NO', length: 255, nullable: true })
  serialNo: string | null;

  @Column({ name: 'INSPECT_TYPE', length: 50, nullable: true })
  inspectType: string | null;

  @Column({ name: 'INSPECT_SCOPE', length: 20, nullable: true, comment: '검사범위 (FULL: 전수검사, SAMPLE: 샘플링검사)' })
  inspectScope: string | null;

  @Column({ name: 'PASS_YN', length: 1, default: 'Y' })
  passYn: string;

  @Column({ name: 'ERROR_CODE', length: 50, nullable: true })
  errorCode: string | null;

  @Column({ name: 'ERROR_DETAIL', length: 500, nullable: true })
  errorDetail: string | null;

  @Column({ name: 'INSPECT_DATA', type: 'clob', nullable: true })
  inspectData: string | null;

  @Column({ name: 'INSPECT_TIME', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  inspectAt: Date;

  @Column({ name: 'INSPECTOR_ID', length: 255, nullable: true })
  inspectorId: string | null;

  @Column({ name: 'COMPANY', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 255, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 255, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
