import type { Room } from '@/types';
import { backendRequest } from '@/lib/backendHttp';

const buildQuery = (params: { venueId?: string; venueIds?: string[]; publicAccess?: boolean }) => {
  const searchParams = new URLSearchParams();

  if (params.venueId) {
    searchParams.set('venueId', params.venueId);
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

export const listRooms = async (params: { venueId?: string; venueIds?: string[]; publicAccess?: boolean } = {}) => {
  return backendRequest<Room[]>(
    `/api/rooms${buildQuery(params)}`,
    { method: 'GET' },
    { requireAuth: false },
  );
};

export const createRoom = async (payload: {
  venueId: string;
  name: string;
  description: string;
  location: string;
  accessType: Room['accessType'];
  availableFrom: string;
  availableTo: string;
  minBookingMinutes: number;
  maxBookingMinutes: number;
  capacity: number;
  services: string[];
  photoUrls?: string[] | null;
  photoUrl?: string | null;
}) => {
  return backendRequest<Room>(
    '/api/rooms',
    {
      method: 'POST',
      body: payload,
    },
  );
};

export const updateRoom = async (
  id: string,
  payload: Partial<
    Pick<
      Room,
      | 'name'
      | 'description'
      | 'location'
      | 'accessType'
      | 'availableFrom'
      | 'availableTo'
      | 'minBookingMinutes'
      | 'maxBookingMinutes'
      | 'capacity'
      | 'services'
      | 'photoUrl'
      | 'photoUrls'
    >
  >,
) => {
  return backendRequest<Room>(
    `/api/rooms/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
};

export const deleteRoom = async (id: string) => {
  await backendRequest<{ id: string; deleted: boolean }>(
    `/api/rooms/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
};
