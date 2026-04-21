import { api } from './api';

export const chatService = {
  unmatch: async (matchId: number) => {
    const token = localStorage.getItem('token');
    return api.delete(`/chat/matches/${matchId}`, token || undefined);
  },
  deleteMessage: async (messageId: number) => {
    const token = localStorage.getItem('token');
    return api.delete(`/chat/messages/${messageId}`, token || undefined);
  },
};
