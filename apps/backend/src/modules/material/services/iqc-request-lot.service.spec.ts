import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IqcRequestLot } from '../../../entities/iqc-request-lot.entity';
import { IqcRequestLotLine } from '../../../entities/iqc-request-lot-line.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { IqcRequestLotService } from './iqc-request-lot.service';

describe('IqcRequestLotService', () => {
  let target: IqcRequestLotService;
  let arrivalRepo: DeepMocked<Repository<MatArrival>>;
  let requestRepo: DeepMocked<Repository<IqcRequestLot>>;
  let lineRepo: DeepMocked<Repository<IqcRequestLotLine>>;
  let itemRepo: DeepMocked<Repository<ItemMaster>>;
  let numbering: DeepMocked<NumberingService>;
  let sysConfig: DeepMocked<SysConfigService>;
  let candidateQb: { getRawMany: jest.Mock } & Record<string, jest.Mock>;

  /** listCandidates 가 돌려줄 후보 행. qty 는 MAT_ARRIVALS.QTY 가 아니라 검사대기 시리얼 INIT_QTY 합이다. */
  const mockCandidates = (
    rows: Array<{ arrivalNo: string; seq: number; itemCode: string; qty: number; serialCount?: number; invoiceNo?: string | null; vendorCode?: string | null }>,
  ) => {
    candidateQb.getRawMany.mockResolvedValue(
      rows.map((r) => ({
        arrivalNo: r.arrivalNo,
        seq: r.seq,
        itemCode: r.itemCode,
        invoiceNo: r.invoiceNo ?? 'INV-1',
        vendorCode: r.vendorCode ?? 'V1',
        vendorName: 'Vendor',
        arrivalDate: null,
        iqcStatus: 'PENDING',
        qty: String(r.qty),
        serialCount: String(r.serialCount ?? 1),
      })),
    );
  };

  beforeEach(async () => {
    arrivalRepo = createMock<Repository<MatArrival>>();
    requestRepo = createMock<Repository<IqcRequestLot>>();
    lineRepo = createMock<Repository<IqcRequestLotLine>>();
    itemRepo = createMock<Repository<ItemMaster>>();
    numbering = createMock<NumberingService>();
    sysConfig = createMock<SysConfigService>();
    // 기본은 의뢰 LOT 모드. ARRIVAL 모드 가드는 별도 케이스에서 확인한다.
    sysConfig.getValue.mockResolvedValue('REQUEST');
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    lineRepo.createQueryBuilder.mockReturnValue(qb as never);
    candidateQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    arrivalRepo.createQueryBuilder.mockReturnValue(candidateQb as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcRequestLotService,
        { provide: getRepositoryToken(IqcRequestLot), useValue: requestRepo },
        { provide: getRepositoryToken(IqcRequestLotLine), useValue: lineRepo },
        { provide: getRepositoryToken(MatArrival), useValue: arrivalRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemRepo },
        { provide: NumberingService, useValue: numbering },
        { provide: SysConfigService, useValue: sysConfig },
      ],
    }).compile();
    target = module.get(IqcRequestLotService);
  });

  it('IQC_INSPECT_LOT_MODE가 ARRIVAL이면 의뢰 생성을 거절한다', async () => {
    // ARRIVAL 모드에서 만든 의뢰는 검사대기 목록에 뜨지 않아 REQUESTED로 영구 잔존한다.
    sysConfig.getValue.mockResolvedValue('ARRIVAL');
    await expect(
      target.create(
        { itemCode: 'P1', lines: [{ arrivalNo: 'A1', arrivalSeq: 1, lineRole: 'SAMPLE' }] },
        '40',
        '1000',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    // 모드 가드는 다른 검증보다 먼저 돈다 — 입하 조회까지 가지 않는다
    expect(arrivalRepo.find).not.toHaveBeenCalled();
  });

  it('IQC_INSPECT_LOT_MODE 미설정이면 ARRIVAL로 보고 거절한다', async () => {
    sysConfig.getValue.mockResolvedValue(null);
    await expect(
      target.create(
        { itemCode: 'P1', lines: [{ arrivalNo: 'A1', arrivalSeq: 1, lineRole: 'SAMPLE' }] },
        '40',
        '1000',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('시료 없이 구성하면 거절한다', async () => {
    await expect(
      target.create(
        { itemCode: 'P1', lines: [{ arrivalNo: 'A1', arrivalSeq: 1, lineRole: 'REPRESENTED' }] },
        '40',
        '1000',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('한 품목 입하를 시료+대표로 묶고 의뢰번호를 채번한다', async () => {
    numbering.next.mockResolvedValue('IQL20260915-0001');
    arrivalRepo.find.mockResolvedValue([
      { arrivalNo: 'A1', seq: 1, itemCode: 'P1', qty: 100, iqcStatus: 'PENDING', vendorCode: 'V1', invoiceNo: 'INV-1' } as MatArrival,
      { arrivalNo: 'A2', seq: 1, itemCode: 'P1', qty: 200, iqcStatus: 'PENDING', vendorCode: 'V1', invoiceNo: 'INV-1' } as MatArrival,
    ]);
    // MAT_ARRIVALS.QTY 는 100/200 인데 실제 검사대기 시리얼 합은 300/600 인 1:N 케이스(실데이터 409건 중 18건).
    // 모집단은 시리얼 합 기준이어야 한다.
    mockCandidates([
      { arrivalNo: 'A1', seq: 1, itemCode: 'P1', qty: 300 },
      { arrivalNo: 'A2', seq: 1, itemCode: 'P1', qty: 600 },
    ]);
    itemRepo.findOne.mockResolvedValue({ itemCode: 'P1', itemName: 'Cable' } as ItemMaster);
    requestRepo.create.mockImplementation((v) => v as IqcRequestLot);
    requestRepo.save.mockImplementation(async (v) => v as IqcRequestLot);
    lineRepo.create.mockImplementation((v) => v as IqcRequestLotLine);
    lineRepo.save.mockResolvedValue([] as never);

    const saved = await target.create(
      {
        itemCode: 'P1',
        lines: [
          { arrivalNo: 'A1', arrivalSeq: 1, lineRole: 'SAMPLE' },
          { arrivalNo: 'A2', arrivalSeq: 1, lineRole: 'REPRESENTED' },
        ],
      },
      '40',
      '1000',
    );
    expect(saved.requestNo).toBe('IQL20260915-0001');
    // 입하수량 합(300)이 아니라 검사대기 시리얼 합(900)이다
    expect(saved.lotQty).toBe(900);
    expect(saved.lines.map((l) => l.qty)).toEqual([300, 600]);
    expect(saved.lines).toHaveLength(2);
  });

  // 실데이터 재현: MAT_ARRIVALS PK는 (ARRIVAL_NO, SEQ) 복합키라 같은 ARRIVAL_NO가 여러 행 존재한다.
  // JSHANES 예: 품목 1SH21A7A09의 PENDING 입하 60행이 전부 ARRIVAL_NO='R26090900001'(SEQ 1~60).
  it('같은 입하번호의 서로 다른 SEQ 행을 모집단으로 묶는다', async () => {
    numbering.next.mockResolvedValue('IQL20260916-0001');
    const rows = Array.from({ length: 60 }, (_, i) =>
      ({
        arrivalNo: 'R26090900001',
        seq: i + 1,
        itemCode: '1SH21A7A09',
        qty: 100,
        iqcStatus: 'PENDING',
        vendorCode: 'V1',
        invoiceNo: 'INV-R26090900001',
      }) as MatArrival,
    );
    arrivalRepo.find.mockResolvedValue(rows);
    mockCandidates(rows.map((r) => ({ arrivalNo: r.arrivalNo, seq: r.seq, itemCode: r.itemCode, qty: 100 })));
    itemRepo.findOne.mockResolvedValue({ itemCode: '1SH21A7A09', itemName: 'SHIELD' } as ItemMaster);
    requestRepo.create.mockImplementation((v) => v as IqcRequestLot);
    requestRepo.save.mockImplementation(async (v) => v as IqcRequestLot);
    lineRepo.create.mockImplementation((v) => v as IqcRequestLotLine);
    lineRepo.save.mockResolvedValue([] as never);

    const saved = await target.create(
      {
        itemCode: '1SH21A7A09',
        lines: [
          { arrivalNo: 'R26090900001', arrivalSeq: 1, lineRole: 'SAMPLE' },
          { arrivalNo: 'R26090900001', arrivalSeq: 2, lineRole: 'REPRESENTED' },
          { arrivalNo: 'R26090900001', arrivalSeq: 3, lineRole: 'REPRESENTED' },
        ],
      },
      '40',
      '1000',
    );

    expect(saved.lotQty).toBe(300);
    expect(saved.lines).toHaveLength(3);
    expect(saved.lines.map((l) => l.arrivalSeq)).toEqual([1, 2, 3]);
  });

  it('같은 입하 행(ARRIVAL_NO+SEQ)을 두 번 넣으면 거절한다', async () => {
    await expect(
      target.create(
        {
          itemCode: '1SH21A7A09',
          lines: [
            { arrivalNo: 'R26090900001', arrivalSeq: 1, lineRole: 'SAMPLE' },
            { arrivalNo: 'R26090900001', arrivalSeq: 1, lineRole: 'REPRESENTED' },
          ],
        },
        '40',
        '1000',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
