---
inclusion: fileMatch
fileMatchPattern: '.kiro/specs/**'
---

# Spec Writer — 스펙 3종 작성 가이드

> `.kiro/specs/**` 경로 파일이 컨텍스트에 있으면 자동 포함된다.
> 스펙은 **요구사항 → 설계 → 태스크** 3단 파이프라인이다. 각 단계는 독립적으로 완결되어야 한다.

## 파일 구성

| 파일 | 역할 | 독자 |
|------|------|------|
| `requirements.md` | EARS 형식의 검증 가능한 요구사항 | 제품/QA/개발 전반 |
| `design.md` | 아키텍처·컴포넌트·데이터 모델·인터페이스 | 개발 |
| `tasks.md` | 구현 작업 체크리스트 (requirements.md의 요구사항 ID 참조) | 구현 담당 |

## 요구사항(requirements.md) 규칙

### 구조

```markdown
# Requirements Document — <스펙 제목>

## Introduction
<한 문단. 이 스펙이 다루는 범위와 다루지 않는 범위를 명시>

## Glossary
<엔터티·컴포넌트·용어 정의. 영문 명사구 권장>

## Requirements

### Requirement N: <제목>

**User Story:** <사용자> 로서 <기능>을 원한다, <이유이기 때문에>.

#### Acceptance Criteria
1. WHEN <트리거>, THE <주체> SHALL <행동>.
2. IF <조건>, THEN THE <주체> SHALL <행동>.
3. WHERE <상태>, THE <주체> SHALL <행동>.
```

### EARS 구문 원칙

- **WHEN/IF/WHERE/WHILE** 로 시작하고 **SHALL** 을 서술어로 쓴다
- 주체는 Glossary에 정의된 컴포넌트명
- 각 Acceptance Criteria는 **검증 가능한 단일 동작** 이어야 한다 (여러 동작을 "and"로 묶지 말 것)
- "적절히", "충분히", "자연스럽게" 같은 모호어 금지. 수치·명확한 조건으로 바꾼다
- 요구사항 번호는 안정적으로 유지한다 (기존 번호 재사용 금지, 삭제 시 "(Deprecated)" 표기 후 유지)

### 범위 관리

- Product Context의 Non-Goals에 저촉되는 요구사항은 **작성하지 않는다**
- 기획서(`docs/planning.md`)의 P0 기능부터 정렬한다. P1/P2는 별도 스펙 또는 후속 섹션
- 하나의 스펙이 50개 요구사항을 넘으면 분할을 제안한다

## 설계(design.md) 규칙

### 구조

```markdown
# Design — <스펙 제목>

## Overview
<무엇을·왜·제약 요약>

## Architecture
<컴포넌트 간 관계 다이어그램(ASCII 또는 mermaid) + 데이터 흐름>

## Components
### <Component>
- 역할
- 인터페이스(공개 메서드/props/이벤트)
- 의존 관계
- 요구사항 매핑: Req N.M, N.M

## Data Model
<엔터티·스키마·관계. Supabase 테이블은 RLS 정책까지 명시>

## Interfaces
<API 엔드포인트, 외부 AI 호출 스펙, UI 라우트>

## Error Handling
<실패 모드별 동작>

## Decisions & Trade-offs
<대안과 선택 근거>
```

### 원칙

- 모든 Component는 **요구사항 ID를 명시적으로 참조**한다 (역추적 가능성)
- 외부 AI 호출은 **프롬프트 형태·입출력 스키마·폴백 동작**을 명시
- 기술 선택은 `tech-stack.md`를 따른다. 벗어나면 "Decisions & Trade-offs"에 근거 작성

## 태스크(tasks.md) 규칙

### 구조

```markdown
# Tasks — <스펙 제목>

- [ ] 1. <상위 작업>
  - [ ] 1.1 <서브 작업> (Req 3.1, 3.2)
  - [ ] 1.2 <서브 작업> (Req 4.1)
- [ ] 2. <상위 작업>
  ...
```

### 원칙

- 각 태스크는 **1~3일 이내 완료 가능**한 단위
- `(Req N.M)` 형식으로 요구사항 ID를 명시 (하나의 태스크가 여러 요구사항을 커버해도 됨)
- 구현 순서는 **데이터 → 백엔드 → 화면** 또는 **핵심 루프 → 주변** 순서로. 의존성 없는 항목을 앞에 배치
- 배포·출시 관련 태스크는 맨 끝 섹션에 모은다

## 3단 파이프라인 실행

1. requirements.md 초안 작성 → 사용자 검토 요청
2. 승인 후 design.md 작성 (requirements.md 고정)
3. 설계 승인 후 tasks.md 작성 (requirements + design 고정)
4. 각 단계에서 앞 단계를 고칠 일이 생기면 **명시적으로 소급 수정** 이유를 기록

스펙 작업 중 `docs/planning.md`와 충돌이 보이면 먼저 기획서 수정 여부를 확인하고, 기획서가 ground truth다.
