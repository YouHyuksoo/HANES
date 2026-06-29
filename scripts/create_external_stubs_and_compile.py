import json
import oracledb
from pathlib import Path

cfg = json.loads((Path.home() / '.oracle_db_config.json').read_text())
sites = cfg.get('profiles', cfg.get('sites', {})

)
APPS_OBJECTS = ['MTL_SYSTEM_ITEMS', 'MTL_SYSTEM_ITEMS_B', 'XXPO_MES_ORAERP_PO_V']


def dsn(s):
    return oracledb.makedsn(s['host'], int(s['port']), service_name=s['service_name'])


def connect(name, sysdba=False):
    s = sites[name]
    mode = oracledb.AUTH_MODE_SYSDBA if sysdba else oracledb.AUTH_MODE_DEFAULT
    return oracledb.connect(user=s['user'], password=s['password'], dsn=dsn(s), mode=mode)


def q(name):
    return '"' + name.replace('"', '""') + '"'


def col_type(row):
    _, data_type, data_length, precision, scale, char_length, char_used, nullable = row
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


def ensure_user(cur, user, password):
    cur.execute('select count(*) from dba_users where username=:u', [user])
    if cur.fetchone()[0] == 0:
        cur.execute(f'CREATE USER {q(user)} IDENTIFIED BY "{password}" DEFAULT TABLESPACE USERS TEMPORARY TABLESPACE TEMP QUOTA UNLIMITED ON USERS')
        print('CREATE_USER_OK', user)
    cur.execute(f'GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW TO {q(user)}')


def create_stub_from_remote(remote_cur, owner, obj, local_cur):
    remote_cur.execute(
        """
        select column_name, data_type, data_length, data_precision, data_scale, char_length, char_used, nullable
        from all_tab_columns
        where owner=:owner and table_name=:obj
        order by column_id
        """,
        [owner, obj],
    )
    cols = remote_cur.fetchall()
    if not cols:
        raise RuntimeError(f'no remote columns for {owner}.{obj}')
    parts = []
    for row in cols:
        part = f'{q(row[0])} {col_type(row)}'
        # Keep stubs permissive for compile/runtime inserts are not expected.
        parts.append(part)
    local_cur.execute(f'CREATE TABLE {q(owner)}.{q(obj)} ({", ".join(parts)})')
    print('CREATE_STUB_OK', owner, obj, len(cols), 'columns')


def main():
    remote = connect('JSHANES')
    rc = remote.cursor()
    admin = connect('MYDBPDB_ADMIN', True)
    ac = admin.cursor()
    ensure_user(ac, 'APPS', 'apps')
    admin.commit()

    for obj in APPS_OBJECTS:
        ac.execute('select count(*) from all_objects where owner=:o and object_name=:n', ['APPS', obj])
        if ac.fetchone()[0] == 0:
            create_stub_from_remote(rc, 'APPS', obj, ac)
        ac.execute(f'GRANT SELECT ON {q("APPS")}.{q(obj)} TO {q("HNSMES")}')
        print('GRANT_OK', 'APPS', obj)
    admin.commit()
    admin.close()
    remote.close()

    local = connect('MYDBPDB')
    lc = local.cursor()
    for proc in ['IF_ITEM_MASTER', 'IF_PO']:
        try:
            lc.execute(f'ALTER PROCEDURE {q(proc)} COMPILE')
            local.commit()
            print('COMPILE_OK', proc)
        except Exception as exc:
            local.rollback()
            print('COMPILE_ERR', proc, str(exc).split('\n')[0])

    lc.execute("select object_type, object_name from user_objects where status <> 'VALID' order by object_type, object_name")
    invalids = lc.fetchall()
    lc.execute('select name,type,line,position,text from user_errors order by name,type,sequence')
    errors = lc.fetchall()
    print('FINAL_INVALID_OBJECTS total', len(invalids), invalids)
    print('FINAL_USER_ERRORS total', len(errors), errors[:80])
    local.close()
    return 0 if not invalids else 2


if __name__ == '__main__':
    raise SystemExit(main())
