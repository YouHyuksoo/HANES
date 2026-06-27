import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { CreatePrdLabelsDto, PrdLabelResultDto } from '../dto/product-label.dto';

@Injectable()
export class ProductLabelService {
  constructor(
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
    @InjectRepository(ProdResult)
    private readonly prodResultRepo: Repository<ProdResult>,
    @InjectRepository(ItemMaster)
    private readonly partRepo: Repository<ItemMaster>,
  ) {}

  private assertSameTenant(
    context: string,
    row: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && row.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row.company ?? 'NULL'}`);
    }
    if (plant && row.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row.plant ?? 'NULL'}`);
    }
  }

  async findLabelableResults(company?: string, plant?: string) {
    const results = await this.prodResultRepo.find({
      where: { prdUid: IsNull(), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['jobOrder', 'jobOrder.part'],
      order: { createdAt: 'DESC' },
    });
    return this.enrichWithPartInfo(results);
  }

  async findLabelableOqcPassed(company?: string, plant?: string) {
    const qb = this.prodResultRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.jobOrder', 'jo')
      .leftJoinAndSelect('jo.part', 'part')
      .innerJoin('r.inspectResults', 'ir', 'ir.result = :result', { result: 'PASS' })
      .where('r.prdUid IS NULL')
      .orderBy('r.createdAt', 'DESC');

    if (company) {
      qb.andWhere('r.company = :company', { company });
    }
    if (plant) {
      qb.andWhere('r.plant = :plant', { plant });
    }

    const results = await qb.getMany();
    return this.enrichWithPartInfo(results);
  }

  async createPrdLabels(
    dto: CreatePrdLabelsDto,
    company?: string,
    plant?: string,
  ): Promise<PrdLabelResultDto[]> {
    const prodResult = await this.prodResultRepo.findOne({
      where: {
        resultNo: String(dto.sourceId),
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      relations: ['jobOrder'],
    });

    if (!prodResult) {
      throw new NotFoundException('Production result not found');
    }
    this.assertSameTenant('제품라벨 생산실적', prodResult, company, plant);

    const itemCode = prodResult.jobOrder?.itemCode ?? '';
    const part = itemCode
      ? await this.partRepo.findOne({
          where: {
            itemCode,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        })
      : null;

    return this.tx.run(async (queryRunner) => {
      const results: PrdLabelResultDto[] = [];

      if (prodResult.prdUid && dto.qty !== 1) {
        throw new BadRequestException('이미 제품 UID가 발행된 생산실적은 1장 재발행만 가능합니다.');
      }

      const uids = prodResult.prdUid
        ? [prodResult.prdUid]
        : await Promise.all(Array.from({ length: dto.qty }, () => this.numbering.nextPrdUid(queryRunner)));

      for (const prdUid of uids) {
        results.push({
          prdUid,
          itemCode,
          itemName: part?.itemName ?? '',
        });

        const existingLabel = await queryRunner.manager.findOne(FgLabel, {
          where: {
            fgBarcode: prdUid,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        });

        if (!existingLabel) {
          await queryRunner.manager.save(
            FgLabel,
            queryRunner.manager.create(FgLabel, {
              fgBarcode: prdUid,
              itemCode,
              orderNo: prodResult.orderNo,
              equipCode: prodResult.equipCode,
              workerId: prodResult.workerId,
              lineCode: prodResult.jobOrder?.lineCode,
              status: 'ISSUED',
              inspectPassYn: 'Y',
              company: prodResult.company,
              plant: prodResult.plant,
            }),
          );
        }
      }

      if (dto.qty === 1 && !prodResult.prdUid) {
        await queryRunner.manager.update(
          ProdResult,
          {
            resultNo: prodResult.resultNo,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          { prdUid: results[0].prdUid },
        );
      }

      const log = queryRunner.manager.create(LabelPrintLog, {
        printedAt: new Date(),
        category: 'prd_uid',
        printMode: 'BROWSER',
        uidList: JSON.stringify(results.map((r) => r.prdUid)),
        labelCount: dto.qty,
        status: 'SUCCESS',
        company: prodResult.company,
        plant: prodResult.plant,
      });
      await queryRunner.manager.save(log);

      return results;
    });
  }

  private enrichWithPartInfo(results: ProdResult[]) {
    return results.map((r) => {
      const itemCode = r.jobOrder?.itemCode ?? '';
      const part = r.jobOrder?.part;
      return {
        id: r.resultNo,
        orderNo: r.orderNo,
        itemCode,
        itemName: part?.itemName ?? '',
        goodQty: r.goodQty,
        prdUid: r.prdUid,
        createdAt: r.createdAt,
      };
    });
  }
}
