import type { Venue } from '@/types';
import { backendRequest } from '@/lib/backendHttp';

const buildQuery = (params: { adminId?: string; venueIds?: string[]; publicAccess?: boolean }) => {
  const searchParams = new URLSearchParams();

  if (params.adminId) {
    searchParams.set('adminId', params.adminId);
  }

  if (params.venueIds && params.venueIds.length > 0) {
    searchParams.set('venueIds', params.venueIds.join(','));
  }

  if (params.publicAccess) {
    searchParams.set('public', '1');
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const listVenues = async (params: { adminId?: string; venueIds?: string[]; publicAccess?: boolean } = {}) => {
  return backendRequest<Venue[]>(
    `/api/venues${buildQuery(params)}`,
    { method: 'GET' },
    { requireAuth: !params.publicAccess && Boolean(params.adminId) },
  );
};

export const createVenue = async (payload: {
  name: string;
  description: string;
  address: string;
  activityType?: string;
  adminId: string;
}) => {
  return backendRequest<Venue>(
    '/api/venues',
    {
      method: 'POST',
      body: {
        name: payload.name,
        description: payload.description,
        address: payload.address,
        activityType: payload.activityType ?? '',
      },
    },
  );
};

export const updateVenue = async (
  id: string,
  payload: Partial<Pick<Venue, 'name' | 'description' | 'address' | 'activityType'>>,
) => {
  return backendRequest<Venue>(
    `/api/venues/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
};
