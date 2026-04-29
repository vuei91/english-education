/**
 * Pattern Drill types + runtime validator (Req 2.1, 2.2).
 *
 * The `pattern_drills.variants` column is `jsonb` on the server and
 * arrives in the client as `unknown`. Downstream UI (`PatternDrillPanel`)
 * must be able to trust the shape, so we narrow once here with a
 * pure-data validator. Validation failures return `null` — the drill is
 * then treated as "not available" and the caller falls back gracefully.
 *
 * We deliberately keep slot grammar checks OUT of this module: that
 * belongs to Task 8.3's Level 4 validator. Here we only verify shape.
 */

export type PatternDrillLevel = 1 | 2 | 3 | 4;

/**
 * Opt-in subject–verb agreement constraint for a slot. Added in
 * Task 8.3 so the Level 4 validator (slotValidation.ts) can enforce
 * inflection rules on a per-slot basis when the seed author flags
 * them explicitly. We never auto-infer this from the template —
 * curators attach it only where it's needed (e.g. a slot where
 * both "run" and "runs" appear in `choices` and the subject is "He").
 */
export type SlotAgreement = {
  /** 0-based token index of the subject this slot must agree with. */
  with: number;
  kind: 'third-singular' | 'plural';
};

export type SlotHint = {
  /** 0-based index into the whitespace-split tokens of `text`. */
  tokenIndex: number;
  /** Candidate words the user can pick from. Grammar check is Task 8.3. */
  choices: string[];
  /**
   * Optional. When present, the Level 4 grammar validator enforces
   * subject–verb agreement on the chosen word. Absent means no
   * agreement check is applied to this slot.
   */
  agreement?: SlotAgreement;
};

export type PatternDrillVariant = {
  level: PatternDrillLevel;
  /** Full English sentence that keeps the pattern of the origin. */
  text: string;
  /** Level 4 only — positions eligible for fill-in. */
  slotHints?: SlotHint[];
};

export type PatternDrillVariants = {
  /** The sentence this drill derives from; surfaced on Level 1. */
  originText: string;
  levels: {
    1: PatternDrillVariant[];
    2: PatternDrillVariant[];
    3: PatternDrillVariant[];
    4: PatternDrillVariant[];
  };
};

/**
 * Canonical iteration order. Exported so the panel and tests share it
 * and nobody re-derives "1..4" with a `for` loop that could drift.
 */
export const PATTERN_DRILL_LEVELS: readonly PatternDrillLevel[] = [1, 2, 3, 4] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPatternDrillLevel(value: unknown): value is PatternDrillLevel {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function parseSlotAgreement(value: unknown): SlotAgreement | null {
  if (!isPlainObject(value)) return null;
  const { with: withIdx, kind } = value;
  if (typeof withIdx !== 'number' || !Number.isInteger(withIdx) || withIdx < 0) {
    return null;
  }
  if (kind !== 'third-singular' && kind !== 'plural') return null;
  return { with: withIdx, kind };
}

function parseSlotHints(value: unknown): SlotHint[] | null {
  if (!Array.isArray(value)) return null;
  const hints: SlotHint[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) return null;
    const { tokenIndex, choices, agreement } = entry;
    if (typeof tokenIndex !== 'number' || !Number.isInteger(tokenIndex) || tokenIndex < 0) {
      return null;
    }
    if (!Array.isArray(choices) || !choices.every((c) => typeof c === 'string')) {
      return null;
    }
    const hint: SlotHint = { tokenIndex, choices: [...choices] };
    if (agreement !== undefined) {
      const parsed = parseSlotAgreement(agreement);
      if (parsed === null) return null;
      hint.agreement = parsed;
    }
    hints.push(hint);
  }
  return hints;
}

function parseVariant(value: unknown): PatternDrillVariant | null {
  if (!isPlainObject(value)) return null;
  if (!isPatternDrillLevel(value.level)) return null;
  if (typeof value.text !== 'string') return null;

  const variant: PatternDrillVariant = {
    level: value.level,
    text: value.text,
  };

  if (value.slotHints !== undefined) {
    const hints = parseSlotHints(value.slotHints);
    if (hints === null) return null;
    variant.slotHints = hints;
  }

  return variant;
}

function parseLevelBucket(value: unknown): PatternDrillVariant[] | null {
  if (!Array.isArray(value)) return null;
  const out: PatternDrillVariant[] = [];
  for (const raw of value) {
    const parsed = parseVariant(raw);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

/**
 * Validate and narrow unknown JSON into `PatternDrillVariants`.
 * Returns `null` for any malformed input — never throws.
 *
 * The server schema is permissive (jsonb), so this is the first line
 * of defense against stale seed rows or future schema drift.
 */
export function parsePatternDrillVariants(raw: unknown): PatternDrillVariants | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.originText !== 'string') return null;
  if (!isPlainObject(raw.levels)) return null;

  const { levels } = raw;
  const level1 = parseLevelBucket(levels[1] ?? levels['1']);
  const level2 = parseLevelBucket(levels[2] ?? levels['2']);
  const level3 = parseLevelBucket(levels[3] ?? levels['3']);
  const level4 = parseLevelBucket(levels[4] ?? levels['4']);

  if (!level1 || !level2 || !level3 || !level4) return null;

  return {
    originText: raw.originText,
    levels: {
      1: level1,
      2: level2,
      3: level3,
      4: level4,
    },
  };
}
