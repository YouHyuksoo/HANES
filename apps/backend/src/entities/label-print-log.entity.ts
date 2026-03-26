/**
 * @file entities/label-print-log.entity.ts
 * @description 라벨 발행 이력 엔티티 (LABEL_PRINT_LOGS 테이블)
 *              복합 PK(PRINTED_AT + SEQ) 사용.
 *
 * 초보자 가이드:
 * 1. 복합 PK: printedAt(PRINTED_AT) + seq(SEQ)
 * 2. templateId: 라벨 템플릿 ID (number)
 * 3. STATUS: SUCCESS(성공), FAILED(실패)
 * 4. printMode: BROWSER(브라우저) / ZPL(직접출력)
 */
import {
  Entity,
  PrimaryColumn,
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
  @PrimaryColumn({ name: 'PRINTED_AT', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  printedAt: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @Column({ name: 'TEMPLATE_ID', type: 'number', nullable: true })
  templateId: number | null;

  @Column({ name: 'CATEGORY', length: 20 })
  category: string;

  @Column({ name: 'PRINT_MODE', length: 20 })
  printMode: string;

  @Column({ type: 'varchar2', name: 'PRINTER_NAME', length: 100, nullable: true })
  printerName: string | null;

  @Column({ name: 'UID_LIST', type: 'clob', nullable: true })
  uidList: string | null;

  @Column({ name: 'LABEL_COUNT', type: 'number', default: 0 })
  labelCount: number;

  @Column({ type: 'varchar2', name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'SUCCESS' })
  status: string;

  @Column({ type: 'varchar2', name: 'ERROR_MSG', length: 500, nullable: true })
  errorMsg: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
