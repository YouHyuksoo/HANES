import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DefectCategoryMaster } from '../../../../entities/defect-category-master.entity';
import { DefectCodeMaster } from '../../../../entities/defect-code-master.entity';
import { DefectCodeProductType } from '../../../../entities/defect-code-product-type.entity';
import {
  CreateDefectCategoryDto,
  CreateDefectCodeDto,
  DefectCodeQueryDto,
  UpdateDefectCategoryDto,
  UpdateDefectCodeDto,
} from '../dto/defect-code.dto';

type CategoryNode = DefectCategoryMaster & { children: CategoryNode[] };
type CodeWithProducts = DefectCodeMaster & { productTypes: string[] };

@Injectable()
export class DefectCodeService {
  constructor(
    @InjectRepository(DefectCategoryMaster)
    private readonly categoryRepository: Repository<DefectCategoryMaster>,
    @InjectRepository(DefectCodeMaster)
    private readonly codeRepository: Repository<DefectCodeMaster>,
    @InjectRepository(DefectCodeProductType)
    private readonly productTypeRepository: Repository<DefectCodeProductType>,
  ) {}

  private tenantWhere(company: string, plant: string) {
    return { company, plant };
  }

  private normalizeCode(value: string) {
    return value.trim().toUpperCase();
  }

  private async findCategoryOrThrow(categoryCode: string, company: string, plant: string) {
    const category = await this.categoryRepository.findOne({
      where: { categoryCode, ...this.tenantWhere(company, plant) },
    });
    if (!category) {
      throw new NotFoundException(`불량 분류를 찾을 수 없습니다: ${categoryCode}`);
    }
    return category;
  }

  private async assertValidParent(dto: CreateDefectCategoryDto | UpdateDefectCategoryDto, company: string, plant: string) {
    if (dto.levelNo === 1 && dto.parentCategoryCode) {
      throw new BadRequestException('1레벨 분류는 상위 분류를 가질 수 없습니다.');
    }
    if ((dto.levelNo ?? 1) > 1 && !dto.parentCategoryCode) {
      throw new BadRequestException('2/3레벨 분류는 상위 분류가 필요합니다.');
    }
    if (!dto.parentCategoryCode) return;

    const parent = await this.findCategoryOrThrow(dto.parentCategoryCode, company, plant);
    if (dto.levelNo && parent.levelNo !== dto.levelNo - 1) {
      throw new BadRequestException('상위 분류 레벨이 현재 분류와 맞지 않습니다.');
    }
  }

  private async assertLeafCategory(categoryCode: string, company: string, plant: string) {
    const category = await this.findCategoryOrThrow(categoryCode, company, plant);
    if (category.useYn !== 'Y') {
      throw new BadRequestException('사용중인 불량 분류만 연결할 수 있습니다.');
    }
    if (category.levelNo !== 3) {
      throw new BadRequestException('불량코드는 3레벨 분류에만 연결할 수 있습니다.');
    }
    return category;
  }

  private async loadProductTypes(defectCodes: string[], company: string, plant: string) {
    if (!defectCodes.length) return new Map<string, string[]>();
    const mappings = await this.productTypeRepository.find({ where: { ...this.tenantWhere(company, plant) } });
    const codeSet = new Set(defectCodes);
    const map = new Map<string, string[]>();
    for (const mapping of mappings) {
      if (!codeSet.has(mapping.defectCode)) continue;
      const values = map.get(mapping.defectCode) ?? [];
      values.push(mapping.productType);
      map.set(mapping.defectCode, values);
    }
    return map;
  }

  async findCategoryTree(company: string, plant: string) {
    const categories = await this.categoryRepository.find({
      where: this.tenantWhere(company, plant),
      order: { levelNo: 'ASC', sortOrder: 'ASC', categoryCode: 'ASC' },
    });
    const nodeMap = new Map<string, CategoryNode>();
    for (const category of categories) {
      nodeMap.set(category.categoryCode, { ...category, children: [] });
    }
    const roots: CategoryNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentCategoryCode && nodeMap.has(node.parentCategoryCode)) {
        nodeMap.get(node.parentCategoryCode)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async createCategory(dto: CreateDefectCategoryDto, company: string, plant: string, userId: string) {
    const categoryCode = this.normalizeCode(dto.categoryCode);
    const existing = await this.categoryRepository.findOne({
      where: { categoryCode, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 불량 분류입니다: ${categoryCode}`);
    }
    await this.assertValidParent({ ...dto, categoryCode }, company, plant);
    return this.categoryRepository.save(this.categoryRepository.create({
      categoryCode,
      categoryName: dto.categoryName.trim(),
      levelNo: dto.levelNo,
      parentCategoryCode: dto.parentCategoryCode ? this.normalizeCode(dto.parentCategoryCode) : null,
      sortOrder: dto.sortOrder ?? 0,
      useYn: dto.useYn ?? 'Y',
      description: dto.description ?? null,
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    }));
  }

  async updateCategory(categoryCode: string, dto: UpdateDefectCategoryDto, company: string, plant: string, userId: string) {
    const current = await this.findCategoryOrThrow(categoryCode, company, plant);
    const next = {
      ...current,
      ...dto,
      categoryCode: current.categoryCode,
      parentCategoryCode: dto.parentCategoryCode === undefined
        ? current.parentCategoryCode
        : dto.parentCategoryCode ? this.normalizeCode(dto.parentCategoryCode) : null,
      updatedBy: userId,
    };
    await this.assertValidParent(next, company, plant);
    return this.categoryRepository.save(next);
  }

  async createCode(dto: CreateDefectCodeDto, company: string, plant: string, userId: string): Promise<CodeWithProducts> {
    const defectCode = this.normalizeCode(dto.defectCode);
    const existing = await this.codeRepository.findOne({
      where: { defectCode, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 불량코드입니다: ${defectCode}`);
    }
    await this.assertLeafCategory(dto.categoryCode, company, plant);

    const saved = await this.codeRepository.save(this.codeRepository.create({
      defectCode,
      defectName: dto.defectName.trim(),
      categoryCode: this.normalizeCode(dto.categoryCode),
      defectGrade: dto.defectGrade,
      defectScope: dto.defectScope,
      description: dto.description ?? null,
      sortOrder: dto.sortOrder ?? 0,
      useYn: dto.useYn ?? 'Y',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    }));
    const productTypes = await this.replaceProductTypes(defectCode, dto.productTypes ?? [], company, plant, userId);
    return { ...saved, productTypes };
  }

  async updateCode(defectCodeParam: string, dto: UpdateDefectCodeDto, company: string, plant: string, userId: string): Promise<CodeWithProducts> {
    const defectCode = this.normalizeCode(defectCodeParam);
    const current = await this.codeRepository.findOne({
      where: { defectCode, ...this.tenantWhere(company, plant) },
    });
    if (!current) {
      throw new NotFoundException(`불량코드를 찾을 수 없습니다: ${defectCode}`);
    }
    if (dto.categoryCode) {
      await this.assertLeafCategory(dto.categoryCode, company, plant);
    }
    const saved = await this.codeRepository.save({
      ...current,
      defectName: dto.defectName ?? current.defectName,
      categoryCode: dto.categoryCode ? this.normalizeCode(dto.categoryCode) : current.categoryCode,
      defectGrade: dto.defectGrade ?? current.defectGrade,
      defectScope: dto.defectScope ?? current.defectScope,
      description: dto.description === undefined ? current.description : dto.description,
      sortOrder: dto.sortOrder ?? current.sortOrder,
      useYn: dto.useYn ?? current.useYn,
      updatedBy: userId,
    });
    const productTypes = dto.productTypes === undefined
      ? (await this.loadProductTypes([defectCode], company, plant)).get(defectCode) ?? []
      : await this.replaceProductTypes(defectCode, dto.productTypes, company, plant, userId);
    return { ...saved, productTypes };
  }

  async disableCode(defectCodeParam: string, company: string, plant: string, userId: string) {
    return this.updateCode(defectCodeParam, { useYn: 'N' }, company, plant, userId);
  }

  async findAll(query: DefectCodeQueryDto, company: string, plant: string) {
    const { page = 1, limit = 20 } = query;
    let rows = await this.codeRepository.find({
      where: { ...this.tenantWhere(company, plant) },
      order: { sortOrder: 'ASC', defectCode: 'ASC' },
    });
    const productMap = await this.loadProductTypes(rows.map((row) => row.defectCode), company, plant);

    rows = rows.filter((row) => {
      if (query.useYn && row.useYn !== query.useYn) return false;
      if (query.categoryCode && row.categoryCode !== query.categoryCode) return false;
      if (query.defectGrade && row.defectGrade !== query.defectGrade) return false;
      if (query.defectScope && row.defectScope !== query.defectScope) return false;
      if (query.productType) {
        const mapped = productMap.get(row.defectCode) ?? [];
        if (!mapped.includes(query.productType)) return false;
      }
      if (query.search) {
        const keyword = query.search.toUpperCase();
        return row.defectCode.includes(keyword) || row.defectName.toUpperCase().includes(keyword);
      }
      return true;
    });

    const total = rows.length;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit).map((row) => ({
      ...row,
      productTypes: productMap.get(row.defectCode) ?? [],
    }));
    return { data, total, page, limit };
  }

  async findOptions(query: Pick<DefectCodeQueryDto, 'productType' | 'defectScope'>, company: string, plant: string) {
    const rows = await this.codeRepository.find({
      where: { ...this.tenantWhere(company, plant), useYn: 'Y' },
      order: { sortOrder: 'ASC', defectCode: 'ASC' },
    });
    const productMap = await this.loadProductTypes(rows.map((row) => row.defectCode), company, plant);
    return rows
      .filter((row) => !query.defectScope || row.defectScope === query.defectScope || row.defectScope === 'COMMON')
      .filter((row) => {
        if (!query.productType) return true;
        const mapped = productMap.get(row.defectCode) ?? [];
        return mapped.includes(query.productType);
      })
      .map((row) => ({
        defectCode: row.defectCode,
        defectName: row.defectName,
        categoryCode: row.categoryCode,
        defectGrade: row.defectGrade,
        defectScope: row.defectScope,
        productTypes: productMap.get(row.defectCode) ?? [],
      }));
  }

  private async replaceProductTypes(defectCode: string, productTypes: string[], company: string, plant: string, userId: string) {
    await this.productTypeRepository.delete?.({ defectCode, ...this.tenantWhere(company, plant) });
    const normalized = [...new Set(productTypes.map((value) => this.normalizeCode(value)).filter(Boolean))];
    if (!normalized.length) return [];
    await this.productTypeRepository.save(normalized.map((productType) => this.productTypeRepository.create({
      defectCode,
      productType,
      company,
      plant,
      createdBy: userId,
    })));
    return normalized;
  }
}
