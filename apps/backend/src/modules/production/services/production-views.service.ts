/**
 * @file src/modules/production/services/production-views.service.ts
 * @description 생산관리 조회 전용 서비스 - 작업진행현황, 샘플검사이력, 포장실적, 반제품/제품재고
 *
 * 초보자 가이드:
 * 1. **작업진행현황**: JobOrder + ProdResult 집계를 조합한 대시보드 데이터
 * 2. **샘플검사이력**: InspectResult 테이블 조회
 * 3. **포장실적**: BoxMaster 테이블 조회
 * 4. **반제품/제품재고**: Stock 테이블에서 partType=WIP/FG 필터링
 * 5. **TypeORM 사용**: Repository 패턴을 통해 DB 접근
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ILike, In } from 'typeorm';
import { JobOrder } from '../../../entities/job-order.entity';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import {
  ProgressQueryDto,
  SampleInspectQueryDto,
  PackResultQueryDto,
  WipStockQueryDto,
} from '../dto/production-views.dto';

@Injectable()
export class ProductionViewsService {
  constructor(
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(InspectResult)
    private readonly inspectResultRepository: Repository<InspectResult>,
    @InjectRepository(BoxMaster)
    private readonly boxMasterRepository: Repository<BoxMaster>,
    @InjectRepository(MatStock)
    private readonly stockRepository: Repository<MatStock>,
  ) {}

  /**
   * 작업지시 진행현황 조회 (대시보드)
   */
  async getProgress(query: ProgressQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 20, status, planDateFrom, planDateTo, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.jobOrderRepository
      .createQueryBuilder('jo')
      .leftJoinAndSelect('jo.part', 'p')

    if (company) queryBuilder.andWhere('jo.company = :company', { company });
    if (plant) queryBuilder.andWhere('jo.plant = :plant', { plant });

    queryBuilder
      .orderBy('jo.priority', 'ASC')
      .addOrderBy('jo.planDate', 'ASC')
      .skip(skip)
      .take(limit);

    if (status) {
      queryBuilder.andWhere('jo.status = :status', { status });
    }

    if (planDateFrom || planDateTo) {
      queryBuilder.andWhere('jo.planDate BETWEEN :planDateFrom AND :planDateTo', {
        planDateFrom: planDateFrom ? new Date(planDateFrom) : new Date('1900-01-01'),
        planDateTo: planDateTo ? new Date(planDateTo) : new Date('2099-12-31'),
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(jo.orderNo ILIKE :search OR p.partCode ILIKE :search OR p.partName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder.getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 샘플검사이력 조회
   */
  async getSampleInspect(query: SampleInspectQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, passYn, dateFrom, dateTo, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.inspectResultRepository
      .createQueryBuilder('ir')
      .leftJoinAndSelect('ir.prodResult', 'pr')
      .leftJoinAndSelect('pr.jobOrder', 'jo')
      .leftJoinAndSelect('jo.part', 'p')
      .orderBy('ir.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (passYn) {
      queryBuilder.andWhere('ir.passYn = :passYn', { passYn });
    }

    if (dateFrom || dateTo) {
      queryBuilder.andWhere('ir.inspectDate BETWEEN :dateFrom AND :dateTo', {
        dateFrom: dateFrom ? new Date(dateFrom) : new Date('1900-01-01'),
        dateTo: dateTo ? new Date(dateTo) : new Date('2099-12-31'),
      });
    }

    if (search) {
      queryBuilder.andWhere('pr.lotNo ILIKE :search', { search: `%${search}%` });
    }

    const [data, total] = await Promise.all([
      queryBuilder.getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 포장실적 조회
   */
  async getPackResult(query: PackResultQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, dateFrom, dateTo, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
    };

    if (search) {
      where.boxNo = ILike(`%${search}%`);
      // For OR condition with lotNo, we need QueryBuilder
      const queryBuilder = this.boxMasterRepository
        .createQueryBuilder('bm')
        .where('(bm.boxNo ILIKE :search OR bm.lotNo ILIKE :search)', {
          search: `%${search}%`,
        })
        .orderBy('bm.createdAt', 'DESC')
        .skip(skip)
        .take(limit);

      if (dateFrom || dateTo) {
        queryBuilder.andWhere('bm.packDate BETWEEN :dateFrom AND :dateTo', {
          dateFrom: dateFrom ? new Date(dateFrom) : new Date('1900-01-01'),
          dateTo: dateTo ? new Date(dateTo) : new Date('2099-12-31'),
        });
      }

      const [data, total] = await Promise.all([
        queryBuilder.getMany(),
        queryBuilder.getCount(),
      ]);

      return { data, total, page, limit };
    }

    if (dateFrom || dateTo) {
      where.packDate = Between(
        dateFrom ? new Date(dateFrom) : new Date('1900-01-01'),
        dateTo ? new Date(dateTo) : new Date('2099-12-31'),
      );
    }

    const [data, total] = await Promise.all([
      this.boxMasterRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.boxMasterRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 반제품/제품 재고 조회
   */
  async getWipStock(query: WipStockQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, partType, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.stockRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.part', 'p')
      .where('p.partType IN (:...partTypes)', {
        partTypes: partType ? [partType] : ['WIP', 'FG'],
      })
      .orderBy('s.updatedAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.andWhere('(p.partCode ILIKE :search OR p.partName ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [data, total] = await Promise.all([
      queryBuilder.getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }
}
