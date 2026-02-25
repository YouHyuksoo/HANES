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

  @Column({ name: 'ENG_NAME', length: 255, nullable: true })
  engName: string | null;

  @Column({ name: 'DEPT', length: 255, nullable: true })
  dept: string | null;

  @Column({ name: 'POSITION', length: 255, nullable: true })
  position: string | null;

  @Column({ name: 'PHONE', length: 255, nullable: true })
  phone: string | null;

  @Column({ name: 'EMAIL', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'HIRE_DATE', length: 255, nullable: true })
  hireDate: string | null;

  @Column({ name: 'QUIT_DATE', length: 255, nullable: true })
  quitDate: string | null;

  @Column({ name: 'QR_CODE', length: 255, nullable: true })
  qrCode: string | null;

  @Column({ name: 'PHOTO_URL', length: 255, nullable: true })
  photoUrl: string | null;

  @Column({ name: 'PROCESS_IDS', type: 'clob', nullable: true })
  processIds: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
