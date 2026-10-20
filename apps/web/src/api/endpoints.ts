import type {
  AdminOverview,
  AssistantTurnDto,
  AuthResponse,
  BookDto,
  ChatSessionDto,
  ChatSessionSummary,
  DismissalDto,
  ExplanationDto,
  FeedQuery,
  FeedResponse,
  GenresResponse,
  InsightsDto,
  LibraryIndex,
  LibraryStats,
  ListEntryDto,
  ListStatus,
  LoginBody,
  OnboardingDto,
  OnboardingProfile,
  Page,
  RailsResponse,
  RatingDto,
  RecentReadDto,
  RecItemDto,
  RegisterBody,
  ReviewBody,
  ReviewDto,
  SearchResponse,
  TasteSummary,
  UpdateOverridesBody,
  UserDto,
} from '@litsense/shared';
import { http, newIdempotencyKey } from './http';

export interface MetaDto {
  modelMode: 'mock' | 'http';
  coreApiVersion: string;
  apiVersion: string;
}

export interface ChatTurnResult {
  session: ChatSessionDto;
  reply: AssistantTurnDto;
}

/** One function per backend endpoint (see /docs for the OpenAPI document). */
export const api = {
  meta: () => http.get<MetaDto>('/meta'),

  // auth and account
  register: (body: RegisterBody) => http.post<AuthResponse>('/auth/register', body),
  login: (body: LoginBody) => http.post<AuthResponse>('/auth/login', body),
  logout: () => http.post<void>('/auth/logout'),
  logoutAll: () => http.post<void>('/auth/logout-all'),
  me: () => http.get<UserDto>('/me'),
  updateName: (name: string) => http.patch<UserDto>('/me', { name }),
  updateOverrides: (body: UpdateOverridesBody) => http.patch<UserDto>('/me/overrides', body),
  deleteAccount: (password: string) => http.del<void>('/me', { password }),

  // library
  library: () => http.get<LibraryIndex>('/me/library'),
  stats: () => http.get<LibraryStats>('/me/stats'),
  ratings: (cursor?: string) => http.get<Page<RatingDto>>('/me/ratings', { query: { cursor, limit: 24 } }),
  rate: (bookId: number, stars: number) =>
    http.put<{ stars: number; ratedAt: string; profileVersion: number }>(
      `/me/ratings/${bookId}`,
      { stars },
      { idempotencyKey: newIdempotencyKey() },
    ),
  unrate: (bookId: number) =>
    http.del<void>(`/me/ratings/${bookId}`, undefined, { idempotencyKey: newIdempotencyKey() }),
  readingList: (status: ListStatus | undefined, cursor?: string) =>
    http.get<Page<ListEntryDto>>('/me/reading-list', { query: { status, cursor, limit: 24 } }),
  setStatus: (bookId: number, status: ListStatus, progress?: number) =>
    http.put<ListEntryDto>(`/me/reading-list/${bookId}`, { status, progress }),
  removeFromList: (bookId: number) => http.del<void>(`/me/reading-list/${bookId}`),
  dismissed: (cursor?: string) =>
    http.get<Page<DismissalDto>>('/me/dismissed', { query: { cursor, limit: 24 } }),
  dismiss: (bookId: number) => http.put<void>(`/me/dismissed/${bookId}`),
  undismiss: (bookId: number) => http.del<void>(`/me/dismissed/${bookId}`),
  recordView: (bookId: number) => http.post<void>(`/me/views/${bookId}`),
  recentReads: () => http.get<RecentReadDto[]>('/me/recent-reads', { query: { limit: 8 } }),

  // reviews
  review: (bookId: number) => http.get<ReviewDto>(`/me/reviews/${bookId}`),
  saveReview: (body: ReviewBody) =>
    http.put<ReviewDto>('/me/reviews', body, { idempotencyKey: newIdempotencyKey() }),
  deleteReview: (bookId: number) => http.del<void>(`/me/reviews/${bookId}`),
  taste: () => http.get<TasteSummary>('/me/taste'),

  // onboarding
  onboardingGrid: () => http.get<{ books: BookDto[] }>('/onboarding/grid'),
  onboarding: () => http.get<OnboardingDto | null>('/me/onboarding'),
  saveOnboarding: (picks: number[], text: string) =>
    http.put<OnboardingDto>('/me/onboarding', { picks, text }),
  patchOnboardingProfile: (profile: OnboardingProfile) =>
    http.patch<OnboardingDto>('/me/onboarding/profile', { profile }),
  skipOnboarding: () => http.post<void>('/me/onboarding/skip'),

  // recommendations
  feed: (q: FeedQuery) =>
    http.get<FeedResponse>('/recommendations', { query: q as Record<string, string | number | undefined> }),
  rails: () => http.get<RailsResponse>('/recommendations/rails'),
  explain: (bookId: number) => http.get<ExplanationDto>(`/recommendations/${bookId}/explanation`),

  // books and search
  book: (bookId: number) => http.get<BookDto>(`/books/${bookId}`),
  insights: (bookId: number) => http.get<InsightsDto>(`/books/${bookId}/insights`),
  similar: (bookId: number, k = 8) => http.get<RecItemDto[]>(`/books/${bookId}/similar`, { query: { k } }),
  moreByAuthor: (bookId: number, k = 8) =>
    http.get<RecItemDto[]>(`/books/${bookId}/more-by-author`, { query: { k } }),
  genres: () => http.get<GenresResponse>('/books/genres'),
  search: (q: string, signal?: AbortSignal) =>
    http.get<SearchResponse>('/search', { query: { q, k: 20 }, signal }),

  // chat
  chatSessions: () => http.get<Page<ChatSessionSummary>>('/chat/sessions', { query: { limit: 20 } }),
  chatSession: (id: string) => http.get<ChatSessionDto>(`/chat/sessions/${id}`),
  createChat: () => http.post<ChatSessionDto>('/chat/sessions'),
  deleteChat: (id: string) => http.del<void>(`/chat/sessions/${id}`),
  sendChat: (id: string, message: string) =>
    http.post<ChatTurnResult>(`/chat/sessions/${id}/messages`, { message }),
  removeChip: (id: string, key: string) =>
    http.del<ChatTurnResult>(`/chat/sessions/${id}/chips/${encodeURIComponent(key)}`),

  // admin
  adminOverview: () => http.get<AdminOverview>('/admin/overview'),
  adminMetrics: () => http.get<Record<string, unknown>>('/admin/metrics'),
  adminReseed: (reset: boolean) =>
    http.post<{ upserted: number; source: string }>('/admin/catalog/reseed', { reset }),
};
