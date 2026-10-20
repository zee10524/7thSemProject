import { randomUUID } from 'node:crypto';
import {
  type AssistantTurnDto,
  type ChatReply,
  type ChatSessionDto,
  type ChatSessionSummary,
  type ChatTurnDto,
  type Chip,
  type Page,
  parseChipKey,
  removeChipFromSession,
  SessionState,
} from '@litsense/shared';
import { decodeCursor, paginate } from '../lib/cursor.js';
import { errors } from '../lib/errors.js';
import type { CallContext, ModelService } from '../modelService/index.js';
import { chatRepository } from '../repositories/chat.repository.js';
import type { BookCatalog } from './bookCatalog.js';
import type { UserStateBuilder } from './userState.service.js';

/** Transcript turns are stored without books (only book ids) and hydrated on read. */
type StoredTurn =
  | { id: string; role: 'user'; text: string; at: string }
  | (Omit<AssistantTurnDto, 'items'> & { items: { book_id: number; reason: string; evidence: unknown }[] });

const MAX_TURNS = 200;
const DEFAULT_TITLE = 'New conversation';

type SessionRow = NonNullable<Awaited<ReturnType<typeof chatRepository.findOwned>>>;

export class ChatService {
  constructor(
    private readonly model: ModelService,
    private readonly states: UserStateBuilder,
    private readonly catalog: BookCatalog,
  ) {}

  async create(userId: string): Promise<ChatSessionDto> {
    const doc = await chatRepository.create(userId);
    return this.toDto(doc.toObject());
  }

  async list(
    userId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<ChatSessionSummary>> {
    const rows = await chatRepository.page(userId, decodeCursor(rawCursor), limit);
    const { rows: page, nextCursor } = paginate(rows, limit, (r) => r.updatedAt);
    return {
      items: page.map((r) => ({
        id: String(r._id),
        title: r.title,
        turnCount: r.turnCount ?? 0,
        updatedAt: r.updatedAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async get(userId: string, sessionId: string): Promise<ChatSessionDto> {
    return this.toDto(await this.load(userId, sessionId));
  }

  async remove(userId: string, sessionId: string): Promise<void> {
    if (!(await chatRepository.deleteOwned(userId, sessionId))) throw errors.notFound('Conversation');
  }

  /** One chat turn (contract section 4): persist `reply.session` verbatim and append the transcript. */
  async send(
    ctx: CallContext,
    userId: string,
    sessionId: string,
    message: string,
  ): Promise<{ session: ChatSessionDto; reply: AssistantTurnDto }> {
    const row = await this.load(userId, sessionId);
    const [state, session] = await Promise.all([
      this.states.build(userId),
      Promise.resolve(this.sessionOf(row)),
    ]);
    const reply = await this.model.chatTurn(ctx, { state, session, message });
    const userTurn: StoredTurn = {
      id: randomUUID(),
      role: 'user',
      text: message,
      at: new Date().toISOString(),
    };
    const title = row.title === DEFAULT_TITLE ? message.slice(0, 60) : row.title;
    return this.persist(userId, row, reply, [userTurn], title);
  }

  /** Removes one active modifier and re-runs the session as it stands (an empty message). */
  async removeChip(
    ctx: CallContext,
    userId: string,
    sessionId: string,
    key: string,
  ): Promise<{ session: ChatSessionDto; reply: AssistantTurnDto }> {
    if (!parseChipKey(key)) throw errors.badRequest('Unknown chip.');
    const row = await this.load(userId, sessionId);
    const session = this.sessionOf(row);
    if (!session) throw errors.badRequest('This conversation has no active filters yet.');
    const next = removeChipFromSession(session, key);
    const state = await this.states.build(userId);
    const reply = await this.model.chatTurn(ctx, { state, session: next, message: '' });
    return this.persist(userId, row, reply, [], row.title);
  }

  private async persist(
    userId: string,
    row: SessionRow,
    reply: ChatReply,
    before: StoredTurn[],
    title: string,
  ): Promise<{ session: ChatSessionDto; reply: AssistantTurnDto }> {
    const assistant: StoredTurn = {
      id: randomUUID(),
      role: 'assistant',
      intro: reply.intro,
      items: reply.items.map((i) => ({ book_id: i.book_id, reason: i.reason, evidence: i.evidence })),
      followup: reply.followup,
      clarification: reply.clarification,
      chips: reply.chips,
      intent: reply.intent,
      method: reply.method,
      at: new Date().toISOString(),
    };
    const turns = [...((row.turns ?? []) as StoredTurn[]), ...before, assistant].slice(-MAX_TURNS);
    const saved = await chatRepository.saveIfVersion(userId, String(row._id), row.version, {
      state: reply.session,
      turns,
      chips: reply.chips,
      title,
    });
    if (!saved) throw errors.conflict('This conversation changed in another tab. Reload it and try again.');
    const dto = await this.toDto(saved);
    const last = dto.turns.at(-1);
    if (!last || last.role !== 'assistant') throw new Error('assistant turn missing after save');
    return { session: dto, reply: last };
  }

  private async load(userId: string, sessionId: string): Promise<SessionRow> {
    const row = await chatRepository.findOwned(userId, sessionId);
    if (!row) throw errors.notFound('Conversation');
    return row;
  }

  private sessionOf(row: SessionRow): SessionState | null {
    if (!row.state) return null;
    const parsed = SessionState.safeParse(row.state);
    return parsed.success ? parsed.data : null;
  }

  private async toDto(row: SessionRow | Record<string, unknown>): Promise<ChatSessionDto> {
    const r = row as SessionRow;
    const stored = (r.turns ?? []) as StoredTurn[];
    const ids = stored.flatMap((t) => (t.role === 'assistant' ? t.items.map((i) => i.book_id) : []));
    const books = await this.catalog.getMany(ids);
    const turns: ChatTurnDto[] = stored.map((t) => {
      if (t.role === 'user') return t;
      return {
        ...t,
        items: t.items.flatMap((i) => {
          const book = books.get(i.book_id);
          return book
            ? [
                {
                  book,
                  reason: i.reason,
                  evidence: i.evidence as AssistantTurnDto['items'][number]['evidence'],
                },
              ]
            : [];
        }),
      };
    });
    return {
      id: String(r._id),
      title: r.title ?? DEFAULT_TITLE,
      turns,
      chips: (r.chips ?? []) as Chip[],
      version: r.version ?? 0,
      createdAt: (r.createdAt ?? new Date()).toISOString(),
      updatedAt: (r.updatedAt ?? new Date()).toISOString(),
    };
  }
}
