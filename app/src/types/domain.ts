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

/** 4-step flow used inside Track B (design.md Track_B_Player). */
export type TrackBStep = 'chunking' | 'listen' | 'shadowing' | 'summary';

/** Playback speed multipliers exposed in Track B (Req 5.2). */
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25;
