import json
import oracledb
from pathlib import Path

cfg = json.loads((Path.home() / '.oracle_db_config.json').read_text())
sites = cfg.get('profiles', cfg.get('sites', {}))


def connect(name, sysdba=False):
    s = sites[name]
    mode = oracledb.AUTH_MODE_SYSDBA if sysdba else oracledb.AUTH_MODE_DEFAULT
    return oracledb.connect(
        user=s['user'],
        password=s['password'],
        dsn=oracledb.makedsn(s['host'], int(s['port']), service_name=s['service_name']),
        mode=mode,
    )


def q(name):
    return '"' + name.replace('"', '""') + '"'


def main():
    local_cfg = sites['MYDBPDB']
    local = connect('MYDBPDB')
    cur = local.cursor()

    for table in ['MTL_SYSTEM_ITEMS', 'XXPO_MES_ORAERP_PO_V']:
        cur.execute('select count(*) from user_tables where table_name=:t', [table])
        if cur.fetchone()[0]:
            cur.execute(f'DROP TABLE {q(table)} PURGE')
            print('DROP_STUB_OK', table)

    cur.execute('''
        CREATE TABLE MTL_SYSTEM_ITEMS (
            SEGMENT1 VARCHAR2(100),
            ATTRIBUTE3 VARCHAR2(400),
            ATTRIBUTE4 VARCHAR2(400),
            ITEM_TYPE VARCHAR2(30),
            PRIMARY_UOM_CODE VARCHAR2(30),
            ENABLED_FLAG VARCHAR2(1),
            LAST_UPDATE_DATE DATE,
            ORGANIZATION_ID NUMBER
        )
    ''')
    print('CREATE_STUB_OK MTL_SYSTEM_ITEMS')

    cur.execute('''
        CREATE TABLE XXPO_MES_ORAERP_PO_V (
            PO_NO VARCHAR2(100),
            VENDOR_NAME VARCHAR2(400),
            NEED_BY_DATE DATE,
            VENDOR_ID VARCHAR2(100),
            ORGANIZATION_ID NUMBER,
            OSP_TYPE VARCHAR2(10),
            LINE_NO NUMBER,
            REL_NO NUMBER,
            PART_NO VARCHAR2(100),
            QUANTITY NUMBER,
            QUANTITY_RECEIVED NUMBER,
            UNIT_PRICE NUMBER,
            H_CANCEL_FLAG VARCHAR2(1),
            L_CANCEL_FLAG VARCHAR2(1),
            H_CLOSED_CODE VARCHAR2(30),
            L_CLOSED_CODE VARCHAR2(30)
        )
    ''')
    print('CREATE_STUB_OK XXPO_MES_ORAERP_PO_V')
    local.commit()

    # Recreate private DB link ERP_PROD as loopback to this local HNSMES schema.
    try:
        cur.execute('DROP DATABASE LINK ERP_PROD')
        print('DROP_DBLINK_OK ERP_PROD')
    except Exception as exc:
        print('DROP_DBLINK_WARN ERP_PROD', str(exc).split('\n')[0])
    password = local_cfg['password'].replace('"', '""')
    host = local_cfg['host']
    port = local_cfg['port']
    service = local_cfg['service_name']
    cur.execute(
        f'''CREATE DATABASE LINK ERP_PROD
            CONNECT TO HNSMES IDENTIFIED BY "{password}"
            USING '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST={host})(PORT={port}))(CONNECT_DATA=(SERVICE_NAME={service})))'
        '''
    )
    print('CREATE_DBLINK_OK ERP_PROD loopback')
    local.commit()

    # Verify DB link can describe/query stubs.
    for table in ['MTL_SYSTEM_ITEMS', 'XXPO_MES_ORAERP_PO_V']:
        cur.execute(f'SELECT COUNT(*) FROM {table}@ERP_PROD')
        print('DBLINK_QUERY_OK', table, cur.fetchone()[0])

    for proc in ['IF_ITEM_MASTER', 'IF_PO']:
        cur.execute(f'ALTER PROCEDURE {q(proc)} COMPILE')
        local.commit()
        print('COMPILE_OK', proc)

    cur.execute('select table_name from user_tables order by table_name')
    local_tables = [r[0] for r in cur.fetchall()]
    cur.execute("select object_type, object_name from user_objects where status <> 'VALID' order by object_type, object_name")
    invalids = cur.fetchall()
    cur.execute('select name,type,line,position,text from user_errors order by name,type,sequence')
    errors = cur.fetchall()
    cur.execute("select table_name, constraint_name, constraint_type, status, validated from user_constraints where status <> 'ENABLED' order by table_name, constraint_name")
    disabled = cur.fetchall()
    cur.execute("select table_name, constraint_name, constraint_type, validated from user_constraints where status='ENABLED' and validated <> 'VALIDATED' order by table_name, constraint_name")
    novalidated = cur.fetchall()

    remote = connect('JSHANES')
    rc = remote.cursor()
    rc.execute('select table_name from user_tables order by table_name')
    remote_tables = [r[0] for r in rc.fetchall()]
    mismatches = []
    for table in remote_tables:
        rc.execute(f'SELECT COUNT(*) FROM {q(table)}')
        remote_count = rc.fetchone()[0]
        cur.execute(f'SELECT COUNT(*) FROM {q(table)}')
        local_count = cur.fetchone()[0]
        if remote_count != local_count:
            mismatches.append((table, remote_count, local_count))
    remote.close()

    app_extra = sorted(set(local_tables) - set(remote_tables))
    # ERP stubs are intentional local-only compile support, not TEST schema sync drift.
    app_extra_without_stubs = [t for t in app_extra if t not in ('MTL_SYSTEM_ITEMS', 'XXPO_MES_ORAERP_PO_V')]
    print('FINAL_TABLES remote', len(remote_tables), 'local', len(local_tables), 'missing', sorted(set(remote_tables) - set(local_tables)), 'extra_without_stubs', app_extra_without_stubs, 'intentional_stubs', [t for t in app_extra if t in ('MTL_SYSTEM_ITEMS', 'XXPO_MES_ORAERP_PO_V')])
    print('FINAL_ROWCOUNT_MISMATCHES total', len(mismatches), mismatches)
    print('FINAL_INVALID_OBJECTS total', len(invalids), invalids)
    print('FINAL_USER_ERRORS total', len(errors), errors[:80])
    print('FINAL_DISABLED_CONSTRAINTS total', len(disabled), disabled)
    print('FINAL_NOVALIDATED_CONSTRAINTS total', len(novalidated), novalidated[:50])

    local.close()
    return 0 if not mismatches and not invalids and not disabled and not (set(remote_tables) - set(local_tables)) else 2


if __name__ == '__main__':
    raise SystemExit(main())
