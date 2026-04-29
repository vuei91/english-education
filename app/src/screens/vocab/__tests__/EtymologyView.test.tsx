import { fireEvent, render, screen } from '@testing-library/react-native';

import EtymologyView from '../EtymologyView';

describe('EtymologyView', () => {
  const payload = {
    parts: [
      { text: 'in-', meaning: '안으로' },
      { text: 'spect', meaning: '보다' },
    ],
    gloss: '안을 들여다보다',
    related: ['respect', 'suspect', 'spectator', 'inspection', 'inspector', 'extra'],
  };

  it('renders each morphological part', () => {
    render(<EtymologyView payload={payload} />);
    expect(screen.getByText('in-')).toBeOnTheScreen();
    expect(screen.getByText('spect')).toBeOnTheScreen();
    expect(screen.getByText(/안을 들여다보다/)).toBeOnTheScreen();
  });

  it('caps related words at 5', () => {
    render(<EtymologyView payload={payload} />);
    expect(screen.queryByText('extra')).toBeNull();
    expect(screen.getByText('respect')).toBeOnTheScreen();
  });

  it('invokes onRelatedTap when a related chip is pressed', () => {
    const onRelatedTap = jest.fn();
    render(<EtymologyView payload={payload} onRelatedTap={onRelatedTap} />);
    fireEvent.press(screen.getByLabelText('suspect 단어 도우미 열기'));
    expect(onRelatedTap).toHaveBeenCalledWith('suspect');
  });
});
