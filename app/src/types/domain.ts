/**
 * Shared domain types.
 * Keep this file small and stable — screens, services, and stores import
 * from here, so breaking changes ripple widely.
 */

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export type Track = 'A' | 'B';

/** Two-grade feedback captured per sentence in Track A (Req 1.7). */
export type SentenceFeedback = 'known' | 'hard';

/** Rewards granted after watching a rewarded ad (Req 15.5). */
export type RewardType = 'heart' | 'unlock' | 'drill-retry';

/** 5-step flow used inside Track B. Quiz is optional after summary. */
export type TrackBStep = 'chunking' | 'listen' | 'shadowing' | 'summary' | 'quiz';

/** Playback speed multipliers exposed in Track B (Req 5.2). */
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25;

// ---------------------------------------------------------------------------
// Curriculum foundation (curriculum-foundation spec, Tasks 3.1~3.3)
// ---------------------------------------------------------------------------

/**
 * Grammar track the unit opens up. A single unit opens at most one point on
 * one track; some units open nothing new (review units) and carry `null`.
 * (Req 3.2)
 */
export type GrammarTrack = 'tense' | 'sentence_type' | 'verbal' | 'conjunction';

/**
 * Free-form grammar point identifier (e.g. 'T1', 'T2', 'S1'). The curated
 * enum is enforced at runtime by a validator rather than in the type system,
 * since new points can be added without a code deploy. (Req 3.2)
 */
export type GrammarPoint = string;

/** `null` when the unit is a review unit and opens no new grammar. (Req 3.2) */
export type UnitOpens = { track: GrammarTrack; point: GrammarPoint } | null;

/** Step ordering is strict: phrase (1) → conjugation (2) → substitution (3). (Req 3.3) */
export type CurriculumStepType = 'phrase' | 'conjugation' | 'substitution';

/** Part-of-speech tag carried by each `VocabPackEntry`. `'chunk'` marks
 *  multi-word units (e.g. phrasal verbs, collocations). (Req 3.4) */
export type VocabPackPos = 'noun' | 'verb' | 'adj' | 'chunk';

/**
 * A curriculum unit groups three curriculum steps that share a theme and
 * a single vocab pack.
 * `prerequisiteIds` is declarative — unlock enforcement is opt-in via
 * `CurriculumService.isUnitUnlocked({ enforce: true })`. (Req 3.1)
 */
export type CurriculumUnit = {
  id: string;
  orderIndex: number;
  titleKo: string;
  cefrLevel: CEFRLevel;
  opens: UnitOpens;
  vocabPackId: string;
  theme: string;
  prerequisiteIds: readonly string[];
};

/** Ordered step inside a unit. `orderIndex` mirrors the stepType ordering and
 *  is constrained to 1/2/3 so the compiler can catch off-by-one mistakes. (Req 3.1) */
export type CurriculumStep = {
  id: string;
  unitId: string;
  stepType: CurriculumStepType;
  orderIndex: 1 | 2 | 3;
};

/**
 * A single row inside a vocab pack. `isChunk` and `pos === 'chunk'` stay in
 * sync by construction — the `isChunkEntry` type guard relies on that
 * invariant.
 * `phrasalOf` / `collocates` are optional hints used by pack builders; they
 * may be `null` or absent for plain single-word entries. (Req 3.5)
 */
export type VocabPackEntry = {
  word: string;
  isChunk: boolean;
  pos: VocabPackPos;
  role: 'new' | 'review';
  phrasalOf?: string | null;
  collocates?: readonly string[] | null;
};

/** A vocab pack is immutable once seeded. `size` is the server-authoritative
 *  count and should equal `entries.length`. (Req 3.5) */
export type VocabPack = {
  id: string;
  titleKo: string;
  size: number;
  entries: readonly VocabPackEntry[];
};

/** Narrowed form of `VocabPackEntry` for multi-word chunks. (Req 3.5) */
export type ChunkEntry = VocabPackEntry & { isChunk: true; pos: 'chunk' };

/**
 * Type guard: narrows a `VocabPackEntry` to `ChunkEntry`. We require *both*
 * `isChunk === true` and `pos === 'chunk'` so a malformed row (one flag
 * without the other) is not silently treated as a chunk. (Req 3.5)
 */
export function isChunkEntry(entry: VocabPackEntry): entry is ChunkEntry {
  return entry.isChunk === true && entry.pos === 'chunk';
}

/**
 * Sentence — moved here from `ContentService.ts` (curriculum-foundation
 * Task 3.3). `ContentService` still re-exports this name for backward
 * compatibility so existing `import { type Sentence } from
 * '../../services/content'` call sites keep working.
 *
 * New fields (Req 2.3, 3.6):
 *  - `curriculumStepId`: which curriculum step this sentence belongs to, or
 *    `null`/undefined when the sentence is not yet tied to the curriculum.
 *  - `isPhrase`: `true` for short phrase-level rows used by Step 1 drills;
 *    `false` for regular sentences.
 */
export type Sentence = {
  id: string;
  track: Track;
  textEn: string;
  textKo: string | null;
  cefrLevel: CEFRLevel;
  situation: string | null;
  source: string;
  license: string;
  curriculumStepId?: string | null;
  isPhrase: boolean;
};

// ---------------------------------------------------------------------------
// 30-day curriculum (curriculum-30day-migration.md)
// ---------------------------------------------------------------------------

/** A single intro phrase shown before the main session. */
export type IntroPhrase = {
  en: string;
  ko: string;
};

/**
 * A Day groups one or more `CurriculumUnit`s with ordering and chapter metadata.
 * The Day number (1–30) is the user-facing progression counter.
 * `unitIds` lists all units for this day (from `curriculum_day_unit` bridge table).
 * `unitId` is kept as the first unit for backward compatibility.
 */
export type CurriculumDay = {
  id: string;
  dayNumber: number;
  chapter: 1 | 2 | 3;
  titleKo: string;
  subtitleKo: string | null;
  descriptionKo: string | null;
  isReview: boolean;
  unitId: string;
  unitIds: string[];
  cefrLevel: CEFRLevel;
  introPhrases: IntroPhrase[];
};

/** Static chapter metadata. */
export type Chapter = {
  number: 1 | 2 | 3;
  titleKo: string;
  subtitleKo: string;
  descriptionKo: string;
  dayRange: [number, number];
};

/** The three chapters of the 60-day curriculum. */
export const CHAPTERS: readonly Chapter[] = [
  {
    number: 1,
    titleKo: '기초 문장 훈련',
    subtitleKo: '영어 기본기 기르기',
    descriptionKo:
      '주어+동사+목적어 기본 구조부터 시작합니다. 일상에서 바로 쓸 수 있는 짧은 문장을 반복 청취하며 영어 어순에 익숙해지세요. 매일 핵심 패턴 하나를 집중 훈련합니다.',
    dayRange: [1, 15],
  },
  {
    number: 2,
    titleKo: '문장 확장 훈련',
    subtitleKo: '문장을 길게 만들기',
    descriptionKo:
      '접속사, 관계대명사, 부사절을 활용해 문장을 확장합니다. 짧은 문장 여러 개를 하나의 긴 문장으로 연결하는 연습을 통해 독해력과 표현력을 동시에 키웁니다.',
    dayRange: [16, 38],
  },
  {
    number: 3,
    titleKo: '심화 표현 훈련',
    subtitleKo: '자연스러운 영어 말하기',
    descriptionKo:
      '원어민이 실제로 쓰는 관용 표현, 구동사, 뉘앙스 차이를 익힙니다. 긴 지문을 청킹으로 끊어 듣고 독해 퀴즈로 이해도를 확인하며 실전 영어에 가까워집니다.',
    dayRange: [39, 60],
  },
] as const;

/** Total days in the curriculum. */
export const TOTAL_DAYS = 60;

// ---------------------------------------------------------------------------
// Track B 60-day reading curriculum
// ---------------------------------------------------------------------------

/** Static chapter metadata for Track B reading curriculum. */
export type ReadingChapter = {
  number: 1 | 2 | 3;
  titleKo: string;
  subtitleKo: string;
  descriptionKo: string;
  dayRange: [number, number];
};

/** The three chapters of the 60-day reading curriculum. */
export const READING_CHAPTERS: readonly ReadingChapter[] = [
  {
    number: 1,
    titleKo: '기초 독해',
    subtitleKo: '짧은 지문 읽기',
    descriptionKo:
      '3~5문장 길이의 짧은 지문을 청킹으로 끊어 읽고, 핵심 내용을 파악하는 연습을 합니다. 매일 3개 지문을 통해 독해 기초 체력을 기릅니다.',
    dayRange: [1, 20],
  },
  {
    number: 2,
    titleKo: '중급 독해',
    subtitleKo: '문단 단위 읽기',
    descriptionKo:
      '5~8문장 길이의 문단을 읽고 구조를 분석합니다. 접속사와 지시어를 따라가며 글의 흐름을 이해하고, 독해 퀴즈로 이해도를 확인합니다.',
    dayRange: [21, 42],
  },
  {
    number: 3,
    titleKo: '심화 독해',
    subtitleKo: '실전 지문 읽기',
    descriptionKo:
      '뉴스, 에세이, 설명문 등 실전 지문을 읽습니다. 긴 문장을 청킹으로 분해하고 섀도잉으로 체화한 뒤, 주관식 퀴즈로 깊이 있는 이해를 확인합니다.',
    dayRange: [43, 60],
  },
] as const;

/** Total days in the reading curriculum. */
export const READING_TOTAL_DAYS = 60;

/** Passages per day in the reading curriculum. */
export const READING_PASSAGES_PER_DAY = 3;

/**
 * A single day in the Track B reading curriculum.
 * Each day contains 3 passages (sentences) for the user to work through.
 */
export type ReadingDay = {
  id: string;
  dayNumber: number;
  chapter: 1 | 2 | 3;
  titleKo: string;
  subtitleKo: string | null;
  /** Ordered sentence IDs for this day's 3 passages. */
  passageIds: string[];
};
