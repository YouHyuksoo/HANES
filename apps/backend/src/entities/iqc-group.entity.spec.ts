import { getMetadataArgsStorage } from 'typeorm';
import { IqcGroup } from './iqc-group.entity';
import { IqcGroupItem } from './iqc-group-item.entity';

function primaryColumnNames(target: Function) {
  return getMetadataArgsStorage()
    .columns
    .filter((column) => column.target === target && column.options.primary)
    .map((column) => column.options.name);
}

describe('IQC group entity keys', () => {
  it('uses tenant columns in the group primary key', () => {
    expect(primaryColumnNames(IqcGroup)).toEqual(['COMPANY', 'PLANT_CD', 'GROUP_CODE']);
  });

  it('uses tenant columns in the group item primary key', () => {
    expect(primaryColumnNames(IqcGroupItem)).toEqual(['COMPANY', 'PLANT_CD', 'GROUP_ID', 'INSP_ITEM_ID']);
  });
});
