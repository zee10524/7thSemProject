import { Types } from 'mongoose';
import { errors } from './errors.js';

/** Opaque keyset cursor over (sortDate desc, _id desc). */
export interface Cursor {
  t: number;
  id: string;
}

export function encodeCursor(date: Date, id: Types.ObjectId | string): string {
  return Buffer.from(JSON.stringify({ t: date.getTime(), id: String(id) }), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as Cursor).t === 'number' &&
      typeof (parsed as Cursor).id === 'string' &&
      Types.ObjectId.isValid((parsed as Cursor).id)
    ) {
      return parsed as Cursor;
    }
  } catch {
    // fall through
  }
  throw errors.badRequest('The page cursor is not valid.');
}

/** Mongo filter for "older than the cursor" on a (field desc, _id desc) index. */
export function afterCursor(field: string, cursor: Cursor | null): Record<string, unknown> {
  if (!cursor) return {};
  const at = new Date(cursor.t);
  const id = new Types.ObjectId(cursor.id);
  return { $or: [{ [field]: { $lt: at } }, { [field]: at, _id: { $lt: id } }] };
}

/** Takes limit+1 rows, returns the page and the next cursor. */
export function paginate<T extends { _id: Types.ObjectId }>(
  rows: T[],
  limit: number,
  dateOf: (row: T) => Date,
): { rows: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return { rows: page, nextCursor: hasMore && last ? encodeCursor(dateOf(last), last._id) : null };
}
