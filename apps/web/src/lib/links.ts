import type { BookDto } from '@litsense/shared';

export const bookHref = (b: Pick<BookDto, 'bookId'>) => `/book/${b.bookId}`;

export const CHAT_STARTERS = [
  'Something cozy',
  'Make me cry',
  'Under 300 pages',
  'Dark and atmospheric',
  'Like my last read',
  'Surprise me',
];
