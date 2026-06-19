import { getMetadataArgsStorage } from 'typeorm';
import { AqlStandard } from './aql-standard.entity';
import { AqlSamplingRule } from './aql-sampling-rule.entity';

function primaryColumnNames(target: Function) {
  return getMetadataArgsStorage()
    .columns
    .filter((column) => column.target === target && column.options.primary)
    .map((column) => column.options.name);
}

describe('AQL standard entity keys', () => {
  it('uses tenant and code columns in the standard primary key', () => {
    expect(primaryColumnNames(AqlStandard)).toEqual(['COMPANY', 'PLANT_CD', 'AQL_CODE']);
  });

  it('uses lot range start in the sampling rule primary key', () => {
    expect(primaryColumnNames(AqlSamplingRule)).toEqual(['COMPANY', 'PLANT_CD', 'AQL_CODE', 'LOT_QTY_FROM']);
  });
});
