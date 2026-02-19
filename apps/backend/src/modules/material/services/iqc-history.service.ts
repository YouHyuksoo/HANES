/**
 * @file src/modules/material/services/iqc-history.service.ts
 * @description IQC 이력 조회 서비스 (TypeORM)
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { IqcHistoryQueryDto } from '../dto/iqc-history.dto';

@Injectable()
export class IqcHistoryService {
  constructor(
    @InjectRepository(IqcLog)
    private readonly iqcLogRepository: Repository<IqcLog>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
  ) {}

  async findAll(query: IqcHistoryQueryDto) {
    const { page = 1, limit = 10, search, inspectType, result, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (inspectType) {
      where.inspectType = inspectType;
    }

    if (result) {
      where.result = result;
    }

    if (fromDate && toDate) {
      where.inspectDate = Between(new Date(fromDate), new Date(toDate));
    }

    let data: IqcLog[];
    let total: number;

    if (search) {
      // 검색어가 있으면 품목 검색 후 필터링
      const parts = await this.partMasterRepository.find({
        where: [
          { partCode: Like(`%${search}%`) },
          { partName: Like(`%${search}%`) },
        ],
      });
      const partIds = parts.map((p) => p.id);

      // LOT 번호로도 검색
      const lots = await this.matLotRepository.find({
        where: { lotNo: Like(`%${search}%`) },
      });
      const lotIds = lots.map((l) => l.id);

      // 복합 조건으로 IQC 로그 검색
      const queryBuilder = this.iqcLogRepository.createQueryBuilder('iqc');

      if (inspectType) {
        queryBuilder.andWhere('iqc.inspectType = :inspectType', { inspectType });
      }
      if (result) {
        queryBuilder.andWhere('iqc.result = :result', { result });
      }
      if (fromDate && toDate) {
        queryBuilder.andWhere('iqc.inspectDate BETWEEN :fromDate AND :toDate', {
          fromDate: new Date(fromDate),
          toDate: new Date(toDate),
        });
      }

      if (partIds.length > 0 || lotIds.length > 0) {
        const conditions: string[] = [];
        if (partIds.length > 0) {
          conditions.push('iqc.partId IN (:...partIds)');
        }
        if (lotIds.length > 0) {
          conditions.push('iqc.lotId IN (:...lotIds)');
        }
        queryBuilder.andWhere(`(${conditions.join(' OR ')})`, { partIds, lotIds });
      } else {
        // 검색 결과가 없으면 빈 결과 반환
        return { data: [], total: 0, page, limit };
      }

      [data, total] = await Promise.all([
        queryBuilder
          .orderBy('iqc.inspectDate', 'DESC')
          .skip(skip)
          .take(limit)
          .getMany(),
        queryBuilder.getCount(),
      ]);
    } else {
      [data, total] = await Promise.all([
        this.iqcLogRepository.find({
          where,
          skip,
          take: limit,
          order: { inspectDate: 'DESC' },
        }),
        this.iqcLogRepository.count({ where }),
      ]);
    }

    // 관련 정보 조회
    const partIds = data.map((log) => log.partId).filter(Boolean);
    const lotIds = data.map((log) => log.lotId).filter(Boolean) as string[];

    const [parts, lots] = await Promise.all([
      this.partMasterRepository.findByIds(partIds),
      lotIds.length > 0 ? this.matLotRepository.findByIds(lotIds) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.id, p]));
    const lotMap = new Map(lots.map((l) => [l.id, l]));

    // 중첩 객체 평면화
    const flattenedData = data.map((log) => {
      const part = partMap.get(log.partId);
      const lot = log.lotId ? lotMap.get(log.lotId) : null;
      return {
        ...log,
        partCode: part?.partCode,
        partName: part?.partName,
        unit: part?.unit,
        lotNo: lot?.lotNo,
      };
    });

    return { data: flattenedData, total, page, limit };
  }
}
