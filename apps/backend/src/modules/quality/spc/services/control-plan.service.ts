/**
 * @file control-plan.service.ts
 * @description 관리계획서(Control Plan) 서비스 — IATF 16949 8.5.1.1
 *
 * 초보자 가이드:
 * 1. **CRUD**: 관리계획서 등록/조회/수정/삭제
 * 2. **항목 관리**: 관리 항목(ControlPlanItem) 추가/수정/삭제
 * 3. **승인**: DRAFT → REVIEW → APPROVED 상태 전이
 * 4. **개정(revise)**: 기존 버전 OBSOLETE, 새 버전(revisionNo+1) 생성
 * 5. **planNo 자동채번**: CP-YYYYMMDD-NNN
 *
 * 주요 메서드:
 * - generatePlanNo(): 자동채번
 * - findAll(): 목록 조회 (페이지네이션 + 필터)
 * - findById() / create() / update() / delete()
 * - approve(): 승인 (REVIEW → APPROVED)
 * - revise(): 개정 (새 버전 생성, 기존 OBSOLETE)
 * - getByItem(): 품목별 유효 관리계획서 조회
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ControlPlan } from '../../../../entities/control-plan.entity';
import { ControlPlanItem } from '../../../../entities/control-plan-item.entity';
import {
  CreateControlPlanDto,
  UpdateControlPlanDto,
  ControlPlanFilterDto,
  CreateControlPlanItemDto,
} from '../dto/control-plan.dto';

@Injectable()
export class ControlPlanService {
  private readonly logger = new Logger(ControlPlanService.name);

  constructor(
    @InjectRepository(ControlPlan)
    private readonly planRepo: Repository<ControlPlan>,
    @InjectRepository(ControlPlanItem)
    private readonly itemRepo: Repository<ControlPlanItem>,
  ) {}

  // =============================================
  // 관리계획번호 자동채번
  // =============================================

  /**
   * 관리계획번호 자동채번: CP-YYYYMMDD-NNN
   */
  private async generatePlanNo(
    company: string,
    plant: string,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `CP-${dateStr}-`;

    const last = await this.planRepo
      .createQueryBuilder('cp')
      .where('cp.company = :company', { company })
      .andWhere('cp.plant = :plant', { plant })
      .andWhere('cp.planNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('cp.planNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.planNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // =============================================
  // CRUD
  // =============================================

  /**
   * 관리계획서 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(
    query: ControlPlanFilterDto,
    company?: string,
    plant?: string,
  ) {
    const {
      page = 1,
      limit = 50,
      status,
      phase,
      itemCode,
      search,
      startDate,
      endDate,
    } = query;

    const qb = this.planRepo.createQueryBuilder('cp');

    if (company) qb.andWhere('cp.company = :company', { company });
    if (plant) qb.andWhere('cp.plant = :plant', { plant });
    if (status) qb.andWhere('cp.status = :status', { status });
    if (phase) qb.andWhere('cp.phase = :phase', { phase });
    if (itemCode) qb.andWhere('cp.itemCode = :itemCode', { itemCode });
    if (search) {
      qb.andWhere(
        '(UPPER(cp.planNo) LIKE UPPER(:s) OR UPPER(cp.itemName) LIKE UPPER(:s))',
        { s: `%${search}%` },
      );
    }
    if (startDate && endDate) {
      qb.andWhere('cp.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: `${endDate}T23:59:59`,
      });
    }

    qb.orderBy('cp.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 관리계획서 단건 조회 (항목 포함)
   */
  async findById(planNo: string) {
    const plan = await this.planRepo.findOne({ where: { planNo } });
    if (!plan) {
      throw new NotFoundException('관리계획서를 찾을 수 없습니다.');
    }

    const items = await this.itemRepo
      .createQueryBuilder('i')
      .where('i.controlPlanId = :planNo', { planNo })
      .orderBy('i.seq', 'ASC')
      .getMany();

    return { ...plan, items };
  }

  /**
   * 관리계획서 등록 (DRAFT 상태로 생성, 항목 포함)
   */
  async create(
    dto: CreateControlPlanDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const planNo = await this.generatePlanNo(company, plant);
    const { items, ...planData } = dto;

    const entity = this.planRepo.create({
      ...planData,
      planNo,
      revisionNo: 1,
      status: 'DRAFT',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.planRepo.save(entity);

    if (items?.length) {
      await this.saveItems(saved.planNo, items, company, plant, userId);
    }

    this.logger.log(`관리계획서 등록: ${planNo}`);
    return this.findById(saved.planNo);
  }

  /**
   * 관리계획서 수정 (DRAFT 상태에서만 가능)
   */
  async update(planNo: string, dto: UpdateControlPlanDto, userId: string) {
    const plan = await this.planRepo.findOne({ where: { planNo } });
    if (!plan) {
      throw new NotFoundException('관리계획서를 찾을 수 없습니다.');
    }
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('초안 상태에서만 수정할 수 있습니다.');
    }

    const { items, ...planData } = dto;
    Object.assign(plan, planData, { updatedBy: userId });
    await this.planRepo.save(plan);

    if (items !== undefined) {
      await this.itemRepo
        .createQueryBuilder()
        .delete()
        .from(ControlPlanItem)
        .where('controlPlanId = :planNo', { planNo })
        .execute();

      if (items?.length) {
        await this.saveItems(planNo, items, plan.company, plan.plant, userId);
      }
    }

    return this.findById(planNo);
  }

  /**
   * 관리계획서 삭제 (DRAFT 상태에서만 가능)
   */
  async delete(planNo: string) {
    const plan = await this.planRepo.findOne({ where: { planNo } });
    if (!plan) {
      throw new NotFoundException('관리계획서를 찾을 수 없습니다.');
    }
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('초안 상태에서만 삭제할 수 있습니다.');
    }

    await this.itemRepo
      .createQueryBuilder()
      .delete()
      .from(ControlPlanItem)
      .where('controlPlanId = :planNo', { planNo })
      .execute();

    await this.planRepo.remove(plan);
  }

  // =============================================
  // 상태 전이
  // =============================================

  /**
   * 승인 (DRAFT/REVIEW → APPROVED)
   */
  async approve(planNo: string, userId: string) {
    const plan = await this.planRepo.findOne({ where: { planNo } });
    if (!plan) {
      throw new NotFoundException('관리계획서를 찾을 수 없습니다.');
    }
    if (!['DRAFT', 'REVIEW'].includes(plan.status)) {
      throw new BadRequestException(
        '초안 또는 검토 상태에서만 승인할 수 있습니다.',
      );
    }
    plan.status = 'APPROVED';
    plan.approvedBy = userId;
    plan.approvedAt = new Date();
    plan.updatedBy = userId;
    const saved = await this.planRepo.save(plan);
    this.logger.log(`관리계획서 승인: ${plan.planNo}`);
    return saved;
  }

  /**
   * 개정 (기존 OBSOLETE, 새 버전 생성)
   */
  async revise(planNo: string, userId: string) {
    const plan = await this.planRepo.findOne({ where: { planNo } });
    if (!plan) {
      throw new NotFoundException('관리계획서를 찾을 수 없습니다.');
    }
    if (plan.status !== 'APPROVED') {
      throw new BadRequestException(
        '승인된 상태에서만 개정할 수 있습니다.',
      );
    }

    // 기존 항목 복사용 조회
    const oldItems = await this.itemRepo
      .createQueryBuilder('i')
      .where('i.controlPlanId = :planNo', { planNo })
      .orderBy('i.seq', 'ASC')
      .getMany();

    // 기존 버전 → OBSOLETE
    plan.status = 'OBSOLETE';
    plan.updatedBy = userId;
    await this.planRepo.save(plan);

    // 새 버전 생성
    const newPlanNo = await this.generatePlanNo(plan.company, plan.plant);
    const newPlan = this.planRepo.create({
      planNo: newPlanNo,
      itemCode: plan.itemCode,
      itemName: plan.itemName,
      revisionNo: plan.revisionNo + 1,
      revisionDate: new Date(),
      phase: plan.phase,
      status: 'DRAFT',
      remark: plan.remark,
      company: plan.company,
      plant: plan.plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.planRepo.save(newPlan);

    // 항목 복사
    if (oldItems.length) {
      const newItems = oldItems.map((item) =>
        this.itemRepo.create({
          controlPlanId: saved.planNo,
          seq: item.seq,
          processCode: item.processCode,
          processName: item.processName,
          characteristicNo: item.characteristicNo,
          productCharacteristic: item.productCharacteristic,
          processCharacteristic: item.processCharacteristic,
          specialCharClass: item.specialCharClass,
          specification: item.specification,
          evalMethod: item.evalMethod,
          sampleSize: item.sampleSize,
          sampleFreq: item.sampleFreq,
          controlMethod: item.controlMethod,
          reactionPlan: item.reactionPlan,
          remark: item.remark,
          company: plan.company,
          plant: plan.plant,
          createdBy: userId,
        }),
      );
      await this.itemRepo.save(newItems);
    }

    this.logger.log(
      `관리계획서 개정: ${plan.planNo} → ${newPlanNo} (Rev.${saved.revisionNo})`,
    );
    return this.findById(saved.planNo);
  }

  // =============================================
  // 품목별 조회
  // =============================================

  /**
   * 품목별 유효 관리계획서 조회 (최신 APPROVED 버전)
   */
  async getByItem(
    itemCode: string,
    company?: string,
    plant?: string,
  ) {
    const qb = this.planRepo
      .createQueryBuilder('cp')
      .where('cp.itemCode = :itemCode', { itemCode })
      .andWhere('cp.status = :status', { status: 'APPROVED' });

    if (company) qb.andWhere('cp.company = :company', { company });
    if (plant) qb.andWhere('cp.plant = :plant', { plant });

    qb.orderBy('cp.revisionNo', 'DESC');
    const plan = await qb.getOne();

    if (!plan) return null;

    const items = await this.itemRepo
      .createQueryBuilder('i')
      .where('i.controlPlanId = :planNo', { planNo: plan.planNo })
      .orderBy('i.seq', 'ASC')
      .getMany();

    return { ...plan, items };
  }

  // =============================================
  // 내부 헬퍼
  // =============================================

  /**
   * 관리 항목 일괄 저장
   */
  private async saveItems(
    controlPlanId: string,
    items: CreateControlPlanItemDto[],
    company: string,
    plant: string,
    userId: string,
  ) {
    const entities = items.map((item) =>
      this.itemRepo.create({
        ...item,
        controlPlanId,
        company,
        plant,
        createdBy: userId,
      }),
    );
    await this.itemRepo.save(entities);
  }
}
