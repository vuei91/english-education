import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { audioService } from '../../services/audio';
import {
  PATTERN_DRILL_LEVELS,
  validateAllSlots,
  type PatternDrillLevel,
  type PatternDrillVariant,
  type PatternDrillVariants,
  type SlotSelection,
  type SlotValidation,
} from '../../services/content';
import { DRILL_COMPLETION_THRESHOLD, useProgressStore } from '../../stores';
import { useTheme, type Theme } from '../../theme';

/**
 * PatternDrillPanel — Req 2.2, 2.3, 2.4, 2.5.
 *
 * Walks the learner through the four drill levels — 원문 반복 →
 * 같은 자리 교체 → 다른 자리 교체 → 슬롯 채우기 — in order.
 *
 * Task 8.1 established the 4-level navigation shell + `onPlayVariant`
 * seam.
 *
 * Task 8.2 wired variant audio:
 *   - Level 1: no auto-play (session already played the origin).
 *   - Level 2 / 3: auto-play + manual replay button.
 *   - Level 4: no audio (slot-filling, not listening).
 *
 * Task 8.3 wired the Level 4 slot-filling UI:
 *
 *   - Each `slotHint` position becomes a blank chip. Non-slot tokens
 *     render as plain text.
 *   - Tapping a chip reveals its `choices`. Picking a choice fills
 *     the chip and triggers validation.
 *   - Validation is the local `validateAllSlots` (Req 2.4). If the
 *     parent provides `onSlotSelect`, its result can escalate the
 *     decision to a retry; otherwise the local validator is the sole
 *     authority.
 *   - "Finish drill" stays disabled (visible but
 *     `accessibilityState={ disabled: true }`) until every slot is
 *     filled AND the combined validation is `ok`. No penalty, no
 *     hidden UI.
 *   - Filled chips are re-openable so the learner can revise their
 *     choice freely — penalty-free revision is the listen-first
 *     equivalent of letting the user tap "next" any time.
 *
 * Task 8.4 (this task) turns the retry seam into visible, penalty-
 * free guidance (Req 2.5 — "재선택을 안내하되 오답 페널티는 부과하지
 * 않는다"):
 *
 *   - `renderFeedback` now receives a discriminated-union
 *     `DrillFeedbackState` so a caller can read the retry `reason`
 *     and the `offendingTokenIndex` without re-running the validator.
 *   - When the caller does NOT supply `renderFeedback`, the panel
 *     renders a built-in retry banner with `accessibilityLiveRegion="polite"`
 *     so screen readers announce the hint without interrupting. The
 *     banner's copy is pure guidance — no "wrong", "incorrect",
 *     "failed", no heart decrement, no animation of failure.
 *   - The offending chip (when the reason pinpoints a tokenIndex)
 *     gets `accessibilityState={{ invalid: true }}` + a soft accent
 *     outline. Every other chip stays fully interactive with
 *     identical styling — Req 2.5 is about **guidance**, not
 *     disabling the learner's options.
 *
 * Sibling tasks still own:
 *   - 8.5 — "pattern master" badge on N completions via
 *     `renderFeedback({ kind: 'ok' })` + session integration.
 *
 * Task 8.5 (this task) adds the "pattern master" badge (Req 2.7):
 *
 *   - New optional `originSentenceId` prop. When present, the panel
 *     calls `useProgressStore.recordDrillCompletion(originSentenceId)`
 *     inside its `Finish drill` handler — *after* the caller's
 *     `onExitDrill?.()`, so parents still get first crack at the
 *     event and can navigate away or trigger their own side effects
 *     before the store update fires.
 *   - When `recordDrillCompletion` returns `true` (this completion
 *     crossed the 3× threshold), the panel enters a "badge just
 *     earned" state for the current variant and renders a compact
 *     celebration block above the button area.
 *   - The celebration block is suppressed when `renderFeedback` is
 *     supplied — Task 8.4's render-prop contract means the caller
 *     owns feedback UI entirely, including "ok" states. That lets a
 *     future `TrackASessionScreen` replace the default banner with
 *     a richer celebration without the panel fighting it.
 *   - No `originSentenceId` → no store call, no banner. Tests that
 *     never cared about badges stay clean.
 *
 * Session wiring (mounting the panel in `TrackASessionScreen` and
 * feeding it `originSentenceId` from the current `PatternDrill`) is
 * a follow-up outside 8.5's scope.
 *
 * Non-Goal guard: no microphone / speech-recognition surface anywhere
 * (Req 2.6 / product-context). If a future task tries to add one, it
 * has to cross a steering + spec review.
 */

const LEVEL_TITLES: Record<PatternDrillLevel, string> = {
  1: '원문 반복',
  2: '같은 자리 교체',
  3: '다른 자리 교체',
  4: '슬롯 채우기',
};

/**
 * Levels that receive automatic + manual variant audio per Req 2.3.
 * Centralised so the auto-play effect and the replay button can't
 * drift out of sync.
 */
const AUDIO_LEVELS: ReadonlySet<PatternDrillLevel> = new Set<PatternDrillLevel>([2, 3]);

export type SlotValidationResult =
  | { kind: 'ok' }
  | { kind: 'retry'; reason?: string };

/**
 * 8.4 feedback signal carried to `renderFeedback`. Split into a
 * discriminated union so callers don't need to reconstruct the
 * retry reason from the validator themselves. Added fields (over
 * the old 'retry' | 'ok' string) are additive and optional: we
 * pass them when we know them, and callers can ignore them.
 */
export type DrillFeedbackState =
  | { kind: 'ok' }
  | {
      kind: 'retry';
      /**
       * Human-readable retry reason. Sourced from the parent's
       * `onSlotSelect` return value when the parent forced the
       * retry, otherwise from the local `validateAllSlots` result.
       * May be undefined when neither produced one (e.g. the parent
       * returned `{ kind: 'retry' }` without a reason field).
       */
      reason?: string;
      /**
       * Index of the slot that triggered the retry, parsed out of
       * the local validator's reason (`tokenIndex N:` prefix).
       * Undefined when the reason didn't embed an index — e.g. an
       * empty-selection case, or a parent-forced retry that doesn't
       * pinpoint a slot.
       */
      offendingTokenIndex?: number;
    };

export type PatternDrillPanelProps = {
  drill: PatternDrillVariants;
  /** Called when the learner advances past Level 4. */
  onExitDrill?: () => void;

  /**
   * 8.2 seam — called whenever a variant becomes the active card on
   * levels 2 or 3 (Req 2.3), and when the learner presses the manual
   * replay button. Optional: if omitted, the panel routes playback
   * through the shared `audioService` directly.
   */
  onPlayVariant?: (variant: PatternDrillVariant) => void;

  /**
   * 8.3 seam — called when a Level 4 slot choice is picked (Req 2.4).
   * The caller can override the local validation outcome — returning
   * `{ kind: 'retry' }` forces the panel to treat Level 4 as
   * incomplete regardless of what the local validator said. Returning
   * `{ kind: 'ok' }` accepts the local validator's verdict. The panel
   * still always runs `validateAllSlots` itself so tests and future
   * callers don't have to reimplement it.
   */
  onSlotSelect?: (tokenIndex: number, choice: string) => SlotValidationResult;

  /**
   * 8.4 / 8.5 render-prop for retry hints or level completion
   * feedback (Req 2.5, 2.7). Receives a `DrillFeedbackState` so the
   * caller can render a tailored hint without re-running the
   * validator. Returning `null` suppresses the feedback area.
   *
   * When this prop is omitted, the panel renders a **default retry
   * banner** on `'retry'` states so Req 2.5 is satisfied without
   * every caller having to wire one up. Task 8.5 also uses this
   * prop's presence as the signal to suppress the default
   * "pattern master" celebration — callers who want a custom badge
   * UI (e.g. confetti, a toast, a nav push) render it themselves
   * via this render-prop on `{ kind: 'ok' }` states.
   */
  renderFeedback?: (state: DrillFeedbackState) => ReactNode;

  /**
   * 8.5 seam (Req 2.7) — identifier for the pattern drill being
   * completed. Same value as `PatternDrill.originSentenceId`; it
   * identifies "the same pattern" for the purposes of the 3×
   * completion → "pattern master" badge.
   *
   * When provided, the panel:
   *   1. Calls the caller's `onExitDrill?.()` on Finish as before.
   *   2. Then calls `useProgressStore.getState().recordDrillCompletion(originSentenceId, today)`.
   *   3. If that returned `true` (badge newly granted), renders a
   *      compact celebration banner above the advance button.
   *
   * When omitted, no store call fires and no celebration renders —
   * keeping tests that don't care about badges clean.
   */
  originSentenceId?: string;
};

/** Locate the first level that has at least one variant, starting from `from`. */
function findNextLevelWithVariant(
  drill: PatternDrillVariants,
  from: PatternDrillLevel,
): PatternDrillLevel | null {
  for (const lvl of PATTERN_DRILL_LEVELS) {
    if (lvl < from) continue;
    if (drill.levels[lvl].length > 0) return lvl;
  }
  return null;
}

/**
 * Default audio handler used when the parent doesn't supply
 * `onPlayVariant`. Route the variant text through the shared
 * AudioService so cache-first + device-TTS-fallback behaviour applies.
 * Variants are synthesised, not rows in the sentences table, so we
 * deliberately do NOT pass a `sentenceId`: that would try to resolve
 * a signed URL for an ID that isn't in Storage.
 */
function playVariantViaAudioService(variant: PatternDrillVariant): void {
  void audioService.speak(variant.text, { rate: 1 });
}

function splitTokens(text: string): string[] {
  return text.trim().split(/\s+/);
}

/** ISO calendar date (YYYY-MM-DD) in the device's local timezone. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pull an integer tokenIndex out of a validator reason that looks
 * like `tokenIndex 3: ...`. `validateAllSlots` always prefixes its
 * reasons this way (see slotValidation.ts), so for local failures we
 * can surface *which* chip is at fault without re-running validation.
 *
 * Returns `undefined` when the reason is absent, malformed, or
 * produced by a caller that doesn't embed an index (e.g. the parent's
 * `onSlotSelect` returning `{ kind: 'retry', reason: 'server says no' }`).
 */
function extractOffendingTokenIndex(reason: string | undefined): number | undefined {
  if (!reason) return undefined;
  const match = /^tokenIndex\s+(\d+)\s*:/i.exec(reason);
  const raw = match?.[1];
  if (raw === undefined) return undefined;
  const idx = Number.parseInt(raw, 10);
  return Number.isInteger(idx) ? idx : undefined;
}

export default function PatternDrillPanel({
  drill,
  onExitDrill,
  onPlayVariant,
  onSlotSelect,
  renderFeedback,
  originSentenceId,
}: PatternDrillPanelProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Initial level: first non-empty bucket from 1 → 4. If the drill has
  // no variants at all (shouldn't happen post-validator), default to 1
  // so the panel still renders a reasonable header.
  const initialLevel = useMemo<PatternDrillLevel>(
    () => findNextLevelWithVariant(drill, 1) ?? 1,
    [drill],
  );
  const [currentLevel, setCurrentLevel] = useState<PatternDrillLevel>(initialLevel);

  const variants = drill.levels[currentLevel];
  const activeVariant: PatternDrillVariant | undefined = variants[0];
  const shouldPlayAudio = AUDIO_LEVELS.has(currentLevel) && activeVariant !== undefined;

  const isFinalLevel = currentLevel === 4;

  // --- Level 4 state ---------------------------------------------------
  // Map of tokenIndex → chosen word. Keyed by number but stored as a
  // plain object so React's shallow compare sees fresh references on
  // each update.
  const [selections, setSelections] = useState<Record<number, string>>({});
  // Which chip is currently "open" (showing its choices picker). `null`
  // when nothing is open. We allow a single picker at a time to keep
  // the layout predictable on small screens.
  const [openChipIndex, setOpenChipIndex] = useState<number | null>(null);
  // Last validation result — surfaced to 8.4's retry copy via the
  // `renderFeedback({ kind: 'retry' })` render-prop and the default
  // retry banner.
  const [lastValidation, setLastValidation] = useState<SlotValidation>({ ok: true });
  // Parent override state — when the last `onSlotSelect` returned
  // `{ kind: 'retry', reason }`, we keep the retry + its reason (the
  // parent may want to surface its own copy). `null` means the parent
  // did not force a retry on the latest selection.
  const [parentForcedRetry, setParentForcedRetry] =
    useState<{ reason?: string } | null>(null);

  // 8.5 badge state. `true` after a Finish press whose
  // `recordDrillCompletion` call returned true (threshold just
  // crossed). Scoped to this panel instance — we deliberately don't
  // pull from the store every render, because the store is for
  // cross-session persistence and the banner is transient in-session
  // feedback.
  const [justEarnedBadge, setJustEarnedBadge] = useState(false);

  // Reset Level 4 state whenever we arrive at / leave level 4 or the
  // active variant changes. Prevents stale selections from a previous
  // variant leaking into the new one. The badge flag is intentionally
  // *not* reset here: once earned in-session, the banner should keep
  // showing until the panel unmounts or the caller explicitly exits
  // the drill. Users hitting Finish after a crossing-completion should
  // see the celebration, not a blank panel.
  useEffect(() => {
    setSelections({});
    setOpenChipIndex(null);
    setLastValidation({ ok: true });
    setParentForcedRetry(null);
  }, [currentLevel, activeVariant]);

  // Resolve the effective play handler: parent-provided override, else
  // the AudioService-backed default. Memoised so identity is stable
  // across renders (keeps the auto-play effect from re-firing on every
  // render when the parent forgets to memoise their callback).
  const handlePlayVariant = useMemo(
    () => onPlayVariant ?? playVariantViaAudioService,
    [onPlayVariant],
  );

  const handleAdvance = useCallback(() => {
    if (isFinalLevel) {
      // Caller's `onExitDrill?.()` fires first so parents can navigate
      // away or trigger their own side effects before the store
      // update. Then record the completion (Req 2.7) and capture
      // whether this was the crossing event so we can render the
      // celebration banner in-panel when the caller hasn't opted in
      // to `renderFeedback`.
      onExitDrill?.();
      if (originSentenceId !== undefined) {
        const crossed = useProgressStore
          .getState()
          .recordDrillCompletion(originSentenceId, todayIso());
        if (crossed) setJustEarnedBadge(true);
      }
      return;
    }
    const next = (currentLevel + 1) as PatternDrillLevel;
    // Skip empty buckets between current and 4.
    const target = findNextLevelWithVariant(drill, next);
    if (target === null) {
      onExitDrill?.();
      return;
    }
    setCurrentLevel(target);
  }, [currentLevel, drill, isFinalLevel, onExitDrill, originSentenceId]);

  // Auto-play on level 2 / 3 only (Req 2.3). Level 1 was already
  // played by the Track A session; level 4 is slot-filling and has
  // no prebuilt variant audio to play.
  useEffect(() => {
    if (!shouldPlayAudio || !activeVariant) return;
    handlePlayVariant(activeVariant);
  }, [shouldPlayAudio, activeVariant, handlePlayVariant]);

  const handleReplay = useCallback(() => {
    if (!activeVariant) return;
    handlePlayVariant(activeVariant);
  }, [activeVariant, handlePlayVariant]);

  // --- Level 4 handlers -----------------------------------------------
  const handleChipPress = useCallback(
    (tokenIndex: number) => {
      setOpenChipIndex((curr) => (curr === tokenIndex ? null : tokenIndex));
    },
    [],
  );

  const handleChoicePick = useCallback(
    (tokenIndex: number, choice: string) => {
      if (!activeVariant) return;

      // Merge into selections and re-validate the whole set. Working
      // off the merged map (not the old state) keeps validation
      // consistent with the UI immediately — the alternative of
      // waiting for setState to flush would require an extra render
      // before the "Finish drill" button re-evaluated its disabled
      // state.
      const nextSelections = { ...selections, [tokenIndex]: choice };
      setSelections(nextSelections);
      setOpenChipIndex(null);

      const selectionList: SlotSelection[] = Object.entries(nextSelections).map(
        ([idxStr, ch]) => ({ tokenIndex: Number(idxStr), choice: ch }),
      );
      const local = validateAllSlots(activeVariant, selectionList);
      setLastValidation(local);

      // Parent override. The 8.4 integration uses this to inject a
      // retry even when the local validator passed (e.g. server-side
      // rule that hasn't been ported yet). Returning `ok` never
      // overrides the local validator's failure — that would be a
      // footgun for callers.
      const parentResult = onSlotSelect?.(tokenIndex, choice);
      setParentForcedRetry(
        parentResult?.kind === 'retry'
          ? { reason: parentResult.reason }
          : null,
      );
    },
    [activeVariant, onSlotSelect, selections],
  );

  // --- Derived: Level 4 completion state ------------------------------
  const slotHints = activeVariant?.slotHints ?? [];
  const everySlotFilled =
    slotHints.length > 0 &&
    slotHints.every((hint) => selections[hint.tokenIndex] !== undefined);
  const isLevel4Complete =
    isFinalLevel &&
    everySlotFilled &&
    lastValidation.ok &&
    parentForcedRetry === null;

  // On levels 1/2/3 the button is always enabled; on level 4 it's
  // gated. The button is **always rendered** — disabling happens via
  // `accessibilityState` + a local `disabled` flag so there's no
  // hidden UI (Req 2.5: penalty-free guidance, not punitive removal).
  const advanceDisabled = isFinalLevel && !isLevel4Complete;

  // Feedback state for 8.4 / 8.5 (Req 2.5). "retry" when either
  // validator says so AND the user has actually made a selection on
  // this variant; otherwise "ok". The reason preference order is:
  //
  //   1. parent's retry reason (if the parent forced the retry)
  //   2. local validator's reason (if the local check failed)
  //
  // Prefer the parent because they have the richer context — they
  // may be running a rule the local validator doesn't know about.
  const hasAnySelection = Object.keys(selections).length > 0;
  const localRetry = !lastValidation.ok;
  const isRetry =
    isFinalLevel &&
    hasAnySelection &&
    (localRetry || parentForcedRetry !== null);

  const feedbackState: DrillFeedbackState = isRetry
    ? {
        kind: 'retry',
        reason:
          parentForcedRetry?.reason ??
          (!lastValidation.ok ? lastValidation.reason : undefined),
        offendingTokenIndex:
          !lastValidation.ok
            ? extractOffendingTokenIndex(lastValidation.reason)
            : undefined,
      }
    : { kind: 'ok' };

  // If the caller supplies a renderFeedback prop, defer to them
  // entirely — they can render whatever they want (or nothing). If
  // not, we render a default retry banner on 'retry' states so Req
  // 2.5's guidance is always present.
  const feedbackNode = renderFeedback
    ? renderFeedback(feedbackState)
    : feedbackState.kind === 'retry'
      ? renderDefaultRetryBanner(feedbackState, styles, theme)
      : null;

  // 8.5 badge banner. Rendered only when:
  //   1. The learner just crossed the 3× threshold on this panel's
  //      Finish press, AND
  //   2. No `renderFeedback` prop is present (callers that own the
  //      feedback area also own the badge UI — they can look at
  //      `useProgressStore.hasPatternBadge(originSentenceId)` to
  //      decide what to render).
  // The second condition is in line with 8.4: the render-prop is
  // the caller's hook for fully-custom feedback, and silently
  // double-rendering a default celebration over their custom one
  // would be surprising.
  const badgeNode =
    justEarnedBadge && renderFeedback === undefined
      ? renderPatternMasterBadge(styles, theme)
      : null;

  return (
    <View style={styles.panel} accessibilityLabel="패턴 드릴 패널">
      <View style={styles.header}>
        <Text style={styles.step} accessibilityLabel={`레벨 ${currentLevel} / 4`}>
          레벨 {currentLevel} / 4
        </Text>
        <Text style={styles.title}>{LEVEL_TITLES[currentLevel]}</Text>
      </View>

      {activeVariant ? (
        isFinalLevel ? (
          <Level4SentenceBuilder
            variant={activeVariant}
            selections={selections}
            openChipIndex={openChipIndex}
            onChipPress={handleChipPress}
            onChoicePick={handleChoicePick}
            offendingTokenIndex={
              feedbackState.kind === 'retry'
                ? feedbackState.offendingTokenIndex
                : undefined
            }
            styles={styles}
            theme={theme}
          />
        ) : (
          <View style={styles.variantCard}>
            <Text style={styles.variantText}>{activeVariant.text}</Text>
          </View>
        )
      ) : (
        <View style={styles.variantCard}>
          <Text style={styles.emptyText}>이 레벨에 제공할 변형 문장이 없어요.</Text>
        </View>
      )}

      {shouldPlayAudio ? (
        <Pressable
          onPress={handleReplay}
          accessibilityRole="button"
          accessibilityLabel="변형 문장 다시 듣기"
          style={({ pressed }) => [
            styles.replay,
            {
              borderColor: theme.colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.replayLabel, { color: theme.colors.primary }]}>
            🔊 다시 듣기
          </Text>
        </Pressable>
      ) : null}

      {feedbackNode}

      {badgeNode}

      <Pressable
        onPress={advanceDisabled ? undefined : handleAdvance}
        disabled={advanceDisabled}
        accessibilityRole="button"
        accessibilityLabel={isFinalLevel ? '드릴 마치기' : '다음 레벨'}
        accessibilityState={{ disabled: advanceDisabled }}
        style={({ pressed }) => [
          styles.advance,
          {
            backgroundColor: advanceDisabled
              ? theme.colors.border
              : theme.colors.primary,
            opacity: advanceDisabled ? 1 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.advanceLabel,
            {
              color: advanceDisabled
                ? theme.colors.textMuted
                : theme.colors.primaryOn,
            },
          ]}
        >
          {isFinalLevel ? '드릴 마치기' : '다음 레벨'}
        </Text>
      </Pressable>
    </View>
  );
}

// --- Level 4 sub-renderer --------------------------------------------
type Level4Props = {
  variant: PatternDrillVariant;
  selections: Record<number, string>;
  openChipIndex: number | null;
  onChipPress: (tokenIndex: number) => void;
  onChoicePick: (tokenIndex: number, choice: string) => void;
  /**
   * Index of the slot the local validator blamed for the current
   * retry. When set, the matching chip picks up an accent outline
   * + `accessibilityState={{ invalid: true }}` so screen readers
   * announce it. Every other chip stays fully interactive with
   * its normal styling — Req 2.5 is about guiding re-selection,
   * not penalising the learner.
   */
  offendingTokenIndex?: number;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
};

function Level4SentenceBuilder({
  variant,
  selections,
  openChipIndex,
  onChipPress,
  onChoicePick,
  offendingTokenIndex,
  styles,
  theme,
}: Level4Props) {
  const tokens = useMemo(() => splitTokens(variant.text), [variant.text]);
  const hintByIndex = useMemo(() => {
    const map = new Map<number, NonNullable<PatternDrillVariant['slotHints']>[number]>();
    for (const hint of variant.slotHints ?? []) map.set(hint.tokenIndex, hint);
    return map;
  }, [variant.slotHints]);

  return (
    <View style={styles.variantCard}>
      <View style={styles.sentenceRow}>
        {tokens.map((token, idx) => {
          const hint = hintByIndex.get(idx);
          if (!hint) {
            return (
              <Text key={`t-${idx}`} style={styles.tokenText}>
                {token}
              </Text>
            );
          }

          const filled = selections[idx];
          const chipLabel = filled ?? '____';
          const isOffending = offendingTokenIndex === idx;
          const baseLabel = filled
            ? `슬롯 ${idx}, ${filled} 선택됨`
            : `슬롯 ${idx}, 비어 있음`;
          // Soft "needs review" suffix when this slot is the one the
          // validator blamed. Deliberate wording: "다시 골라보기",
          // NOT "wrong" / "incorrect" / "invalid" — Req 2.5 forbids
          // penalty language.
          const a11yLabel = isOffending
            ? `${baseLabel} — 다시 골라보기`
            : baseLabel;
          return (
            <Pressable
              key={`s-${idx}`}
              onPress={() => onChipPress(idx)}
              // `testID` is the supported hook for tests to identify
              // the offending chip without relying on RN types that
              // don't include `aria-invalid`. We keep the plain
              // `slot-{idx}` id on every chip and layer `-offending`
              // on top when it applies so tests can assert both
              // presence and absence.
              testID={isOffending ? `slot-${idx}-offending` : `slot-${idx}`}
              accessibilityRole="button"
              accessibilityLabel={a11yLabel}
              style={({ pressed }) => [
                styles.slotChip,
                {
                  borderColor: isOffending
                    ? theme.colors.danger
                    : filled
                      ? theme.colors.primary
                      : theme.colors.border,
                  borderStyle: filled || isOffending ? 'solid' : 'dashed',
                  borderWidth: isOffending ? 2 : 1.5,
                  backgroundColor: filled
                    ? theme.colors.surface
                    : 'transparent',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.slotChipLabel,
                  {
                    color: isOffending
                      ? theme.colors.danger
                      : filled
                        ? theme.colors.primary
                        : theme.colors.textMuted,
                  },
                ]}
              >
                {chipLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {openChipIndex !== null && hintByIndex.has(openChipIndex) ? (
        <View
          accessibilityLabel={`슬롯 ${openChipIndex} 선택지`}
          style={styles.choicesRow}
        >
          {hintByIndex.get(openChipIndex)!.choices.map((choice) => (
            <Pressable
              key={choice}
              onPress={() => onChoicePick(openChipIndex, choice)}
              accessibilityRole="button"
              accessibilityLabel={`슬롯 ${openChipIndex}에 ${choice} 선택`}
              style={({ pressed }) => [
                styles.choiceChip,
                {
                  borderColor: theme.colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.choiceChipLabel, { color: theme.colors.primary }]}>
                {choice}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Default retry banner rendered when the caller doesn't supply a
 * `renderFeedback` prop. Pure guidance copy — "다시 골라볼까요?" plus
 * the reason when we have one, or a soft fallback otherwise.
 *
 * `accessibilityLiveRegion="polite"` lets screen readers announce
 * the hint when it appears without interrupting whatever the user
 * is focused on. A "polite" live region is the right level for a
 * non-urgent retry suggestion — Req 2.5 is guidance, not alarm.
 *
 * Copy choices (intentional):
 *   - "다시 골라볼까요?" — invitation, not instruction.
 *   - "선택을 바꿔보세요." — neutral fallback.
 *   - No "틀렸어요", "오답", "X", red color, ⚠️ icon, or heart-drop
 *     animation. Anything that reads as punishment would violate
 *     Req 2.5 + product-context 학습 원칙 4.
 */
function renderDefaultRetryBanner(
  state: Extract<DrillFeedbackState, { kind: 'retry' }>,
  styles: ReturnType<typeof makeStyles>,
  theme: Theme,
): ReactNode {
  const subheading = state.reason ?? '선택을 바꿔보세요.';
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel="재선택 안내"
      style={[
        styles.retryBanner,
        {
          borderColor: theme.colors.danger,
          backgroundColor: theme.colors.surfaceElevated,
        },
      ]}
    >
      <Text style={[styles.retryBannerHeading, { color: theme.colors.text }]}>
        다시 골라볼까요?
      </Text>
      <Text style={[styles.retryBannerSub, { color: theme.colors.textSubtle }]}>
        {subheading}
      </Text>
    </View>
  );
}

/**
 * 8.5 pattern-master celebration banner (Req 2.7). Rendered inline
 * above the advance button when `recordDrillCompletion` crossed the
 * `DRILL_COMPLETION_THRESHOLD` on the latest Finish press.
 *
 * `accessibilityLiveRegion="polite"` so screen readers announce the
 * celebration without interrupting whatever the user is focused on.
 *
 * The body copy cites `DRILL_COMPLETION_THRESHOLD` directly so a
 * future tuning (e.g. 3 → 5) is reflected in the UI automatically.
 * The heading keeps a medal emoji + the Korean phrase "패턴 마스터"
 * per the task spec — no confetti animation, no toast, no navigation
 * side effect. Session wiring decides what richer celebration (if
 * any) to layer on top via `renderFeedback`.
 */
function renderPatternMasterBadge(
  styles: ReturnType<typeof makeStyles>,
  theme: Theme,
): ReactNode {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel="패턴 마스터 배지 획득"
      style={[
        styles.badgeBanner,
        {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surfaceElevated,
        },
      ]}
    >
      <Text style={[styles.badgeBannerHeading, { color: theme.colors.text }]}>
        🏅 패턴 마스터!
      </Text>
      <Text style={[styles.badgeBannerSub, { color: theme.colors.textSubtle }]}>
        이 패턴을 {DRILL_COMPLETION_THRESHOLD}번 이상 완료했어요.
      </Text>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    panel: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    header: {
      gap: theme.spacing.xs,
    },
    step: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    title: {
      ...theme.typography.headingLg,
      color: theme.colors.text,
    },
    variantCard: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.sm,
    },
    variantText: {
      ...theme.typography.sentence,
      color: theme.colors.text,
    },
    sentenceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    tokenText: {
      ...theme.typography.sentence,
      color: theme.colors.text,
    },
    slotChip: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      borderWidth: 1.5,
      minWidth: 64,
      alignItems: 'center',
    },
    slotChipLabel: {
      ...theme.typography.sentence,
    },
    choicesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    choiceChip: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
    },
    choiceChipLabel: {
      ...theme.typography.button,
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
    },
    replay: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    replayLabel: {
      ...theme.typography.button,
    },
    advance: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    advanceLabel: {
      ...theme.typography.button,
    },
    retryBanner: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderLeftWidth: 3,
      gap: theme.spacing.xs,
    },
    retryBannerHeading: {
      ...theme.typography.button,
    },
    retryBannerSub: {
      ...theme.typography.caption,
    },
    badgeBanner: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderLeftWidth: 3,
      gap: theme.spacing.xs,
    },
    badgeBannerHeading: {
      ...theme.typography.button,
    },
    badgeBannerSub: {
      ...theme.typography.caption,
    },
  });
}
