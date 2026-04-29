/**
 * Slot validation — Level 4 fill-in grammar check (Req 2.4).
 *
 * Pure data in / pure data out. No React, no side effects. Level 4
 * renders a variant text with blanks at specific token positions;
 * after the learner picks a choice we validate whether the resulting
 * sentence is **grammatically plausible** using **local rules only**
 * (Req 2.4: "완성된 문장의 문법 성립 여부를 로컬 룰 기반으로 검증한다").
 *
 * We deliberately do NOT parse free-form English. A full parser is
 * out of scope for MVP and would violate the "local rules" constraint.
 * Instead we enforce a small, explicit rule set that catches the
 * failure modes that actually matter when swapping curated choices
 * into a curated template:
 *
 *   1. `tokenIndex` in range of whitespace-split tokens of `variant.text`.
 *   2. `choice` present in the matching `SlotHint.choices` array —
 *      seed rows are curated to contain only grammatically viable
 *      choices, so this is the primary guarantee.
 *   3. Article agreement: `a` before a vowel-sound word, or `an`
 *      before a consonant, is rejected. The only syntactic rule we
 *      enforce because a/an is the easiest subtle bug when swapping
 *      content words.
 *   4. Opt-in subject–verb agreement via `SlotHint.agreement`. The
 *      seed author flags a slot as "this fill must match subject N's
 *      number/person". Applied only when explicitly present; we
 *      never auto-infer.
 *
 * If none of rules 1–4 fire, we return `{ ok: true }`. This is
 * intentional: returning `false` for anything we can't prove wrong
 * would punish the learner for a seed curator's oversight, and
 * Req 2.5 says we don't penalise retries anyway.
 *
 * Non-Goal: this module must NOT reach out to any LLM or grammar
 * service. tech-stack.md lists no grammar API, and Req 2.4 pins us
 * to "로컬 룰".
 */

import type { PatternDrillVariant, SlotHint } from './patternDrill';

export type SlotSelection = {
  tokenIndex: number;
  choice: string;
};

export type SlotValidation =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Split the variant text into whitespace tokens. Mirrors what the
 * Level 4 UI does when it lays out the sentence as interactive chips.
 *
 * Note: this is a **lexical** split, not a linguistic tokenisation.
 * Punctuation stays attached to its neighbour (e.g. "pizza." is one
 * token). Seed authors should place slot indices on "content"
 * positions and keep punctuation on fixed template tokens.
 */
function splitTokens(text: string): string[] {
  return text.trim().split(/\s+/);
}

/**
 * Strip punctuation and case from a token for comparison. Used to
 * match preceding-article-token ("a" / "an") when the seed template
 * might carry attached punctuation in edge cases.
 */
function normalizeToken(token: string): string {
  return token.replace(/[^A-Za-z']+/g, '').toLowerCase();
}

/**
 * Crude "starts with a vowel sound" heuristic. Good enough for the
 * curated choice pool; a linguistically perfect rule (honest → /ɒnɪst/
 * starts with a vowel sound, university → /juː/ starts with a
 * consonant sound) is out of scope. We follow the spec's guidance:
 * "a/e/i/o/u, plus 'h' — keep it simple". That means:
 *
 *   - starts with a/e/i/o/u → vowel sound → needs "an"
 *   - starts with 'h'       → treated as vowel-sound (many real
 *                             cases: "an hour", "an honest mistake");
 *                             seed authors avoid the edge cases
 *                             (historic, hotel) by picking choices
 *                             carefully
 *   - otherwise             → consonant sound → needs "a"
 */
function startsWithVowelSound(word: string): boolean {
  const first = word.trim().charAt(0).toLowerCase();
  return 'aeiouh'.includes(first);
}

/**
 * Subject–verb agreement on a per-choice basis. Only invoked when
 * the seed author has flagged a slot with `agreement`.
 *
 * `third-singular`: chosen verb must end in -s/-es or be an
 *   irregular 3rd-singular form (is, has, does, goes). We check
 *   a small set of common irregulars + the -s suffix.
 *
 * `plural`: chosen verb must be the **bare** form (no -s suffix,
 *   not one of the 3rd-singular irregulars). "are", "have", "do",
 *   "go" are valid plural-compatible forms.
 */
const THIRD_SINGULAR_IRREGULARS = new Set([
  'is',
  'was',
  'has',
  'does',
  'goes',
]);

const PLURAL_INCOMPATIBLE_IRREGULARS = new Set([
  'is',
  'was',
  'has',
  'does',
  'goes',
]);

function endsWithS(word: string): boolean {
  return /s$/i.test(word);
}

function isThirdSingularForm(word: string): boolean {
  const w = word.toLowerCase();
  if (THIRD_SINGULAR_IRREGULARS.has(w)) return true;
  // Reject "was" / "is" already handled above; plain -s suffix is
  // the common case (runs, eats, watches).
  return endsWithS(w);
}

function isPluralCompatibleForm(word: string): boolean {
  const w = word.toLowerCase();
  if (PLURAL_INCOMPATIBLE_IRREGULARS.has(w)) return false;
  // Any bare verb (run, eat, watch) or plural-compatible irregular
  // (are, have, do, go) is acceptable.
  if (endsWithS(w)) return false;
  return true;
}

function checkAgreement(
  tokens: string[],
  agreement: NonNullable<SlotHint['agreement']>,
  choice: string,
): SlotValidation {
  const referenced = tokens[agreement.with];
  if (referenced === undefined) {
    // Seed misconfiguration: agreement.with points at a non-token.
    // Treat as pass rather than blocking the learner on a curator bug.
    return { ok: true };
  }

  if (agreement.kind === 'third-singular') {
    if (!isThirdSingularForm(choice)) {
      return {
        ok: false,
        reason: `'${choice}' doesn't agree with '${referenced}' — try a 3rd-person singular form.`,
      };
    }
    return { ok: true };
  }

  if (agreement.kind === 'plural') {
    if (!isPluralCompatibleForm(choice)) {
      return {
        ok: false,
        reason: `'${choice}' doesn't agree with '${referenced}' — try a plural / base form.`,
      };
    }
    return { ok: true };
  }

  return { ok: true };
}

function checkArticleAgreement(
  tokens: string[],
  tokenIndex: number,
  choice: string,
): SlotValidation {
  if (tokenIndex === 0) return { ok: true };
  const prev = normalizeToken(tokens[tokenIndex - 1] ?? '');
  if (prev !== 'a' && prev !== 'an') return { ok: true };

  const vowel = startsWithVowelSound(choice);
  if (prev === 'a' && vowel) {
    return {
      ok: false,
      reason: `Use 'an' before a vowel-sound word ('${choice}').`,
    };
  }
  if (prev === 'an' && !vowel) {
    return {
      ok: false,
      reason: `Use 'a' before a consonant-sound word ('${choice}').`,
    };
  }
  return { ok: true };
}

/**
 * Validate a single slot selection against the variant's hints.
 * See module doc comment for the rule set and rationale.
 *
 * Note: when used standalone, article agreement (Rule 3) checks the
 * PRECEDING token as it appears in `variant.text` — i.e. the template.
 * To check the **completed** sentence (all selections substituted),
 * use `validateAllSlots`, which feeds in the merged token list. This
 * distinction matters when two slots are adjacent and one affects
 * the other (e.g. user picks both the article and the following noun).
 */
export function validateSlotSelection(
  variant: PatternDrillVariant,
  selection: SlotSelection,
): SlotValidation {
  return validateSlotSelectionWithTokens(
    variant,
    selection,
    splitTokens(variant.text),
  );
}

/**
 * Internal — same rules as `validateSlotSelection` but against a
 * caller-provided token array. Used by `validateAllSlots` to check
 * rules against the post-substitution sentence.
 */
function validateSlotSelectionWithTokens(
  variant: PatternDrillVariant,
  selection: SlotSelection,
  tokens: string[],
): SlotValidation {
  // Rule 1 — tokenIndex in range.
  if (
    !Number.isInteger(selection.tokenIndex) ||
    selection.tokenIndex < 0 ||
    selection.tokenIndex >= tokens.length
  ) {
    return {
      ok: false,
      reason: `tokenIndex ${selection.tokenIndex} is out of range (0..${tokens.length - 1}).`,
    };
  }

  // Rule 2 — choice must be one of the declared choices for this slot.
  const hint = (variant.slotHints ?? []).find(
    (h) => h.tokenIndex === selection.tokenIndex,
  );
  if (!hint) {
    return {
      ok: false,
      reason: `No slot hint at tokenIndex ${selection.tokenIndex}.`,
    };
  }
  if (!hint.choices.includes(selection.choice)) {
    return {
      ok: false,
      reason: `'${selection.choice}' is not in the allowed choices for tokenIndex ${selection.tokenIndex}.`,
    };
  }

  // Rule 3 — article agreement against the provided tokens.
  const article = checkArticleAgreement(tokens, selection.tokenIndex, selection.choice);
  if (!article.ok) return article;

  // Rule 4 — opt-in subject–verb agreement.
  if (hint.agreement) {
    const agreement = checkAgreement(tokens, hint.agreement, selection.choice);
    if (!agreement.ok) return agreement;
  }

  return { ok: true };
}

/**
 * Run every selection through the rules, against the **completed**
 * sentence (template with each selection substituted at its index).
 * Returns the first failure (with `tokenIndex` embedded in the
 * reason so the UI can highlight the offending chip) or `{ ok: true }`
 * when all selections pass.
 *
 * Substitution matters for Rule 3 when the user picks both the
 * article and the following noun — checking against the template
 * would miss the a/an ↔ noun mismatch introduced by the user's own
 * choices.
 */
export function validateAllSlots(
  variant: PatternDrillVariant,
  selections: SlotSelection[],
): SlotValidation {
  // Build the post-substitution token list once. Out-of-range
  // indices are skipped here and caught by Rule 1 below.
  const tokens = splitTokens(variant.text);
  for (const sel of selections) {
    if (
      Number.isInteger(sel.tokenIndex) &&
      sel.tokenIndex >= 0 &&
      sel.tokenIndex < tokens.length
    ) {
      tokens[sel.tokenIndex] = sel.choice;
    }
  }

  for (const selection of selections) {
    const result = validateSlotSelectionWithTokens(variant, selection, tokens);
    if (!result.ok) {
      return {
        ok: false,
        reason: `tokenIndex ${selection.tokenIndex}: ${result.reason}`,
      };
    }
  }
  return { ok: true };
}
