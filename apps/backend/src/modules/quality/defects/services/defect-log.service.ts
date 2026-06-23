/**
 * @file src/modules/quality/defects/services/defect-log.service.ts
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
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import { DefectLog } from '../../../../entities/defect-log.entity';
import { RepairLog } from '../../../../entities/repair-log.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { FgLabel } from '../../../../entities/fg-label.entity';
import { DefectCodeMaster } from '../../../../entities/defect-code-master.entity';
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
    @InjectRepository(ReworkOrder)
    private readonly reworkOrderRepository: Repository<ReworkOrder>,
    @InjectRepository(FgLabel)
    private readonly fgLabelRepository: Repository<FgLabel>,
    @InjectRepository(DefectCodeMaster)
    private readonly defectCodeRepository: Repository<DefectCodeMaster>,
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

  private buildDefectLogId(defect: DefectLog) {
    return `${defect.occurAt.toISOString()}|${defect.seq}`;
  }

  private defectPkWhere(defect: DefectLog, company?: string | null, plant?: string | null) {
    return {
      occurAt: defect.occurAt,
      seq: defect.seq,
      ...this.tenantWhere(company, plant),
    };
  }

  private applyOccurAtRangeToQb(
    qb: SelectQueryBuilder<DefectLog>,
    alias: string,
    fromDate?: string,
    toDate?: string,
  ) {
    if (fromDate) {
      qb.andWhere(`${alias}.occurAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')`, { fromDate });
    }
    if (toDate) {
      qb.andWhere(`${alias}.occurAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY`, { toDate });
    }
  }

  private async ensureNoLinkedRework(defect: DefectLog) {
    const linkedRework = await this.reworkOrderRepository.findOne({
      where: {
        defectLogId: this.buildDefectLogId(defect),
        ...this.tenantWhere(defect.company, defect.plant),
      },
    });
    if (linkedRework) {
      throw new BadRequestException(
        `재작업(${linkedRework.reworkNo})이 연결된 불량은 직접 처리할 수 없습니다. 재작업부터 먼저 정리해 주세요.`,
      );
    }
  }

  private normalizeDefectCode(value: string) {
    const defectCode = String(value ?? '').trim().toUpperCase();
    if (!defectCode) {
      throw new BadRequestException('불량코드는 필수입니다.');
    }
    return defectCode;
  }

  private async resolveActiveDefectCode(defectCodeValue: string, company?: string, plant?: string) {
    const defectCode = this.normalizeDefectCode(defectCodeValue);
    const master = await this.defectCodeRepository.findOne({
      where: { defectCode, ...this.tenantWhere(company, plant), useYn: 'Y' },
    });
    if (!master) {
      throw new BadRequestException(`등록되지 않았거나 사용 중지된 불량코드입니다: ${defectCode}`);
    }
    return master;
  }

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
      prodResultNo,
      defectCode,
      status,
      fromDate,
      toDate,
      search,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.defectLogRepository.createQueryBuilder('defect');
    if (company) qb.andWhere('defect.company = :company', { company });
    if (plant) qb.andWhere('defect.plant = :plant', { plant });
    if (prodResultNo) qb.andWhere('defect.prodResultNo = :prodResultNo', { prodResultNo });
    if (defectCode) qb.andWhere('defect.defectCode = :defectCode', { defectCode });
    if (status) qb.andWhere('defect.status = :status', { status });
    if (search) qb.andWhere('defect.defectName LIKE :search', { search: `%${search}%` });
    this.applyOccurAtRangeToQb(qb, 'defect', fromDate, toDate);

    const [data, total] = await Promise.all([
      qb.clone().orderBy('defect.occurAt', 'DESC').skip(skip).take(limit).getMany(),
      qb.getCount(),
    ]);

    // 생산실적을 배치 로드(N+1 방지)해 작업지시/작업자/설비를 보강하고, 화면용 복합 식별자(id)를 부여한다.
    const resultNos = [...new Set(data.map((d) => d.prodResultNo).filter(Boolean))];
    const prodResults = resultNos.length
      ? (await this.prodResultRepository.find({
          where: { resultNo: In(resultNos), ...this.tenantWhere(company, plant) },
          select: ['resultNo', 'orderNo', 'workerId', 'equipCode'],
        })) ?? []
      : [];
    const prMap = new Map(prodResults.map((p) => [p.resultNo, p] as const));

    const enriched = data.map((d) => {
      const pr = prMap.get(d.prodResultNo);
      return {
        ...d,
        id: this.buildDefectLogId(d),
        workOrderNo: pr?.orderNo ?? null,
        operator: pr?.workerId ?? null,
        equipmentNo: pr?.equipCode ?? null,
      };
    });

    return { data: enriched, total, page, limit };
  }

  /**
   * 불량로그 단건 조회 (occurAt + seq 복합키)
   */
  async findByCompositeKey(
    occurAt: string,
    seq: number,
    company?: string,
    plant?: string,
  ) {
    const defect = await this.defectLogRepository.findOne({
      where: { occurAt: new Date(occurAt), seq, ...this.tenantWhere(company, plant) },
    });

    if (!defect) {
      throw new NotFoundException(`불량로그를 찾을 수 없습니다: ${occurAt}/${seq}`);
    }

    this.assertSameTenant('불량로그', defect, company, plant);
    return defect;
  }

  /**
   * 불량로그 단건 조회
   * - 화면 식별자(`occurAtISO|seq` 복합키)와 레거시 seq 단독을 모두 허용한다.
   *   복합 PK(occurAt+seq)에서 seq는 단독으로 유일하지 않으므로 화면은 복합 식별자를 사용한다.
   */
  async findById(id: string, company?: string, plant?: string) {
    const defect = id.includes('|')
      ? await (async () => {
          const sep = id.lastIndexOf('|');
          const occurIso = id.slice(0, sep);
          const seqStr = id.slice(sep + 1);
          return this.defectLogRepository.findOne({
            where: { occurAt: new Date(occurIso), seq: +seqStr, ...this.tenantWhere(company, plant) },
          });
        })()
      : await this.defectLogRepository.findOne({
          where: { seq: +id, ...this.tenantWhere(company, plant) },
        });

    if (!defect) {
      throw new NotFoundException(`불량로그를 찾을 수 없습니다: ${id}`);
    }

    this.assertSameTenant('불량로그', defect, company, plant);
    return defect;
  }

  /**
   * 생산실적별 불량 목록 조회
   */
  async findByProdResultNo(
    prodResultNo: string,
    company?: string,
    plant?: string,
  ) {
    const defects = await this.defectLogRepository.find({
      where: { prodResultNo, ...this.tenantWhere(company, plant) },
      order: { occurAt: 'DESC' },
    });

    return defects;
  }

  /**
   * 불량로그 생성
   */
  async create(dto: CreateDefectLogDto, company?: string, plant?: string) {
    const defectCodeMaster = await this.resolveActiveDefectCode(dto.defectCode, company, plant);

    // 대상 생산실적 식별 우선순위: prodResultNo > prdUid(제품 바코드) > workOrderNo
    let prodResultNo = dto.prodResultNo;
    if (!prodResultNo && dto.prdUid) {
      // (1) 생산 시리얼이 prod_result.prdUid에 직접 기록된 경우
      let byProduct = await this.prodResultRepository.findOne({
        where: { prdUid: dto.prdUid, ...this.tenantWhere(company, plant) },
        order: { createdAt: 'DESC' },
      });
      // (2) 제품 바코드가 FG 라벨인 경우(검사 시 발행): FG_LABELS → 작업지시 → 최신 생산실적
      if (!byProduct) {
        const fgLabel = await this.fgLabelRepository.findOne({
          where: { fgBarcode: dto.prdUid, ...this.tenantWhere(company, plant) },
        });
        if (fgLabel?.orderNo) {
          byProduct = await this.prodResultRepository.findOne({
            where: { orderNo: fgLabel.orderNo, ...this.tenantWhere(company, plant) },
            order: { createdAt: 'DESC' },
          });
        }
      }
      if (!byProduct) {
        throw new NotFoundException(
          `제품 바코드 ${dto.prdUid}에 해당하는 생산실적을 찾을 수 없습니다.`,
        );
      }
      prodResultNo = byProduct.resultNo;
    }
    if (!prodResultNo) {
      if (!dto.workOrderNo) {
        throw new BadRequestException(
          '제품 바코드(prdUid), 생산실적 번호(prodResultNo), 작업지시 번호(workOrderNo) 중 하나는 필요합니다.',
        );
      }
      const latest = await this.prodResultRepository.findOne({
        where: { orderNo: dto.workOrderNo, ...this.tenantWhere(company, plant) },
        order: { createdAt: 'DESC' },
      });
      if (!latest) {
        throw new NotFoundException(
          `작업지시 ${dto.workOrderNo}에 해당하는 생산실적이 없습니다. 먼저 생산실적을 등록해 주세요.`,
        );
      }
      prodResultNo = latest.resultNo;
    }

    // 생산실적 존재 확인
    const prodResult = await this.prodResultRepository.findOne({
      where: { resultNo: prodResultNo, ...this.tenantWhere(company, plant) },
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${prodResultNo}`);
    }
    this.assertSameTenant('생산실적', prodResult, company, plant);

    // 불량 등록 및 생산실적 불량수량 증가를 트랜잭션으로 처리
    const defectLog = this.defectLogRepository.create({
      prodResultNo,
      defectCode: defectCodeMaster.defectCode,
      defectName: defectCodeMaster.defectName,
      qty: dto.qty ?? 1,
      status: dto.status ?? 'WAIT',
      cause: dto.cause,
      occurAt: dto.occurAt ? new Date(dto.occurAt) : new Date(),
      imageUrl: dto.imageUrl,
      company,
      plant,
    });

    const savedDefectLog = await this.defectLogRepository.save(defectLog);

    // 생산실적의 불량수량 증가
    await this.prodResultRepository.update(
      { resultNo: prodResultNo, ...this.tenantWhere(company, plant) },
      { defectQty: prodResult.defectQty + (dto.qty ?? 1) }
    );

    return savedDefectLog;
  }

  /**
   * 불량로그 수정
   */
  async update(
    id: string,
    dto: UpdateDefectLogDto,
    company?: string,
    plant?: string,
  ) {
    const existing = await this.findById(id, company, plant);
    await this.ensureNoLinkedRework(existing);
    const pk = { occurAt: existing.occurAt, seq: existing.seq };
    const defectCodeMaster = dto.defectCode !== undefined
      ? await this.resolveActiveDefectCode(dto.defectCode, company, plant)
      : null;

    // 수량 변경 시 생산실적 반영
    const qtyDiff = (dto.qty ?? existing.qty) - existing.qty;

    if (qtyDiff !== 0) {
      await this.defectLogRepository.update(
        pk,
        {
          ...(defectCodeMaster && { defectCode: defectCodeMaster.defectCode, defectName: defectCodeMaster.defectName }),
          ...(dto.qty !== undefined && { qty: dto.qty }),
          ...(dto.cause !== undefined && { cause: dto.cause }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        }
      );

      await this.prodResultRepository.update(
        { resultNo: existing.prodResultNo, ...this.tenantWhere(company, plant) },
        { defectQty: () => `DEFECT_QTY + ${qtyDiff}` }
      );
    } else {
      await this.defectLogRepository.update(
        pk,
        {
          ...(defectCodeMaster && { defectCode: defectCodeMaster.defectCode, defectName: defectCodeMaster.defectName }),
          ...(dto.cause !== undefined && { cause: dto.cause }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        }
      );
    }

    return this.findById(id, company, plant);
  }

  /**
   * 불량로그 삭제
   */
  async delete(id: string, company?: string, plant?: string) {
    const existing = await this.findById(id, company, plant);
    await this.ensureNoLinkedRework(existing);

    // 불량 삭제 시 생산실적 불량수량 감소
    await this.defectLogRepository.delete(this.defectPkWhere(existing, company, plant));

    await this.prodResultRepository.update(
      { resultNo: existing.prodResultNo, ...this.tenantWhere(company, plant) },
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
  async changeStatus(
    id: string,
    dto: ChangeDefectStatusDto,
    company?: string,
    plant?: string,
  ) {
    const existing = await this.findById(id, company, plant);

    // 상태 변경 유효성 검사
    await this.ensureNoLinkedRework(existing);
    this.validateStatusChange(existing.status, dto.status);

    await this.defectLogRepository.update(
      this.defectPkWhere(existing, company, plant),
      { status: dto.status }
    );

    return this.findById(id, company, plant);
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
  async createRepairLog(dto: CreateRepairLogDto, company?: string, plant?: string) {
    const defectLog = await this.findById(dto.defectLogId, company, plant);

    // WAIT 상태가 아니면 자동으로 REPAIR 상태로 변경하지 않음
    // 이미 REPAIR/REWORK 상태일 수 있음

    const repairLog = this.repairLogRepository.create({
      defectLogId: dto.defectLogId,
      workerId: dto.workerId,
      repairAction: dto.repairAction,
      materialUsed: dto.materialUsed,
      repairTime: dto.repairTime,
      result: dto.result,
      remark: dto.remark,
      company,
      plant,
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

      const defect = await this.findById(dto.defectLogId, company, plant);
      await this.defectLogRepository.update(
        this.defectPkWhere(defect, company, plant),
        { status: newStatus }
      );
    }

    return savedRepairLog;
  }

  /**
   * 불량로그별 수리 이력 조회
   */
  async getRepairLogs(
    defectLogId: string,
    company?: string,
    plant?: string,
  ) {
    await this.findById(defectLogId, company, plant); // 존재 확인

    return this.repairLogRepository.find({
      where: { defectLogId, ...this.tenantWhere(company, plant) },
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
    fromDate?: string,
    toDate?: string,
    company?: string,
    plant?: string,
  ): Promise<DefectTypeStatsDto[]> {
    const qb = this.defectLogRepository
      .createQueryBuilder('defect')
      .select('defect.defectCode', 'defectCode')
      .addSelect('defect.defectName', 'defectName')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(defect.qty)', 'totalQty');
    if (company) qb.andWhere('defect.company = :company', { company });
    if (plant) qb.andWhere('defect.plant = :plant', { plant });
    this.applyOccurAtRangeToQb(qb, 'defect', fromDate, toDate);

    // TypeORM의 groupBy 사용
    const grouped = await qb
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
    fromDate?: string,
    toDate?: string,
    company?: string,
    plant?: string,
  ): Promise<DefectStatusStatsDto[]> {
    const qb = this.defectLogRepository
      .createQueryBuilder('defect')
      .select('defect.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(defect.qty)', 'totalQty');
    if (company) qb.andWhere('defect.company = :company', { company });
    if (plant) qb.andWhere('defect.plant = :plant', { plant });
    this.applyOccurAtRangeToQb(qb, 'defect', fromDate, toDate);

    const grouped = await qb
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
  async getDailyDefectTrend(days: number = 7, company?: string, plant?: string) {
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - days + 1);
    const startDate = startDateObj.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    const qb = this.defectLogRepository
      .createQueryBuilder('defect')
      .select(['defect.occurAt', 'defect.qty', 'defect.defectCode']);
    if (company) qb.andWhere('defect.company = :company', { company });
    if (plant) qb.andWhere('defect.plant = :plant', { plant });
    qb.andWhere(`defect.occurAt >= TO_DATE(:startDate, 'YYYY-MM-DD')`, { startDate });
    qb.orderBy('defect.occurAt', 'ASC');

    const defects = await qb.getMany();

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
  async getPendingDefects(company?: string, plant?: string) {
    return this.defectLogRepository.find({
      where: {
        status: In(['WAIT', 'REPAIR', 'REWORK']),
        ...this.tenantWhere(company, plant),
      },
      order: { occurAt: 'ASC' },
    });
  }
}
