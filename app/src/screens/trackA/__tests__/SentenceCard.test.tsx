/**
 * SentenceCard tests (Task 7.1, Req 1.2, 1.8).
 *
 * We rely on the Jest + @testing-library/react-native stack already set up
 * for other suites. No Supabase / AsyncStorage involved here — the card is
 * a pure presentational component.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import SentenceCard from '../SentenceCard';

describe('SentenceCard', () => {
  it('renders the English sentence', () => {
    render(<SentenceCard textEn="I want to eat pizza." />);
    expect(screen.getByLabelText('I want to eat pizza.')).toBeOnTheScreen();
  });

  it('shows the Korean translation immediately when provided', () => {
    render(<SentenceCard textEn="Hello world." textKo="안녕, 세상." />);
    expect(screen.getByText('안녕, 세상.')).toBeOnTheScreen();
  });

  it('does not render Korean row when textKo is omitted', () => {
    render(<SentenceCard textEn="Hello world." />);
    expect(screen.queryByText('안녕, 세상.')).toBeNull();
  });

  it('calls onWordPress with a normalised lowercase word', () => {
    const onWordPress = jest.fn();
    render(<SentenceCard textEn="I want Pizza!" onWordPress={onWordPress} />);
    fireEvent.press(screen.getByLabelText('pizza 뜻 보기'));
    expect(onWordPress).toHaveBeenCalledWith('pizza');
  });

  it('does not expose word tap handlers when onWordPress is omitted', () => {
    render(<SentenceCard textEn="Hello world." />);
    expect(screen.queryByLabelText('hello 뜻 보기')).toBeNull();
  });

  describe('ko-to-en mode', () => {
    it('shows Korean as main text and hides English behind a button', () => {
      render(<SentenceCard textEn="I love you." textKo="나는 너를 사랑해." mode="ko-to-en" />);
      expect(screen.getByText('나는 너를 사랑해.')).toBeOnTheScreen();
      expect(screen.queryByLabelText('I love you.')).toBeNull();
      expect(screen.getByLabelText('영어 정답 보기')).toBeOnTheScreen();
    });

    it('reveals English and calls onRevealEnglish when tapped', () => {
      const onReveal = jest.fn();
      render(
        <SentenceCard
          textEn="I love you."
          textKo="나는 너를 사랑해."
          mode="ko-to-en"
          onRevealEnglish={onReveal}
        />,
      );
      fireEvent.press(screen.getByLabelText('영어 정답 보기'));
      expect(screen.getByLabelText('I love you.')).toBeOnTheScreen();
      expect(onReveal).toHaveBeenCalledTimes(1);
    });
  });
});
