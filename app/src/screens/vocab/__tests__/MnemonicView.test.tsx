import { render, screen } from '@testing-library/react-native';

import MnemonicView from '../MnemonicView';

describe('MnemonicView', () => {
  it('renders the korean phrase', () => {
    render(<MnemonicView payload={{ korean_phrase: '어, 밴댕이(를) 버리다' }} />);
    expect(screen.getByText('어, 밴댕이(를) 버리다')).toBeOnTheScreen();
  });

  it('omits the story when absent', () => {
    const { queryByText } = render(
      <MnemonicView payload={{ korean_phrase: '라떼 마시다' }} />,
    );
    expect(queryByText(/scene/i)).toBeNull();
  });

  it('renders the story when provided', () => {
    render(
      <MnemonicView
        payload={{ korean_phrase: '라떼 마시다', story: '카페에서 라떼를 주문한다.' }}
      />,
    );
    expect(screen.getByText('카페에서 라떼를 주문한다.')).toBeOnTheScreen();
  });
});
