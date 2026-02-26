/**
 * @file entities/label-print-log.entity.ts
 * @description 라벨 발행 이력 엔티티 (LABEL_PRINT_LOGS 테이블)
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. templateId: 라벨 템플릿 ID (number)
 * 3. STATUS: SUCCESS(성공), FAILED(실패)
 * 4. printMode: BROWSER(브라우저) / ZPL(직접출력)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'LABEL_PRINT_LOGS' })
@Index(['category'])
@Index(['printedAt'])
@Index(['status'])
export class LabelPrintLog {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'TEMPLATE_ID', type: 'number', nullable: true })
  templateId: number | null;

  @Column({ name: 'CATEGORY', length: 20 })
  category: string;

  @Column({ name: 'PRINT_MODE', length: 20 })
  printMode: string;

  @Column({ name: 'PRINTER_NAME', length: 100, nullable: true })
  printerName: string | null;

  @Column({ name: 'UID_LIST', type: 'clob', nullable: true })
  uidList: string | null;

  @Column({ name: 'LABEL_COUNT', type: 'number', default: 0 })
  labelCount: number;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerCode: string | null;

  @Column({ name: 'PRINTED_AT', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  printedAt: Date;

  @Column({ name: 'STATUS', length: 20, default: 'SUCCESS' })
  status: string;

  @Column({ name: 'ERROR_MSG', length: 500, nullable: true })
  errorMsg: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
