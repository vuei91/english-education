/**
 * VocabService tests.
 *
 * We mock ContentService and the SQLite handle. The service is thin, so
 * we just verify it delegates correctly and does not blow up when the db
 * is absent (web target).
 */
import { VocabService, type TapRecord } from '../VocabService';

function makeContent() {
  return {
    getVocabEntry: jest.fn(async (word: string) =>
      word === 'inspect'
        ? {
            word: 'inspect',
            pos: 'v',
            meaningKo: '조사하다',
            ipa: 'ɪnˈspɛkt',
            etymology: null,
            mnemonic: null,
            exampleSentenceIds: [],
          }
        : null,
    ),
  };
}

describe('VocabService.getEntry', () => {
  it('delegates to ContentService.getVocabEntry', async () => {
    const content = makeContent();
    const svc = new VocabService(
      content as unknown as ConstructorParameters<typeof VocabService>[0],
      null,
    );
    const result = await svc.getEntry('inspect');
    expect(result?.meaningKo).toBe('조사하다');
    expect(content.getVocabEntry).toHaveBeenCalledWith('inspect');
  });
});

describe('VocabService.recordTap', () => {
  const tap: TapRecord = {
    word: 'INSPECT',
    tappedAt: 123,
    sourceSentenceId: 's-1',
  };

  it('is a no-op when db is null', async () => {
    const content = makeContent();
    const svc = new VocabService(
      content as unknown as ConstructorParameters<typeof VocabService>[0],
      null,
    );
    await expect(svc.recordTap(tap)).resolves.toBeUndefined();
  });

  it('lowercases the word before persisting', async () => {
    const runAsync = jest.fn(async () => ({ lastInsertRowId: 0, changes: 1 }));
    const db = { runAsync } as unknown as ConstructorParameters<typeof VocabService>[1];
    const content = makeContent();
    const svc = new VocabService(
      content as unknown as ConstructorParameters<typeof VocabService>[0],
      db,
    );
    await svc.recordTap(tap);
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO word_tap_events'),
      'inspect',
      123,
      's-1',
    );
  });
});
