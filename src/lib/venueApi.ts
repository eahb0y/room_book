import type { Venue } from '@/types';
import { request } from '@/lib/apiClient';

export const listVenues = async (params?: { adminId?: string; userId?: string }) => {
  const search = new URLSearchParams();
  if (params?.adminId) search.set('adminId', params.adminId);
  if (params?.userId) search.set('userId', params.userId);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  const data = await request<{ venues: Venue[] }>(`/api/venues${suffix}`);
  return data.venues;
};

export const createVenue = async (payload: {
  name: string;
  description: string;
  address: string;
  adminId: string;
}) => {
  const data = await request<{ venue: Venue }>('/api/venues', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.venue;
};

export const updateVenue = async (id: string, payload: Partial<Pick<Venue, 'name' | 'description' | 'address'>>) => {
  const data = await request<{ venue: Venue }>(`/api/venues/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.venue;
};
