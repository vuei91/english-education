# Tech Stack — 기술 선택과 금지 사항

> 이 파일은 모든 대화에 자동 포함된다. 기술 제안·코드 작성 시 여기 명시된 스택을 **기본값으로** 사용한다.
> 최신 선택 근거는 #[[file:docs/planning.md]] 10장 참조.

## 확정된 기본 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 모바일 | **React Native** (TypeScript) | JS/TS 생태계, AdMob·Supabase RN SDK 성숙, 네이티브 확장 사례 풍부 |
| 상태관리 | Zustand 또는 Redux Toolkit | 새로운 대안을 제안하기 전에 이유를 명시한다 |
| 백엔드/인프라 | **Supabase** (PostgreSQL + Auth + Storage) | 무료 티어로 MVP 시작 |
| 로컬 DB | SQLite (`react-native-quick-sqlite` 계열) | 오프라인 학습 데이터 |
| 네비게이션 | React Navigation | |
| AI 주력 | **Groq — Llama 3.3 70B** | 독해 퀴즈 채점, 회화(후속) |
| AI 경량 | **Groq — Llama 3.1 8B** | Vocab Helper 생성, 청킹, 대량 호출 |
| AI 폴백 | OpenAI GPT-4o-mini | Groq Rate Limit 또는 품질 필요 시 |
| TTS | **기기 TTS + 사전 생성 자연 음성 캐시** | 듣기 품질이 앱의 1순위 경험 |
| 광고 | **AdMob** (배너 + Rewarded) | MVP 수익 기반 |
| 빌드 | Expo(가능하면) 또는 RN bare | Expo 제약이 걸리는 기능이 있으면 bare로 전환 |

## 명시적으로 쓰지 않는 것

| 금지 | 이유 |
|------|------|
| **STT(Speech-to-Text)** | 발음 평가를 하지 않으므로 불필요. Whisper/iOS Speech/Android SpeechRecognizer 모두 MVP 대상 아님 |
| **유료 구독 SDK (RevenueCat 등)** | 핵심 기능 유료화하지 않음 |
| **공유 확장(Share Extension) / Intent Filter (외부 텍스트 수신용)** | 사용자 수집 기능을 만들지 않음 |
| **OCR 라이브러리** | 수집 기능 없음 |
| **Firebase Authentication** | Supabase Auth로 통일 |
| **유료 코퍼스(Oxford·Cambridge)** | MVP 범위 외. 성장기 재검토 |

## AI 호출 원칙

- **캐싱 우선** — 같은 입력에는 같은 출력. Supabase 또는 로컬에 결과를 저장하고 재호출을 피한다
- **배치 처리** — 단건 요청이 필요 없는 작업(청킹·Vocab Helper 생성·독해 퀴즈 생성)은 사전 배치
- **사용자당 일일 호출 상한** — 런타임 호출(독해 퀴즈 채점 등)은 기본 5회/일, 추가는 Rewarded Ad로 확장
- **Rate Limit 대응** — 429 시 지수 백오프 3회 후 OpenAI 폴백
- **비용 감시** — 경량 작업에 70B 쓰지 말 것. 용도별 모델 매핑은 planning.md 10-1 표를 따른다

## TTS 원칙

- **자주 쓰이는 문장은 사전 오디오 생성 후 Storage 캐싱** — 런타임 합성 최소화
- **기기 TTS는 폴백** — 캐시 미스 또는 네트워크 없을 때
- **속도 조절은 오디오 재생 배율**로 처리 (0.5x / 0.75x / 1x / 1.25x)
- TTS 음질은 **앱의 1순위 경험**. 저품질 음성을 "일단 되니까" 내보내지 않는다

## 성능·보안 기본선

- 오프라인 우선: 모든 학습 이벤트는 로컬 DB에 먼저 기록 후 동기화
- Supabase RLS(Row Level Security) 기본 활성화. 사용자 데이터는 본인만 접근
- API 키(Supabase anon 외)는 클라이언트에 넣지 않는다. Groq/OpenAI 호출은 Supabase Edge Function 경유

## 새 의존성 추가 시

새 라이브러리를 제안하기 전에 다음을 확인한다:

1. 위 "쓰지 않는 것" 목록에 저촉되는가
2. Expo 호환 여부 (bare 전환이 필요하면 명시)
3. 번들 크기와 네이티브 의존성
4. 최근 12개월 내 유지보수 여부

의존성 추가가 타당하면 이유를 한 줄 코멘트로 붙인다.
