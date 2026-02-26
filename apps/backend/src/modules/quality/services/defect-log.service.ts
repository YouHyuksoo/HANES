/**
 * @file src/modules/quality/services/defect-log.service.ts
 * @description 불량로그 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **불량 CRUD**: 불량 등록, 조회, 수정, 삭제
 * 2. **상태 관리**: 대기 -> 수리 -> 완료/폐기 흐름
 * 3. **수리 이력**: 수리 작업 기록 관리
 *
 * 불량 처리 흐름:
 * 1. 불량 발생 등록 (WAIT)
 * 2. 수리 시작 (REPAIR) / 재작업 (REWORK)
 * 3. 수리 완료 등록 -> 상태 변경 (DONE) or 폐기 (SCRAP)
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Between, In, MoreThanOrEqual, LessThanOrEqual, And } from 'typeorm';
import { DefectLog } from '../../../entities/defect-log.entity';
import { RepairLog } from '../../../entities/repair-log.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import {
  CreateDefectLogDto,
  UpdateDefectLogDto,
  DefectLogQueryDto,
  ChangeDefectStatusDto,
  CreateRepairLogDto,
  DefectTypeStatsDto,
  DefectStatusStatsDto,
} from '../dto/defect-log.dto';

@Injectable()
export class DefectLogService {
  private readonly logger = new Logger(DefectLogService.name);

  constructor(
    @InjectRepository(DefectLog)
    private readonly defectLogRepository: Repository<DefectLog>,
    @InjectRepository(RepairLog)
    private readonly repairLogRepository: Repository<RepairLog>,
    @InjectRepository(ProdResult)
    private readonly prodResultRepository: Repository<ProdResult>,
  ) {}

  // =============================================
  // 불량로그 CRUD
  // =============================================

  /**
   * 불량로그 목록 조회 (페이지네이션)
   */
  async findAll(query: DefectLogQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 20,
      prodResultId,
      defectCode,
      status,
      startDate,
      endDate,
      search,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(prodResultId && { prodResultId: +prodResultId }),
      ...(defectCode && { defectCode }),
      ...(status && { status }),
      ...(startDate || endDate
        ? {
            occurAt: And(
              startDate ? MoreThanOrEqual(new Date(startDate)) : undefined,
              endDate ? LessThanOrEqual(new Date(endDate)) : undefined
            ),
          }
        : {}),
      ...(search && {
        defectName: ILike(`%${search}%`),
      }),
    };

    const [data, total] = await Promise.all([
      this.defectLogRepository.find({
        where,
        skip,
        take: limit,
        order: { occurAt: 'DESC' },
      }),
      this.defectLogRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 불량로그 단건 조회
   */
  async findById(id: string) {
    const defect = await this.defectLogRepository.findOne({
      where: { id: +id },
    });

    if (!defect) {
      throw new NotFoundException(`불량로그를 찾을 수 없습니다: ${id}`);
    }

    return defect;
  }

  /**
   * 생산실적별 불량 목록 조회
   */
  async findByProdResultId(prodResultId: string) {
    const defects = await this.defectLogRepository.find({
      where: { prodResultId: +prodResultId },
      order: { occurAt: 'DESC' },
    });

    return defects;
  }

  /**
   * 불량로그 생성
   */
  async create(dto: CreateDefectLogDto) {
    // 생산실적 존재 확인
    const prodResult = await this.prodResultRepository.findOne({
      where: { id: +dto.prodResultId },
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${dto.prodResultId}`);
    }

    // 불량 등록 및 생산실적 불량수량 증가를 트랜잭션으로 처리
    const defectLog = this.defectLogRepository.create({
      prodResultId: +dto.prodResultId,
      defectCode: dto.defectCode,
      defectName: dto.defectName,
      qty: dto.qty ?? 1,
      status: dto.status ?? 'WAIT',
      cause: dto.cause,
      occurAt: dto.occurAt ? new Date(dto.occurAt) : new Date(),
      imageUrl: dto.imageUrl,
    });

    const savedDefectLog = await this.defectLogRepository.save(defectLog);

    // 생산실적의 불량수량 증가
    await this.prodResultRepository.update(
      { id: +dto.prodResultId },
      { defectQty: prodResult.defectQty + (dto.qty ?? 1) }
    );

    return savedDefectLog;
  }

  /**
   * 불량로그 수정
   */
  async update(id: string, dto: UpdateDefectLogDto) {
    const existing = await this.findById(id);

    // 수량 변경 시 생산실적 반영
    const qtyDiff = (dto.qty ?? existing.qty) - existing.qty;

    if (qtyDiff !== 0) {
      await this.defectLogRepository.update(
        { id: +id },
        {
          ...(dto.defectCode !== undefined && { defectCode: dto.defectCode }),
          ...(dto.defectName !== undefined && { defectName: dto.defectName }),
          ...(dto.qty !== undefined && { qty: dto.qty }),
          ...(dto.cause !== undefined && { cause: dto.cause }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        }
      );

      await this.prodResultRepository.update(
        { id: existing.prodResultId },
        { defectQty: () => `DEFECT_QTY + ${qtyDiff}` }
      );
    } else {
      await this.defectLogRepository.update(
        { id: +id },
        {
          ...(dto.defectCode !== undefined && { defectCode: dto.defectCode }),
          ...(dto.defectName !== undefined && { defectName: dto.defectName }),
          ...(dto.cause !== undefined && { cause: dto.cause }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        }
      );
    }

    return this.findById(id);
  }

  /**
   * 불량로그 삭제
   */
  async delete(id: string) {
    const existing = await this.findById(id);

    // 불량 삭제 시 생산실적 불량수량 감소
    await this.defectLogRepository.delete(+id);

    await this.prodResultRepository.update(
      { id: existing.prodResultId },  // already number from entity
      { defectQty: () => `DEFECT_QTY - ${existing.qty}` }
    );

    return { id, deleted: true };
  }

  // =============================================
  // 불량 상태 관리
  // =============================================

  /**
   * 불량 상태 변경
   */
  async changeStatus(id: string, dto: ChangeDefectStatusDto) {
    const existing = await this.findById(id);

    // 상태 변경 유효성 검사
    this.validateStatusChange(existing.status, dto.status);

    await this.defectLogRepository.update(
      { id: +id },
      { status: dto.status }
    );

    return this.findById(id);
  }

  /**
   * 상태 변경 유효성 검사
   */
  private validateStatusChange(currentStatus: string, newStatus: string) {
    const validTransitions: Record<string, string[]> = {
      'WAIT': ['REPAIR', 'REWORK', 'SCRAP'],
      'REPAIR': ['DONE', 'SCRAP', 'WAIT'],
      'REWORK': ['DONE', 'SCRAP', 'WAIT'],
      'SCRAP': [], // 폐기 후 변경 불가
      'DONE': [], // 완료 후 변경 불가
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `${currentStatus}에서 ${newStatus}로 상태 변경이 불가능합니다.`
      );
    }
  }

  // =============================================
  // 수리 이력 관리
  // =============================================

  /**
   * 수리 이력 생성
   */
  async createRepairLog(dto: CreateRepairLogDto) {
    const defectLog = await this.findById(dto.defectLogId);

    // WAIT 상태가 아니면 자동으로 REPAIR 상태로 변경하지 않음
    // 이미 REPAIR/REWORK 상태일 수 있음

    const repairLog = this.repairLogRepository.create({
      defectLogId: +dto.defectLogId,
      workerCode: dto.workerId,
      repairAction: dto.repairAction,
      materialUsed: dto.materialUsed,
      repairTime: dto.repairTime,
      result: dto.result,
      remark: dto.remark,
    });

    const savedRepairLog = await this.repairLogRepository.save(repairLog);

    // 수리 결과에 따라 불량 상태 자동 변경
    if (dto.result) {
      let newStatus: string;
      switch (dto.result) {
        case 'PASS':
          newStatus = 'DONE';
          break;
        case 'SCRAP':
          newStatus = 'SCRAP';
          break;
        default:
          // FAIL인 경우 상태 유지
          return savedRepairLog;
      }

      await this.defectLogRepository.update(
        { id: +dto.defectLogId },
        { status: newStatus }
      );
    }

    return savedRepairLog;
  }

  /**
   * 불량로그별 수리 이력 조회
   */
  async getRepairLogs(defectLogId: string) {
    await this.findById(defectLogId); // 존재 확인

    return this.repairLogRepository.find({
      where: { defectLogId: +defectLogId },
      order: { createdAt: 'DESC' },
    });
  }

  // =============================================
  // 통계
  // =============================================

  /**
   * 불량 유형별 통계
   */
  async getStatsByDefectType(
    startDate?: string,
    endDate?: string
  ): Promise<DefectTypeStatsDto[]> {
    const where: any = {
      ...(startDate || endDate
        ? {
            occurAt: And(
              startDate ? MoreThanOrEqual(new Date(startDate)) : undefined,
              endDate ? LessThanOrEqual(new Date(endDate)) : undefined
            ),
          }
        : {}),
    };

    // TypeORM의 groupBy 사용
    const grouped = await this.defectLogRepository
      .createQueryBuilder('defect')
      .select('defect.defectCode', 'defectCode')
      .addSelect('defect.defectName', 'defectName')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(defect.qty)', 'totalQty')
      .where(where)
      .groupBy('defect.defectCode')
      .addGroupBy('defect.defectName')
      .getRawMany();

    const total = grouped.reduce((sum, g) => sum + parseInt(g.count), 0);

    return grouped
      .map((g) => ({
        defectCode: g.defectCode,
        defectName: g.defectName ?? g.defectCode,
        count: parseInt(g.count),
        totalQty: parseInt(g.totalQty) ?? 0,
        percentage: total > 0 ? Math.round((parseInt(g.count) / total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 불량 상태별 통계
   */
  async getStatsByStatus(
    startDate?: string,
    endDate?: string
  ): Promise<DefectStatusStatsDto[]> {
    const where: any = {
      ...(startDate || endDate
        ? {
            occurAt: And(
              startDate ? MoreThanOrEqual(new Date(startDate)) : undefined,
              endDate ? LessThanOrEqual(new Date(endDate)) : undefined
            ),
          }
        : {}),
    };

    const grouped = await this.defectLogRepository
      .createQueryBuilder('defect')
      .select('defect.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(defect.qty)', 'totalQty')
      .where(where)
      .groupBy('defect.status')
      .getRawMany();

    return grouped.map((g) => ({
      status: g.status,
      count: parseInt(g.count),
      totalQty: parseInt(g.totalQty) ?? 0,
    }));
  }

  /**
   * 일별 불량 발생 추이
   */
  async getDailyDefectTrend(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const defects = await this.defectLogRepository.find({
      where: {
        occurAt: MoreThanOrEqual(startDate),
      },
      select: ['occurAt', 'qty', 'defectCode'],
      order: { occurAt: 'ASC' },
    });

    // 일별 집계
    const dailyStats = new Map<string, { count: number; totalQty: number }>();

    defects.forEach((d) => {
      const dateKey = d.occurAt.toISOString().split('T')[0];
      const current = dailyStats.get(dateKey) ?? { count: 0, totalQty: 0 };
      current.count++;
      current.totalQty += d.qty;
      dailyStats.set(dateKey, current);
    });

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      count: stats.count,
      totalQty: stats.totalQty,
    }));
  }

  /**
   * 미처리 불량 목록 조회
   */
  async getPendingDefects() {
    return this.defectLogRepository.find({
      where: {
        status: In(['WAIT', 'REPAIR', 'REWORK']),
      },
      order: { occurAt: 'ASC' },
    });
  }
}
