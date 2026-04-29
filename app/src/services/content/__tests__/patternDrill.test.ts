/**
 * patternDrill validator tests (Task 8.1 support, Req 2.1/2.2).
 *
 * The validator is the last line of defense before `pattern_drills.variants`
 * (jsonb on the server) reaches the UI. We assert both happy-path narrowing
 * and defensive `null` returns for malformed shapes, so that the panel can
 * treat "no drill" uniformly without runtime crashes.
 */
import {
  PATTERN_DRILL_LEVELS,
  parsePatternDrillVariants,
  type PatternDrillVariants,
} from '../patternDrill';

function makeWellFormed(): PatternDrillVariants {
  return {
    originText: 'I want to eat pizza.',
    levels: {
      1: [{ level: 1, text: 'I want to eat pizza.' }],
      2: [
        { level: 2, text: 'I want to eat pasta.' },
        { level: 2, text: 'I want to eat sushi.' },
      ],
      3: [{ level: 3, text: 'She wanted to eat pizza.' }],
      4: [
        {
          level: 4,
          text: 'I want to eat pizza.',
          slotHints: [
            { tokenIndex: 4, choices: ['pizza', 'pasta', 'sushi'] },
          ],
        },
      ],
    },
  };
}

describe('parsePatternDrillVariants', () => {
  it('accepts a well-formed PatternDrillVariants', () => {
    const input = makeWellFormed();
    const parsed = parsePatternDrillVariants(input);
    expect(parsed).not.toBeNull();
    expect(parsed?.originText).toBe(input.originText);
    expect(parsed?.levels[2]).toHaveLength(2);
    expect(parsed?.levels[4][0]?.slotHints?.[0]?.choices).toEqual([
      'pizza',
      'pasta',
      'sushi',
    ]);
  });

  it('returns null when levels is missing entirely', () => {
    expect(
      parsePatternDrillVariants({ originText: 'x' }),
    ).toBeNull();
  });

  it('returns null when a level bucket is missing', () => {
    const input = makeWellFormed() as unknown as Record<string, unknown>;
    delete (input.levels as Record<string, unknown>)[3];
    expect(parsePatternDrillVariants(input)).toBeNull();
  });

  it.each([0, 5, 'two', null])(
    'returns null for wrong level value %p',
    (badLevel) => {
      const input = makeWellFormed();
      // Put a variant with an invalid `level` field in the level-1 bucket.
      const withBadLevel = {
        ...input,
        levels: {
          ...input.levels,
          1: [{ level: badLevel, text: 'bad' }],
        },
      };
      expect(parsePatternDrillVariants(withBadLevel)).toBeNull();
    },
  );

  it('returns null when text is not a string', () => {
    const input = makeWellFormed();
    const bad = {
      ...input,
      levels: {
        ...input.levels,
        2: [{ level: 2, text: 42 }],
      },
    };
    expect(parsePatternDrillVariants(bad)).toBeNull();
  });

  it('returns null when slotHints is not an array', () => {
    const input = makeWellFormed();
    const bad = {
      ...input,
      levels: {
        ...input.levels,
        4: [{ level: 4, text: 'ok', slotHints: 'nope' }],
      },
    };
    expect(parsePatternDrillVariants(bad)).toBeNull();
  });

  it('allows missing slotHints on levels 1–3 (optional field)', () => {
    const input: PatternDrillVariants = {
      originText: 'hello',
      levels: {
        1: [{ level: 1, text: 'hello' }],
        2: [{ level: 2, text: 'hey' }],
        3: [{ level: 3, text: 'hi there' }],
        4: [],
      },
    };
    const parsed = parsePatternDrillVariants(input);
    expect(parsed).not.toBeNull();
    expect(parsed?.levels[1][0]?.slotHints).toBeUndefined();
  });

  it('accepts a level-4 variant without slotHints (8.3 will enforce it)', () => {
    const input: PatternDrillVariants = {
      originText: 'hello',
      levels: {
        1: [],
        2: [],
        3: [],
        4: [{ level: 4, text: 'hello' }],
      },
    };
    const parsed = parsePatternDrillVariants(input);
    expect(parsed).not.toBeNull();
    expect(parsed?.levels[4][0]?.slotHints).toBeUndefined();
  });

  it('returns null when slotHints contains a negative tokenIndex', () => {
    const input = makeWellFormed();
    const bad = {
      ...input,
      levels: {
        ...input.levels,
        4: [
          {
            level: 4,
            text: 'ok',
            slotHints: [{ tokenIndex: -1, choices: ['a'] }],
          },
        ],
      },
    };
    expect(parsePatternDrillVariants(bad)).toBeNull();
  });

  it('returns null when slotHints.choices is not all strings', () => {
    const input = makeWellFormed();
    const bad = {
      ...input,
      levels: {
        ...input.levels,
        4: [
          {
            level: 4,
            text: 'ok',
            slotHints: [{ tokenIndex: 0, choices: ['a', 2] }],
          },
        ],
      },
    };
    expect(parsePatternDrillVariants(bad)).toBeNull();
  });

  // Task 8.3 extension — `agreement` field is optional but, when
  // present, must match the { with: int>=0, kind: 'third-singular' |
  // 'plural' } shape. Malformed entries fail the whole drill so the
  // UI never sees half-validated data.
  it('accepts slotHints.agreement with valid shape', () => {
    const input = makeWellFormed();
    const good = {
      ...input,
      levels: {
        ...input.levels,
        4: [
          {
            level: 4,
            text: 'He runs to school.',
            slotHints: [
              {
                tokenIndex: 1,
                choices: ['run', 'runs'],
                agreement: { with: 0, kind: 'third-singular' },
              },
            ],
          },
        ],
      },
    };
    const parsed = parsePatternDrillVariants(good);
    expect(parsed).not.toBeNull();
    expect(parsed?.levels[4][0]?.slotHints?.[0]?.agreement).toEqual({
      with: 0,
      kind: 'third-singular',
    });
  });

  it('returns null when agreement.with is negative', () => {
    const input = makeWellFormed();
    const bad = {
      ...input,
      levels: {
        ...input.levels,
        4: [
          {
            level: 4,
            text: 'He runs.',
            slotHints: [
              {
                tokenIndex: 1,
                choices: ['runs'],
                agreement: { with: -1, kind: 'third-singular' },
              },
            ],
          },
        ],
      },
    };
    expect(parsePatternDrillVariants(bad)).toBeNull();
  });

  it('returns null when agreement.kind is not one of the allowed values', () => {
    const input = makeWellFormed();
    const bad = {
      ...input,
      levels: {
        ...input.levels,
        4: [
          {
            level: 4,
            text: 'He runs.',
            slotHints: [
              {
                tokenIndex: 1,
                choices: ['runs'],
                agreement: { with: 0, kind: 'past-tense' },
              },
            ],
          },
        ],
      },
    };
    expect(parsePatternDrillVariants(bad)).toBeNull();
  });

  it('returns null for non-object input (string, number, null)', () => {
    expect(parsePatternDrillVariants('drill')).toBeNull();
    expect(parsePatternDrillVariants(42)).toBeNull();
    expect(parsePatternDrillVariants(null)).toBeNull();
    expect(parsePatternDrillVariants([])).toBeNull();
  });
});

describe('PATTERN_DRILL_LEVELS', () => {
  it('enumerates levels in 1 → 4 order', () => {
    expect(PATTERN_DRILL_LEVELS).toEqual([1, 2, 3, 4]);
  });
});
