import { parseCsvList } from './csv-list.util';

describe('parseCsvList', () => {
  it('returns empty array for undefined, null, empty and whitespace-only input', () => {
    expect(parseCsvList(undefined)).toEqual([]);
    expect(parseCsvList(null)).toEqual([]);
    expect(parseCsvList('')).toEqual([]);
    expect(parseCsvList(' , ,')).toEqual([]);
  });

  it('splits comma separated values, trimming and dropping blanks and duplicates', () => {
    expect(parseCsvList('CUT')).toEqual(['CUT']);
    expect(parseCsvList(' CUT, CRIMP ,,CUT')).toEqual(['CUT', 'CRIMP']);
  });

  it('accepts an already-array value (repeated query params)', () => {
    expect(parseCsvList(['EQ1', ' EQ2 ', ''])).toEqual(['EQ1', 'EQ2']);
  });
});
