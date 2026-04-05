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
import { TrainingPlan } from '../../../entities/training-plan.entity';
import { TrainingResult } from '../../../entities/training-result.entity';
import {
  CreateTrainingPlanDto,
  UpdateTrainingPlanDto,
  CreateTrainingResultDto,
  TrainingQueryDto,
} from '../dto/training.dto';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    @InjectRepository(TrainingPlan)
    private readonly planRepo: Repository<TrainingPlan>,
    @InjectRepository(TrainingResult)
    private readonly resultRepo: Repository<TrainingResult>,
  ) {}

  // =============================================
  // 계획번호 자동채번
  // =============================================

  /**
   * 계획번호 자동채번: TRN-YYYYMMDD-NNN
   */
  private async generatePlanNo(
    company: string,
    plant: string,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `TRN-${dateStr}-`;

    const last = await this.planRepo
      .createQueryBuilder('t')
      .where('t.company = :company', { company })
      .andWhere('t.plant = :plant', { plant })
      .andWhere('t.planNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('t.planNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.planNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
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
      startDate,
      endDate,
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
    if (startDate && endDate) {
      qb.andWhere('t.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: `${endDate}T23:59:59`,
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
  async findById(planNo: string) {
    const item = await this.planRepo.findOne({ where: { planNo } });
    if (!item) {
      throw new NotFoundException('교육 계획을 찾을 수 없습니다.');
    }
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
    const planNo = await this.generatePlanNo(company, plant);
    const entity = this.planRepo.create({
      ...dto,
      planNo,
      status: 'PLANNED',
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
  async update(planNo: string, dto: UpdateTrainingPlanDto, userId: string) {
    const item = await this.findById(planNo);
    Object.assign(item, dto, { updatedBy: userId });
    return this.planRepo.save(item);
  }

  /**
   * 교육 계획 삭제
   */
  async delete(planNo: string) {
    const item = await this.findById(planNo);
    // 연관된 교육 결과도 함께 삭제
    await this.resultRepo.delete({ planNo });
    await this.planRepo.remove(item);
  }

  // =============================================
  // 상태 전이
  // =============================================

  /**
   * 완료 처리 (PLANNED/IN_PROGRESS → COMPLETED)
   */
  async complete(planNo: string, userId: string) {
    const item = await this.findById(planNo);
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
  async cancelComplete(planNo: string, userId: string) {
    const item = await this.findById(planNo);
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
    await this.findById(planNo);
    const entity = this.resultRepo.create({
      ...dto,
      planNo,
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
  async getResults(planNo: string) {
    const results = await this.resultRepo
      .createQueryBuilder('r')
      .where('r.planNo = :planNo', { planNo })
      .orderBy('r.createdAt', 'DESC')
      .getMany();

    if (results.length === 0) return results;

    const workerCodes = [...new Set(results.map(r => r.workerCode))];
    const placeholders = workerCodes.map((_, i) => `:${i}`).join(',');
    const workers = await this.resultRepo.manager.query(
      `SELECT WORKER_CODE, PHOTO_URL, DEPT FROM WORKER_MASTERS WHERE WORKER_CODE IN (${placeholders})`,
      workerCodes,
    );
    const workerMap = new Map<string, { photoUrl: string | null; dept: string | null }>();
    for (const w of workers) {
      workerMap.set(w.WORKER_CODE, { photoUrl: w.PHOTO_URL, dept: w.DEPT });
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
  async updateResult(planNo: string, workerCode: string, dto: Partial<CreateTrainingResultDto>) {
    const item = await this.resultRepo.findOne({ where: { planNo, workerCode } });
    if (!item) {
      throw new NotFoundException('교육 결과를 찾을 수 없습니다.');
    }
    Object.assign(item, dto);
    return this.resultRepo.save(item);
  }

  /**
   * 교육 결과 삭제
   */
  async deleteResult(planNo: string, workerCode: string) {
    const item = await this.resultRepo.findOne({ where: { planNo, workerCode } });
    if (!item) {
      throw new NotFoundException('교육 결과를 찾을 수 없습니다.');
    }
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
