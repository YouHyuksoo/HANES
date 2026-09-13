-- THN A50: 품목/템플릿 판정기준을 검사항목 풀 CRITERIA로 복구
-- (중복으로 오인해 NULL 처리했던 값)

UPDATE IQC_PART_SPEC_ITEMS i
   SET i.JUDGE_CRITERIA = (
         SELECT p.CRITERIA
           FROM IQC_ITEM_POOL p
          WHERE p.COMPANY = i.COMPANY
            AND p.PLANT_CD = i.PLANT_CD
            AND p.INSP_ITEM_CODE = i.INSP_ITEM_CODE
       ),
       i.UPDATED_BY = 'thn-a50-seed',
       i.UPDATED_AT = SYSTIMESTAMP
 WHERE i.COMPANY = '40'
   AND i.PLANT_CD = '1000'
   AND i.INSP_ITEM_CODE LIKE 'THN-A50%'
/

UPDATE IQC_TEMPLATE_ITEMS i
   SET i.JUDGE_CRITERIA = (
         SELECT p.CRITERIA
           FROM IQC_ITEM_POOL p
          WHERE p.COMPANY = i.COMPANY
            AND p.PLANT_CD = i.PLANT_CD
            AND p.INSP_ITEM_CODE = i.INSP_ITEM_CODE
       ),
       i.UPDATED_BY = 'thn-a50-seed',
       i.UPDATED_AT = SYSTIMESTAMP
 WHERE i.COMPANY = '40'
   AND i.PLANT_CD = '1000'
   AND i.TEMPLATE_ID LIKE 'THN-A50%'
/

COMMIT
/
