/**
 * @file src/modules/quality/services/inspect-result.service.ts
 * @description 검사실적 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 검사 결과 생성, 조회, 수정, 삭제
 * 2. **통계 메서드**: 합격률 계산, 유형별 통계
 * 3. **TypeORM 사용**: Repository 패턴을 통해 DB 접근
 *
 * 주요 기능:
 * - 검사 결과 등록 (생산실적과 연결)
 * - 시리얼 번호별 검사 이력 조회
 * - 합격률 통계 (전체, 기간별, 유형별)
 */

import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, ILike, Between, MoreThanOrEqual, LessThanOrEqual, And, Not } from 'typeorm';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { TraceLog } from '../../../entities/trace-log.entity';
import {
  CreateInspectResultDto,
  UpdateInspectResultDto,
  InspectResultQueryDto,
  InspectPassRateDto,
  InspectTypeStatsDto,
  BarcodeInspectDto,
  BarcodeInspectResponseDto,
} from '../dto/inspect-result.dto';

@Injectable()
export class InspectResultService {
  private readonly logger = new Logger(InspectResultService.name);

  constructor(
    @InjectRepository(InspectResult)
    private readonly inspectResultRepository: Repository<InspectResult>,
    @InjectRepository(ProdResult)
    private readonly prodResultRepository: Repository<ProdResult>,
    @InjectRepository(TraceLog)
    private readonly traceLogRepository: Repository<TraceLog>,
  ) {}

  /**
   * 검사실적 목록 조회 (페이지네이션)
   */
  async findAll(query: InspectResultQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 20,
      prodResultId,
      serialNo,
      inspectType,
      inspectScope,
      passYn,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(prodResultId && { prodResultId }),
      ...(serialNo && { serialNo: ILike(`%${serialNo}%`) }),
      ...(inspectType && { inspectType }),
      ...(inspectScope && { inspectScope }),
      ...(passYn && { passYn }),
      ...(startDate || endDate
        ? {
            inspectAt: And(
              startDate ? MoreThanOrEqual(new Date(startDate)) : undefined,
              endDate ? LessThanOrEqual(new Date(endDate)) : undefined
            ),
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.inspectResultRepository.find({
        where,
        skip,
        take: limit,
        order: { inspectAt: 'DESC' },
      }),
      this.inspectResultRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 검사실적 단건 조회
   */
  async findById(id: string) {
    const result = await this.inspectResultRepository.findOne({
      where: { id },
    });

    if (!result) {
      throw new NotFoundException(`검사실적을 찾을 수 없습니다: ${id}`);
    }

    return result;
  }

  /**
   * 시리얼 번호로 검사 이력 조회
   */
  async findBySerialNo(serialNo: string) {
    const results = await this.inspectResultRepository.find({
      where: { serialNo },
      order: { inspectAt: 'DESC' },
    });

    return results;
  }

  /**
   * 생산실적별 검사 이력 조회
   */
  async findByProdResultId(prodResultId: string) {
    const results = await this.inspectResultRepository.find({
      where: { prodResultId },
      order: { inspectAt: 'ASC' },
    });

    return results;
  }

  /**
   * 검사실적 생성
   */
  async create(dto: CreateInspectResultDto) {
    // 생산실적 존재 확인
    const prodResult = await this.prodResultRepository.findOne({
      where: { id: dto.prodResultId },
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${dto.prodResultId}`);
    }

    const inspectResult = this.inspectResultRepository.create({
      prodResultId: dto.prodResultId,
      serialNo: dto.serialNo,
      inspectType: dto.inspectType,
      passYn: dto.passYn ?? 'Y',
      errorCode: dto.errorCode,
      errorDetail: dto.errorDetail,
      inspectData: dto.inspectData ? JSON.stringify(dto.inspectData) : null,
      inspectAt: dto.inspectAt ? new Date(dto.inspectAt) : new Date(),
      inspectorId: dto.inspectorId,
    });

    return this.inspectResultRepository.save(inspectResult);
  }

  /**
   * 바코드 스캔으로 검사 결과 등록
   * - 바코드(시리얼번호)로 제품 정보 조회
   * - TraceLog에서 생산실적 정보 찾기
   * - 검사 결과 등록
   */
  async createByBarcode(dto: BarcodeInspectDto): Promise<BarcodeInspectResponseDto> {
    // 1. 바코드로 TraceLog에서 생산실적 정보 조회
    const traceLog = await this.traceLogRepository.findOne({
      where: { serialNo: dto.barcode },
      order: { traceTime: 'DESC' },
    });

    if (!traceLog) {
      throw new NotFoundException(`바코드에 해당하는 제품 정보를 찾을 수 없습니다: ${dto.barcode}`);
    }

    // 2. TraceLog의 eventData에서 prodResultId 추출 (JSON 파싱)
    let prodResultId: string | null = null;
    if (traceLog.eventData) {
      try {
        const eventData = JSON.parse(traceLog.eventData);
        prodResultId = eventData.prodResultId || eventData.productionResultId || null;
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }

    // 3. prodResultId가 없으면 TraceLog의 lotId나 다른 정보로 추적
    if (!prodResultId && traceLog.lotNo) {
      // lotId로 생산실적 검색
      const prodResult = await this.prodResultRepository.findOne({
        where: { lotNo: traceLog.lotNo },
        order: { createdAt: 'DESC' },
      });
      if (prodResult) {
        prodResultId = prodResult.id;
      }
    }

    if (!prodResultId) {
      throw new NotFoundException(`바코드에 해당하는 생산실적을 찾을 수 없습니다: ${dto.barcode}`);
    }

    // 4. 생산실적 존재 확인
    const prodResult = await this.prodResultRepository.findOne({
      where: { id: prodResultId },
      relations: ['jobOrder', 'jobOrder.part'],
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${prodResultId}`);
    }

    // 5. 검사 결과 등록
    const inspectResult = this.inspectResultRepository.create({
      prodResultId,
      serialNo: dto.barcode,
      inspectType: dto.inspectType ?? 'VISUAL',
      inspectScope: dto.inspectScope ?? 'FULL',
      passYn: dto.passYn,
      errorCode: dto.errorCode,
      errorDetail: dto.errorDetail,
      inspectAt: new Date(),
      inspectorId: dto.inspectorId,
    });

    const saved = await this.inspectResultRepository.save(inspectResult);

    return {
      inspectResultId: saved.id,
      prodResultId,
      barcode: dto.barcode,
      passYn: saved.passYn,
      inspectAt: saved.inspectAt,
      productInfo: {
        itemCode: prodResult.jobOrder?.part?.itemCode,
        itemName: prodResult.jobOrder?.part?.itemName,
        orderNo: prodResult.jobOrder?.orderNo,
      },
    };
  }

  /**
   * 바코드로 제품 정보 조회 (검사 전 확인용)
   */
  async getProductByBarcode(barcode: string) {
    const traceLog = await this.traceLogRepository.findOne({
      where: { serialNo: barcode },
      order: { traceTime: 'DESC' },
    });

    if (!traceLog) {
      throw new NotFoundException(`바코드에 해당하는 제품 정보를 찾을 수 없습니다: ${barcode}`);
    }

    // TraceLog에서 생산실적 추적
    let prodResult: ProdResult | null = null;
    
    // eventData에서 prodResultId 추출 시도
    if (traceLog.eventData) {
      try {
        const eventData = JSON.parse(traceLog.eventData);
        const prodResultId = eventData.prodResultId || eventData.productionResultId;
        if (prodResultId) {
          prodResult = await this.prodResultRepository.findOne({
            where: { id: prodResultId },
            relations: ['jobOrder', 'jobOrder.part'],
          });
        }
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }

    // lotId로 생산실적 검색
    if (!prodResult && traceLog.lotNo) {
      prodResult = await this.prodResultRepository.findOne({
        where: { lotNo: traceLog.lotNo },
        order: { createdAt: 'DESC' },
        relations: ['jobOrder', 'jobOrder.part'],
      });
    }

    // 이전 검사 이력 조회
    const previousInspects = await this.inspectResultRepository.find({
      where: { serialNo: barcode },
      order: { inspectAt: 'DESC' },
      take: 5,
    });

    return {
      barcode,
      serialNo: traceLog.serialNo,
      productInfo: prodResult ? {
        itemCode: prodResult.jobOrder?.part?.itemCode,
        itemName: prodResult.jobOrder?.part?.itemName,
        orderNo: prodResult.jobOrder?.orderNo,
        prodResultId: prodResult.id,
        productionDate: prodResult.createdAt,
      } : null,
      previousInspects: previousInspects.map(i => ({
        id: i.id,
        inspectType: i.inspectType,
        inspectScope: i.inspectScope,
        passYn: i.passYn,
        inspectAt: i.inspectAt,
      })),
    };
  }

  /**
   * 검사실적 일괄 생성
   */
  async createMany(dtos: CreateInspectResultDto[]) {
    const results = await Promise.all(
      dtos.map((dto) => this.create(dto))
    );

    return { count: results.length, results };
  }

  /**
   * 검사실적 수정
   */
  async update(id: string, dto: UpdateInspectResultDto) {
    await this.findById(id); // 존재 확인

    const updateData: any = {};

    if (dto.serialNo !== undefined) updateData.serialNo = dto.serialNo;
    if (dto.inspectType !== undefined) updateData.inspectType = dto.inspectType;
    if (dto.inspectScope !== undefined) updateData.inspectScope = dto.inspectScope;
    if (dto.passYn !== undefined) updateData.passYn = dto.passYn;
    if (dto.errorCode !== undefined) updateData.errorCode = dto.errorCode;
    if (dto.errorDetail !== undefined) updateData.errorDetail = dto.errorDetail;
    if (dto.inspectData !== undefined) updateData.inspectData = JSON.stringify(dto.inspectData);
    if (dto.inspectAt !== undefined) updateData.inspectAt = new Date(dto.inspectAt);
    if (dto.inspectorId !== undefined) updateData.inspectorId = dto.inspectorId;

    await this.inspectResultRepository.update({ id }, updateData);

    return this.findById(id);
  }

  /**
   * 검사실적 삭제
   */
  async delete(id: string) {
    await this.findById(id); // 존재 확인

    await this.inspectResultRepository.delete({ id });

    return { id, deleted: true };
  }

  /**
   * 합격률 통계 조회
   * @param startDate 시작 날짜
   * @param endDate 종료 날짜
   * @param inspectType 검사 유형 (선택)
   */
  async getPassRate(
    startDate?: string,
    endDate?: string,
    inspectType?: string
  ): Promise<InspectPassRateDto> {
    const where: any = {
      ...(inspectType && { inspectType }),
      ...(startDate || endDate
        ? {
            inspectAt: And(
              startDate ? MoreThanOrEqual(new Date(startDate)) : undefined,
              endDate ? LessThanOrEqual(new Date(endDate)) : undefined
            ),
          }
        : {}),
    };

    const [totalCount, passCount] = await Promise.all([
      this.inspectResultRepository.count({ where }),
      this.inspectResultRepository.count({
        where: { ...where, passYn: 'Y' },
      }),
    ]);

    const failCount = totalCount - passCount;
    const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 10000) / 100 : 0;

    return {
      totalCount,
      passCount,
      failCount,
      passRate,
    };
  }

  /**
   * 검사 유형별 통계 조회
   * @param startDate 시작 날짜
   * @param endDate 종료 날짜
   */
  async getStatsByType(
    startDate?: string,
    endDate?: string
  ): Promise<InspectTypeStatsDto[]> {
    const where: any = {
      inspectType: Not(IsNull()),
      ...(startDate || endDate
        ? {
            inspectAt: And(
              startDate ? MoreThanOrEqual(new Date(startDate)) : undefined,
              endDate ? LessThanOrEqual(new Date(endDate)) : undefined
            ),
          }
        : {}),
    };

    // 유형별 그룹 조회
    const groupedData = await this.inspectResultRepository
      .createQueryBuilder('inspect')
      .select('inspect.inspectType', 'inspectType')
      .addSelect('COUNT(*)', 'totalCount')
      .where(where)
      .groupBy('inspect.inspectType')
      .getRawMany();

    // 유형별 합격 수 조회
    const passData = await this.inspectResultRepository
      .createQueryBuilder('inspect')
      .select('inspect.inspectType', 'inspectType')
      .addSelect('COUNT(*)', 'passCount')
      .where({ ...where, passYn: 'Y' })
      .groupBy('inspect.inspectType')
      .getRawMany();

    const passMap = new Map(
      passData.map((p) => [p.inspectType, parseInt(p.passCount)])
    );

    return groupedData.map((g) => {
      const totalCount = parseInt(g.totalCount);
      const passCount = passMap.get(g.inspectType) ?? 0;
      const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 10000) / 100 : 0;

      return {
        inspectType: g.inspectType!,
        totalCount,
        passCount,
        passRate,
      };
    });
  }

  /**
   * 일별 합격률 추이 조회
   * @param days 조회 일수 (기본 7일)
   */
  async getDailyPassRateTrend(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const results = await this.inspectResultRepository.find({
      where: {
        inspectAt: MoreThanOrEqual(startDate),
      },
      select: ['inspectAt', 'passYn'],
      order: { inspectAt: 'ASC' },
    });

    // 일별 집계
    const dailyStats = new Map<string, { total: number; pass: number }>();

    results.forEach((r) => {
      const dateKey = r.inspectAt.toISOString().split('T')[0];
      const current = dailyStats.get(dateKey) ?? { total: 0, pass: 0 };
      current.total++;
      if (r.passYn === 'Y') current.pass++;
      dailyStats.set(dateKey, current);
    });

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      totalCount: stats.total,
      passCount: stats.pass,
      failCount: stats.total - stats.pass,
      passRate: stats.total > 0 ? Math.round((stats.pass / stats.total) * 10000) / 100 : 0,
    }));
  }
}
