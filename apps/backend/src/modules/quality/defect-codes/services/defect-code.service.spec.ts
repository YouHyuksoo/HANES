import { BadRequestException, ConflictException } from '@nestjs/common';
import { DefectCodeService } from './defect-code.service';

function createRepoMock() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
  };
}

describe('DefectCodeService', () => {
  let categoryRepo: ReturnType<typeof createRepoMock>;
  let codeRepo: ReturnType<typeof createRepoMock>;
  let productTypeRepo: ReturnType<typeof createRepoMock>;
  let service: DefectCodeService;

  beforeEach(() => {
    categoryRepo = createRepoMock();
    codeRepo = createRepoMock();
    productTypeRepo = createRepoMock();
    service = new DefectCodeService(categoryRepo as any, codeRepo as any, productTypeRepo as any);
  });

  it('rejects assigning a defect code to a non-leaf category', async () => {
    codeRepo.findOne.mockResolvedValue(null);
    categoryRepo.findOne.mockResolvedValue({
      company: '40',
      plant: '1000',
      categoryCode: 'APPEARANCE',
      levelNo: 1,
      useYn: 'Y',
    });

    await expect(service.createCode({
      defectCode: 'OPEN',
      defectName: '단선',
      categoryCode: 'APPEARANCE',
      defectGrade: 'MAJOR',
      defectScope: 'PRODUCT',
      productTypes: ['FINISHED'],
      useYn: 'Y',
    }, '40', '1000', 'tester')).rejects.toThrow(BadRequestException);
  });

  it('creates a defect code with product type mappings under a level 3 category', async () => {
    codeRepo.findOne.mockResolvedValue(null);
    categoryRepo.findOne.mockResolvedValue({
      company: '40',
      plant: '1000',
      categoryCode: 'APP_PRODUCT_WIRE',
      levelNo: 3,
      useYn: 'Y',
    });

    const result = await service.createCode({
      defectCode: 'OPEN',
      defectName: '단선',
      categoryCode: 'APP_PRODUCT_WIRE',
      defectGrade: 'MAJOR',
      defectScope: 'PRODUCT',
      productTypes: ['FINISHED', 'SEMI_PRODUCT'],
      useYn: 'Y',
    }, '40', '1000', 'tester');

    expect(codeRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      defectCode: 'OPEN',
      defectName: '단선',
      categoryCode: 'APP_PRODUCT_WIRE',
      defectGrade: 'MAJOR',
      defectScope: 'PRODUCT',
      company: '40',
      plant: '1000',
    }));
    expect(productTypeRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ defectCode: 'OPEN', productType: 'FINISHED' }),
      expect.objectContaining({ defectCode: 'OPEN', productType: 'SEMI_PRODUCT' }),
    ]);
    expect(result.productTypes).toEqual(['FINISHED', 'SEMI_PRODUCT']);
  });

  it('rejects duplicate defect code per tenant', async () => {
    codeRepo.findOne.mockResolvedValue({ defectCode: 'OPEN' });

    await expect(service.createCode({
      defectCode: 'OPEN',
      defectName: '단선',
      categoryCode: 'APP_PRODUCT_WIRE',
      defectGrade: 'MAJOR',
      defectScope: 'PRODUCT',
    }, '40', '1000', 'tester')).rejects.toThrow(ConflictException);
  });

  it('filters active defect code options by product type', async () => {
    codeRepo.find.mockResolvedValue([
      { defectCode: 'OPEN', defectName: '단선', categoryCode: 'APP_PRODUCT_WIRE', defectGrade: 'MAJOR', defectScope: 'PRODUCT', useYn: 'Y' },
      { defectCode: 'CRACK', defectName: '크랙', categoryCode: 'APP_RAW_WIRE', defectGrade: 'CRITICAL', defectScope: 'RAW_MATERIAL', useYn: 'Y' },
      { defectCode: 'COMMON', defectName: '공통불량', categoryCode: 'ETC_COMMON_ETC', defectGrade: 'MINOR', defectScope: 'COMMON', useYn: 'Y' },
    ]);
    productTypeRepo.find.mockResolvedValue([
      { defectCode: 'OPEN', productType: 'FINISHED' },
      { defectCode: 'CRACK', productType: 'RAW_MATERIAL' },
    ]);

    const options = await service.findOptions({ productType: 'FINISHED' }, '40', '1000');

    expect(options.map((row) => row.defectCode)).toEqual(['OPEN', 'COMMON']);
  });
});
