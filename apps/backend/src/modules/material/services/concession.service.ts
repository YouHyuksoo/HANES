/**
 * @file src/modules/material/services/concession.service.ts
 * @description 특채처리(특별채택) 비즈니스 로직
 *
 * 초보자 가이드:
 * 1. **특채 대상**: IQC 검사결과 불합격(iqcStatus='FAIL')인 LOT만
 * 2. **단위**: 입하번호(ARRIVAL_NO) + 품목(ITEM_CODE) 그룹 (IQC 검사 단위와 동일)
 * 3. **특채 처리**: 그룹의 FAIL 시리얼 전체에 SPECIAL_ACCEPT_YN='Y' 설정
 * 4. **효과**: 특채 LOT은 입고화면(receivable)에 노출되어 양품창고로 입고 가능
 *    (재고 출고원천은 불용창고, 입고 목적지는 담당자가 선택한 양품창고)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { ConcessionTargetQueryDto, ApplyConcessionDto } from '../dto/concession.dto';

@Injectable()
export class ConcessionService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatReceiving)
    private readonly matReceivingRepository: Repository<MatReceiving>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(WorkerMaster)
    private readonly workerMasterRepository: Repository<WorkerMaster>,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  /**
   * 특채 대상 목록 (불합격 입하+품목 그룹 집계)
   * - iqcStatus='FAIL' 시리얼을 ARRIVAL_NO + ITEM_CODE 로 묶어 1행 반환
   * - 집계는 SQL GROUP BY 로 수행 (메모리 집계 금지)
   */
  async findTargets(query: ConcessionTargetQueryDto, company?: string, plant?: string) {
    const qb = this.matLotRepository
      .createQueryBuilder('lot')
      .select('lot.arrivalNo', 'arrivalNo')
      .addSelect('lot.itemCode', 'itemCode')
      .addSelect('lot.vendor', 'vendor')
      .addSelect('SUM(lot.initQty)', 'totalQty')
      .addSelect('COUNT(*)', 'serialCount')
      .addSelect("SUM(CASE WHEN lot.specialAcceptYn = 'Y' THEN 1 ELSE 0 END)", 'specialAcceptCount')
      .addSelect('MAX(lot.specialAcceptWorkerCode)', 'specialAcceptWorkerCode')
      .addSelect('MIN(lot.recvDate)', 'recvDate')
      .addSelect('MIN(lot.createdAt)', 'createdAt')
      .where('lot.arrivalNo IS NOT NULL')
      .andWhere("lot.iqcStatus = 'FAIL'");

    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });
    if (query.search) {
      qb.andWhere('(lot.arrivalNo LIKE :search OR lot.itemCode LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.groupBy('lot.arrivalNo')
      .addGroupBy('lot.itemCode')
      .addGroupBy('lot.vendor')
      .orderBy('MIN(lot.createdAt)', 'DESC');

    const rows = await qb.getRawMany<{
      arrivalNo: string;
      itemCode: string;
      vendor: string;
      totalQty: string;
      serialCount: string;
      specialAcceptCount: string;
      specialAcceptWorkerCode: string | null;
      recvDate: Date | null;
      createdAt: Date | null;
    }>();

    const itemCodes = [...new Set(rows.map((r) => r.itemCode).filter(Boolean))];
    const specialAcceptWorkerCodes = [...new Set(rows.map((r) => r.specialAcceptWorkerCode).filter(Boolean))] as string[];
    const [parts, workers] = await Promise.all([
      itemCodes.length > 0
        ? this.itemMasterRepository.find({
          where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) },
        })
        : Promise.resolve([]),
      specialAcceptWorkerCodes.length > 0
        ? this.workerMasterRepository.find({
          where: { workerCode: In(specialAcceptWorkerCodes), ...this.tenantWhere(company, plant) },
        })
        : Promise.resolve([]),
    ]);
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const workerMap = new Map(workers.map((w) => [w.workerCode, w.workerName]));

    return rows.map((r) => {
      const part = partMap.get(r.itemCode);
      const serialCount = Number(r.serialCount) || 0;
      const specialAcceptCount = Number(r.specialAcceptCount) || 0;
      return {
        arrivalNo: r.arrivalNo,
        itemCode: r.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        vendor: r.vendor,
        totalQty: Number(r.totalQty) || 0,
        serialCount,
        specialAcceptCount,
        /** 그룹 전체 시리얼이 특채 처리되었는지 */
        specialAcceptYn: serialCount > 0 && specialAcceptCount >= serialCount ? 'Y' : 'N',
        specialAcceptWorkerCode: r.specialAcceptWorkerCode ?? null,
        specialAcceptWorkerName: r.specialAcceptWorkerCode
          ? (workerMap.get(r.specialAcceptWorkerCode) ?? r.specialAcceptWorkerCode)
          : null,
        recvDate: r.recvDate,
        createdAt: r.createdAt,
      };
    });
  }

  /** 특채 처리 — 그룹의 FAIL 시리얼 전체에 SPECIAL_ACCEPT_YN='Y' 설정 */
  async apply(dto: ApplyConcessionDto, company?: string, plant?: string, userId?: string) {
    const specialAcceptWorkerCode = dto.specialAcceptWorkerCode?.trim();
    if (!specialAcceptWorkerCode) {
      throw new BadRequestException('특채 처리 작업자를 선택해 주세요.');
    }

    const lots = await this.matLotRepository.find({
      where: {
        arrivalNo: dto.arrivalNo,
        itemCode: dto.itemCode,
        iqcStatus: 'FAIL',
        ...this.tenantWhere(company, plant),
      },
    });
    if (lots.length === 0) {
      throw new NotFoundException(
        `특채 대상(불합격) 시리얼이 없습니다: 입하 ${dto.arrivalNo} / 품목 ${dto.itemCode}`,
      );
    }

    const tenantCompany = lots[0].company;
    const tenantPlant = lots[0].plant;

    const worker = await this.workerMasterRepository.findOne({
      where: {
        workerCode: specialAcceptWorkerCode,
        useYn: 'Y',
        ...this.tenantWhere(tenantCompany, tenantPlant),
      },
    });
    if (!worker) {
      throw new BadRequestException(`유효한 특채 처리 작업자를 찾을 수 없습니다: ${specialAcceptWorkerCode}`);
    }

    await this.matLotRepository.update(
      {
        arrivalNo: dto.arrivalNo,
        itemCode: dto.itemCode,
        iqcStatus: 'FAIL',
        ...this.tenantWhere(tenantCompany, tenantPlant),
      },
      {
        specialAcceptYn: 'Y',
        specialAcceptWorkerCode,
        ...(userId ? { updatedBy: userId } : {}),
      },
    );

    return {
      arrivalNo: dto.arrivalNo,
      itemCode: dto.itemCode,
      affectedSerials: lots.length,
      specialAcceptYn: 'Y',
      specialAcceptWorkerCode,
    };
  }

  /** 특채 취소 — SPECIAL_ACCEPT_YN='N' 복원 (이미 입고된 입하건은 취소 불가) */
  async cancel(dto: ApplyConcessionDto, company?: string, plant?: string, userId?: string) {
    const lots = await this.matLotRepository.find({
      where: {
        arrivalNo: dto.arrivalNo,
        itemCode: dto.itemCode,
        iqcStatus: 'FAIL',
        ...this.tenantWhere(company, plant),
      },
    });
    if (lots.length === 0) {
      throw new NotFoundException(
        `특채 대상(불합격) 시리얼이 없습니다: 입하 ${dto.arrivalNo} / 품목 ${dto.itemCode}`,
      );
    }

    const tenantCompany = lots[0].company;
    const tenantPlant = lots[0].plant;

    // 이미 입고된 시리얼이 있으면 특채 취소 불가
    const received = await this.matReceivingRepository.findOne({
      where: {
        matUid: In(lots.map((l) => l.matUid)),
        status: 'DONE',
        ...this.tenantWhere(tenantCompany, tenantPlant),
      },
    });
    if (received) {
      throw new BadRequestException(
        `이미 입고된 LOT(${received.matUid})이 있어 특채를 취소할 수 없습니다. 입고를 먼저 정리해 주세요.`,
      );
    }

    await this.matLotRepository.update(
      {
        arrivalNo: dto.arrivalNo,
        itemCode: dto.itemCode,
        iqcStatus: 'FAIL',
        ...this.tenantWhere(tenantCompany, tenantPlant),
      },
      { specialAcceptYn: 'N', specialAcceptWorkerCode: null, ...(userId ? { updatedBy: userId } : {}) },
    );

    return {
      arrivalNo: dto.arrivalNo,
      itemCode: dto.itemCode,
      affectedSerials: lots.length,
      specialAcceptYn: 'N',
    };
  }
}
