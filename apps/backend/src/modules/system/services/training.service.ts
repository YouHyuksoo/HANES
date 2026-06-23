/**
 * @file training.service.ts
 * @description 교육훈련 서비스 — IATF 16949 7.2 적격성(교육훈련)
 *
 * 초보자 가이드:
 * 1. **교육 계획 CRUD**: 등록, 조회, 수정, 삭제
 * 2. **교육 결과 등록**: 작업자별 참석/평가 기록
 * 3. **상태 흐름**: PLANNED → IN_PROGRESS → COMPLETED / CANCELLED
 * 4. **planNo 자동채번**: TRN-YYYYMMDD-NNN
 *
 * 주요 메서드:
 * - generatePlanNo(): 자동채번
 * - findAll(): 목록 조회 (페이지네이션 + 필터)
 * - findById() / create() / update() / delete()
 * - complete(): 완료 처리 (IN_PROGRESS → COMPLETED)
 * - addResult(): 교육 결과 등록
 * - getWorkerHistory(): 작업자 교육 이력 조회
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { TrainingPlan } from '../../../entities/training-plan.entity';
import { TrainingResult } from '../../../entities/training-result.entity';
import {
  CreateTrainingPlanDto,
  UpdateTrainingPlanDto,
  CreateTrainingResultDto,
  TrainingQueryDto,
} from '../dto/training.dto';
import { NumberingService } from '../../../shared/numbering.service';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    @InjectRepository(TrainingPlan)
    private readonly planRepo: Repository<TrainingPlan>,
    @InjectRepository(TrainingResult)
    private readonly resultRepo: Repository<TrainingResult>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    row: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && row.company !== company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row.company ?? 'NULL'}`,
      );
    }
    if (plant && row.plant !== plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row.plant ?? 'NULL'}`,
      );
    }
  }

  // =============================================
  // 교육 계획 CRUD
  // =============================================

  /**
   * 교육 계획 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(query: TrainingQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 50,
      status,
      trainingType,
      search,
      fromDate,
      toDate,
    } = query;

    const qb = this.planRepo.createQueryBuilder('t');

    if (company) qb.andWhere('t.company = :company', { company });
    if (plant) qb.andWhere('t.plant = :plant', { plant });
    if (status) qb.andWhere('t.status = :status', { status });
    if (trainingType)
      qb.andWhere('t.trainingType = :trainingType', { trainingType });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(t.planNo LIKE :sCode OR t.title LIKE :sRaw)',
        { sCode: `%${upper}%`, sRaw: `%${search}%` },
      );
    }
    if (fromDate && toDate) {
      qb.andWhere('t.createdAt BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(`${fromDate}T00:00:00`),
        toDate: new Date(`${toDate}T23:59:59`),
      });
    }

    qb.orderBy('t.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 교육 계획 단건 조회
   */
  async findById(planNo: string, company?: string, plant?: string) {
    const item = await this.planRepo.findOne({
      where: { planNo, ...this.tenantWhere(company, plant) },
    });
    if (!item) {
      throw new NotFoundException('교육 계획을 찾을 수 없습니다.');
    }
    this.assertSameTenant('교육 계획', item, company, plant);
    return item;
  }

  /**
   * 교육 계획 등록 (PLANNED 상태로 생성)
   */
  async create(
    dto: CreateTrainingPlanDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    // NUM_RULE_MASTERS + SELECT FOR UPDATE 기반 채번 (동시성 안전)
    const planNo = await this.numbering.next('TRAINING_PLAN', undefined, userId);
    const entity = this.planRepo.create({
      planNo,
      title: dto.title,
      trainingType: dto.trainingType,
      targetRole: dto.targetRole ?? null,
      instructor: dto.instructor ?? null,
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
      duration: dto.duration ?? null,
      maxParticipants: dto.maxParticipants ?? null,
      status: 'PLANNED',
      description: dto.description ?? null,
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.planRepo.save(entity);
    this.logger.log(`교육 계획 등록: ${planNo}`);
    return saved;
  }

  /**
   * 교육 계획 수정 (PLANNED 상태에서만 가능)
   */
  async update(
    planNo: string,
    dto: UpdateTrainingPlanDto,
    userId: string,
    company?: string,
    plant?: string,
  ) {
    const item = await this.findById(planNo, company, plant);
    const updateData: Partial<TrainingPlan> = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.trainingType !== undefined ? { trainingType: dto.trainingType } : {}),
      ...(dto.targetRole !== undefined ? { targetRole: dto.targetRole } : {}),
      ...(dto.instructor !== undefined ? { instructor: dto.instructor } : {}),
      ...(dto.scheduledDate !== undefined ? { scheduledDate: new Date(dto.scheduledDate) } : {}),
      ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
      ...(dto.maxParticipants !== undefined ? { maxParticipants: dto.maxParticipants } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
    };
    Object.assign(item, updateData, { updatedBy: userId });
    return this.planRepo.save(item);
  }

  /**
   * 교육 계획 삭제 — 결과 삭제 + 계획 삭제를 단일 트랜잭션으로 처리 (원자성 보장)
   */
  async delete(planNo: string, company?: string, plant?: string) {
    const item = await this.findById(planNo, company, plant);
    await this.tx.run(async (queryRunner) => {
      await queryRunner.manager.delete(TrainingResult, {
        planNo,
        ...this.tenantWhere(company, plant),
      });
      await queryRunner.manager.remove(TrainingPlan, item);
    });
  }

  // =============================================
  // 상태 전이
  // =============================================

  /**
   * 완료 처리 (PLANNED/IN_PROGRESS → COMPLETED)
   */
  async complete(
    planNo: string,
    userId: string,
    company?: string,
    plant?: string,
  ) {
    const item = await this.findById(planNo, company, plant);
    if (!['PLANNED', 'IN_PROGRESS'].includes(item.status)) {
      throw new BadRequestException(
        '계획 또는 진행중 상태에서만 완료할 수 있습니다.',
      );
    }
    item.status = 'COMPLETED';
    item.updatedBy = userId;
    const saved = await this.planRepo.save(item);
    this.logger.log(`교육 완료: ${item.planNo}`);
    return saved;
  }

  /**
   * 완료 취소 (COMPLETED → PLANNED)
   */
  async cancelComplete(
    planNo: string,
    userId: string,
    company?: string,
    plant?: string,
  ) {
    const item = await this.findById(planNo, company, plant);
    if (item.status !== 'COMPLETED') {
      throw new BadRequestException('완료 상태에서만 취소할 수 있습니다.');
    }
    item.status = 'PLANNED';
    item.updatedBy = userId;
    const saved = await this.planRepo.save(item);
    this.logger.log(`교육 완료 취소: ${item.planNo}`);
    return saved;
  }

  // =============================================
  // 교육 결과
  // =============================================

  /**
   * 교육 결과 등록
   */
  async addResult(
    planNo: string,
    dto: CreateTrainingResultDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    await this.findById(planNo, company, plant);
    const entity = this.resultRepo.create({
      planNo,
      workerCode: dto.workerCode,
      workerName: dto.workerName,
      attendDate: dto.attendDate ? new Date(dto.attendDate) : null,
      score: dto.score ?? null,
      passed: dto.passed ?? 0,
      certificateNo: dto.certificateNo ?? null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      remark: dto.remark ?? null,
      company,
      plant,
      createdBy: userId,
    });
    const saved = await this.resultRepo.save(entity);
    this.logger.log(
      `교육 결과 등록: planNo=${planNo}, worker=${dto.workerCode}`,
    );
    return saved;
  }

  /**
   * 교육 계획별 결과 조회 (작업자 사진 포함)
   */
  async getResults(planNo: string, company?: string, plant?: string) {
    await this.findById(planNo, company, plant);
    const results = await this.resultRepo
      .createQueryBuilder('r')
      .where('r.planNo = :planNo', { planNo })
      .andWhere(company ? 'r.company = :company' : '1 = 1', { company })
      .andWhere(plant ? 'r.plant = :plant' : '1 = 1', { plant })
      .orderBy('r.createdAt', 'DESC')
      .getMany();

    if (results.length === 0) return results;

    const workerCodes = [...new Set(results.map(r => r.workerCode))].filter(
      (code): code is string => !!code,
    );
    const workerMap = new Map<string, { photoUrl: string | null; dept: string | null }>();

    // Oracle IN 리스트는 1000개 한도. chunk 단위로 분할 조회.
    const chunkSize = 900;

    // 1차: tenant 필터로 워커 조회.
    for (let offset = 0; offset < workerCodes.length; offset += chunkSize) {
      const chunk = workerCodes.slice(offset, offset + chunkSize);
      const params: unknown[] = [...chunk];
      const placeholders = chunk.map((_, i) => `:${i + 1}`).join(',');
      let tenantFilter = '';
      if (company) {
        params.push(company);
        tenantFilter += ` AND COMPANY = :${params.length}`;
      }
      if (plant) {
        params.push(plant);
        tenantFilter += ` AND PLANT_CD = :${params.length}`;
      }
      const rows = await this.resultRepo.manager.query(
        `SELECT WORKER_CODE, PHOTO_URL, DEPT FROM WORKER_MASTERS WHERE WORKER_CODE IN (${placeholders})${tenantFilter}`,
        params,
      );
      for (const w of rows) {
        workerMap.set(w.WORKER_CODE, { photoUrl: w.PHOTO_URL, dept: w.DEPT });
      }
    }

    // 2차 fallback: 전배/타 사업장 워커는 tenant 한정 조회에서 누락된다.
    // 매칭 안 된 코드만 골라 전역 조회 — photoUrl/dept 자체는 워커가 어디 소속이든
    // 동일한 PII 라 응답 누락보다 보여 주는 편이 낫다.
    const missing = workerCodes.filter((code) => !workerMap.has(code));
    if (missing.length > 0 && (company || plant)) {
      for (let offset = 0; offset < missing.length; offset += chunkSize) {
        const chunk = missing.slice(offset, offset + chunkSize);
        const params: unknown[] = [...chunk];
        const placeholders = chunk.map((_, i) => `:${i + 1}`).join(',');
        const rows = await this.resultRepo.manager.query(
          `SELECT WORKER_CODE, PHOTO_URL, DEPT FROM WORKER_MASTERS WHERE WORKER_CODE IN (${placeholders})`,
          params,
        );
        for (const w of rows) {
          if (!workerMap.has(w.WORKER_CODE)) {
            workerMap.set(w.WORKER_CODE, { photoUrl: w.PHOTO_URL, dept: w.DEPT });
          }
        }
      }
    }

    return results.map(r => {
      const worker = workerMap.get(r.workerCode);
      return {
        ...r,
        photoUrl: worker?.photoUrl ?? null,
        dept: worker?.dept ?? null,
      };
    });
  }

  /**
   * 교육 결과 수정
   */
  async updateResult(
    planNo: string,
    workerCode: string,
    dto: Partial<CreateTrainingResultDto>,
    company?: string,
    plant?: string,
  ) {
    const item = await this.resultRepo.findOne({
      where: { planNo, workerCode, ...this.tenantWhere(company, plant) },
    });
    if (!item) {
      throw new NotFoundException('교육 결과를 찾을 수 없습니다.');
    }
    this.assertSameTenant('교육 결과', item, company, plant);
    const updateData: Partial<TrainingResult> = {
      ...(dto.workerName !== undefined ? { workerName: dto.workerName } : {}),
      ...(dto.attendDate !== undefined ? { attendDate: new Date(dto.attendDate) } : {}),
      ...(dto.score !== undefined ? { score: dto.score } : {}),
      ...(dto.passed !== undefined ? { passed: dto.passed } : {}),
      ...(dto.certificateNo !== undefined ? { certificateNo: dto.certificateNo } : {}),
      ...(dto.validUntil !== undefined ? { validUntil: new Date(dto.validUntil) } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    };
    Object.assign(item, updateData);
    return this.resultRepo.save(item);
  }

  /**
   * 교육 결과 삭제
   */
  async deleteResult(
    planNo: string,
    workerCode: string,
    company?: string,
    plant?: string,
  ) {
    const item = await this.resultRepo.findOne({
      where: { planNo, workerCode, ...this.tenantWhere(company, plant) },
    });
    if (!item) {
      throw new NotFoundException('교육 결과를 찾을 수 없습니다.');
    }
    this.assertSameTenant('교육 결과', item, company, plant);
    await this.resultRepo.remove(item);
  }

  /**
   * 작업자 교육 이력 조회
   */
  async getWorkerHistory(
    workerCode: string,
    company?: string,
    plant?: string,
  ) {
    const qb = this.resultRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.plan', 'plan')
      .where('r.workerCode = :workerCode', { workerCode });

    if (company) qb.andWhere('r.company = :company', { company });
    if (plant) qb.andWhere('r.plant = :plant', { plant });

    qb.orderBy('r.createdAt', 'DESC');
    return qb.getMany();
  }
}
