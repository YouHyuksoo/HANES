/**
 * @file consumable-label.service.ts
 * @description 소모품 라벨 발행 서비스 — conUid 채번 → ConsumableStock(PENDING) 생성 → 입고 확정
 *
 * 초보자 가이드:
 * 1. findLabelableConsumables(): 라벨 발행 가능 마스터 목록 + 기존 인스턴스 수
 * 2. createConLabels(): qty만큼 conUid 채번 → ConsumableStock(PENDING) 생성 → LabelPrintLog 저장
 * 3. findPendingStocks(): PENDING 상태 UID 목록 (미입고 건)
 * 4. confirmReceiving(): PENDING→ACTIVE 전환, recvDate 설정, stockQty 증가
 * 5. bulkConfirmReceiving(): 다건 입고 확정
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { UidGeneratorService } from '../../../shared/uid-generator.service';
import {
  CreateConLabelsDto,
  ConfirmConReceivingDto,
  BulkConfirmConReceivingDto,
  ConLabelResultDto,
} from '../dto/consumable-label.dto';

@Injectable()
export class ConsumableLabelService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly uidGenerator: UidGeneratorService,
    @InjectRepository(ConsumableMaster)
    private readonly masterRepo: Repository<ConsumableMaster>,
    @InjectRepository(ConsumableStock)
    private readonly stockRepo: Repository<ConsumableStock>,
    @InjectRepository(ConsumableLog)
    private readonly logRepo: Repository<ConsumableLog>,
    @InjectRepository(LabelPrintLog)
    private readonly printLogRepo: Repository<LabelPrintLog>,
  ) {}

  /** 라벨 발행 가능 마스터 목록 + 기존 인스턴스 수 */
  async findLabelableConsumables() {
    const masters = await this.masterRepo.find({
      where: { useYn: 'Y' },
      order: { consumableCode: 'ASC' },
    });

    const instanceCounts = await this.stockRepo
      .createQueryBuilder('s')
      .select('s.consumableCode', 'consumableCode')
      .addSelect('COUNT(*)', 'totalCount')
      .addSelect("SUM(CASE WHEN s.status = 'PENDING' THEN 1 ELSE 0 END)", 'pendingCount')
      .groupBy('s.consumableCode')
      .getRawMany();

    const countMap = new Map(
      instanceCounts.map((r) => [
        r.consumableCode,
        { total: Number(r.totalCount), pending: Number(r.pendingCount) },
      ]),
    );

    return masters.map((m) => {
      const counts = countMap.get(m.consumableCode) ?? { total: 0, pending: 0 };
      return {
        consumableCode: m.consumableCode,
        consumableName: m.consumableName,
        category: m.category,
        stockQty: m.stockQty,
        expectedLife: m.expectedLife,
        location: m.location,
        instanceCount: counts.total,
        pendingCount: counts.pending,
      };
    });
  }

  /** conUid 채번 + ConsumableStock(PENDING) 생성 + LabelPrintLog */
  async createConLabels(dto: CreateConLabelsDto): Promise<ConLabelResultDto[]> {
    const master = await this.masterRepo.findOne({
      where: { consumableCode: dto.consumableCode },
    });
    if (!master) throw new NotFoundException('소모품 마스터를 찾을 수 없습니다.');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results: ConLabelResultDto[] = [];

      for (let i = 0; i < dto.qty; i++) {
        const conUid = await this.uidGenerator.nextConUid(queryRunner);
        const stock = queryRunner.manager.create(ConsumableStock, {
          conUid,
          consumableCode: dto.consumableCode,
          status: 'PENDING',
          labelPrintedAt: new Date(),
          vendorCode: dto.vendorCode ?? null,
          vendorName: dto.vendorName ?? null,
          unitPrice: dto.unitPrice ?? master.unitPrice ?? null,
        });
        await queryRunner.manager.save(stock);

        results.push({
          conUid,
          consumableCode: dto.consumableCode,
          consumableName: master.consumableName,
        });
      }

      const log = queryRunner.manager.create(LabelPrintLog, {
        category: 'con_uid',
        printMode: 'BROWSER',
        uidList: JSON.stringify(results.map((r) => r.conUid)),
        labelCount: dto.qty,
        status: 'SUCCESS',
      });
      await queryRunner.manager.save(log);

      await queryRunner.commitTransaction();
      return results;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** PENDING 상태 UID 목록 */
  async findPendingStocks() {
    const stocks = await this.stockRepo.find({
      where: { status: 'PENDING' },
      order: { createdAt: 'DESC' },
    });

    const masters = await this.masterRepo.find();
    const masterMap = new Map(masters.map((m) => [m.consumableCode, m]));

    return stocks.map((s) => {
      const master = masterMap.get(s.consumableCode);
      return {
        conUid: s.conUid,
        consumableCode: s.consumableCode,
        consumableName: master?.consumableName ?? '',
        category: master?.category ?? '',
        labelPrintedAt: s.labelPrintedAt,
        vendorCode: s.vendorCode,
        vendorName: s.vendorName,
        unitPrice: s.unitPrice,
      };
    });
  }

  /** 단건 입고 확정: PENDING → ACTIVE */
  async confirmReceiving(dto: ConfirmConReceivingDto) {
    const stock = await this.stockRepo.findOne({ where: { conUid: dto.conUid } });
    if (!stock) throw new NotFoundException(`UID ${dto.conUid}를 찾을 수 없습니다.`);
    if (stock.status !== 'PENDING') {
      throw new BadRequestException(`UID ${dto.conUid}는 이미 입고된 상태입니다. (${stock.status})`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      stock.status = 'ACTIVE';
      stock.recvDate = new Date();
      stock.location = dto.location ?? stock.location;
      stock.remark = dto.remark ?? stock.remark;
      await queryRunner.manager.save(stock);

      await queryRunner.manager.increment(
        ConsumableMaster,
        { consumableCode: stock.consumableCode },
        'stockQty',
        1,
      );

      const log = queryRunner.manager.create(ConsumableLog, {
        consumableCode: stock.consumableCode,
        logType: 'INCOMING',
        qty: 1,
        conUid: stock.conUid,
        vendorCode: stock.vendorCode,
        vendorName: stock.vendorName,
        unitPrice: stock.unitPrice,
        incomingType: 'NEW',
      });
      await queryRunner.manager.save(log);

      await queryRunner.commitTransaction();

      const master = await this.masterRepo.findOne({
        where: { consumableCode: stock.consumableCode },
      });

      return {
        conUid: stock.conUid,
        consumableCode: stock.consumableCode,
        consumableName: master?.consumableName ?? '',
        status: stock.status,
        recvDate: stock.recvDate,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 다건 입고 확정 */
  async bulkConfirmReceiving(dto: BulkConfirmConReceivingDto) {
    const results = [];
    for (const conUid of dto.conUids) {
      const result = await this.confirmReceiving({
        conUid,
        location: dto.location,
      });
      results.push(result);
    }
    return results;
  }
}
