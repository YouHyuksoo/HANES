/**
 * @file entities/worker-master.entity.ts
 * @description 작업자 마스터 엔티티 - 작업자 정보를 관리한다.
 *              workerCode를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. workerCode가 PK (UUID 대신 자연키)
 * 2. processIds: CLOB에 JSON 배열로 담당 공정 목록 저장
 * 3. qrCode: QR 스캔용 코드
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'WORKER_MASTERS' })
@Index(['dept'])
export class WorkerMaster {
  @PrimaryColumn({ name: 'WORKER_CODE', length: 50 })
  workerCode: string;

  @Column({ name: 'WORKER_NAME', length: 255 })
  workerName: string;

  @Column({ type: 'varchar2', name: 'ENG_NAME', length: 255, nullable: true })
  engName: string | null;

  @Column({ type: 'varchar2', name: 'DEPT', length: 255, nullable: true })
  dept: string | null;

  @Column({ type: 'varchar2', name: 'POSITION', length: 255, nullable: true })
  position: string | null;

  @Column({ type: 'varchar2', name: 'PHONE', length: 255, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar2', name: 'EMAIL', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar2', name: 'HIRE_DATE', length: 255, nullable: true })
  hireDate: string | null;

  @Column({ type: 'varchar2', name: 'QUIT_DATE', length: 255, nullable: true })
  quitDate: string | null;

  @Column({ type: 'varchar2', name: 'QR_CODE', length: 255, nullable: true })
  qrCode: string | null;

  @Column({ type: 'varchar2', name: 'PHOTO_URL', length: 255, nullable: true })
  photoUrl: string | null;

  @Column({ name: 'PROCESS_IDS', type: 'clob', nullable: true })
  processIds: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
