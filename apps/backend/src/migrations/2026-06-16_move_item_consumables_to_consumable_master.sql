DECLARE
  v_bak_count NUMBER := 0;
BEGIN
  -- 품목마스터에 남아 있는 소모품을 소모품마스터로 이동
  -- 사이트: JSHANES, COMPANY=40 / PLANT_CD=1000
  -- 대상: ITEM_MASTERS.ITEM_TYPE='CONSUMABLE'
  BEGIN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE ITEM_MASTERS_CONSUMABLE_BAK_20260616 AS
      SELECT *
      FROM ITEM_MASTERS
      WHERE COMPANY = '40'
        AND PLANT_CD = '1000'
        AND ITEM_TYPE = 'CONSUMABLE'
    ]';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE = -955 THEN
        NULL;
      ELSE
        RAISE;
      END IF;
  END;
  EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM ITEM_MASTERS_CONSUMABLE_BAK_20260616' INTO v_bak_count;

  IF v_bak_count = 0 THEN
    EXECUTE IMMEDIATE q'[
      INSERT INTO ITEM_MASTERS_CONSUMABLE_BAK_20260616 (
        ITEM_CODE,
        ITEM_NAME,
        PART_NO,
        ITEM_TYPE,
        PRODUCT_TYPE,
        UNIT,
        LEAD_TIME,
        SAFETY_STOCK,
        BOX_QTY,
        IQC_FLAG,
        TACT_TIME,
        EXPIRY_DATE,
        USE_YN,
        COMPANY,
        PLANT_CD,
        TOLERANCE_RATE,
        IS_SPLITTABLE,
        CREATED_AT,
        UPDATED_AT,
        EXPIRY_EXT_DAYS,
        MIN_PACK_QTY,
        IMAGE_URL
      )
      SELECT
        c.CONSUMABLE_CODE,
        c.NAME,
        c.CONSUMABLE_CODE,
        'CONSUMABLE',
        NULL,
        'EA',
        0,
        c.SAFETY_STOCK,
        0,
        'Y',
        0,
        0,
        c.USE_YN,
        c.COMPANY,
        c.PLANT_CD,
        5,
        'Y',
        c.CREATED_AT,
        c.UPDATED_AT,
        0,
        0,
        c.IMAGE_URL
      FROM CONSUMABLE_MASTERS c
      WHERE c.COMPANY = '40'
        AND c.PLANT_CD = '1000'
        AND c.CONSUMABLE_CODE IN (
          'APPCT-A','APPCT-B','APPCT-SE',
          'CUTBL001','CUTBL002','CUTBL003','CUTBL004','CUTBL009',
          'JIGHD-A','JIGHD-B','JIGHD-C','JIGHD-D'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ITEM_MASTERS i
          WHERE i.COMPANY = '40'
            AND i.PLANT_CD = '1000'
            AND i.ITEM_TYPE = 'CONSUMABLE'
        )
    ]';
  END IF;
END;
/

DECLARE
  v_ref_count NUMBER := 0;
BEGIN
  SELECT
      (SELECT COUNT(*)
         FROM BOM_MASTERS
        WHERE COMPANY = '40'
          AND PLANT_CD = '1000'
          AND (PARENT_ITEM_CODE IN (
                 SELECT ITEM_CODE FROM ITEM_MASTERS
                  WHERE COMPANY = '40' AND PLANT_CD = '1000' AND ITEM_TYPE = 'CONSUMABLE'
               )
            OR CHILD_ITEM_CODE IN (
                 SELECT ITEM_CODE FROM ITEM_MASTERS
                  WHERE COMPANY = '40' AND PLANT_CD = '1000' AND ITEM_TYPE = 'CONSUMABLE'
               )))
    + (SELECT COUNT(*)
         FROM MAT_LOTS
        WHERE COMPANY = '40'
          AND PLANT_CD = '1000'
          AND ITEM_CODE IN (
                SELECT ITEM_CODE FROM ITEM_MASTERS
                 WHERE COMPANY = '40' AND PLANT_CD = '1000' AND ITEM_TYPE = 'CONSUMABLE'
              ))
    + (SELECT COUNT(*)
         FROM MAT_STOCKS
        WHERE COMPANY = '40'
          AND PLANT_CD = '1000'
          AND ITEM_CODE IN (
                SELECT ITEM_CODE FROM ITEM_MASTERS
                 WHERE COMPANY = '40' AND PLANT_CD = '1000' AND ITEM_TYPE = 'CONSUMABLE'
              ))
    + (SELECT COUNT(*)
         FROM PROD_PLANS
        WHERE COMPANY = '40'
          AND PLANT_CD = '1000'
          AND ITEM_CODE IN (
                SELECT ITEM_CODE FROM ITEM_MASTERS
                 WHERE COMPANY = '40' AND PLANT_CD = '1000' AND ITEM_TYPE = 'CONSUMABLE'
              ))
    INTO v_ref_count
    FROM DUAL;

  IF v_ref_count > 0 THEN
    RAISE_APPLICATION_ERROR(
      -20001,
      'ITEM_MASTERS 소모품 참조 데이터가 남아 있어 소모품마스터 이동을 중단합니다. 참조 건수=' || v_ref_count
    );
  END IF;

  MERGE INTO CONSUMABLE_MASTERS c
  USING (
    SELECT
      ITEM_CODE AS CONSUMABLE_CODE,
      ITEM_NAME AS NAME,
      CASE
        WHEN ITEM_CODE LIKE 'JIGHD%' THEN 'JIG'
        ELSE 'TOOL'
      END AS CATEGORY,
      SAFETY_STOCK,
      USE_YN,
      IMAGE_URL,
      COMPANY,
      PLANT_CD
    FROM ITEM_MASTERS
    WHERE COMPANY = '40'
      AND PLANT_CD = '1000'
      AND ITEM_TYPE = 'CONSUMABLE'
  ) s
  ON (c.CONSUMABLE_CODE = s.CONSUMABLE_CODE)
  WHEN MATCHED THEN UPDATE SET
    c.NAME = s.NAME,
    c.CATEGORY = s.CATEGORY,
    c.SAFETY_STOCK = NVL(s.SAFETY_STOCK, 0),
    c.USE_YN = s.USE_YN,
    c.IMAGE_URL = s.IMAGE_URL,
    c.COMPANY = s.COMPANY,
    c.PLANT_CD = s.PLANT_CD,
    c.UPDATED_BY = 'MIGRATION',
    c.UPDATED_AT = SYSTIMESTAMP
  WHEN NOT MATCHED THEN INSERT (
    CONSUMABLE_CODE,
    NAME,
    CATEGORY,
    EXPECTED_LIFE,
    CURRENT_COUNT,
    STOCK_QTY,
    SAFETY_STOCK,
    WARNING_COUNT,
    LOCATION,
    UNIT_PRICE,
    VENDOR,
    STATUS,
    USE_YN,
    COMPANY,
    PLANT_CD,
    CREATED_BY,
    UPDATED_BY,
    OPER_STATUS,
    MOUNTED_EQUIP_ID,
    IMAGE_URL,
    CREATED_AT,
    UPDATED_AT
  ) VALUES (
    s.CONSUMABLE_CODE,
    s.NAME,
    s.CATEGORY,
    NULL,
    0,
    0,
    NVL(s.SAFETY_STOCK, 0),
    NULL,
    NULL,
    NULL,
    NULL,
    'NORMAL',
    s.USE_YN,
    s.COMPANY,
    s.PLANT_CD,
    'MIGRATION',
    'MIGRATION',
    'WAREHOUSE',
    NULL,
    s.IMAGE_URL,
    SYSTIMESTAMP,
    SYSTIMESTAMP
  );

  DELETE FROM ITEM_MASTERS
  WHERE COMPANY = '40'
    AND PLANT_CD = '1000'
    AND ITEM_TYPE = 'CONSUMABLE';
END;
/
