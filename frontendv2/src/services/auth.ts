import { api } from './api';

export const authService = {
  login: async (email: string, password: string) => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    return api.postForm('/auth/login', formData);
  },
  register: async (email: string, password: string, phone_number: string, username?: string) => {
    const payload: Record<string, unknown> = { email, password, phone_number };
    if (username) payload.username = username;
    return api.post('/users/', payload);
  },
  googleLogin: async (code: string) => {
    return api.get(`/auth/google/callback?code=${code}`);
  }
};
