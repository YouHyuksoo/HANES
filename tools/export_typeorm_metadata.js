const path = require('path');
const { createRequire } = require('module');

const backendRoot = path.resolve(__dirname, '..', 'apps', 'backend');
const backendRequire = createRequire(path.join(backendRoot, 'package.json'));

backendRequire('ts-node/register');
backendRequire('tsconfig-paths/register');
backendRequire('reflect-metadata');

const { DataSource } = backendRequire('typeorm');

function normalizeType(type) {
  if (typeof type === 'string') {
    return type.toUpperCase();
  }
  if (typeof type === 'function') {
    return type.name.toUpperCase();
  }
  return String(type).toUpperCase();
}

async function main() {
  const dataSource = new DataSource({
    type: 'oracle',
    entities: [path.join(backendRoot, 'src', 'entities', '*.entity.ts')],
    synchronize: false,
  });

  await dataSource.buildMetadatas();

  const entities = dataSource.entityMetadatas
    .map((entity) => ({
      entity: entity.name,
      tableName: entity.tableName.toUpperCase(),
      columns: entity.columns.map((column) => ({
        propertyName: column.propertyName,
        columnName: column.databaseName.toUpperCase(),
        type: normalizeType(column.type),
        length: column.length || null,
        precision: column.precision ?? null,
        scale: column.scale ?? null,
        nullable: column.isNullable,
        primary: column.isPrimary,
        generated: column.isGenerated,
        default:
          typeof column.default === 'function'
            ? column.default()
            : column.default === undefined
              ? null
              : column.default,
      })),
      primaryColumns: entity.primaryColumns.map((column) => column.databaseName.toUpperCase()),
    }))
    .sort((a, b) => a.tableName.localeCompare(b.tableName));

  process.stdout.write(JSON.stringify({ entities }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
