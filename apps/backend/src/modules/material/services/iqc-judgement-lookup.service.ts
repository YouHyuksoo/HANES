/**
 * @file iqc-judgement-lookup.service.ts
 * @description 입하 행에서 IQC 판정을 되찾는 단일 경로.
 *
 * 초보자 가이드:
 * 1. 수입검사의 검사 단위는 세 가지다. 자재 시리얼 단건 / 입하번호+품목 / 검사의뢰.
 *    셋 중 무엇이든 판정은 1건이고, 그 판정이 덮은 입하 행은 `IQC_LOG_TARGETS`에 남는다.
 * 2. **`IQC_LOGS.ARRIVAL_NO`로 판정을 찾지 말 것.** 대표값 한 개라서 검사의뢰 판정에서
 *    대표 입하 행을 잃는다. 역추적은 항상 이 서비스를 거친다. ADR 0004 참고.
 * 3. 검사 단위가 하나 더 늘어도 호출부는 그대로 두고 판정 저장 쪽만 대상 행을 채우면 된다.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { IqcLogTarget } from '../../../entities/iqc-log-target.entity';

/** 판정 조회 대상 입하 행. arrivalSeq를 주면 그 행만, 없으면 입하번호+품목 전체를 본다. */
export interface ArrivalRowRef {
  arrivalNo: string;
  itemCode: string;
  arrivalSeq?: number | null;
}

export interface JudgementFilter {
  /** 'PASS' | 'FAIL' */
  result?: string;
  /** 기본 'DONE'. 취소된 판정(CANCELED)은 유효한 판정이 아니다. */
  status?: string | null;
}

@Injectable()
export class IqcJudgementLookupService {
  constructor(
    @InjectRepository(IqcLog)
    private readonly iqcLogRepository: Repository<IqcLog>,
    @InjectRepository(IqcLogTarget)
    private readonly iqcLogTargetRepository: Repository<IqcLogTarget>,
  ) {}

  /**
   * 입하 행들을 덮은 판정을 최신순으로 돌려준다.
   * 반환 원소의 `targetArrivalNo`/`targetArrivalSeq`는 어떤 입하 행 때문에 걸렸는지다.
   */
  async findByArrivalRows(
    rows: ArrivalRowRef[],
    filter: JudgementFilter = {},
    company?: string,
    plant?: string,
  ): Promise<Array<IqcLog & { targetArrivalNo: string; targetArrivalSeq: number; targetItemCode: string }>> {
    if (rows.length === 0) return [];
    const status = filter.status === null ? null : (filter.status ?? 'DONE');

    const qb = this.iqcLogTargetRepository
      .createQueryBuilder('tgt')
      .innerJoinAndMapOne(
        'tgt.log',
        IqcLog,
        'iqc',
        'iqc.inspectDate = tgt.inspectDate AND iqc.seq = tgt.seq AND iqc.company = tgt.company AND iqc.plant = tgt.plant',
      )
      .where('tgt.arrivalNo IN (:...arrivalNos)', { arrivalNos: [...new Set(rows.map((r) => r.arrivalNo))] })
      .andWhere('tgt.itemCode IN (:...itemCodes)', { itemCodes: [...new Set(rows.map((r) => r.itemCode))] });

    const seqs = rows.map((r) => r.arrivalSeq).filter((s): s is number => Number(s) > 0);
    // 행 단위로 좁혀 달라고 했고 모든 행이 seq를 준 경우에만 seq 조건을 건다.
    if (seqs.length > 0 && seqs.length === rows.length) {
      qb.andWhere('tgt.arrivalSeq IN (:...arrivalSeqs)', { arrivalSeqs: [...new Set(seqs)] });
    }
    if (filter.result) qb.andWhere('iqc.result = :result', { result: filter.result });
    if (status) qb.andWhere('iqc.status = :status', { status });
    if (company) qb.andWhere('tgt.company = :company', { company });
    if (plant) qb.andWhere('tgt.plant = :plant', { plant });
    qb.orderBy('iqc.inspectDate', 'DESC').addOrderBy('iqc.seq', 'DESC');

    const raw = await qb.getMany();
    return raw
      .map((t) => {
        const log = (t as IqcLogTarget & { log?: IqcLog }).log;
        if (!log) return null;
        return Object.assign({}, log, {
          targetArrivalNo: t.arrivalNo,
          targetArrivalSeq: t.arrivalSeq,
          targetItemCode: t.itemCode,
        });
      })
      .filter((v): v is IqcLog & { targetArrivalNo: string; targetArrivalSeq: number; targetItemCode: string } => v !== null);
  }

  /** 입하 행 하나를 덮은 최신 판정. 없으면 null. */
  async findLatestByArrivalRow(
    row: ArrivalRowRef,
    filter: JudgementFilter = {},
    company?: string,
    plant?: string,
  ): Promise<IqcLog | null> {
    const found = await this.findByArrivalRows([row], filter, company, plant);
    return found[0] ?? null;
  }

  /**
   * `${arrivalNo}::${itemCode}` 키로 최신 판정을 묶어 돌려준다.
   * 목록 화면에서 입하건별 판정을 한 번에 붙일 때 쓴다(N+1 방지).
   */
  async mapLatestByArrivalItem(
    rows: ArrivalRowRef[],
    filter: JudgementFilter = {},
    company?: string,
    plant?: string,
  ): Promise<Map<string, IqcLog>> {
    const found = await this.findByArrivalRows(rows, filter, company, plant);
    const map = new Map<string, IqcLog>();
    for (const log of found) {
      const key = `${log.targetArrivalNo}::${log.targetItemCode}`;
      if (!map.has(key)) map.set(key, log);
    }
    return map;
  }
}
