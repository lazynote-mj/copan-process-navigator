# Process 01 Review Package

Title: 사업 기회 확보 ~ 구매 요청 : 제/상품
Purpose: Process 01을 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 01은 SCM Lifecycle의 시작점으로 계약/프로젝트관리 Capability를 정리했다.

- 사업기회확보
- 사업참여검토
- 계약등록(미결)
- 사업계약품의
- 계약등록(확정)
- 계약서 날인 및 날인 계약서 첨부
- 프로젝트등록(미결)
- 프로젝트실행품의입력
- 프로젝트 실행품의
- 프로젝트등록
- WBS코드등록
- 프로젝트 상태관리
- 품목 등록 PROCESS 연결
- 거래처 등록 PROCESS 연결
- 구매요청 생성

## 2. Douzone와 차이점

Douzone Source는 품목 등록 PROCESS, 거래처 등록 PROCESS, 계약 등록 PROCESS, 구매 입고 PROCESS가 각각 분리되어 있다. Copan Navigator에서는 SCM Lifecycle 관점에서 사업기회, 계약, 프로젝트, 기준정보, 구매요청을 하나의 선행 흐름으로 묶었다.

## 3. Copan 운영 반영 내용

- 사업기회에서 구매요청까지 이어지는 제/상품 SCM 시작 흐름으로 구성했다.
- 계약은 미결 등록, 사업계약품의, 날인 계약서 첨부, 계약등록(확정)으로 분리했다.
- 프로젝트는 프로젝트등록(미결), 실행품의, 프로젝트등록, WBS코드등록, 프로젝트 상태관리로 표현했다.
- 구매요청은 계약/프로젝트/WBS/기준정보가 준비된 이후 구매관리 Capability로 연결되는 Node로 정리했다.
- 품목과 거래처는 현재 Process 안에서 직접 등록하지 않고 연결 프로세스로 표시했다.

## 4. 혁신팀 검토 사항

- 계약등록(미결)과 계약등록(확정)의 실제 ERP 메뉴/상태값 확인
- 프로젝트등록(미결)의 실제 사용 여부와 프로젝트등록 확정 시점 확인
- 프로젝트 상태값 미결 → 진행 → 종료 기준 확인
- WBS코드등록이 구매요청 전에 반드시 필요한지 확인
- 품목 등록 PROCESS와 거래처 등록 PROCESS를 별도 Detail Process로 분리할지 확인

## 5. 담당부서 확인 사항

- 사업부: 사업기회확보, 사업참여검토, 계약품의, 프로젝트 실행품의, 구매요청 책임 확인
- 상생협력팀: 품목/거래처 기준정보 등록 또는 승인 참여 범위 확인
- 경영혁신팀: 계약/프로젝트/WBS/구매요청의 ERP 메뉴명과 상태값 확인

## 6. 결정 필요 사항

- 계약서 날인과 PDF 첨부가 계약등록(확정) 전 필수 단계인지 결정해야 한다.
- 프로젝트 상태관리를 별도 Node로 유지할지, 프로젝트등록 Node 설명으로 통합할지 결정해야 한다.
- 품목/거래처 등록을 연결 프로세스로 유지할지 별도 Detail Process로 구축할지 결정해야 한다.
- 구매요청 생성 조건을 프로젝트 상태 기준으로 제한할지 결정해야 한다.

## 7. Approval Checklist

□ Business Activity 확인
□ Execution System 확인
□ Owner 확인
□ Lane 확인
□ Auto Node 확인
□ ERP Menu 확인
□ Douzone 차이 확인
□ Copan 운영 반영 확인
□ 구매관리 연결 확인
□ 현업 승인 여부

## 8. Coverage 변경 사항

Coverage는 Approved 전까지 Complete로 변경하지 않는다.

- Douzone Process: 계약 등록 PROCESS / 품목 등록 PROCESS / 거래처 등록 PROCESS / 구매 입고 PROCESS
- Navigator Process: 01 사업 기회 확보 ~ 구매 요청 : 제/상품
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
