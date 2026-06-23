import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const here = (rel) => new URL(rel, import.meta.url);

// 1) master/label에 'sg'(반제품 SG) 카테고리/소스/기본 디자인이 추가되어야 한다.
const labelTypes = readFileSync(here('../../../master/label/types.ts'), 'utf8');
assert.match(labelTypes, /LabelCategory =[^;]*"sg"/s, 'LabelCategory must include "sg"');
assert.match(labelTypes, /LabelSourceTable =[^;]*"sg_label"/s, 'LabelSourceTable must include "sg_label"');
assert.match(labelTypes, /SG_LABEL_DEFAULT_DESIGN/, 'SG_LABEL_DEFAULT_DESIGN must be defined');
assert.match(labelTypes, /category === "sg"\)\s*return SG_LABEL_DEFAULT_DESIGN/, 'createDefaultLabelDesign must handle "sg"');

const labelSources = readFileSync(here('../../../master/label/labelSources.ts'), 'utf8');
assert.match(labelSources, /sg_label:\s*\{[\s\S]*sgBarcode/, 'labelSources must define sg_label with sgBarcode field');
assert.match(labelSources, /sg:\s*"sg_label"/, 'categorySourceTable must map sg -> sg_label');

const labelPage = readFileSync(here('../../../master/label/page.tsx'), 'utf8');
assert.match(labelPage, /sg_label:\s*"sg"/, 'page sourceCategoryMap must map sg_label -> sg');

// 2) 키오스크 실적 저장 성공 시 resultNo를 상위로 전달해야 한다.
const inputBar = readFileSync(here('./ProductionInputBar.tsx'), 'utf8');
assert.match(inputBar, /onResultSaved\?:\s*\(resultNo:\s*string\)\s*=>/, 'ProductionInputBar must accept onResultSaved');
assert.match(inputBar, /const res = await api\.post\('\/production\/prod-results'/, 'POST response must be captured');
assert.match(inputBar, /res\?\.data\?\.data\?\.resultNo/, 'resultNo must be read from response');
assert.match(inputBar, /onResultSaved\?\.\(savedResultNo\)/, 'onResultSaved must be invoked with resultNo');

// 3) SG 라벨 출력 호스트는 발행된 SG를 조회해 Print Agent로 출력해야 한다.
const host = readFileSync(here('./SgLabelPrintHost.tsx'), 'utf8');
assert.match(host, /sg-labels-by-result\/\$\{encodeURIComponent\(resultNo\)\}/, 'host must query sg-labels-by-result');
assert.match(host, /printLabelNodesViaAgent/, 'host must print via agent helper');
assert.match(host, /category:\s*"sg"/, 'host must load the sg label template');
assert.doesNotMatch(host, /window\.print\(/, 'host must NOT use window.print (agent output only)');

// 4) 키오스크 페이지가 호스트를 마운트하고 onResultSaved를 배선해야 한다.
const page = readFileSync(here('../page.tsx'), 'utf8');
assert.match(page, /<SgLabelPrintHost ref=\{sgPrinterRef\}/, 'kiosk page must mount SgLabelPrintHost');
assert.match(page, /onResultSaved=\{handleResultSaved\}/, 'kiosk page must wire onResultSaved');
assert.match(page, /sgPrinterRef\.current\?\.printByResultNo/, 'handleResultSaved must call printByResultNo');

console.log('kiosk-sg-label-print structure test OK');
