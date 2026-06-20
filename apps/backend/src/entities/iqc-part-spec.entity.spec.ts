import { getMetadataArgsStorage } from 'typeorm';
import { IqcPartSpec } from './iqc-part-spec.entity';
import { IqcPartSpecItem } from './iqc-part-spec-item.entity';

function primaryColumnNames(target: Function) {
  return getMetadataArgsStorage()
    .columns
    .filter((column) => column.target === target && column.options.primary)
    .map((column) => column.options.name);
}

function columnNames(target: Function) {
  return getMetadataArgsStorage()
    .columns
    .filter((column) => column.target === target)
    .map((column) => column.options.name);
}

describe('IQC part spec entity keys', () => {
  it('uses tenant columns in the header primary key', () => {
    expect(primaryColumnNames(IqcPartSpec)).toEqual(['COMPANY', 'PLANT_CD', 'ITEM_CODE']);
  });

  it('uses tenant columns in the item primary key', () => {
    expect(primaryColumnNames(IqcPartSpecItem)).toEqual(['COMPANY', 'PLANT_CD', 'ITEM_CODE', 'SEQ']);
  });

  it('IqcPartSpecItem 검사유형 컬럼이 메타데이터에 등록된다', () => {
    const names = columnNames(IqcPartSpecItem);
    expect(names).toContain('INSPECTION_TYPE');
    expect(names).toContain('SAMPLE_METHOD');
    expect(names).toContain('SAMPLE_QTY');
  });
});
