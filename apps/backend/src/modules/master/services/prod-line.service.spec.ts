import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProdLineMaster } from '../../../entities/prod-line-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { ProdLineService } from './prod-line.service';

describe('ProdLineService', () => {
  let target: ProdLineService;
  let mockRepo: DeepMocked<Repository<ProdLineMaster>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<ProdLineMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdLineService,
        { provide: getRepositoryToken(ProdLineMaster), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ProdLineService>(ProdLineService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('finds production line within tenant only', async () => {
    const line = { lineCode: 'L01', lineName: 'Line 1', company: 'C1', plant: 'P1' } as ProdLineMaster;
    mockRepo.findOne.mockResolvedValue(line);

    const result = await target.findById('L01', 'C1', 'P1');

    expect(result).toEqual(line);
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { lineCode: 'L01', company: 'C1', plant: 'P1' },
    });
  });

  it('throws NotFoundException when tenant scoped production line is missing', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(target.findById('L99', 'C1', 'P1')).rejects.toThrow(NotFoundException);
  });

  it('creates production line within tenant only', async () => {
    const dto = { lineCode: 'L01', lineName: 'Line 1' } as any;
    const created = { ...dto, company: 'C1', plant: 'P1', useYn: 'Y' } as ProdLineMaster;
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    const result = await target.create(dto, 'C1', 'P1');

    expect(result).toEqual(created);
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { lineCode: 'L01', company: 'C1', plant: 'P1' },
    });
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      lineCode: 'L01',
      company: 'C1',
      plant: 'P1',
    }));
  });

  it('throws ConflictException when line code exists in tenant', async () => {
    mockRepo.findOne.mockResolvedValue({ lineCode: 'L01' } as ProdLineMaster);

    await expect(target.create({ lineCode: 'L01', lineName: 'Line 1' } as any, 'C1', 'P1'))
      .rejects.toThrow(ConflictException);
  });

  it('updates production line within tenant and strips key columns from payload', async () => {
    const existing = { lineCode: 'L01', lineName: 'Old', company: 'C1', plant: 'P1' } as ProdLineMaster;
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.update.mockResolvedValue({ affected: 1 } as any);

    await target.update('L01', {
      lineCode: 'L99',
      lineName: 'New',
      company: 'C2',
      plant: 'P2',
    } as any, 'C1', 'P1');

    expect(mockRepo.update).toHaveBeenCalledWith(
      { lineCode: 'L01', company: 'C1', plant: 'P1' },
      expect.not.objectContaining({
        lineCode: expect.anything(),
        company: expect.anything(),
        plant: expect.anything(),
      }),
    );
  });

  it('deletes production line within tenant only', async () => {
    const existing = { lineCode: 'L01', company: 'C1', plant: 'P1' } as ProdLineMaster;
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

    const result = await target.delete('L01', 'C1', 'P1');

    expect(result).toEqual({ lineCode: 'L01' });
    expect(mockRepo.delete).toHaveBeenCalledWith({ lineCode: 'L01', company: 'C1', plant: 'P1' });
  });
});
