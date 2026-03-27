import { api } from './api';

export const userService = {
  getMe: async () => {
    const token = localStorage.getItem('token');
    return api.get('/users/me', token || undefined);
  },
  updateProfile: async (profileData: unknown) => {
    const token = localStorage.getItem('token');
    return api.put('/users/me/profile', profileData, token || undefined);
  },
  addPhoto: async (photoData: { photo_url: string, is_primary?: boolean, photo_order?: number }) => {
    const token = localStorage.getItem('token');
    return api.post('/users/me/photos', photoData, token || undefined);
  },
  uploadPhoto: async (file: File) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('files', file);
    return api.postForm('/users/me/photos/upload', formData, token || undefined);
  },
  uploadPhotos: async (files: File[]) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    return api.postForm('/users/me/photos/upload', formData, token || undefined);
  },
  validatePhoto: async (file: File) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    return api.postForm('/users/validate-photo', formData, token || undefined);
  },
  getPhotos: async () => {
    const token = localStorage.getItem('token');
    return api.get('/users/me/photos', token || undefined);
  },
  deletePhoto: async (photoId: number) => {
    const token = localStorage.getItem('token');
    return api.delete(`/users/me/photos/${photoId}`, token || undefined);
  },
  getPreferences: async () => {
    const token = localStorage.getItem('token');
    return api.get('/users/me/preferences', token || undefined);
  },
  updatePreferences: async (prefs: unknown) => {
    const token = localStorage.getItem('token');
    return api.patch('/users/me/preferences', prefs, token || undefined);
  },
  registerPushToken: async (tokenVal: string) => {
    const token = localStorage.getItem('token');
    return api.post('/users/me/push-token', { token: tokenVal, device_type: 'web' }, token || undefined);
  },
  blockUser: async (blockedId: number, reason?: string) => {
    const token = localStorage.getItem('token');
    return api.post('/users/block', { blocked_id: blockedId, reason }, token || undefined);
  },
  reportUser: async (reportedId: number, reason: string, description?: string) => {
    const token = localStorage.getItem('token');
    return api.post('/users/report', { reported_id: reportedId, reason, description }, token || undefined);
  },
  getBlocks: async () => {
    const token = localStorage.getItem('token');
    return api.get('/users/blocks', token || undefined);
  },
  unblockUser: async (blockedId: number) => {
    const token = localStorage.getItem('token');
    return api.delete(`/users/blocks/${blockedId}`, token || undefined);
  },
  getReports: async () => {
    const token = localStorage.getItem('token');
    return api.get('/users/reports', token || undefined);
  }
};
