/**
 * @file production/services/label-reprint.service.ts
 * @description 반제품(SG)·완제품(FG) 라벨 재발행.
 *
 * 초보자 가이드:
 * 1. SG 라벨은 실적입력(가공) 저장 직후, FG 라벨은 실적입력(조립) 발행 시 각각 1회만 출력된다.
 *    이후 라벨이 훼손·분실되면 다시 뽑을 화면이 없어 현장 대응이 안 됐다(자재·소모품·박스 라벨은 재발행이 있다).
 * 2. 조회는 발행일(SG: ISSUED_AT, FG: ISSUED_AT) 구간으로 한다 — 이력성 목록이라 전량 조회를 하지 않는다.
 * 3. 재발행 기록:
 *    - FG 는 FG_LABELS.REPRINT_COUNT 를 올린다(기존 컬럼).
 *    - SG 는 전용 컬럼이 없어 LABEL_PRINT_LOGS 에 남긴다. 두 유형 모두 LABEL_PRINT_LOGS 에 적재해
 *      "언제 누가 무엇을 다시 뽑았는지"가 한 곳에서 보이게 한다.
 * 4. 취소(VOIDED) 라벨은 재발행하지 않는다 — 폐기된 식별자를 현장에 다시 내보내지 않기 위함이다.
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { SgLabel } from '../../../entities/sg-label.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';

export type ReprintLabelType = 'SG' | 'FG';

export interface LabelReprintQuery {
  labelType: ReprintLabelType;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

@Injectable()
export class LabelReprintService {
  constructor(
    @InjectRepository(SgLabel)
    private readonly sgLabelRepo: Repository<SgLabel>,
    @InjectRepository(FgLabel)
    private readonly fgLabelRepo: Repository<FgLabel>,
    @InjectRepository(LabelPrintLog)
    private readonly printLogRepo: Repository<LabelPrintLog>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  /** 재발행 대상 라벨 목록 — 발행일 구간 기준(기본은 호출자가 당일로 준다). */
  async findLabels(query: LabelReprintQuery, company?: string, plant?: string) {
    const from = parseDateStart(query.fromDate);
    const to = parseDateEnd(query.toDate);
    const issuedAt = from && to ? Between(from, to) : undefined;
    const keyword = query.search?.trim();

    if (query.labelType === 'SG') {
      const qb = this.sgLabelRepo.createQueryBuilder('sg').orderBy('sg.issuedAt', 'DESC').take(500);
      if (company) qb.andWhere('sg.company = :company', { company });
      if (plant) qb.andWhere('sg.plant = :plant', { plant });
      if (issuedAt) qb.andWhere('sg.issuedAt BETWEEN :from AND :to', { from, to });
      if (keyword) {
        qb.andWhere(
          '(sg.sgBarcode LIKE :kw OR sg.itemCode LIKE :kw OR sg.orderNo LIKE :kw)',
          { kw: `%${keyword}%` },
        );
      }
      const rows = await qb.getMany();
      return rows.map((row) => ({
        labelType: 'SG' as const,
        barcode: row.sgBarcode,
        itemCode: row.itemCode,
        orderNo: row.orderNo,
        qty: row.initQty,
        processCode: row.issueProcessCode,
        status: row.status,
        issuedAt: row.issuedAt,
        reprintCount: null as number | null,
      }));
    }

    const qb = this.fgLabelRepo.createQueryBuilder('fg').orderBy('fg.issuedAt', 'DESC').take(500);
    if (company) qb.andWhere('fg.company = :company', { company });
    if (plant) qb.andWhere('fg.plant = :plant', { plant });
    if (issuedAt) qb.andWhere('fg.issuedAt BETWEEN :from AND :to', { from, to });
    if (keyword) {
      qb.andWhere(
        '(fg.fgBarcode LIKE :kw OR fg.itemCode LIKE :kw OR fg.orderNo LIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }
    const rows = await qb.getMany();
    return rows.map((row) => ({
      labelType: 'FG' as const,
      barcode: row.fgBarcode,
      itemCode: row.itemCode,
      orderNo: row.orderNo,
      qty: null as number | null,
      processCode: null as string | null,
      status: row.status,
      issuedAt: row.issuedAt,
      reprintCount: row.reprintCount,
    }));
  }

  /**
   * 재발행 확정 — 대상 검증 + 이력 적재 후 출력용 데이터를 돌려준다.
   * 실제 인쇄는 화면(프린트 호스트)이 한다. 여기서 이력을 먼저 남겨 "뽑았는데 기록이 없다"를 막는다.
   */
  async reprint(
    labelType: ReprintLabelType,
    barcodes: string[],
    workerId?: string,
    company?: string,
    plant?: string,
  ) {
    const targets = [...new Set(barcodes.map((b) => b.trim()).filter(Boolean))];
    if (targets.length === 0) {
      throw new BadRequestException('재발행할 라벨을 선택하세요.');
    }

    const tenant = this.tenantWhere(company, plant);

    if (labelType === 'SG') {
      const rows = await this.sgLabelRepo.find({ where: { sgBarcode: In(targets), ...tenant } });
      this.assertAllFound(targets, rows.map((r) => r.sgBarcode));
      const voided = rows.filter((r) => r.status === 'VOIDED').map((r) => r.sgBarcode);
      if (voided.length > 0) {
        throw new BadRequestException(`취소된 라벨은 재발행할 수 없습니다: ${voided.join(', ')}`);
      }

      await this.writePrintLog('SG', targets, workerId, company, plant);
      return rows.map((row) => ({
        barcode: row.sgBarcode,
        itemCode: row.itemCode,
        orderNo: row.orderNo,
        qty: row.initQty,
        processCode: row.issueProcessCode,
      }));
    }

    const rows = await this.fgLabelRepo.find({ where: { fgBarcode: In(targets), ...tenant } });
    this.assertAllFound(targets, rows.map((r) => r.fgBarcode));
    const voided = rows.filter((r) => r.status === 'VOIDED').map((r) => r.fgBarcode);
    if (voided.length > 0) {
      throw new BadRequestException(`취소된 라벨은 재발행할 수 없습니다: ${voided.join(', ')}`);
    }

    // FG 는 전용 카운터가 있다 — 화면·이력 양쪽에서 재발행 횟수를 볼 수 있게 함께 올린다.
    for (const row of rows) {
      row.reprintCount = (row.reprintCount ?? 0) + 1;
    }
    await this.fgLabelRepo.save(rows);

    await this.writePrintLog('FG', targets, workerId, company, plant);
    return rows.map((row) => ({
      barcode: row.fgBarcode,
      itemCode: row.itemCode,
      orderNo: row.orderNo,
      qty: null,
      processCode: null,
    }));
  }

  private assertAllFound(requested: string[], found: string[]): void {
    const missing = requested.filter((b) => !found.includes(b));
    if (missing.length > 0) {
      throw new NotFoundException(`라벨을 찾을 수 없습니다: ${missing.join(', ')}`);
    }
  }

  private async writePrintLog(
    category: ReprintLabelType,
    barcodes: string[],
    workerId?: string,
    company?: string,
    plant?: string,
  ): Promise<void> {
    // PRINTED_AT + SEQ 가 복합 PK 다 — 엔티티에 default 가 있어도 INSERT 시 값을 채워야 한다.
    // 같은 타임스탬프에 여러 건이 들어올 수 있으므로 SEQ 로 분리한다.
    const printedAt = new Date();
    const sameInstant = await this.printLogRepo.count({ where: { printedAt } });

    const log = this.printLogRepo.create({
      printedAt,
      seq: sameInstant + 1,
      category,
      printMode: 'REPRINT',
      uidList: barcodes.join(','),
      labelCount: barcodes.length,
      workerId: workerId ?? null,
      status: 'SUCCESS',
      company: company ?? null,
      plant: plant ?? null,
    } as Partial<LabelPrintLog>);
    await this.printLogRepo.save(log);
  }
}
