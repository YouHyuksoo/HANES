import json
import oracledb
from pathlib import Path

cfg = json.loads((Path.home() / '.oracle_db_config.json').read_text())
sites = cfg.get('profiles', cfg.get('sites', {}))

TABLES = [
    'DEFECT_CATEGORY_MASTERS',
    'DEFECT_CODE_MASTERS',
    'DEFECT_CODE_PRODUCT_TYPES',
]
CONSTRAINTS = [
    ('DEFECT_CATEGORY_MASTERS', 'FK_DEFECT_CATEGORY_PARENT'),
    ('DEFECT_CODE_MASTERS', 'FK_DEFECT_CODE_CATEGORY'),
    ('DEFECT_CODE_PRODUCT_TYPES', 'FK_DEFECT_PRODUCT_CODE'),
]


def connect(name):
    s = sites[name]
    dsn = oracledb.makedsn(s['host'], int(s['port']), service_name=s['service_name'])
    return oracledb.connect(user=s['user'], password=s['password'], dsn=dsn)


def q(name):
    return '"' + name.replace('"', '""') + '"'


def copy_table(remote_cur, local_cur, local_con, table):
    remote_cur.execute('select column_name from user_tab_columns where table_name=:t order by column_id', [table])
    cols = [r[0] for r in remote_cur.fetchall()]
    col_list = ', '.join(q(c) for c in cols)
    binds = ', '.join(f':{i + 1}' for i in range(len(cols)))
    local_cur.execute(f'DELETE FROM {q(table)}')
    remote_cur.execute(f'SELECT {col_list} FROM {q(table)}')
    total = 0
    while True:
        rows = remote_cur.fetchmany(1000)
        if not rows:
            break
        batch = [[v.read() if hasattr(v, 'read') else v for v in row] for row in rows]
        local_cur.executemany(f'INSERT INTO {q(table)} ({col_list}) VALUES ({binds})', batch)
        total += len(batch)
    local_con.commit()
    return total


def main():
    remote = connect('JSHANES')
    local = connect('MYDBPDB')
    rc = remote.cursor()
    lc = local.cursor()
    rc.arraysize = 1000

    # Disable only the three known self/child FK constraints that blocked the final copy.
    for table, constraint in CONSTRAINTS:
        try:
            lc.execute(f'ALTER TABLE {q(table)} DISABLE CONSTRAINT {q(constraint)}')
            print('DISABLE_OK', table, constraint)
        except Exception as exc:
            print('DISABLE_WARN', table, constraint, str(exc).split('\n')[0])
    local.commit()

    # Delete child tables first, then parent, copy parent first, then children.
    for table in reversed(TABLES):
        lc.execute(f'DELETE FROM {q(table)}')
        print('DELETE_OK', table)
    local.commit()

    for table in TABLES:
        copied = copy_table(rc, lc, local, table)
        print('COPY_OK', table, copied)

    # Restore constraints. Use VALIDATE when data permits; fall back to NOVALIDATE only if legacy source data is inconsistent.
    for table, constraint in CONSTRAINTS:
        try:
            lc.execute(f'ALTER TABLE {q(table)} ENABLE VALIDATE CONSTRAINT {q(constraint)}')
            local.commit()
            print('ENABLE_VALIDATE_OK', table, constraint)
        except Exception as exc:
            local.rollback()
            lc.execute(f'ALTER TABLE {q(table)} ENABLE NOVALIDATE CONSTRAINT {q(constraint)}')
            local.commit()
            print('ENABLE_NOVALIDATE_OK', table, constraint, str(exc).split('\n')[0])

    # Compile invalid objects once after data repair.
    for _ in range(2):
        lc.execute("select object_type, object_name from user_objects where status <> 'VALID' order by object_type, object_name")
        invalids = lc.fetchall()
        for obj_type, name in invalids:
            try:
                if obj_type == 'PACKAGE BODY':
                    lc.execute(f'ALTER PACKAGE {q(name)} COMPILE BODY')
                elif obj_type == 'PACKAGE':
                    lc.execute(f'ALTER PACKAGE {q(name)} COMPILE')
                elif obj_type in ('FUNCTION', 'PROCEDURE', 'TRIGGER', 'VIEW'):
                    lc.execute(f'ALTER {obj_type} {q(name)} COMPILE')
            except Exception:
                pass
        local.commit()

    rc.execute('select table_name from user_tables order by table_name')
    remote_tables = [r[0] for r in rc.fetchall()]
    lc.execute('select table_name from user_tables order by table_name')
    local_tables = [r[0] for r in lc.fetchall()]

    mismatches = []
    for table in remote_tables:
        rc.execute(f'SELECT COUNT(*) FROM {q(table)}')
        remote_count = rc.fetchone()[0]
        lc.execute(f'SELECT COUNT(*) FROM {q(table)}')
        local_count = lc.fetchone()[0]
        if remote_count != local_count:
            mismatches.append((table, remote_count, local_count))

    lc.execute("select object_type, object_name from user_objects where status <> 'VALID' order by object_type, object_name")
    invalids = lc.fetchall()
    lc.execute("select table_name, constraint_name, constraint_type, status, validated from user_constraints where status <> 'ENABLED' order by table_name, constraint_name")
    disabled = lc.fetchall()
    lc.execute("select table_name, constraint_name, constraint_type, validated from user_constraints where status='ENABLED' and validated <> 'VALIDATED' order by table_name, constraint_name")
    novalidated = lc.fetchall()

    print('FINAL_TABLES remote', len(remote_tables), 'local', len(local_tables), 'missing', sorted(set(remote_tables) - set(local_tables)), 'extra', sorted(set(local_tables) - set(remote_tables)))
    print('FINAL_ROWCOUNT_MISMATCHES total', len(mismatches), mismatches)
    print('FINAL_INVALID_OBJECTS total', len(invalids), invalids)
    print('FINAL_DISABLED_CONSTRAINTS total', len(disabled), disabled)
    print('FINAL_NOVALIDATED_CONSTRAINTS total', len(novalidated), novalidated[:50])

    remote.close()
    local.close()
    return 0 if not mismatches and not disabled and not (set(remote_tables) - set(local_tables)) else 2


if __name__ == '__main__':
    raise SystemExit(main())
