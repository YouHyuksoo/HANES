/**
 * @file src/modules/quality/rework/services/rework-process.service.ts
 * @description 재작업 공정/실적 관리 서비스 — 공정별 작업 시작/완료/건너뛰기, 실적 등록
 *
 * 초보자 가이드:
 * 1. **공정 관리**: ReworkProcess CRUD + 상태 전환 (WAITING → IN_PROGRESS → COMPLETED/SKIPPED)
 * 2. **실적 등록**: ReworkResult 생성 → 공정 resultQty 자동 합산
 * 3. **자동 전환**: 전체 공정 완료 시 ReworkOrder → INSPECT_PENDING 자동 전환
 * 4. **복합키**: ReworkProcess(reworkOrderId + processCode), ReworkResult(reworkOrderId + processCode + seq)
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { ReworkProcess } from '../../../../entities/rework-process.entity';
import { ReworkResult } from '../../../../entities/rework-result.entity';
import { CreateReworkResultDto } from '../dto/rework.dto';

@Injectable()
export class ReworkProcessService {
  private readonly logger = new Logger(ReworkProcessService.name);

  constructor(
    @InjectRepository(ReworkOrder)
    private readonly reworkRepo: Repository<ReworkOrder>,
    @InjectRepository(ReworkProcess)
    private readonly processRepo: Repository<ReworkProcess>,
    @InjectRepository(ReworkResult)
    private readonly resultRepo: Repository<ReworkResult>,
  ) {}

  /**
   * 공정 목록 조회 (재작업 지시 ID 기준, seq 순)
   */
  async findProcesses(reworkOrderId: number) {
    return this.processRepo.find({
      where: { reworkOrderId },
      order: { seq: 'ASC' },
    });
  }

  /**
   * 공정 단건 조회 (복합키: reworkOrderId + processCode)
   */
  private async findProcess(reworkOrderId: number, processCode: string): Promise<ReworkProcess> {
    const proc = await this.processRepo.findOne({
      where: { reworkOrderId, processCode },
    });
    if (!proc) throw new NotFoundException('재작업 공정을 찾을 수 없습니다.');
    return proc;
  }

  /**
   * 공정 작업시작 (WAITING -> IN_PROGRESS)
   * 첫 공정 시작 시 재작업 지시도 IN_PROGRESS로 전환
   */
  async startProcess(reworkOrderId: number, processCode: string, userId: string) {
    const proc = await this.findProcess(reworkOrderId, processCode);
    if (proc.status !== 'WAITING') {
      throw new BadRequestException('대기 상태에서만 시작할 수 있습니다.');
    }

    proc.status = 'IN_PROGRESS';
    proc.startAt = new Date();
    proc.updatedBy = userId;
    await this.processRepo.save(proc);

    const order = await this.reworkRepo.findOne({ where: { id: proc.reworkOrderId } });
    if (order && order.status === 'APPROVED') {
      order.status = 'IN_PROGRESS';
      order.startAt = new Date();
      order.updatedBy = userId;
      await this.reworkRepo.save(order);
    }

    return proc;
  }

  /**
   * 공정 작업완료 (IN_PROGRESS -> COMPLETED)
   * 모든 공정 완료 시 재작업 지시를 INSPECT_PENDING으로 자동 전환
   */
  async completeProcess(reworkOrderId: number, processCode: string, resultQty: number, userId: string) {
    const proc = await this.findProcess(reworkOrderId, processCode);
    if (proc.status !== 'IN_PROGRESS') {
      throw new BadRequestException('진행중 상태에서만 완료할 수 있습니다.');
    }

    proc.status = 'COMPLETED';
    proc.resultQty = resultQty;
    proc.endAt = new Date();
    proc.updatedBy = userId;
    await this.processRepo.save(proc);

    await this.checkAllProcessesComplete(proc.reworkOrderId, userId);
    return proc;
  }

  /**
   * 공정 건너뛰기 (WAITING -> SKIPPED)
   */
  async skipProcess(reworkOrderId: number, processCode: string, userId: string) {
    const proc = await this.findProcess(reworkOrderId, processCode);
    if (proc.status !== 'WAITING') {
      throw new BadRequestException('대기 상태에서만 건너뛸 수 있습니다.');
    }

    proc.status = 'SKIPPED';
    proc.updatedBy = userId;
    await this.processRepo.save(proc);

    await this.checkAllProcessesComplete(proc.reworkOrderId, userId);
    return proc;
  }

  /**
   * 공정별 실적 조회 (복합키: reworkOrderId + processCode)
   */
  async findResults(reworkOrderId: number, processCode: string) {
    return this.resultRepo.find({
      where: { reworkOrderId, processCode },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 재작업 실적 등록 -- 공정별 실적 기록 및 공정 resultQty 업데이트
   */
  async createResult(
    dto: CreateReworkResultDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const proc = await this.findProcess(dto.reworkOrderId, dto.processCode);

    // seq 자동채번: 해당 공정의 실적 건수 + 1
    const existingCount = await this.resultRepo.count({
      where: { reworkOrderId: dto.reworkOrderId, processCode: dto.processCode },
    });

    const result = this.resultRepo.create({
      reworkOrderId: dto.reworkOrderId,
      processCode: dto.processCode,
      seq: existingCount + 1,
      workerId: dto.workerId,
      resultQty: dto.resultQty,
      goodQty: dto.goodQty,
      defectQty: dto.defectQty,
      workDetail: dto.workDetail,
      workTimeMin: dto.workTimeMin,
      remarks: dto.remarks,
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.resultRepo.save(result);

    const results = await this.resultRepo.find({
      where: { reworkOrderId: dto.reworkOrderId, processCode: dto.processCode },
    });
    proc.resultQty = results.reduce((sum, r) => sum + r.resultQty, 0);
    proc.updatedBy = userId;
    await this.processRepo.save(proc);

    this.logger.log(
      `재작업 실적 등록: reworkOrderId=${dto.reworkOrderId}, processCode=${dto.processCode}, resultQty=${dto.resultQty}`,
    );
    return saved;
  }

  /**
   * 모든 공정 완료/건너뛰기 확인 -> 재작업 지시 자동 전환
   */
  private async checkAllProcessesComplete(reworkOrderId: number, userId: string) {
    const processes = await this.processRepo.find({ where: { reworkOrderId } });
    if (processes.length === 0) return;

    const allDone = processes.every((p) => ['COMPLETED', 'SKIPPED'].includes(p.status));
    if (!allDone) return;

    const order = await this.reworkRepo.findOne({ where: { id: reworkOrderId } });
    if (!order || order.status !== 'IN_PROGRESS') return;

    const totalResultQty = processes
      .filter((p) => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.resultQty, 0);

    order.status = 'INSPECT_PENDING';
    order.endAt = new Date();
    order.resultQty = totalResultQty;
    order.updatedBy = userId;
    await this.reworkRepo.save(order);

    this.logger.log(
      `재작업 전체 공정 완료 -> INSPECT_PENDING: orderId=${reworkOrderId}, totalResultQty=${totalResultQty}`,
    );
  }
}
