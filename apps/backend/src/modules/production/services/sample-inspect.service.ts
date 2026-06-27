/**
 * @file src/modules/production/services/sample-inspect.service.ts
 * @description 반제품 샘플검사 입력/조회 서비스
 *
 * 초보자 가이드:
 * 1. **create**: 샘플검사 일괄 입력 (헤더정보 + 샘플별 측정값)
 * 2. **findHistory**: 샘플검사 이력 조회 (그룹핑 + 통계)
 * 3. **findByJobOrder**: 특정 작업지시의 샘플검사 목록
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SampleInspectResult } from '../../../entities/sample-inspect-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { applyDateFilter } from '../../../shared/date-filter.util';
import { parseDateStart } from '../../../shared/date.util';
import {
  CreateSampleInspectDto,
  SampleInspectHistoryQueryDto,
} from '../dto/sample-inspect.dto';

@Injectable()
export class SampleInspectService {
  constructor(
    @InjectRepository(SampleInspectResult)
    private readonly sampleInspectRepository: Repository<SampleInspectResult>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    private readonly tx: TransactionService,
  ) {}

  private assertSameTenant(
    context: string,
    row: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && row.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row.company ?? 'NULL'}`);
    }
    if (plant && row.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row.plant ?? 'NULL'}`);
    }
  }

  /** 샘플검사 일괄 입력 */
  async create(dto: CreateSampleInspectDto, company?: string, plant?: string) {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: dto.orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!jobOrder) {
      throw new NotFoundException('작업지시를 찾을 수 없습니다.');
    }
    this.assertSameTenant('샘플검사 작업지시', jobOrder, company, plant);

    return this.tx.run(async (queryRunner) => {
      const records: SampleInspectResult[] = [];
      for (const sample of dto.samples) {
        const entity = queryRunner.manager.create(SampleInspectResult, {
          orderNo: dto.orderNo,
          inspectDate: parseDateStart(dto.inspectDate)!,
          inspectorName: dto.inspectorName,
          inspectType: dto.inspectType || null,
          sampleNo: sample.sampleNo,
          measuredValue: sample.measuredValue || null,
          specUpper: sample.specUpper || null,
          specLower: sample.specLower || null,
          passYn: sample.passYn,
          remark: sample.remark || null,
          company: jobOrder.company,
          plant: jobOrder.plant,
        });
        records.push(entity);
      }

      const saved = await queryRunner.manager.save(SampleInspectResult, records);

      return { count: saved.length, data: saved };
    });
  }

  /** 샘플검사 이력 조회 (작업지시별 그룹핑) */
  async findHistory(query: SampleInspectHistoryQueryDto, company?: string, plant?: string) {
    const { passYn, fromDate, toDate, search, limit = 50 } = query;

    const qb = this.sampleInspectRepository
      .createQueryBuilder('si')
      .leftJoin(JobOrder, 'jo', 'jo.orderNo = si.orderNo AND jo.company = si.company AND jo.plant = si.plant')
      .leftJoin(ItemMaster, 'p', 'p.itemCode = jo.itemCode AND p.company = jo.company AND p.plant = jo.plant')
      .select([
        'si.orderNo AS "orderNo"',
        'jo.orderNo AS "jobOrderNo"',
        'p.itemCode AS "itemCode"',
        'p.itemName AS "itemName"',
        'si.inspectDate AS "inspectDate"',
        'si.inspectorName AS "inspectorName"',
        'si.inspectType AS "inspectType"',
        'si.sampleNo AS "sampleNo"',
        'si.measuredValue AS "measuredValue"',
        'si.specUpper AS "specUpper"',
        'si.specLower AS "specLower"',
        'si.passYn AS "passYn"',
        'si.remark AS "remark"',
        'si.createdAt AS "createdAt"',
      ])
      .orderBy('si.inspectDate', 'DESC')
      .addOrderBy('jo.orderNo', 'ASC')
      .addOrderBy('si.sampleNo', 'ASC')
      .take(limit);

    if (company) {
      qb.andWhere('jo.company = :company', { company });
    }
    if (plant) {
      qb.andWhere('jo.plant = :plant', { plant });
    }

    if (passYn) {
      qb.andWhere('si.passYn = :passYn', { passYn });
    }

    applyDateFilter(qb, 'si.inspectDate', fromDate, toDate);

    if (search) {
      qb.andWhere(
        '(jo.orderNo LIKE :search OR p.itemCode LIKE :search OR p.itemName LIKE :search OR si.inspectorName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const data = await qb.getRawMany();
    return { data, total: data.length };
  }

  /** 특정 작업지시의 샘플검사 목록 */
  async findByJobOrder(orderNo: string, company?: string, plant?: string) {
    return this.sampleInspectRepository.find({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      order: { inspectDate: 'DESC', sampleNo: 'ASC' },
    });
  }
}
