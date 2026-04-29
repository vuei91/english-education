# Tasks — 문장·독해 학습 MVP

> requirements.md와 design.md를 기준으로 분해한 구현 작업 목록.
> 각 항목은 1~3일 내 완료 가능한 단위. `(Req N.M)`으로 요구사항 역추적.
> 실행 순서는 **프로젝트 셋업 → 데이터 → 서비스 → 화면 → 광고·동기화 → 출시** 순서.

## 1. 프로젝트 셋업

- [x] 1.1 React Native (Expo) 프로젝트 초기화, TypeScript strict 모드, ESLint/Prettier
- [x] 1.2 React Navigation 설치 및 루트 Stack + Tab 구조 스캐폴딩 (Onboarding, Dashboard, TrackA, TrackB, Me)
- [x] 1.3 Zustand 스토어 뼈대 4개 생성 — `useUserStore`, `useSessionStore`, `useProgressStore`, `useVocabStore`
- [x] 1.4 디자인 토큰(컬러·타이포·간격) 정의, 다크 모드 대응
- [x] 1.5 로컬 SQLite 설정 (`react-native-quick-sqlite`) 및 마이그레이션 러너

## 2. Supabase 인프라

- [x] 2.1 Supabase 프로젝트 생성, 환경 변수 분리 (dev/prod), anon key만 클라이언트에 노출 (Req 16)
- [x] 2.2 콘텐츠 테이블 스키마 생성 — `sentences`, `chunks`, `sentence_summary`, `pattern_drills`, `vocab_entries` (Req 3.1, 4.1, 6.2, 8, 11)
- [x] 2.3 사용자 데이터 테이블 스키마 생성 — `user_sentence_progress`, `user_word_tap`, `user_daily_progress`, `user_streak`, `user_rewards_log` (Req 13, 15, 17)
- [x] 2.4 RLS 정책 적용 — 콘텐츠 테이블은 `status='production'` public read, `user_*` 테이블은 `user_id = auth.uid()` 제약 (Req 11.4, 17.7)
- [x] 2.5 Storage 버킷 구성 — `audio/sentences`, `audio/chunks`, `audio/vocab` (Req 7.2)
- [x] 2.6 Edge Function `get-signed-audio-url` 배포 (Req 7.2)

## 3. 콘텐츠 시드 데이터 투입

- [-] 3.1 파이프라인 산출물 수입 스크립트 — `sentences` staging→production 이동, 라이선스·CEFR 검증 (Req 11.1, 11.4)
- [-] 3.2 MVP 시드: 트랙 A 500문장, 트랙 B 100문장, 패턴 드릴 20세트, Vocab 500단어 (Req 1.1, 2.1, 3.1, 8)
- [-] 3.3 시드 문장에 대한 청킹·구조 요약·vocab 사전 배치 결과 적재 (Req 4.1, 6.2, 9, 10)
- [ ] 3.4 시드 문장·청크·단어의 TTS 오디오 사전 생성 후 Storage 업로드 (Req 7.1, 7.2)
- [ ] 3.5 앱 초기 설치 시 제공될 오프라인 pre-seed 20문장 에셋 번들 (Req 7.3, 에러 핸들링)

> Approach A (lean): MVP-unblock 용 샘플 시드만 우선 투입 — `seed_content_sample` 마이그레이션으로
>   - Track A 30 / Track B 10 / chunks 41 / summary 10 / drills 2 / vocab 25
> 본격 수량(A 500 / B 100 / vocab 500)과 자동 파이프라인(Tatoeba·VOA 수집·LLM 확장·큐레이션·TTS)은
> 별도 콘텐츠 파이프라인 스펙으로 분리 예정. 3.4/3.5는 섹션 6(AudioService)와 병행.

## 4. 로컬 저장소 & 동기화

- [x] 4.1 SQLite 스키마 정의 — `content_cache`, `sentence_progress`, `word_tap_events`, `daily_progress`, `streak`, `rewards_log`, `sync_queue` (Req 12.1, 13, 17.1)
- [x] 4.2 `ContentService` 구현 — 로컬 캐시 우선, 서버 폴백, TTL 정책 (Req 11.2, 11.3, 12.2)
- [x] 4.3 `SyncService` enqueue/flush/backoff 구현, NetInfo 연동 (Req 17.2, 17.3, 17.5, 17.6)
- [x] 4.4 충돌 해결 — `updated_at` 최신 승 규칙 구현 (Req 17.4)
- [x] 4.5 익명 UUID → 로그인 계정 병합 로직 (Req 16.3)

> 4.2: Word Unresolved Score 기반 가중치는 Task 11.1에서 추가. 현재는 CEFR 필터링까지만.
> 4.3: NetInfo 연결은 실제 네트워크 리스너가 필요한 Task 15(앱 부팅 엮기) 또는 실사용 단계에서 연결. 서비스는 플러그인 지점만 제공.
> 4.4: 클라이언트 upsert + Postgres `BEFORE UPDATE` 트리거로 "latest updated_at wins" 이중 보강.
> 4.5: `SyncService.mergeAnonymousData` 구현. 실제 호출은 Task 14에서 로그인 플로우 완료 시.

## 5. 인증

- [x] 5.1 `AuthService` — Supabase Auth 기반 이메일 로그인 (Req 16.1)
- [-] 5.2 Apple 로그인 연동 (Req 16.1)
- [-] 5.3 Google 로그인 연동 (Req 16.1)
- [x] 5.4 로컬 UUID 기반 익명 모드 — 로그인 없이 학습 가능 (Req 16.2)
- [x] 5.5 로그아웃 시 로컬 개인 데이터 정리, 미전송 큐 보존 (Req 16.4)

> 5.2/5.3: AuthService에 스텁 메서드 구현 완료. 실제 provider 연동(Apple Developer / Google OAuth client 발급 + Supabase Dashboard provider 활성화)은 Task 14 온보딩 UI 작업 시 함께 처리.

## 6. AudioService

- [x] 6.1 `expo-av` 기반 재생 래퍼, 속도 조절 `setRate` 지원 (Req 7.4)
- [x] 6.2 오디오 LRU 캐시 (최대 200MB) 및 prefetch 큐 (Req 7.1, 7.2)
- [x] 6.3 Edge Function 호출 → signed URL 획득 → 다운로드 (Req 7.2)
- [x] 6.4 기기 TTS 폴백 구현 (`expo-speech` 또는 RN TTS) (Req 7.3)
- [x] 6.5 마이크 권한 요청 경로가 없는지 감사 및 Lint 룰 추가 (Req 7.5)
- [x] 6.6 중단 API `stop()` 및 현재 재생 인터럽트 처리 (Req 7.6)

## 7. 트랙 A — 짧은 문장

- [x] 7.1 `SentenceCard` 컴포넌트 — 영어 원문, 한국어 토글, 단어 탭 콜백 (Req 1.2, 1.8)
- [x] 7.2 `TrackASessionScreen` 플로우 — 다음 문장 로드 → 자동 재생 1회 → 완료 처리 (Req 1.1, 1.3, 1.6)
- [x] 7.3 재생 버튼·반복 재생 UI (Req 1.4)
- [x] 7.4 "알았어요 / 어려워요" 두 등급 `FeedbackBar` 및 우선순위 반영 (Req 1.7)
- [x] 7.5 발화 감지·평가 코드 경로 없음을 테스트로 고정 (Req 1.5)

> 7.2: 재생은 `expo-speech` 기반 임시 `audioPlayer`로 연결. 정식 AudioService(Task 6)에서 cache-first 재생으로 교체 예정, 호출 시그니처 유지.
> 7.4: 피드백은 현재 세션 전환 트리거로만 사용. SyncService 업로드 + Word Unresolved Score 가중치는 Task 11/17 연결 시 추가.

## 8. 트랙 A — 패턴 드릴

- [x] 8.1 `PatternDrillPanel` 4단계 레벨 전환 UI (Req 2.2)
- [x] 8.2 변형 문장 오디오 재생 연동 (Req 2.3)
- [x] 8.3 Level 4 슬롯 채우기 + 문법 성립 여부 로컬 룰 검증 (Req 2.4)
- [x] 8.4 오답 페널티 없이 재선택 안내 처리 (Req 2.5)
- [x] 8.5 같은 패턴 N회(기본 3회) 완료 시 "패턴 마스터" 배지 지급 (Req 2.7)

## 9. 트랙 B — 긴 문장

- [x] 9.1 `TrackBSessionScreen` 스텝 네비게이터 — CHUNKING/LISTEN/SHADOWING/SUMMARY (Req 3.1, 3.2, 3.3)
- [x] 9.2 `ChunkingView` depth·role별 시각화, 청크 탭 시 오디오 재생 (Req 4.1, 4.2, 4.3)
- [x] 9.3 청크 폴백 — 데이터 없을 때 단일 청크로 표시 (Req 4.4)
- [x] 9.4 단어 탭 지원 — 청크 단위에서 Vocab Helper 호출 (Req 3.4, 4.5)
- [x] 9.5 `ShadowingPlayer` — 자동 재생, 속도 슬라이더, 구간 반복 (Req 5.1, 5.2, 5.3)
- [x] 9.6 "청크 단위 일시정지" 옵션 — 각 청크 종료 후 1.5초 정지 (Req 5.4)
- [x] 9.7 섀도잉 중 사용자 녹음·평가 코드 경로 없음을 테스트로 고정 (Req 5.5)
- [x] 9.8 `StructureSummaryView` — 4슬롯 표시, 결측값 "—" 처리, 입력 요구 없음 (Req 6.1~6.4)
- [x] 9.9 세션 완료 시 `sentence_progress` 기록 (Req 3.5)

## 10. Vocab Helper

- [x] 10.1 `VocabHelperSheet` 바텀 시트 모달 셋업 — 전역 호출 가능한 싱글톤 (Req 8.1, 8.8)
- [x] 10.2 기본 헤더 — 단어, 품사, 뜻, IPA, 🔊 재생 (Req 8.2)
- [x] 10.3 Etymology/Mnemonic/예문 3탭 + 선호 탭 기억 (Req 8.3, 8.4)
- [x] 10.4 데이터 결측 시 해당 탭 숨김 (Req 8.5, 8.6)
- [x] 10.5 시트 닫기 시 원 문장 위치 복귀 (Req 8.7)
- [x] 10.6 `Etymology_View` — 접두사·어근·접미사 분해 및 관련 단어 최대 5개 (Req 9.1, 9.2)
- [x] 10.7 관련 단어 탭 시 Vocab Helper 내부 swap (Req 9.3)
- [x] 10.8 `Mnemonic_View` — 한국어 연상 문구 + 스토리 한 문장 (Req 10.1, 10.2)
- [x] 10.9 단어 탭 이벤트 `word_tap_events` 기록 + Word Unresolved Score 계산 (Req 12.1, 12.2)
- [x] 10.10 `RecentWordsScreen` — 최근 탭된 단어 Vocab Helper 카드 나열 (Req 12.4)
- [x] 10.11 단어 단독 SRS 화면이 절대 만들어지지 않도록 라우트·테스트 가드 (Req 12.3)

> 10.3: 선호 탭 기억은 현재 세션 내 상태로만 유지 — 다음 시트 열 때까지 유지되는 사용자 선호 저장은 Task 14 설정 확장 시 추가.
> 10.9: 탭 이벤트는 `useVocabStore` (메모리) + `word_tap_events` 네이티브 SQLite 두 곳에 기록. Word Unresolved Score 실제 계산·랭킹은 Task 11 에서 ContentService 쿼리에 엮을 때 완성.

## 11. 콘텐츠 우선순위 엔진

- [x] 11.1 `ContentService.getNextSentence` — CEFR 필터 + Word Unresolved Score 가중치 (Req 11.2, 11.3, 12.2)
- [-] 11.2 Source 기반 노출 제약 — CC BY-SA 출처 표시 (Req 11.5)
- [x] 11.3 staging 상태 Sentence 노출 차단 테스트 (Req 11.4)

> 11.1: Postgres RPC `pick_next_sentence` 로 CEFR 허용 + hot-word 부스트 + 세션 exclude + 랜덤 선택을 서버 1 round-trip 으로 처리. RLS `status='production'` 자동 적용.
> 11.2: 데이터 경로는 열려 있음 (`Sentence.source` 필드 유지). CC BY-SA 라이선스 뱃지 UI는 해당 소스 문장이 실제로 투입되는 Task 3 파이프라인 시점에 추가.
> 11.3: Supabase 운영 DB에서 `status='staging'` 10회 drawing → 노출 0회 smoke 검증 완료.

## 12. Progress & Streak

- [x] 12.1 `useProgressStore` — Daily_Goal·카운터·Streak·Heart 관리 (Req 13.1, 13.2)
- [x] 12.2 앱 포그라운드 진입 시 일일/Streak 리셋 체크 (Req 13.2, 13.5)
- [x] 12.3 문장 완료 시 카운터 증가 및 Daily_Goal 달성 판정 (Req 13.3, 13.4)
- [x] 12.4 `DashboardScreen` — 누적·오늘·Streak·최고 Streak 표시 (Req 13.6)
- [x] 12.5 Daily_Goal 설정 UI (5/10/20/30 선택) — Me 탭 (Req 13.1)

## 13. AdMob 통합

- [ ] 13.1 `react-native-google-mobile-ads` 설치 및 config plugin (Expo 호환)
- [ ] 13.2 `AdService.renderBanner` — placement 화이트리스트 검증, 허용 외 렌더 거부 (Req 14.1, 14.2, 14.3)
- [ ] 13.3 배너 상단 "운영 후원 광고" 라벨 및 로드 실패 시 0 높이 (Req 14.4, 14.5)
- [ ] 13.4 `AdService.showRewarded` — 보상 유형별 확인 화면, 완료 콜백에서만 `RewardGrant` 발행 (Req 15.1, 15.2, 15.3, 15.4)
- [ ] 13.5 보상 유형별 일일 상한 체크 (`user_rewards_log` 기반) (Req 15.5, 15.6)
- [ ] 13.6 학습 세션 중 전면 광고 자동 재생 없음 테스트 (Req 15.7)

## 14. 온보딩

- [x] 14.1 `OnboardingScreen` — 3스텝 (언어 선호 → CEFR 선택 → 기본 트랙) (Req 18.1)
- [x] 14.2 "발화 강제 없음" 안내 고정 패널 (Req 18.2)
- [x] 14.3 온보딩 완료 시 로컬 설정 저장 (Req 18.3)
- [x] 14.4 로그인 건너뛰기 버튼 및 익명 UUID 발급 (Req 18.4)

> 14.1: 스텝 1(Welcome/발화 강제 없음)은 Req 18.2를 흡수. 현재는 CEFR을 5개 버튼 자가 선택 방식으로 구현 (자가 진단 퀴즈는 후속 확장 여지).
> 14.4: Apple/Google 로그인 버튼은 MeScreen 로그인 플로우(후속)와 함께 엮을 예정. 지금은 익명 모드로 진입 후 나중에 로그인 전환 가능.

## 15. 품질·접근성

- [ ] 15.1 주요 버튼 `accessibilityLabel` 부여, 스크린리더 QA
- [ ] 15.2 다크 모드 전 화면 점검
- [ ] 15.3 로컬 lint 룰 — 발화 평가/STT/수집/Share Extension/Firebase Auth 임포트 차단
- [ ] 15.4 핵심 학습 루프 유닛 테스트 (트랙 A 1문장 완료, 트랙 B 4스텝 통과, Vocab 호출·복귀)
- [ ] 15.5 Rewarded 보상 지급 경로 통합 테스트
- [ ] 15.6 오프라인 시나리오 E2E — 비행기 모드에서 1세션 완주 후 온라인 복구 동기화

## 16. 출시 준비

- [ ] 16.1 개인정보처리방침·서비스약관 초안 배포 (광고·Supabase 처리 명시)
- [ ] 16.2 AdMob 실제 계정·광고 단위 발급 및 프로덕션 빌드에서만 실제 ID 주입
- [ ] 16.3 앱스토어 메타데이터 (스크린샷, 설명 — "문장·독해 중심, 발화 강제 없음" 포지셔닝)
- [ ] 16.4 Play Store 내부 테스트 트랙 배포
- [ ] 16.5 TestFlight 배포
- [ ] 16.6 베타 피드백 수집 (1주) 후 크리티컬 이슈 핫픽스
- [ ] 16.7 스토어 정식 제출 및 출시
