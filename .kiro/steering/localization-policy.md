---
inclusion: fileMatch
fileMatchPattern: 'app/src/**/*.{ts,tsx}'
---

# Localization Policy — 한국어 UI / 영어 콘텐츠

> 앱 소스에 새로운 사용자 대면 문자열을 추가할 때 참조한다.
> SentenceFlow의 타깃 사용자는 한국어 화자이므로 **UI는 한국어**, 학습 대상인 **영어 문장·단어는 영어** 로 둔다.

## 한국어로 쓴다

다음 문자열은 반드시 한국어로 쓴다:

- 버튼 라벨 — `다시 듣기`, `다음`, `건너뛰기`, `모르겠어요`
- 헤더·섹션 제목 — `오늘의 학습`, `최근 본 단어`
- 빈 상태·에러·로딩 메시지 — `문장을 불러오지 못했어요.`, `다시 시도`
- 토글·선택지 라벨 — `한국어 번역 보기`, `청크 단위 일시정지`
- `accessibilityLabel` / `accessibilityHint` — 스크린리더 사용자도 한국어 화자 기준
- `accessibilityLiveRegion` 으로 읽힐 배너 본문 (retry guidance 등)

혼합 표기 허용: 한국어 문장 안에서 영어 단어를 지칭할 때는 그 단어만 영어로 남긴다.
- ✅ `pizza 선택하기`
- ✅ `슬롯 4, pizza 선택됨`
- ❌ `Pick pizza for slot 4`

## 영어로 쓴다

- 학습 대상인 영어 문장·청크·예문 원문
- 단어 자체(`pizza`, `serendipity`), IPA 발음 기호, 품사 약어(`n.`, `v.`) 원형
- 라이선스·출처 메타데이터 원 문자열 (`CC-BY-2.0-FR` 등)
- 개발자용 주석, JSDoc, 변수명, 커밋 메시지, 에러 로그 세부 정보

## Level / 진행 표기

레벨 카운터는 한국어 포맷을 쓴다:
- ✅ `레벨 1 / 4`, `Level 1 / 4` 둘 중 한쪽으로 통일 (프로젝트 표준은 **한국어**)
- 숫자는 아라비아 숫자 유지

## 테스트와의 관계

`@testing-library/react-native` 의 `getByText('...')` / `getByLabelText('...')` 는 UI 문자열에 직접 의존한다. UI를 한국어로 쓰면 테스트도 한국어 라벨로 맞춘다. 테스트 안의 영어 문자열은 두 경우에만 허용:

1. 학습 콘텐츠 fixture (`'I want to eat pizza.'` 등)
2. 구현 내부 식별자 (`testID="slot-4-offending"`, enum 값 `'retry'`)

## 새 컴포넌트를 만들 때

1. 표시될 한국어 문자열 목록을 먼저 정리한다
2. `accessibilityLabel` 은 스크린리더가 의미를 전달할 수 있는 한국어로 작성한다
3. 영어 원문을 지칭해야 할 때는 템플릿 문자열로 한국어 컨텍스트에 끼워넣는다
4. 외래어 표기는 국립국어원 표기를 기본으로 (예: `카드`, `리스트`) 하되 `TTS`, `IPA`, `CEFR` 같은 약어는 대문자 영어 유지
