/**
 * @file receive-label.service.ts
 * @description 자재 라벨 발행 서비스 — IQC PASS 입하건 → matUid 채번 → MatLot 생성 → 라벨 인쇄
 *
 * 초보자 가이드:
 * 1. findLabelableArrivals(): IQC PASS 상태인 입하건 목록 조회
 * 2. createMatLabels(): 입하건 선택 → qty만큼 matUid 채번 → MatLot N건 생성 → 인쇄 로그 저장
 * 3. matUid 채번은 Oracle DB Function(F_GET_MAT_UID) 호출
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { UidGeneratorService } from '../../../shared/uid-generator.service';
import { CreateMatLabelsDto, MatLabelResultDto } from '../dto/receive-label.dto';

@Injectable()
export class ReceiveLabelService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly uidGenerator: UidGeneratorService,
    @InjectRepository(MatArrival)
    private readonly arrivalRepo: Repository<MatArrival>,
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partRepo: Repository<PartMaster>,
    @InjectRepository(LabelPrintLog)
    private readonly printLogRepo: Repository<LabelPrintLog>,
  ) {}

  /** IQC PASS + 라벨 미발행 입하건 조회 */
  async findLabelableArrivals() {
    const arrivals = await this.arrivalRepo
      .createQueryBuilder('a')
      .where('a.iqcStatus = :status', { status: 'PASS' })
      .andWhere('a.status != :cancelled', { cancelled: 'CANCELLED' })
      .orderBy('a.createdAt', 'DESC')
      .getMany();

    const parts = await this.partRepo.find();
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const printLogs = await this.printLogRepo
      .createQueryBuilder('log')
      .select('log.uidList')
      .where('log.category = :cat', { cat: 'mat_uid' })
      .andWhere('log.status = :st', { st: 'SUCCESS' })
      .getMany();
    const printedUids = new Set<string>();
    for (const log of printLogs) {
      if (log.uidList) {
        try {
          const ids = JSON.parse(log.uidList);
          if (Array.isArray(ids)) ids.forEach((id: string) => printedUids.add(id));
        } catch { /* ignore */ }
      }
    }

    const labeledArrivalIds = new Set<number>();
    const lots = await this.matLotRepo.find();
    for (const lot of lots) {
      if (printedUids.has(lot.matUid)) {
        const arrival = arrivals.find(
          (a) => a.itemCode === lot.itemCode && a.poNo === lot.poNo,
        );
        if (arrival) labeledArrivalIds.add(arrival.id);
      }
    }

    return arrivals.map((a) => {
      const part = partMap.get(a.itemCode);
      return {
        id: a.id,
        arrivalNo: a.arrivalNo,
        itemCode: a.itemCode,
        itemName: part?.itemName ?? '',
        unit: part?.unit ?? '',
        qty: a.qty,
        poNo: a.poNo,
        vendor: a.vendorName,
        supUid: a.supUid,
        invoiceNo: a.invoiceNo,
        iqcStatus: a.iqcStatus,
        arrivalDate: a.arrivalDate,
        labelPrinted: labeledArrivalIds.has(a.id),
      };
    });
  }

  /** matUid 채번 + MatLot 생성 + 라벨 인쇄 로그 */
  async createMatLabels(dto: CreateMatLabelsDto): Promise<MatLabelResultDto[]> {
    const arrival = await this.arrivalRepo.findOne({ where: { id: dto.arrivalId } });
    if (!arrival) throw new NotFoundException('입하건을 찾을 수 없습니다.');
    if (arrival.iqcStatus !== 'PASS') {
      throw new NotFoundException('IQC 합격 상태가 아닙니다.');
    }

    const part = await this.partRepo.findOne({ where: { itemCode: arrival.itemCode } });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results: MatLabelResultDto[] = [];

      for (let i = 0; i < dto.qty; i++) {
        const matUid = await this.uidGenerator.nextMatUid(queryRunner);
        const lot = queryRunner.manager.create(MatLot, {
          matUid,
          itemCode: arrival.itemCode,
          initQty: 1,
          currentQty: 1,
          recvDate: new Date(),
          poNo: arrival.poNo,
          vendor: arrival.vendorName,
        });
        await queryRunner.manager.save(lot);

        results.push({
          matUid,
          itemCode: arrival.itemCode,
          itemName: part?.itemName ?? '',
          supUid: dto.supUid ?? arrival.supUid ?? null,
        });
      }

      const log = queryRunner.manager.create(LabelPrintLog, {
        category: 'mat_uid',
        printMode: 'BROWSER',
        uidList: JSON.stringify(results.map((r) => r.matUid)),
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
}
