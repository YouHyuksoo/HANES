/**
 * @file src/modules/production/services/prod-result.service.ts
 * @description 생산실적 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **실적 집계**: 작업지시별, 설비별, 작업자별 실적 집계
 * 3. **TypeORM 사용**: Repository 패턴을 통해 DB 접근
 *
 * 실제 DB 스키마 (prod_results 테이블):
 * - jobOrderId로 작업지시와 연결
 * - status: RUNNING, DONE, CANCELED
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between, ILike, Not } from 'typeorm';
import { ProdResult } from '../../../entities/prod-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { User } from '../../../entities/user.entity';
import {
  CreateProdResultDto,
  UpdateProdResultDto,
  ProdResultQueryDto,
  CompleteProdResultDto,
} from '../dto/prod-result.dto';

@Injectable()
export class ProdResultService {
  private readonly logger = new Logger(ProdResultService.name);

  constructor(
    @InjectRepository(ProdResult)
    private readonly prodResultRepository: Repository<ProdResult>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepository: Repository<EquipMaster>,
    @InjectRepository(ConsumableMaster)
    private readonly consumableMasterRepository: Repository<ConsumableMaster>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 생산실적 목록 조회
   */
  async findAll(query: ProdResultQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 10,
      jobOrderId,
      equipId,
      workerId,
      lotNo,
      processCode,
      status,
      startTimeFrom,
      startTimeTo,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: IsNull(),
      ...(company && { company }),
      ...(plant && { plant }),
      ...(jobOrderId && { jobOrderId }),
      ...(equipId && { equipId }),
      ...(workerId && { workerId }),
      ...(lotNo && { lotNo: ILike(`%${lotNo}%`) }),
      ...(processCode && { processCode }),
      ...(status && { status }),
      ...(startTimeFrom || startTimeTo
        ? {
            startAt: Between(
              startTimeFrom ? new Date(startTimeFrom) : new Date('1900-01-01'),
              startTimeTo ? new Date(startTimeTo) : new Date('2099-12-31'),
            ),
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prodResultRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
        relations: ['jobOrder', 'equip', 'worker'],
        select: {
          id: true,
          jobOrderId: true,
          equipId: true,
          workerId: true,
          lotNo: true,
          processCode: true,
          goodQty: true,
          defectQty: true,
          startAt: true,
          endAt: true,
          cycleTime: true,
          status: true,
          remark: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prodResultRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 생산실적 단건 조회 (ID)
   */
  async findById(id: string) {
    const prodResult = await this.prodResultRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['jobOrder', 'jobOrder.part', 'equip', 'worker', 'inspectResults', 'defectLogs'],
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${id}`);
    }

    // Filter inspectResults (only passYn = 'N') and limit to 10
    if (prodResult.inspectResults) {
      prodResult.inspectResults = prodResult.inspectResults
        .filter((r: any) => r.passYn === 'N')
        .slice(0, 10);
    }

    // Limit defectLogs to 10
    if (prodResult.defectLogs) {
      prodResult.defectLogs = prodResult.defectLogs.slice(0, 10);
    }

    return prodResult;
  }

  /**
   * 작업지시별 생산실적 목록 조회
   */
  async findByJobOrderId(jobOrderId: string) {
    return this.prodResultRepository.find({
      where: { jobOrderId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      relations: ['equip', 'worker'],
      select: {
        id: true,
        jobOrderId: true,
        equipId: true,
        workerId: true,
        lotNo: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 생산실적 생성
   */
  async create(dto: CreateProdResultDto) {
    // 작업지시 존재 및 상태 확인
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { id: dto.jobOrderId, deletedAt: IsNull() },
    });

    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${dto.jobOrderId}`);
    }

    if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
      throw new BadRequestException(`완료되거나 취소된 작업지시에는 실적을 등록할 수 없습니다.`);
    }

    // 설비 존재 확인 (옵션)
    if (dto.equipId) {
      const equip = await this.equipMasterRepository.findOne({
        where: { id: dto.equipId, deletedAt: IsNull() },
      });
      if (!equip) {
        throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipId}`);
      }
    }

    // 작업자 존재 확인 (옵션)
    if (dto.workerId) {
      const worker = await this.userRepository.findOne({
        where: { id: dto.workerId, deletedAt: IsNull() },
      });
      if (!worker) {
        throw new NotFoundException(`작업자를 찾을 수 없습니다: ${dto.workerId}`);
      }
    }

    const prodResult = this.prodResultRepository.create({
      jobOrderId: dto.jobOrderId,
      equipId: dto.equipId,
      workerId: dto.workerId,
      lotNo: dto.lotNo,
      processCode: dto.processCode,
      goodQty: dto.goodQty ?? 0,
      defectQty: dto.defectQty ?? 0,
      startAt: dto.startAt ? new Date(dto.startAt) : new Date(),
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      cycleTime: dto.cycleTime,
      status: 'RUNNING',
      remark: dto.remark,
    });

    const saved = await this.prodResultRepository.save(prodResult);

    return this.prodResultRepository.findOne({
      where: { id: saved.id },
      relations: ['jobOrder', 'equip', 'worker'],
      select: {
        id: true,
        jobOrderId: true,
        equipId: true,
        workerId: true,
        lotNo: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 생산실적 수정
   */
  async update(id: string, dto: UpdateProdResultDto) {
    const prodResult = await this.findById(id);

    // DONE 상태에서는 일부 필드만 수정 가능
    if (prodResult.status === 'DONE') {
      if (dto.jobOrderId || dto.equipId || dto.workerId || dto.startAt) {
        throw new BadRequestException(`완료된 실적의 핵심 정보는 수정할 수 없습니다.`);
      }
    }

    const updateData: any = {};
    if (dto.equipId !== undefined) updateData.equipId = dto.equipId;
    if (dto.workerId !== undefined) updateData.workerId = dto.workerId;
    if (dto.lotNo !== undefined) updateData.lotNo = dto.lotNo;
    if (dto.processCode !== undefined) updateData.processCode = dto.processCode;
    if (dto.goodQty !== undefined) updateData.goodQty = dto.goodQty;
    if (dto.defectQty !== undefined) updateData.defectQty = dto.defectQty;
    if (dto.startAt !== undefined) updateData.startAt = new Date(dto.startAt);
    if (dto.endAt !== undefined) updateData.endAt = new Date(dto.endAt);
    if (dto.cycleTime !== undefined) updateData.cycleTime = dto.cycleTime;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    await this.prodResultRepository.update(id, updateData);

    return this.prodResultRepository.findOne({
      where: { id },
      relations: ['jobOrder', 'equip', 'worker'],
      select: {
        id: true,
        jobOrderId: true,
        equipId: true,
        workerId: true,
        lotNo: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 생산실적 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    await this.findById(id); // 존재 확인

    await this.prodResultRepository.update(id, { deletedAt: new Date() });

    return this.prodResultRepository.findOne({
      where: { id },
    });
  }

  /**
   * 생산실적 완료
   */
  async complete(id: string, dto: CompleteProdResultDto) {
    const prodResult = await this.findById(id);

    if (prodResult.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${prodResult.status})에서는 완료할 수 없습니다. RUNNING 상태여야 합니다.`,
      );
    }

    const updateData: any = {
      status: 'DONE',
      endAt: dto.endAt ? new Date(dto.endAt) : new Date(),
    };
    if (dto.goodQty !== undefined) updateData.goodQty = dto.goodQty;
    if (dto.defectQty !== undefined) updateData.defectQty = dto.defectQty;
    if (dto.remark) updateData.remark = dto.remark;

    await this.prodResultRepository.update(id, updateData);

    // 금형 타수 자동 증가: 해당 설비에 장착된 MOLD 카테고리 금형 조회
    if (prodResult.equipId) {
      try {
        const totalQty = (dto.goodQty ?? prodResult.goodQty) + (dto.defectQty ?? prodResult.defectQty);
        if (totalQty > 0) {
          const mountedMolds = await this.consumableMasterRepository.find({
            where: {
              mountedEquipId: prodResult.equipId,
              category: 'MOLD',
              operStatus: 'MOUNTED',
              deletedAt: IsNull(),
            },
          });

          for (const mold of mountedMolds) {
            const newCount = mold.currentCount + totalQty;
            let newStatus = mold.status;

            if (mold.expectedLife && newCount >= mold.expectedLife) {
              newStatus = 'REPLACE';
            } else if (mold.warningCount && newCount >= mold.warningCount) {
              newStatus = 'WARNING';
            }

            await this.consumableMasterRepository.update(mold.id, {
              currentCount: newCount,
              status: newStatus,
            });

            this.logger.log(
              `금형 타수 자동 증가: ${mold.consumableCode} (${mold.currentCount} → ${newCount})`,
            );
          }
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        this.logger.error(`금형 타수 증가 실패: ${e.message}`, e.stack);
      }

      // 설비의 현재 작업지시번호 해제
      await this.equipMasterRepository.update(prodResult.equipId, {
        currentJobOrderId: null,
      });
      this.logger.log(`설비 작업지시 해제: ${prodResult.equipId}`);
    }

    return this.prodResultRepository.findOne({
      where: { id },
      relations: ['jobOrder'],
      select: {
        id: true,
        jobOrderId: true,
        equipId: true,
        workerId: true,
        lotNo: true,
        processCode: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        cycleTime: true,
        status: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 생산실적 취소
   */
  async cancel(id: string, remark?: string) {
    const prodResult = await this.findById(id);

    if (prodResult.status === 'CANCELED') {
      throw new BadRequestException(`이미 취소된 실적입니다.`);
    }

    const updateData: any = { status: 'CANCELED' };
    if (remark) updateData.remark = remark;

    await this.prodResultRepository.update(id, updateData);

    // 설비의 현재 작업지시번호 해제
    if (prodResult.equipId) {
      await this.equipMasterRepository.update(prodResult.equipId, {
        currentJobOrderId: null,
      });
      this.logger.log(`설비 작업지시 해제 (취소): ${prodResult.equipId}`);
    }

    return this.prodResultRepository.findOne({
      where: { id },
    });
  }

  // ===== 실적 집계 =====

  /**
   * 작업지시별 실적 집계
   */
  async getSummaryByJobOrder(jobOrderId: string) {
    const summary = await this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.jobOrderId = :jobOrderId', { jobOrderId })
      .andWhere('pr.deletedAt IS NULL')
      .andWhere('pr.status != :status', { status: 'CANCELED' })
      .getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      jobOrderId,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary?.avgCycleTime ? Number(summary.avgCycleTime) : null,
      resultCount: summary?.resultCount ? parseInt(summary.resultCount) : 0,
    };
  }

  /**
   * 설비별 실적 집계
   */
  async getSummaryByEquip(equipId: string, dateFrom?: string, dateTo?: string) {
    const queryBuilder = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.equipId = :equipId', { equipId })
      .andWhere('pr.deletedAt IS NULL')
      .andWhere('pr.status != :status', { status: 'CANCELED' });

    if (dateFrom || dateTo) {
      queryBuilder.andWhere('pr.startAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom: dateFrom ? new Date(dateFrom) : new Date('1900-01-01'),
        dateTo: dateTo ? new Date(dateTo) : new Date('2099-12-31'),
      });
    }

    const summary = await queryBuilder.getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      equipId,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary?.avgCycleTime ? Number(summary.avgCycleTime) : null,
      resultCount: summary?.resultCount ? parseInt(summary.resultCount) : 0,
    };
  }

  /**
   * 작업자별 실적 집계
   */
  async getSummaryByWorker(workerId: string, dateFrom?: string, dateTo?: string) {
    const queryBuilder = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.workerId = :workerId', { workerId })
      .andWhere('pr.deletedAt IS NULL')
      .andWhere('pr.status != :status', { status: 'CANCELED' });

    if (dateFrom || dateTo) {
      queryBuilder.andWhere('pr.startAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom: dateFrom ? new Date(dateFrom) : new Date('1900-01-01'),
        dateTo: dateTo ? new Date(dateTo) : new Date('2099-12-31'),
      });
    }

    const summary = await queryBuilder.getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      workerId,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary?.avgCycleTime ? Number(summary.avgCycleTime) : null,
      resultCount: summary?.resultCount ? parseInt(summary.resultCount) : 0,
    };
  }

  /**
   * 일자별 실적 집계 (대시보드용)
   */
  async getDailySummary(dateFrom: string, dateTo: string) {
    const results = await this.prodResultRepository.find({
      where: {
        deletedAt: IsNull(),
        status: Not('CANCELED'),
        startAt: Between(new Date(dateFrom), new Date(dateTo)),
      },
      select: {
        startAt: true,
        goodQty: true,
        defectQty: true,
      },
    });

    // 일자별 그룹핑
    const dailyMap = new Map<string, { goodQty: number; defectQty: number; count: number }>();

    results.forEach((r) => {
      if (r.startAt) {
        const dateKey = r.startAt.toISOString().split('T')[0];
        const current = dailyMap.get(dateKey) || { goodQty: 0, defectQty: 0, count: 0 };
        current.goodQty += r.goodQty;
        current.defectQty += r.defectQty;
        current.count += 1;
        dailyMap.set(dateKey, current);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        goodQty: data.goodQty,
        defectQty: data.defectQty,
        totalQty: data.goodQty + data.defectQty,
        defectRate:
          data.goodQty + data.defectQty > 0
            ? (data.defectQty / (data.goodQty + data.defectQty)) * 100
            : 0,
        resultCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 완제품 기준 생산실적 통합 조회
   * - 품목별로 계획수량, 양품, 불량, 양품률을 집계
   */
  async getSummaryByProduct(dateFrom?: string, dateTo?: string, search?: string) {
    const qb = this.prodResultRepository
      .createQueryBuilder('pr')
      .leftJoin('pr.jobOrder', 'jo')
      .leftJoin('jo.part', 'p')
      .select([
        'p.id AS "partId"',
        'p.partCode AS "partCode"',
        'p.partName AS "partName"',
        'p.partType AS "partType"',
        'SUM(jo.planQty) AS "totalPlanQty"',
        'SUM(pr.goodQty) AS "totalGoodQty"',
        'SUM(pr.defectQty) AS "totalDefectQty"',
        'COUNT(DISTINCT jo.id) AS "orderCount"',
        'COUNT(pr.id) AS "resultCount"',
      ])
      .where('pr.deletedAt IS NULL')
      .andWhere('pr.status != :status', { status: 'CANCELED' })
      .andWhere('jo.deletedAt IS NULL')
      .groupBy('p.id')
      .addGroupBy('p.partCode')
      .addGroupBy('p.partName')
      .addGroupBy('p.partType')
      .orderBy('"totalGoodQty"', 'DESC');

    if (dateFrom) {
      qb.andWhere('pr.startAt >= :dateFrom', { dateFrom: new Date(dateFrom) });
    }
    if (dateTo) {
      qb.andWhere('pr.startAt <= :dateTo', { dateTo: new Date(dateTo) });
    }
    if (search) {
      qb.andWhere(
        '(p.partCode LIKE :search OR p.partName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const raw = await qb.getRawMany();

    return raw.map((r) => {
      const totalGoodQty = parseInt(r.totalGoodQty) || 0;
      const totalDefectQty = parseInt(r.totalDefectQty) || 0;
      const totalQty = totalGoodQty + totalDefectQty;
      const totalPlanQty = parseInt(r.totalPlanQty) || 0;
      return {
        partId: r.partId,
        partCode: r.partCode,
        partName: r.partName,
        partType: r.partType,
        totalPlanQty,
        totalGoodQty,
        totalDefectQty,
        totalQty,
        defectRate: totalQty > 0 ? Math.round((totalDefectQty / totalQty) * 1000) / 10 : 0,
        yieldRate: totalQty > 0 ? Math.round((totalGoodQty / totalQty) * 1000) / 10 : 0,
        achieveRate: totalPlanQty > 0 ? Math.round((totalGoodQty / totalPlanQty) * 1000) / 10 : 0,
        orderCount: parseInt(r.orderCount) || 0,
        resultCount: parseInt(r.resultCount) || 0,
      };
    });
  }
}
