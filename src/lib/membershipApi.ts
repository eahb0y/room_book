import type { VenueMembership } from '@/types';
import { backendRequest } from '@/lib/backendHttp';

const buildQuery = (params: { userId?: string; venueId?: string }) => {
  const searchParams = new URLSearchParams();
  if (params.userId) searchParams.set('userId', params.userId);
  if (params.venueId) searchParams.set('venueId', params.venueId);
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const listMemberships = async (params: { userId?: string; venueId?: string } = {}) => {
  return backendRequest<VenueMembership[]>(
    `/api/memberships${buildQuery(params)}`,
    { method: 'GET' },
  );
};

export const createMembership = async (payload: {
  venueId: string;
  userId: string;
  role?: 'member' | 'manager';
  invitationId?: string;
}) => {
  return backendRequest<VenueMembership>(
    '/api/memberships',
    {
      method: 'POST',
      body: payload,
    },
  );
};

export const deleteMembership = async (id: string) => {
  await backendRequest<{ id: string; deleted: boolean }>(
    `/api/memberships/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
};
