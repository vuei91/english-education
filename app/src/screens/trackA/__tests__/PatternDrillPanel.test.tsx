/**
 * PatternDrillPanel tests (Tasks 8.1~8.5 — Req 2.2, 2.3, 2.4, 2.5, 2.7).
 *
 * 커버리지:
 *   - 4단계 레벨 네비게이션 (8.1, Req 2.2)
 *   - 변형 문장 오디오 (8.2, Req 2.3)
 *   - Level 4 슬롯 채우기 + 로컬 문법 검증 (8.3, Req 2.4/2.5)
 *   - 재선택 안내 (8.4, Req 2.5)
 *   - 패턴 마스터 배지 (8.5, Req 2.7)
 *   - Non-Goal 가드 (Req 2.6) — record/mic/STT 경로 없음
 *
 * UI 문자열은 한국어로 통일. accessibilityLabel 조회도 한국어로 맞춘다.
 * 학습 대상인 영어 예문(`I want to eat pizza.` 등)과 내부 식별자
 * (testID `slot-3-offending`, enum 값 `'retry'`)만 영어 유지.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import PatternDrillPanel from '../PatternDrillPanel';
import type { PatternDrillVariants } from '../../../services/content';

jest.mock('../../../services/audio', () => ({
  audioService: {
    speak: jest.fn(),
    stop: jest.fn(),
  },
}));

const mockRecordDrillCompletion = jest.fn<boolean, [string, string?]>();
jest.mock('../../../stores', () => ({
  DRILL_COMPLETION_THRESHOLD: 3,
  useProgressStore: {
    getState: () => ({
      recordDrillCompletion: mockRecordDrillCompletion,
    }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { audioService: mockedAudioService } = require('../../../services/audio') as {
  audioService: { speak: jest.Mock; stop: jest.Mock };
};

function fullDrill(): PatternDrillVariants {
  return {
    originText: 'I want to eat pizza.',
    levels: {
      1: [{ level: 1, text: 'I want to eat pizza.' }],
      2: [{ level: 2, text: 'I want to eat pasta.' }],
      3: [{ level: 3, text: 'She wanted to eat pizza.' }],
      4: [
        {
          level: 4,
          text: 'I want to eat pizza.',
          slotHints: [{ tokenIndex: 4, choices: ['pizza', 'pasta'] }],
        },
      ],
    },
  };
}

function advanceToLevel4(): void {
  fireEvent.press(screen.getByLabelText('다음 레벨'));
  fireEvent.press(screen.getByLabelText('다음 레벨'));
  fireEvent.press(screen.getByLabelText('다음 레벨'));
}

beforeEach(() => {
  mockedAudioService.speak.mockClear();
  mockedAudioService.stop.mockClear();
  mockRecordDrillCompletion.mockReset();
  mockRecordDrillCompletion.mockReturnValue(false);
});
describe('PatternDrillPanel — 네비게이션 (8.1, Req 2.2)', () => {
  it('마운트 시 레벨 1 의 첫 변형 문장을 보여준다', () => {
    render(<PatternDrillPanel drill={fullDrill()} />);
    expect(screen.getByLabelText('레벨 1 / 4')).toBeOnTheScreen();
    expect(screen.getByText('원문 반복')).toBeOnTheScreen();
    expect(screen.getByText('I want to eat pizza.')).toBeOnTheScreen();
  });

  it('"다음 레벨" 을 누르면 1 → 2 → 3 → 4 로 진행된다', () => {
    render(<PatternDrillPanel drill={fullDrill()} />);

    const next = (): void =>
      fireEvent.press(screen.getByLabelText('다음 레벨'));

    next();
    expect(screen.getByLabelText('레벨 2 / 4')).toBeOnTheScreen();
    expect(screen.getByText('같은 자리 교체')).toBeOnTheScreen();

    next();
    expect(screen.getByLabelText('레벨 3 / 4')).toBeOnTheScreen();
    expect(screen.getByText('다른 자리 교체')).toBeOnTheScreen();

    next();
    expect(screen.getByLabelText('레벨 4 / 4')).toBeOnTheScreen();
    expect(screen.getByText('슬롯 채우기')).toBeOnTheScreen();
  });

  it('레벨 4 에서 "드릴 마치기" 를 노출하고 슬롯 채움 후 onExitDrill 을 1회만 호출한다', () => {
    const onExit = jest.fn();
    render(<PatternDrillPanel drill={fullDrill()} onExitDrill={onExit} />);

    advanceToLevel4();

    const finish = screen.getByLabelText('드릴 마치기');
    expect(finish).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 4에 pizza 선택'));

    fireEvent.press(screen.getByLabelText('드릴 마치기'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('비어 있는 레벨은 건너뛴다', () => {
    const sparse: PatternDrillVariants = {
      originText: 'I go home.',
      levels: {
        1: [{ level: 1, text: 'I go home.' }],
        2: [],
        3: [{ level: 3, text: 'He went home.' }],
        4: [],
      },
    };
    const onExit = jest.fn();
    render(<PatternDrillPanel drill={sparse} onExitDrill={onExit} />);

    expect(screen.getByLabelText('레벨 1 / 4')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    expect(screen.getByLabelText('레벨 3 / 4')).toBeOnTheScreen();
    expect(screen.getByText('He went home.')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('record / STT 계열 surface 가 없다 (Req 2.6 non-goal)', () => {
    const { root } = render(<PatternDrillPanel drill={fullDrill()} />);

    const violations: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as {
        props?: { accessibilityRole?: unknown; accessibilityLabel?: unknown };
        children?: unknown;
      };
      const role = n.props?.accessibilityRole;
      const label = n.props?.accessibilityLabel;
      if (role === 'record') violations.push('accessibilityRole=record');
      if (typeof label === 'string') {
        const l = label.toLowerCase();
        if (
          l.includes('record') ||
          l.includes('microphone') ||
          l.includes('mic') ||
          l.includes('녹음') ||
          l.includes('마이크')
        ) {
          violations.push(`accessibilityLabel=${label}`);
        }
      }
      const kids = Array.isArray(n.children) ? n.children : [];
      for (const c of kids) walk(c);
    };

    walk(root as unknown);
    expect(violations).toEqual([]);
  });
});

describe('PatternDrillPanel — 변형 문장 오디오 (8.2, Req 2.3)', () => {
  it('레벨 1 에서는 자동 재생하지 않는다 (세션이 이미 원문을 재생)', () => {
    const onPlayVariant = jest.fn();
    render(<PatternDrillPanel drill={fullDrill()} onPlayVariant={onPlayVariant} />);

    expect(screen.getByLabelText('레벨 1 / 4')).toBeOnTheScreen();
    expect(onPlayVariant).not.toHaveBeenCalled();
  });

  it('레벨 2 진입 시 변형을 1회 자동 재생한다 (Req 2.3)', () => {
    const onPlayVariant = jest.fn();
    render(<PatternDrillPanel drill={fullDrill()} onPlayVariant={onPlayVariant} />);

    expect(onPlayVariant).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('다음 레벨'));

    expect(screen.getByLabelText('레벨 2 / 4')).toBeOnTheScreen();
    expect(onPlayVariant).toHaveBeenCalledTimes(1);
    expect(onPlayVariant).toHaveBeenCalledWith(
      expect.objectContaining({ level: 2, text: 'I want to eat pasta.' }),
    );
  });

  it('레벨 3 진입 시에도 자동 재생한다 (Req 2.3)', () => {
    const onPlayVariant = jest.fn();
    render(<PatternDrillPanel drill={fullDrill()} onPlayVariant={onPlayVariant} />);

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    fireEvent.press(screen.getByLabelText('다음 레벨'));

    expect(screen.getByLabelText('레벨 3 / 4')).toBeOnTheScreen();
    expect(onPlayVariant).toHaveBeenCalledTimes(2);
    expect(onPlayVariant).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: 3, text: 'She wanted to eat pizza.' }),
    );
  });

  it('레벨 4 에서는 자동 재생하지 않는다 (슬롯 채우기 — 듣기 단계 아님)', () => {
    const onPlayVariant = jest.fn();
    render(<PatternDrillPanel drill={fullDrill()} onPlayVariant={onPlayVariant} />);

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    fireEvent.press(screen.getByLabelText('다음 레벨'));
    onPlayVariant.mockClear();
    fireEvent.press(screen.getByLabelText('다음 레벨'));

    expect(screen.getByLabelText('레벨 4 / 4')).toBeOnTheScreen();
    expect(onPlayVariant).not.toHaveBeenCalled();
  });

  it('레벨 2 에서 "변형 문장 다시 듣기" 버튼이 나오고 누를 때마다 onPlayVariant 가 1회 호출된다', () => {
    const onPlayVariant = jest.fn();
    render(<PatternDrillPanel drill={fullDrill()} onPlayVariant={onPlayVariant} />);

    expect(screen.queryByLabelText('변형 문장 다시 듣기')).toBeNull();

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    expect(onPlayVariant).toHaveBeenCalledTimes(1);

    const replay = screen.getByLabelText('변형 문장 다시 듣기');
    expect(replay).toBeOnTheScreen();

    fireEvent.press(replay);
    expect(onPlayVariant).toHaveBeenCalledTimes(2);
    expect(onPlayVariant).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: 2, text: 'I want to eat pasta.' }),
    );
  });

  it('레벨 1/4 에서는 "변형 문장 다시 듣기" 버튼을 렌더하지 않는다', () => {
    render(<PatternDrillPanel drill={fullDrill()} />);

    expect(screen.queryByLabelText('변형 문장 다시 듣기')).toBeNull();

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    expect(screen.getByLabelText('변형 문장 다시 듣기')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    expect(screen.getByLabelText('변형 문장 다시 듣기')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    expect(screen.queryByLabelText('변형 문장 다시 듣기')).toBeNull();
  });

  it('onPlayVariant 미지정 시 기본 경로로 audioService.speak 를 호출한다', () => {
    render(<PatternDrillPanel drill={fullDrill()} />);

    fireEvent.press(screen.getByLabelText('다음 레벨'));

    expect(mockedAudioService.speak).toHaveBeenCalledTimes(1);
    expect(mockedAudioService.speak).toHaveBeenCalledWith(
      'I want to eat pasta.',
      expect.objectContaining({ rate: 1 }),
    );

    fireEvent.press(screen.getByLabelText('변형 문장 다시 듣기'));
    expect(mockedAudioService.speak).toHaveBeenCalledTimes(2);
    expect(mockedAudioService.speak).toHaveBeenLastCalledWith(
      'I want to eat pasta.',
      expect.objectContaining({ rate: 1 }),
    );
    const lastCall =
      mockedAudioService.speak.mock.calls[
        mockedAudioService.speak.mock.calls.length - 1
      ];
    expect(lastCall[1]).not.toHaveProperty('sentenceId');
  });

  it('레벨 중간에 언마운트되어도 onPlayVariant 가 더 호출되지 않는다', () => {
    const onPlayVariant = jest.fn();
    const { unmount } = render(
      <PatternDrillPanel drill={fullDrill()} onPlayVariant={onPlayVariant} />,
    );

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    expect(onPlayVariant).toHaveBeenCalledTimes(1);

    unmount();
    expect(onPlayVariant).toHaveBeenCalledTimes(1);
  });
});

describe('PatternDrillPanel — Level 4 슬롯 채우기 (8.3, Req 2.4/2.5)', () => {
  it('슬롯 hint 하나당 빈 chip 하나를 렌더한다', () => {
    const drill: PatternDrillVariants = {
      originText: 'I saw a book today.',
      levels: {
        1: [{ level: 1, text: 'I saw a book today.' }],
        2: [{ level: 2, text: 'I saw a book today.' }],
        3: [{ level: 3, text: 'I saw a book today.' }],
        4: [
          {
            level: 4,
            text: 'I saw a book today.',
            slotHints: [
              { tokenIndex: 2, choices: ['a', 'an'] },
              { tokenIndex: 3, choices: ['book', 'apple'] },
            ],
          },
        ],
      },
    };

    render(<PatternDrillPanel drill={drill} />);
    advanceToLevel4();

    expect(screen.getByLabelText('슬롯 2, 비어 있음')).toBeOnTheScreen();
    expect(screen.getByLabelText('슬롯 3, 비어 있음')).toBeOnTheScreen();
  });

  it('chip 을 누르면 선택지를 보여준다', () => {
    render(<PatternDrillPanel drill={fullDrill()} />);
    advanceToLevel4();

    expect(screen.queryByLabelText('슬롯 4에 pizza 선택')).toBeNull();
    expect(screen.queryByLabelText('슬롯 4에 pasta 선택')).toBeNull();

    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));

    expect(screen.getByLabelText('슬롯 4에 pizza 선택')).toBeOnTheScreen();
    expect(screen.getByLabelText('슬롯 4에 pasta 선택')).toBeOnTheScreen();
  });

  it('선택한 단어로 chip 이 채워지고 다시 눌러 변경할 수 있다', () => {
    render(<PatternDrillPanel drill={fullDrill()} />);
    advanceToLevel4();

    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 4에 pizza 선택'));

    expect(screen.getByLabelText('슬롯 4, pizza 선택됨')).toBeOnTheScreen();
    expect(screen.queryByLabelText('슬롯 4에 pasta 선택')).toBeNull();

    fireEvent.press(screen.getByLabelText('슬롯 4, pizza 선택됨'));
    expect(screen.getByLabelText('슬롯 4에 pasta 선택')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('슬롯 4에 pasta 선택'));
    expect(screen.getByLabelText('슬롯 4, pasta 선택됨')).toBeOnTheScreen();
  });

  it('모든 슬롯이 유효하게 채워지기 전까지 "드릴 마치기" 는 disabled', () => {
    const drill: PatternDrillVariants = {
      originText: 'I saw a book.',
      levels: {
        1: [{ level: 1, text: 'I saw a book.' }],
        2: [{ level: 2, text: 'I saw a book.' }],
        3: [{ level: 3, text: 'I saw a book.' }],
        4: [
          {
            level: 4,
            text: 'I saw a book.',
            slotHints: [
              { tokenIndex: 2, choices: ['a', 'an'] },
              { tokenIndex: 3, choices: ['book', 'apple'] },
            ],
          },
        ],
      },
    };
    const onExit = jest.fn();
    render(<PatternDrillPanel drill={drill} onExitDrill={onExit} />);
    advanceToLevel4();

    const finish = screen.getByLabelText('드릴 마치기');
    expect(finish.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );

    fireEvent.press(screen.getByLabelText('슬롯 2, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 2에 a 선택'));
    expect(screen.getByLabelText('드릴 마치기').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );

    fireEvent.press(screen.getByLabelText('슬롯 3, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 3에 book 선택'));

    const finishEnabled = screen.getByLabelText('드릴 마치기');
    expect(finishEnabled.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );

    fireEvent.press(finishEnabled);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('로컬 validator 가 거절하는 조합(a + apple)은 disabled 유지', () => {
    const drill: PatternDrillVariants = {
      originText: 'I saw a apple.',
      levels: {
        1: [{ level: 1, text: 'I saw a apple.' }],
        2: [{ level: 2, text: 'I saw a apple.' }],
        3: [{ level: 3, text: 'I saw a apple.' }],
        4: [
          {
            level: 4,
            text: 'I saw a apple.',
            slotHints: [
              { tokenIndex: 2, choices: ['a', 'an'] },
              { tokenIndex: 3, choices: ['apple', 'book'] },
            ],
          },
        ],
      },
    };
    render(<PatternDrillPanel drill={drill} />);
    advanceToLevel4();

    fireEvent.press(screen.getByLabelText('슬롯 2, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 2에 a 선택'));
    fireEvent.press(screen.getByLabelText('슬롯 3, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 3에 apple 선택'));

    expect(screen.getByLabelText('드릴 마치기').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );

    fireEvent.press(screen.getByLabelText('슬롯 2, a 선택됨'));
    fireEvent.press(screen.getByLabelText('슬롯 2에 an 선택'));
    expect(screen.getByLabelText('드릴 마치기').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
  });

  it('부모의 onSlotSelect 가 retry 를 반환하면 Level 4 를 미완으로 취급한다 (8.4 seam)', () => {
    const onSlotSelect = jest.fn().mockReturnValue({ kind: 'retry', reason: 'nope' });
    render(
      <PatternDrillPanel drill={fullDrill()} onSlotSelect={onSlotSelect} />,
    );
    advanceToLevel4();

    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 4에 pizza 선택'));

    expect(onSlotSelect).toHaveBeenCalledWith(4, 'pizza');
    expect(screen.getByLabelText('드릴 마치기').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('retry 상태를 renderFeedback 으로 라우팅한다', () => {
    const onSlotSelect = jest.fn().mockReturnValue({ kind: 'retry' });
    const renderFeedback = jest.fn().mockReturnValue(null);
    render(
      <PatternDrillPanel
        drill={fullDrill()}
        onSlotSelect={onSlotSelect}
        renderFeedback={renderFeedback}
      />,
    );
    advanceToLevel4();
    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 4에 pizza 선택'));

    expect(renderFeedback).toHaveBeenCalled();
    const stateKinds = renderFeedback.mock.calls.map(
      (c) => (c[0] as { kind: string }).kind,
    );
    expect(stateKinds).toContain('retry');
  });
});

describe('PatternDrillPanel — 재선택 안내 (8.4, Req 2.5)', () => {
  function aAppleDrill(): PatternDrillVariants {
    return {
      originText: 'I saw a apple.',
      levels: {
        1: [{ level: 1, text: 'I saw a apple.' }],
        2: [{ level: 2, text: 'I saw a apple.' }],
        3: [{ level: 3, text: 'I saw a apple.' }],
        4: [
          {
            level: 4,
            text: 'I saw a apple.',
            slotHints: [
              { tokenIndex: 2, choices: ['a', 'an'] },
              { tokenIndex: 3, choices: ['apple', 'book'] },
            ],
          },
        ],
      },
    };
  }

  it('Level 4 실패 시 기본 재선택 안내 배너를 validator reason 과 함께 렌더한다', () => {
    render(<PatternDrillPanel drill={aAppleDrill()} />);
    advanceToLevel4();

    fireEvent.press(screen.getByLabelText('슬롯 2, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 2에 a 선택'));
    fireEvent.press(screen.getByLabelText('슬롯 3, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 3에 apple 선택'));

    const banner = screen.getByLabelText('재선택 안내');
    expect(banner).toBeOnTheScreen();
    expect(banner.props.accessibilityLiveRegion).toBe('polite');

    expect(screen.getByText('다시 골라볼까요?')).toBeOnTheScreen();
    expect(
      screen.getByText(/Use 'an' before a vowel-sound word/i),
    ).toBeOnTheScreen();
  });

  it('레벨 1/2/3 에서는 기본 재선택 안내 배너를 렌더하지 않는다', () => {
    render(<PatternDrillPanel drill={aAppleDrill()} />);

    expect(screen.queryByLabelText('재선택 안내')).toBeNull();

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    expect(screen.queryByLabelText('재선택 안내')).toBeNull();

    fireEvent.press(screen.getByLabelText('다음 레벨'));
    expect(screen.queryByLabelText('재선택 안내')).toBeNull();
  });

  it('레벨 4 도 선택 전이면 배너를 렌더하지 않는다', () => {
    render(<PatternDrillPanel drill={aAppleDrill()} />);
    advanceToLevel4();

    expect(screen.queryByLabelText('재선택 안내')).toBeNull();
    expect(screen.queryByText('다시 골라볼까요?')).toBeNull();
  });

  it('renderFeedback 가 주어지면 기본 배너를 억제하고 DrillFeedbackState 를 포워드한다', () => {
    const renderFeedback = jest.fn().mockReturnValue(null);
    render(
      <PatternDrillPanel drill={aAppleDrill()} renderFeedback={renderFeedback} />,
    );
    advanceToLevel4();

    fireEvent.press(screen.getByLabelText('슬롯 2, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 2에 a 선택'));
    fireEvent.press(screen.getByLabelText('슬롯 3, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 3에 apple 선택'));

    expect(screen.queryByLabelText('재선택 안내')).toBeNull();
    expect(screen.queryByText('다시 골라볼까요?')).toBeNull();

    type FeedbackState = {
      kind: 'ok' | 'retry';
      reason?: string;
      offendingTokenIndex?: number;
    };
    const retryStates = renderFeedback.mock.calls
      .map((c) => c[0] as FeedbackState)
      .filter((s) => s.kind === 'retry');
    expect(retryStates.length).toBeGreaterThan(0);

    const last = retryStates[retryStates.length - 1]!;
    expect(last.reason).toEqual(expect.any(String));
    expect(last.offendingTokenIndex).toBe(3);
  });

  it('onSlotSelect 가 retry 를 강제하면 parent reason 이 renderFeedback 에 전달된다', () => {
    const parentReason = '서버 규칙 미통과 — 동사 시제를 확인해 주세요.';
    const onSlotSelect = jest
      .fn()
      .mockReturnValue({ kind: 'retry', reason: parentReason });
    const renderFeedback = jest.fn().mockReturnValue(null);

    render(
      <PatternDrillPanel
        drill={fullDrill()}
        onSlotSelect={onSlotSelect}
        renderFeedback={renderFeedback}
      />,
    );
    advanceToLevel4();

    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 4에 pizza 선택'));

    type FeedbackState = { kind: 'ok' | 'retry'; reason?: string };
    const retryStates = renderFeedback.mock.calls
      .map((c) => c[0] as FeedbackState)
      .filter((s) => s.kind === 'retry');

    expect(retryStates[retryStates.length - 1]!.reason).toBe(parentReason);
  });

  it('선택을 고치면 ok 로 돌아가며 배너가 사라진다', () => {
    render(<PatternDrillPanel drill={aAppleDrill()} />);
    advanceToLevel4();

    fireEvent.press(screen.getByLabelText('슬롯 2, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 2에 a 선택'));
    fireEvent.press(screen.getByLabelText('슬롯 3, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 3에 apple 선택'));

    expect(screen.getByLabelText('재선택 안내')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('슬롯 2, a 선택됨'));
    fireEvent.press(screen.getByLabelText('슬롯 2에 an 선택'));

    expect(screen.queryByLabelText('재선택 안내')).toBeNull();
    expect(screen.queryByText('다시 골라볼까요?')).toBeNull();
  });

  it('offending chip 이 별도 testID 를 받고 나머지 chip 은 그대로 상호작용 가능', () => {
    render(<PatternDrillPanel drill={aAppleDrill()} />);
    advanceToLevel4();

    expect(screen.queryByTestId('slot-3-offending')).toBeNull();

    fireEvent.press(screen.getByLabelText('슬롯 2, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 2에 a 선택'));
    fireEvent.press(screen.getByLabelText('슬롯 3, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 3에 apple 선택'));

    expect(screen.getByTestId('slot-3-offending')).toBeOnTheScreen();
    expect(screen.getByTestId('slot-2')).toBeOnTheScreen();
    expect(screen.queryByTestId('slot-2-offending')).toBeNull();
    expect(screen.queryByTestId('slot-3')).toBeNull();
  });
});

describe('PatternDrillPanel — 패턴 마스터 배지 (8.5, Req 2.7)', () => {
  it('originSentenceId 없이 Finish 를 눌러도 배지 배너를 렌더하지 않는다', () => {
    render(<PatternDrillPanel drill={fullDrill()} />);
    advanceToLevel4();
    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 4에 pizza 선택'));
    fireEvent.press(screen.getByLabelText('드릴 마치기'));

    expect(mockRecordDrillCompletion).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('패턴 마스터 배지 획득')).toBeNull();
    expect(screen.queryByText('🏅 패턴 마스터!')).toBeNull();
  });

  it('originSentenceId 가 있고 threshold 를 넘는 순간 배지 배너가 나온다', () => {
    mockRecordDrillCompletion.mockReturnValueOnce(true);

    render(
      <PatternDrillPanel drill={fullDrill()} originSentenceId="pattern-abc" />,
    );
    advanceToLevel4();
    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 4에 pizza 선택'));
    fireEvent.press(screen.getByLabelText('드릴 마치기'));

    expect(mockRecordDrillCompletion).toHaveBeenCalledWith(
      'pattern-abc',
      expect.any(String),
    );
    const banner = screen.getByLabelText('패턴 마스터 배지 획득');
    expect(banner).toBeOnTheScreen();
    expect(banner.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByText('🏅 패턴 마스터!')).toBeOnTheScreen();
  });

  it('threshold 미만 완료 시에는 배지 배너를 렌더하지 않는다', () => {
    render(
      <PatternDrillPanel drill={fullDrill()} originSentenceId="pattern-xyz" />,
    );
    advanceToLevel4();
    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 4에 pizza 선택'));
    fireEvent.press(screen.getByLabelText('드릴 마치기'));

    expect(mockRecordDrillCompletion).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('패턴 마스터 배지 획득')).toBeNull();
  });

  it('onExitDrill 이 recordDrillCompletion 보다 먼저 호출된다', () => {
    mockRecordDrillCompletion.mockReturnValueOnce(true);
    const onExit = jest.fn();

    render(
      <PatternDrillPanel
        drill={fullDrill()}
        originSentenceId="pattern-order"
        onExitDrill={onExit}
      />,
    );
    advanceToLevel4();
    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 4에 pizza 선택'));
    fireEvent.press(screen.getByLabelText('드릴 마치기'));

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(mockRecordDrillCompletion).toHaveBeenCalledTimes(1);
    expect(onExit.mock.invocationCallOrder[0]!).toBeLessThan(
      mockRecordDrillCompletion.mock.invocationCallOrder[0]!,
    );
  });

  it('renderFeedback 가 주어지면 기본 배지 배너를 억제하고 render-prop 이 { kind: "ok" } 를 받는다', () => {
    mockRecordDrillCompletion.mockReturnValueOnce(true);
    const renderFeedback = jest.fn().mockReturnValue(null);

    render(
      <PatternDrillPanel
        drill={fullDrill()}
        originSentenceId="pattern-custom"
        renderFeedback={renderFeedback}
      />,
    );
    advanceToLevel4();
    fireEvent.press(screen.getByLabelText('슬롯 4, 비어 있음'));
    fireEvent.press(screen.getByLabelText('슬롯 4에 pizza 선택'));
    fireEvent.press(screen.getByLabelText('드릴 마치기'));

    expect(screen.queryByLabelText('패턴 마스터 배지 획득')).toBeNull();
    expect(screen.queryByText('🏅 패턴 마스터!')).toBeNull();

    expect(mockRecordDrillCompletion).toHaveBeenCalledWith(
      'pattern-custom',
      expect.any(String),
    );
    type FeedbackState = { kind: 'ok' | 'retry' };
    const okCalls = renderFeedback.mock.calls.filter(
      (c) => (c[0] as FeedbackState).kind === 'ok',
    );
    expect(okCalls.length).toBeGreaterThan(0);
  });
});
