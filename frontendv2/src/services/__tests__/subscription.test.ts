import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscriptionService } from '../subscription';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('subscriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getStatus calls api.get with correct endpoint', async () => {
    const mockStatus = {
      tier: 'free',
      daily_swipe_limit: 20,
      swipes_used_today: 5,
      remaining_swipes: 15,
      is_premium: false
    };
    (api.get as any).mockResolvedValue(mockStatus);

    const result = await subscriptionService.getStatus();

    expect(api.get).toHaveBeenCalledWith('/subscription/');
    expect(result).toEqual(mockStatus);
  });

  it('watchAd calls api.post with correct endpoint', async () => {
    const mockResponse = {
      message: 'Reward granted',
      swipes_restored: 5,
      current_swipe_count: 10
    };
    (api.post as any).mockResolvedValue(mockResponse);

    const result = await subscriptionService.watchAd();

    expect(api.post).toHaveBeenCalledWith('/subscription/ads/watch', {});
    expect(result).toEqual(mockResponse);
  });

  it('upgrade calls api.post with correct endpoint and tier', async () => {
    const mockResponse = { message: 'Upgraded' };
    (api.post as any).mockResolvedValue(mockResponse);

    const result = await subscriptionService.upgrade('premium');

    expect(api.post).toHaveBeenCalledWith('/subscription/upgrade?tier=premium', {});
    expect(result).toEqual(mockResponse);
  });
});
