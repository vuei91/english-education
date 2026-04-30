---
inclusion: manual
---

# Curriculum Content Pipeline — 단원 문장 생성 파이프라인

> `#curriculum-content-pipeline` 로 명시적으로 로드한다.
> 확정된 단원·팩을 받아 **Step 1 (Phrase) → Step 2 (Conjugation) → Step 3 (Substitution)** 문장들을 만든다.
> ground truth: #[[file:docs/curriculum.md]] §1-1 3단계 확장 모델, §4 단원 모델, §6-3 굴절 생성 전략.

## 핵심 역할

**설계(단원 + 팩)를 실제 학습 콘텐츠(문장 목록)로 변환한다.** 0에서 LLM에 던지지 않는다. 인간 씨앗 → 템플릿 확장 → LLM 자연화 → 휴먼 큐레이션의 순서를 지킨다.

## 작업 원칙

1. **Step별로 생성 전략이 다르다** — 한 프롬프트로 세 단계를 싸잡지 말 것
2. **템플릿 우선, LLM 보조** — 굴절(Step 2)·치환(Step 3)의 뼈대는 템플릿 기반으로 만들고 LLM은 자연스러움 보정만 담당
3. **모든 문장은 큐레이션 통과 필수** — 자동 적재 금지. 체크리스트는 `#content-curator` 를 그대로 따른다
4. **음성 우선 설계** — 발음 재생이 앱의 1순위 경험. TTS 친화적이지 않은 문장(약어 과다·특수 기호)은 거절
5. **한국어 번역은 "의미 번역"** — 직역 금지. 특히 현재완료(T9/T10)처럼 한국어에 없는 상 구조는 자연스러운 한국어 문장으로

## Step별 생성 전략

### Step 1 · Phrase

- **입력**: 팩의 핵심 구(예: "drink coffee"), 3~5개
- **처리**: 문장이 아닌 **덩어리** 로 둔다. 마침표 없이 저장 (`is_phrase: true`)
- **검증**: 스트레스·리듬이 또렷한가 (TTS 샘플 재생으로 확인)
- **금지**: 구에 주어를 붙여 문장처럼 만들지 말 것. 그건 Step 2의 역할

### Step 2 · Conjugation (§6-3)

- **입력**: Step 1 의 구 + 주어 풀 `[I, you, he, she, we, they]` + 해당 단원의 시제
- **처리**: 템플릿 기반 자동 생성
  ```
  "{subject} {verb:conjugated} {object}."
  ```
  - 주어 6개 × 구 3~5개 = 약 18~30문장
  - 불규칙 동사는 단원 메타의 굴절표에서 읽어와 적용
- **LLM 역할**: 생성된 문장 중 자연스럽지 않은 조합에만 대체어 제안
- **출력 플래그**: `generation_source: 'template'` + `is_phrase: false`

### Step 3 · Substitution

- **입력**: 단원 문형 + 팩의 나머지 어휘 (Step 1~2에 쓰이지 않은 어휘 중심)
- **처리**: `PatternDrillPanel` 과 호환되는 슬롯 구조로 10~20문장
  - 슬롯 정의는 `slotHint[]` 와 `choices[]` 로 분리 (`patternDrill.ts` 참조)
- **LLM 역할**: 치환 결과가 의미상 성립하는지 검증 (예: `drink`의 목적어로 `car` 금지)
- **출력 플래그**: `generation_source: 'llm_assisted'` + 슬롯 메타 포함

## 입력 프로토콜

```
unit            curriculum-architect 가 확정한 단원 JSON
pack            vocab-pack-builder 가 확정한 팩 JSON
prior_sentences 이전 단원에서 이미 사용된 문장 ID 목록 (중복 방지)
tts_dry_run     true 이면 실제 오디오 생성은 하지 않고 캐시 후보만 기록
```

## 출력 프로토콜

```json
{
  "unit_id": "unit-4",
  "sentences": [
    {
      "tentative_id": "s-unit4-p1",
      "step_type": "phrase",
      "text_en": "drink coffee",
      "text_ko": "커피를 마시다",
      "is_phrase": true,
      "curriculum_step_id": "step-unit4-phrase",
      "generation_source": "human_seed",
      "pattern_family_id": null
    },
    {
      "tentative_id": "s-unit4-c1",
      "step_type": "conjugation",
      "text_en": "She drinks coffee.",
      "text_ko": "그녀는 커피를 마셔요.",
      "is_phrase": false,
      "curriculum_step_id": "step-unit4-conj",
      "generation_source": "template",
      "template": "{subject} {verb:pres_3sg} {object}."
    },
    {
      "tentative_id": "s-unit4-s1",
      "step_type": "substitution",
      "text_en": "He drinks juice.",
      "text_ko": "그는 주스를 마셔요.",
      "is_phrase": false,
      "curriculum_step_id": "step-unit4-sub",
      "generation_source": "llm_assisted",
      "pattern_family_id": "pf-present-3sg-transitive",
      "slot_spec": {
        "template": "{subject} {verb} {object}.",
        "slots": [
          { "name": "subject", "choices": ["He", "She", "It"] },
          { "name": "object",  "choices": ["juice", "water", "tea"] }
        ]
      }
    }
  ],
  "stats": {
    "phrase": 4,
    "conjugation": 18,
    "substitution": 16,
    "total": 38,
    "estimated_tts_minutes": 6.2
  }
}
```

## 불변 원칙 (거부 사유)

- 단원/팩 없이 문장만 요청받는 경우 → 거부. 파이프라인 앞 단계부터 진행 요청
- 한 번에 여러 단원의 문장을 섞어 생성하라는 요청 → 거부. 단원 단위로 분리
- LLM만으로 Step 2 전체를 생성하라는 요청 → 거부. 템플릿이 먼저
- 저작권 있는 출처의 문장을 수정 없이 복제 → 거부 (`#content-curator` 소스 가이드 준수)

## 에러·엣지 케이스

- 템플릿 적용 결과 문법이 깨진 조합 발생 (예: 불규칙 동사 표 누락) → 해당 조합만 제외하고 계속, 누락된 표를 rationale에 보고
- LLM이 슬롯 choices 밖의 단어로 치환을 제안 → 거부하고 팩 내 어휘로 재생성
- TTS 예상 길이가 단원 목표(10~15분)의 2배를 넘으면 → Step 3 수량을 자동 축소하고 보고
- 한국어 번역이 기계 직역으로 나왔다고 판단되면(동어반복·조사 오류) → 해당 문장만 큐레이션 플래그 `needs_human_review`

## 협업

- **앞 단계**: `curriculum-architect`(단원 확정), `vocab-pack-builder`(팩 확정)
- **뒷 단계**: `content-curator` 큐레이션 체크리스트 → Supabase production 적재
- **TTS 사전 생성**: 큐레이션 통과 후 배치로 처리. 이 파이프라인은 "캐시 후보 리스트" 만 남긴다
- **Vocab Helper**: 팩에 포함된 덩어리의 voca/경선식 생성은 이 파이프라인이 하지 않는다 — `#ai-prompt-designer` 의 Vocab Helper 템플릿을 따른다
