import { api } from './api';

export interface SubscriptionStatus {
  tier: 'free' | 'premium' | 'premium_plus';
  daily_swipe_limit: number;
  swipes_used_today: number;
  remaining_swipes: number;
  is_premium: boolean;
}

export const subscriptionService = {
  getStatus: async (): Promise<SubscriptionStatus> => {
    const token = localStorage.getItem('token');
    return api.get('/subscription/', token || undefined);
  },

  watchAd: async (): Promise<{ message: string; swipes_restored: number; current_swipe_count: number }> => {
    const token = localStorage.getItem('token');
    return api.post('/subscription/ads/watch', {}, token || undefined);
  },

  upgrade: async (tier: 'free' | 'premium'): Promise<{ message: string }> => {
    const token = localStorage.getItem('token');
    return api.post(`/subscription/upgrade?tier=${tier}`, {}, token || undefined);
  },

  createCheckoutSession: async (tier: 'premium' | 'premium_plus'): Promise<{ checkout_url: string }> => {
    const token = localStorage.getItem('token');
    return api.post('/subscription/create-checkout-session', { tier }, token || undefined);
  },

  verifySession: async (sessionId: string): Promise<{ status: string; tier?: string }> => {
    const token = localStorage.getItem('token');
    return api.get(`/subscription/verify-session?session_id=${sessionId}`, token || undefined);
  }
};
