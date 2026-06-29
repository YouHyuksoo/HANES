import json
import re
import oracledb
from pathlib import Path

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


def q(name):
    return '"' + name.replace('"', '""') + '"'


def source_sql(cur, obj_type, name):
    cur.execute(
        'select text from user_source where type=:typ and name=:name order by line',
        [obj_type, name],
    )
    text = ''.join(row[0] for row in cur.fetchall())
    if not text.strip():
        raise RuntimeError(f'no source for {obj_type} {name}')
    text = text.replace('\r\n', '\n')
    text = re.sub(r'CREATE\s+OR\s+REPLACE\s+EDITIONABLE\s+', 'CREATE OR REPLACE ', text, flags=re.I)
    text = re.sub(r'CREATE\s+EDITIONABLE\s+', 'CREATE ', text, flags=re.I)
    # Remove trailing SQL*Plus slash if present.
    text = re.sub(r'\n/\s*$', '\n', text.strip(), flags=re.S)
    return text.strip()


def main():
    remote = connect('JSHANES')
    local = connect('MYDBPDB')
    rc = remote.cursor()
    lc = local.cursor()

    for obj_type, name in OBJECTS:
        sql = source_sql(rc, obj_type, name)
        try:
            lc.execute(sql)
            local.commit()
            print('RECREATE_OK', obj_type, name)
        except Exception as exc:
            local.rollback()
            print('RECREATE_ERR', obj_type, name, str(exc).split('\n')[0])

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

    lc.execute("select object_type, object_name from user_objects where status <> 'VALID' order by object_type, object_name")
    invalids = lc.fetchall()
    lc.execute('select name,type,line,position,text from user_errors order by name,type,sequence')
    errors = lc.fetchall()
    print('FINAL_INVALID_OBJECTS total', len(invalids), invalids)
    print('FINAL_USER_ERRORS total', len(errors), errors[:80])

    remote.close()
    local.close()
    return 0 if not invalids else 2


if __name__ == '__main__':
    raise SystemExit(main())
