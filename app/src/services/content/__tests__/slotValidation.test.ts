/**
 * slotValidation tests (Task 8.3 — Req 2.4).
 *
 * Validates the four local grammar rules the Level 4 slot validator
 * enforces:
 *   1. tokenIndex in range.
 *   2. choice present in slot hints.
 *   3. Article agreement (a/an ↔ following word's first sound).
 *   4. Opt-in subject–verb agreement (`SlotHint.agreement`).
 *
 * All rules are local / pure — no network, no LLM, no side effects.
 */
import {
  validateSlotSelection,
  validateAllSlots,
  type SlotSelection,
} from '../slotValidation';
import type { PatternDrillVariant } from '../patternDrill';

function variantWith(
  text: string,
  slotHints: NonNullable<PatternDrillVariant['slotHints']>,
): PatternDrillVariant {
  return { level: 4, text, slotHints };
}

describe('validateSlotSelection — rule 1: tokenIndex range', () => {
  it('accepts a selection inside the token range', () => {
    const variant = variantWith('I want to eat pizza.', [
      { tokenIndex: 4, choices: ['pizza', 'pasta'] },
    ]);
    expect(
      validateSlotSelection(variant, { tokenIndex: 4, choice: 'pizza' }),
    ).toEqual({ ok: true });
  });

  it('rejects a negative tokenIndex with a clear reason', () => {
    const variant = variantWith('I eat pizza.', [
      { tokenIndex: 2, choices: ['pizza'] },
    ]);
    const result = validateSlotSelection(variant, {
      tokenIndex: -1,
      choice: 'pizza',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/out of range/i);
      expect(result.reason).toMatch(/-1/);
    }
  });

  it('rejects a tokenIndex past the end of the sentence', () => {
    const variant = variantWith('I eat pizza.', [
      { tokenIndex: 2, choices: ['pizza'] },
    ]);
    // Sentence has 3 whitespace-split tokens → indices 0..2.
    const result = validateSlotSelection(variant, {
      tokenIndex: 10,
      choice: 'pizza',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/out of range/i);
  });
});

describe('validateSlotSelection — rule 2: choice must be in hints', () => {
  it('rejects a choice that is not in the slot hint list', () => {
    const variant = variantWith('I want to eat pizza.', [
      { tokenIndex: 4, choices: ['pizza', 'pasta'] },
    ]);
    const result = validateSlotSelection(variant, {
      tokenIndex: 4,
      choice: 'tacos',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not in the allowed choices/i);
  });

  it('rejects a selection at a token position with no hint', () => {
    const variant = variantWith('I want to eat pizza.', [
      { tokenIndex: 4, choices: ['pizza', 'pasta'] },
    ]);
    const result = validateSlotSelection(variant, {
      tokenIndex: 0, // "I" — not a slot.
      choice: 'We',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/no slot hint/i);
  });
});

describe('validateSlotSelection — rule 3: article agreement', () => {
  // Template: "I saw a apple." — slot at index 3 chooses the noun.
  // We rely on the PRECEDING token being "a" or "an" (post-
  // normalisation) to trigger the rule.
  const aApple = variantWith('I saw a apple.', [
    { tokenIndex: 3, choices: ['apple', 'banana'] },
  ]);
  const anApple = variantWith('I saw an apple.', [
    { tokenIndex: 3, choices: ['apple', 'banana'] },
  ]);

  it("rejects 'a' + vowel-start word (a apple)", () => {
    const result = validateSlotSelection(aApple, {
      tokenIndex: 3,
      choice: 'apple',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/'an'/);
  });

  it("accepts 'an' + vowel-start word (an apple)", () => {
    expect(
      validateSlotSelection(anApple, { tokenIndex: 3, choice: 'apple' }),
    ).toEqual({ ok: true });
  });

  it("rejects 'an' + consonant-start word (an book)", () => {
    const anBook = variantWith('I saw an book.', [
      { tokenIndex: 3, choices: ['apple', 'book'] },
    ]);
    const result = validateSlotSelection(anBook, {
      tokenIndex: 3,
      choice: 'book',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/'a'/);
  });

  it("accepts 'a' + consonant-start word (a book)", () => {
    const aBook = variantWith('I saw a book.', [
      { tokenIndex: 3, choices: ['apple', 'book'] },
    ]);
    expect(
      validateSlotSelection(aBook, { tokenIndex: 3, choice: 'book' }),
    ).toEqual({ ok: true });
  });

  it("doesn't trigger article rule when preceding token isn't a/an", () => {
    // "I saw the apple." — preceded by "the", article rule dormant.
    const variant = variantWith('I saw the apple.', [
      { tokenIndex: 3, choices: ['apple', 'book'] },
    ]);
    expect(
      validateSlotSelection(variant, { tokenIndex: 3, choice: 'apple' }),
    ).toEqual({ ok: true });
  });

  it("doesn't reference a preceding token when slot is at index 0", () => {
    // Index 0 has no predecessor — article rule must not misfire.
    const variant = variantWith('Apple is red.', [
      { tokenIndex: 0, choices: ['Apple', 'Orange'] },
    ]);
    expect(
      validateSlotSelection(variant, { tokenIndex: 0, choice: 'Apple' }),
    ).toEqual({ ok: true });
  });
});

describe('validateSlotSelection — rule 4: subject–verb agreement', () => {
  // Template: "He ___ to school." — index 1 is the verb slot.
  // The seed flags the slot with agreement pointing at subject "He" (index 0).
  const thirdSingular = variantWith('He run to school.', [
    {
      tokenIndex: 1,
      choices: ['run', 'runs'],
      agreement: { with: 0, kind: 'third-singular' },
    },
  ]);

  it("rejects a bare verb when agreement is 'third-singular' (He + run)", () => {
    const result = validateSlotSelection(thirdSingular, {
      tokenIndex: 1,
      choice: 'run',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/3rd-person singular/i);
  });

  it("accepts a 3rd-singular verb when agreement is 'third-singular' (He + runs)", () => {
    expect(
      validateSlotSelection(thirdSingular, { tokenIndex: 1, choice: 'runs' }),
    ).toEqual({ ok: true });
  });

  it("accepts irregular 3rd-singular forms (has, is, does, goes)", () => {
    const variant = variantWith('He is happy.', [
      {
        tokenIndex: 1,
        choices: ['is', 'are'],
        agreement: { with: 0, kind: 'third-singular' },
      },
    ]);
    expect(
      validateSlotSelection(variant, { tokenIndex: 1, choice: 'is' }),
    ).toEqual({ ok: true });
  });

  it("rejects a 3rd-singular verb when agreement is 'plural' (They + runs)", () => {
    const variant = variantWith('They runs to school.', [
      {
        tokenIndex: 1,
        choices: ['run', 'runs'],
        agreement: { with: 0, kind: 'plural' },
      },
    ]);
    const result = validateSlotSelection(variant, {
      tokenIndex: 1,
      choice: 'runs',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/plural/i);
  });

  it("accepts a bare verb when agreement is 'plural' (They + run)", () => {
    const variant = variantWith('They run to school.', [
      {
        tokenIndex: 1,
        choices: ['run', 'runs'],
        agreement: { with: 0, kind: 'plural' },
      },
    ]);
    expect(
      validateSlotSelection(variant, { tokenIndex: 1, choice: 'run' }),
    ).toEqual({ ok: true });
  });

  it("passes when no agreement field is attached (opt-in only)", () => {
    const variant = variantWith('He run to school.', [
      // Same mismatched verb — but no agreement flag → pass.
      { tokenIndex: 1, choices: ['run', 'runs'] },
    ]);
    expect(
      validateSlotSelection(variant, { tokenIndex: 1, choice: 'run' }),
    ).toEqual({ ok: true });
  });
});

describe('validateAllSlots', () => {
  it('returns ok when every selection passes', () => {
    const variant = variantWith('I want to eat pizza.', [
      { tokenIndex: 4, choices: ['pizza', 'pasta'] },
    ]);
    const selections: SlotSelection[] = [{ tokenIndex: 4, choice: 'pizza' }];
    expect(validateAllSlots(variant, selections)).toEqual({ ok: true });
  });

  it('returns the first failure and embeds tokenIndex in the reason', () => {
    const variant = variantWith('I saw a apple yesterday.', [
      { tokenIndex: 2, choices: ['a', 'an'] },
      { tokenIndex: 3, choices: ['apple', 'book'] },
    ]);
    // Second selection fails the article rule (a apple). The first
    // selection is valid (choosing "a" from choices ['a','an']).
    const selections: SlotSelection[] = [
      { tokenIndex: 2, choice: 'a' },
      { tokenIndex: 3, choice: 'apple' },
    ];
    const result = validateAllSlots(variant, selections);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Reason must surface the failing tokenIndex so the UI can
      // highlight the offending chip without re-running the validator.
      expect(result.reason).toMatch(/tokenIndex 3/);
    }
  });

  it('returns ok for an empty selection list', () => {
    // No selections made yet → nothing to fail on. Callers combine
    // this with "are all slots filled?" to gate Level 4 completion.
    const variant = variantWith('I eat pizza.', [
      { tokenIndex: 2, choices: ['pizza'] },
    ]);
    expect(validateAllSlots(variant, [])).toEqual({ ok: true });
  });
});
