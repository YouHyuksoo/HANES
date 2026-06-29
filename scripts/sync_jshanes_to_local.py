import json
import oracledb
import re
import sys
from pathlib import Path

cfg = json.loads((Path.home() / '.oracle_db_config.json').read_text())
sites = cfg.get('profiles', cfg.get('sites', {}))


def mkdsn(s):
    return oracledb.makedsn(s['host'], int(s['port']), service_name=s.get('service_name') or s.get('service'))


def conn_profile(name, sysdba=False):
    s = sites[name]
    mode = oracledb.AUTH_MODE_SYSDBA if sysdba or s.get('mode') == 'SYSDBA' else oracledb.AUTH_MODE_DEFAULT
    return oracledb.connect(user=s['user'], password=s['password'], dsn=mkdsn(s), mode=mode)


def txt(x):
    return x.read() if hasattr(x, 'read') else str(x)


def clean(ddl):
    ddl = txt(ddl)
    ddl = ddl.replace('"TEST".', '"HNSMES".')
    ddl = ddl.replace(' DEFAULT "TEST".', ' DEFAULT "HNSMES".')
    ddl = ddl.replace('CREATE TABLE "TEST".', 'CREATE TABLE "HNSMES".')
    ddl = ddl.replace('CREATE SEQUENCE "TEST".', 'CREATE SEQUENCE "HNSMES".')
    ddl = ddl.replace('CREATE INDEX "TEST".', 'CREATE INDEX "HNSMES".')
    ddl = ddl.replace('ALTER TABLE "TEST".', 'ALTER TABLE "HNSMES".')
    ddl = ddl.replace('CREATE OR REPLACE EDITIONABLE ', 'CREATE OR REPLACE ')
    ddl = ddl.replace('CREATE EDITIONABLE ', 'CREATE ')
    ddl = re.sub(r'\s+SEGMENT CREATION \w+', '', ddl, flags=re.I)
    ddl = re.sub(r'\s+TABLESPACE "[^"]+"', '', ddl, flags=re.I)
    ddl = re.sub(r'\s+PCTFREE \d+', '', ddl, flags=re.I)
    ddl = re.sub(r'\s+PCTUSED \d+', '', ddl, flags=re.I)
    ddl = re.sub(r'\s+INITRANS \d+', '', ddl, flags=re.I)
    ddl = re.sub(r'\s+MAXTRANS \d+', '', ddl, flags=re.I)
    ddl = re.sub(r'\s+STORAGE\s*\([^)]*\)', '', ddl, flags=re.I | re.S)
    ddl = re.sub(r'\s+LOGGING', '', ddl, flags=re.I)
    ddl = re.sub(r'\s+NOLOGGING', '', ddl, flags=re.I)
    ddl = re.sub(r'\s+NOCOMPRESS', '', ddl, flags=re.I)
    ddl = re.sub(r'\s+MONITORING', '', ddl, flags=re.I)
    return ddl.strip().rstrip(';')


def setup_metadata(cur):
    for k, v in [('SEGMENT_ATTRIBUTES', False), ('STORAGE', False), ('TABLESPACE', False), ('SQLTERMINATOR', False), ('PRETTY', True)]:
        try:
            cur.callproc('DBMS_METADATA.SET_TRANSFORM_PARAM', ['SESSION_TRANSFORM', k, v])
        except Exception:
            pass


def main():
    remote = conn_profile('JSHANES')
    rs = remote.cursor()
    setup_metadata(rs)
    print('PY_SYNC_START remote TEST -> local HNSMES', flush=True)

    admin = conn_profile('MYDBPDB_ADMIN', True)
    ac = admin.cursor()
    try:
        ac.execute('DROP USER HNSMES CASCADE')
        print('DROP_USER_OK', flush=True)
    except Exception as e:
        print('DROP_USER_WARN', str(e).split('\n')[0], flush=True)
    pwd = sites['MYDBPDB']['password'].replace('"', '""')
    ac.execute(f'CREATE USER HNSMES IDENTIFIED BY "{pwd}" DEFAULT TABLESPACE USERS TEMPORARY TABLESPACE TEMP QUOTA UNLIMITED ON USERS')
    for stmt in [
        'GRANT CONNECT, RESOURCE TO HNSMES',
        'GRANT CREATE SESSION TO HNSMES',
        'GRANT CREATE TABLE TO HNSMES',
        'GRANT CREATE VIEW TO HNSMES',
        'GRANT CREATE SEQUENCE TO HNSMES',
        'GRANT CREATE PROCEDURE TO HNSMES',
        'GRANT CREATE TRIGGER TO HNSMES',
        'GRANT CREATE DATABASE LINK TO HNSMES',
        'GRANT CREATE JOB TO HNSMES',
    ]:
        ac.execute(stmt)
    admin.commit()
    admin.close()
    print('TARGET_USER_READY', flush=True)

    local = conn_profile('MYDBPDB')
    lc = local.cursor()
    setup_metadata(lc)

    rs.execute('select sequence_name from user_sequences order by sequence_name')
    sequences = [r[0] for r in rs]
    rs.execute('select table_name from user_tables order by table_name')
    tables = [r[0] for r in rs]
    print('REMOTE_COUNTS sequences', len(sequences), 'tables', len(tables), flush=True)

    for name in sequences:
        try:
            rs.execute("select dbms_metadata.get_ddl('SEQUENCE', :n) from dual", [name])
            lc.execute(clean(rs.fetchone()[0]))
            print('SEQ_OK', name, flush=True)
        except Exception as e:
            print('SEQ_ERR', name, str(e).split('\n')[0], flush=True)
    local.commit()

    for k, v in [('CONSTRAINTS', False), ('REF_CONSTRAINTS', False), ('CONSTRAINTS_AS_ALTER', False), ('INDEXES', False)]:
        try:
            rs.callproc('DBMS_METADATA.SET_TRANSFORM_PARAM', ['SESSION_TRANSFORM', k, v])
        except Exception:
            pass

    create_failed = []
    for t in tables:
        try:
            rs.execute("select dbms_metadata.get_ddl('TABLE', :t) from dual", [t])
            lc.execute(clean(rs.fetchone()[0]))
            print('TABLE_OK', t, flush=True)
        except Exception as e:
            create_failed.append((t, str(e).split('\n')[0]))
            print('TABLE_ERR', t, str(e).split('\n')[0], flush=True)
    local.commit()

    copy_failed = []
    for t in tables:
        if any(x[0] == t for x in create_failed):
            continue
        try:
            rs.execute('select column_name from user_tab_columns where table_name=:t order by column_id', [t])
            cols = [r[0] for r in rs]
            col_list = ', '.join('"%s"' % c for c in cols)
            binds = ', '.join(':%d' % (i + 1) for i in range(len(cols)))
            rs.execute(f'SELECT {col_list} FROM "{t}"')
            total = 0
            while True:
                rows = rs.fetchmany(1000)
                if not rows:
                    break
                batch = []
                for row in rows:
                    batch.append([v.read() if hasattr(v, 'read') else v for v in row])
                lc.executemany(f'INSERT INTO "{t}" ({col_list}) VALUES ({binds})', batch)
                total += len(batch)
            local.commit()
            print('COPY_OK', t, total, flush=True)
        except Exception as e:
            local.rollback()
            copy_failed.append((t, str(e).split('\n')[0]))
            print('COPY_ERR', t, str(e).split('\n')[0], flush=True)

    for k, v in [('CONSTRAINTS', True), ('REF_CONSTRAINTS', True), ('CONSTRAINTS_AS_ALTER', True), ('INDEXES', True)]:
        try:
            rs.callproc('DBMS_METADATA.SET_TRANSFORM_PARAM', ['SESSION_TRANSFORM', k, v])
        except Exception:
            pass

    rs.execute("select index_name from user_indexes where generated='N' and index_name not in (select constraint_name from user_constraints where constraint_type in ('P','U')) order by index_name")
    indexes = [r[0] for r in rs]
    idx_failed = []
    for idx in indexes:
        try:
            rs.execute("select dbms_metadata.get_ddl('INDEX', :i) from dual", [idx])
            lc.execute(clean(rs.fetchone()[0]))
            local.commit()
            print('INDEX_OK', idx, flush=True)
        except Exception as e:
            local.rollback()
            idx_failed.append((idx, str(e).split('\n')[0]))
            print('INDEX_WARN', idx, str(e).split('\n')[0], flush=True)

    for ctype, label in [('P', 'PK'), ('U', 'UK'), ('C', 'CHECK')]:
        rs.execute("select constraint_name from user_constraints where constraint_type=:c order by constraint_name", [ctype])
        for (c,) in rs.fetchall():
            try:
                rs.execute("select dbms_metadata.get_ddl('CONSTRAINT', :c) from dual", [c])
                lc.execute(clean(rs.fetchone()[0]))
                local.commit()
                print(label + '_OK', c, flush=True)
            except Exception as e:
                local.rollback()
                print(label + '_WARN', c, str(e).split('\n')[0], flush=True)

    rs.execute("select constraint_name from user_constraints where constraint_type='R' order by constraint_name")
    for (c,) in rs.fetchall():
        try:
            rs.execute("select dbms_metadata.get_ddl('REF_CONSTRAINT', :c) from dual", [c])
            ddl = clean(rs.fetchone()[0])
            ddl = re.sub(r'\s+ENABLE\s*$', ' ENABLE NOVALIDATE', ddl, flags=re.I)
            lc.execute(ddl)
            local.commit()
            print('FK_OK', c, flush=True)
        except Exception as e:
            local.rollback()
            print('FK_WARN', c, str(e).split('\n')[0], flush=True)

    for objtype, query_type in [('VIEW', 'VIEW'), ('FUNCTION', 'FUNCTION'), ('PROCEDURE', 'PROCEDURE'), ('PACKAGE', 'PACKAGE'), ('PACKAGE BODY', 'PACKAGE_BODY'), ('TRIGGER', 'TRIGGER')]:
        rs.execute('select object_name from user_objects where object_type=:t order by object_name', [objtype])
        for (name,) in rs.fetchall():
            try:
                rs.execute(f"select dbms_metadata.get_ddl('{query_type}', :n) from dual", [name])
                lc.execute(clean(rs.fetchone()[0]))
                local.commit()
                print(objtype.replace(' ', '_') + '_OK', name, flush=True)
            except Exception as e:
                local.rollback()
                print(objtype.replace(' ', '_') + '_WARN', name, str(e).split('\n')[0], flush=True)

    rs.execute('select table_name from user_tables order by table_name')
    rt = [r[0] for r in rs]
    lc.execute('select table_name from user_tables order by table_name')
    lt = [r[0] for r in lc]
    missing = sorted(set(rt) - set(lt))
    extra = sorted(set(lt) - set(rt))
    mm = []
    for t in rt:
        rs.execute(f'select count(*) from "{t}"')
        rcnt = rs.fetchone()[0]
        try:
            lc.execute(f'select count(*) from "{t}"')
            lcnt = lc.fetchone()[0]
        except Exception:
            lcnt = None
        if rcnt != lcnt:
            mm.append((t, rcnt, lcnt))
    lc.execute("select object_type, object_name from user_objects where status <> 'VALID' order by object_type, object_name")
    invalid = lc.fetchall()
    lc.execute("select table_name,constraint_name,constraint_type,status,validated from user_constraints where status <> 'ENABLED' order by table_name,constraint_name")
    disabled = lc.fetchall()
    print('FINAL_TABLES remote', len(rt), 'local', len(lt), 'missing', missing, 'extra', extra, flush=True)
    print('FINAL_ROWCOUNT_MISMATCHES total', len(mm), mm[:100], flush=True)
    print('FINAL_INVALID_OBJECTS total', len(invalid), invalid[:100], flush=True)
    print('FINAL_DISABLED_CONSTRAINTS total', len(disabled), disabled[:100], flush=True)
    print('FAILED_SUMMARY create', create_failed, 'copy', copy_failed, 'idx', idx_failed, flush=True)
    local.close()
    remote.close()
    return 0 if not missing and not mm else 2


if __name__ == '__main__':
    sys.exit(main())
