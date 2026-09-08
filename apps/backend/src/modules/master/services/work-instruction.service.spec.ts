import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { WorkInstruction } from '../../../entities/work-instruction.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { WorkInstructionService } from './work-instruction.service';

describe('WorkInstructionService', () => {
  let target: WorkInstructionService;
  let mockRepo: DeepMocked<Repository<WorkInstruction>>;

  let qb: Record<string, jest.Mock>;
  let processRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    mockRepo = createMock<Repository<WorkInstruction>>();
    qb = Object.fromEntries(['leftJoinAndMapOne', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take'].map(key => [key, jest.fn().mockReturnThis()]));
    qb.getOne = jest.fn(); qb.getMany = jest.fn().mockResolvedValue([]); qb.getCount = jest.fn().mockResolvedValue(0);
    mockRepo.createQueryBuilder.mockReturnValue(qb as any);
    processRepo = { findOne: jest.fn().mockResolvedValue({ processCode: 'P10', processName: '조립', useYn: 'Y' }) };
    mockRepo.manager.getRepository.mockReturnValue(processRepo as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkInstructionService,
        { provide: getRepositoryToken(WorkInstruction), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<WorkInstructionService>(WorkInstructionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('목록과 상세는 tenant 일치 품목/공정명을 제공하고 품목명으로 검색한다', async () => {
    const row = { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', item: { itemName: '하네스' }, process: { processName: '조립' } };
    qb.getMany.mockResolvedValue([row]);
    qb.getCount.mockResolvedValue(1);
    qb.getOne.mockResolvedValue(row);
    const list = await target.findAll({ page: 1, limit: 10, search: '하네스', useYn: 'Y' }, 'C1', 'P1');
    expect(list.data[0]).toEqual({ itemCode: 'ITEM01', processCode: 'P10', revision: 'A', itemName: '하네스', processName: '조립' });
    expect(qb.leftJoinAndMapOne).toHaveBeenCalledWith('wi.item', ItemMaster, 'item', expect.stringContaining('item.company = wi.company AND item.plant = wi.plant'));
    expect(qb.leftJoinAndMapOne).toHaveBeenCalledWith('wi.process', ProcessMaster, 'process', expect.stringContaining('process.company = wi.company AND process.plant = wi.plant'));
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('UPPER(item.itemName) LIKE :searchCode'), expect.anything());
    expect(qb.andWhere).toHaveBeenCalledWith('wi.useYn = :useYn', { useYn: 'Y' });
    expect(await target.findById('ITEM01::P10::A', 'C1', 'P1')).toEqual(list.data[0]);
  });

  it('신규 저장시 다른 tenant 또는 미사용 공정은 거부한다', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    processRepo.findOne.mockResolvedValue(null);
    await expect(target.create({ itemCode: 'ITEM01', processCode: 'P10', title: 'Guide', revision: 'A' }, 'C1', 'P1')).rejects.toThrow(BadRequestException);
    expect(processRepo.findOne).toHaveBeenCalledWith({ where: { processCode: 'P10', company: 'C1', plant: 'P1', useYn: 'Y' } });
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('finds a work instruction within tenant only', async () => {
    const item = { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' } as WorkInstruction;
    qb.getOne.mockResolvedValue(item);

    const result = await target.findById('ITEM01::P10::A', 'C1', 'P1');

    expect(result).toEqual({ ...item, itemName: null, processName: null });
    expect(qb.where).toHaveBeenCalledWith({ itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' });
  });

  it('throws when tenant scoped work instruction is missing', async () => {
    qb.getOne.mockResolvedValue(null);

    await expect(target.findById('ITEM01::P10::A', 'C1', 'P1')).rejects.toThrow(NotFoundException);
  });

  it('creates a work instruction within tenant', async () => {
    const created = { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' } as WorkInstruction;
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    await target.create({ itemCode: 'ITEM01', processCode: 'P10', title: 'Guide', revision: 'A' } as any, 'C1', 'P1');

    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      itemCode: 'ITEM01',
      processCode: 'P10',
      revision: 'A',
      company: 'C1',
      plant: 'P1',
    }));
  });

  it('rejects duplicate item, process, and revision within tenant', async () => {
    mockRepo.findOne.mockResolvedValue({ itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' } as WorkInstruction);

    await expect(target.create({
      itemCode: 'ITEM01',
      processCode: 'P10',
      title: 'Guide',
      revision: 'A',
    } as any, 'C1', 'P1')).rejects.toThrow(ConflictException);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('updates a work instruction within tenant and strips key columns from payload', async () => {
    const item = { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', title: 'Old', company: 'C1', plant: 'P1' } as WorkInstruction;
    qb.getOne.mockResolvedValue(item);
    mockRepo.update.mockResolvedValue({ affected: 1 } as any);

    await target.update('ITEM01::P10::A', {
      itemCode: 'ITEM99',
      processCode: 'P99',
      revision: 'Z',
      title: 'New',
      company: 'C2',
      plant: 'P2',
    } as any, 'C1', 'P1');

    expect(mockRepo.update).toHaveBeenCalledWith(
      { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' },
      expect.not.objectContaining({
        itemCode: expect.anything(),
        processCode: expect.anything(),
        revision: expect.anything(),
        company: expect.anything(),
        plant: expect.anything(),
      }),
    );
  });

  it('deletes a work instruction within tenant only', async () => {
    const item = { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' } as WorkInstruction;
    qb.getOne.mockResolvedValue(item);
    mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

    await target.delete('ITEM01::P10::A', 'C1', 'P1');

    expect(mockRepo.delete).toHaveBeenCalledWith({
      itemCode: 'ITEM01',
      processCode: 'P10',
      revision: 'A',
      company: 'C1',
      plant: 'P1',
    });
  });
});
