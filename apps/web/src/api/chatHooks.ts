import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatSessionDto } from '@litsense/shared';
import { toast } from '../store/ui';
import { api, type ChatTurnResult } from './endpoints';
import { errorMessage } from './http';
import { keys } from './hooks';

export function useChatSessions(enabled = true) {
  return useQuery({ queryKey: keys.chats, queryFn: api.chatSessions, enabled });
}

export function useChatSession(id: string | undefined) {
  return useQuery({
    queryKey: keys.chat(id ?? 'none'),
    queryFn: () => api.chatSession(id ?? ''),
    enabled: Boolean(id),
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createChat,
    onSuccess: (s) => {
      qc.setQueryData(keys.chat(s.id), s);
      void qc.invalidateQueries({ queryKey: keys.chats });
    },
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteChat,
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: keys.chat(id) });
      void qc.invalidateQueries({ queryKey: keys.chats });
    },
  });
}

/** Sends a message; the reader's words appear at once, the reply replaces the whole session. */
export function useSendChat(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => api.sendChat(id, message),
    onMutate: async ({ id, message }) => {
      await qc.cancelQueries({ queryKey: keys.chat(id) });
      const prev = qc.getQueryData<ChatSessionDto>(keys.chat(id));
      if (prev) {
        qc.setQueryData<ChatSessionDto>(keys.chat(id), {
          ...prev,
          turns: [
            ...prev.turns,
            { id: `pending-${Date.now()}`, role: 'user', text: message, at: new Date().toISOString() },
          ],
        });
      }
      return { prev, id };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.chat(ctx.id), ctx.prev);
      toast(errorMessage(err), { kind: 'warn' });
    },
    onSuccess: (res: ChatTurnResult) => {
      qc.setQueryData(keys.chat(res.session.id), res.session);
      void qc.invalidateQueries({ queryKey: keys.chats });
    },
    meta: { sessionId },
  });
}

export function useRemoveChip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, key }: { id: string; key: string }) => api.removeChip(id, key),
    onSuccess: (res) => qc.setQueryData(keys.chat(res.session.id), res.session),
    onError: (err) => toast(errorMessage(err), { kind: 'warn' }),
  });
}
