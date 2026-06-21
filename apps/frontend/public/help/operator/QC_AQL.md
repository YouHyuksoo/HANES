---
menuCode: QC_AQL
audience: operator
title: AQL 기준관리 — 운영 가이드
summary: AQL 정책/기준 운영 절차와 품목 연계, 트러블슈팅
tags: [품질, IQC, AQL, 운영, 설정]
keywords: [IQC_AQL_POLICIES, AQL_STANDARDS, 품목연계, 검사수준, 트러블슈팅]
related: [MST_PART]
---

# AQL 기준관리 — 운영 가이드

## 시스템 목적·역할
품목별 수입검사 판정의 기준이 되는 AQL 정책/기준을 정의합니다. 품목마스터의 AQL 정책 필드가 이 정책을 참조합니다.

## 사전 설정 (마스터·공통코드)
- 공통코드: `AQL_INSP_LEVEL`, `AQL_VALUE`
- 품목마스터에 AQL 정책 연결

## 운영 절차
1. AQL 정책(Major/Minor) 정의
2. 정책별 LOT 수량 구간 판정기준 등록
3. 품목마스터에서 품목에 정책 연결

## 권한
품질 관리자.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 검사에서 AQL 자동판정 안 됨 | 품목에 정책 미연결 | 품목마스터에서 AQL 정책 지정 |

## 데이터·연계
- 테이블: `IQC_AQL_POLICIES`, `AQL_STANDARDS`
- 연계: 품목마스터(`ITEM_MASTERS.IQC_AQL_POLICY_CODE`), IQC 검사
