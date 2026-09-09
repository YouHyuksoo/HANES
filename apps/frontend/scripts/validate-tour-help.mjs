import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('src/tour-help/locales');
const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'));
if (!files.includes('ko.json')) throw new Error('tour-help 한국어 기준 리소스(ko.json)가 없습니다.');

const resources = Object.fromEntries(files.map((file) => [file, JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))]));
const keyPattern = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/;
const korean = resources['ko.json'];
for (const [file, entries] of Object.entries(resources)) {
  for (const [key, entry] of Object.entries(entries)) {
    if (!keyPattern.test(key)) throw new Error(`${file}: 잘못된 tour-help 키 '${key}'`);
    if (!entry || typeof entry !== 'object') throw new Error(`${file}:${key}: 항목은 객체여야 합니다.`);
    for (const field of ['title', 'description', 'usage', 'warning']) {
      if (entry[field] !== undefined && typeof entry[field] !== 'string') throw new Error(`${file}:${key}.${field}: 문자열이어야 합니다.`);
    }
    if (entry.related !== undefined && (!Array.isArray(entry.related) || entry.related.some((value) => typeof value !== 'string'))) {
      throw new Error(`${file}:${key}.related: 문자열 배열이어야 합니다.`);
    }
  }
}
for (const [key, entry] of Object.entries(korean)) {
  if (!entry.title?.trim() || !entry.description?.trim()) throw new Error(`ko.json:${key}: title/description은 필수입니다.`);
}
console.log(`tour-help 리소스 검증 완료: ${files.length}개 언어, ${Object.keys(korean).length}개 기준 키`);
