import json
import re
import subprocess
from pathlib import Path
import oracledb

cfg = json.loads((Path.home() / '.oracle_db_config.json').read_text())
sites = cfg.get('profiles', cfg.get('sites', {}))

OBJECTS = [
    ('FUNCTION', 'F_GET_CON_UID'),
    ('FUNCTION', 'F_GET_MAT_UID'),
    ('FUNCTION', 'F_GET_PRD_UID'),
    ('PACKAGE', 'PKG_DASHBOARD'),
    ('PACKAGE BODY', 'PKG_DASHBOARD'),
    ('PACKAGE', 'PKG_SEQ_GENERATOR'),
    ('PACKAGE BODY', 'PKG_SEQ_GENERATOR'),
    ('PACKAGE', 'PKG_WORKFLOW'),
    ('PACKAGE BODY', 'PKG_WORKFLOW'),
    ('PROCEDURE', 'IF_ITEM_MASTER'),
    ('PROCEDURE', 'IF_PO'),
    ('TRIGGER', 'TRG_PHYSICAL_INV_SESSIONS_UPD'),
]


def connect(name):
    s = sites[name]
    dsn = oracledb.makedsn(s['host'], int(s['port']), service_name=s['service_name'])
    return oracledb.connect(user=s['user'], password=s['password'], dsn=dsn)


def source_sql(cur, obj_type, name):
    cur.execute('select text from user_source where type=:typ and name=:name order by line', [obj_type, name])
    body = ''.join(row[0] for row in cur.fetchall()).replace('\r\n', '\n').strip()
    if not body:
        raise RuntimeError(f'no source for {obj_type} {name}')
    body = re.sub(r'^CREATE\s+OR\s+REPLACE\s+EDITIONABLE\s+', '', body, flags=re.I)
    body = re.sub(r'^CREATE\s+OR\s+REPLACE\s+', '', body, flags=re.I)
    body = re.sub(r'^CREATE\s+EDITIONABLE\s+', '', body, flags=re.I)
    body = re.sub(r'^CREATE\s+', '', body, flags=re.I)
    return 'CREATE OR REPLACE ' + body.rstrip(';') + ';'


def main():
    remote = connect('JSHANES')
    rc = remote.cursor()
    sql_path = Path('C:/Project/HANES/db_dumps/recreate_invalid_plsql.sql')
    parts = [
        'set define off',
        'set sqlblanklines on',
        'set serveroutput on',
        'whenever sqlerror continue',
    ]
    for obj_type, name in OBJECTS:
        parts.append(f'prompt RECREATE {obj_type} {name}')
        parts.append(source_sql(rc, obj_type, name))
        parts.append('/')
    parts.append('show errors')
    sql_path.write_text('\n'.join(parts) + '\n', encoding='utf-8')
    remote.close()

    local = sites['MYDBPDB']
    userid = f"{local['user']}/{local['password']}@//{local['host']}:{local['port']}/{local['service_name']}"
    sqlplus_input = f"connect {userid}\n@{sql_path.as_posix()}\nexit\n"
    res = subprocess.run(['sqlplus', '-S', '/nolog'], input=sqlplus_input, text=True, capture_output=True, timeout=600)
    safe_out = (res.stdout + res.stderr).replace(local['password'], '***')
    print(safe_out[-20000:])
    print('SQLPLUS_EXIT', res.returncode)

    con = connect('MYDBPDB')
    cur = con.cursor()
    for _ in range(2):
        cur.execute("select object_type, object_name from user_objects where status <> 'VALID' order by object_type, object_name")
        for obj_type, name in cur.fetchall():
            try:
                if obj_type == 'PACKAGE BODY':
                    cur.execute(f'ALTER PACKAGE "{name}" COMPILE BODY')
                elif obj_type == 'PACKAGE':
                    cur.execute(f'ALTER PACKAGE "{name}" COMPILE')
                elif obj_type in ('FUNCTION', 'PROCEDURE', 'TRIGGER', 'VIEW'):
                    cur.execute(f'ALTER {obj_type} "{name}" COMPILE')
            except Exception:
                pass
        con.commit()
    cur.execute("select object_type, object_name from user_objects where status <> 'VALID' order by object_type, object_name")
    invalids = cur.fetchall()
    cur.execute('select name,type,line,position,text from user_errors order by name,type,sequence')
    errors = cur.fetchall()
    print('FINAL_INVALID_OBJECTS total', len(invalids), invalids)
    print('FINAL_USER_ERRORS total', len(errors), errors[:80])
    con.close()
    return 0 if not invalids else 2


if __name__ == '__main__':
    raise SystemExit(main())
