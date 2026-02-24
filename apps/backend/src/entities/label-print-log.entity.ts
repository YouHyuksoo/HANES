/**
 * @file entities/label-print-log.entity.ts
 * @description 라벨 발행 이력 엔티티 (LABEL_PRINT_LOGS 테이블)
 *
 * 초보자 가이드:
 * - 라벨을 발행할 때마다 이력을 저장하는 테이블
 * - 누가, 언제, 몇 장을, 어떤 프린터로 발행했는지 추적
 * - STATUS: SUCCESS(성공), FAILED(실패)
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
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'TEMPLATE_ID', type: 'raw', length: 16, nullable: true })
  templateId: string | null;

  @Column({ name: 'CATEGORY', length: 20 })
  category: string;

  @Column({ name: 'PRINT_MODE', length: 20 })
  printMode: string;

  @Column({ name: 'PRINTER_NAME', length: 100, nullable: true })
  printerName: string | null;

  @Column({ name: 'LOT_IDS', type: 'clob', nullable: true })
  lotIds: string | null;

  @Column({ name: 'LABEL_COUNT', type: 'number', default: 0 })
  labelCount: number;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

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
