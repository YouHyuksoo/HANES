/**
 * @file iqc-request-lot.service.ts
 * @description IQC 검사의뢰 LOT 구성. 입하 수량(시리얼 UI 없음)을 한 품목으로 묶어 시료/대표 관계를 저장한다.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { IqcRequestLot } from '../../../entities/iqc-request-lot.entity';
import { IqcRequestLotLine } from '../../../entities/iqc-request-lot-line.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { CreateIqcRequestLotDto, InspectIqcRequestLotDto, IqcRequestLotQueryDto } from '../dto/iqc-request-lot.dto';
import { IqcHistoryService } from './iqc-history.service';

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
    private readonly iqcHistory: IqcHistoryService,
  ) {}

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
      .select(['ln.arrivalNo AS "arrivalNo"'])
      .getRawMany<{ arrivalNo: string }>();
    const takenSet = new Set(taken.map((r) => r.arrivalNo));
    return arrivals
      .filter((a) => !takenSet.has(a.arrivalNo))
      .map((a) => ({
        arrivalNo: a.arrivalNo,
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
    const arrivalNos = dto.lines.map((l) => l.arrivalNo);
    if (new Set(arrivalNos).size !== arrivalNos.length) {
      throw new BadRequestException('같은 입하를 한 의뢰에 두 번 넣을 수 없습니다.');
    }
    const arrivals = await this.arrivalRepo.find({
      where: { arrivalNo: In(arrivalNos), itemCode, iqcStatus: 'PENDING', ...this.tenant(company, plant) },
    });
    if (arrivals.length !== arrivalNos.length) {
      throw new BadRequestException('PENDING 입하가 아니거나 품목이 다른 행이 있습니다.');
    }
    if (arrivals.some((a) => a.itemCode !== itemCode)) {
      throw new BadRequestException('검사의뢰 LOT은 한 품목만 구성할 수 있습니다.');
    }
    const taken = await this.listCandidates(itemCode, company, plant);
    const free = new Set(taken.map((t) => t.arrivalNo));
    for (const no of arrivalNos) {
      if (!free.has(no)) {
        throw new BadRequestException(`입하 ${no} 는 이미 다른 의뢰 LOT에 포함되어 있습니다.`);
      }
    }
    const item = await this.itemRepo.findOne({ where: { itemCode, ...this.tenant(company, plant) } });
    const lotQty = arrivals.reduce((sum, a) => sum + (Number(a.qty) || 0), 0);
    if (lotQty <= 0) {
      throw new BadRequestException('모집단 수량이 0입니다.');
    }
    const requestNo = await this.numbering.next('IQC_REQUEST_LOT');
    const invoices = [...new Set(arrivals.map((a) => a.invoiceNo).filter(Boolean))];
    const header = this.requestRepo.create({
      requestNo,
      itemCode,
      itemName: item?.itemName ?? null,
      vendorCode: arrivals[0].vendorCode,
      invoiceNo: dto.invoiceNo?.trim() || invoices[0] || null,
      lotQty,
      sampleQty: dto.sampleQty ?? null,
      status: 'REQUESTED',
      remark: dto.remark ?? null,
      company,
      plant,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });
    await this.requestRepo.save(header);
    const byNo = new Map(arrivals.map((a) => [a.arrivalNo, a]));
    const lines = dto.lines.map((line, idx) =>
      this.lineRepo.create({
        requestNo,
        seq: idx + 1,
        arrivalNo: line.arrivalNo,
        itemCode,
        qty: Number(byNo.get(line.arrivalNo)?.qty) || 0,
        lineRole: line.lineRole,
        invoiceNo: byNo.get(line.arrivalNo)?.invoiceNo ?? null,
        company,
        plant,
      }),
    );
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

  async inspect(requestNo: string, dto: InspectIqcRequestLotDto, company?: string, plant?: string) {
    const header = await this.requestRepo.findOne({
      where: { requestNo, ...this.tenant(company, plant) },
    });
    if (!header) throw new NotFoundException(`의뢰 LOT이 없습니다: ${requestNo}`);
    if (header.status !== 'REQUESTED') {
      throw new BadRequestException('이미 판정되었거나 취소된 의뢰입니다.');
    }
    const lines = await this.lineRepo.find({
      where: { requestNo, ...this.tenant(company, plant) },
      order: { seq: 'ASC' },
    });
    const sample = lines.find((l) => l.lineRole === 'SAMPLE');
    const result = await this.iqcHistory.applyIqcVerdictToArrivals(
      {
        arrivalNo: sample?.arrivalNo ?? lines[0].arrivalNo,
        arrivalNos: lines.map((l) => l.arrivalNo),
        itemCode: header.itemCode,
        lotQty: header.lotQty,
        result: dto.result,
        inspectorName: dto.inspectorName,
        remark: dto.remark,
        details: dto.details,
        sampleQty: dto.sampleQty ?? header.sampleQty ?? undefined,
        inspectType: dto.inspectType,
        logRemark: `[IQL:${requestNo}] ${dto.remark ?? ''}`.trim(),
      },
      company,
      plant,
    );
    header.status = result.result;
    header.sampleQty = dto.sampleQty ?? header.sampleQty;
    await this.requestRepo.save(header);
    return { request: { ...header, lines }, inspect: result };
  }
}
