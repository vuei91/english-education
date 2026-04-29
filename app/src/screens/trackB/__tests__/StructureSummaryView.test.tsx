import { render, screen } from '@testing-library/react-native';

import StructureSummaryView from '../StructureSummaryView';

describe('StructureSummaryView', () => {
  it('renders all 4 slots with their values', () => {
    render(
      <StructureSummaryView
        summary={{
          sentenceId: 's',
          who: 'Researchers',
          what: 'published findings',
          whereAt: 'journal',
          whenAt: 'last month',
        }}
      />,
    );
    expect(screen.getByText('Researchers')).toBeOnTheScreen();
    expect(screen.getByText('published findings')).toBeOnTheScreen();
    expect(screen.getByText('journal')).toBeOnTheScreen();
    expect(screen.getByText('last month')).toBeOnTheScreen();
  });

  it('renders dash for missing values (Req 6.3)', () => {
    render(
      <StructureSummaryView
        summary={{
          sentenceId: 's',
          who: 'Teachers',
          what: 'remind parents',
          whereAt: null,
          whenAt: null,
        }}
      />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(2);
  });

  it('renders dash for every slot when the summary is null', () => {
    render(<StructureSummaryView summary={null} />);
    expect(screen.getAllByText('—')).toHaveLength(4);
  });
});
