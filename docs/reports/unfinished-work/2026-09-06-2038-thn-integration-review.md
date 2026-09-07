# 미완료 작업 기록: THN 통합테스트 13건 검토

- 작성시각: 2026-09-06 20:38 KST
- 작성자: codex-thn
- 작업 범위: 09-04 오후 3건 + EAD65942601 통합테스트 10건
- 현재 상태: 검증대기 / 일부 사용자결정대기
- 대조 기준: HEAD e2b1fa8f 및 현재 working tree. 배포본/실제 DB 상태로 간주하지 않는다.

## 완료한 것

### 앞선 3건

1. 작업지시 수정: JobOrderFormPanel에서 미지정 설비를 빈 문자열로 전송하도록 수정. PUT controller → UpdateJobOrderDto → JobOrderService.update → nullable EQUIP_CODE 체인 확인. 서버는 빈 문자열을 null로 저장하는 기존 구현 유지.
2. 자재 장착: 공정재고가 없을 때 tenant 범위 WIP_MAT_STOCKS.QTY>0 조회. 타설비이면 설비명/코드와 해제 안내, 동일 설비이면 중복 안내, 장착 재고가 없으면 기존 출고 안내. 정상 이동 로직 유지.
3. SG 지속 모드: 분석만 완료. 현재 confirmAssembly는 SG당 1개 차감하고 화면 onConfirmScan 성공 시 전체 초기화. SG 동시 차감 잠금 및 BOM 누락 방어도 함께 검토 필요. 아직 구현하지 않음.

### 추가 10건 소스 검토

| 번호 | 현재 소스 근거 | 판정 및 다음 조치 |
|---|---|---|
| 01 검사 순서 | continuity-inspect.service.ts create는 ISSUED만 통전 PASS 처리, visualInspect는 VISUAL_PASS/FAIL로 상태 변경. box.service.ts addSerial은 VISUAL_PASS와 inspectPassYn=Y 모두 요구 | 육안→통전 실행과 현재 상태 제약 충돌은 확인. 통전 생략 포장 가능 여부는 초기값/통합검사/재검사 등의 PASS 설정 경로와 실제 FG 이력으로 재현해야 함. 현장 품질 책임자와 라우팅 승인 주체 확인 필요. EAD 모델 실제 라우팅은 DB 미확인 |
| 02 중복 설비 | 2026-06-12_equip_inspect_item_pool_tester_seed.sql에 EQ-PRC-TEST-01/02와 EQ-TEST-01/02 양쪽 점검항목 매핑 존재 | 두 코드군 참조 존재만 확인. 설비 최초 생성자/날짜는 이 파일로 증명 불가. 실제 등록 이력·프로토콜·실적 참조 확인 후 보존 세트 확정, 미사용 전환. DB 변경 없음 |
| 03 회로라벨 | ContinuityInspectDto.circuitLabel은 설비 출력 바코드로 설명됨. create는 PASS 필수/중복 검사, 수신 문자열 저장. auto-inspect 별도 API 존재 | 검사기 원본 수신/스캔 의도를 확인했으나 현장 연결·형식·출처·자동 채번 규약은 미확인. 임의 작업지시+순번 채번 도입 금지. 현장 검사기 출력 샘플과 인터페이스 규격 필요 |
| 04 LOT 육안검사 | visualInspect(fgBarcode, dto)는 FG 단건 + InspectResult 1건 저장 | 단건 구조 확인. 설계 승인 근거는 코드만으로 확인 불가. LOT 일괄검사에는 LOT 정의/대상 확정/불합격 분리/재검사/개별 FG 추적 기준 결정 필요. 단순 전체 PASS 버튼으로 변경하지 않음 |
| 05 포장 장소 | box.service.ts addSerial은 품목·검사·중복포장·입수량 확인, 부서/창고 입력·검증 없음. 입고는 별도 inventory API | 포장과 입고의 분리 구조 확인. 현장 포장 책임 부서·작업장·재고 이동 시점 기준 확정 후 시스템 강제 여부 결정 |
| 06 포장 다열 | shipping/pack/page.tsx 시리얼 모달은 modalSerials.map의 세로 목록 | 개선 타당. 1~5열 선택과 번호/전체 바코드/삭제 접근성 유지. 목록 책임은 별도 컴포넌트로 분리 권장. 이번 검토에서 미수정 |
| 07 제품입고 메뉴명 | locales/ko.json menu.productMgmt.receive 및 productMgmt.receive.title은 제품입고관리 | 요청한 제품입고(공정재고>창고재고)로 메뉴/제목/관련 도움말 일치시킬 대상. locale 파일 타 작업 stale lock 남아 있음. 이번 검토에서 미수정 |
| 08 입고창고 무시 | ReceivablePanel은 useWarehouseOptions('FG') 전체 선택, receiveBoxes가 warehouseId 전송. inventory.controller.ts receiveFg는 FG/isDefault=Y 조회 후 dto.warehouseId 덮어씀 | 불일치 확인. 사용자 요청대로 기본 FG 창고만 노출하고 기본 미설정 시 저장 차단하는 방향. 임의 창고 하드코딩 금지. 반제품 분기와 실제 기본창고도 확인 필요. 미수정 |
| 09 미사용 거래처 | usePartnerOptions는 이미 useYn=Y 기본값, PartnerService도 필터 적용. shipping/order/page.tsx는 includeInactive:true로 받은 옵션을 등록 form.customerId에 사용 | 공통 훅 미필터라는 원인 설명은 현재 코드와 다름. 출하지시 등록은 수정 대상. arrival-result는 이력 조회에 includeInactive:true 사용. 월간계획/고객PO 양 경로/병합/분할은 기본 훅 사용. 배포 버전 및 실제 응답 재검증 필요 |
| 10 OQC 미노출 | menuConfig/validator/seed에 QC_OQC, QC_OQC_HISTORY 존재. menuTreeStore는 DB 배치와 active 카테고리를 기준으로 머지, useMenuTree는 allowedMenus 권한 확인. ship-order.service는 OQC_ENABLED 시 PASS 강제 | 소스 메뉴 추가만으로 해결된다고 판단 불가. 실제 MENU_CATEGORY_ITEMS/ROLE_MENU_PERMISSIONS/카테고리 활성/배포 SHA/브라우저 메뉴 캐시 확인 필요. OQC_ENABLED 우회 해제하지 않음 |

## 미완료 / 남은 것

- 전체 실제 UI→API→DB 확인. 현재 실행 환경 연결 불가.
- SG 지속 모드 구현: page.tsx/SgScanPanel.tsx에 Hermes 2026-07-02 만료 잠금이 남아 사용자에게 인계 여부 질문했고 응답 대기. 해당 파일 수정 안 함.
- 추가 10건은 검토 결과이며 구현/DB 변경 완료가 아님.
- 업무 기준 확인 항목: 검사 최종 승인 주체, 회로라벨 규격, LOT 정의/판정 정책, 포장 주체/장소.
- 현장 이슈는 배포 SHA 등 완료 증거가 없으므로 DONE 처리하지 않음.

## 변경 파일

- apps/frontend/src/app/(authenticated)/production/order/components/JobOrderFormPanel.tsx: 설비 공란 전송.
- apps/backend/src/modules/production/services/equip-material.service.ts: 장착 실패 원인 안내 분기.
- apps/backend/src/modules/production/services/equip-material.service.spec.ts: 타설비/동일설비/미출고/정상장착 검증 추가.

## 검증 상태

- 실행함: equip-material.service.spec.ts 6/6 PASS; frontend 및 backend tsc --noEmit --pretty false PASS; git diff --check PASS.
- 실환경 확인: localhost:3002/production/input-assembly 및 localhost:3003/api/v1/auth/me curl HTTP 000, 3002/3003 리스너 없음.
- JSHANES connector SELECT 1 FROM DUAL: DPY-6005 timeout.
- 모의 브라우저 테스트는 실행하지 않음. 위 6건은 서비스 단위 테스트이며 실DB 증거 아님.

## 중단 사유

- 실환경 연결 불가, 잠금 인계 응답 대기, 현장 업무 기준 미확정.

## 다음 작업자가 바로 할 일

1. 실제 기대 서버 3002/3003와 JSHANES 연결 복구 여부 확인. 다른 포트/DB로 임의 대체하지 않는다.
2. OQC 메뉴 배치/권한/실행 SHA 조회. 실제 스키마 확인 후 필요한 DB 적용 수행.
3. 출하지시 등록 거래처 필터, 기본창고 표시, 포장 다열 표시를 좁은 범위로 수정.
4. 승인된 파일 잠금 인계 후 SG 지속모드 구현 및 반복 확정·잔량 소진·동시 소비 검증.
5. 현장 품질 기준 승인 후 검사 순서/LOT 검사 설계 반영.

## 주의사항

- 수리 및 다른 세션 dirty 변경 보존. 커밋/배포/build/서비스 재시작 없음.
- 테스트 데이터 생성 및 DB 변경 없음. 정리할 테스트 데이터 없음.
- 잠금은 만료만으로 타 작업 변경을 덮어쓰지 않는다.
