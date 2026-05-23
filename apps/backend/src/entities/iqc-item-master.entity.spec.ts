import { getMetadataArgsStorage } from 'typeorm';
import { IqcItemMaster } from './iqc-item-master.entity';

function primaryColumnNames(target: Function) {
  return getMetadataArgsStorage()
    .columns
    .filter((column) => column.target === target && column.options.primary)
    .map((column) => column.options.name);
}

describe('IQC item master entity keys', () => {
  it('uses tenant columns in the primary key', () => {
    expect(primaryColumnNames(IqcItemMaster)).toEqual(['COMPANY', 'PLANT_CD', 'ITEM_CODE', 'SEQ']);
  });
});
