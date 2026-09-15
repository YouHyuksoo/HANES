/**
 * @file iqc-request-lot.service.ts
 * @description IQC 검사의뢰 LOT 구성. 입하 수량(시리얼 UI 없음)을 한 품목으로 묶어 시료/대표 관계를 저장한다.
 *
 * 이 서비스는 LOT 구성과 검사의뢰까지만 책임진다. 합불 판정은 AQL 정책을 타는 IQC 검사 경로
 * (IqcHistoryService.arrival 계열)에서만 수행한다. 여기에 PASS/FAIL 직접 판정을 다시 추가하지 말 것.
 * 시료수 역시 의뢰 시점에 사람이 정하지 않고 검사 시점에 AQL이 모집단수량으로 산출한다.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { IqcRequestLot } from '../../../entities/iqc-request-lot.entity';
import { IqcRequestLotLine } from '../../../entities/iqc-request-lot-line.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { CreateIqcRequestLotDto, IqcRequestLotQueryDto } from '../dto/iqc-request-lot.dto';

@Injectable()
export class IqcRequestLotService {
  constructor(
    @InjectRepository(IqcRequestLot)
    private readonly requestRepo: Repository<IqcRequestLot>,
    @InjectRepository(IqcRequestLotLine)
    private readonly lineRepo: Repository<IqcRequestLotLine>,
    @InjectRepository(MatArrival)
    private readonly arrivalRepo: Repository<MatArrival>,
    @InjectRepository(ItemMaster)
    private readonly itemRepo: Repository<ItemMaster>,
    private readonly numbering: NumberingService,
  ) {}

  /**
   * 입하 행 식별 키. MAT_ARRIVALS PK가 복합키 (ARRIVAL_NO, SEQ)라 ARRIVAL_NO 단독으로는 행을 구분할 수 없다.
   */
  private static arrivalKey(arrivalNo: string, arrivalSeq: number) {
    return `${arrivalNo}#${arrivalSeq}`;
  }

  private tenant(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  async listCandidates(itemCode: string, company?: string, plant?: string) {
    if (!itemCode?.trim()) {
      throw new BadRequestException('품목코드를 지정하세요.');
    }
    const arrivals = await this.arrivalRepo.find({
      where: { itemCode: itemCode.trim(), iqcStatus: 'PENDING', ...this.tenant(company, plant) },
      order: { arrivalDate: 'DESC' },
    });
    if (arrivals.length === 0) return [];
    const taken = await this.lineRepo
      .createQueryBuilder('ln')
      .innerJoin(IqcRequestLot, 'rq', 'rq.requestNo = ln.requestNo')
      .where('ln.itemCode = :itemCode', { itemCode: itemCode.trim() })
      .andWhere("rq.status = 'REQUESTED'")
      .andWhere('rq.company = :company', { company })
      .andWhere('rq.plant = :plant', { plant })
      .select(['ln.arrivalNo AS "arrivalNo"', 'ln.arrivalSeq AS "arrivalSeq"'])
      .getRawMany<{ arrivalNo: string; arrivalSeq: number }>();
    const takenSet = new Set(taken.map((r) => IqcRequestLotService.arrivalKey(r.arrivalNo, Number(r.arrivalSeq))));
    return arrivals
      .filter((a) => !takenSet.has(IqcRequestLotService.arrivalKey(a.arrivalNo, a.seq)))
      .map((a) => ({
        arrivalNo: a.arrivalNo,
        seq: a.seq,
        itemCode: a.itemCode,
        qty: Number(a.qty) || 0,
        invoiceNo: a.invoiceNo,
        vendorCode: a.vendorCode,
        vendorName: a.vendorName,
        arrivalDate: a.arrivalDate,
        iqcStatus: a.iqcStatus,
      }));
  }

  async list(query: IqcRequestLotQueryDto, company?: string, plant?: string) {
    const qb = this.requestRepo
      .createQueryBuilder('rq')
      .where('rq.company = :company', { company })
      .andWhere('rq.plant = :plant', { plant })
      .orderBy('rq.createdAt', 'DESC');
    if (query.itemCode) qb.andWhere('rq.itemCode = :itemCode', { itemCode: query.itemCode });
    if (query.status) qb.andWhere('rq.status = :status', { status: query.status });
    const headers = await qb.getMany();
    if (headers.length === 0) return [];
    const lines = await this.lineRepo.find({
      where: { requestNo: In(headers.map((h) => h.requestNo)), ...this.tenant(company, plant) },
      order: { seq: 'ASC' },
    });
    const byReq = new Map<string, IqcRequestLotLine[]>();
    for (const line of lines) {
      const list = byReq.get(line.requestNo) ?? [];
      list.push(line);
      byReq.set(line.requestNo, list);
    }
    return headers.map((h) => ({ ...h, lines: byReq.get(h.requestNo) ?? [] }));
  }

  async create(dto: CreateIqcRequestLotDto, company: string, plant: string, userId?: string) {
    const itemCode = dto.itemCode.trim();
    if (!dto.lines?.length) {
      throw new BadRequestException('구성 입하를 한 건 이상 선택하세요.');
    }
    const roles = new Set(dto.lines.map((l) => l.lineRole));
    if (!roles.has('SAMPLE')) {
      throw new BadRequestException('시료(SAMPLE) 입하를 한 건 이상 지정하세요.');
    }
    const requestedKeys = dto.lines.map((l) => IqcRequestLotService.arrivalKey(l.arrivalNo, l.arrivalSeq));
    if (new Set(requestedKeys).size !== requestedKeys.length) {
      throw new BadRequestException('같은 입하 행을 한 의뢰에 두 번 넣을 수 없습니다.');
    }
    // ARRIVAL_NO 단독 조회 후 (ARRIVAL_NO, SEQ)로 행을 특정한다. 같은 ARRIVAL_NO가 수십 행 존재할 수 있다.
    const arrivalNos = [...new Set(dto.lines.map((l) => l.arrivalNo))];
    const found = await this.arrivalRepo.find({
      where: { arrivalNo: In(arrivalNos), itemCode, iqcStatus: 'PENDING', ...this.tenant(company, plant) },
    });
    const byKey = new Map(found.map((a) => [IqcRequestLotService.arrivalKey(a.arrivalNo, a.seq), a]));
    const missing = requestedKeys.filter((k) => !byKey.has(k));
    if (missing.length > 0) {
      throw new BadRequestException(`PENDING 입하가 아니거나 품목이 다른 행이 있습니다: ${missing.join(', ')}`);
    }
    const taken = await this.listCandidates(itemCode, company, plant);
    const free = new Set(taken.map((t) => IqcRequestLotService.arrivalKey(t.arrivalNo, t.seq)));
    for (const key of requestedKeys) {
      if (!free.has(key)) {
        throw new BadRequestException(`입하 행 ${key} 는 이미 다른 의뢰 LOT에 포함되어 있습니다.`);
      }
    }
    const item = await this.itemRepo.findOne({ where: { itemCode, ...this.tenant(company, plant) } });
    const selected = requestedKeys.map((k) => byKey.get(k)!);
    const lotQty = selected.reduce((sum, a) => sum + (Number(a.qty) || 0), 0);
    if (lotQty <= 0) {
      throw new BadRequestException('모집단 수량이 0입니다.');
    }
    const requestNo = await this.numbering.next('IQC_REQUEST_LOT');
    const invoices = [...new Set(selected.map((a) => a.invoiceNo).filter(Boolean))];
    const header = this.requestRepo.create({
      requestNo,
      itemCode,
      itemName: item?.itemName ?? null,
      vendorCode: selected[0].vendorCode,
      invoiceNo: dto.invoiceNo?.trim() || invoices[0] || null,
      lotQty,
      // 시료수는 검사 시점에 AQL이 모집단수량으로 산출한다. 의뢰 시점에는 비워둔다.
      sampleQty: null,
      status: 'REQUESTED',
      remark: dto.remark ?? null,
      company,
      plant,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });
    await this.requestRepo.save(header);
    const lines = dto.lines.map((line, idx) => {
      const arrival = byKey.get(IqcRequestLotService.arrivalKey(line.arrivalNo, line.arrivalSeq))!;
      return this.lineRepo.create({
        requestNo,
        seq: idx + 1,
        arrivalNo: line.arrivalNo,
        arrivalSeq: line.arrivalSeq,
        itemCode,
        qty: Number(arrival.qty) || 0,
        lineRole: line.lineRole,
        invoiceNo: arrival.invoiceNo ?? null,
        company,
        plant,
      });
    });
    await this.lineRepo.save(lines);
    return { ...header, lines };
  }

  async cancel(requestNo: string, company?: string, plant?: string) {
    const header = await this.requestRepo.findOne({
      where: { requestNo, ...this.tenant(company, plant) },
    });
    if (!header) throw new NotFoundException(`의뢰 LOT이 없습니다: ${requestNo}`);
    if (header.status !== 'REQUESTED') {
      throw new BadRequestException('의뢰 상태만 취소할 수 있습니다.');
    }
    header.status = 'CANCELED';
    await this.requestRepo.save(header);
    return header;
  }
}
