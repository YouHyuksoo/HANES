import json
import oracledb
from pathlib import Path

cfg = json.loads((Path.home() / '.oracle_db_config.json').read_text())
sites = cfg.get('profiles', cfg.get('sites', {}))


def connect(name):
    s = sites[name]
    dsn = oracledb.makedsn(s['host'], int(s['port']), service_name=s['service_name'])
    return oracledb.connect(user=s['user'], password=s['password'], dsn=dsn)


def q(name):
    return '"' + name.replace('"', '""') + '"'


def col_type(row):
    _, data_type, data_length, precision, scale, char_length, char_used, _ = row
    if data_type in ('VARCHAR2', 'CHAR', 'NCHAR', 'NVARCHAR2'):
        if char_used == 'C' and char_length:
            return f'{data_type}({char_length} CHAR)'
        return f'{data_type}({data_length} BYTE)'
    if data_type == 'NUMBER':
        if precision is None:
            return 'NUMBER'
        if scale is None:
            return f'NUMBER({precision})'
        return f'NUMBER({precision},{scale})'
    if data_type == 'RAW':
        return f'RAW({data_length})'
    if data_type.startswith('TIMESTAMP'):
        return data_type
    return data_type


def create_table_from_remote(rc, lc, con, table):
    rc.execute(
        """
        select column_name, data_type, data_length, data_precision, data_scale,
               char_length, char_used, nullable
        from user_tab_columns
        where table_name = :t
        order by column_id
        """,
        [table],
    )
    cols = rc.fetchall()
    if not cols:
        raise RuntimeError(f'no columns for {table}')
    parts = []
    for row in cols:
        col_name = row[0]
        nullable = row[7]
        part = f'{q(col_name)} {col_type(row)}'
        if nullable == 'N':
            part += ' NOT NULL'
        parts.append(part)
    lc.execute(f'CREATE TABLE {q(table)} ({", ".join(parts)})')
    con.commit()


def copy_table(rc, lc, con, table):
    rc.execute('select column_name from user_tab_columns where table_name=:t order by column_id', [table])
    cols = [r[0] for r in rc.fetchall()]
    col_list = ', '.join(q(c) for c in cols)
    binds = ', '.join(f':{i + 1}' for i in range(len(cols)))
    lc.execute(f'DELETE FROM {q(table)}')
    rc.execute(f'SELECT {col_list} FROM {q(table)}')
    total = 0
    while True:
        rows = rc.fetchmany(1000)
        if not rows:
            break
        batch = []
        for row in rows:
            batch.append([v.read() if hasattr(v, 'read') else v for v in row])
        lc.executemany(f'INSERT INTO {q(table)} ({col_list}) VALUES ({binds})', batch)
        total += len(batch)
    con.commit()
    return total


def counts(rc, lc):
    rc.execute('select table_name from user_tables order by table_name')
    remote_tables = [r[0] for r in rc.fetchall()]
    lc.execute('select table_name from user_tables order by table_name')
    local_tables = [r[0] for r in lc.fetchall()]
    mismatches = []
    for table in remote_tables:
        rc.execute(f'select count(*) from {q(table)}')
        r_count = rc.fetchone()[0]
        try:
            lc.execute(f'select count(*) from {q(table)}')
            l_count = lc.fetchone()[0]
        except Exception:
            l_count = None
        if r_count != l_count:
            mismatches.append((table, r_count, l_count))
    return remote_tables, local_tables, mismatches


def main():
    remote = connect('JSHANES')
    local = connect('MYDBPDB')
    rc = remote.cursor()
    lc = local.cursor()
    rc.arraysize = 1000
    lc.arraysize = 1000

    remote_tables, local_tables, mismatches = counts(rc, lc)
    missing = sorted(set(remote_tables) - set(local_tables))
    print('BEFORE remote_tables', len(remote_tables), 'local_tables', len(local_tables), 'missing', missing)
    print('BEFORE mismatches', len(mismatches), mismatches)

    for table in missing:
        create_table_from_remote(rc, lc, local, table)
        print('CREATE_OK', table)

    # Recompute after creating missing tables, then copy only mismatched tables.
    remote_tables, local_tables, mismatches = counts(rc, lc)
    failed = []
    for table, r_count, l_count in mismatches:
        try:
            copied = copy_table(rc, lc, local, table)
            print('COPY_OK', table, copied, 'remote', r_count, 'previous_local', l_count)
        except Exception as exc:
            local.rollback()
            failed.append((table, str(exc).split('\n')[0]))
            print('COPY_ERR', table, str(exc).split('\n')[0])

    remote_tables, local_tables, mismatches = counts(rc, lc)
    lc.execute("select object_type, object_name from user_objects where status <> 'VALID' order by object_type, object_name")
    invalid = lc.fetchall()
    lc.execute("select table_name, constraint_name, constraint_type, status, validated from user_constraints where status <> 'ENABLED' order by table_name, constraint_name")
    disabled = lc.fetchall()

    print('FINAL remote_tables', len(remote_tables), 'local_tables', len(local_tables), 'missing', sorted(set(remote_tables) - set(local_tables)), 'extra', sorted(set(local_tables) - set(remote_tables)))
    print('FINAL mismatches', len(mismatches), mismatches)
    print('FINAL invalid_objects', len(invalid), invalid)
    print('FINAL disabled_constraints', len(disabled), disabled)
    print('FINAL failed', failed)

    remote.close()
    local.close()
    return 0 if not mismatches and not failed and not (set(remote_tables) - set(local_tables)) else 2


if __name__ == '__main__':
    raise SystemExit(main())
