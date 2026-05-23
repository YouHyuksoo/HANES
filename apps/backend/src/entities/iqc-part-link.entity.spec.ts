import { getMetadataArgsStorage } from 'typeorm';
import { IqcPartLink } from './iqc-part-link.entity';

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

describe('IQC part link entity keys', () => {
  it('uses tenant columns in the primary key', () => {
    expect(primaryColumnNames(IqcPartLink)).toEqual(['COMPANY', 'PLANT_CD', 'ITEM_CODE', 'PARTNER_ID']);
  });

  it('joins IQC group within the tenant key', () => {
    expect(relationJoinColumnNames(IqcPartLink, 'group')).toEqual(['COMPANY', 'PLANT_CD', 'GROUP_ID']);
  });

  it('joins part master within the tenant key', () => {
    expect(relationJoinColumnNames(IqcPartLink, 'part')).toEqual(['COMPANY', 'PLANT_CD', 'ITEM_CODE']);
  });

  it('joins partner master within the tenant key', () => {
    expect(relationJoinColumnNames(IqcPartLink, 'partner')).toEqual(['COMPANY', 'PLANT_CD', 'PARTNER_ID']);
  });
});
