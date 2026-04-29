import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Chunk } from '../../../services/content';
import ChunkingView from '../ChunkingView';

const chunks: Chunk[] = [
  {
    id: 'c1',
    sentenceId: 's1',
    orderIndex: 0,
    text: 'The researchers',
    depth: 0,
    role: 'subject',
  },
  {
    id: 'c2',
    sentenceId: 's1',
    orderIndex: 1,
    text: 'studied bees',
    depth: 1,
    role: 'relative',
  },
];

describe('ChunkingView', () => {
  it('renders every chunk text', () => {
    render(<ChunkingView chunks={chunks} onChunkTap={jest.fn()} />);
    expect(screen.getByLabelText(/청크 재생: The researchers/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/청크 재생: studied bees/)).toBeOnTheScreen();
  });

  it('fires onChunkTap when a chunk is pressed', () => {
    const onChunkTap = jest.fn();
    render(<ChunkingView chunks={chunks} onChunkTap={onChunkTap} />);
    fireEvent.press(screen.getByLabelText(/청크 재생: studied bees/));
    expect(onChunkTap).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }));
  });

  it('exposes word tap handlers only when onWordTap is provided', () => {
    render(<ChunkingView chunks={chunks} />);
    expect(screen.queryByLabelText('bees 뜻 보기')).toBeNull();

    const onWordTap = jest.fn();
    render(<ChunkingView chunks={chunks} onWordTap={onWordTap} />);
    fireEvent.press(screen.getByLabelText('bees 뜻 보기'));
    expect(onWordTap).toHaveBeenCalledWith('bees', expect.objectContaining({ id: 'c2' }));
  });
});
