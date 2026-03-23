/**
 * @file scripts/extract-entity-cols.js
 * @description 엔티티 파일에서 컬럼 정보를 JSON으로 추출하는 스크립트
 *
 * 초보자 가이드:
 * 1. apps/backend/src/entities/*.entity.ts 파일을 읽어서 파싱
 * 2. @Entity, @PrimaryColumn, @Column 데코레이터에서 정보 추출
 * 3. 감사 컬럼(COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY) 제외
 * 4. @CreateDateColumn, @UpdateDateColumn 제외
 * 5. 결과를 scripts/entity-columns.json에 저장
 */
const fs = require('fs');
const path = require('path');

const ENTITIES_DIR = path.join(__dirname, '..', 'apps', 'backend', 'src', 'entities');
const OUTPUT_FILE = path.join(__dirname, 'entity-columns.json');

const EXCLUDE_COLS = new Set(['COMPANY', 'PLANT_CD', 'CREATED_BY', 'UPDATED_BY']);

const files = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.entity.ts'));

const result = {};

for (const file of files) {
  const content = fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8');

  // Extract table name from @Entity({ name: 'TABLE_NAME' })
  const entityMatch = content.match(/@Entity\(\s*\{\s*name:\s*'([^']+)'/);
  if (!entityMatch) continue;
  const tableName = entityMatch[1];

  const pk = [];
  const cols = [];

  // Split content into lines for processing
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip @CreateDateColumn and @UpdateDateColumn
    if (line.startsWith('@CreateDateColumn') || line.startsWith('@UpdateDateColumn')) {
      continue;
    }

    // Skip @DeleteDateColumn, @VersionColumn
    if (line.startsWith('@DeleteDateColumn') || line.startsWith('@VersionColumn')) {
      continue;
    }

    // Collect the full decorator text (may span multiple lines)
    let decoratorText = '';
    let isPrimary = false;
    let isColumn = false;

    if (line.startsWith('@PrimaryColumn(') || line.startsWith('@Column(')) {
      isPrimary = line.startsWith('@PrimaryColumn(');
      isColumn = true;

      // Collect full decorator (handle multi-line)
      decoratorText = line;
      let braceCount = 0;
      for (const ch of line) {
        if (ch === '(') braceCount++;
        if (ch === ')') braceCount--;
      }
      let j = i;
      while (braceCount > 0 && j + 1 < lines.length) {
        j++;
        decoratorText += ' ' + lines[j].trim();
        for (const ch of lines[j]) {
          if (ch === '(') braceCount++;
          if (ch === ')') braceCount--;
        }
      }
    }

    if (!isColumn) continue;

    // Extract name
    const nameMatch = decoratorText.match(/name:\s*'([^']+)'/);
    if (!nameMatch) continue;
    const colName = nameMatch[1];

    // Skip audit columns
    if (EXCLUDE_COLS.has(colName)) continue;

    // Extract type
    const typeMatch = decoratorText.match(/type:\s*'([^']+)'/);
    let colType = typeMatch ? typeMatch[1] : 'varchar2';

    // Extract length
    const lenMatch = decoratorText.match(/length:\s*(\d+)/);
    const precisionMatch = decoratorText.match(/precision:\s*(\d+)/);
    const scaleMatch = decoratorText.match(/scale:\s*(\d+)/);
    let colLen = '-';
    if (lenMatch) {
      colLen = lenMatch[1];
    } else if (precisionMatch) {
      colLen = scaleMatch
        ? `${precisionMatch[1]},${scaleMatch[1]}`
        : precisionMatch[1];
    }

    // Extract nullable
    const nullableMatch = decoratorText.match(/nullable:\s*(true|false)/);
    const isNullable = nullableMatch && nullableMatch[1] === 'true' ? 'Y' : 'N';

    if (isPrimary) {
      pk.push(colName);
    }

    cols.push({
      name: colName,
      type: colType,
      len: colLen,
      null: isNullable,
    });
  }

  result[tableName] = { pk, cols };
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`Extracted ${Object.keys(result).length} tables to ${OUTPUT_FILE}`);
