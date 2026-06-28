import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';
import { Node, Project, SyntaxKind } from 'ts-morph';

const DEFAULT_ROUTES = ['/master/bom', '/master/routing', '/production/order'];
const repoRoot = process.cwd();
const outJson = path.join(repoRoot, '.code-map', 'index.json');
const outMd = path.join(repoRoot, 'docs', 'reports', 'code-map.md');

function slash(value) {
  return value.replace(/\\/g, '/');
}

function rel(file) {
  return slash(path.relative(repoRoot, file));
}

function abs(relPath) {
  return slash(path.join(repoRoot, relPath));
}

function mdLink(file, line) {
  const suffix = line ? `#L${line}` : '';
  return `[${file}](../../${file}${suffix})`;
}

function uniqueBy(items, key) {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndColumnAtPos(node.getStart()).line;
}

function evidence(sourceFile, node) {
  const file = rel(sourceFile.getFilePath());
  const text = node.getText().replace(/\s+/g, ' ').slice(0, 180);
  return { file, absolutePath: abs(file), line: lineOf(sourceFile, node), text };
}

function getDecoratorTextArg(decorator) {
  const args = decorator.getArguments();
  if (args.length === 0) return '';
  const first = args[0];
  if (Node.isStringLiteral(first) || Node.isNoSubstitutionTemplateLiteral(first)) {
    return first.getLiteralText();
  }
  if (Node.isObjectLiteralExpression(first)) {
    const nameProp = first.getProperty('name');
    if (Node.isPropertyAssignment(nameProp)) {
      const init = nameProp.getInitializer();
      if (init && (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init))) {
        return init.getLiteralText();
      }
    }
  }
  return '';
}

function combinePath(base, child) {
  return `/${[base, child].filter(Boolean).join('/')}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function routeFromPageFile(file) {
  const normalized = slash(file);
  const marker = 'apps/frontend/src/app/';
  const start = normalized.indexOf(marker);
  if (start < 0) return null;
  const sub = normalized.slice(start + marker.length).replace(/\/page\.tsx$/, '');
  const parts = sub.split('/').filter((part) => part && !part.startsWith('('));
  const route = `/${parts.join('/')}`.replace(/\/+/g, '/');
  return route === '/' ? '/' : route;
}

function normalizeRoutePattern(value) {
  return value
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/encodeURIComponent\([^)]*\)/g, ':param')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

function patternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\:param/g, '[^/]+')
    .replace(/\\:([^/]+)/g, '[^/]+');
  return new RegExp(`^${escaped}(?:\\?.*)?$`);
}

function routeMatchesApi(apiPath, controllerPath) {
  const api = normalizeRoutePattern(apiPath);
  const controller = controllerPath.replace(/:([^/]+)/g, ':param');
  if (api === controller) return true;
  if (api.startsWith(`${controller}/`)) return true;
  return patternToRegex(controller).test(api);
}

function routeMatchScore(apiPath, controllerPath) {
  if (!routeMatchesApi(apiPath, controllerPath)) return -1;
  const apiSegments = normalizeRoutePattern(apiPath).split('/').filter(Boolean);
  const controllerSegments = controllerPath.split('/').filter(Boolean);
  let score = 0;
  controllerSegments.forEach((segment, index) => {
    if (!segment.startsWith(':') && apiSegments[index] === segment) score += 3;
    if (segment.startsWith(':')) score += 1;
  });
  if (apiSegments.length === controllerSegments.length) score += 5;
  return score;
}

function literalOrTemplate(expr) {
  if (!expr) return null;
  if (Node.isStringLiteral(expr) || Node.isNoSubstitutionTemplateLiteral(expr)) {
    return { value: expr.getLiteralText(), dynamic: false };
  }
  if (Node.isTemplateExpression(expr)) {
    return {
      value: expr.getText().slice(1, -1).replace(/\$\{[^}]+\}/g, ':param'),
      dynamic: true,
    };
  }
  return null;
}

function createProject() {
  return new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      jsx: 2,
      moduleResolution: 2,
      target: 99,
      experimentalDecorators: true,
    },
  });
}

async function scanMenu(project) {
  const file = path.join(repoRoot, 'apps/frontend/src/config/menuConfig.ts');
  const translations = await loadKoreanTranslations();
  const source = project.addSourceFileAtPath(file);
  const menu = new Map();
  const decl = source.getVariableDeclaration('menuConfig');
  const initializer = decl?.getInitializer();
  if (!initializer || !Node.isArrayLiteralExpression(initializer)) return menu;

  const readObject = (obj, parents) => {
    const result = {};
    for (const prop of obj.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;
      const name = prop.getName().replace(/^['"]|['"]$/g, '');
      const init = prop.getInitializer();
      if (!init) continue;
      if (Node.isStringLiteral(init)) result[name] = init.getLiteralText();
      if (name === 'children' && Node.isArrayLiteralExpression(init)) {
        for (const child of init.getElements()) {
          if (Node.isObjectLiteralExpression(child)) readObject(child, [...parents, result]);
        }
      }
    }
    if (result.path) {
      menu.set(result.path, {
        registered: true,
        code: result.code ?? null,
        labelKey: result.labelKey ?? null,
        label: translateLabel(result.labelKey, translations),
        parentCodes: parents.map((p) => p.code).filter(Boolean),
        evidence: evidence(source, obj),
      });
    }
  };

  for (const element of initializer.getElements()) {
    if (Node.isObjectLiteralExpression(element)) readObject(element, []);
  }
  return menu;
}

async function loadKoreanTranslations() {
  try {
    return JSON.parse(await fs.readFile(path.join(repoRoot, 'apps/frontend/src/locales/ko.json'), 'utf8'));
  } catch {
    return {};
  }
}

function translateLabel(labelKey, translations) {
  if (!labelKey) return null;
  const parts = labelKey.split('.');
  let current = translations;
  for (const part of parts) {
    if (current && Object.hasOwn(current, part)) {
      current = current[part];
    } else {
      current = undefined;
      break;
    }
  }
  if (typeof current === 'string') return current;
  const [scope, ...rest] = parts;
  const flatKey = rest.join('.');
  const scoped = translations?.[scope]?.[flatKey];
  return typeof scoped === 'string' ? scoped : labelKey;
}

async function scanRoutes() {
  const files = await fg('apps/frontend/src/app/**/page.tsx', { cwd: repoRoot, absolute: true });
  return new Map(files.map((file) => [routeFromPageFile(file), rel(file)]).filter(([route]) => route));
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? path.join(repoRoot, 'apps/frontend/src', specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
  ];
  return candidates.find((candidate) => {
    try {
      return requireStat(candidate);
    } catch {
      return false;
    }
  }) ?? null;
}

function requireStat(file) {
  return fs.stat(file).then ? false : false;
}

async function fileExists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function resolveImportAsync(fromFile, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? path.join(repoRoot, 'apps/frontend/src', specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

function classifyFrontend(file, route) {
  const normalized = slash(file);
  if (normalized.endsWith('/page.tsx')) return 'PAGE';
  if (normalized.includes('/stores/') || normalized.endsWith('Store.ts')) return 'STORE';
  if (normalized.includes('/ai-page-tools/')) return normalized.includes('Store') ? 'AI_PAGE_TOOL_STORE' : 'AI_PAGE_TOOL';
  if (normalized.includes('/services/') || normalized.includes('/api')) return 'API_CLIENT';
  if (normalized.includes('/hooks/') || path.basename(normalized).startsWith('use')) return 'HOOK';
  if (normalized.includes('/components/shared/') || normalized.includes('/components/ui/')) return 'SHARED_COMPONENT';
  if (normalized.endsWith('/types.ts')) return 'TYPE';
  if (normalized.includes('/lib/') || normalized.includes('/utils/')) return 'UTILITY';
  if (normalized.includes('/components/') && route && normalized.includes(`app/(authenticated)${route}/`)) return 'BUSINESS_COMPONENT';
  if (normalized.includes('/components/')) return 'RELATED_BUSINESS_COMPONENT';
  return 'OTHER_SOURCE';
}

function isUiActionText(value) {
  if (/^[A-Z][A-Z0-9_]+\.[A-Z][A-Z0-9_]+$/.test(value)) return false;
  if (/^[A-Z0-9_]+$/.test(value) && value.includes('_')) return false;
  if (/(테이블|컬럼|COLUMN|TABLE|기준이 되는|상위\(부모\)|하위\(자식\))/.test(value)) return false;
  if (/(\{\{|권한|수 없습니다|가능합니다|없습니다|되었습니다|하시겠습니까|발견|오류|실패|성공|미등록|조회 중)/.test(value)) return false;
  return /(저장|추가|삭제|조회|수정|등록|업로드|다운로드|내보내기|가져오기|새로고침|검색|출력|작업지시)/.test(value);
}

async function collectFrontendGraph(project, pageRel) {
  const pageAbs = path.join(repoRoot, pageRel);
  const nodes = new Map();
  const edges = [];
  const apiFlow = [];
  const labels = [];
  const actions = [];
  const unresolved = [];

  const visit = async (file, depth = 0, importedBy = null, importEvidence = null) => {
    const fileRel = rel(file);
    if (nodes.has(fileRel)) {
      const existing = nodes.get(fileRel);
      if (depth < existing.depth) {
        existing.depth = depth;
        existing.importedBy = importedBy;
        if (importEvidence) existing.evidence = importEvidence;
      }
      return;
    }
    const source = project.addSourceFileAtPathIfExists(file);
    if (!source) {
      unresolved.push({ kind: 'frontendSource', reason: 'missing source file', file: fileRel });
      return;
    }
    nodes.set(fileRel, {
      id: fileRel,
      file: fileRel,
      absolutePath: abs(fileRel),
      role: classifyFrontend(fileRel, routeFromPageFile(pageAbs)),
      depth,
      importedBy,
      evidence: importEvidence ?? { file: fileRel, absolutePath: abs(fileRel), line: 1, text: path.basename(fileRel) },
    });

    for (const importDecl of source.getImportDeclarations()) {
      const target = await resolveImportAsync(file, importDecl.getModuleSpecifierValue());
      if (!target) continue;
      const targetRel = rel(target);
      const importEvidence = evidence(source, importDecl);
      edges.push({ from: fileRel, to: targetRel, type: 'imports', evidence: importEvidence });
      await visit(target, depth + 1, fileRel, importEvidence);
    }

    const includeApiEvidence = fileRel.startsWith('apps/frontend/src/app/');
    source.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression();
        let method = null;
        let argIndex = 0;
        if (Node.isPropertyAccessExpression(expr)) {
          const name = expr.getName().toUpperCase();
          if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(name)) method = name;
        } else if (expr.getText() === 'fetch') {
          method = 'GET';
        }
        if (method && includeApiEvidence) {
          const literal = literalOrTemplate(node.getArguments()[argIndex]);
          if (literal?.value?.startsWith('/')) {
            apiFlow.push({
              method,
              path: literal.value,
              dynamic: literal.dynamic,
              evidence: evidence(source, node),
            });
          }
        }
      }
      if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
        const value = node.getLiteralText().trim();
        if (value.length >= 2 && /[가-힣A-Za-z]/.test(value) && value.length < 40) {
          if (isUiActionText(value)) {
            actions.push({ text: value, evidence: evidence(source, node) });
          } else if (labels.length < 20) {
            labels.push({ text: value, evidence: evidence(source, node) });
          }
        }
      }
    });
  };

  await visit(pageAbs, 0, null, null);
  return { graph: { nodes: [...nodes.values()], edges }, apiFlow, labels, actions, unresolved };
}

async function scanControllers(project) {
  const files = await fg('apps/backend/src/modules/**/*.controller.ts', { cwd: repoRoot, absolute: true });
  const controllers = [];

  for (const file of files) {
    const source = project.addSourceFileAtPath(file);
    for (const cls of source.getClasses()) {
      const ctrlDecorator = cls.getDecorators().find((d) => d.getName() === 'Controller');
      if (!ctrlDecorator) continue;
      const base = getDecoratorTextArg(ctrlDecorator);
      const serviceProps = new Map();
      const ctor = cls.getConstructors()[0];
      for (const param of ctor?.getParameters() ?? []) {
        const name = param.getName();
        const type = param.getTypeNode()?.getText() ?? param.getType().getText();
        serviceProps.set(name, type);
      }
      for (const method of cls.getMethods()) {
        const httpDecorator = method.getDecorators().find((d) => ['Get', 'Post', 'Put', 'Patch', 'Delete'].includes(d.getName()));
        if (!httpDecorator) continue;
        const httpMethod = httpDecorator.getName().toUpperCase();
        const child = getDecoratorTextArg(httpDecorator);
        const serviceCalls = [];
        method.forEachDescendant((node) => {
          if (!Node.isCallExpression(node)) return;
          const expr = node.getExpression();
          if (!Node.isPropertyAccessExpression(expr)) return;
          const owner = expr.getExpression();
          if (!Node.isPropertyAccessExpression(owner)) return;
          if (owner.getExpression().getText() !== 'this') return;
          const prop = owner.getName();
          if (!serviceProps.has(prop)) return;
          serviceCalls.push({
            serviceClass: serviceProps.get(prop),
            method: expr.getName(),
            evidence: evidence(source, node),
          });
        });
        controllers.push({
          method: httpMethod,
          path: combinePath(base, child),
          className: cls.getName(),
          methodName: method.getName(),
          file: rel(file),
          absolutePath: abs(rel(file)),
          evidence: evidence(source, method),
          serviceCalls,
        });
      }
    }
  }
  return controllers;
}

async function scanEntities(project) {
  const files = await fg('apps/backend/src/entities/**/*.entity.ts', { cwd: repoRoot, absolute: true });
  const entities = new Map();
  for (const file of files) {
    const source = project.addSourceFileAtPath(file);
    for (const cls of source.getClasses()) {
      const decorator = cls.getDecorators().find((d) => d.getName() === 'Entity');
      if (!decorator) continue;
      const table = getDecoratorTextArg(decorator) || cls.getName();
      entities.set(cls.getName(), {
        name: cls.getName(),
        table,
        file: rel(file),
        absolutePath: abs(rel(file)),
        columns: extractEntityColumns(source, cls),
        evidence: evidence(source, decorator),
      });
    }
  }
  return entities;
}

function extractEntityColumns(source, cls) {
  const columnDecorators = new Set(['PrimaryColumn', 'PrimaryGeneratedColumn', 'Column', 'CreateDateColumn', 'UpdateDateColumn']);
  return cls.getProperties().flatMap((property) => {
    const decorator = property.getDecorators().find((item) => columnDecorators.has(item.getName()));
    if (!decorator) return [];
    const decoratorName = decorator.getName();
    return [{
      property: property.getName(),
      name: getDecoratorTextArg(decorator) || property.getName(),
      primary: decoratorName.startsWith('Primary'),
      nullable: /nullable\s*:\s*true/.test(decorator.getText()),
      type: property.getTypeNode()?.getText() ?? property.getType().getText(),
      decorator: decoratorName,
      evidence: evidence(source, decorator),
    }];
  });
}

async function findServiceFile(serviceClass) {
  if (!serviceClass) return null;
  const files = await fg('apps/backend/src/modules/**/*.service.ts', { cwd: repoRoot, absolute: true });
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    if (new RegExp(`class\\s+${serviceClass}\\b`).test(text)) return file;
  }
  const expected = serviceClass
    .replace(/Service$/, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
  return files.find((file) => path.basename(file).toLowerCase().startsWith(expected)) ?? null;
}

function scanServiceDataAccess(project, serviceFile, entityMap) {
  if (!serviceFile) return { services: [], entities: [], tables: [], typeorm: [], rawSql: [] };
  const source = project.addSourceFileAtPathIfExists(serviceFile);
  if (!source) return { services: [], entities: [], tables: [], typeorm: [], rawSql: [] };
  const serviceClasses = source.getClasses().filter((cls) => cls.getName()?.endsWith('Service'));
  const serviceRecords = serviceClasses.map((cls) => ({
    className: cls.getName(),
    file: rel(serviceFile),
    absolutePath: abs(rel(serviceFile)),
    evidence: evidence(source, cls),
  }));
  const entityNames = new Set();
  const typeorm = [];
  const rawSql = [];

  source.forEachDescendant((node) => {
    if (Node.isDecorator(node) && node.getName() === 'InjectRepository') {
      const arg = node.getArguments()[0]?.getText();
      if (arg) {
        entityNames.add(arg);
        typeorm.push({ kind: 'InjectRepository', entity: arg, evidence: evidence(source, node) });
      }
    }
    if (Node.isTypeReference(node) && node.getText().startsWith('Repository<')) {
      const text = node.getText();
      const match = text.match(/Repository<([^>]+)>/);
      if (match) {
        entityNames.add(match[1]);
        typeorm.push({ kind: 'Repository', entity: match[1], evidence: evidence(source, node) });
      }
    }
    if (Node.isCallExpression(node)) {
      const text = node.getText();
      const match = text.match(/manager\.(?:find|findOne|save|update|create|delete)\((\w+)/);
      if (match) {
        entityNames.add(match[1]);
        typeorm.push({ kind: 'QueryRunner.manager', entity: match[1], evidence: evidence(source, node) });
      }
      if (/manager\.query\(/.test(text) || /\.query\(/.test(text)) {
        rawSql.push({ kind: 'rawSql', tables: extractSqlTables(text), evidence: evidence(source, node) });
      }
    }
  });

  const entities = [...entityNames].map((name) => entityMap.get(name)).filter(Boolean);
  const tables = [...new Set([...entities.map((e) => e.table), ...rawSql.flatMap((r) => r.tables)])].map((table) => ({ name: table }));
  return { services: serviceRecords, entities, tables, typeorm, rawSql };
}

function getRepositoryBindings(cls) {
  const bindings = new Map();
  const ctor = cls.getConstructors()[0];
  for (const param of ctor?.getParameters() ?? []) {
    const decorator = param.getDecorators().find((item) => item.getName() === 'InjectRepository');
    const entity = decorator?.getArguments()[0]?.getText();
    if (entity) bindings.set(param.getName(), entity);
  }
  return bindings;
}

function scanServiceMethodDataAccess(project, serviceFile, methodName, entityMap) {
  if (!serviceFile) return { entities: [], tables: [], typeorm: [], rawSql: [] };
  const source = project.addSourceFileAtPathIfExists(serviceFile);
  if (!source) return { entities: [], tables: [], typeorm: [], rawSql: [] };
  const entityNames = new Set();
  const typeorm = [];
  const rawSql = [];

  for (const cls of source.getClasses()) {
    const method = cls.getMethods().find((item) => item.getName() === methodName);
    if (!method) continue;
    const repositoryBindings = getRepositoryBindings(cls);
    const sqlVariables = new Map();
    method.forEachDescendant((node) => {
      if (!Node.isVariableDeclaration(node)) return;
      const initializer = node.getInitializer();
      if (!initializer) return;
      if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer) || Node.isTemplateExpression(initializer)) {
        sqlVariables.set(node.getName(), initializer.getText());
      }
    });
    method.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const text = node.getText();
      const managerMatch = text.match(/manager\.(?:find|findOne|save|update|create|delete)\((\w+)/);
      if (managerMatch) {
        entityNames.add(managerMatch[1]);
        typeorm.push({ kind: 'QueryRunner.manager', entity: managerMatch[1], evidence: evidence(source, node) });
      }
      if (/manager\.query(?:<[^>]+>)?\(/.test(text) || /\.query(?:<[^>]+>)?\(/.test(text)) {
        const firstArg = node.getArguments()[0];
        const sqlText = firstArg && Node.isIdentifier(firstArg) && sqlVariables.has(firstArg.getText())
          ? sqlVariables.get(firstArg.getText())
          : text;
        rawSql.push({ kind: 'rawSql', tables: extractSqlTables(sqlText), evidence: evidence(source, node) });
      }
      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return;
      const owner = expr.getExpression();
      if (!Node.isPropertyAccessExpression(owner)) return;
      if (owner.getExpression().getText() !== 'this') return;
      const repositoryProp = owner.getName();
      const entity = repositoryBindings.get(repositoryProp);
      if (!entity) return;
      const methodName = expr.getName();
      if (!['find', 'findOne', 'findOneBy', 'findAndCount', 'save', 'update', 'create', 'delete', 'remove', 'count', 'createQueryBuilder'].includes(methodName)) return;
      entityNames.add(entity);
      typeorm.push({ kind: `Repository.${methodName}`, entity, evidence: evidence(source, node) });
    });
  }

  const entities = [...entityNames].map((name) => entityMap.get(name)).filter(Boolean);
  const tables = [...new Set([...entities.map((entity) => entity.table), ...rawSql.flatMap((sql) => sql.tables)])].map((table) => ({ name: table }));
  return { entities, tables, typeorm, rawSql };
}

function findServiceMethodEvidence(project, serviceFile, methodName) {
  if (!serviceFile) return null;
  const source = project.addSourceFileAtPathIfExists(serviceFile);
  if (!source) return null;
  for (const cls of source.getClasses()) {
    const method = cls.getMethods().find((item) => item.getName() === methodName);
    if (method) return evidence(source, method);
  }
  return null;
}

function extractSqlTables(sql) {
  const tables = new Set();
  for (const match of sql.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO|MERGE\s+INTO)\s+([A-Z][A-Z0-9_]+)/gi)) {
    tables.add(match[1].toUpperCase());
  }
  return [...tables];
}

async function scanTests(names, route) {
  const files = await fg(['apps/**/*.spec.ts', 'apps/**/*.test.mjs', 'apps/**/*.structure.test.mjs'], { cwd: repoRoot, absolute: true });
  const result = [];
  const routeTokens = route.split('/').filter(Boolean);
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const base = slash(file).toLowerCase();
    const exactMatch = names.some((name) => name && text.includes(name));
    const routePathMatch = routeTokens.length > 0 && routeTokens.every((token) => base.includes(token));
    if (exactMatch || routePathMatch) {
      result.push({
        file: rel(file),
        absolutePath: abs(rel(file)),
        evidence: { file: rel(file), absolutePath: abs(rel(file)), line: 1, text: path.basename(file) },
      });
    }
  }
  return result;
}

function buildModifyGuide(entry) {
  const frontendNodes = entry.frontend.graph.nodes;
  return {
    ui: frontendNodes.filter((n) => ['PAGE', 'BUSINESS_COMPONENT', 'SHARED_COMPONENT'].includes(n.role)).slice(0, 12),
    validation: [...frontendNodes.filter((n) => n.file.includes('Form') || n.file.includes('Modal')), ...(entry.backend.dto ?? [])].slice(0, 12),
    api: entry.backend.controllers,
    businessLogic: entry.backend.services,
    database: [...entry.dataAccess.entities, ...entry.dataAccess.tables],
    tests: entry.tests,
  };
}

function statusFor(entry) {
  const missing = [];
  if (!entry.frontend.page?.file) missing.push('frontend.page');
  if (entry.apiFlow.length === 0) missing.push('apiFlow');
  if (entry.backend.controllers.length === 0) missing.push('backend.controllers');
  if (entry.backend.services.length === 0) missing.push('backend.services');
  if (entry.dataAccess.entities.length === 0) missing.push('dataAccess.entities');
  if (entry.dataAccess.tables.length === 0) missing.push('dataAccess.tables');
  if (entry.tests.length === 0) missing.push('tests');
  return { status: missing.length === 0 ? 'COMPLETE' : 'INCOMPLETE', missing };
}

function renderMarkdown(index) {
  const sourceLine = (node) => {
    const via = node.importedBy ? ` (depth ${node.depth}, via ${mdLink(node.importedBy)})` : ` (depth ${node.depth})`;
    return `- ${node.role}: ${mdLink(node.file, node.evidence?.line)}${via}`;
  };
  const columnSummary = (columns) => {
    if (!columns?.length) return '-';
    const sorted = [...columns].sort((a, b) => Number(b.primary) - Number(a.primary));
    const visible = sorted.slice(0, 8).map((column) => {
      const suffix = column.primary ? ' PK' : column.nullable ? ' nullable' : '';
      return `\`${column.name}\`${suffix}`;
    });
    const more = sorted.length > visible.length ? ` 외 ${sorted.length - visible.length}개` : '';
    return `${visible.join(', ')}${more}`;
  };
  const apiControllerText = (api) => {
    if (!api.controller) return '`UNRESOLVED`';
    return `${api.controller.className}.${api.controller.methodName} ${mdLink(api.controller.file, api.controller.evidence?.line)}`;
  };
  const apiServiceText = (api) => {
    if (!api.serviceCalls?.length) return '-';
    return api.serviceCalls
      .map((call) => `${call.serviceClass}.${call.method}${call.file ? ` ${mdLink(call.file, call.evidence?.line)}` : ''}`)
      .join('<br>');
  };
  const apiTablesText = (api) => {
    if (!api.tables?.length) return '-';
    return api.tables.slice(0, 8).map((table) => `\`${table.name}\``).join(', ');
  };

  const lines = [
    '# Code Map Pilot',
    '',
    '이 문서는 메뉴 기준으로 화면, 프론트 소스, API, NestJS 백엔드, TypeORM/Raw SQL, Oracle 테이블, 테스트를 연결합니다.',
    '',
  ];
  for (const route of index.routes) {
    const menuName = route.menu.label ?? route.menu.labelKey ?? '메뉴 미확인';
    lines.push(`## ${menuName} - ${route.route}`);
    lines.push('');
    lines.push(`Status: \`${route.status}\``);
    lines.push('');
    lines.push('### 이 화면은 무엇을 하나?');
    lines.push('');
    const actions = route.frontend.actions.filter((a) => isUiActionText(a.text)).slice(0, 6).map((a) => a.text).join(', ') || '조회/저장 등 화면 업무 동작';
    const tables = route.dataAccess.tables.map((t) => t.name).join(', ') || 'DB 테이블 추적 없음';
    lines.push(`이 화면은 \`${menuName}\` 메뉴에 연결된 \`${route.route}\` 화면입니다. 주요 화면 작업 단서는 ${actions}이며, 연결된 데이터 저장소는 ${tables}입니다.`);
    lines.push('');
    lines.push('### Source Flow');
    lines.push('');
    lines.push('```mermaid');
    lines.push('flowchart TD');
    lines.push(`  Menu["${menuName}"] --> Page["${route.route} page.tsx"]`);
    for (const api of route.apiFlow.slice(0, 6)) {
      const apiId = `Api${Math.abs(hashCode(`${api.method}${api.path}`))}`;
      lines.push(`  Page --> ${apiId}["${api.method} ${api.path}"]`);
      const controller = route.backend.controllers.find((c) => c.apiPath === api.path);
      if (controller) {
        lines.push(`  ${apiId} --> C${Math.abs(hashCode(controller.className))}["${controller.className}.${controller.methodName}"]`);
      }
    }
    for (const service of route.backend.services.slice(0, 4)) {
      lines.push(`  C${Math.abs(hashCode(route.backend.controllers[0]?.className ?? 'Controller'))} --> S${Math.abs(hashCode(service.className))}["${service.className}"]`);
      lines.push(`  S${Math.abs(hashCode(service.className))} --> Data${Math.abs(hashCode(route.route))}["TypeORM / Raw SQL"]`);
    }
    for (const table of route.dataAccess.tables.slice(0, 6)) {
      lines.push(`  Data${Math.abs(hashCode(route.route))} --> T${Math.abs(hashCode(table.name))}["${table.name}"]`);
    }
    lines.push('```');
    lines.push('');
    lines.push('### Frontend');
    lines.push('');
    lines.push(`- Page: ${mdLink(route.frontend.page.file, route.frontend.page.line)}`);
    const primaryRoles = new Set(['BUSINESS_COMPONENT', 'HOOK', 'API_CLIENT', 'TYPE']);
    const directPrimary = route.frontend.graph.nodes.filter((n) => primaryRoles.has(n.role) && n.depth === 1);
    const indirectPrimary = route.frontend.graph.nodes.filter((n) => primaryRoles.has(n.role) && n.depth > 1);
    const relatedDirect = route.frontend.graph.nodes.filter((n) => n.role === 'RELATED_BUSINESS_COMPONENT' && n.depth === 1);
    const relatedIndirect = route.frontend.graph.nodes.filter((n) => n.role === 'RELATED_BUSINESS_COMPONENT' && n.depth > 1);
    const stores = route.frontend.graph.nodes.filter((n) => ['STORE', 'AI_PAGE_TOOL_STORE', 'AI_PAGE_TOOL'].includes(n.role));
    const other = route.frontend.graph.nodes.filter((n) => n.role === 'OTHER_SOURCE');
    const shared = route.frontend.graph.nodes.filter((n) => n.role === 'SHARED_COMPONENT' || n.role === 'UTILITY');
    lines.push('');
    lines.push('#### 화면 직접 연결 소스');
    lines.push('');
    for (const node of directPrimary) lines.push(sourceLine(node));
    if (indirectPrimary.length > 0) {
      lines.push('');
      lines.push('#### 컴포넌트 내부 연결 소스');
      lines.push('');
      for (const node of indirectPrimary) lines.push(sourceLine(node));
    }
    if (relatedDirect.length > 0) {
      lines.push('');
      lines.push('#### 다른 업무 화면 직접 연결');
      lines.push('');
      for (const node of relatedDirect) lines.push(sourceLine(node));
    }
    if (relatedIndirect.length > 0) {
      lines.push('');
      lines.push('#### 다른 업무 화면 간접 연결');
      lines.push('');
      for (const node of relatedIndirect) lines.push(sourceLine(node));
    }
    if (stores.length > 0) {
      lines.push('');
      lines.push('#### 상태/스토어');
      lines.push('');
      for (const node of stores) lines.push(sourceLine(node));
    }
    if (shared.length > 0) {
      lines.push('<details>');
      lines.push(`<summary>공유 컴포넌트/유틸 ${shared.length}개</summary>`);
      lines.push('');
      for (const node of shared) lines.push(`- ${mdLink(node.file, node.evidence?.line)}`);
      lines.push('</details>');
      lines.push('');
    }
    if (other.length > 0) {
      lines.push('<details>');
      lines.push(`<summary>기타 소스 ${other.length}개</summary>`);
      lines.push('');
      for (const node of other) lines.push(`- ${mdLink(node.file, node.evidence?.line)}`);
      lines.push('</details>');
      lines.push('');
    }
    lines.push('### API Flow');
    lines.push('');
    lines.push('| Method | API | Frontend 근거 | Controller | Service | 연결 테이블 |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const api of route.apiFlow) {
      lines.push(`| ${api.method} | \`${api.path}\` | ${mdLink(api.evidence.file, api.evidence.line)} | ${apiControllerText(api)} | ${apiServiceText(api)} | ${apiTablesText(api)} |`);
    }
    const unresolvedApis = route.apiFlow.filter((api) => api.resolutionStatus !== 'RESOLVED');
    if (unresolvedApis.length > 0) {
      lines.push('');
      lines.push('#### 미해결 API');
      lines.push('');
      for (const api of unresolvedApis) lines.push(`- ${api.method} \`${api.path}\` 근거: ${mdLink(api.evidence.file, api.evidence.line)}`);
    }
    lines.push('');
    lines.push('### Backend');
    lines.push('');
    for (const controller of route.backend.controllers) lines.push(`- Controller: ${controller.className}.${controller.methodName} ${mdLink(controller.file, controller.evidence.line)}`);
    for (const service of route.backend.services) lines.push(`- Service: ${service.className} ${mdLink(service.file, service.evidence.line)}`);
    lines.push('');
    lines.push('### 연결 테이블');
    lines.push('');
    lines.push('| 테이블 | 구분 | 주요 컬럼 | 근거 |');
    lines.push('| --- | --- | --- | --- |');
    const tableRows = [];
    for (const entity of route.dataAccess.entities) {
      tableRows.push({
        table: entity.table,
        kind: `Entity: ${entity.name}`,
        columns: columnSummary(entity.columns),
        evidence: mdLink(entity.file, entity.evidence.line),
      });
    }
    for (const raw of route.dataAccess.rawSql) {
      for (const table of raw.tables) {
        tableRows.push({
          table,
          kind: 'Raw SQL',
          columns: '-',
          evidence: mdLink(raw.evidence.file, raw.evidence.line),
        });
      }
    }
    for (const row of uniqueBy(tableRows, (r) => `${r.table}.${r.kind}.${r.evidence}`)) {
      lines.push(`| \`${row.table}\` | ${row.kind} | ${row.columns} | ${row.evidence} |`);
    }
    lines.push('');
    lines.push('### TypeORM / DB 연결');
    lines.push('');
    lines.push('Service는 TypeORM Repository 또는 QueryRunner를 통해 Entity/Table에 접근합니다. Raw SQL이 있으면 TypeORM Entity만으로 추적되지 않으므로 SQL 근거를 함께 확인해야 합니다.');
    lines.push('');
    for (const entity of route.dataAccess.entities) lines.push(`- Entity: ${entity.name} -> \`${entity.table}\` ${mdLink(entity.file, entity.evidence.line)}`);
    for (const raw of route.dataAccess.rawSql) lines.push(`- Raw SQL: ${raw.tables.join(', ') || 'table unresolved'} 근거: ${mdLink(raw.evidence.file, raw.evidence.line)}`);
    lines.push('');
    lines.push('### Related Tests');
    lines.push('');
    for (const test of route.tests) lines.push(`- ${mdLink(test.file, test.evidence.line)}`);
    lines.push('');
    lines.push('### 수정할 때 어디를 보나');
    lines.push('');
    lines.push(`- 화면 문구/레이아웃: ${route.modifyGuide.ui.slice(0, 5).map((n) => mdLink(n.file, n.evidence?.line)).join(', ')}`);
    lines.push(`- 입력폼/검증: ${route.modifyGuide.validation.slice(0, 5).map((n) => mdLink(n.file, n.evidence?.line)).join(', ') || '-'}`);
    lines.push(`- API 요청/응답: ${route.modifyGuide.api.slice(0, 5).map((n) => mdLink(n.file, n.evidence?.line)).join(', ')}`);
    lines.push(`- 업무 로직: ${route.modifyGuide.businessLogic.slice(0, 5).map((n) => mdLink(n.file, n.evidence?.line)).join(', ')}`);
    lines.push(`- TypeORM/DB: ${route.modifyGuide.database.slice(0, 5).map((n) => n.file ? mdLink(n.file, n.evidence?.line) : `\`${n.name}\``).join(', ')}`);
    lines.push(`- 테스트: ${route.modifyGuide.tests.slice(0, 5).map((n) => mdLink(n.file, n.evidence?.line)).join(', ')}`);
    lines.push('');
    if (route.missing.length || route.unresolved.length) {
      lines.push('### Missing / Unresolved');
      lines.push('');
      for (const item of route.missing) lines.push(`- missing: ${item}`);
      for (const item of route.unresolved) lines.push(`- unresolved: ${item.reason ?? item.kind}`);
      lines.push('');
    }
  }
  while (lines.at(-1) === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return hash;
}

export async function generateCodeMap(options = {}) {
  const routes = options.routes ?? DEFAULT_ROUTES;
  const project = createProject();
  const [menuMap, routeMap, controllers, entityMap] = await Promise.all([
    scanMenu(project),
    scanRoutes(),
    scanControllers(project),
    scanEntities(project),
  ]);

  const entries = [];
  for (const route of routes) {
    const page = routeMap.get(route);
    const frontend = page
      ? await collectFrontendGraph(project, page)
      : { graph: { nodes: [], edges: [] }, apiFlow: [], labels: [], actions: [], unresolved: [{ kind: 'page', reason: 'page not found' }] };

    const matchedControllers = [];
    const resolvedApiFlow = [];
    const services = [];
    const dataAccess = { typeorm: [], rawSql: [], entities: [], tables: [], sequences: [], views: [] };
    for (const api of frontend.apiFlow) {
      const scored = controllers
        .filter((controller) => controller.method === api.method)
        .map((controller) => ({ controller, score: routeMatchScore(api.path, controller.path) }))
        .filter((item) => item.score >= 0);
      const maxScore = Math.max(-1, ...scored.map((item) => item.score));
      const matches = scored.filter((item) => item.score === maxScore).map((item) => item.controller);
      const apiServiceCalls = [];
      const apiTables = [];
      for (const controller of matches) {
        matchedControllers.push({ ...controller, apiPath: api.path });
        for (const call of controller.serviceCalls) {
          const serviceFile = await findServiceFile(call.serviceClass);
          const scanned = scanServiceDataAccess(project, serviceFile, entityMap);
          const methodScanned = scanServiceMethodDataAccess(project, serviceFile, call.method, entityMap);
          const serviceMethodEvidence = findServiceMethodEvidence(project, serviceFile, call.method);
          services.push(...scanned.services);
          dataAccess.typeorm.push(...scanned.typeorm);
          dataAccess.rawSql.push(...scanned.rawSql);
          dataAccess.entities.push(...scanned.entities);
          dataAccess.tables.push(...scanned.tables);
          apiServiceCalls.push({
            ...call,
            file: serviceFile ? rel(serviceFile) : null,
            absolutePath: serviceFile ? abs(rel(serviceFile)) : null,
            evidence: serviceMethodEvidence ?? call.evidence,
            tables: uniqueBy(methodScanned.tables, (table) => table.name),
          });
          apiTables.push(...methodScanned.tables);
        }
      }
      const controller = matches[0] ?? null;
      resolvedApiFlow.push({
        ...api,
        resolutionStatus: controller ? 'RESOLVED' : 'UNRESOLVED',
        controller: controller
          ? {
              className: controller.className,
              methodName: controller.methodName,
              path: controller.path,
              file: controller.file,
              absolutePath: controller.absolutePath,
              evidence: controller.evidence,
            }
          : null,
        controllerCandidates: matches.map((match) => ({
          className: match.className,
          methodName: match.methodName,
          path: match.path,
          file: match.file,
          absolutePath: match.absolutePath,
          evidence: match.evidence,
        })),
        serviceCalls: uniqueBy(apiServiceCalls, (call) => `${call.serviceClass}.${call.method}.${call.file}`),
        tables: uniqueBy(apiTables, (table) => table.name),
      });
    }

    const serviceNames = uniqueBy(services, (s) => s.className).map((s) => s.className);
    const controllerNames = uniqueBy(matchedControllers, (c) => c.className).map((c) => c.className);
    const tests = await scanTests([...serviceNames, ...controllerNames], route);

    const entry = {
      route,
      menu: menuMap.get(route) ?? { registered: false, code: null, labelKey: null, label: null, parentCodes: [] },
      type: frontend.apiFlow.length > 0 ? 'DATA_PAGE' : 'UI_ONLY_PAGE',
      status: 'INCOMPLETE',
      frontend: {
        page: page ? { file: page, absolutePath: abs(page), line: 1 } : null,
        labels: frontend.labels,
        actions: frontend.actions,
        graph: frontend.graph,
      },
      apiFlow: uniqueBy(resolvedApiFlow, (api) => `${api.method}.${api.path}.${api.evidence.file}.${api.evidence.line}`),
      backend: {
        controllers: uniqueBy(matchedControllers, (c) => `${c.className}.${c.methodName}.${c.apiPath}`),
        services: uniqueBy(services, (s) => s.className),
        dependencyGraph: { nodes: [], edges: [] },
      },
      dataAccess: {
        typeorm: uniqueBy(dataAccess.typeorm, (t) => `${t.kind}.${t.entity}.${t.evidence.file}.${t.evidence.line}`),
        rawSql: uniqueBy(dataAccess.rawSql, (r) => `${r.evidence.file}.${r.evidence.line}`),
        entities: uniqueBy(dataAccess.entities, (e) => e.name),
        tables: uniqueBy(dataAccess.tables, (t) => t.name),
        sequences: [],
        views: [],
      },
      tests,
      modifyGuide: {},
      missing: [],
      unresolved: frontend.unresolved,
    };
    entry.modifyGuide = buildModifyGuide(entry);
    const status = statusFor(entry);
    entry.status = status.status;
    entry.missing = status.missing;
    entries.push(entry);
  }

  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repoRoot: slash(repoRoot),
    scope: { routes, mode: 'pilot' },
    routes: entries,
  };
  index.markdown = renderMarkdown(index);

  if (options.write !== false) {
    await fs.mkdir(path.dirname(outJson), { recursive: true });
    await fs.mkdir(path.dirname(outMd), { recursive: true });
    const { markdown, ...jsonIndex } = index;
    await fs.writeFile(outJson, `${JSON.stringify(jsonIndex, null, 2)}\n`, 'utf8');
    await fs.writeFile(outMd, markdown, 'utf8');
  }
  return index;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const routesArg = process.argv.find((arg) => arg.startsWith('--routes='));
  const routes = routesArg ? routesArg.slice('--routes='.length).split(',').map((item) => item.trim()).filter(Boolean) : DEFAULT_ROUTES;
  await generateCodeMap({ routes, write: true });
  console.log(`Generated code map for ${routes.length} route(s).`);
}
