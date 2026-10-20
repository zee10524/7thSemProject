import {
  type QueryClient,
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  FeedQuery,
  FeedResponse,
  LibraryIndex,
  ListStatus,
  OnboardingProfile,
  RailsResponse,
  ReviewBody,
  UpdateOverridesBody,
  UserDto,
} from '@litsense/shared';
import { toast } from '../store/ui';
import { api } from './endpoints';
import { errorMessage, isApiError, setCsrfToken } from './http';

export const keys = {
  me: ['me'] as const,
  meta: ['meta'] as const,
  library: ['library'] as const,
  stats: ['stats'] as const,
  list: (status?: ListStatus) => ['list', status ?? 'all'] as const,
  ratings: ['ratings'] as const,
  dismissed: ['dismissed'] as const,
  recent: ['recent'] as const,
  rails: ['rails'] as const,
  feed: (q: FeedQuery) => ['feed', q] as const,
  explain: (id: number) => ['explain', id] as const,
  book: (id: number) => ['book', id] as const,
  insights: (id: number) => ['insights', id] as const,
  similar: (id: number) => ['similar', id] as const,
  moreByAuthor: (id: number) => ['moreByAuthor', id] as const,
  genres: ['genres'] as const,
  search: (q: string) => ['search', q] as const,
  grid: ['grid'] as const,
  onboarding: ['onboarding'] as const,
  review: (id: number) => ['review', id] as const,
  taste: ['taste'] as const,
  chats: ['chats'] as const,
  chat: (id: string) => ['chat', id] as const,
};

/** Everything that depends on the reader's profile (it changes with each rating, shelf or dismissal). */
const PERSONAL = [
  'library',
  'stats',
  'list',
  'ratings',
  'dismissed',
  'recent',
  'rails',
  'feed',
  'explain',
  'similar',
  'moreByAuthor',
  'taste',
];

export function invalidatePersonal(qc: QueryClient): Promise<void> {
  return Promise.all(PERSONAL.map((k) => qc.invalidateQueries({ queryKey: [k] }))).then(() => undefined);
}

// ---------------------------------------------------------------- session

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async (): Promise<UserDto | null> => {
      try {
        return await api.me();
      } catch (err) {
        if (isApiError(err) && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useMeta() {
  return useQuery({ queryKey: keys.meta, queryFn: api.meta, staleTime: Infinity, retry: false });
}

export function useSignIn(kind: 'login' | 'register') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; name?: string }) =>
      kind === 'login' ? api.login(body) : api.register({ ...body, name: body.name ?? '' }),
    onSuccess: (res) => {
      setCsrfToken(res.csrfToken);
      qc.clear();
      qc.setQueryData(keys.me, res.user);
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (everywhere: boolean) => (everywhere ? api.logoutAll() : api.logout()),
    onSettled: () => {
      setCsrfToken(null);
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}

export function useUpdateName() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.updateName, onSuccess: (u) => qc.setQueryData(keys.me, u) });
}

export function useUpdateOverrides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOverridesBody) => api.updateOverrides(body),
    onSuccess: async (u) => {
      qc.setQueryData(keys.me, u);
      await invalidatePersonal(qc);
    },
    onError: (err) => toast(errorMessage(err), { kind: 'warn' }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => {
      setCsrfToken(null);
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}

// ---------------------------------------------------------------- library

export function useLibrary(enabled = true) {
  return useQuery({ queryKey: keys.library, queryFn: api.library, enabled, staleTime: 30_000 });
}

export function useStats() {
  return useQuery({ queryKey: keys.stats, queryFn: api.stats });
}

export function useReadingList(status?: ListStatus) {
  return useInfiniteQuery({
    queryKey: keys.list(status),
    queryFn: ({ pageParam }) => api.readingList(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useRatings() {
  return useInfiniteQuery({
    queryKey: keys.ratings,
    queryFn: ({ pageParam }) => api.ratings(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useDismissed() {
  return useInfiniteQuery({
    queryKey: keys.dismissed,
    queryFn: ({ pageParam }) => api.dismissed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useRecentReads() {
  return useQuery({ queryKey: keys.recent, queryFn: api.recentReads });
}

function patchLibrary(qc: QueryClient, fn: (lib: LibraryIndex) => LibraryIndex) {
  const prev = qc.getQueryData<LibraryIndex>(keys.library);
  if (prev) qc.setQueryData(keys.library, fn(structuredClone(prev)));
  return prev;
}

/** Optimistic rating: the stars move at once; the server answer (or a rollback) follows. */
export function useRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookId, stars }: { bookId: number; stars: number | null }): Promise<void> => {
      if (stars === null) await api.unrate(bookId);
      else await api.rate(bookId, stars);
    },
    onMutate: async ({ bookId, stars }) => {
      await qc.cancelQueries({ queryKey: keys.library });
      const prev = patchLibrary(qc, (lib) => {
        if (stars === null) delete lib.ratings[String(bookId)];
        else {
          lib.ratings[String(bookId)] = stars;
          const st = lib.statuses[String(bookId)];
          if (!st || st.status === 'want_to_read' || st.status === 'currently_reading') {
            lib.statuses[String(bookId)] = { status: 'read', progress: 100 };
          }
        }
        return lib;
      });
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.library, ctx.prev);
      toast(errorMessage(err), { kind: 'warn' });
    },
    onSuccess: (_d, { stars }) =>
      toast(stars === null ? 'Rating removed' : `Rated ${stars} stars. Your picks will adjust.`),
    onSettled: () => invalidatePersonal(qc),
  });
}

export function useSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookId,
      status,
      progress,
    }: {
      bookId: number;
      status: ListStatus | null;
      progress?: number;
    }): Promise<void> => {
      if (status === null) await api.removeFromList(bookId);
      else await api.setStatus(bookId, status, progress);
    },
    onMutate: async ({ bookId, status, progress }) => {
      await qc.cancelQueries({ queryKey: keys.library });
      const prev = patchLibrary(qc, (lib) => {
        if (status === null) delete lib.statuses[String(bookId)];
        else
          lib.statuses[String(bookId)] = {
            status,
            progress: progress ?? lib.statuses[String(bookId)]?.progress ?? null,
          };
        return lib;
      });
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.library, ctx.prev);
      toast(errorMessage(err), { kind: 'warn' });
    },
    onSettled: () => invalidatePersonal(qc),
  });
}

function dropFromRecs(qc: QueryClient, bookId: number) {
  const keep = (i: { book: { bookId: number } }) => i.book.bookId !== bookId;
  qc.setQueriesData<FeedResponse>({ queryKey: ['feed'] }, (old) =>
    old ? { ...old, items: old.items.filter(keep) } : old,
  );
  qc.setQueriesData<RailsResponse>({ queryKey: keys.rails }, (old) =>
    old
      ? {
          ...old,
          topPicks: old.topPicks.filter(keep),
          trending: old.trending.filter(keep),
          hiddenGems: old.hiddenGems.filter(keep),
          moreByAuthors: old.moreByAuthors.filter(keep),
          continueExploring: old.continueExploring.filter(keep),
          fromReadingList: old.fromReadingList.filter(keep),
          becauseYouLiked: old.becauseYouLiked.map((b) => ({ ...b, items: b.items.filter(keep) })),
        }
      : old,
  );
}

export function useDismiss() {
  const qc = useQueryClient();
  const undo = useMutation({ mutationFn: api.undismiss, onSettled: () => invalidatePersonal(qc) });
  return useMutation({
    mutationFn: (bookId: number) => api.dismiss(bookId),
    onMutate: async (bookId) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: ['feed'] }),
        qc.cancelQueries({ queryKey: keys.rails }),
      ]);
      dropFromRecs(qc, bookId);
      const prev = patchLibrary(qc, (lib) => ({ ...lib, dismissed: [...lib.dismissed, bookId] }));
      return { prev };
    },
    onSuccess: (_d, bookId) =>
      toast('Got it. We will not suggest that one again.', {
        action: { label: 'Undo', run: () => undo.mutate(bookId) },
      }),
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.library, ctx.prev);
      toast(errorMessage(err), { kind: 'warn' });
    },
    onSettled: () => invalidatePersonal(qc),
  });
}

export function useUndismiss() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.undismiss, onSettled: () => invalidatePersonal(qc) });
}

export function useRecordView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.recordView,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.rails }),
  });
}

// ---------------------------------------------------------------- reviews

export function useReview(bookId: number | null) {
  return useQuery({
    queryKey: keys.review(bookId ?? -1),
    queryFn: async () => {
      try {
        return await api.review(bookId ?? -1);
      } catch (err) {
        if (isApiError(err) && err.status === 404) return null;
        throw err;
      }
    },
    enabled: bookId !== null,
    // Poll while the background analysis runs.
    refetchInterval: (q) => (q.state.data?.analysis.status === 'pending' ? 1500 : false),
  });
}

export function useSaveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReviewBody) => api.saveReview(body),
    onSuccess: async (review) => {
      qc.setQueryData(keys.review(review.bookId), review);
      await invalidatePersonal(qc);
    },
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteReview,
    onSuccess: async (_d, bookId) => {
      qc.setQueryData(keys.review(bookId), null);
      await invalidatePersonal(qc);
    },
  });
}

export function useTaste() {
  return useQuery({ queryKey: keys.taste, queryFn: api.taste });
}

// ---------------------------------------------------------------- onboarding

export function useOnboardingGrid() {
  return useQuery({ queryKey: keys.grid, queryFn: api.onboardingGrid, staleTime: 10 * 60_000 });
}

export function useOnboarding() {
  return useQuery({ queryKey: keys.onboarding, queryFn: api.onboarding });
}

export function useSaveOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ picks, text }: { picks: number[]; text: string }) => api.saveOnboarding(picks, text),
    onSuccess: async (dto) => {
      qc.setQueryData(keys.onboarding, dto);
      await Promise.all([qc.invalidateQueries({ queryKey: keys.me }), invalidatePersonal(qc)]);
    },
  });
}

export function usePatchOnboardingProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: OnboardingProfile) => api.patchOnboardingProfile(profile),
    onSuccess: async (dto) => {
      qc.setQueryData(keys.onboarding, dto);
      await invalidatePersonal(qc);
    },
    onError: (err) => toast(errorMessage(err), { kind: 'warn' }),
  });
}

export function useSkipOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.skipOnboarding,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

// ---------------------------------------------------------------- recommendations and books

export function useRails() {
  return useQuery({ queryKey: keys.rails, queryFn: api.rails, staleTime: 60_000 });
}

export function useFeed(q: FeedQuery) {
  return useQuery({
    queryKey: keys.feed(q),
    queryFn: () => api.feed(q),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useExplanation(bookId: number, enabled: boolean) {
  return useQuery({
    queryKey: keys.explain(bookId),
    queryFn: () => api.explain(bookId),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useBook(bookId: number) {
  return useQuery({ queryKey: keys.book(bookId), queryFn: () => api.book(bookId), staleTime: 10 * 60_000 });
}

export function useInsights(bookId: number) {
  return useQuery({
    queryKey: keys.insights(bookId),
    queryFn: () => api.insights(bookId),
    staleTime: 10 * 60_000,
  });
}

export function useSimilar(bookId: number, k = 8) {
  return useQuery({ queryKey: [...keys.similar(bookId), k], queryFn: () => api.similar(bookId, k) });
}

export function useMoreByAuthor(bookId: number) {
  return useQuery({ queryKey: keys.moreByAuthor(bookId), queryFn: () => api.moreByAuthor(bookId) });
}

export function useGenres() {
  return useQuery({ queryKey: keys.genres, queryFn: api.genres, staleTime: 30 * 60_000 });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: keys.search(q),
    queryFn: ({ signal }) => api.search(q, signal),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
