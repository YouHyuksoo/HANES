import { getMetadataArgsStorage } from 'typeorm';
import { IqcPartSpec } from './iqc-part-spec.entity';
import { IqcPartSpecItem } from './iqc-part-spec-item.entity';

function primaryColumnNames(target: Function) {
  return getMetadataArgsStorage()
    .columns
    .filter((column) => column.target === target && column.options.primary)
    .map((column) => column.options.name);
}

describe('IQC part spec entity keys', () => {
  it('uses tenant columns in the header primary key', () => {
    expect(primaryColumnNames(IqcPartSpec)).toEqual(['COMPANY', 'PLANT_CD', 'ITEM_CODE']);
  });

  it('uses tenant columns in the item primary key', () => {
    expect(primaryColumnNames(IqcPartSpecItem)).toEqual(['COMPANY', 'PLANT_CD', 'ITEM_CODE', 'SEQ']);
  });
});
