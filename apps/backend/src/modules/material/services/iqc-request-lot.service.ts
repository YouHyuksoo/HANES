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
import { EntityManager, In, QueryRunner, Repository } from 'typeorm';
import { IQC_INSPECT_LOT_MODE_KEY, allowsIqcRequestLot } from '@harness/shared';
import { IqcRequestLot } from '../../../entities/iqc-request-lot.entity';
import { IqcRequestLotLine } from '../../../entities/iqc-request-lot-line.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { SysConfigService } from '../../system/services/sys-config.service';
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
    private readonly sysConfigService: SysConfigService,
    private readonly tx: TransactionService,
  ) {}

  /**
   * 의뢰 LOT 구성이 허용되는 모드인지 확인한다.
   *
   * ARRIVAL 모드에서 의뢰를 만들면 `/material/iqc` 검사대기 목록이 의뢰 LOT을 조회하지 않아
   * 의뢰가 REQUESTED 상태로 영구 잔존한다. 그 사이 같은 입하 행은 입하단위로 판정되어
   * MAT_LOTS/MAT_ARRIVALS만 PASS/FAIL이 되고 의뢰 헤더는 갱신되지 않는다.
   * 그래서 모드가 REQUEST가 아니면 생성 자체를 막는다.
   */
  private async assertRequestLotModeEnabled(company?: string, plant?: string) {
    const mode = await this.sysConfigService.getValue(IQC_INSPECT_LOT_MODE_KEY, company, plant);
    if (!allowsIqcRequestLot(mode)) {
      throw new BadRequestException(
        `IQC 검사 단위가 입하단위(ARRIVAL)입니다. 검사의뢰 LOT을 쓰려면 시스템설정에서 ${IQC_INSPECT_LOT_MODE_KEY}를 REQUEST로 바꾸세요.`,
      );
    }
  }

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

  /**
   * 의뢰 구성 후보 입하 행.
   *
   * 수량은 MAT_ARRIVALS.QTY가 아니라 그 행에 달린 검사대기(PENDING) 시리얼의 INIT_QTY 합이다.
   * 두 값은 갈라진다(2026-09-16 실측: 409건 중 18건). 입하 1행에 시리얼이 여러 건 달리고
   * 그 합이 입하수량과 다른 1:N 케이스가 있기 때문이다.
   *
   * 모집단(LOT_QTY)·검사대기 목록 표시 수량·실제 판정 대상이 모두 같은 기준이어야 하므로
   * 여기서부터 시리얼 합으로 통일한다. 시리얼이 한 건도 없는 입하 행은 검사할 대상이 없으므로
   * 후보에서 빠진다(MAT_ARRIVALS는 PENDING인데 MAT_LOTS는 CANCELED인 데이터가 실제로 있다).
   */
  async listCandidates(itemCode: string, company?: string, plant?: string) {
    if (!itemCode?.trim()) {
      throw new BadRequestException('품목코드를 지정하세요.');
    }
    return this.loadCandidates(this.arrivalRepo.manager, itemCode.trim(), company, plant);
  }

  /**
   * 후보 조회 본체. 목록 화면과 의뢰 확정(트랜잭션 안)이 **같은 manager로 같은 기준**을 쓰게 한다.
   *
   * 확정 시점에는 트랜잭션의 manager를 넘겨야 한다. 기본 커넥션으로 읽으면 잠근 행이 아니라
   * 잠그기 전 스냅샷을 보게 되어 선점 검사가 무의미해진다.
   */
  private async loadCandidates(manager: EntityManager, itemCode: string, company?: string, plant?: string) {
    // 주의: 조인 조건 문자열에 줄바꿈을 넣지 말 것. TypeORM이 alias.프로퍼티를 못 풀어 ORA-00904가 난다.
    const arrivals = manager
      .createQueryBuilder(MatArrival, 'a')
      .innerJoin(MatLot, 'lot', "lot.arrivalNo = a.arrivalNo AND lot.arrivalSeq = a.seq AND lot.itemCode = a.itemCode AND lot.company = a.company AND lot.plant = a.plant AND lot.iqcStatus = 'PENDING'")
      .select('a.arrivalNo', 'arrivalNo')
      .addSelect('a.seq', 'seq')
      .addSelect('a.itemCode', 'itemCode')
      .addSelect('a.invoiceNo', 'invoiceNo')
      .addSelect('a.vendorCode', 'vendorCode')
      .addSelect('a.vendorName', 'vendorName')
      .addSelect('a.arrivalDate', 'arrivalDate')
      .addSelect('a.iqcStatus', 'iqcStatus')
      .addSelect('SUM(lot.initQty)', 'qty')
      .addSelect('COUNT(*)', 'serialCount')
      .where('a.itemCode = :itemCode', { itemCode })
      .andWhere("a.iqcStatus = 'PENDING'")
      .groupBy('a.arrivalNo')
      .addGroupBy('a.seq')
      .addGroupBy('a.itemCode')
      .addGroupBy('a.invoiceNo')
      .addGroupBy('a.vendorCode')
      .addGroupBy('a.vendorName')
      .addGroupBy('a.arrivalDate')
      .addGroupBy('a.iqcStatus')
      .orderBy('a.arrivalDate', 'DESC');
    if (company) arrivals.andWhere('a.company = :company', { company });
    if (plant) arrivals.andWhere('a.plant = :plant', { plant });
    const rows = await arrivals.getRawMany<{
      arrivalNo: string;
      seq: number;
      itemCode: string;
      invoiceNo: string | null;
      vendorCode: string | null;
      vendorName: string | null;
      arrivalDate: Date | null;
      iqcStatus: string;
      qty: string;
      serialCount: string;
    }>();
    if (rows.length === 0) return [];
    const takenSet = await this.loadTakenKeys(manager, itemCode, company, plant);
    return rows
      .map((r) => ({
        arrivalNo: r.arrivalNo,
        seq: Number(r.seq),
        itemCode: r.itemCode,
        /** 검사대기 시리얼 INIT_QTY 합. MAT_ARRIVALS.QTY가 아니다. */
        qty: Number(r.qty) || 0,
        serialCount: Number(r.serialCount) || 0,
        invoiceNo: r.invoiceNo,
        vendorCode: r.vendorCode,
        vendorName: r.vendorName,
        arrivalDate: r.arrivalDate,
        iqcStatus: r.iqcStatus,
      }))
      .filter((a) => !takenSet.has(IqcRequestLotService.arrivalKey(a.arrivalNo, a.seq)));
  }

  /**
   * 이미 다른 의뢰(REQUESTED)에 선점된 입하 행 키 집합.
   *
   * 판정이 끝났거나(PASS/FAIL) 취소된 의뢰의 라인은 선점으로 보지 않는다. 그 행은 다시 의뢰할 수 있다.
   * 그래서 이 조건을 라인 테이블의 유니크 제약으로 대체할 수 없다 — 헤더 상태에 의존하기 때문이다.
   */
  private async loadTakenKeys(manager: EntityManager, itemCode: string, company?: string, plant?: string) {
    const taken = await manager
      .createQueryBuilder(IqcRequestLotLine, 'ln')
      .innerJoin(IqcRequestLot, 'rq', 'rq.requestNo = ln.requestNo')
      .where('ln.itemCode = :itemCode', { itemCode })
      .andWhere("rq.status = 'REQUESTED'")
      .andWhere('rq.company = :company', { company })
      .andWhere('rq.plant = :plant', { plant })
      .select(['ln.arrivalNo AS "arrivalNo"', 'ln.arrivalSeq AS "arrivalSeq"'])
      .getRawMany<{ arrivalNo: string; arrivalSeq: number }>();
    return new Set(taken.map((r) => IqcRequestLotService.arrivalKey(r.arrivalNo, Number(r.arrivalSeq))));
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
    await this.assertRequestLotModeEnabled(company, plant);
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
    const item = await this.itemRepo.findOne({ where: { itemCode, ...this.tenant(company, plant) } });

    // 선점 검사(read)와 선점 기록(write)을 한 트랜잭션에 넣고, 대상 입하 행을 FOR UPDATE로 잠근다.
    // 잠그지 않으면 동시 제출 두 건이 서로의 라인을 못 보고 둘 다 통과해 같은 입하 행을 담은
    // 의뢰가 2건 만들어진다(2026-09-17 실측: IQL20260917-0012 / -0013, 1초 간격).
    return this.tx.run(async (qr) => {
      await this.lockArrivalRows(qr, dto.lines, itemCode, company, plant);

      // 잠근 뒤 다시 읽는다. 앞선 트랜잭션이 커밋했다면 그 라인이 여기서 보인다.
      const candidates = await this.loadCandidates(qr.manager, itemCode, company, plant);
      const freeByKey = new Map(
        candidates.map((c) => [IqcRequestLotService.arrivalKey(c.arrivalNo, c.seq), c]),
      );
      for (const key of requestedKeys) {
        if (!freeByKey.has(key)) {
          throw new BadRequestException(`입하 행 ${key} 는 이미 다른 의뢰 LOT에 포함되어 있습니다.`);
        }
      }

      // 모집단은 후보 행의 검사대기 시리얼 합이다. MAT_ARRIVALS.QTY와 갈라지므로 입하수량을 쓰지 말 것.
      // 여기서 어긋나면 화면 표시 수량과 AQL 모집단이 달라진다.
      const selected = requestedKeys.map((k) => freeByKey.get(k)!);
      const lotQty = selected.reduce((sum, c) => sum + (Number(c.qty) || 0), 0);
      if (lotQty <= 0) {
        throw new BadRequestException('모집단 수량이 0입니다.');
      }
      const requestNo = await this.numbering.next('IQC_REQUEST_LOT', qr);
      const invoices = [...new Set(selected.map((a) => a.invoiceNo).filter(Boolean))];
      const header = qr.manager.create(IqcRequestLot, {
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
      await qr.manager.save(IqcRequestLot, header);
      const lines = dto.lines.map((line, idx) => {
        const candidate = freeByKey.get(IqcRequestLotService.arrivalKey(line.arrivalNo, line.arrivalSeq))!;
        return qr.manager.create(IqcRequestLotLine, {
          requestNo,
          seq: idx + 1,
          arrivalNo: line.arrivalNo,
          arrivalSeq: line.arrivalSeq,
          itemCode,
          // 헤더 LOT_QTY와 같은 기준(검사대기 시리얼 합)을 쓴다
          qty: Number(candidate.qty) || 0,
          lineRole: line.lineRole,
          invoiceNo: candidate.invoiceNo ?? null,
          company,
          plant,
        });
      });
      await qr.manager.save(IqcRequestLotLine, lines);
      return { ...header, lines };
    });
  }

  /**
   * 의뢰에 담을 입하 행을 FOR UPDATE로 잠근다. 같은 행을 노리는 동시 요청을 줄 세우는 유일한 장치다.
   *
   * 라인 테이블에 유니크 제약을 걸면 되지 않느냐 — 안 된다. 취소·판정 완료된 의뢰의 라인은 남아 있고
   * 그 입하 행은 다시 의뢰할 수 있어야 하는데, 유니크 제약은 그걸 영구히 막는다. 선점 여부는
   * 라인이 아니라 **헤더 상태**가 정하므로 잠금으로 직렬화한다.
   */
  private async lockArrivalRows(
    qr: QueryRunner,
    lines: CreateIqcRequestLotDto['lines'],
    itemCode: string,
    company: string,
    plant: string,
  ) {
    const params: unknown[] = [company, plant, itemCode];
    // 대상 행을 **한 문장**으로 모두 잠근다. 데드락은 여러 문장에 걸쳐 서로 다른 순서로
    // 잠글 때 생기므로, 한 문장으로 끝내면 그 위험이 없다(Oracle이 같은 접근 경로로 훑는다).
    // 바인드 순서는 (ARRIVAL_NO, SEQ)로 정렬해 문장을 결정적으로 만든다.
    const ordered = [...lines].sort(
      (a, b) => a.arrivalNo.localeCompare(b.arrivalNo) || a.arrivalSeq - b.arrivalSeq,
    );
    const tuples = ordered.map((l) => {
      params.push(l.arrivalNo, l.arrivalSeq);
      return `(:${params.length - 1}, :${params.length})`;
    });
    await qr.query(
      `SELECT ARRIVAL_NO FROM MAT_ARRIVALS
        WHERE COMPANY = :1 AND PLANT_CD = :2 AND ITEM_CODE = :3
          AND (ARRIVAL_NO, SEQ) IN (${tuples.join(', ')})
        FOR UPDATE`,
      params,
    );
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
