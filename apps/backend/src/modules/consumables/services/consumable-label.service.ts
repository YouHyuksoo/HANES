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
import { Repository } from 'typeorm';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { NumberingService } from '../../../shared/numbering.service';
import {
  CreateConLabelsDto,
  ConfirmConReceivingDto,
  BulkConfirmConReceivingDto,
  ReturnConReceivingDto,
  IssueConDto,
  IssueReturnConDto,
  ConLabelResultDto,
} from '../dto/consumable-label.dto';
import { TransactionService } from '../../../shared/transaction.service';

@Injectable()
export class ConsumableLabelService {
  constructor(
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
    @InjectRepository(ConsumableMaster)
    private readonly masterRepo: Repository<ConsumableMaster>,
    @InjectRepository(ConsumableStock)
    private readonly stockRepo: Repository<ConsumableStock>,
    @InjectRepository(ConsumableLog)
    private readonly logRepo: Repository<ConsumableLog>,
    @InjectRepository(LabelPrintLog)
    private readonly printLogRepo: Repository<LabelPrintLog>,
  ) {}

  private masterTenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  private stockTenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plantCd: plant }),
    };
  }

  /** 라벨 발행 가능 마스터 목록 + 기존 인스턴스 수 */
  async findLabelableConsumables(company?: string, plant?: string) {
    const masters = await this.masterRepo.find({
      where: { useYn: 'Y', ...this.masterTenantWhere(company, plant) },
      order: { consumableCode: 'ASC' },
    });

    const instanceCounts = await this.stockRepo
      .createQueryBuilder('s')
      .where(company ? 's.company = :company' : '1=1', { company })
      .andWhere(plant ? 's.plantCd = :plant' : '1=1', { plant })
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
        imageUrl: m.imageUrl,
        stockQty: m.stockQty,
        expectedLife: m.expectedLife,
        location: m.location,
        instanceCount: counts.total,
        pendingCount: counts.pending,
      };
    });
  }

  /** conUid 채번 + ConsumableStock(PENDING) 생성 + LabelPrintLog */
  async createConLabels(dto: CreateConLabelsDto, company?: string, plant?: string): Promise<ConLabelResultDto[]> {
    const master = await this.masterRepo.findOne({
      where: { consumableCode: dto.consumableCode, ...this.masterTenantWhere(company, plant) },
    });
    if (!master) throw new NotFoundException('소모품 마스터를 찾을 수 없습니다.');

    return this.tx.run(async (queryRunner) => {
      const results: ConLabelResultDto[] = [];

      for (let i = 0; i < dto.qty; i++) {
        const conUid = await this.numbering.nextConUid(queryRunner);
        const stock = queryRunner.manager.create(ConsumableStock, {
          conUid,
          consumableCode: dto.consumableCode,
          status: 'PENDING',
          labelPrintedAt: new Date(),
          vendorCode: dto.vendorCode ?? null,
          vendorName: dto.vendorName ?? null,
          unitPrice: dto.unitPrice ?? master.unitPrice ?? null,
          company: company ?? null,
          plantCd: plant ?? null,
        });
        await queryRunner.manager.save(stock);

        results.push({
          conUid,
          consumableCode: dto.consumableCode,
          consumableName: master.consumableName,
        });
      }

      const log = queryRunner.manager.create(LabelPrintLog, {
        printedAt: new Date(),
        seq: 1,
        category: 'con_uid',
        printMode: 'BROWSER',
        uidList: JSON.stringify(results.map((r) => r.conUid)),
        labelCount: dto.qty,
        status: 'SUCCESS',
        company,
        plant,
      });
      await queryRunner.manager.save(log);

      return results;
    });
  }

  /** PENDING 상태 UID 목록 */
  async findPendingStocks(company?: string, plant?: string) {
    const stocks = await this.stockRepo.find({
      where: { status: 'PENDING', ...this.stockTenantWhere(company, plant) },
      order: { createdAt: 'DESC' },
    });

    const masters = await this.masterRepo.find({
      where: this.masterTenantWhere(company, plant),
    });
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
  async confirmReceiving(dto: ConfirmConReceivingDto, company?: string, plant?: string) {
    const stock = await this.stockRepo.findOne({
      where: { conUid: dto.conUid, ...this.stockTenantWhere(company, plant) },
    });
    if (!stock) throw new NotFoundException(`UID ${dto.conUid}를 찾을 수 없습니다.`);
    if (stock.status !== 'PENDING') {
      throw new BadRequestException(`UID ${dto.conUid}는 이미 입고된 상태입니다. (${stock.status})`);
    }

    return this.tx.run(async (queryRunner) => {
      stock.status = 'ACTIVE';
      stock.recvDate = new Date();
      stock.location = dto.location ?? stock.location;
      stock.remark = dto.remark ?? stock.remark;
      await queryRunner.manager.save(stock);

      await queryRunner.manager.increment(
        ConsumableMaster,
        { consumableCode: stock.consumableCode, ...this.masterTenantWhere(company, plant) },
        'stockQty',
        1,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logSeqResult = await queryRunner.manager.query(
        `SELECT SEQ_CONSUMABLE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL`,
      );
      const logSeq = logSeqResult[0].nextSeq;

      const log = queryRunner.manager.create(ConsumableLog, {
        transDate: today,
        seq: logSeq,
        consumableCode: stock.consumableCode,
        logType: 'IN',
        qty: 1,
        conUid: stock.conUid,
        vendorCode: stock.vendorCode,
        vendorName: stock.vendorName,
        unitPrice: stock.unitPrice,
        incomingType: 'NEW',
        company: company ?? null,
        plant: plant ?? null,
      });
      await queryRunner.manager.save(log);

      const master = await this.masterRepo.findOne({
        where: { consumableCode: stock.consumableCode, ...this.masterTenantWhere(company, plant) },
      });

      return {
        conUid: stock.conUid,
        consumableCode: stock.consumableCode,
        consumableName: master?.consumableName ?? '',
        status: stock.status,
        recvDate: stock.recvDate,
      };
    });
  }

  /** 단건 반납입고 (바코드 스캔): ACTIVE → IN_RETURN 로그 */
  async returnByScan(dto: ReturnConReceivingDto, company?: string, plant?: string) {
    const stock = await this.stockRepo.findOne({
      where: { conUid: dto.conUid, ...this.stockTenantWhere(company, plant) },
    });
    if (!stock) throw new NotFoundException(`UID ${dto.conUid}를 찾을 수 없습니다.`);
    if (stock.status !== 'ACTIVE') {
      throw new BadRequestException(`입고반납은 ACTIVE 상태만 가능합니다. (${stock.status})`);
    }

    return this.tx.run(async (queryRunner) => {
      stock.status = 'RETURNED';
      stock.remark = dto.returnReason ?? stock.remark;
      await queryRunner.manager.save(stock);

      await queryRunner.manager.decrement(
        ConsumableMaster,
        { consumableCode: stock.consumableCode, ...this.masterTenantWhere(company, plant) },
        'stockQty',
        1,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logSeqResult = await queryRunner.manager.query(
        `SELECT SEQ_CONSUMABLE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL`,
      );
      const logSeq = logSeqResult[0].nextSeq;

      const log = queryRunner.manager.create(ConsumableLog, {
        transDate: today,
        seq: logSeq,
        consumableCode: stock.consumableCode,
        logType: 'IN_RETURN',
        qty: 1,
        conUid: stock.conUid,
        vendorCode: stock.vendorCode,
        vendorName: stock.vendorName,
        unitPrice: stock.unitPrice,
        returnReason: dto.returnReason ?? null,
        company: company ?? null,
        plant: plant ?? null,
      });
      await queryRunner.manager.save(log);

      const master = await this.masterRepo.findOne({
        where: { consumableCode: stock.consumableCode, ...this.masterTenantWhere(company, plant) },
      });

      return {
        conUid: stock.conUid,
        consumableCode: stock.consumableCode,
        consumableName: master?.consumableName ?? '',
        status: stock.status,
      };
    });
  }

  /** 단건 출고 (바코드 스캔): ACTIVE → PROC_WAIT */
  async issueByScan(dto: IssueConDto, company?: string, plant?: string) {
    const processCode = dto.processCode?.trim();
    if (!processCode) {
      throw new BadRequestException('소모품 출고 대상 공정을 선택해야 합니다.');
    }

    const stock = await this.stockRepo.findOne({
      where: { conUid: dto.conUid, ...this.stockTenantWhere(company, plant) },
    });
    if (!stock) throw new NotFoundException(`UID ${dto.conUid}를 찾을 수 없습니다.`);
    if (stock.status !== 'ACTIVE') {
      throw new BadRequestException(`출고는 ACTIVE 상태만 가능합니다. (${stock.status})`);
    }

    return this.tx.run(async (queryRunner) => {
      stock.status = 'PROC_WAIT';
      stock.processCode = processCode;
      stock.mountedEquipCode = null;
      stock.remark = dto.remark ?? stock.remark;
      await queryRunner.manager.save(stock);

      await queryRunner.manager.decrement(
        ConsumableMaster,
        { consumableCode: stock.consumableCode, ...this.masterTenantWhere(company, plant) },
        'stockQty',
        1,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logSeqResult = await queryRunner.manager.query(
        `SELECT SEQ_CONSUMABLE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL`,
      );
      const logSeq = logSeqResult[0].nextSeq;

      const log = queryRunner.manager.create(ConsumableLog, {
        transDate: today,
        seq: logSeq,
        consumableCode: stock.consumableCode,
        logType: 'OUT',
        qty: 1,
        conUid: stock.conUid,
        processCode,
        department: dto.department ?? null,
        issueReason: dto.issueReason ?? null,
        company: company ?? null,
        plant: plant ?? null,
      });
      await queryRunner.manager.save(log);

      const master = await this.masterRepo.findOne({
        where: { consumableCode: stock.consumableCode, ...this.masterTenantWhere(company, plant) },
      });

      return {
        conUid: stock.conUid,
        consumableCode: stock.consumableCode,
        consumableName: master?.consumableName ?? '',
        status: stock.status,
        processCode: stock.processCode,
      };
    });
  }

  /** 단건 출고취소 (바코드 스캔): PROC_WAIT → ACTIVE */
  async issueReturnByScan(dto: IssueReturnConDto, company?: string, plant?: string) {
    const stock = await this.stockRepo.findOne({
      where: { conUid: dto.conUid, ...this.stockTenantWhere(company, plant) },
    });
    if (!stock) throw new NotFoundException(`UID ${dto.conUid}를 찾을 수 없습니다.`);
    if (stock.status !== 'PROC_WAIT') {
      throw new BadRequestException(`출고취소는 공정대기 상태만 가능합니다. (${stock.status})`);
    }

    return this.tx.run(async (queryRunner) => {
      const processCode = stock.processCode;
      stock.status = 'ACTIVE';
      stock.processCode = null;
      stock.mountedEquipCode = null;
      stock.remark = dto.returnReason ?? stock.remark;
      await queryRunner.manager.save(stock);

      await queryRunner.manager.increment(
        ConsumableMaster,
        { consumableCode: stock.consumableCode, ...this.masterTenantWhere(company, plant) },
        'stockQty',
        1,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logSeqResult = await queryRunner.manager.query(
        `SELECT SEQ_CONSUMABLE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL`,
      );
      const logSeq = logSeqResult[0].nextSeq;

      const log = queryRunner.manager.create(ConsumableLog, {
        transDate: today,
        seq: logSeq,
        consumableCode: stock.consumableCode,
        logType: 'OUT_RETURN',
        qty: 1,
        conUid: stock.conUid,
        processCode,
        returnReason: dto.returnReason ?? null,
        company: company ?? null,
        plant: plant ?? null,
      });
      await queryRunner.manager.save(log);

      const master = await this.masterRepo.findOne({
        where: { consumableCode: stock.consumableCode, ...this.masterTenantWhere(company, plant) },
      });

      return {
        conUid: stock.conUid,
        consumableCode: stock.consumableCode,
        consumableName: master?.consumableName ?? '',
        status: stock.status,
        processCode: stock.processCode,
      };
    });
  }

  /** 다건 입고 확정 */
  async bulkConfirmReceiving(dto: BulkConfirmConReceivingDto, company?: string, plant?: string) {
    const results = [];
    for (const conUid of dto.conUids) {
      const result = await this.confirmReceiving({
        conUid,
        location: dto.location,
      }, company, plant);
      results.push(result);
    }
    return results;
  }
}
