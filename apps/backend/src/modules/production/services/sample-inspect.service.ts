/**
 * @file src/modules/production/services/sample-inspect.service.ts
 * @description 반제품 샘플검사 입력/조회 서비스
 *
 * 초보자 가이드:
 * 1. **create**: 샘플검사 일괄 입력 (헤더정보 + 샘플별 측정값)
 * 2. **findHistory**: 샘플검사 이력 조회 (그룹핑 + 통계)
 * 3. **findByJobOrder**: 특정 작업지시의 샘플검사 목록
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SampleInspectResult } from '../../../entities/sample-inspect-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { PartMaster } from '../../../entities/part-master.entity';
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
    private readonly dataSource: DataSource,
  ) {}

  /** 샘플검사 일괄 입력 */
  async create(dto: CreateSampleInspectDto) {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: dto.orderNo },
    });
    if (!jobOrder) {
      throw new NotFoundException('작업지시를 찾을 수 없습니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const records: SampleInspectResult[] = [];
      for (const sample of dto.samples) {
        const entity = queryRunner.manager.create(SampleInspectResult, {
          orderNo: dto.orderNo,
          inspectDate: new Date(dto.inspectDate),
          inspectorName: dto.inspectorName,
          inspectType: dto.inspectType || null,
          sampleNo: sample.sampleNo,
          measuredValue: sample.measuredValue || null,
          specUpper: sample.specUpper || null,
          specLower: sample.specLower || null,
          passYn: sample.passYn,
          remark: sample.remark || null,
        });
        records.push(entity);
      }

      const saved = await queryRunner.manager.save(SampleInspectResult, records);
      await queryRunner.commitTransaction();

      return { count: saved.length, data: saved };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** 샘플검사 이력 조회 (작업지시별 그룹핑) */
  async findHistory(query: SampleInspectHistoryQueryDto, company?: string, plant?: string) {
    const { passYn, startDate, endDate, search, limit = 50 } = query;

    const qb = this.sampleInspectRepository
      .createQueryBuilder('si')
      .leftJoin(JobOrder, 'jo', 'jo.id = si.orderNo')
      .leftJoin(PartMaster, 'p', 'p.id = jo.itemCode')
      .select([
        'si.id AS "id"',
        'si.orderNo AS "orderNo"',
        'jo.orderNo AS "orderNo"',
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

    if (startDate) {
      qb.andWhere('si.inspectDate >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      qb.andWhere('si.inspectDate <= :endDate', { endDate: new Date(endDate) });
    }

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
  async findByJobOrder(orderNo: string) {
    return this.sampleInspectRepository.find({
      where: { orderNo },
      order: { inspectDate: 'DESC', sampleNo: 'ASC' },
    });
  }
}
