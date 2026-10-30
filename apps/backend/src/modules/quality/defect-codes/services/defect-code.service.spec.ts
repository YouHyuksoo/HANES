import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DefectCategoryMaster } from '../../../../entities/defect-category-master.entity';
import { DefectCodeMaster } from '../../../../entities/defect-code-master.entity';
import { DefectCodeProductType } from '../../../../entities/defect-code-product-type.entity';
import { DefectCodeService } from './defect-code.service';

function createRepoMock() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };
}

describe('DefectCodeService', () => {
  let categoryRepo: ReturnType<typeof createRepoMock>;
  let codeRepo: ReturnType<typeof createRepoMock>;
  let productTypeRepo: ReturnType<typeof createRepoMock>;
  let dataSource: { query: jest.Mock };
  let service: DefectCodeService;

  beforeEach(() => {
    categoryRepo = createRepoMock();
    codeRepo = createRepoMock();
    productTypeRepo = createRepoMock();
    // 모델구분 공통코드 검사는 기본으로 통과시킨다(건수 1)
    dataSource = { query: jest.fn().mockResolvedValue([{ cnt: 1 }]) };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === DefectCodeMaster) return codeRepo;
        if (entity === DefectCodeProductType) return productTypeRepo;
        return categoryRepo;
      }),
    };
    const tx = { run: jest.fn(async (cb: (qr: unknown) => unknown) => cb({ manager })) };
    service = new DefectCodeService(categoryRepo as never, codeRepo as never, productTypeRepo as never, dataSource as never, tx as never);
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
      productTypes: ['LV'],
      useYn: 'Y',
    }, '40', '1000', 'tester')).rejects.toThrow(BadRequestException);
  });

  it('creates a defect code with model group mappings under a level 3 category', async () => {
    codeRepo.findOne.mockResolvedValue(null);
    categoryRepo.findOne.mockResolvedValue({
      company: '40',
      plant: '1000',
      categoryCode: 'OQC_LV_APPEARANCE',
      levelNo: 3,
      useYn: 'Y',
    });

    const result = await service.createCode({
      defectCode: 'OPEN',
      defectName: '단선',
      categoryCode: 'OQC_LV_APPEARANCE',
      defectGrade: 'MAJOR',
      defectScope: 'PRODUCT',
      productTypes: ['LV', 'HV'],
      useYn: 'Y',
    }, '40', '1000', 'tester');

    expect(codeRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      defectCode: 'OPEN',
      defectName: '단선',
      categoryCode: 'OQC_LV_APPEARANCE',
      defectGrade: 'MAJOR',
      defectScope: 'PRODUCT',
      company: '40',
      plant: '1000',
    }));
    expect(productTypeRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ defectCode: 'OPEN', productType: 'LV' }),
      expect.objectContaining({ defectCode: 'OPEN', productType: 'HV' }),
    ]);
    expect(result.productTypes).toEqual(['LV', 'HV']);
  });

  it('rejects duplicate defect code per tenant', async () => {
    codeRepo.findOne.mockResolvedValue({ defectCode: 'OPEN' });

    await expect(service.createCode({
      defectCode: 'OPEN',
      defectName: '단선',
      categoryCode: 'OQC_LV_APPEARANCE',
      defectGrade: 'MAJOR',
      defectScope: 'PRODUCT',
    }, '40', '1000', 'tester')).rejects.toThrow(ConflictException);
  });

  it('filters active defect code options by model group without leaking unmapped codes', async () => {
    codeRepo.find.mockResolvedValue([
      { defectCode: 'OPEN', defectName: '단선', categoryCode: 'OQC_LV_APPEARANCE', defectGrade: 'MAJOR', defectScope: 'PRODUCT', useYn: 'Y' },
      { defectCode: 'CRACK', defectName: '크랙', categoryCode: 'OQC_HV_APPEARANCE', defectGrade: 'CRITICAL', defectScope: 'PRODUCT', useYn: 'Y' },
      { defectCode: 'COMMON', defectName: '공통불량', categoryCode: 'ETC_COMMON_ETC', defectGrade: 'MINOR', defectScope: 'COMMON', useYn: 'Y' },
    ]);
    productTypeRepo.find.mockResolvedValue([
      { defectCode: 'OPEN', productType: 'LV' },
      { defectCode: 'CRACK', productType: 'HV' },
    ]);

    const options = await service.findOptions({ productType: 'LV' }, '40', '1000');

    expect(options.map((row) => row.defectCode)).toEqual(['OPEN']);
  });

  it('looks up category codes case-insensitively (stored upper-case)', async () => {
    codeRepo.findOne.mockResolvedValue(null);
    categoryRepo.findOne.mockResolvedValue({ categoryCode: 'OQC_LV_APPEARANCE', levelNo: 3, useYn: 'Y' });

    await service.createCode({
      defectCode: 'open', defectName: '단선', categoryCode: 'oqc_lv_appearance', defectGrade: 'MAJOR', defectScope: 'PRODUCT',
    }, '40', '1000', 'tester');

    expect(categoryRepo.findOne).toHaveBeenCalledWith({ where: { categoryCode: 'OQC_LV_APPEARANCE', company: '40', plant: '1000' } });
    expect(codeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ categoryCode: 'OQC_LV_APPEARANCE' }));
  });

  it('rejects a model group that is not in the common code before writing anything', async () => {
    codeRepo.findOne.mockResolvedValue(null);
    categoryRepo.findOne.mockResolvedValue({ categoryCode: 'LEAF', levelNo: 3, useYn: 'Y' });
    dataSource.query.mockResolvedValue([{ cnt: 0 }]);

    await expect(service.createCode({
      defectCode: 'OPEN', defectName: '단선', categoryCode: 'LEAF', defectGrade: 'MAJOR', defectScope: 'PRODUCT', productTypes: ['zz'],
    }, '40', '1000', 'tester')).rejects.toThrow('DEFECT_MODEL_GROUP');
    expect(dataSource.query.mock.calls[0][1]).toEqual(['DEFECT_MODEL_GROUP', 'ZZ', '40', '1000']);
    expect(codeRepo.save).not.toHaveBeenCalled();
    expect(productTypeRepo.delete).not.toHaveBeenCalled();
  });

  it('keeps model groups when productTypes is missing or null, and replaces them when an array is sent', async () => {
    codeRepo.findOne.mockResolvedValue({ defectCode: 'OPEN', defectName: '단선', categoryCode: 'LEAF', defectGrade: 'MAJOR', defectScope: 'PRODUCT', useYn: 'Y' });
    productTypeRepo.find.mockResolvedValue([{ defectCode: 'OPEN', productType: 'LV' }]);

    const kept = await service.updateCode('open', { defectName: '수정', productTypes: null as never }, '40', '1000', 'tester');
    expect(kept.productTypes).toEqual(['LV']);
    expect(productTypeRepo.delete).not.toHaveBeenCalled();

    const cleared = await service.updateCode('OPEN', { productTypes: [] }, '40', '1000', 'tester');
    expect(cleared.productTypes).toEqual([]);
    expect(productTypeRepo.delete).toHaveBeenCalledWith({ defectCode: 'OPEN', company: '40', plant: '1000' });
  });

  describe('category update rules', () => {
    const current = { categoryCode: 'MID', categoryName: '중분류', levelNo: 2, parentCategoryCode: 'TOP', sortOrder: 0, useYn: 'Y', description: null };

    it('finds the category by upper-cased code and ignores null for non-nullable columns', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(current).mockResolvedValueOnce({ categoryCode: 'TOP', levelNo: 1 });
      const saved = await service.updateCategory('mid', { categoryName: '수정', levelNo: null as never }, '40', '1000', 'tester');
      expect(categoryRepo.findOne).toHaveBeenNthCalledWith(1, { where: { categoryCode: 'MID', company: '40', plant: '1000' } });
      expect(saved).toMatchObject({ categoryName: '수정', levelNo: 2, parentCategoryCode: 'TOP' });
    });

    it('rejects using itself as the parent', async () => {
      categoryRepo.findOne.mockResolvedValue({ ...current, levelNo: 2 });
      await expect(service.updateCategory('MID', { levelNo: 3, parentCategoryCode: 'MID' }, '40', '1000', 'tester')).rejects.toThrow('자기 자신');
    });

    it('rejects changing the level while child categories exist', async () => {
      categoryRepo.findOne.mockResolvedValue({ ...current, levelNo: 1, parentCategoryCode: null });
      categoryRepo.count.mockResolvedValue(2);
      await expect(service.updateCategory('MID', { levelNo: 2, parentCategoryCode: 'TOP' }, '40', '1000', 'tester')).rejects.toThrow('하위 분류');
    });

    it('rejects moving a category with linked defect codes out of level 3', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ ...current, levelNo: 3 }).mockResolvedValueOnce({ categoryCode: 'TOP', levelNo: 1 });
      categoryRepo.count.mockResolvedValue(0);
      codeRepo.count.mockResolvedValue(3);
      await expect(service.updateCategory('MID', { levelNo: 2, parentCategoryCode: 'TOP' }, '40', '1000', 'tester')).rejects.toThrow('불량코드가 연결');
    });

    it('still reports a missing parent as 404', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(current).mockResolvedValueOnce(null);
      await expect(service.updateCategory('MID', { parentCategoryCode: 'NOPE' }, '40', '1000', 'tester')).rejects.toThrow(NotFoundException);
    });
  });
});
