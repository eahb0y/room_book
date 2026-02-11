import type { VenueMembership } from '@/types';
import { request } from '@/lib/apiClient';

export const listMemberships = async (params?: { userId?: string; venueId?: string }) => {
  const search = new URLSearchParams();
  if (params?.userId) search.set('userId', params.userId);
  if (params?.venueId) search.set('venueId', params.venueId);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  const data = await request<{ memberships: VenueMembership[] }>(`/api/memberships${suffix}`);
  return data.memberships;
};

export const createMembership = async (payload: {
  venueId: string;
  userId: string;
  role?: 'member' | 'manager';
  invitationId?: string;
}) => {
  const data = await request<{ membership: VenueMembership }>('/api/memberships', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.membership;
};
