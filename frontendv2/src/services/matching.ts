import { api } from './api';

export const matchingService = {
  getCandidates: async (limit: number = 10) => {
    const token = localStorage.getItem('token');
    return api.get(`/matching/candidates?limit=${limit}`, token || undefined);
  },
  
  swipe: async (swipedId: number, swipeType: 'like' | 'pass' | 'super_like') => {
    const token = localStorage.getItem('token');
    return api.post('/matching/swipe', {
      swiped_id: swipedId,
      swipe_type: swipeType
    }, token || undefined);
  },

  getLikers: async (swipeType?: 'like' | 'super_like', limit: number = 50) => {
    const token = localStorage.getItem('token');
    const query = new URLSearchParams();
    if (swipeType) query.append('swipe_type', swipeType);
    if (limit) query.append('limit', limit.toString());
    
    return api.get(`/matching/likers?${query.toString()}`, token || undefined);
  }
};
