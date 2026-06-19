import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AqlService } from './aql.service';

function createRepoMock() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('AqlService', () => {
  let standardRepo: ReturnType<typeof createRepoMock>;
  let ruleRepo: ReturnType<typeof createRepoMock>;
  let service: AqlService;

  beforeEach(() => {
    standardRepo = createRepoMock();
    ruleRepo = createRepoMock();
    service = new AqlService(standardRepo as any, ruleRepo as any);
  });

  it('rejects overlapping lot quantity ranges for one AQL code', async () => {
    standardRepo.findOne.mockResolvedValue(null);

    await expect(service.create({
      aqlCode: 'AQL-1.0',
      aqlName: 'AQL 1.0',
      inspectionLevel: 'II',
      aqlValue: 1,
      useYn: 'Y',
      rules: [
        { lotQtyFrom: 1, lotQtyTo: 50, sampleSize: 5, acceptQty: 0, rejectQty: 1 },
        { lotQtyFrom: 40, lotQtyTo: 100, sampleSize: 8, acceptQty: 1, rejectQty: 2 },
      ],
    }, '40', '1000', 'tester')).rejects.toThrow(BadRequestException);
  });

  it('resolves a lot quantity to the matching rule', async () => {
    standardRepo.findOne.mockResolvedValue({
      company: '40',
      plant: '1000',
      aqlCode: 'AQL-1.0',
      aqlName: 'AQL 1.0',
      useYn: 'Y',
    });
    ruleRepo.find.mockResolvedValue([
      { lotQtyFrom: 1, lotQtyTo: 20, sampleSize: 3, acceptQty: 0, rejectQty: 1 },
      { lotQtyFrom: 21, lotQtyTo: 50, sampleSize: 5, acceptQty: 1, rejectQty: 2 },
    ]);

    await expect(service.resolveByAqlCode('AQL-1.0', 25, '40', '1000')).resolves.toEqual(
      expect.objectContaining({
        aqlCode: 'AQL-1.0',
        lotQty: 25,
        sampleSize: 5,
        acceptQty: 1,
        rejectQty: 2,
      }),
    );
  });

  it('rejects inactive AQL standards when resolving', async () => {
    standardRepo.findOne.mockResolvedValue({ aqlCode: 'AQL-1.0', useYn: 'N' });

    await expect(service.resolveByAqlCode('AQL-1.0', 25, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('throws when no sampling rule matches the lot quantity', async () => {
    standardRepo.findOne.mockResolvedValue({ aqlCode: 'AQL-1.0', useYn: 'Y' });
    ruleRepo.find.mockResolvedValue([{ lotQtyFrom: 1, lotQtyTo: 20, sampleSize: 3, acceptQty: 0, rejectQty: 1 }]);

    await expect(service.resolveByAqlCode('AQL-1.0', 25, '40', '1000')).rejects.toThrow(NotFoundException);
  });
});
