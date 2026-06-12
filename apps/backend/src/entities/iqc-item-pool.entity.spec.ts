import { getMetadataArgsStorage } from 'typeorm';
import { IqcItemPool } from './iqc-item-pool.entity';
import { IqcPartSpecItem } from './iqc-part-spec-item.entity';

function primaryColumnNames(target: Function) {
  return getMetadataArgsStorage()
    .columns
    .filter((column) => column.target === target && column.options.primary)
    .map((column) => column.options.name);
}

function relationJoinColumnNames(target: Function, propertyName: string) {
  return getMetadataArgsStorage()
    .joinColumns
    .filter((joinColumn) => joinColumn.target === target && joinColumn.propertyName === propertyName)
    .map((joinColumn) => joinColumn.name);
}

describe('IQC item pool entity keys', () => {
  it('uses tenant columns in the primary key', () => {
    expect(primaryColumnNames(IqcItemPool)).toEqual(['COMPANY', 'PLANT_CD', 'INSP_ITEM_CODE']);
  });

  it('joins part spec items to the item pool within the tenant key', () => {
    expect(relationJoinColumnNames(IqcPartSpecItem, 'inspItem')).toEqual(['COMPANY', 'PLANT_CD', 'INSP_ITEM_CODE']);
  });
});
