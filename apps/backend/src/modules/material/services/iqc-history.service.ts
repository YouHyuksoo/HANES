/**
 * @file src/modules/material/services/iqc-history.service.ts
 * @description IQC 이력 조회 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * - IqcLog 엔티티는 arrivalNo 필드로 MatArrival과 연결 (matUid 필드 없음)
 * - CreateIqcResultDto의 matUid는 MatLot 조회용이며, IqcLog에는 arrivalNo로 저장
 * - 검색 시 MatLot(matUid)과 IqcLog(arrivalNo)를 각각 조회하여 매칭
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In } from 'typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { IqcHistoryQueryDto, CreateIqcResultDto, CancelIqcResultDto } from '../dto/iqc-history.dto';

@Injectable()
export class IqcHistoryService {
  constructor(
    @InjectRepository(IqcLog)
    private readonly iqcLogRepository: Repository<IqcLog>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatReceiving)
    private readonly matReceivingRepository: Repository<MatReceiving>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
  ) {}

  async findAll(query: IqcHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, inspectType, result, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

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
          { itemCode: Like(`%${search}%`) },
          { itemName: Like(`%${search}%`) },
        ],
      });
      const searchItemCodes = parts.map((p) => p.itemCode);

      // 복합 조건으로 IQC 로그 검색
      const queryBuilder = this.iqcLogRepository.createQueryBuilder('iqc');

      if (company) queryBuilder.andWhere('iqc.company = :company', { company });
      if (plant) queryBuilder.andWhere('iqc.plant = :plant', { plant });

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

      if (searchItemCodes.length > 0) {
        queryBuilder.andWhere('iqc.itemCode IN (:...searchItemCodes)', { searchItemCodes });
      } else {
        // arrivalNo로도 검색
        queryBuilder.andWhere('(iqc.arrivalNo LIKE :search OR iqc.itemCode LIKE :search)', { search: `%${search}%` });
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
    const itemCodes = data.map((log) => log.itemCode).filter(Boolean);
    const arrivalNos = data.map((log) => log.arrivalNo).filter(Boolean) as string[];

    const [partsResult] = await Promise.all([
      itemCodes.length > 0 ? this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(partsResult.map((p) => [p.itemCode, p]));

    // 중첩 객체 평면화
    const flattenedData = data.map((log) => {
      const part = partMap.get(log.itemCode);
      return {
        ...log,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async createResult(dto: CreateIqcResultDto) {
    const lot = await this.matLotRepository.findOne({
      where: { matUid: dto.matUid },
    });
    if (!lot) {
      throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.matUid}`);
    }

    // LOT iqcStatus 업데이트
    await this.matLotRepository.update(dto.matUid, {
      iqcStatus: dto.result,
    });

    // IqcLog 생성 (IqcLog에는 arrivalNo 사용, matUid 필드 없음)
    const log = this.iqcLogRepository.create({
      arrivalNo: null, // arrivalNo는 별도 연결 필요시 설정
      itemCode: lot.itemCode,
      inspectType: dto.inspectType || 'INITIAL',
      result: dto.result,
      details: dto.details || null,
      inspectorName: dto.inspectorName || null,
      remark: dto.remark || null,
      inspectDate: new Date(),
    });
    const saved = await this.iqcLogRepository.save(log);

    // part 정보 조회
    const part = await this.partMasterRepository.findOne({
      where: { itemCode: lot.itemCode },
    });

    return {
      ...saved,
      matUid: lot.matUid,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
    };
  }

  /** IQC 판정 취소 - LOT iqcStatus를 PENDING으로 복원 */
  async cancel(id: number, dto: CancelIqcResultDto) {
    const log = await this.iqcLogRepository.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException(`IQC 이력을 찾을 수 없습니다: ${id}`);
    }
    if (log.status === 'CANCELED') {
      throw new BadRequestException('이미 취소된 판정입니다.');
    }

    // 이미 입고된 LOT인지 확인 (itemCode 기준으로 최근 입고 체크)
    if (log.itemCode) {
      const receiving = await this.matReceivingRepository.findOne({
        where: { itemCode: log.itemCode, status: 'DONE' },
      });
      if (receiving) {
        throw new BadRequestException('이미 입고된 LOT은 IQC 판정을 취소할 수 없습니다.');
      }
    }

    // IqcLog 상태 변경
    await this.iqcLogRepository.update(id, {
      status: 'CANCELED',
      remark: dto.reason,
    });

    // LOT의 iqcStatus를 PENDING으로 복원 (itemCode 기준으로 LOT 찾기)
    if (log.itemCode) {
      const lot = await this.matLotRepository.findOne({
        where: { itemCode: log.itemCode, iqcStatus: log.result },
        order: { createdAt: 'DESC' },
      });
      if (lot) {
        await this.matLotRepository.update(lot.matUid, {
          iqcStatus: 'PENDING',
        });
      }
    }

    return { id, status: 'CANCELED' };
  }
}
