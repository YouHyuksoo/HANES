/**
 * @file src/modules/quality/inspection/services/inspect-result.service.ts
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
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { TraceLog } from '../../../../entities/trace-log.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
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
    private readonly seqGenerator: SeqGeneratorService,
  ) {}

  private buildInspectResultUpdate(
    dto: Omit<UpdateInspectResultDto, 'prodResultNo'>,
  ): Partial<Pick<InspectResult,
    | 'serialNo'
    | 'inspectType'
    | 'inspectScope'
    | 'passYn'
    | 'errorCode'
    | 'errorDetail'
    | 'inspectData'
    | 'inspectAt'
    | 'inspectorId'
  >> {
    return {
      ...(dto.serialNo !== undefined ? { serialNo: dto.serialNo } : {}),
      ...(dto.inspectType !== undefined ? { inspectType: dto.inspectType } : {}),
      ...(dto.inspectScope !== undefined ? { inspectScope: dto.inspectScope } : {}),
      ...(dto.passYn !== undefined ? { passYn: dto.passYn } : {}),
      ...(dto.errorCode !== undefined ? { errorCode: dto.errorCode } : {}),
      ...(dto.errorDetail !== undefined ? { errorDetail: dto.errorDetail } : {}),
      ...(dto.inspectData !== undefined ? { inspectData: JSON.stringify(dto.inspectData) } : {}),
      ...(dto.inspectAt !== undefined ? { inspectAt: new Date(dto.inspectAt) } : {}),
      ...(dto.inspectorId !== undefined ? { inspectorId: dto.inspectorId } : {}),
    };
  }

  private applyInspectAtRange(
    qb: ReturnType<Repository<InspectResult>['createQueryBuilder']>,
    fromDate?: string,
    toDate?: string,
  ) {
    if (fromDate) {
      qb.andWhere("inspect.inspectAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    }
    if (toDate) {
      qb.andWhere("inspect.inspectAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toDate });
    }
  }

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  private assertSameTenant(
    context: string,
    requested: { company?: string | null; plant?: string | null },
    actual: { company?: string | null; plant?: string | null },
  ) {
    if (requested.company && actual.company !== requested.company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${requested.company}, row=${actual.company ?? 'NULL'}`,
      );
    }
    if (requested.plant && actual.plant !== requested.plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${requested.plant}, row=${actual.plant ?? 'NULL'}`,
      );
    }
  }

  /**
   * 검사실적 목록 조회 (페이지네이션)
   */
  async findAll(query: InspectResultQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 20,
      prodResultNo,
      serialNo,
      inspectType,
      inspectScope,
      passYn,
      fromDate,
      toDate,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.inspectResultRepository.createQueryBuilder('inspect');

    if (company) qb.andWhere('inspect.company = :company', { company });
    if (plant) qb.andWhere('inspect.plant = :plant', { plant });
    if (prodResultNo) qb.andWhere('inspect.prodResultNo = :prodResultNo', { prodResultNo });
    if (serialNo) qb.andWhere('inspect.serialNo LIKE :serialNo', { serialNo: `%${serialNo}%` });
    if (inspectType) qb.andWhere('inspect.inspectType = :inspectType', { inspectType });
    if (inspectScope) qb.andWhere('inspect.inspectScope = :inspectScope', { inspectScope });
    if (passYn) qb.andWhere('inspect.passYn = :passYn', { passYn });
    this.applyInspectAtRange(qb, fromDate, toDate);

    const [data, total] = await qb
      .orderBy('inspect.inspectAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * 검사실적 단건 조회 (resultNo 기준)
   */
  async findById(resultNo: string, company?: string, plant?: string) {
    const result = await this.inspectResultRepository.findOne({
      where: { resultNo, ...this.tenantWhere(company, plant) },
    });

    if (!result) {
      throw new NotFoundException(`검사실적을 찾을 수 없습니다: ${resultNo}`);
    }

    return result;
  }

  /**
   * 시리얼 번호로 검사 이력 조회
   */
  async findBySerialNo(serialNo: string, company?: string, plant?: string) {
    const results = await this.inspectResultRepository.find({
      where: { serialNo, ...this.tenantWhere(company, plant) },
      order: { inspectAt: 'DESC' },
    });

    return results;
  }

  /**
   * 생산실적별 검사 이력 조회
   */
  async findByProdResultNo(prodResultNo: string, company?: string, plant?: string) {
    const results = await this.inspectResultRepository.find({
      where: { prodResultNo, ...this.tenantWhere(company, plant) },
      order: { inspectAt: 'ASC' },
    });

    return results;
  }

  /**
   * 검사실적 생성
   */
  async create(dto: CreateInspectResultDto, company?: string, plant?: string) {
    // 생산실적 존재 확인
    const prodResult = await this.prodResultRepository.findOne({
      where: { resultNo: dto.prodResultNo, ...this.tenantWhere(company, plant) },
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${dto.prodResultNo}`);
    }

    const resultNo = await this.seqGenerator.getNo('INSPECT_RESULT');

    const inspectResult = this.inspectResultRepository.create({
      resultNo,
      prodResultNo: dto.prodResultNo,
      serialNo: dto.serialNo,
      inspectType: dto.inspectType,
      inspectScope: dto.inspectScope,
      passYn: dto.passYn ?? 'Y',
      errorCode: dto.errorCode,
      errorDetail: dto.errorDetail,
      inspectData: dto.inspectData ? JSON.stringify(dto.inspectData) : null,
      inspectAt: dto.inspectAt ? new Date(dto.inspectAt) : new Date(),
      inspectorId: dto.inspectorId,
      company,
      plant,
    });

    return this.inspectResultRepository.save(inspectResult);
  }

  /**
   * 바코드 스캔으로 검사 결과 등록
   * - 바코드(시리얼번호)로 제품 정보 조회
   * - TraceLog에서 생산실적 정보 찾기
   * - 검사 결과 등록
   */
  async createByBarcode(dto: BarcodeInspectDto, company?: string, plant?: string): Promise<BarcodeInspectResponseDto> {
    // 1. 바코드로 TraceLog에서 생산실적 정보 조회
    const traceLog = await this.traceLogRepository.findOne({
      where: { serialNo: dto.barcode, ...this.tenantWhere(company, plant) },
      order: { traceTime: 'DESC' },
    });

    if (!traceLog) {
      throw new NotFoundException(`바코드에 해당하는 제품 정보를 찾을 수 없습니다: ${dto.barcode}`);
    }

    // 2. TraceLog의 eventData에서 prodResultNo 추출 (JSON 파싱)
    let prodResultNo: string | null = null;
    if (traceLog.eventData) {
      try {
        const eventData = JSON.parse(traceLog.eventData);
        const rawNo = eventData.prodResultNo || eventData.prodResultNo || eventData.productionResultId || null;
        prodResultNo = rawNo ? String(rawNo) : null;
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }

    // 3. prodResultNo가 없으면 TraceLog의 prdUid나 다른 정보로 추적
    if (!prodResultNo && traceLog.prdUid) {
      // prdUid로 생산실적 검색
      const prodResult = await this.prodResultRepository.findOne({
        where: { prdUid: traceLog.prdUid, ...this.tenantWhere(company, plant) },
        order: { createdAt: 'DESC' },
      });
      if (prodResult) {
        prodResultNo = prodResult.resultNo;
      }
    }

    if (!prodResultNo) {
      throw new NotFoundException(`바코드에 해당하는 생산실적을 찾을 수 없습니다: ${dto.barcode}`);
    }

    // 4. 생산실적 존재 확인
    const prodResult = await this.prodResultRepository.findOne({
      where: { resultNo: prodResultNo, ...this.tenantWhere(company, plant) },
      relations: ['jobOrder', 'jobOrder.part'],
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${prodResultNo}`);
    }

    // 5. 검사 결과 등록
    const resultNo = await this.seqGenerator.getNo('INSPECT_RESULT');

    const inspectResult = this.inspectResultRepository.create({
      resultNo,
      prodResultNo,
      serialNo: dto.barcode,
      inspectType: dto.inspectType ?? 'VISUAL',
      inspectScope: dto.inspectScope ?? 'FULL',
      passYn: dto.passYn,
      errorCode: dto.errorCode,
      errorDetail: dto.errorDetail,
      inspectAt: new Date(),
      inspectorId: dto.inspectorId,
      company,
      plant,
    });

    const saved = await this.inspectResultRepository.save(inspectResult);

    return {
      inspectResultId: saved.resultNo,
      prodResultNo,
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
  async getProductByBarcode(barcode: string, company?: string, plant?: string) {
    const traceLog = await this.traceLogRepository.findOne({
      where: { serialNo: barcode, ...this.tenantWhere(company, plant) },
      order: { traceTime: 'DESC' },
    });

    if (!traceLog) {
      throw new NotFoundException(`바코드에 해당하는 제품 정보를 찾을 수 없습니다: ${barcode}`);
    }

    // TraceLog에서 생산실적 추적
    let prodResult: ProdResult | null = null;

    // eventData에서 prodResultNo 추출 시도
    if (traceLog.eventData) {
      try {
        const eventData = JSON.parse(traceLog.eventData);
        const rawProdResultNo = eventData.prodResultNo || eventData.prodResultNo || eventData.productionResultId;
        if (rawProdResultNo) {
          prodResult = await this.prodResultRepository.findOne({
            where: { resultNo: String(rawProdResultNo), ...this.tenantWhere(company, plant) },
            relations: ['jobOrder', 'jobOrder.part'],
          });
        }
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }

    // prdUid로 생산실적 검색
    if (!prodResult && traceLog.prdUid) {
      prodResult = await this.prodResultRepository.findOne({
        where: { prdUid: traceLog.prdUid, ...this.tenantWhere(company, plant) },
        order: { createdAt: 'DESC' },
        relations: ['jobOrder', 'jobOrder.part'],
      });
    }

    // 이전 검사 이력 조회
    const previousInspects = await this.inspectResultRepository.find({
      where: { serialNo: barcode, ...this.tenantWhere(company, plant) },
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
        prodResultNo: prodResult.resultNo,
        productionDate: prodResult.createdAt,
      } : null,
      previousInspects: previousInspects.map(i => ({
        resultNo: i.resultNo,
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
  async createMany(dtos: CreateInspectResultDto[], company?: string, plant?: string) {
    const results = await Promise.all(
      dtos.map((dto) => this.create(dto, company, plant))
    );

    return { count: results.length, results };
  }

  /**
   * 검사실적 수정 (resultNo 기준)
   */
  async update(resultNo: string, dto: UpdateInspectResultDto, company?: string, plant?: string) {
    await this.findById(resultNo, company, plant); // 존재 확인
    const { prodResultNo: _ignoredProdResultNo, ...inspectData } = dto;
    const updateData = this.buildInspectResultUpdate(inspectData);

    if (Object.keys(updateData).length > 0) {
      await this.inspectResultRepository.update({ resultNo, ...this.tenantWhere(company, plant) }, updateData);
    }

    return this.findById(resultNo, company, plant);
  }

  /**
   * 검사실적 삭제 (resultNo 기준)
   */
  async delete(resultNo: string, company?: string, plant?: string) {
    const result = await this.findById(resultNo, company, plant); // 존재 확인
    this.assertSameTenant('검사실적', { company, plant }, result);
    const resultTenantWhere = this.tenantWhere(result.company ?? company, result.plant ?? plant);

    if (result.prodResultNo) {
      const prodResult = await this.prodResultRepository.findOne({
        where: { resultNo: result.prodResultNo, ...resultTenantWhere },
      });
      if (prodResult && prodResult.status !== 'CANCELED') {
        throw new BadRequestException(
          '검사결과는 연결된 생산실적이 취소된 뒤에만 삭제할 수 있습니다. 생산실적부터 먼저 정리해 주세요.',
        );
      }
    }

    await this.inspectResultRepository.delete({ resultNo, ...resultTenantWhere });

    return { resultNo, deleted: true };
  }

  /**
   * 합격률 통계 조회
   * @param fromDate 시작 날짜
   * @param toDate 종료 날짜
   * @param inspectType 검사 유형 (선택)
   */
  async getPassRate(
    fromDate?: string,
    toDate?: string,
    inspectType?: string,
    company?: string,
    plant?: string,
  ): Promise<InspectPassRateDto> {
    const buildBase = () => {
      const qb = this.inspectResultRepository.createQueryBuilder('inspect');
      if (company) qb.andWhere('inspect.company = :company', { company });
      if (plant) qb.andWhere('inspect.plant = :plant', { plant });
      if (inspectType) qb.andWhere('inspect.inspectType = :inspectType', { inspectType });
      this.applyInspectAtRange(qb, fromDate, toDate);
      return qb;
    };

    const [totalCount, passCount] = await Promise.all([
      buildBase().getCount(),
      buildBase().andWhere("inspect.passYn = 'Y'").getCount(),
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
   * @param fromDate 시작 날짜
   * @param toDate 종료 날짜
   */
  async getStatsByType(
    fromDate?: string,
    toDate?: string,
    company?: string,
    plant?: string,
  ): Promise<InspectTypeStatsDto[]> {
    const buildBase = () => {
      const qb = this.inspectResultRepository.createQueryBuilder('inspect');
      qb.andWhere('inspect.inspectType IS NOT NULL');
      if (company) qb.andWhere('inspect.company = :company', { company });
      if (plant) qb.andWhere('inspect.plant = :plant', { plant });
      this.applyInspectAtRange(qb, fromDate, toDate);
      return qb;
    };

    // 유형별 그룹 조회
    const groupedData = await buildBase()
      .select('inspect.inspectType', 'inspectType')
      .addSelect('COUNT(*)', 'totalCount')
      .groupBy('inspect.inspectType')
      .getRawMany();

    // 유형별 합격 수 조회
    const passData = await buildBase()
      .select('inspect.inspectType', 'inspectType')
      .addSelect('COUNT(*)', 'passCount')
      .andWhere("inspect.passYn = 'Y'")
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
  async getDailyPassRateTrend(days: number = 7, company?: string, plant?: string) {
    const startDateStr = new Date(
      Date.now() - (days - 1) * 24 * 60 * 60 * 1000,
    ).toISOString().split('T')[0];

    const qb = this.inspectResultRepository
      .createQueryBuilder('inspect')
      .select(['inspect.inspectAt', 'inspect.passYn'])
      .andWhere("inspect.inspectAt >= TO_DATE(:startDateStr, 'YYYY-MM-DD')", { startDateStr })
      .orderBy('inspect.inspectAt', 'ASC');

    if (company) qb.andWhere('inspect.company = :company', { company });
    if (plant) qb.andWhere('inspect.plant = :plant', { plant });

    const results = await qb.getMany();

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
