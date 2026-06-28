-- Backfill BOM effective/completion dates.
-- Existing BOM rows must not show blank 적용일/완료일 in /master/bom.

UPDATE BOM_MASTERS
   SET VALID_FROM = NVL(VALID_FROM, DATE '2026-06-01'),
       VALID_TO = NVL(VALID_TO, DATE '2099-12-31'),
       UPDATED_BY = 'codex',
       UPDATED_AT = SYSTIMESTAMP
 WHERE COMPANY = '40'
   AND PLANT_CD = '1000'
   AND (VALID_FROM IS NULL OR VALID_TO IS NULL);

COMMIT;
