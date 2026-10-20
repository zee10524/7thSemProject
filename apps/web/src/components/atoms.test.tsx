import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BookDto } from '@litsense/shared';
import { Cover, RankBadge, RateWidget } from './atoms';

const book: BookDto = {
  bookId: 7,
  title: 'Norwegian Wood',
  author: 'Haruki Murakami',
  genres: ['Literary Fiction'],
  primaryGenre: 'Literary Fiction',
  year: 1987,
  pages: 296,
  description: '',
  image: null,
  isbn13: null,
  series: null,
  avgRating: 4.1,
  ratingsCount: 1000,
  tagline: null,
  cover: null,
};

describe('RateWidget', () => {
  it('offers ten half-star buttons and reports the chosen value', () => {
    const onRate = vi.fn();
    render(<RateWidget value={0} onRate={onRate} label="Rate Norwegian Wood" />);
    const group = screen.getByRole('group', { name: 'Rate Norwegian Wood' });
    expect(group.querySelectorAll('button')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: '3.5 stars' }));
    expect(onRate).toHaveBeenCalledWith(3.5);
    expect(screen.getByText('Rate this book')).toBeInTheDocument();
  });

  it('shows the current rating', () => {
    render(<RateWidget value={4.5} onRate={() => undefined} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4.5 stars' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Cover', () => {
  it('draws a CSS cover with the title when there is no image', () => {
    render(<Cover book={book} />);
    const cover = screen.getByRole('img', { name: 'Cover of Norwegian Wood' });
    expect(cover).toHaveTextContent('Norwegian Wood');
    expect(cover.querySelector('img')).toBeNull();
    expect(cover.getAttribute('style')).toContain('--c1');
  });

  it('layers the real image on top when there is one', () => {
    render(<Cover book={{ ...book, image: 'https://covers.openlibrary.org/b/id/1-L.jpg' }} size="sm" />);
    const img = screen.getByRole('img', { name: 'Cover of Norwegian Wood' }).querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://covers.openlibrary.org/b/id/1-M.jpg');
  });
});

describe('RankBadge', () => {
  it('shows the pick number, not an invented match percentage', () => {
    render(<RankBadge rank={3} />);
    expect(screen.getByTitle('Pick number 3')).toHaveTextContent('No.3');
  });
});
