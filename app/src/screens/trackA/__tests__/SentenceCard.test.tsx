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

  it('reveals the Korean translation only after tapping the toggle', () => {
    render(<SentenceCard textEn="Hello world." textKo="안녕, 세상." />);
    expect(screen.queryByText('안녕, 세상.')).toBeNull();
    fireEvent.press(screen.getByLabelText('한국어 번역 보기'));
    expect(screen.getByText('안녕, 세상.')).toBeOnTheScreen();
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
});
