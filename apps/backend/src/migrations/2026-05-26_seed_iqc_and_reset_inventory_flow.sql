DECLARE
  PROCEDURE add_pool(
    p_code     VARCHAR2,
    p_name     VARCHAR2,
    p_method   VARCHAR2,
    p_criteria VARCHAR2,
    p_lsl      NUMBER DEFAULT NULL,
    p_usl      NUMBER DEFAULT NULL,
    p_unit     VARCHAR2 DEFAULT NULL
  ) IS
  BEGIN
    INSERT INTO IQC_ITEM_POOL (
      COMPANY, PLANT_CD, INSP_ITEM_CODE, INSP_ITEM_NAME, JUDGE_METHOD,
      CRITERIA, LSL, USL, UNIT, REVISION, EFFECTIVE_DATE, USE_YN,
      REMARK, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
    ) VALUES (
      '40', '1000', p_code, p_name, p_method,
      p_criteria, p_lsl, p_usl, p_unit, 1, SYSTIMESTAMP, 'Y',
      'HANES item master IQC seed', 'seed', 'seed', SYSTIMESTAMP, SYSTIMESTAMP
    );
  END;
BEGIN
  DELETE FROM IQC_LOGS;

  DELETE FROM STOCK_TRANSACTIONS;
  DELETE FROM PRODUCT_TRANSACTIONS;
  DELETE FROM MAT_ISSUES;
  DELETE FROM MAT_ISSUE_REQUEST_ITEMS;
  DELETE FROM MAT_ISSUE_REQUESTS;
  DELETE FROM MAT_RECEIVINGS;
  DELETE FROM MAT_ARRIVALS;
  DELETE FROM MAT_LOTS;
  DELETE FROM MAT_STOCKS;
  DELETE FROM PRODUCT_STOCKS;
  DELETE FROM SUBCON_RECEIVES;

  DELETE FROM IQC_PART_SPEC_ITEMS;
  DELETE FROM IQC_PART_SPECS;
  DELETE FROM IQC_ITEM_MASTERS;
  DELETE FROM IQC_ITEM_POOL;

  add_pool('IQC-VISUAL', 'Appearance and damage check', 'VISUAL', 'No contamination, deformation, crack, rust, or damage');
  add_pool('IQC-DIMENSION', 'Critical dimension check', 'MEASURE', 'Within drawing tolerance', NULL, NULL, 'mm');
  add_pool('IQC-WIRE-OD', 'Wire outside diameter check', 'MEASURE', 'Wire OD within tolerance', 0.1, 20, 'mm');
  add_pool('IQC-WIRE-COLOR', 'Wire color check', 'VISUAL', 'Color matches item specification');
  add_pool('IQC-CRIMP-DIM', 'Terminal crimp dimension check', 'MEASURE', 'Crimp height and width within specification', NULL, NULL, 'mm');
  add_pool('IQC-PLATING', 'Terminal plating check', 'VISUAL', 'No discoloration, peel, rust, or contamination');
  add_pool('IQC-CONN-DIM', 'Connector cavity dimension check', 'MEASURE', 'Connector key dimension within specification', NULL, NULL, 'mm');
  add_pool('IQC-LOCK', 'Connector lock function check', 'VISUAL', 'Lock and latch operate normally');
  add_pool('IQC-LENGTH', 'Length check', 'MEASURE', 'Material length within tolerance', NULL, NULL, 'm');
  add_pool('IQC-ADHESION', 'Adhesion check', 'VISUAL', 'Adhesion is stable and no peeling occurs');
  add_pool('IQC-HARDNESS', 'Rubber hardness check', 'MEASURE', 'Hardness within specification', 30, 90, 'HA');
  add_pool('IQC-CONTINUITY', 'Electrical continuity check', 'MEASURE', 'Continuity resistance within specification', 0, 1, 'ohm');
  add_pool('IQC-PRINT', 'Print and barcode check', 'VISUAL', 'Print is readable and barcode scans successfully');
  add_pool('IQC-FLEX', 'Flexibility check', 'VISUAL', 'No crack after bending test');
  add_pool('IQC-FIT', 'Fit and assembly check', 'VISUAL', 'Part fits mating component without interference');

  INSERT INTO IQC_PART_SPECS (
    COMPANY, PLANT_CD, ITEM_CODE, SAMPLE_QTY, IS_DEST, USE_YN,
    CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
  )
  SELECT
    COMPANY,
    PLANT_CD,
    ITEM_CODE,
    CASE
      WHEN PRODUCT_TYPE IN ('TERMINAL', 'SEAL') THEN 10
      WHEN PRODUCT_TYPE IN ('CONNECTOR', 'LABEL') THEN 5
      ELSE 3
    END AS SAMPLE_QTY,
    CASE WHEN PRODUCT_TYPE IN ('WIRE', 'TAPE', 'TUBE') THEN 'Y' ELSE 'N' END AS IS_DEST,
    'Y',
    'seed',
    'seed',
    SYSTIMESTAMP,
    SYSTIMESTAMP
  FROM ITEM_MASTERS
  WHERE COMPANY = '40'
    AND PLANT_CD = '1000'
    AND ITEM_TYPE = 'RM'
    AND NVL(IQC_FLAG, 'N') = 'Y';

  INSERT INTO IQC_PART_SPEC_ITEMS (
    COMPANY, PLANT_CD, ITEM_CODE, SEQ, INSP_ITEM_CODE, LSL, USL,
    USE_YN, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT, JUDGE_CRITERIA
  )
  SELECT
    COMPANY,
    PLANT_CD,
    ITEM_CODE,
    10,
    'IQC-VISUAL',
    NULL,
    NULL,
    'Y',
    'seed',
    'seed',
    SYSTIMESTAMP,
    SYSTIMESTAMP,
    'Appearance must be free of contamination, deformation, rust, and damage.'
  FROM ITEM_MASTERS
  WHERE COMPANY = '40'
    AND PLANT_CD = '1000'
    AND ITEM_TYPE = 'RM'
    AND NVL(IQC_FLAG, 'N') = 'Y';

  INSERT INTO IQC_PART_SPEC_ITEMS (
    COMPANY, PLANT_CD, ITEM_CODE, SEQ, INSP_ITEM_CODE, LSL, USL,
    USE_YN, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT, JUDGE_CRITERIA
  )
  SELECT
    COMPANY,
    PLANT_CD,
    ITEM_CODE,
    20,
    CASE
      WHEN PRODUCT_TYPE = 'WIRE' THEN 'IQC-WIRE-OD'
      WHEN PRODUCT_TYPE = 'TERMINAL' THEN 'IQC-CRIMP-DIM'
      WHEN PRODUCT_TYPE = 'CONNECTOR' THEN 'IQC-CONN-DIM'
      WHEN PRODUCT_TYPE IN ('TAPE', 'TUBE') THEN 'IQC-LENGTH'
      WHEN PRODUCT_TYPE = 'LABEL' THEN 'IQC-PRINT'
      ELSE 'IQC-DIMENSION'
    END,
    NULL,
    NULL,
    'Y',
    'seed',
    'seed',
    SYSTIMESTAMP,
    SYSTIMESTAMP,
    CASE
      WHEN PRODUCT_TYPE = 'WIRE' THEN 'Wire outside diameter must match the item specification.'
      WHEN PRODUCT_TYPE = 'TERMINAL' THEN 'Crimp dimension must match terminal drawing specification.'
      WHEN PRODUCT_TYPE = 'CONNECTOR' THEN 'Connector critical dimensions must match drawing specification.'
      WHEN PRODUCT_TYPE IN ('TAPE', 'TUBE') THEN 'Measured length must be within order and item tolerance.'
      WHEN PRODUCT_TYPE = 'LABEL' THEN 'Print and barcode must be readable.'
      ELSE 'Critical dimensions must match drawing specification.'
    END
  FROM ITEM_MASTERS
  WHERE COMPANY = '40'
    AND PLANT_CD = '1000'
    AND ITEM_TYPE = 'RM'
    AND NVL(IQC_FLAG, 'N') = 'Y';

  INSERT INTO IQC_PART_SPEC_ITEMS (
    COMPANY, PLANT_CD, ITEM_CODE, SEQ, INSP_ITEM_CODE, LSL, USL,
    USE_YN, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT, JUDGE_CRITERIA
  )
  SELECT
    COMPANY,
    PLANT_CD,
    ITEM_CODE,
    30,
    CASE
      WHEN PRODUCT_TYPE = 'WIRE' THEN 'IQC-WIRE-COLOR'
      WHEN PRODUCT_TYPE = 'TERMINAL' THEN 'IQC-PLATING'
      WHEN PRODUCT_TYPE = 'CONNECTOR' THEN 'IQC-LOCK'
      WHEN PRODUCT_TYPE = 'TAPE' THEN 'IQC-ADHESION'
      WHEN PRODUCT_TYPE IN ('SEAL', 'GROMMET') THEN 'IQC-HARDNESS'
      WHEN PRODUCT_TYPE = 'ELECTRIC' THEN 'IQC-CONTINUITY'
      WHEN PRODUCT_TYPE = 'LABEL' THEN 'IQC-ADHESION'
      WHEN PRODUCT_TYPE = 'TUBE' THEN 'IQC-FLEX'
      ELSE 'IQC-FIT'
    END,
    NULL,
    NULL,
    'Y',
    'seed',
    'seed',
    SYSTIMESTAMP,
    SYSTIMESTAMP,
    CASE
      WHEN PRODUCT_TYPE = 'WIRE' THEN 'Wire color must match the item master specification.'
      WHEN PRODUCT_TYPE = 'TERMINAL' THEN 'Terminal plating must be clean and free of rust or peel.'
      WHEN PRODUCT_TYPE = 'CONNECTOR' THEN 'Connector lock and latch must operate normally.'
      WHEN PRODUCT_TYPE = 'TAPE' THEN 'Tape adhesion must be stable with no peeling.'
      WHEN PRODUCT_TYPE IN ('SEAL', 'GROMMET') THEN 'Rubber hardness must meet specification.'
      WHEN PRODUCT_TYPE = 'ELECTRIC' THEN 'Electrical continuity must pass.'
      WHEN PRODUCT_TYPE = 'LABEL' THEN 'Label adhesion must be stable with no peeling.'
      WHEN PRODUCT_TYPE = 'TUBE' THEN 'Tube must not crack after bending.'
      ELSE 'Part must fit mating component without interference.'
    END
  FROM ITEM_MASTERS
  WHERE COMPANY = '40'
    AND PLANT_CD = '1000'
    AND ITEM_TYPE = 'RM'
    AND NVL(IQC_FLAG, 'N') = 'Y';

  INSERT INTO IQC_ITEM_MASTERS (
    COMPANY, PLANT_CD, ITEM_CODE, SEQ, INSPECT_ITEM, SPEC, LSL, USL, UNIT,
    IS_SHELF_LIFE, RETEST_CYCLE, USE_YN, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
  )
  SELECT
    spi.COMPANY,
    spi.PLANT_CD,
    spi.ITEM_CODE,
    spi.SEQ,
    pool.INSP_ITEM_NAME,
    spi.JUDGE_CRITERIA,
    spi.LSL,
    spi.USL,
    pool.UNIT,
    0,
    NULL,
    'Y',
    'seed',
    'seed',
    SYSTIMESTAMP,
    SYSTIMESTAMP
  FROM IQC_PART_SPEC_ITEMS spi
  JOIN IQC_ITEM_POOL pool
    ON pool.COMPANY = spi.COMPANY
   AND pool.PLANT_CD = spi.PLANT_CD
   AND pool.INSP_ITEM_CODE = spi.INSP_ITEM_CODE;
END;
/
