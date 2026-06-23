/**
 * @file services/self-inspect.service.ts
 * @description 자주검사 서비스 — 검사항목 조회, 결과 저장, 의뢰검사 상태 관리
 *
 * 초보자 가이드:
 * - 검사항목(SelfInspectItem): 공정코드 기준으로 마스터 조회
 * - 검사결과(SelfInspectResult): 초물/중물/종물 결과 저장
 * - 의뢰검사(DELEGATE): status=PENDING 인 결과가 있으면 키오스크 차단
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SelfInspectItem } from '../../../entities/self-inspect-item.entity';
import { SelfInspectResult } from '../../../entities/self-inspect-result.entity';

@Injectable()
export class SelfInspectService {
  constructor(
    @InjectRepository(SelfInspectItem)
    private readonly itemRepo: Repository<SelfInspectItem>,
    @InjectRepository(SelfInspectResult)
    private readonly resultRepo: Repository<SelfInspectResult>,
  ) {}

  /** 공정별 자주검사 항목 조회 (USE_YN='Y' 필터) */
  async findItems(processCode: string, timing?: string, company?: string, plant?: string) {
    const qb = this.itemRepo.createQueryBuilder('i')
      .where('i.useYn = :y', { y: 'Y' })
      .orderBy('i.sortOrder', 'ASC');

    if (processCode) {
      qb.andWhere('(i.processCode = :pc OR i.processCode IS NULL)', { pc: processCode });
    }
    if (timing) {
      qb.andWhere("i.timing LIKE :timing", { timing: `%${timing}%` });
    }
    if (company) qb.andWhere('(i.company = :company OR i.company IS NULL)', { company });
    if (plant) qb.andWhere('(i.plant = :plant OR i.plant IS NULL)', { plant });

    return qb.getMany();
  }

  /** 자주검사 결과 저장 */
  async createResult(
    dto: {
      orderNo: string;
      equipCode?: string;
      processCode?: string;
      inspectItemId?: string;
      itemName: string;
      timing: string;
      inspectMethod: string;
      status: string;
      prodQtyAtInspect?: number;
      inspectorId?: string;
      remark?: string;
      sampleNo?: number;
      measureValue?: number;
    },
    company: string,
    plant: string,
  ) {
    const result = this.resultRepo.create({
      orderNo: dto.orderNo,
      equipCode: dto.equipCode ?? null,
      processCode: dto.processCode ?? null,
      inspectItemId: dto.inspectItemId ?? null,
      itemName: dto.itemName,
      timing: dto.timing,
      inspectMethod: dto.inspectMethod,
      status: dto.status,
      prodQtyAtInspect: dto.prodQtyAtInspect ?? null,
      inspectorId: dto.inspectorId ?? null,
      remark: dto.remark ?? null,
      sampleNo: dto.sampleNo ?? 1,
      measureValue: dto.measureValue ?? null,
      company,
      plant,
      inspectedAt: dto.status !== 'PENDING' ? new Date() : null,
    });
    return this.resultRepo.save(result);
  }

  /** 의뢰검사 상태 업데이트 (별도 의뢰검사 관리 화면에서 사용) */
  async updateResultStatus(
    id: string,
    status: string,
    remark?: string,
    measureValue?: number,
    company?: string,
    plant?: string,
  ) {
    const result = await this.resultRepo.findOne({
      where: {
        id,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!result) throw new NotFoundException(`SelfInspectResult ${id} not found`);
    result.status = status;
    if (remark !== undefined) result.remark = remark;
    if (measureValue !== undefined) result.measureValue = measureValue;
    if (status !== 'PENDING') result.inspectedAt = new Date();
    return this.resultRepo.save(result);
  }

  /** 특정 작업지시의 의뢰검사 대기 여부 확인 */
  async hasPendingDelegate(
    orderNo: string,
    company?: string,
    plant?: string,
  ): Promise<{ hasPending: boolean; pendingCount: number }> {
    const count = await this.resultRepo.count({
      where: {
        orderNo,
        inspectMethod: 'DELEGATE',
        status: 'PENDING',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    return { hasPending: count > 0, pendingCount: count };
  }

  /** 작업지시별 자주검사 결과 이력 */
  async findResults(orderNo: string, company?: string, plant?: string) {
    return this.resultRepo.find({
      where: {
        orderNo,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** 의뢰검사 대기 목록 (관리 화면용) — 검사항목 마스터(LSL/USL/단위/기준/유형) JOIN */
  async findPendingDelegates(company: string, plant: string) {
    const rows = await this.resultRepo
      .createQueryBuilder('r')
      .leftJoin(SelfInspectItem, 'i', 'i.id = r.inspectItemId')
      .where('r.inspectMethod = :method', { method: 'DELEGATE' })
      .andWhere('r.status = :status', { status: 'PENDING' })
      .andWhere('r.company = :company', { company })
      .andWhere('r.plant = :plant', { plant })
      .select([
        'r.id AS "id"',
        'r.orderNo AS "orderNo"',
        'r.processCode AS "processCode"',
        'r.itemName AS "itemName"',
        'r.timing AS "timing"',
        'r.inspectMethod AS "inspectMethod"',
        'r.status AS "status"',
        'r.remark AS "remark"',
        'r.measureValue AS "measureValue"',
        'r.sampleNo AS "sampleNo"',
        'r.createdAt AS "createdAt"',
        'i.itemType AS "itemType"',
        'i.unit AS "unit"',
        'i.standard AS "standard"',
        'i.lslValue AS "lslValue"',
        'i.uslValue AS "uslValue"',
      ])
      .orderBy('r.createdAt', 'ASC')
      .getRawMany();
    return rows;
  }

  /** 자주검사 항목 전체 조회 (관리 화면용 — timing 필터 없음) */
  async findAllItems(processCode: string, company?: string, plant?: string) {
    const qb = this.itemRepo.createQueryBuilder('i')
      .where('i.processCode = :pc', { pc: processCode })
      .orderBy('i.sortOrder', 'ASC')
      .addOrderBy('i.createdAt', 'ASC');
    if (company) qb.andWhere('(i.company = :company OR i.company IS NULL)', { company });
    if (plant) qb.andWhere('(i.plant = :plant OR i.plant IS NULL)', { plant });
    return qb.getMany();
  }

  /** 자주검사 항목 생성 */
  async createItem(dto: {
    processCode: string;
    itemName: string;
    standard?: string | null;
    inspectMethod?: string;
    timing?: string;
    isDestructive?: boolean;
    sortOrder?: number;
    useYn?: string;
    itemType?: string;
    unit?: string | null;
    lslValue?: number | null;
    uslValue?: number | null;
    sampleCount?: number;
  }, company: string, plant: string) {
    const item = this.itemRepo.create({
      processCode: dto.processCode,
      itemName: dto.itemName,
      standard: dto.standard ?? null,
      inspectMethod: dto.inspectMethod ?? 'DIRECT',
      timing: dto.timing ?? 'MID',
      isDestructive: dto.isDestructive ?? false,
      sortOrder: dto.sortOrder ?? 0,
      useYn: dto.useYn ?? 'Y',
      itemType: dto.itemType ?? 'VISUAL',
      unit: dto.unit ?? null,
      lslValue: dto.lslValue ?? null,
      uslValue: dto.uslValue ?? null,
      sampleCount: dto.sampleCount ?? 1,
      company,
      plant,
    });
    return this.itemRepo.save(item);
  }

  /** 자주검사 항목 수정 */
  async updateItem(id: string, dto: {
    itemName?: string;
    standard?: string | null;
    inspectMethod?: string;
    timing?: string;
    isDestructive?: boolean;
    sortOrder?: number;
    useYn?: string;
    itemType?: string;
    unit?: string | null;
    lslValue?: number | null;
    uslValue?: number | null;
    sampleCount?: number;
  }, company: string, plant: string) {
    const item = await this.itemRepo.findOne({ where: { id, company, plant } });
    if (!item) throw new NotFoundException(`SelfInspectItem ${id} not found`);
    const updateData: Partial<SelfInspectItem> = {
      ...(dto.itemName !== undefined ? { itemName: dto.itemName } : {}),
      ...(dto.standard !== undefined ? { standard: dto.standard } : {}),
      ...(dto.inspectMethod !== undefined ? { inspectMethod: dto.inspectMethod } : {}),
      ...(dto.timing !== undefined ? { timing: dto.timing } : {}),
      ...(dto.isDestructive !== undefined ? { isDestructive: dto.isDestructive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      ...(dto.itemType !== undefined ? { itemType: dto.itemType } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.lslValue !== undefined ? { lslValue: dto.lslValue } : {}),
      ...(dto.uslValue !== undefined ? { uslValue: dto.uslValue } : {}),
      ...(dto.sampleCount !== undefined ? { sampleCount: dto.sampleCount } : {}),
    };
    Object.assign(item, updateData);
    return this.itemRepo.save(item);
  }

  /** 자주검사 항목 삭제 */
  async deleteItem(id: string, company: string, plant: string) {
    const item = await this.itemRepo.findOne({ where: { id, company, plant } });
    if (!item) throw new NotFoundException(`SelfInspectItem ${id} not found`);
    await this.itemRepo.remove(item);
    return { id };
  }

  /** 자주검사 이력 목록 조회 (페이지네이션) */
  async findHistory(query: {
    fromDate?: string;
    toDate?: string;
    orderNo?: string;
    processCode?: string;
    page?: number;
    limit?: number;
  }, company: string, plant: string) {
    const { fromDate, toDate, orderNo, processCode, page = 1, limit = 30 } = query;
    const skip = (page - 1) * limit;

    const qb = this.resultRepo.createQueryBuilder('r')
      .where('r.company = :company AND r.plant = :plant', { company, plant })
      .orderBy('r.createdAt', 'DESC');

    if (orderNo) qb.andWhere('r.orderNo LIKE :ono', { ono: `%${orderNo}%` });
    if (processCode) qb.andWhere('r.processCode = :pc', { pc: processCode });
    if (fromDate) qb.andWhere("r.createdAt >= TO_DATE(:df, 'YYYY-MM-DD')", { df: fromDate });
    if (toDate) qb.andWhere("r.createdAt < TO_DATE(:dt, 'YYYY-MM-DD') + 1", { dt: toDate });

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return { data, total, page, limit };
  }
}
