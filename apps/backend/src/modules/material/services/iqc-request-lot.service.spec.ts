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
import { IqcRequestLotService } from './iqc-request-lot.service';

describe('IqcRequestLotService', () => {
  let target: IqcRequestLotService;
  let arrivalRepo: DeepMocked<Repository<MatArrival>>;
  let requestRepo: DeepMocked<Repository<IqcRequestLot>>;
  let lineRepo: DeepMocked<Repository<IqcRequestLotLine>>;
  let itemRepo: DeepMocked<Repository<ItemMaster>>;
  let numbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    arrivalRepo = createMock<Repository<MatArrival>>();
    requestRepo = createMock<Repository<IqcRequestLot>>();
    lineRepo = createMock<Repository<IqcRequestLotLine>>();
    itemRepo = createMock<Repository<ItemMaster>>();
    numbering = createMock<NumberingService>();
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    lineRepo.createQueryBuilder.mockReturnValue(qb as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcRequestLotService,
        { provide: getRepositoryToken(IqcRequestLot), useValue: requestRepo },
        { provide: getRepositoryToken(IqcRequestLotLine), useValue: lineRepo },
        { provide: getRepositoryToken(MatArrival), useValue: arrivalRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemRepo },
        { provide: NumberingService, useValue: numbering },
      ],
    }).compile();
    target = module.get(IqcRequestLotService);
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
    arrivalRepo.find
      .mockResolvedValueOnce([
        { arrivalNo: 'A1', seq: 1, itemCode: 'P1', qty: 100, iqcStatus: 'PENDING', vendorCode: 'V1', invoiceNo: 'INV-1' } as MatArrival,
        { arrivalNo: 'A2', seq: 1, itemCode: 'P1', qty: 200, iqcStatus: 'PENDING', vendorCode: 'V1', invoiceNo: 'INV-1' } as MatArrival,
      ])
      .mockResolvedValueOnce([
        { arrivalNo: 'A1', seq: 1, itemCode: 'P1', qty: 100, iqcStatus: 'PENDING', vendorCode: 'V1', invoiceNo: 'INV-1' } as MatArrival,
        { arrivalNo: 'A2', seq: 1, itemCode: 'P1', qty: 200, iqcStatus: 'PENDING', vendorCode: 'V1', invoiceNo: 'INV-1' } as MatArrival,
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
    expect(saved.lotQty).toBe(300);
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
